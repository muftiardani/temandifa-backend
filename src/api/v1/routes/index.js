const express = require("express");
const router = express.Router();
const { protect } = require("../../../middleware/authMiddleware");
const upload = require("../../../middleware/upload");

const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const contactRoutes = require("./contactRoutes");
const userRoutes = require("./userRoutes");

const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");

router.post(
  "/detect",
  protect,
  upload.single("image"),
  detectController.detectObject
);
router.post("/scan", protect, upload.single("image"), scanController.scanImage);
router.post(
  "/transcribe",
  protect,
  upload.single("audio"),
  transcribeController.transcribeAudio
);

router.use("/auth", authRoutes);
router.use("/call", callRoutes);
router.use("/contacts", contactRoutes);
router.use("/users", userRoutes);

module.exports = router;
