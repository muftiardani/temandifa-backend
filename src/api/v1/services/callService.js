const crypto = require("crypto");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { redisClient } = require("../../../config/redis");
const User = require("../models/User");
const { logWithContext, errorWithContext } = require("../../../config/logger");
const notificationService = require("./notificationService");
const { userSocketMap } = require("../../../socket/socketHandler");

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const AGORA_TOKEN_EXPIRATION_TIME_IN_SECONDS = 3600;

const CALL_RINGING_TTL = 60;
const CALL_ACTIVE_TTL = 3600 * 2;

const generateAgoraUid = () => {
  return Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
};

const generateAgoraToken = (channelName, uid, req) => {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    const configError = new Error(
      "Konfigurasi server panggilan tidak lengkap (Agora App ID/Certificate)."
    );
    errorWithContext(
      "Agora App ID or Certificate is missing in environment variables",
      configError,
      req
    );
    throw configError;
  }
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = AGORA_TOKEN_EXPIRATION_TIME_IN_SECONDS;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );
    logWithContext(
      "debug",
      `Generated Agora token for UID ${uid} in channel ${channelName}`,
      req
    );
    return token;
  } catch (error) {
    errorWithContext("Failed to generate Agora token", error, req);
    throw new Error("Gagal menghasilkan token panggilan.");
  }
};

