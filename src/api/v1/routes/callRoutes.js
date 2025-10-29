const express = require("express");
const callController = require("../controllers/callController");
const { protect } = require("../../../middleware/authMiddleware");
const {
  validate,
  initiateCallSchema,
  callIdParamSchema,
} = require("../../../middleware/validators");

const router = express.Router();

router.post(
  "/initiate",
  protect,
  validate(initiateCallSchema),
  callController.initiateCall
);

router.get("/status", protect, callController.getCallStatus);

router.post(
  "/:callId/answer",
  protect,
  validate(callIdParamSchema),
  callController.answerCall
);

router.post(
  "/:callId/end",
  protect,
  validate(callIdParamSchema),
  callController.endCall
);

module.exports = router;
