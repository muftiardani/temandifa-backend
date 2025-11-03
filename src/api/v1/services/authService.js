const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Session = require("../models/Session");
const { logWithContext, errorWithContext } = require("../../../config/logger");
const sendEmail = require("./emailService");
const config = require("../../../config/appConfig");

const googleClient = new OAuth2Client(config.google.clientId);

/**
 * Menghasilkan Access Token dan Refresh Token untuk user.
 * @param {object} user - Objek user Mongoose (harus memiliki _id dan email).
 * @param {string} sessionId - ID Sesi dari MongoDB.
 * @returns {{accessToken: string, refreshToken: string}}
 */
const generateTokens = (user, sessionId) => {
  if (!user || !user._id || !sessionId) {
    throw new Error(
      "User object (with _id) and sessionId are required to generate tokens."
    );
  }

  const accessToken = jwt.sign(
    { id: user._id, email: user.email, sid: sessionId },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user._id, sid: sessionId },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
    }
  );

  return { accessToken, refreshToken };
};

/**
 * Membuat dan menyimpan sesi baru di database.
 * @param {object} user - Objek user Mongoose.
 * @param {object} req - Objek request Express.
 * @param {string} [method="Credentials"] - Metode login (untuk logging User-Agent).
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const createSession = async (user, req, method = "Credentials") => {
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs);

  const ip = req
    ? req.headers["x-forwarded-for"] || req.ip || req.connection?.remoteAddress
    : "unknown";
  const userAgent = req ? req.headers["user-agent"] || "Unknown" : "Unknown";

  let newSession;
  try {
    newSession = await Session.create({
      user: user._id,
      refreshTokenHash: "PENDING",
      userAgent: `${method} - ${userAgent}`.substring(0, 200),
      ip,
      expiresAt,
      lastActiveAt: Date.now(),
    });

    const sessionId = newSession._id.toString();

    const { accessToken, refreshToken } = generateTokens(user, sessionId);

    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

    newSession.refreshTokenHash = refreshTokenHash;
    await newSession.save();

    logWithContext("info", `New session created for user ${user._id}`, req, {
      method,
      ip,
      sessionId,
    });

    return { accessToken, refreshToken };
  } catch (dbError) {
    errorWithContext("Failed to save session to database", dbError, req);
    if (newSession) {
      await Session.findByIdAndDelete(newSession._id).catch((delErr) =>
        errorWithContext("Failed to cleanup partial session", delErr, req)
      );
    }
    throw dbError;
  }
};

/**
 * Mendaftarkan user baru.
 * @param {object} data - Data registrasi.
 * @param {string} data.email - Email user.
 * @param {string} data.password - Password user.
 * @param {object} req - Objek request Express (untuk logging).
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
const registerUser = async ({ email, password }, req) => {
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
    req,
    "Registration"
  );

  return { user, accessToken, refreshToken };
};

/**
 * Login user dengan email/username dan password.
 * @param {string} loginInput - Email atau username.
 * @param {string} password - Password.
 * @param {object} req - Objek request Express.
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
const loginUser = async (loginInput, password, req) => {
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

  user.password = undefined;
  return { user, accessToken, refreshToken };
};

/**
 * Login atau registrasi user menggunakan Google Access Token (ID Token).
 * @param {string} googleAccessToken - Google ID Token.
 * @param {object} req - Objek request Express.
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
const loginOrRegisterWithGoogle = async (googleAccessToken, req) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: googleAccessToken,
      audience: config.google.validAudiences,
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

    const { email, sub: googleId } = payload;
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

/**
 * Memperbarui Access Token menggunakan Refresh Token.
 * @param {string} refreshTokenInput - Refresh token mentah dari klien.
 * @param {object} req - Objek request Express (untuk logging).
 * @returns {Promise<{accessToken: string}>}
 */
