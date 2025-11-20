const asyncHandler = require("express-async-handler");
const authService = require("../services/authService");
const { logWithContext } = require("../../../config/logger");
const config = require("../../../config/appConfig");

exports.registerUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  logWithContext("info", "Register user attempt", req, { email });

  const { user, accessToken, refreshToken } = await authService.registerUser(
    { email, password },
    req
  );

  const logLevel = config.isProduction ? "info" : "debug";
  logWithContext(logLevel, `User registered successfully: ${user.id}`, req);

  res.status(201).json({
    _id: user._id,
    email: user.email,
    accessToken,
    refreshToken,
  });
});

exports.loginUser = asyncHandler(async (req, res, next) => {
  const { login, password } = req.body;
  logWithContext("info", "Login attempt", req, { login });

  const { user, accessToken, refreshToken } = await authService.loginUser(
    login,
    password,
    req
  );

  const logLevel = config.isProduction ? "info" : "debug";
  logWithContext(logLevel, `User logged in successfully: ${user.id}`, req);

  res.json({
    _id: user._id,
    email: user.email,
    accessToken,
    refreshToken,
  });
});

exports.loginWithGoogleMobile = asyncHandler(async (req, res, next) => {
  const { accessToken: googleAccessToken } = req.body;
  logWithContext("info", "Google Mobile login attempt", req);

  if (!googleAccessToken) {
    res.status(400);
    throw new Error("Google access token is required");
  }

  const { user, accessToken, refreshToken } =
    await authService.loginOrRegisterWithGoogle(googleAccessToken, req);

  logWithContext(
    "info",
    `User authenticated via Google successfully: ${user.id}`,
    req
  );

  res.json({
    _id: user._id,
    email: user.email,
    accessToken,
    refreshToken,
  });
});

exports.refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  logWithContext("info", "Refresh token attempt", req);

  if (!refreshToken) {
    res.status(400);
    throw new Error("Refresh token is required");
  }

  const { accessToken, refreshToken: newRefreshToken } =
    await authService.refreshAccessToken(refreshToken, req);

  logWithContext(
    "info",
    "Access token refreshed and rotated successfully",
    req
  );

  res.json({
    accessToken,
    refreshToken: newRefreshToken,
  });
});

exports.logoutUser = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  logWithContext("info", "Logout attempt", req);

  if (!refreshToken) {
    res.status(400);
    throw new Error("Refresh token is required for logout");
  }

  await authService.logoutUser(refreshToken, req);

  logWithContext(
    "info",
    "User logged out successfully (session invalidated)",
    req
  );
  res.status(200).json({ message: "Logout successful" });
});

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  logWithContext("info", "Forgot password request", req, { email });

  const message = await authService.forgotPassword(email, req);

  logWithContext(
    "info",
    `Password reset email process initiated for: ${email}`,
    req
  );
  res.status(200).json({
    message:
      message ||
      "Jika email terdaftar, instruksi reset password telah dikirim.",
  });
});

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const resetToken = req.params.token;
  const { password } = req.body;
  logWithContext("info", "Reset password attempt", req);

  await authService.resetPassword(resetToken, password, req);

  logWithContext("info", "Password reset successfully", req);
  res.status(200).json({ message: "Password reset successful" });
});

exports.getSessions = asyncHandler(async (req, res, next) => {
  logWithContext("info", `Fetching sessions for user`, req);

  const sessions = await authService.getUserSessions(req.user.id, req);

  const logLevel = config.isProduction ? "info" : "debug";
  logWithContext(logLevel, `Found ${sessions.length} sessions for user`, req);
  res.status(200).json(sessions);
});

exports.revokeSession = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user.id;
  logWithContext("info", `Attempting to revoke session: ${sessionId}`, req);

  await authService.revokeSession(sessionId, userId, req);

  logWithContext("info", `Session revoked successfully: ${sessionId}`, req);
  res.status(200).json({ message: "Session revoked successfully" });
});
