import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

const DB_NAME = 'skillmatch_chat.db';
let db: SQLite.SQLiteDatabase | null = null;

// Mock encryption for demonstration purposes
// In a real app, you'd use a robust library like react-native-crypto
async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  return `ENC:${text}`; // Placeholder for real encryption
}

async function decrypt(text: string): Promise<string> {
  if (text.startsWith('ENC:')) {
    return text.slice(4); // Placeholder for real decryption
  }
  return text;
}

async function getEncryptionKey() {
  let key = await SecureStore.getItemAsync('chat_encryption_key');
  if (!key) {
    key = Math.random().toString(36).substring(2, 15);
    await SecureStore.setItemAsync('chat_encryption_key', key);
  }
  return key;
}

export async function initDB() {
  if (db) return;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      sender_id TEXT,
      content TEXT,
      status TEXT,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_conv_id ON local_messages(conversation_id);
  `);
}

export async function saveMessageLocally(message: any) {
  if (!db) await initDB();
  const encryptedContent = await encrypt(message.content);
  
  await db!.runAsync(
    'INSERT OR REPLACE INTO local_messages (id, conversation_id, sender_id, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [message.id, message.conversation_id, message.sender_id, encryptedContent, message.status, message.created_at]
  );
}

export async function getLocalMessages(conversationId: string) {
  if (!db) await initDB();
  const rows = await db!.getAllAsync(
    'SELECT * FROM local_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  ) as any[];

  return Promise.all(rows.map(async (row) => ({
    ...row,
    content: await decrypt(row.content)
  })));
}

export async function updateLocalMessageStatus(conversationId: string, status: string, senderIdNotEqual: string) {
  if (!db) await initDB();
  await db!.runAsync(
    'UPDATE local_messages SET status = ? WHERE conversation_id = ? AND sender_id != ?',
    [status, conversationId, senderIdNotEqual]
  );
}
