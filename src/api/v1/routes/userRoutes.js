const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { validate, pushTokenSchema } = require("../../../middleware/validators");
const passport = require("passport");

// Lindungi rute ini dengan otentikasi JWT
router.use(passport.authenticate("jwt", { session: false }));

router.put(
  "/pushtoken",
  validate(pushTokenSchema),
  userController.updatePushToken
);

module.exports = router;
