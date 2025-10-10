const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");
const {
  userValidationRules,
  validate,
} = require("../../../middleware/validators");

router.post(
  "/register",
  userValidationRules(),
  validate,
  authController.register
);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgotpassword", authController.forgotPassword);
router.put("/resetpassword/:resetToken", authController.resetPassword);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login/failed",
    session: false,
  }),
  authController.googleCallback
);

module.exports = router;
