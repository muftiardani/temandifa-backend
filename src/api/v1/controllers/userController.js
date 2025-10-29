const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const { logWithContext, errorWithContext } = require("../../../config/logger");

exports.updatePushToken = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { token: pushToken } = req.body;

  logWithContext("info", "Update push token request received", req);

  if (!pushToken || typeof pushToken !== "string") {
    res.status(400);
    throw new Error("Push token (string) tidak boleh kosong");
  }

  const user = await User.findById(userId);

  if (!user) {
    logWithContext("warn", `User not found during push token update`, req);
    res.status(404);
    throw new Error("Pengguna tidak ditemukan");
  }

  user.pushToken = pushToken;
  await user.save();

  logWithContext("info", `Push token updated successfully for user`, req);

  res.status(200).json({
    success: true,
    message: "Push token berhasil diperbarui",
  });
});