const initiateCall = async (callerId, calleePhoneNumber, req) => {
  logWithContext(
    "info",
    `Initiating call from ${callerId} to ${calleePhoneNumber}`,
    req
  );

  const normalizedCalleeNumber = calleePhoneNumber.replace(/\D/g, "");
  const callee = await User.findOne({
    phoneNumber: normalizedCalleeNumber,
  }).lean();

  if (!callee) {
    logWithContext(
      "warn",
      `Callee not found for phone number: ${calleePhoneNumber} (Normalized: ${normalizedCalleeNumber})`,
      req
    );
    const error = new Error(
      "Pengguna dengan nomor telepon tersebut tidak ditemukan."
    );
    error.statusCode = 404;
    throw error;
  }

  if (callee._id.toString() === callerId) {
    logWithContext("warn", `User ${callerId} tried calling themselves`, req);
    const error = new Error("Anda tidak dapat menelepon diri sendiri.");
    error.statusCode = 400;
    throw error;
  }

  const caller = await User.findById(callerId).select("email name").lean();
  if (!caller) {
    logWithContext("error", `Caller user not found: ${callerId}`, req);
    const error = new Error("User pemanggil tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  const callerExistingCall = await getActiveCall(callerId);
  if (callerExistingCall) {
    logWithContext(
      "warn",
      `Caller ${callerId} is already in an active call`,
      req
    );
    const error = new Error("Anda sudah berada dalam panggilan lain.");
    error.statusCode = 409;
    throw error;
  }
  const calleeExistingCall = await getActiveCall(callee._id.toString());
  if (calleeExistingCall) {
    logWithContext(
      "warn",
      `Callee ${callee._id} is already in another call`,
      req
    );
    const error = new Error(
      "Pengguna yang Anda hubungi sedang dalam panggilan lain."
    );
    error.statusCode = 409;
    throw error;
  }

  const callId = crypto.randomUUID();
  const channelName = `call-${callId}`;
  const callerUid = generateAgoraUid();
  const calleeUid = generateAgoraUid();

  if (callerUid === calleeUid) {
    errorWithContext(
      "Generated identical UIDs for caller and callee",
      new Error("UID Collision"),
      req
    );
    throw new Error(
      "Gagal menghasilkan ID pengguna unik untuk panggilan. Coba lagi."
    );
  }

  const callerToken = generateAgoraToken(channelName, callerUid, req);
  const calleeToken = generateAgoraToken(channelName, calleeUid, req);

  const callData = {
    callId,
    channelName,
    status: "ringing",
    caller: {
      id: callerId,
      name: caller.name || caller.email,
      uid: callerUid,
      token: callerToken,
    },
    callee: {
      id: callee._id.toString(),
      name: callee.name || callee.email,
      uid: calleeUid,
      token: calleeToken,
    },
    createdAt: new Date().toISOString(),
  };

  try {
    await redisClient.set(`call:${callId}`, JSON.stringify(callData), {
      EX: CALL_RINGING_TTL,
    });
    logWithContext(
      "info",
      `Call state 'ringing' saved to Redis. Call ID: ${callId}`,
      req
    );
  } catch (redisError) {
    errorWithContext("Failed to save call state to Redis", redisError, req);
    throw new Error("Gagal menyimpan status panggilan.");
  }

  if (callee.pushToken) {
    logWithContext(
      "info",
      `Sending push notification to callee ${callee._id}`,
      req
    );
    notificationService
      .sendCallNotification(
        callee.pushToken,
        caller.name || caller.email || "Seseorang",
        callId,
        channelName
      )
      .catch((notifError) => {
        errorWithContext("Failed to send push notification", notifError, req, {
          calleeId: callee._id,
        });
      });
  } else {
    logWithContext(
      "warn",
      `Callee ${callee._id} does not have a push token, skipping notification`,
      req
    );
  }

  return {
    callId: callData.callId,
    channelName: callData.channelName,
    token: callData.caller.token,
    uid: callData.caller.uid,
    calleeInfo: { name: callData.callee.name },
  };
};

const answerCall = async (callId, userId) => {
  logWithContext(
    "info",
    `Answering call request for call ID: ${callId} by user ${userId}`,
    null
  );

  let callDataString;
  try {
    callDataString = await redisClient.get(`call:${callId}`);
  } catch (redisError) {
    errorWithContext("Failed to get call state from Redis", redisError, null, {
      callId,
    });
    throw new Error("Gagal mengambil status panggilan.");
  }

  if (!callDataString) {
    logWithContext(
      "warn",
      `Call ID ${callId} not found or expired when answering`,
      null
    );
    const error = new Error("Panggilan tidak ditemukan atau telah berakhir.");
    error.statusCode = 404;
    throw error;
  }

  const callData = JSON.parse(callDataString);

  if (callData.callee.id !== userId) {
    logWithContext(
      "error",
      `User ${userId} attempted to answer call ${callId} intended for ${callData.callee.id}`,
      null
    );
    const error = new Error("Tidak diizinkan untuk menjawab panggilan ini.");
    error.statusCode = 403;
    throw error;
  }
  if (callData.status !== "ringing") {
    logWithContext(
      "warn",
      `Attempted to answer call ${callId} which is not 'ringing' (current: ${callData.status})`,
      null
    );
    const error = new Error(
      `Tidak dapat menjawab panggilan karena statusnya ${callData.status}.`
    );
    error.statusCode = 409;
    throw error;
  }

  callData.status = "active";
  callData.answeredAt = new Date().toISOString();

  try {
    await redisClient.set(`call:${callId}`, JSON.stringify(callData), {
      EX: CALL_ACTIVE_TTL,
    });
    logWithContext(
      "info",
      `Call state updated to 'active' in Redis. Call ID: ${callId}`,
      null
    );
  } catch (redisError) {
    errorWithContext(
      "Failed to update call state to active in Redis",
      redisError,
      null,
      { callId }
    );
  }

  const callerSocketId = userSocketMap.get(callData.caller.id);
  if (callerSocketId) {
    try {
      const { io } = require("../../index");
      if (io) {
        io.to(callerSocketId).emit("call-answered", { callId });
        logWithContext(
          "info",
          `Sent 'call-answered' event to caller ${callData.caller.id}`,
          null,
          { callId }
        );
      } else {
        logWithContext(
          "warn",
          "Socket.IO instance (io) not found in index.js export",
          null,
          { callId }
        );
      }
    } catch (importError) {
      logWithContext(
        "error",
        "Failed to import io from index.js for emitting event",
        importError,
        null
      );
    }
  } else {
    logWithContext(
      "warn",
      `Caller socket not found for user ${callData.caller.id}, cannot emit call-answered`,
      null,
      { callId }
    );
  }

  return {
    channelName: callData.channelName,
    token: callData.callee.token,
    uid: callData.callee.uid,
  };
};

const endCall = async (callId, userId) => {
  logWithContext(
    "info",
    `Ending/declining/cancelling call request for call ID: ${callId} by user ${userId}`,
    null
  );

  let callDataString;
  try {
    callDataString = await redisClient.get(`call:${callId}`);
  } catch (redisError) {
    errorWithContext(
      "Failed to get call state from Redis during endCall",
      redisError,
      null,
      { callId }
    );
    return {
      message: "Gagal mengambil status, panggilan mungkin sudah berakhir.",
    };
  }

  if (!callDataString) {
    logWithContext(
      "warn",
      `Call ID ${callId} not found or already ended when attempting to end`,
      null
    );
    return { message: "Panggilan tidak ditemukan atau sudah berakhir." };
  }

  const callData = JSON.parse(callDataString);

  const isCaller = callData.caller.id === userId;
  const isCallee = callData.callee.id === userId;
  if (!isCaller && !isCallee) {
    logWithContext(
      "error",
      `User ${userId} attempted to end call ${callId} they are not part of`,
      null
    );
    const error = new Error("Tidak diizinkan untuk mengakhiri panggilan ini.");
    error.statusCode = 403;
    throw error;
  }

  let action = "ended";
  let peerId = null;
  let socketEvent = "call-ended";

  if (callData.status === "ringing") {
    if (isCaller) {
      action = "cancelled";
      peerId = callData.callee.id;
      socketEvent = "call-cancelled";
    } else {
      action = "declined";
      peerId = callData.caller.id;
      socketEvent = "call-declined";
    }
  } else if (callData.status === "active") {
    action = "ended";
    peerId = isCaller ? callData.callee.id : callData.caller.id;
    socketEvent = "call-ended";
  } else {
    logWithContext(
      "info",
      `Call ${callId} already in state '${callData.status}', no action needed for endCall`,
      null
    );
    return { message: "Panggilan sudah berakhir sebelumnya." };
  }

  try {
    const deleted = await redisClient.del(`call:${callId}`);
    if (deleted > 0) {
      logWithContext(
        "info",
        `Call state deleted from Redis. Call ID: ${callId}`,
        null
      );
    } else {
      logWithContext(
        "warn",
        `Attempted to delete non-existent call state from Redis: ${callId}`,
        null
      );
    }
  } catch (redisError) {
    errorWithContext(
      "Failed to delete call state from Redis",
      redisError,
      null,
      { callId }
    );
  }

  if (peerId && socketEvent) {
    const peerSocketId = userSocketMap.get(peerId);
    if (peerSocketId) {
      try {
        const { io } = require("../../index");
        if (io) {
          io.to(peerSocketId).emit(socketEvent, { callId });
          logWithContext(
            "info",
            `Sent '${socketEvent}' event to peer ${peerId}`,
            null,
            { callId }
          );
        } else {
          logWithContext(
            "warn",
            "Socket.IO instance (io) not found, cannot emit event",
            null,
            { callId, peerId, event: socketEvent }
          );
        }
      } catch (importError) {
        logWithContext(
          "error",
          "Failed to import io from index.js for emitting event",
          importError,
          null
        );
      }
    } else {
      logWithContext(
        "warn",
        `Peer socket not found for user ${peerId}, cannot emit ${socketEvent}`,
        null,
        { callId }
      );
    }
  }

  logWithContext(
    "info",
    `Call ${callId} successfully ${action} by user ${userId}`,
    null
  );
  const message = `Panggilan berhasil di${
    action === "cancelled"
      ? "batalkan"
      : action === "declined"
      ? "tolak"
      : "akhiri"
  }.`;
  return { message: message };
};

const getActiveCall = async (userId) => {
  let activeCallData = null;
  try {
    let cursor = 0;
    do {
      const reply = await redisClient.scan(cursor, {
        MATCH: "call:*",
        COUNT: 100,
      });
      cursor = reply.cursor;
      const keys = reply.keys;

      logWithContext(
        "debug",
        `Scanning Redis keys for active call (cursor: ${cursor}, found ${keys.length} keys)`,
        null,
        { userId }
      );

      for (const key of keys) {
        const callDataString = await redisClient.get(key);
        if (callDataString) {
          try {
            const callData = JSON.parse(callDataString);
            if (
              (callData.caller.id === userId ||
                callData.callee.id === userId) &&
              (callData.status === "ringing" || callData.status === "active")
            ) {
              logWithContext(
                "debug",
                `Found active/ringing call ${callData.callId} involving user ${userId}`,
                null
              );
              activeCallData = callData;
              cursor = 0;
              break;
            }
          } catch (parseError) {
            errorWithContext(
              `Failed to parse call data from Redis key: ${key}`,
              parseError,
              null
            );
          }
        }
      }
    } while (cursor !== 0);
  } catch (redisError) {
    errorWithContext(
      `Error scanning/getting active call for user ${userId} in Redis`,
      redisError,
      null
    );
    return null;
  }

  if (activeCallData) {
    if (activeCallData.caller.id === userId) {
      if (activeCallData.callee) delete activeCallData.callee.token;
    } else if (activeCallData.callee.id === userId) {
      if (activeCallData.caller) delete activeCallData.caller.token;
    }
  }

  return activeCallData;
};

module.exports = {
  initiateCall,
  answerCall,
  endCall,
  getActiveCall,
};
