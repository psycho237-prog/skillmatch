import { sendWhatsAppMessage } from '../baileys/client';

export async function sendOtpViaWhatsApp(phone: string, message: string) {
  const jid = `${phone}@s.whatsapp.net`;
  try {
    const messageId = await sendWhatsAppMessage(jid, message);
    return { ok: true, providerMessageId: messageId };
  } catch (err: any) {
    console.error('WhatsApp send error', err);
    return { ok: false, message: err?.message ?? String(err) };
  }
}
