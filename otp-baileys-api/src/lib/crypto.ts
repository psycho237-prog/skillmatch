import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const HMAC_SECRET = process.env.OTP_HMAC_SECRET || 'fallback_secret';

export function generateOtpCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

export function hashOtp(code: string, salt?: string) {
  const usedSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(usedSalt + code);
  return { codeHash: hmac.digest('hex'), salt: usedSalt };
}

export function verifyOtpHash(code: string, salt: string, codeHash: string) {
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(salt + code);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(codeHash));
}
