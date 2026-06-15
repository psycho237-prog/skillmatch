const { Expo } = require('expo-server-sdk');
const { query } = require('./database');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification to a specific user
 * @param {string} userId - UUID of the user
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // 1. Fetch user's push token
    const res = await query('SELECT push_token, notification_enabled FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) return;
    
    const user = res.rows[0];
    if (!user.notification_enabled || !user.push_token) return;

    // 2. Validate token
    if (!Expo.isExpoPushToken(user.push_token)) {
      console.error(`[Push Notification] Token invalide pour user ${userId}: ${user.push_token}`);
      return;
    }

    // 3. Create message
    const messages = [{
      to: user.push_token,
      sound: 'default',
      title,
      body,
      data,
    }];

    // 4. Send via Expo
    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log('[Push Notification] Succès:', ticketChunk);
      } catch (error) {
        console.error('[Push Notification] Erreur envoi Expo:', error);
      }
    }
  } catch (error) {
    console.error('[Push Notification] Erreur globale:', error);
  }
}

module.exports = {
  sendPushNotification
};
