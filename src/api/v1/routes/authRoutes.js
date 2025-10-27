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

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh-token", refreshTokens);
router.post("/google/mobile", loginWithGoogle);
router.get("/profile", protect, (req, res) => {
  res.json({ user: req.user });
});
router.post("/forgotpassword", validate(forgotPasswordSchema), forgotPassword);
router.post(
  "/resetpassword/:token",
  validate(resetPasswordSchema),
  resetPassword
);
router.get("/sessions", protect, getSessions);
router.delete("/sessions/:id", protect, revokeSession);

module.exports = router;
