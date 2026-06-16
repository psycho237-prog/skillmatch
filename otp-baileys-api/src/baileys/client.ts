import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const STORE_PATH = process.env.BAILEYS_STORE_PATH || './baileys_store';
const AUTH_INFO_PATH = path.join(STORE_PATH, 'auth_info_multi');

const store = makeInMemoryStore({});

let sock: ReturnType<typeof makeWASocket> | null = null;

function clearAuthInfo() {
  if (fs.existsSync(AUTH_INFO_PATH)) {
    try {
      fs.rmSync(AUTH_INFO_PATH, { recursive: true, force: true });
      console.log('🗑️ Cleared stale WhatsApp auth credentials.');
    } catch (err) {
      console.error('Failed to clear WhatsApp auth credentials:', err);
    }
  }
}

export async function initBaileys() {
  let version;
  try {
    const versionResult = await fetchLatestBaileysVersion();
    version = versionResult.version;
  } catch (err) {
    console.warn('⚠️ Failed to fetch latest Baileys version, using fallback [6, 33, 0]', err);
    version = [6, 33, 0];
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_INFO_PATH);

  sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    version,
    browser: ['Chrome (Linux)', 'Chrome', '110.0.0.0'],
  });

  store.readFromFile && store.readFromFile(`${STORE_PATH}/baileys_store.json`);
  store.bind(sock.ev);

export let currentQR: string | null = null;
export let connectionState: string = 'connecting';

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      currentQR = qr;
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      connectionState = 'disconnected';
      currentQR = null;
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode ?? 0;
      console.log('Baileys connection closed', reason, lastDisconnect?.error);
      
      if (reason !== DisconnectReason.loggedOut) {
        console.log('Reconnecting to Baileys...');
        setTimeout(() => initBaileys().catch(console.error), 5000);
      } else {
        console.log('Logged out from WhatsApp. Clearing session...');
        clearAuthInfo();
        setTimeout(() => initBaileys().catch(console.error), 5000);
      }
    } else if (connection === 'open') {
      connectionState = 'connected';
      currentQR = null;
      console.log('Baileys connected.');
    }
  });

  sock.ev.on('creds.update', saveCreds);
  return sock;
}

export function getSocket() {
  if (!sock) throw new Error('Baileys socket not initialized');
  return sock;
}

export async function sendWhatsAppMessage(jid: string, text: string) {
  const s = getSocket();
  const res = await s.sendMessage(jid, { text });
  const id = res?.key?.id ?? null;
  return id;
}
