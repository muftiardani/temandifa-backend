const express = require("express");
const {
  initiateCall,
  answerCall,
  endCall,
  getCallStatus,
} = require("../controllers/callController");
const { protect } = require("../../../middleware/authMiddleware");
const {
  validate,
  initiateCallSchema,
  callIdSchema,
} = require("../../../middleware/validators");

const router = express.Router();

router.use(protect);

router.post("/initiate", validate(initiateCallSchema), initiateCall);
router.get("/status", getCallStatus);
router.post("/:callId/answer", validate(callIdSchema), answerCall);
router.post("/:callId/end", validate(callIdSchema), endCall);

module.exports = router;
