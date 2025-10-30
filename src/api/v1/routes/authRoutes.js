const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../../../middleware/authMiddleware");
const {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  sessionIdParamSchema,
} = require("../../../middleware/validators");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.registerUser);
router.post("/login", validate(loginSchema), authController.loginUser);
router.post("/google/mobile", authController.loginWithGoogleMobile);
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authController.refreshToken
);
router.post("/logout", validate(logoutSchema), authController.logoutUser);
router.post(
  "/forgotpassword",
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/resetpassword/:token",
  validate(resetPasswordSchema),
  authController.resetPassword
);

router.get("/profile", protect, (req, res) => {
  if (req.user) {
    res.status(200).json(req.user);
  } else {
    res.status(404).json({ message: "User tidak ditemukan" });
  }
});
router.get("/sessions", protect, authController.getSessions);

router.delete(
  "/sessions/:sessionId",
  protect,
  validate(sessionIdParamSchema),
  authController.revokeSession
);

module.exports = router;
