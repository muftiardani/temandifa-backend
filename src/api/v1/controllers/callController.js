const asyncHandler = require("express-async-handler");
const callService = require("../services/callService");

/**
 * @desc    Initiate a new video call
 * @route   POST /api/v1/call/initiate
 * @access  Private
 */
exports.initiateCall = asyncHandler(async (req, res, next) => {
  const callerId = req.user.id;
  const { calleePhoneNumber } = req.body;
  const callData = await callService.initiateCall(callerId, calleePhoneNumber);
  res.status(200).json(callData);
});

/**
 * @desc    Answer an incoming call
 * @route   POST /api/v1/call/:callId/answer
 * @access  Private
 */
exports.answerCall = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;
  const userId = req.user.id;
  const callData = await callService.answerCall(callId, userId);
  res.status(200).json(callData);
});

/**
 * @desc    End or decline a call
 * @route   POST /api/v1/call/:callId/end
 * @access  Private
 */
exports.endCall = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;
  const userId = req.user.id;
  const result = await callService.endCall(callId, userId);
  res.status(200).json(result);
});

/**
 * @desc    Get the status of any active call for the user
 * @route   GET /api/v1/call/status
 * @access  Private
 */
exports.getCallStatus = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const activeCall = await callService.getActiveCall(userId);
  if (activeCall) {
    return res.status(200).json(activeCall);
  }
  return res.status(204).send();
});
