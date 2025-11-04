const { Expo } = require("expo-server-sdk");
const {
  logger,
  logWithContext,
  errorWithContext,
} = require("../../../config/logger");
const { redisClient } = require("../../../config/redis");
const User = require("../models/User");

const TICKET_HASH_KEY = "notification_tickets";
const RECEIPT_CHECK_INTERVAL_MS = 15 * 60 * 1000;

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
  const ticketsToStore = {};

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

      ticketChunk.forEach((ticket, index) => {
        const correspondingToken = chunk[index].to;
        if (ticket.status === "ok" && ticket.id) {
          ticketsToStore[ticket.id] = correspondingToken;
        } else if (ticket.status === "error") {
          logWithContext(
            "warn",
            `Error sending push notification (not storing ticket)`,
            req,
            {
              token: correspondingToken,
              error: ticket.message,
              details: ticket.details,
            }
          );
          if (
            ticket.details &&
            ticket.details.error === "DeviceNotRegistered"
          ) {
            User.updateOne(
              { pushToken: correspondingToken },
              { $unset: { pushToken: 1 } }
            ).catch((dbError) => {
              errorWithContext(
                "Failed to remove invalid push token on send",
                dbError,
                req,
                { token: correspondingToken }
              );
            });
          }
        }
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

  if (Object.keys(ticketsToStore).length > 0) {
    try {
      await redisClient.hSet(TICKET_HASH_KEY, ticketsToStore);
      logWithContext(
        "debug",
        `Stored ${
          Object.keys(ticketsToStore).length
        } notification tickets for receipt checking`,
        req
      );
    } catch (redisError) {
      errorWithContext(
        "Failed to store notification tickets in Redis",
        redisError,
        req
      );
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

const handlePushNotificationReceipts = async () => {
  if (!expo) {
    logger.warn("Receipt handler skipping, Expo SDK not initialized.");
    return;
  }
  logWithContext("info", "Running notification receipt check...", null);

  let tickets;
  try {
    tickets = await redisClient.hGetAll(TICKET_HASH_KEY);
  } catch (redisError) {
    errorWithContext(
      "Failed to get notification tickets from Redis",
      redisError,
      null
    );
    return;
  }

  if (!tickets || Object.keys(tickets).length === 0) {
    logWithContext("debug", "No notification tickets to check.", null);
    return;
  }

  const ticketIds = Object.keys(tickets);
  const ticketChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const ticketsToDelete = [];
  const tokensToUnregister = new Set();

  for (const chunk of ticketChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const ticketId in receipts) {
        const receipt = receipts[ticketId];
        const pushToken = tickets[ticketId];

        if (receipt.status === "ok") {
          ticketsToDelete.push(ticketId);
        } else if (receipt.status === "error") {
          logWithContext(
            "warn",
            `Notification receipt error for token ${pushToken}`,
            null,
            {
              error: receipt.message,
              details: receipt.details,
            }
          );
          if (
            receipt.details &&
            receipt.details.error === "DeviceNotRegistered"
          ) {
            tokensToUnregister.add(pushToken);
          }
          ticketsToDelete.push(ticketId);
        }
      }
    } catch (error) {
      errorWithContext("Error checking notification receipts", error, null);
    }
  }

  if (tokensToUnregister.size > 0) {
    const tokens = Array.from(tokensToUnregister);
    logWithContext(
      "info",
      `Removing ${tokens.length} unregistered push tokens from DB...`,
      null,
      { tokens }
    );
    try {
      await User.updateMany(
        { pushToken: { $in: tokens } },
        { $unset: { pushToken: 1 } }
      );
    } catch (dbError) {
      errorWithContext(
        "Failed to remove invalid push tokens from DB",
        dbError,
        null
      );
    }
  }

  if (ticketsToDelete.length > 0) {
    try {
      await redisClient.hDel(TICKET_HASH_KEY, ticketsToDelete);
      logWithContext(
        "debug",
        `Removed ${ticketsToDelete.length} processed tickets from Redis.`,
        null
      );
    } catch (redisError) {
      errorWithContext(
        "Failed to remove processed tickets from Redis",
        redisError,
        null
      );
    }
  }
};

const startReceiptProcessing = () => {
  logWithContext(
    "info",
    `Starting notification receipt processor. Interval: ${
      RECEIPT_CHECK_INTERVAL_MS / 1000
    }s`,
    null
  );
  handlePushNotificationReceipts().catch((err) => {
    errorWithContext("Initial receipt check failed", err, null);
  });

  setInterval(async () => {
    try {
      await handlePushNotificationReceipts();
    } catch (err) {
      errorWithContext("Error during scheduled receipt check", err, null);
    }
  }, RECEIPT_CHECK_INTERVAL_MS);
};

module.exports = {
  sendPushNotification,
  sendCallNotification,
  startReceiptProcessing,
};
