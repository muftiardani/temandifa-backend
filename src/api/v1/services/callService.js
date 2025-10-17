const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const { redisClient } = require("../../../config/redis");
const { sendCallNotification } = require("../../../services/notificationService");
const logger = require("../../../config/logger");

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

/**
 * Logika untuk memulai panggilan video baru.
 */
const initiateCall = async (callerId, calleePhoneNumber) => {
  const callee = await User.findOne({ phoneNumber: calleePhoneNumber });
  if (!callee) {
    const error = new Error("Pengguna yang dituju tidak ditemukan.");
    error.status = 404;
    throw error;
  }

  const caller = await User.findById(callerId);

  const callId = uuidv4();
  const channelName = `call_${callId}`;
  const callerUid = Math.floor(Math.random() * 100000);
  const calleeUid = Math.floor(Math.random() * 100000);

  const expirationTimeInSeconds = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTime + expirationTimeInSeconds;

  const callerToken = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channelName,
    callerUid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs
  );

  const calleeToken = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channelName,
    calleeUid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs
  );

  const callData = {
    callId,
    channelName,
    caller: { id: caller._id, name: caller.name, uid: callerUid },
    callee: { id: callee._id, name: callee.name, uid: calleeUid },
    status: "ringing",
  };

  await redisClient.set(`call:${callId}`, JSON.stringify(callData), {
    EX: 60,
  });

  if (callee.pushToken) {
    await sendCallNotification(callee.pushToken, {
      title: "Panggilan Masuk",
      body: `Anda menerima panggilan dari ${caller.name}`,
      data: { callData: { ...callData, calleeToken } },
    });
  }

  logger.info(`Panggilan ${callId} dimulai dari ${callerId} ke ${callee._id}`);
  return { ...callData, callerToken };
};

/**
 * Logika untuk menjawab panggilan.
 */
const answerCall = async (callId, userId) => {
  const callDataString = await redisClient.get(`call:${callId}`);
  if (!callDataString) {
    const error = new Error("Panggilan tidak ditemukan atau telah berakhir.");
    error.status = 404;
    throw error;
  }

  const callData = JSON.parse(callDataString);

  if (callData.callee.id.toString() !== userId) {
    const error = new Error("Tidak diizinkan untuk menjawab panggilan ini.");
    error.status = 403;
    throw error;
  }

  callData.status = "active";
  await redisClient.set(`call:${callId}`, JSON.stringify(callData), {
    EX: 3600,
  });

  logger.info(`Panggilan ${callId} dijawab oleh ${userId}`);
  return callData;
};

/**
 * Logika untuk mengakhiri atau menolak panggilan.
 */
const endCall = async (callId, userId) => {
  const callDataString = await redisClient.get(`call:${callId}`);
  if (callDataString) {
    const callData = JSON.parse(callDataString);
    if (
      callData.caller.id.toString() !== userId &&
      callData.callee.id.toString() !== userId
    ) {
      const error = new Error(
        "Tidak diizinkan untuk mengakhiri panggilan ini."
      );
      error.status = 403;
      throw error;
    }
    await redisClient.del(`call:${callId}`);
    logger.info(`Panggilan ${callId} diakhiri oleh ${userId}`);
  }
  return { message: "Panggilan berhasil diakhiri." };
};

/**
 * Logika untuk mendapatkan status panggilan aktif.
 */
const getActiveCall = async (userId) => {
  const keys = await redisClient.keys("call:*");
  for (const key of keys) {
    const callDataString = await redisClient.get(key);
    if (callDataString) {
      const callData = JSON.parse(callDataString);
      if (
        callData.caller.id.toString() === userId ||
        callData.callee.id.toString() === userId
      ) {
        return callData;
      }
    }
  }
  return null;
};

module.exports = {
  initiateCall,
  answerCall,
  endCall,
  getActiveCall,
};
