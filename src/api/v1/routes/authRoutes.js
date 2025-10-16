const express = require("express");
const {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  loginWithGoogle,
  getSessions,
  revokeSession,
} = require("../controllers/authController");
const { protect } = require("../../../middleware/authMiddleware");
const {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../../middleware/validators");

const router = express.Router();

/**
 * @swagger
 * tags:
 * name: Auth
 * description: Authentication management
 */

/**
 * @swagger
 * /auth/register:
 * post:
 * summary: Register a new user
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * format: email
 * password:
 * type: string
 * format: password
 * minLength: 8
 * responses:
 * 201:
 * description: User registered successfully
 * 400:
 * description: Bad request (e.g., email already exists)
 */
router.post("/register", validate(registerSchema), register);

/**
 * @swagger
 * /auth/login:
 * post:
 * summary: Log in a user
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - login
 * - password
 * properties:
 * login:
 * type: string
 * description: Can be email or username.
 * password:
 * type: string
 * responses:
 * 200:
 * description: Login successful, returns access and refresh tokens
 * 401:
 * description: Invalid credentials
 */
router.post("/login", validate(loginSchema), login);

/**
 * @swagger
 * /auth/logout:
 * post:
 * summary: Log out a user
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - refreshToken
 * properties:
 * refreshToken:
 * type: string
 * responses:
 * 200:
 * description: Logout successful
 */
router.post("/logout", logout);

/**
 * @swagger
 * /auth/refresh-token:
 * post:
 * summary: Refresh an access token
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - refreshToken
 * properties:
 * refreshToken:
 * type: string
 * responses:
 * 200:
 * description: Returns a new access token
 * 403:
 * description: Invalid refresh token
 */
router.post("/refresh-token", refreshTokens);

/**
 * @swagger
 * /auth/google/mobile:
 * post:
 * summary: Authenticate with Google on mobile
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - accessToken
 * properties:
 * accessToken:
 * type: string
 * responses:
 * 200:
 * description: Google authentication successful
 */
router.post("/google/mobile", loginWithGoogle);

/**
 * @swagger
 * /auth/profile:
 * get:
 * summary: Get current user profile
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: User profile data
 * 401:
 * description: Unauthorized
 */
router.get("/profile", protect, (req, res) => {
  res.json({ user: req.user });
});

/**
 * @swagger
 * /auth/forgotpassword:
 * post:
 * summary: Request a password reset
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * properties:
 * email:
 * type: string
 * format: email
 * responses:
 * 200:
 * description: Password reset email sent
 */
router.post("/forgotpassword", validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /auth/resetpassword/{token}:
 * post:
 * summary: Reset password with a token
 * tags: [Auth]
 * parameters:
 * - in: path
 * name: token
 * required: true
 * schema:
 * type: string
 * description: The password reset token
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - password
 * properties:
 * password:
 * type: string
 * format: password
 * responses:
 * 200:
 * description: Password has been reset successfully
 */
router.post(
  "/resetpassword/:token",
  validate(resetPasswordSchema),
  resetPassword
);

/**
 * @swagger
 * /auth/sessions:
 * get:
 * summary: Get all active sessions for the current user
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: A list of active sessions
 * 401:
 * description: Unauthorized
 */
router.get("/sessions", protect, getSessions);

/**
 * @swagger
 * /auth/sessions/{id}:
 * delete:
 * summary: Revoke a specific session
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: The session ID to revoke
 * responses:
 * 200:
 * description: Session revoked successfully
 * 403:
 * description: Forbidden
 * 404:
 * description: Session not found
 */
router.delete("/sessions/:id", protect, revokeSession);

module.exports = router;
