const User = require("../models/User");

exports.updatePushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Push token tidak boleh kosong" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Pengguna tidak ditemukan" });
    }

    user.pushToken = token;
    await user.save();

    res
      .status(200)
      .json({ success: true, data: "Push token berhasil diperbarui" });
  } catch (error) {
    next(error);
  }
};
