const express = require("express");
const router = express.Router();
const {
  initiateCall,
  answerCall,
  endCall,
} = require("../controllers/callController");

router.post("/initiate", initiateCall);
router.post("/answer", answerCall);
router.post("/end", endCall);

module.exports = router;
