const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController");
const {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../../middleware/validators");
const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post(
  "/google/mobile",
  passport.authenticate("google-token", { session: false }),
  authController.loginWithGoogle
);

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

module.exports = router;
