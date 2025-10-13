const express = require("express");
const router = express.Router();
const callController = require("../controllers/callController");
const {
  validate,
  initiateCallSchema,
  callIdSchema,
} = require("../../../middleware/validators");
const passport = require("passport");

// Melindungi semua rute panggilan dengan otentikasi JWT
router.use(passport.authenticate("jwt", { session: false }));

// Rute untuk memulai panggilan
router.post(
  "/initiate",
  validate(initiateCallSchema),
  callController.initiateCall
);

// Rute untuk mendapatkan status panggilan
router.get("/status", callController.getCallStatus);

// Rute untuk menjawab panggilan (menggunakan parameter callId)
router.post(
  "/:callId/answer",
  validate(callIdSchema),
  callController.answerCall
);

// Rute untuk mengakhiri panggilan (menggunakan parameter callId)
router.post("/:callId/end", validate(callIdSchema), callController.endCall);

module.exports = router;
