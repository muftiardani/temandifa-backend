const express = require("express");
const router = express.Router();

const { imageUpload, audioUpload } = require("../../../middleware/upload");

const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");
const callRoutes = require("./callRoutes");

router.post("/detect", imageUpload, detectController.detect);
router.post("/scan", imageUpload, scanController.scan);
router.post("/transcribe", audioUpload, transcribeController.transcribe);

router.use("/call", callRoutes);

module.exports = router;
