const express = require("express");
const { imageUpload, audioUpload } = require("../../../middleware/upload");
const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");
const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const contactRoutes = require("./contactRoutes");
const userRoutes = require("./userRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/call", callRoutes);
router.use("/contacts", contactRoutes);
router.use("/users", userRoutes);

router.post("/detect", imageUpload, detectController.detectObjects);
router.post("/scan", imageUpload, scanController.scanImage);
router.post("/transcribe", audioUpload, transcribeController.transcribeAudio);

module.exports = router;
