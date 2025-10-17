const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");
const sendEmail = require("../../../services/emailService");
const logger = require("../../../config/logger");
const authService = require("../services/authService");

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { email, password, username } = req.body;
  const user = await authService.registerUser(email, password, username);
  const { accessToken, refreshToken } = await authService.createSession(
    user,
    req
  );
  res.status(201).json({ accessToken, refreshToken });
});

/**
 * @desc    Auth user & get token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { login, password } = req.body;
  const user = await authService.loginUser(login, password);
  const { accessToken, refreshToken } = await authService.createSession(
    user,
    req
  );
  res.json({ accessToken, refreshToken });
});

/**
 * @desc    Google OAuth for mobile
 * @route   POST /api/v1/auth/google/mobile
 * @access  Public
 */
exports.loginWithGoogle = asyncHandler(async (req, res, next) => {
  const { accessToken: googleToken } = req.body;
  const user = await authService.loginOrRegisterWithGoogle(googleToken);
  const { accessToken, refreshToken } = await authService.createSession(
    user,
    req,
    "Google Auth"
  );
  res.json({ accessToken, refreshToken });
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  let user;
  try {
    user = await User.findOne({ email: req.body.email });
    if (!user) {
      logger.warn(
        `Permintaan reset password untuk email tidak terdaftar: ${req.body.email}`
      );
      return res.status(200).json({
        message: "Jika email terdaftar, instruksi reset akan dikirim.",
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #3F7EF3;">Permintaan Atur Ulang Kata Sandi</h2>
          <p>Halo,</p>
          <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun TemanDifa Anda. Anda dapat membuat kata sandi baru dengan mengklik tombol di bawah ini.</p>
          <p style="margin: 30px 0; text-align: center;">
            <a href="${resetUrl}" style="background-color: #3F7EF3; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Atur Ulang Kata Sandi</a>
          </p>
          <p>Tautan ini akan kedaluwarsa dalam <strong>10 menit</strong>.</p>
          <p>Jika Anda tidak merasa meminta perubahan ini, Anda bisa mengabaikan email ini dengan aman.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: "Atur Ulang Kata Sandi Akun TemanDifa Anda",
      html: emailHtml,
      text: `Untuk mereset kata sandi Anda, silakan kunjungi URL berikut: ${resetUrl}`,
    });

    res
      .status(200)
      .json({ message: "Email untuk reset kata sandi telah dikirim" });
  } catch (error) {
    logger.error("Gagal mengirim email reset password:", error);
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
    next(error);
  }
});

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/resetpassword/:token
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

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

  await Session.deleteMany({ user: user._id });

  res.status(200).json({ message: "Password berhasil direset" });
});

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
exports.refreshTokens = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token diperlukan" });
  }

  const session = await Session.findOne({ refreshToken });
  const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

  if (!session || !decoded) {
    await Session.deleteOne({ refreshToken });
    return res
      .status(403)
      .json({ message: "Refresh token tidak valid atau sesi telah berakhir" });
  }

  session.lastActiveAt = Date.now();
  await session.save();

  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(404).json({ message: "Pengguna tidak ditemukan" });
  }

  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  res.json({ accessToken });
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
exports.logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  await Session.deleteOne({ refreshToken });
  res.status(200).json({ message: "Logout berhasil" });
});

/**
 * @desc    Get all active user sessions
 * @route   GET /api/v1/auth/sessions
 * @access  Private
 */
exports.getSessions = asyncHandler(async (req, res, next) => {
  const sessions = await Session.find({ user: req.user.id }).sort({
    lastActiveAt: -1,
  });
  const currentToken = req.body?.refreshToken;

  const sanitizedSessions = sessions.map((session) => ({
    id: session._id,
    userAgent: session.userAgent,
    ip: session.ip,
    lastActiveAt: session.lastActiveAt,
    createdAt: session.createdAt,
    isCurrent: session.refreshToken === currentToken,
  }));
  res.json(sanitizedSessions);
});

/**
 * @desc    Revoke a specific session
 * @route   DELETE /api/v1/auth/sessions/:id
 * @access  Private
 */
exports.revokeSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const session = await Session.findById(id);

  if (!session) {
    return res.status(404).json({ message: "Sesi tidak ditemukan" });
  }

  if (session.user.toString() !== req.user.id) {
    return res
      .status(403)
      .json({ message: "Tidak diizinkan untuk menghapus sesi ini" });
  }

  await session.deleteOne();
  res.status(200).json({ message: "Sesi berhasil dihapus" });
});
