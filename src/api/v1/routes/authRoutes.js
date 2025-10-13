const express = require("express");
const authController = require("../controllers/authController");
const {
  validate,
  registerSchema,
  loginSchema,
} = require("../../../middleware/validators");
const passport = require("passport");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);

router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/forgotpassword", authController.forgotPassword);
router.post("/google/mobile", authController.loginWithGoogle);

router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({ user: req.user });
  }
);

module.exports = router;
