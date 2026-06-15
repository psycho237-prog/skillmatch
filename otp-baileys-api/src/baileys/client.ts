import makeWASocket, {
  DisconnectReason,
  useSingleFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
} from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
dotenv.config();

const STORE_PATH = process.env.BAILEYS_STORE_PATH || './baileys_store';

const { state, saveState } = useSingleFileAuthState(`${STORE_PATH}/auth_info_multi.json`);
const store = makeInMemoryStore({});

let sock: ReturnType<typeof makeWASocket> | null = null;

export async function initBaileys() {
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    version,
  });

  store.readFromFile && store.readFromFile(`${STORE_PATH}/baileys_store.json`);
  store.bind(sock.ev);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'close') {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      console.log('Baileys connection closed', reason, lastDisconnect?.error);
      if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
        initBaileys().catch(console.error);
      } else {
        console.log('Logged out from WhatsApp, please re-scan QR.');
      }
    } else if (connection === 'open') {
      console.log('Baileys connected.');
    }
  });

  sock.ev.on('creds.update', saveState);
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
