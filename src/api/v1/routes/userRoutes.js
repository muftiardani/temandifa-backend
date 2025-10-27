const express = require("express");
const { updatePushToken } = require("../controllers/userController");
const { protect } = require("../../../middleware/authMiddleware");
const { validate, pushTokenSchema } = require("../../../middleware/validators");

const router = express.Router();

router.put("/pushtoken", protect, validate(pushTokenSchema), updatePushToken);

module.exports = router;
