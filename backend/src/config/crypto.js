const crypto = require('crypto');

const HMAC_SECRET = process.env.OTP_HMAC_SECRET || 'fallback_secret';

function generateOtpCode() {
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, '0');
}

function hashOtp(code, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(usedSalt + code);
  return { codeHash: hmac.digest('hex'), salt: usedSalt };
}

function verifyOtpHash(code, salt, codeHash) {
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(salt + code);
  const digest = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(codeHash));
  } catch (err) {
    return false;
  }
}

module.exports = {
  generateOtpCode,
  hashOtp,
  verifyOtpHash,
};
