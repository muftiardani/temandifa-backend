const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const ms = require("ms");
const User = require("../models/User");
const Session = require("../models/Session");
const { logWithContext, errorWithContext } = require("../../../config/logger");
const sendEmail = require("./emailService");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateTokens = (user) => {
  if (!user || !user._id) {
    throw new Error("User object with _id is required to generate tokens.");
  }
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d" }
  );

  return { accessToken, refreshToken };
};

const createSession = async (user, req, method = "Credentials") => {
  const { accessToken, refreshToken } = generateTokens(user);

  const refreshTokenExpiresInString = process.env.JWT_REFRESH_EXPIRE || "7d";
  let expiresAt;
  try {
    expiresAt = new Date(Date.now() + ms(refreshTokenExpiresInString));
  } catch (e) {
    errorWithContext("Invalid JWT_REFRESH_EXPIRE format in .env", e, req);
    expiresAt = new Date(Date.now() + ms("7d"));
  }

  const ip = req
    ? req.headers["x-forwarded-for"] || req.ip || req.connection?.remoteAddress
    : "unknown";
  const userAgent = req ? req.headers["user-agent"] || "Unknown" : "Unknown";

  try {
    await Session.create({
      user: user._id,
      refreshToken,
      userAgent: `${method} - ${userAgent}`.substring(0, 200),
      ip,
      expiresAt,
      lastActiveAt: Date.now(),
    });
    logWithContext("info", `New session created for user ${user._id}`, req, {
      method,
      ip,
    });
  } catch (dbError) {
    errorWithContext("Failed to save session to database", dbError, req);
  }

  return { accessToken, refreshToken };
};

exports.registerUser = async ({ email, password, username }) => {
  if (!email || !password) {
    const error = new Error("Email dan password wajib diisi");
    error.statusCode = 400;
    throw error;
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    const error = new Error("Email sudah terdaftar");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.create({
    email: email.toLowerCase(),
    password,
  });

  if (!user) {
    const error = new Error("Gagal mendaftarkan user, data tidak valid");
    error.statusCode = 400;
    throw error;
  }

  const { accessToken, refreshToken } = await createSession(
    user,
    null,
    "Registration"
  );

  return { user, accessToken, refreshToken };
};

exports.loginUser = async (loginInput, password, req) => {
  if (!loginInput || !password) {
    const error = new Error("Email/username dan password wajib diisi");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({
    email: loginInput.toLowerCase(),
  }).select("+password");

  if (!user || !user.password || !(await user.matchPassword(password))) {
    logWithContext("warn", "Login failed: Invalid credentials provided", req, {
      login: loginInput,
    });
    const error = new Error("Email atau password salah");
    error.statusCode = 401;
    throw error;
  }

  const { accessToken, refreshToken } = await createSession(
    user,
    req,
    "Credentials"
  );

  return { user, accessToken, refreshToken };
};

exports.loginOrRegisterWithGoogle = async (googleAccessToken, req) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: googleAccessToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
      ].filter(Boolean),
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.sub) {
      logWithContext(
        "warn",
        "Google ID token verification failed or missing email/sub",
        req
      );
      const error = new Error("Verifikasi token Google gagal");
      error.statusCode = 401;
      throw error;
    }

    const { email, sub: googleId, name } = payload;
    logWithContext("debug", "Google ID token verified successfully", req, {
      email,
    });

    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    if (!user) {
      logWithContext("info", "Google user not found, creating new user", req, {
        email,
      });
      user = await User.create({
        email: email.toLowerCase(),
        googleId,
      });
      if (!user) {
        throw new Error("Gagal membuat user baru dari akun Google");
      }
    } else if (!user.googleId) {
      logWithContext(
        "info",
        `Linking existing user ${user.id} with Google ID`,
        req
      );
      user.googleId = googleId;
      await user.save();
    }

    const { accessToken, refreshToken } = await createSession(
      user,
      req,
      "Google Auth"
    );
    return { user, accessToken, refreshToken };
  } catch (error) {
    errorWithContext("Error during Google authentication", error, req);
    if (
      error.message.includes("Token used too late") ||
      error.message.includes("Invalid token signature") ||
      error.message.includes("Invalid ID token")
    ) {
      const authError = new Error("Token Google tidak valid atau kedaluwarsa.");
      authError.statusCode = 401;
      throw authError;
    }
    const err = new Error(`Autentikasi Google gagal: ${error.message}`);
    err.statusCode = error.statusCode || 500;
    throw err;
  }
};

