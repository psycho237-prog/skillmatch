import { sendOtpViaWhatsApp } from './whatsapp-provider';
import dotenv from 'dotenv';
dotenv.config();

type SendResult = { ok: boolean; message?: string; providerMessageId?: string | null };

const provider = process.env.SMS_PROVIDER || 'whatsapp';

export async function sendOtpMessage(phone: string, message: string): Promise<SendResult> {
  if (provider === 'mock') {
    console.log('[OTP MOCK] to=', phone, 'msg=', message);
    return { ok: true, message: 'mocked' };
  }
  if (provider === 'whatsapp' || provider === 'baileys') {
    return sendOtpViaWhatsApp(phone, message);
  }
  return { ok: false, message: 'unknown provider' };
}
