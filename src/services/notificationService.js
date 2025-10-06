const { Expo } = require("expo-server-sdk");

const expo = new Expo();

const sendPushNotification = async (pushTokens, title, body, data) => {
  const messages = pushTokens
    .filter((token) => Expo.isExpoPushToken(token))
    .map((pushToken) => ({
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
    }));

  if (messages.length === 0) {
    console.log("Tidak ada push token yang valid untuk dikirim.");
    return;
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error saat mengirim chunk notifikasi:", error);
    }
  }

  console.log("Tiket notifikasi telah dikirim:", tickets);
};

module.exports = { sendPushNotification };
