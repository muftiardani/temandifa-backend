const express = require("express");
const userController = require("../controllers/userController");
const { protect } = require("../../../middleware/authMiddleware");
const { validate, pushTokenSchema } = require("../../../middleware/validators");

const router = express.Router();

router.put(
  "/pushtoken",
  protect,
  validate(pushTokenSchema),
  userController.updatePushToken
);

module.exports = router;
