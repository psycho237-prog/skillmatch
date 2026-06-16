import express, { Request, Response } from 'express';
import { pool } from '../lib/db';
import { redis } from '../lib/redis';
import { generateOtpCode, hashOtp, verifyOtpHash } from '../lib/crypto';
import { sendOtpMessage } from '../config/provider';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

const router = express.Router();
const OTP_TTL_SECONDS = 5 * 60;
const SEND_RATE_LIMIT_PER_PHONE = 3;
const SEND_RATE_LIMIT_WINDOW = 60 * 60;
const VERIFY_MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;

function phoneKey(phone: string) {
  return `otp:send:phone:${phone}`;
}

router.post('/send-otp', async (req: Request, res: Response) => {
  const phoneRaw = String(req.body.phone || '').trim();
  if (!phoneRaw) return res.status(400).json({ error: 'phone required' });

  const phone = phoneRaw.replace(/[^\d]/g, '');

  const key = phoneKey(phone);
  const sends = await redis.incr(key);
  if (sends === 1) await redis.expire(key, SEND_RATE_LIMIT_WINDOW);
  if (sends > SEND_RATE_LIMIT_PER_PHONE) return res.status(429).json({ error: 'Too many requests' });

  const code = generateOtpCode();
  const { codeHash, salt } = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  const client = await pool.connect();
  try {
    const insert = await client.query(
      `INSERT INTO otp_verifications (phone_number, code_hash, salt, expires_at, verified)
       VALUES ($1,$2,$3,$4,false) RETURNING id`,
      [phone, codeHash, salt, expiresAt]
    );

    const message = `Votre code de verification : ${code}`;
    const sendResult = await sendOtpMessage(phone, message);

    if (sendResult.ok && sendResult.providerMessageId) {
      await client.query(`UPDATE otp_verifications SET message_id=$1 WHERE id=$2`, [
        sendResult.providerMessageId,
        insert.rows[0].id,
      ]);
    }

    const allowReturn =
      process.env.SMS_ALLOW_RETURN_OTP === 'true' && process.env.NODE_ENV !== 'production';
    return res.json({ ok: true, sent: sendResult.ok, debug_otp: allowReturn ? code : undefined });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

router.post('/verify-otp', async (req: Request, res: Response) => {
  const phoneRaw = String(req.body.phone || '').trim();
  const code = String(req.body.code || '').trim();
  if (!phoneRaw || !code) return res.status(400).json({ error: 'phone and code required' });
  const phone = phoneRaw.replace(/[^\d]/g, '');

  const client = await pool.connect();
  try {
    const q = await client.query(
      `SELECT id, code_hash, salt, expires_at, verified, attempts_count, locked_until
       FROM otp_verifications
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );
    if (q.rowCount === 0) return res.status(400).json({ error: 'invalid_or_expired' });
    const row = q.rows[0];

    if (row.verified) return res.status(400).json({ error: 'already_verified' });
    if (row.locked_until && new Date(row.locked_until) > new Date())
      return res.status(423).json({ error: 'temporarily_locked' });
    if (new Date(row.expires_at) < new Date())
      return res.status(400).json({ error: 'invalid_or_expired' });

    const ok = verifyOtpHash(code, row.salt, row.code_hash);
    if (!ok) {
      const attempts = row.attempts_count + 1;
      if (attempts >= VERIFY_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_SECONDS * 1000);
        await client.query(
          `UPDATE otp_verifications SET attempts_count=$1, locked_until=$2 WHERE id=$3`,
          [attempts, lockedUntil, row.id]
        );
      } else {
        await client.query(`UPDATE otp_verifications SET attempts_count=$1 WHERE id=$2`, [
          attempts,
          row.id,
        ]);
      }
      return res.status(400).json({ error: 'invalid_code' });
    }

    await client.query(`UPDATE otp_verifications SET verified=true WHERE id=$1`, [row.id]);

    const userQ = await client.query(
      `SELECT id, display_name FROM users WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    let isNew = false;
    let userId: string;
    if (userQ.rowCount === 0) {
      const create = await client.query(
        `INSERT INTO users (phone, display_name) VALUES ($1,$2) RETURNING id`,
        [phone, `User ${phone.slice(-4)}`]
      );
      userId = create.rows[0].id;
      isNew = true;
    } else {
      userId = userQ.rows[0].id;
    }

    const token = jwt.sign(
      { sub: userId, phone },
      process.env.JWT_SECRET || 'jwt_secret',
      { expiresIn: '30d' }
    );
    return res.json({ ok: true, token, is_new_user: isNew });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    client.release();
  }
});

export default router;
