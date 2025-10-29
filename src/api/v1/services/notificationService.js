const { Expo } = require("expo-server-sdk");
const {
  logger,
  logWithContext,
  errorWithContext,
} = require("../../../config/logger");

let expo;
try {
  expo = new Expo({});
  if (logger && typeof logger.info === "function") {
    logger.info("Expo SDK client initialized for push notifications.");
  } else {
    console.log("Expo SDK client initialized for push notifications.");
  }
} catch (initError) {
  expo = null;
  const errorMsg = "Failed to initialize Expo SDK client";
  if (logger && typeof logger.error === "function") {
    logger.error(errorMsg, {
      error: initError.message,
      stack: initError.stack,
    });
  } else {
    console.error(errorMsg, initError);
  }
}

const sendPushNotification = async (
  pushTokens,
  title,
  body,
  data = {},
  req = null
) => {
  if (!expo) {
    const initError = new Error(
      "Expo SDK client is not initialized. Cannot send notifications."
    );
    errorWithContext(
      "Attempted to send notification but Expo SDK failed to initialize",
      initError,
      req
    );
    return undefined;
  }

  const tokens = Array.isArray(pushTokens) ? pushTokens : [pushTokens];
  logWithContext("info", `Attempting to send push notification`, req, {
    recipientCount: tokens.length,
    title,
  });

  const messages = tokens
    .filter((token) => {
      const isValid = Expo.isExpoPushToken(token);
      if (!isValid) {
        logWithContext("warn", `Invalid Expo push token format skipped`, req, {
          pushToken: token,
        });
      }
      return isValid;
    })
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
    logWithContext(
      "warn",
      "Tidak ada push token yang valid untuk dikirim.",
      req
    );
    return [];
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const errors = [];

  logWithContext(
    "debug",
    `Sending ${messages.length} notifications in ${chunks.length} chunk(s)`,
    req
  );

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
      logWithContext("info", "Chunk notifikasi berhasil dikirim.", req, {
        ticketCount: ticketChunk.length,
      });
    } catch (error) {
      errorWithContext("Error saat mengirim chunk notifikasi:", error, req);
      errors.push(error);
      if (error.details) {
        logWithContext("error", "Failed push token details in chunk:", req, {
          details: error.details,
        });
      }
    }
  }

  if (errors.length === chunks.length && chunks.length > 0) {
    logWithContext(
      "error",
      "Failed to send ALL push notification chunks.",
      req
    );
  }

  return tickets;
};

const sendCallNotification = async (
  pushToken,
  { title, body, data },
  req = null
) => {
  const tokens = Array.isArray(pushToken) ? pushToken : [pushToken];
  logWithContext("info", "Sending specific call notification", req, {
    recipientCount: tokens.length,
    callId: data?.callId,
  });
  return sendPushNotification(tokens, title, body, data, req);
};

const handlePushNotificationReceipts = async (tickets, req = null) => {
  logWithContext("info", "Receipt handling logic placeholder...", req);
};

module.exports = {
  sendPushNotification,
  sendCallNotification,
};
