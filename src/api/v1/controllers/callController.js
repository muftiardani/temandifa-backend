const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const { sendCallNotification } = require("../../services/notificationService");
const redisClient = require("../../../config/redis");
const { getSocketServerInstance } = require("../../../socket/socketHandler");

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const CALL_EXPIRATION_SECONDS = 3600;

const setCallData = async (callId, data) => {
  await redisClient.set(callId, JSON.stringify(data), {
    EX: CALL_EXPIRATION_SECONDS,
  });
};

const getCallData = async (callId) => {
  const data = await redisClient.get(callId);
  return data ? JSON.parse(data) : null;
};

const deleteCallData = async (callId) => {
  await redisClient.del(callId);
};

// @desc    Initiate a video call
// @route   POST /api/v1/call/initiate
// @access  Private
exports.initiateCall = async (req, res, next) => {
  try {
    const { calleePhoneNumber } = req.body;
    if (!calleePhoneNumber) {
      return res
        .status(400)
        .json({ message: "Nomor telepon tujuan diperlukan" });
    }

    const caller = await User.findById(req.user.id);
    const callee = await User.findOne({ phoneNumber: calleePhoneNumber });

    if (!callee) {
      return res
        .status(404)
        .json({ message: "Pengguna tujuan tidak ditemukan" });
    }

    if (!callee.pushToken) {
      return res.status(400).json({
        message: "Pengguna tujuan tidak dapat menerima panggilan saat ini",
      });
    }

    const callId = uuidv4();
    const channelName = `call_${callId}`;
    const callerUid = Math.floor(Math.random() * 100000);
    const calleeUid = Math.floor(Math.random() * 100000);

    const callerToken = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      callerUid,
      RtcRole.PUBLISHER,
      Math.floor(Date.now() / 1000) + CALL_EXPIRATION_SECONDS
    );
    const calleeToken = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      calleeUid,
      RtcRole.PUBLISHER,
      Math.floor(Date.now() / 1000) + CALL_EXPIRATION_SECONDS
    );

    const callData = {
      callId,
      channelName,
      caller: {
        id: caller._id,
        name: caller.username,
        uid: callerUid,
        token: callerToken,
      },
      callee: {
        id: callee._id,
        name: callee.username,
        uid: calleeUid,
        token: calleeToken,
      },
      status: "ringing",
    };

    await setCallData(callId, callData);

    await sendCallNotification(callee.pushToken, {
      title: "Panggilan Masuk",
      body: `Anda menerima panggilan dari ${caller.username}`,
      data: { callId, channelName, callerName: caller.username },
    });

    res
      .status(200)
      .json({ callId, channelName, token: callerToken, uid: callerUid });
  } catch (error) {
    next(error);
  }
};

// @desc    Answer an incoming call
// @route   POST /api/v1/call/:callId/answer
// @access  Private
exports.answerCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const callData = await getCallData(callId);

    if (!callData || callData.callee.id.toString() !== req.user.id.toString()) {
      return res
        .status(404)
        .json({ message: "Panggilan tidak ditemukan atau tidak valid" });
    }

    callData.status = "active";
    await setCallData(callId, callData);

    const io = getSocketServerInstance();
    io.to(callData.caller.id.toString()).emit("call-answered");

    res.status(200).json({
      channelName: callData.channelName,
      token: callData.callee.token,
      uid: callData.callee.uid,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    End, decline, or cancel a call
// @route   POST /api/v1/call/:callId/end
// @access  Private
exports.endCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const callData = await getCallData(callId);

    if (!callData) {
      return res.status(200).json({ message: "Panggilan sudah tidak aktif" });
    }

    const currentUserId = req.user.id.toString();
    const isCaller = callData.caller.id.toString() === currentUserId;
    const isCallee = callData.callee.id.toString() === currentUserId;

    if (!isCaller && !isCallee) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengakhiri panggilan ini" });
    }

    await deleteCallData(callId);

    const io = getSocketServerInstance();
    const otherUserId = isCaller
      ? callData.callee.id.toString()
      : callData.caller.id.toString();

    let eventType = "call-ended";
    if (callData.status === "ringing") {
      eventType = isCaller ? "call-cancelled" : "call-declined";
    }

    io.to(otherUserId).emit(eventType);

    res.status(200).json({ message: "Panggilan berhasil diakhiri" });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current call status for a user
// @route   GET /api/v1/call/status
// @access  Private
exports.getCallStatus = async (req, res, next) => {
  try {
    const keys = await redisClient.keys("call_*");
    const currentUserId = req.user.id.toString();

    for (const key of keys) {
      const callData = await getCallData(key);
      if (
        callData &&
        (callData.caller.id.toString() === currentUserId ||
          callData.callee.id.toString() === currentUserId)
      ) {
        return res.status(200).json({ activeCall: callData });
      }
    }

    res.status(200).json({ activeCall: null });
  } catch (error) {
    next(error);
  }
};
