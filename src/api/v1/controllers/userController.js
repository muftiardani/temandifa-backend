const asyncHandler = require("express-async-handler");
const userService = require("../services/userService");
const { logWithContext } = require("../../../config/logger");
const config = require("../../../config/appConfig");

/**
 * @desc    Memperbarui push token pengguna
 * @route   PUT /api/v1/users/pushtoken
 * @access  Protected
 */
exports.updatePushToken = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { token: pushToken } = req.body;

  logWithContext("info", "Update push token request received", req);

  const result = await userService.updatePushToken(userId, pushToken, req);

  res.status(200).json(result);
});
