const express = require("express");
const router = express.Router();
const {
  initiateCall,
  answerCall,
  endCall,
  getCallStatus,
} = require("../controllers/callController");
const { protect } = require("../../../middleware/authMiddleware");

// Melindungi semua rute di bawah ini, memastikan hanya pengguna terotentikasi yang dapat mengakses
router.use(protect);

// @route   POST /api/v1/call/initiate
// Inisiasi panggilan ke nomor telepon lain
router.post("/initiate", initiateCall);

// @route   POST /api/v1/call/:callId/answer
// Menjawab panggilan yang masuk
router.post("/:callId/answer", answerCall);

// @route   POST /api/v1/call/:callId/end
// Mengakhiri, menolak, atau membatalkan panggilan
router.post("/:callId/end", endCall);

// @route   GET /api/v1/call/status
// Memeriksa apakah pengguna sedang dalam panggilan aktif
router.get("/status", getCallStatus);

module.exports = router;
