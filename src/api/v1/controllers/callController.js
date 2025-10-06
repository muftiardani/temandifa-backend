const { RtcTokenBuilder, RtcRole } = require("agora-token");
const { v4: uuidv4 } = require("uuid");
const {
  sendPushNotification,
} = require("../../../services/notificationService");

const usersDB = [
  {
    id: "user-1",
    name: "User A",
    phoneNumber: "111",
    expoPushToken: "ExponentPushToken[qC_87IHW5F_NY--1ncBlz0]",
  },
  {
    id: "user-2",
    name: "User B",
    phoneNumber: "222",
    expoPushToken: "ExponentPushToken[jSaTDALV4Kt-LnX39Twxp5]",
  },
];
const findUserByPhoneNumber = (phoneNumber) =>
  usersDB.find((user) => user.phoneNumber === phoneNumber);
const getAuthenticatedUser = (req) => usersDB[0];

const activeCalls = new Map();
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const TOKEN_EXPIRATION_TIME_IN_SECONDS = 3600;

const initiateCall = async (req, res, next) => {
  try {
    const { calleePhoneNumber } = req.body;
    const caller = getAuthenticatedUser(req);

    if (!calleePhoneNumber) {
      return res
        .status(400)
        .json({ message: "Nomor telepon tujuan diperlukan." });
    }
    if (!APP_ID || !APP_CERTIFICATE) {
      throw new Error("Konfigurasi Agora tidak lengkap di server.");
    }

    const callee = findUserByPhoneNumber(calleePhoneNumber);
    if (!callee || !callee.expoPushToken) {
      return res.status(404).json({
        message: "Pengguna tidak ditemukan atau tidak dapat dihubungi.",
      });
    }

    const channelName = uuidv4();
    const callerUid = 1;
    const calleeUid = 2;

    const callerToken = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      callerUid,
      RtcRole.PUBLISHER,
      TOKEN_EXPIRATION_TIME_IN_SECONDS
    );
    const calleeToken = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      calleeUid,
      RtcRole.PUBLISHER,
      TOKEN_EXPIRATION_TIME_IN_SECONDS
    );

    const callId = uuidv4();
    activeCalls.set(callId, {
      channelName,
      caller,
      callee,
      calleeToken,
      calleeUid,
    });

    await sendPushNotification(
      [callee.expoPushToken],
      "Panggilan Video Masuk",
      `Panggilan dari ${caller.name}`,
      { callId, channelName, callerName: caller.name }
    );

    res
      .status(200)
      .json({ callId, channelName, token: callerToken, uid: callerUid });
  } catch (error) {
    next(error);
  }
};

const answerCall = async (req, res, next) => {
  try {
    const { callId } = req.body;
    const callDetails = activeCalls.get(callId);
    if (!callDetails) {
      return res
        .status(404)
        .json({ message: "Sesi panggilan tidak valid atau sudah berakhir." });
    }
    res.status(200).json({
      channelName: callDetails.channelName,
      token: callDetails.calleeToken,
      uid: callDetails.calleeUid,
    });
  } catch (error) {
    next(error);
  }
};

const endCall = async (req, res, next) => {
  try {
    const { callId } = req.body;
    if (activeCalls.has(callId)) {
      activeCalls.delete(callId);
    }
    res.status(200).json({ message: "Panggilan diakhiri." });
  } catch (error) {
    next(error);
  }
};

module.exports = { initiateCall, answerCall, endCall };
