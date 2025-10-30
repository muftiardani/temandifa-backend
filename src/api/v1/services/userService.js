const User = require("../models/User");
const { logWithContext, errorWithContext } = require("../../../config/logger");

/**
 * Memperbarui Expo Push Token untuk user.
 * @param {string} userId - ID user.
 * @param {string} pushToken - Token baru.
 * @param {object} req - Objek request Express (untuk logging kontekstual).
 */
const updatePushToken = async (userId, pushToken, req) => {
  if (!pushToken || typeof pushToken !== "string") {
    const err = new Error("Push token (string) tidak boleh kosong");
    err.statusCode = 400;
    throw err;
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      logWithContext("warn", `User not found during push token update`, req);
      const err = new Error("Pengguna tidak ditemukan");
      err.statusCode = 404;
      throw err;
    }

    user.pushToken = pushToken;
    await user.save();

    logWithContext("info", `Push token updated successfully for user`, req);
    return { success: true, message: "Push token berhasil diperbarui" };
  } catch (error) {
    errorWithContext("Error updating push token", error, req, { userId });
    throw error;
  }
};

module.exports = {
  updatePushToken,
};
