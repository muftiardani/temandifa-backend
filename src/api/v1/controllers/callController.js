const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { v4: uuidv4 } = require("uuid");
const {
  sendPushNotification,
} = require("../../../services/notificationService");
const logger = require("../../../config/logger");
const User = require("../models/User");

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

const activeCalls = new Map();

exports.initiateCall = async (req, res, next) => {
  try {
    const { calleePhoneNumber } = req.body;
    const callerId = req.user.id;

    const callee = await User.findOne({ phoneNumber: calleePhoneNumber });
    if (!callee || !callee.pushToken) {
      return res.status(404).json({
        message:
          "Pengguna tujuan tidak ditemukan atau tidak dapat menerima panggilan.",
      });
    }

    const caller = await User.findById(callerId);
    if (!caller) {
      return res
        .status(404)
        .json({ message: "Data penelepon tidak ditemukan." });
    }

    const channelName = uuidv4();
    const uidCaller = Math.floor(Math.random() * 100000);
    const uidCallee = Math.floor(Math.random() * 100000);
    const expirationTimeInSeconds = 3600;

    const tokenCaller = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uidCaller,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds
    );
    const tokenCallee = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uidCallee,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds
    );

    const callId = uuidv4();
    activeCalls.set(callId, {
      channelName,
      callerId,
      calleeId: callee._id.toString(),
      tokens: {
        [callerId]: { token: tokenCaller, uid: uidCaller },
        [callee._id.toString()]: { token: tokenCallee, uid: uidCallee },
      },
    });

    await sendPushNotification(
      callee.pushToken,
      "Panggilan Masuk",
      `${caller.phoneNumber} sedang memanggil...`,
      {
        callId,
        channelName,
        callerName: caller.phoneNumber,
      }
    );

    res.status(200).json({
      callId,
      channelName,
      token: tokenCaller,
      uid: uidCaller,
    });
  } catch (error) {
    next(error);
  }
};

exports.answerCall = async (req, res, next) => {
  try {
    const { callId } = req.body;
    const calleeId = req.user.id;

    const call = activeCalls.get(callId);
    if (!call || call.calleeId !== calleeId) {
      return res
        .status(404)
        .json({ message: "Panggilan tidak ditemukan atau sudah berakhir." });
    }

    const calleeCredentials = call.tokens[calleeId];

    res.status(200).json({
      channelName: call.channelName,
      token: calleeCredentials.token,
      uid: calleeCredentials.uid,
    });
  } catch (error) {
    next(error);
  }
};

exports.endCall = async (req, res, next) => {
  try {
    const { callId } = req.body;
    if (activeCalls.has(callId)) {
      activeCalls.delete(callId);
      logger.info(`Panggilan ${callId} telah diakhiri.`);
    }
    res.status(200).json({ message: "Panggilan diakhiri." });
  } catch (error) {
    next(error);
  }
};
