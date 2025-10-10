const express = require("express");
const router = express.Router();
const { updatePushToken } = require("../controllers/userController");
const { protect } = require("../../../middleware/authMiddleware");

router.put("/pushtoken", protect, updatePushToken);

module.exports = router;
