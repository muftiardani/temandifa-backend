const express = require("express");
const router = express.Router();
const {
  initiateCall,
  answerCall,
  endCall,
  getCallStatus,
} = require("../controllers/callController");
const { protect } = require("../../../middleware/authMiddleware");

// @route   POST /api/v1/call/initiate
// Inisiasi panggilan ke nomor telepon lain
router.post("/initiate", protect, initiateCall);

// @route   POST /api/v1/call/:callId/answer
// Menjawab panggilan yang masuk
router.post("/:callId/answer", protect, answerCall);

// @route   POST /api/v1/call/:callId/end
// Mengakhiri, menolak, atau membatalkan panggilan
router.post("/:callId/end", protect, endCall);

// @route   GET /api/v1/call/status
// Memeriksa apakah pengguna sedang dalam panggilan aktif (berguna saat aplikasi dibuka kembali)
router.get("/status", protect, getCallStatus);

module.exports = router;
