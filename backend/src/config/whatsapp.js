require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const STORE_PATH = process.env.BAILEYS_STORE_PATH || path.join(__dirname, '../../baileys_store');

// Ensure directory exists
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH, { recursive: true });
}

let sock = null;
let latestQr = null;
let connectionState = 'connecting'; // 'connecting', 'qr', 'pairing', 'connected', 'disconnected'
let latestPairingCode = null;
let pairingNumber = null;

const AUTH_INFO_PATH = path.join(STORE_PATH, 'auth_info_multi');

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

function getLatestQr() {
  return latestQr;
}

function getConnectionState() {
  return connectionState;
}

function getLatestPairingCode() {
  return latestPairingCode;
}

function getPairingNumber() {
  return pairingNumber;
}

async function requestPairingCode(phoneNumber) {
  if (!sock) {
    throw new Error('Baileys socket is not initialized');
  }
  
  if (sock.authState && sock.authState.creds && sock.authState.creds.registered) {
    throw new Error('WhatsApp is already registered and connected');
  }

  const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
  if (!cleanNumber) {
    throw new Error('Invalid phone number format');
  }

  try {
    connectionState = 'pairing';
    pairingNumber = cleanNumber;
    latestQr = null;
    const code = await sock.requestPairingCode(cleanNumber);
    latestPairingCode = code;
    console.log(`\n🔑 DYNAMIC WHATSAPP PAIRING CODE FOR +${cleanNumber}: ${code}\n`);
    return code;
  } catch (err) {
    connectionState = 'disconnected';
    pairingNumber = null;
    latestPairingCode = null;
    console.error('Failed to request pairing code dynamically:', err);
    throw err;
  }
}

async function initBaileys() {
  try {
    let version;
    try {
      const versionResult = await fetchLatestBaileysVersion();
      version = versionResult.version;
    } catch (vErr) {
      console.warn('⚠️ Failed to fetch latest Baileys version, using fallback [6, 33, 0]', vErr);
      version = [6, 33, 0];
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_INFO_PATH);
    
    connectionState = 'connecting';

    sock = makeWASocket({
      printQRInTerminal: false,
      auth: state,
      version,
      browser: ['Chrome (Linux)', 'Chrome', '110.0.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        latestQr = qr;
        connectionState = 'qr';
        if (!process.env.WHATSAPP_PAIRING_NUMBER && !pairingNumber) {
          console.log('📌 Scan this QR code to authenticate with WhatsApp:');
          qrcode.generate(qr, { small: true });
        }
      }
      
      if (connection === 'close') {
        latestQr = null;
        latestPairingCode = null;
        const reason = lastDisconnect && lastDisconnect.error 
          ? (new Boom(lastDisconnect.error).output.statusCode || 0) 
          : 0;
        console.log('Baileys connection closed. Reason:', reason);
        
        if (reason !== DisconnectReason.loggedOut) {
          connectionState = 'connecting';
          console.log('Reconnecting to Baileys...');
          setTimeout(() => initBaileys().catch(console.error), 5000);
        } else {
          connectionState = 'disconnected';
          console.log('Logged out from WhatsApp. Clearing credentials and preparing for new login...');
          clearAuthInfo();
          setTimeout(() => initBaileys().catch(console.error), 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ Baileys connected to WhatsApp.');
        latestQr = null;
        latestPairingCode = null;
        pairingNumber = null;
        connectionState = 'connected';
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Support for pairing code configured in env
    if (process.env.WHATSAPP_PAIRING_NUMBER && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const number = process.env.WHATSAPP_PAIRING_NUMBER.replace(/[^\d]/g, '');
          connectionState = 'pairing';
          pairingNumber = number;
          const code = await sock.requestPairingCode(number);
          latestPairingCode = code;
          console.log(`\n🔑 WHATSAPP PAIRING CODE FOR +${number}: ${code}\n`);
        } catch (err) {
          console.error('Failed to request pairing code:', err);
        }
      }, 5000);
    }

    return sock;
  } catch (err) {
    console.error('Failed to init Baileys client:', err);
    connectionState = 'disconnected';
    throw err;
  }
}

function getSocket() {
  if (!sock) {
    throw new Error('Baileys socket not initialized');
  }
  return sock;
}

async function sendWhatsAppMessage(jid, text) {
  const s = getSocket();
  const res = await s.sendMessage(jid, { text });
  const id = res && res.key ? res.key.id : null;
  return id;
}

module.exports = {
  initBaileys,
  getSocket,
  sendWhatsAppMessage,
  getLatestQr,
  getConnectionState,
  getLatestPairingCode,
  getPairingNumber,
  requestPairingCode,
  clearAuthInfo,
};