const refreshAccessToken = async (refreshTokenInput, req) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshTokenInput, config.jwt.refreshSecret);
  } catch (err) {
    logWithContext(
      "warn",
      "Invalid refresh token signature or format used",
      req,
      { error: err.message }
    );
    const error = new Error("Refresh token tidak valid");
    error.statusCode = 403;
    throw error;
  }

  if (!decoded.sid) {
    logWithContext("warn", `Refresh token missing session ID (sid)`, req);
    const error = new Error("Refresh token tidak valid (format lama)");
    error.statusCode = 403;
    throw error;
  }

  const validSession = await Session.findById(decoded.sid);

  if (!validSession || validSession.user.toString() !== decoded.id) {
    logWithContext(
      "warn",
      `Refresh token valid but session ${decoded.sid} not found or user mismatch`,
      req
    );
    const error = new Error(
      "Sesi tidak valid atau sudah logout, harap login kembali"
    );
    error.statusCode = 403;
    throw error;
  }

  const isMatch = await bcrypt.compare(
    refreshTokenInput,
    validSession.refreshTokenHash
  );

  if (!isMatch) {
    logWithContext(
      "warn",
      `Refresh token hash mismatch for session ${decoded.sid}`,
      req
    );
    await validSession.deleteOne();
    const error = new Error(
      "Sesi tidak valid atau sudah logout, harap login kembali"
    );
    error.statusCode = 403;
    throw error;
  }

  if (validSession.expiresAt < new Date()) {
    await validSession.deleteOne();
    logWithContext(
      "warn",
      `Expired refresh token used for user ${decoded?.id}. Session deleted: ${validSession._id}`,
      req
    );
    const error = new Error("Sesi telah kedaluwarsa, harap login kembali");
    error.statusCode = 403;
    throw error;
  }

  Session.updateOne(
    { _id: validSession._id },
    { $set: { lastActiveAt: Date.now() } }
  )
    .exec()
    .catch((err) => {
      errorWithContext("Failed to update session lastActiveAt", err, req, {
        sessionId: validSession._id,
      });
    });

  const user = await User.findById(decoded.id).select("email").lean();
  if (!user) {
    logWithContext(
      "error",
      `User ${decoded.id} not found during token refresh despite valid token. Deleting session ${validSession._id}`,
      req
    );
    await validSession.deleteOne();
    const error = new Error("Pengguna terkait token tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  const accessToken = jwt.sign(
    { id: user._id, email: user.email, sid: decoded.sid },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  logWithContext("info", `Access token refreshed for user ${decoded.id}`, req);
  return { accessToken };
};

/**
 * Logout user dengan menghapus sesi terkait refresh token.
 * @param {string} refreshTokenInput - Refresh token mentah dari klien.
 * @param {object} req - Objek request Express (untuk logging).
 * @returns {Promise<void>}
 */
const logoutUser = async (refreshTokenInput, req) => {
  if (!refreshTokenInput) return;
  try {
    const decoded = jwt.verify(refreshTokenInput, config.jwt.refreshSecret);
    if (!decoded.sid || !decoded.id) {
      throw new Error("Invalid refresh token payload");
    }

    const session = await Session.findById(decoded.sid);

    if (
      session &&
      session.user.toString() === decoded.id &&
      (await bcrypt.compare(refreshTokenInput, session.refreshTokenHash))
    ) {
      await session.deleteOne();
      logWithContext(
        "info",
        `Session ${session._id} deleted successfully on logout`,
        req
      );
    } else {
      logWithContext(
        "warn",
        "Logout attempt with non-existent or mismatched refresh token/session",
        req
      );
    }
  } catch (error) {
    errorWithContext(
      "Error during session deletion on logout (e.g., invalid token)",
      error,
      req
    );
  }
};

/**
 * Memproses permintaan lupa password dan mengirim email.
 * @param {string} email - Email user.
 * @param {object} req - Objek request Express (untuk logging).
 * @returns {Promise<string>} - Pesan sukses.
 */
const forgotPassword = async (email, req) => {
  if (!email) {
    throw new Error("Email is required for forgot password.");
  }
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    logWithContext(
      "warn",
      `Forgot password attempt for non-existent email: ${email}`,
      req
    );
    return "Jika email terdaftar, instruksi reset password akan dikirim.";
  }

  try {
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${config.frontendUrl}/reset-password/${resetToken}`;

    await sendEmail(
      {
        to: user.email,
        subject: "Atur Ulang Kata Sandi Akun TemanDifa Anda",
        template: "resetPassword",
        context: {
          resetUrl: resetUrl,
        },
      },
      req
    );

    logWithContext(
      "info",
      `Password reset email sent successfully to ${email}`,
      req
    );
    return "Email untuk reset kata sandi telah dikirim";
  } catch (error) {
    errorWithContext("Failed to send password reset email", error, req, {
      email,
    });
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false }).catch((saveErr) => {
      errorWithContext(
        "Failed to clear reset token after email failure",
        saveErr,
        req,
        { userId: user.id }
      );
    });
    throw new Error(
      "Gagal mengirim email reset password. Silakan coba lagi nanti."
    );
  }
};

/**
 * Mereset password user menggunakan token.
 * @param {string} token - Token reset dari URL.
 * @param {string} password - Password baru.
 * @param {object} req - Objek request Express (untuk logging).
 * @returns {Promise<void>}
 */
const resetPassword = async (token, password, req) => {
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
    logWithContext("warn", "Invalid or expired password reset token used", req);
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
    errorWithContext("Failed to save new password", saveError, req, {
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
      req
    );
  } catch (sessionError) {
    errorWithContext(
      "Failed to delete sessions after password reset",
      sessionError,
      req,
      { userId: user.id }
    );
  }

  logWithContext("info", `Password reset successful for user ${user.id}`, req);
};

/**
 * Mendapatkan semua sesi aktif untuk user.
 * @param {string} userId - ID user.
 * @param {object} req - Objek request Express (yang berisi req.sessionId).
 * @returns {Promise<Array<object>>} - Daftar sesi.
 */
const getUserSessions = async (userId, req) => {
  const currentSessionId = req.sessionId;

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
      isCurrent: session._id.toString() === currentSessionId,
    }));
    return sanitizedSessions;
  } catch (error) {
    errorWithContext(`Failed to get sessions for user ${userId}`, error, req);
    throw new Error("Gagal mengambil daftar sesi.");
  }
};

/**
 * Menghapus (revoke) sesi spesifik milik user.
 * @param {string} sessionId - ID sesi yang akan dihapus.
 * @param {string} userId - ID user yang meminta (untuk verifikasi kepemilikan).
 * @param {object} req - Objek request Express (yang berisi req.sessionId).
 * @returns {Promise<void>}
 */
const revokeSession = async (sessionId, userId, req) => {
  if (sessionId === req.sessionId) {
    logWithContext(
      "warn",
      `User ${userId} attempted to revoke their current session`,
      req
    );
    const error = new Error(
      "Tidak dapat menghapus sesi Anda saat ini. Gunakan logout."
    );
    error.statusCode = 400;
    throw error;
  }

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
      req
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
      req
    );
  } catch (deleteError) {
    errorWithContext(
      `Failed to delete session ${sessionId}`,
      deleteError,
      req,
      { userId }
    );
    throw new Error("Gagal menghapus sesi.");
  }
};

module.exports = {
  registerUser,
  loginUser,
  loginOrRegisterWithGoogle,
  createSession,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  getUserSessions,
  revokeSession,
};
