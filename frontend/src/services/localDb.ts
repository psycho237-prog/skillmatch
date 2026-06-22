import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('skillmatch_chats.db');
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        reply_to_id TEXT,
        is_edited INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        reactions TEXT DEFAULT '{}'
      );
    `);
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_conversations (
        id TEXT PRIMARY KEY,
        user1_id TEXT NOT NULL,
        user2_id TEXT NOT NULL,
        service_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message TEXT
      );
    `);
  }
  return db;
};

export const saveMessageLocally = async (message: any) => {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO local_messages 
    (id, conversation_id, sender_id, content, created_at, status, reply_to_id, is_edited, is_deleted, reactions) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.conversation_id,
      message.sender_id,
      message.content,
      message.created_at,
      message.status || 'sent',
      message.reply_to_id || null,
      message.is_edited ? 1 : 0,
      message.is_deleted ? 1 : 0,
      JSON.stringify(message.reactions || {})
    ]
  );
};

export const saveMessagesLocally = async (messages: any[]) => {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    for (const message of messages) {
      await database.runAsync(
        `INSERT OR REPLACE INTO local_messages 
        (id, conversation_id, sender_id, content, created_at, status, reply_to_id, is_edited, is_deleted, reactions) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.conversation_id,
          message.sender_id,
          message.content,
          message.created_at,
          message.status || 'sent',
          message.reply_to_id || null,
          message.is_edited ? 1 : 0,
          message.is_deleted ? 1 : 0,
          JSON.stringify(message.reactions || {})
        ]
      );
    }
  });
};

export const getLocalMessages = async (conversation_id: string) => {
  const database = await getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM local_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversation_id]
  );
  
  return rows.map((r: any) => ({
    ...r,
    is_edited: r.is_edited === 1,
    is_deleted: r.is_deleted === 1,
    reactions: JSON.parse(r.reactions || '{}')
  }));
};

export const getLocalConversations = async () => {
  const database = await getDb();
  return await database.getAllAsync('SELECT * FROM local_conversations ORDER BY updated_at DESC');
};

export const saveConversationsLocally = async (conversations: any[]) => {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    for (const c of conversations) {
      await database.runAsync(
        `INSERT OR REPLACE INTO local_conversations 
        (id, user1_id, user2_id, service_id, created_at, updated_at, last_message) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id, c.user1_id, c.user2_id, c.service_id, c.created_at, c.updated_at, 
          JSON.stringify(c.last_message || {})
        ]
      );
    }
  });
};

export const wipeLocalDb = async () => {
  const database = await getDb();
  await database.execAsync('DELETE FROM local_messages; DELETE FROM local_conversations;');
};

import { api } from './api';

export const backupDbToCloud = async () => {
  const database = await getDb();
  const messages = await database.getAllAsync('SELECT * FROM local_messages');
  const conversations = await database.getAllAsync('SELECT * FROM local_conversations');
  
  const backupData = { messages, conversations };
  await api.uploadChatBackup(backupData);
};

export const restoreDbFromCloud = async () => {
  try {
    const backupData = await api.getChatBackup();
    if (backupData && backupData.messages && backupData.conversations) {
      const database = await getDb();
      await database.withTransactionAsync(async () => {
        await database.execAsync('DELETE FROM local_messages; DELETE FROM local_conversations;');
        
        for (const m of backupData.messages) {
          await database.runAsync(
            `INSERT INTO local_messages 
            (id, conversation_id, sender_id, content, created_at, status, reply_to_id, is_edited, is_deleted, reactions) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [m.id, m.conversation_id, m.sender_id, m.content, m.created_at, m.status, m.reply_to_id, m.is_edited, m.is_deleted, m.reactions]
          );
        }

        for (const c of backupData.conversations) {
          await database.runAsync(
            `INSERT INTO local_conversations 
            (id, user1_id, user2_id, service_id, created_at, updated_at, last_message) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.user1_id, c.user2_id, c.service_id, c.created_at, c.updated_at, c.last_message]
          );
        }
      });
      return true;
    }
    return false;
  } catch (e: any) {
    if (e.message?.includes('404')) return false; // no backup found
    throw e;
  }
};
