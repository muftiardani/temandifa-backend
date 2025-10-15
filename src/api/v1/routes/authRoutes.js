const express = require("express");
const authController = require("../controllers/authController");
const {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../../middleware/validators");
const passport = require("passport");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);

router.post("/google/mobile", authController.googleAuthCallback);

router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({ user: req.user });
  }
);

router.post(
  "/forgotpassword",
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/resetpassword/:resettoken",
  validate(resetPasswordSchema),
  authController.resetPassword
);

module.exports = router;
