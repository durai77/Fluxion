const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/auth");
const { uploadLimiter, generalLimiter, downloadLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const { sendFileSchema, shareFileSchema } = require("../validation/schemas");
const {
  sendFile,
  getInbox,
  downloadFile,
  createShareLink,
  getFileAudit,
} = require("../controllers/filesController");

// Configure multer for memory storage. The encrypted bytes are scanned and then
// streamed to object storage; plaintext never reaches this service.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// POST /files/send - Upload encrypted file
router.post(
  "/send",
  uploadLimiter,
  authMiddleware,
  upload.single("file"),
  validate(sendFileSchema),
  sendFile
);

// GET /files/inbox - List incoming files
router.get("/inbox", generalLimiter, authMiddleware, getInbox);

// GET /files/download/:fileId - Download encrypted file
router.get("/download/:fileId", downloadLimiter, authMiddleware, downloadFile);

// POST /files/:fileId/share - Create a password-capable share link
router.post("/:fileId/share", generalLimiter, authMiddleware, validate(shareFileSchema), createShareLink);

// GET /files/:fileId/audit - File access audit trail
router.get("/:fileId/audit", generalLimiter, authMiddleware, getFileAudit);

module.exports = router;