exports.refreshAccessToken = async (refreshTokenInput) => {
  const session = await Session.findOne({ refreshToken: refreshTokenInput });

  let decoded;
  try {
    decoded = jwt.verify(refreshTokenInput, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    logWithContext(
      "warn",
      "Invalid refresh token signature or format used",
      null,
      { error: err.message }
    );
    if (session) {
      await session.deleteOne();
      logWithContext(
        "info",
        `Deleted session due to invalid refresh token signature: ${session._id}`,
        null
      );
    }
    const error = new Error("Refresh token tidak valid");
    error.statusCode = 403;
    throw error;
  }

  if (!session) {
    logWithContext(
      "warn",
      `Refresh token used but session not found for user ${decoded?.id}`,
      null
    );
    const error = new Error(
      "Sesi tidak valid atau sudah logout, harap login kembali"
    );
    error.statusCode = 403;
    throw error;
  }

  if (session.expiresAt < new Date()) {
    await session.deleteOne();
    logWithContext(
      "warn",
      `Expired refresh token used for user ${decoded?.id}. Session deleted: ${session._id}`,
      null
    );
    const error = new Error("Sesi telah kedaluwarsa, harap login kembali");
    error.statusCode = 403;
    throw error;
  }

  if (session.user.toString() !== decoded.id) {
    logWithContext(
      "error",
      `Refresh token user ID mismatch! Token User: ${decoded.id}, Session User: ${session.user}. Session: ${session._id}`,
      null
    );
    await session.deleteOne();
    const error = new Error("Refresh token tidak cocok dengan sesi");
    error.statusCode = 403;
    throw error;
  }

  Session.updateOne(
    { _id: session._id },
    { $set: { lastActiveAt: Date.now() } }
  )
    .exec()
    .catch((err) => {
      errorWithContext("Failed to update session lastActiveAt", err, null, {
        sessionId: session._id,
      });
    });

  const user = await User.findById(decoded.id).select("email").lean();
  if (!user) {
    logWithContext(
      "error",
      `User ${decoded.id} not found during token refresh despite valid token. Deleting session ${session._id}`,
      null
    );
    await session.deleteOne();
    const error = new Error("Pengguna terkait token tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }
  const { accessToken } = generateTokens({ _id: user._id, email: user.email });

  logWithContext("info", `Access token refreshed for user ${decoded.id}`, null);
  return { accessToken };
};

exports.logoutUser = async (refreshTokenInput) => {
  if (!refreshTokenInput) return;
  try {
    const result = await Session.deleteOne({ refreshToken: refreshTokenInput });
    if (result.deletedCount > 0) {
      logWithContext("info", "Session deleted successfully on logout", null);
    } else {
      logWithContext(
        "warn",
        "Logout attempt with non-existent or already invalidated refresh token",
        null
      );
    }
  } catch (error) {
    errorWithContext("Error during session deletion on logout", error, null);
  }
};

exports.forgotPassword = async (email) => {
  if (!email) {
    throw new Error("Email is required for forgot password.");
  }
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    logWithContext(
      "warn",
      `Forgot password attempt for non-existent email: ${email}`,
      null
    );
    return "Jika email terdaftar, instruksi reset password akan dikirim.";
  }

  try {
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:8081"
    }/reset-password/${resetToken}`;

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
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 0.9em; color: #aaa;">Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        `;

    await sendEmail({
      to: user.email,
      subject: "Atur Ulang Kata Sandi Akun TemanDifa Anda",
      html: emailHtml,
      text: `Untuk mereset kata sandi Anda, silakan kunjungi URL berikut (valid 10 menit): ${resetUrl}`,
    });

    logWithContext(
      "info",
      `Password reset email sent successfully to ${email}`,
      null
    );
    return "Email untuk reset kata sandi telah dikirim";
  } catch (error) {
    errorWithContext("Failed to send password reset email", error, null, {
      email,
    });
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false }).catch((saveErr) => {
      errorWithContext(
        "Failed to clear reset token after email failure",
        saveErr,
        null,
        { userId: user.id }
      );
    });
    throw new Error(
      "Gagal mengirim email reset password. Silakan coba lagi nanti."
    );
  }
};

