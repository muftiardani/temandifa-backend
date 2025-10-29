const asyncHandler = require("express-async-handler");
const callService = require("../services/callService");
const { logWithContext, errorWithContext } = require("../../../config/logger");

exports.initiateCall = asyncHandler(async (req, res, next) => {
  const callerId = req.user.id;
  const { calleePhoneNumber } = req.body;

  logWithContext(
    "info",
    `Initiating call request from user ${callerId} to ${calleePhoneNumber}`,
    req
  );

  if (!calleePhoneNumber) {
    res.status(400);
    throw new Error("Nomor telepon penerima (calleePhoneNumber) wajib diisi");
  }

  const callData = await callService.initiateCall(
    callerId,
    calleePhoneNumber,
    req
  );

  logWithContext(
    "info",
    `Call initiated successfully. Call ID: ${callData.callId}`,
    req
  );
  res.status(200).json(callData);
});

exports.answerCall = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;
  const userId = req.user.id;

  logWithContext("info", `Answering call request for call ID: ${callId}`, req);

  if (!callId) {
    res.status(400);
    throw new Error("Call ID wajib diisi di parameter URL");
  }

  const callData = await callService.answerCall(callId, userId);

  logWithContext("info", `Call answered successfully. Call ID: ${callId}`, req);
  res.status(200).json(callData);
});

exports.endCall = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;
  const userId = req.user.id;

  logWithContext("info", `Ending call request for call ID: ${callId}`, req);

  if (!callId) {
    res.status(400);
    throw new Error("Call ID wajib diisi di parameter URL");
  }

  const result = await callService.endCall(callId, userId);

  logWithContext("info", `Call ended successfully. Call ID: ${callId}`, req);
  res.status(200).json(result);
});

exports.getCallStatus = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  logWithContext("debug", `Fetching call status for user`, req);

  const activeCall = await callService.getActiveCall(userId);

  if (activeCall) {
    logWithContext(
      "debug",
      `Active call found for user. Call ID: ${activeCall.callId}`,
      req
    );
    return res.status(200).json({ activeCall: activeCall });
  }

  logWithContext("debug", `No active call found for user`, req);
  return res.status(200).json({ activeCall: null });
});
