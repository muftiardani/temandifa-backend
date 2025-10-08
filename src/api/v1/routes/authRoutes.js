const express = require("express");
const passport = require("passport");
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleCallback,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgotpassword", forgotPassword);
router.put("/resetpassword/:resettoken", resetPassword);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/", session: false }),
  googleCallback
);

module.exports = router;