exports.resetPassword = async (token, password) => {
  if (!token || !password) {
    const error = new Error("Token dan password baru wajib diisi.");
    error.statusCode = 400;
    throw error;
  }
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    logWithContext(
      "warn",
      "Invalid or expired password reset token used",
      null
    );
    const error = new Error("Token reset tidak valid atau telah kedaluwarsa");
    error.statusCode = 400;
    throw error;
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  try {
    await user.save();
  } catch (saveError) {
    errorWithContext("Failed to save new password", saveError, null, {
      userId: user.id,
    });
    const validationError = new Error(
      `Gagal menyimpan password baru: ${saveError.message}`
    );
    validationError.statusCode = 400;
    throw validationError;
  }

  try {
    const deletedSessions = await Session.deleteMany({ user: user._id });
    logWithContext(
      "info",
      `Deleted ${deletedSessions.deletedCount} sessions for user ${user.id} after password reset`,
      null
    );
  } catch (sessionError) {
    errorWithContext(
      "Failed to delete sessions after password reset",
      sessionError,
      null,
      { userId: user.id }
    );
  }

  logWithContext("info", `Password reset successful for user ${user.id}`, null);
};

exports.getUserSessions = async (userId) => {
  try {
    const sessions = await Session.find({ user: userId })
      .sort({ lastActiveAt: -1 })
      .lean();

    const sanitizedSessions = sessions.map((session) => ({
      id: session._id.toString(),
      userAgent: session.userAgent || "Unknown Device",
      ip: session.ip || "Unknown IP",
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: false,
    }));
    return sanitizedSessions;
  } catch (error) {
    errorWithContext(`Failed to get sessions for user ${userId}`, error, null);
    throw new Error("Gagal mengambil daftar sesi.");
  }
};

exports.revokeSession = async (sessionId, userId) => {
  const session = await Session.findById(sessionId);

  if (!session) {
    const error = new Error("Sesi tidak ditemukan");
    error.statusCode = 404;
    throw error;
  }

  if (session.user.toString() !== userId) {
    logWithContext(
      "warn",
      `User ${userId} attempted to revoke session ${sessionId} owned by ${session.user}`,
      null
    );
    const error = new Error("Tidak diizinkan untuk menghapus sesi ini");
    error.statusCode = 403;
    throw error;
  }

  try {
    await session.deleteOne();
    logWithContext(
      "info",
      `Session ${sessionId} revoked by user ${userId}`,
      null
    );
  } catch (deleteError) {
    errorWithContext(
      `Failed to delete session ${sessionId}`,
      deleteError,
      null,
      { userId }
    );
    throw new Error("Gagal menghapus sesi.");
  }
};

module.exports = {
  registerUser: exports.registerUser,
  loginUser: exports.loginUser,
  loginOrRegisterWithGoogle: exports.loginOrRegisterWithGoogle,
  createSession,
  refreshAccessToken: exports.refreshAccessToken,
  logoutUser: exports.logoutUser,
  forgotPassword: exports.forgotPassword,
  resetPassword: exports.resetPassword,
  getUserSessions: exports.getUserSessions,
  revokeSession: exports.revokeSession,
};
