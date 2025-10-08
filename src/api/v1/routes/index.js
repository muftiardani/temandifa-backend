const express = require("express");
const callRoutes = require("./callRoutes");
const authRoutes = require("./authRoutes");
const { upload } = require("../../../middleware/upload");
const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");

const router = express.Router();

router.use("/auth", authRoutes);

router.use("/call", callRoutes);

router.post("/detect", upload.single("image"), detectController.proxyToYolo);
router.post("/scan", upload.single("image"), scanController.proxyToOcr);
router.post(
  "/transcribe",
  upload.single("audio"),
  transcribeController.proxyToTranscriber
);

module.exports = router;
