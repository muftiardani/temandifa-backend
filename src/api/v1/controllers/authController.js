const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Token = require("../models/Token");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../../../services/emailService");

const generateTokens = async (user) => {
  try {
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      }
    );

    await Token.findOneAndDelete({ userId: user._id });

    await new Token({
      userId: user._id,
      token: refreshToken,
    }).save();

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new Error("Gagal menghasilkan token");
  }
};

exports.register = async (req, res, next) => {
  const { username, email, password, phoneNumber } = req.body;

  try {
    const user = await User.create({
      username,
      email,
      password,
      phoneNumber,
    });

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res
      .status(400)
      .json({ message: "Harap berikan email/username dan password" });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: login }, { username: login }, { phoneNumber: login }],
    }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Kredensial tidak valid" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Kredensial tidak valid" });
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

exports.googleCallback = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Autentikasi Google gagal" });
    }
    const { accessToken, refreshToken } = await generateTokens(req.user);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token dibutuhkan" });
  }

  try {
    const storedToken = await Token.findOne({ token: refreshToken });
    if (!storedToken) {
      return res
        .status(403)
        .json({ message: "Refresh token tidak valid atau telah kedaluwarsa" });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          message: "Refresh token tidak valid atau telah kedaluwarsa",
        });
      }

      const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });

      res.json({
        success: true,
        accessToken,
      });
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token dibutuhkan" });
  }

  try {
    const result = await Token.deleteOne({ token: refreshToken });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Token tidak ditemukan" });
    }
    res.status(200).json({ success: true, message: "Logout berhasil" });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "Email untuk reset password telah dikirim",
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        resetUrl,
      });
      res.status(200).json({
        success: true,
        message: "Email untuk reset password telah dikirim",
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ message: "Gagal mengirim email" });
    }
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.resetToken)
    .digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token reset tidak valid atau telah kedaluwarsa" });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(201).json({
      success: true,
      message: "Password berhasil direset",
    });
  } catch (error) {
    next(error);
  }
};
