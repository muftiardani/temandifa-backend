const crypto = require("crypto");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { redisClient } = require("../../../config/redis");
const config = require("../../../config/appConfig");
const User = require("../models/User");
const { logWithContext, errorWithContext } = require("../../../config/logger");
const notificationService = require("./notificationService");
const appEmitter = require("../../../events/appEmitter");

const getUserCallKey = (userId) => `user:${userId}:activeCall`;
const getCallDataKey = (callId) => `call:${callId}`;

const generateAgoraUid = () => {
  return Math.floor(Math.random() * (2 ** 31 - 1)) + 1;
};

const generateAgoraToken = (channelName, uid, req) => {
  if (!config.agora.appId || !config.agora.appCertificate) {
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
  const expirationTimeInSeconds = config.agora.tokenExpirationSeconds;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(
      config.agora.appId,
      config.agora.appCertificate,
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
  const calleeId = callee._id.toString();

  if (calleeId === callerId) {
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

  const callerExistingCallData = await getActiveCall(callerId, req);
  if (callerExistingCallData) {
    logWithContext(
      "warn",
      `Caller ${callerId} is already in an active call (${callerExistingCallData.callId})`,
      req
    );
    const error = new Error("Anda sudah berada dalam panggilan lain.");
    error.statusCode = 409;
    throw error;
  }
  const calleeExistingCallData = await getActiveCall(calleeId, req);
  if (calleeExistingCallData) {
    logWithContext(
      "warn",
      `Callee ${calleeId} is already in another call (${calleeExistingCallData.callId})`,
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
      id: calleeId,
      name: callee.name || callee.email,
      uid: calleeUid,
      token: calleeToken,
    },
    createdAt: new Date().toISOString(),
  };

  const callDataKey = getCallDataKey(callId);
  const callerCallKey = getUserCallKey(callerId);
  const calleeCallKey = getUserCallKey(calleeId);

  try {
    const multi = redisClient.multi();
    const ringingTtl = config.call.ringingTtlSeconds;
    multi.set(callDataKey, JSON.stringify(callData), { EX: ringingTtl });
    multi.set(callerCallKey, callId, { EX: ringingTtl });
    multi.set(calleeCallKey, callId, { EX: ringingTtl });
    await multi.exec();

    logWithContext(
      "info",
      `Call state 'ringing' and user active call keys saved to Redis. Call ID: ${callId}`,
      req
    );
  } catch (redisError) {
    errorWithContext(
      "Failed to save initial call state to Redis",
      redisError,
      req
    );
    await redisClient
      .del([callDataKey, callerCallKey, calleeCallKey])
      .catch((e) => {
        errorWithContext(
          "Error cleaning up partial Redis state after initiateCall failure",
          e,
          req
        );
      });
    throw new Error("Gagal memulai panggilan.");
  }

  if (callee.pushToken) {
    logWithContext(
      "info",
      `Sending push notification to callee ${calleeId}`,
      req
    );
    const notificationData = {
      type: "INCOMING_CALL",
      callId: callId,
      channelName: channelName,
      callerName: callData.caller.name,
    };
    notificationService
      .sendCallNotification(
        callee.pushToken,
        {
          title: `Panggilan Masuk`,
          body: `${callData.caller.name} menelepon Anda`,
          data: notificationData,
        },
        req
      )
      .catch((notifError) => {
        errorWithContext("Failed to send push notification", notifError, req, {
          calleeId: calleeId,
        });
      });
  } else {
    logWithContext(
      "warn",
      `Callee ${calleeId} does not have a push token, skipping notification`,
      req
    );
  }

  return {
    callId: callData.callId,
    channelName: callData.channelName,
    token: callData.caller.token,
    uid: callData.caller.uid,
    calleeInfo: { name: callData.callee.name, id: callData.callee.id },
  };
};

const answerCall = async (callId, userId, req) => {
  logWithContext(
    "info",
    `Answering call request for call ID: ${callId} by user ${userId}`,
    req
  );

  const callDataKey = getCallDataKey(callId);
  let callDataString;
  try {
    callDataString = await redisClient.get(callDataKey);
  } catch (redisError) {
    errorWithContext("Failed to get call state from Redis", redisError, req, {
      callId,
    });
    throw new Error("Gagal mengambil status panggilan.");
  }

  if (!callDataString) {
    logWithContext(
      "warn",
      `Call ID ${callId} not found or expired when answering`,
      req
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
      req
    );
    const error = new Error("Tidak diizinkan untuk menjawab panggilan ini.");
    error.statusCode = 403;
    throw error;
  }
  if (callData.status !== "ringing") {
    logWithContext(
      "warn",
      `Attempted to answer call ${callId} which is not 'ringing' (current: ${callData.status})`,
      req
    );
    const error = new Error(
      `Tidak dapat menjawab panggilan karena statusnya ${callData.status}.`
    );
    error.statusCode = 409;
    throw error;
  }

  callData.status = "active";
  callData.answeredAt = new Date().toISOString();
  const callerCallKey = getUserCallKey(callData.caller.id);
  const calleeCallKey = getUserCallKey(callData.callee.id);

  try {
    const multi = redisClient.multi();
    const activeTtl = config.call.activeTtlSeconds;
    multi.set(callDataKey, JSON.stringify(callData), { EX: activeTtl });
    multi.expire(callerCallKey, activeTtl);
    multi.expire(calleeCallKey, activeTtl);
    await multi.exec();

    logWithContext(
      "info",
      `Call state updated to 'active' and user keys TTL extended in Redis. Call ID: ${callId}`,
      req
    );
  } catch (redisError) {
    errorWithContext(
      "Failed to update call state to active in Redis",
      redisError,
      req,
      { callId }
    );
    throw new Error("Gagal memperbarui status panggilan.");
  }

  logWithContext(
    "info",
    `Emitting internal 'call:answered' event for call ${callId}`,
    req
  );
  appEmitter.emit("call:answered", {
    callId,
    callerId: callData.caller.id,
    callee: { id: callData.callee.id, name: callData.callee.name },
  });

  return {
    callId: callData.callId,
    channelName: callData.channelName,
    token: callData.callee.token,
    uid: callData.callee.uid,
    callerInfo: { id: callData.caller.id, name: callData.caller.name },
  };
};

const endCall = async (callId, userId, req) => {
  logWithContext(
    "info",
    `Ending/declining/cancelling call request for call ID: ${callId} by user ${userId}`,
    req
  );

  const callDataKey = getCallDataKey(callId);
  let callDataString;
  try {
    callDataString = await redisClient.get(callDataKey);
  } catch (redisError) {
    errorWithContext(
      "Failed to get call state from Redis during endCall",
      redisError,
      req,
      { callId }
    );
    logWithContext(
      "warn",
      `Could not fetch call data for ${callId} during endCall, assuming already ended`,
      req
    );
    return {
      message: "Panggilan tidak ditemukan atau sudah berakhir.",
    };
  }

  if (!callDataString) {
    logWithContext(
      "warn",
      `Call ID ${callId} not found or already ended when attempting to end`,
      req
    );
    return { message: "Panggilan tidak ditemukan atau sudah berakhir." };
  }

  const callData = JSON.parse(callDataString);
  const callerCallKey = getUserCallKey(callData.caller.id);
  const calleeCallKey = getUserCallKey(callData.callee.id);

  const isCaller = callData.caller.id === userId;
  const isCallee = callData.callee.id === userId;
  if (!isCaller && !isCallee) {
    logWithContext(
      "error",
      `User ${userId} attempted to end call ${callId} they are not part of`,
      req
    );
    const error = new Error("Tidak diizinkan untuk mengakhiri panggilan ini.");
    error.statusCode = 403;
    throw error;
  }

  try {
    const deletedCount = await redisClient.del([
      callDataKey,
      callerCallKey,
      calleeCallKey,
    ]);
    if (deletedCount > 0) {
      logWithContext(
        "info",
        `Call state and user keys deleted from Redis. Call ID: ${callId}`,
        req,
        { deletedCount }
      );
    } else {
      logWithContext(
        "warn",
        `Attempted to delete call state/keys from Redis for ${callId}, but key(s) did not exist`,
        req
      );
    }
  } catch (redisError) {
    errorWithContext(
      "Failed to delete call state/keys from Redis",
      redisError,
      req,
      { callId }
    );
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
    action = "already_ended";
    socketEvent = null;
    logWithContext(
      "info",
      `Call ${callId} was already in state '${callData.status}' when endCall was processed`,
      req
    );
  }

  if (peerId && socketEvent) {
    logWithContext(
      "info",
      `Emitting internal 'call:event' (${socketEvent}) for call ${callId} to peer ${peerId}`,
      req
    );
    appEmitter.emit("call:event", {
      eventName: socketEvent,
      peerId: peerId,
      callId: callId,
      endedBy: userId,
    });
  }

  logWithContext(
    "info",
    `Call ${callId} successfully processed for ending (action: ${action}) by user ${userId}`,
    req
  );
  const message =
    action === "already_ended"
      ? "Panggilan sudah berakhir sebelumnya."
      : `Panggilan berhasil di${
          action === "cancelled"
            ? "batalkan"
            : action === "declined"
            ? "tolak"
            : "akhiri"
        }.`;
  return { message: message };
};

const getActiveCall = async (userId, req) => {
  const userCallKey = getUserCallKey(userId);
  let activeCallId = null;
  let activeCallData = null;

  logWithContext(
    "debug",
    `Checking active call for user ${userId} using key ${userCallKey}`,
    req
  );

  try {
    activeCallId = await redisClient.get(userCallKey);

    if (activeCallId) {
      logWithContext(
        "debug",
        `Found potential active call ID ${activeCallId} for user ${userId}`,
        req
      );
      const callDataKey = getCallDataKey(activeCallId);
      const callDataString = await redisClient.get(callDataKey);

      if (callDataString) {
        try {
          const callData = JSON.parse(callDataString);
          if (
            (callData.caller.id === userId || callData.callee.id === userId) &&
            (callData.status === "ringing" || callData.status === "active")
          ) {
            activeCallData = callData;
            logWithContext(
              "info",
              `Confirmed active call ${activeCallId} for user ${userId}`,
              req
            );

            if (activeCallData.caller.id === userId) {
              if (activeCallData.callee) delete activeCallData.callee.token;
            } else if (activeCallData.callee.id === userId) {
              if (activeCallData.caller) delete activeCallData.caller.token;
            }
          } else {
            logWithContext(
              "warn",
              `User key ${userCallKey} pointed to call ${activeCallId}, but user ${userId} is not part of it or status is invalid (${callData.status}). Cleaning up user key.`,
              req
            );
            await redisClient
              .del(userCallKey)
              .catch((e) =>
                errorWithContext(
                  "Failed to cleanup invalid user call key",
                  e,
                  req
                )
              );
          }
        } catch (parseError) {
          errorWithContext(
            `Failed to parse call data from Redis key: ${callDataKey}`,
            parseError,
            req
          );
          await redisClient
            .del(userCallKey)
            .catch((e) =>
              errorWithContext(
                "Failed to cleanup user call key pointing to corrupt data",
                e,
                req
              )
            );
        }
      } else {
        logWithContext(
          "warn",
          `User key ${userCallKey} pointed to non-existent call ${activeCallId}. Cleaning up user key.`,
          req
        );
        await redisClient
          .del(userCallKey)
          .catch((e) =>
            errorWithContext("Failed to cleanup stale user call key", e, req)
          );
      }
    } else {
      logWithContext(
        "debug",
        `No active call key found for user ${userId}`,
        req
      );
    }
  } catch (redisError) {
    errorWithContext(
      `Error getting active call for user ${userId} from Redis`,
      redisError,
      req
    );
    return null;
  }

  return activeCallData;
};

module.exports = {
  initiateCall,
  answerCall,
  endCall,
  getActiveCall,
};
