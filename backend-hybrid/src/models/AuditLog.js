const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ["UPLOADED", "DOWNLOADED", "SHARED", "DELETED", "SHARE_ACCESSED"],
      required: true,
      index: true,
    },
    ip: String,
    userAgent: String,
    metadata: mongoose.Schema.Types.Mixed,
    previousHash: {
      type: String,
      default: null,
    },
    entryHash: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

auditSchema.index({ fileId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditSchema);
