const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../../../services/emailService");
const logger = require("../../../config/logger");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, phoneNumber } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Username, email, dan password diperlukan." });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "Email atau username sudah terdaftar." });
    }

    const user = await User.create({
      username,
      email,
      password,
      phoneNumber,
    });

    res.status(201).json({ token: generateToken(user._id) });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res
        .status(400)
        .json({ message: "Silakan masukkan kredensial Anda." });
    }

    const user = await User.findOne({
      $or: [{ email: login }, { username: login }, { phoneNumber: login }],
    }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Kredensial tidak valid." });
    }

    res.status(200).json({ token: generateToken(user._id) });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Tidak ada pengguna dengan email tersebut." });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/resetpassword/${resetToken}`;
    const message = `Anda menerima email ini karena Anda (atau orang lain) meminta untuk mereset password. Silakan buat permintaan PUT ke:\n\n${resetUrl}`;

    await sendEmail({
      email: user.email,
      subject: "Reset Password Akun TemanDifa",
      message,
    });

    res.status(200).json({
      success: true,
      data: "Email instruksi reset password telah dikirim.",
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token reset tidak valid atau sudah kedaluwarsa." });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ token: generateToken(user._id) });
  } catch (error) {
    next(error);
  }
};

exports.googleCallback = (req, res) => {
  res.status(200).json({ token: generateToken(req.user.id) });
};
