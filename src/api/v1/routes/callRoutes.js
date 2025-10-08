const express = require("express");
const {
  initiateCall,
  answerCall,
  endCall,
} = require("../controllers/callController");
const { protect } = require("../../../middleware/authMiddleware");

const router = express.Router();

router.post("/initiate", protect, initiateCall);
router.post("/answer", protect, answerCall);
router.post("/end", protect, endCall);

module.exports = router;
