const { Expo } = require("expo-server-sdk");
const logger = require("../config/logger");

const expo = new Expo();

/**
 * Fungsi generik untuk mengirim notifikasi push.
 */
const sendPushNotification = async (pushTokens, title, body, data) => {
  const messages = pushTokens
    .filter((token) => Expo.isExpoPushToken(token))
    .map((pushToken) => ({
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
      priority: "high",
      channelId: "default",
    }));

  if (messages.length === 0) {
    logger.warn("Tidak ada push token yang valid untuk dikirim.");
    return;
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
      logger.info("Chunk notifikasi berhasil dikirim.");
    } catch (error) {
      logger.error("Error saat mengirim chunk notifikasi:", error);
    }
  }

  return tickets;
};

/**
 * Fungsi spesifik untuk mengirim notifikasi panggilan masuk.
 */
const sendCallNotification = async (pushToken, { title, body, data }) => {
  const tokens = Array.isArray(pushToken) ? pushToken : [pushToken];
  return sendPushNotification(tokens, title, body, data);
};

module.exports = {
  sendPushNotification,
  sendCallNotification,
};
