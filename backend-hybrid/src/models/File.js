const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  s3Key: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    default: "application/octet-stream",
  },
  encryptedSize: {
    type: Number,
    required: true,
    min: 0,
  },
  encryptedAESKey: {
    type: String,
    required: true,
  },
  nonce: {
    type: String,
    required: true,
  },
  authTag: {
    type: String,
    required: true,
  },
  signature: {
    type: String,
    required: true,
  },
  senderPublicKeyFingerprint: {
    type: String,
    required: true,
    index: true,
  },
  scanResult: {
    type: String,
    default: "Clean",
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  downloaded: {
    type: Boolean,
    default: false,
  },
  downloadedAt: {
    type: Date,
    default: null,
  },
  maxDownloads: {
    type: Number,
    default: null,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
});

fileSchema.index({ receiverId: 1, _id: -1 });
fileSchema.index({ senderId: 1, _id: -1 });
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("File", fileSchema);
