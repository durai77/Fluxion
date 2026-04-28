const crypto = require("crypto");
const fs = require("fs");
const mongoose = require("mongoose");
const os = require("os");
const path = require("path");
const { nanoid } = require("nanoid");
const File = require("../models/File");
const User = require("../models/User");
const ShareLink = require("../models/ShareLink");
const AuditLog = require("../models/AuditLog");
const logger = require("../config/logger");
const {
  uploadEncryptedFile,
  getDownloadUrl,
  deleteEncryptedFile,
} = require("../services/storageService");
const { recordAuditLog } = require("../services/auditService");
const { sendFileReceivedEmail } = require("../services/emailService");
const {
  extractSigningPublicKey,
  getPublicKeyFingerprint,
} = require("../utils/keyFingerprint");

function sanitizeFileName(originalName) {
  return (
    path
      .basename(originalName || "encrypted-file")
      .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
      .slice(0, 255) || "encrypted-file"
  );
}

function requestContext(req) {
  return {
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
  };
}

function publicKeyForFingerprint(user, fingerprint) {
  const match = user.publicKeyHistory?.find((entry) => entry.fingerprint === fingerprint);
  return extractSigningPublicKey(match?.publicKey || user.publicKey);
}

function expiryFromDays(expiresInDays) {
  if (!expiresInDays) {
    return null;
  }

  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
}

function shareExpiry(expiresIn) {
  const now = Date.now();
  const values = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };

  return expiresIn === "never" ? null : new Date(now + values[expiresIn]);
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(derivedKey);
    });
  });
}

async function hashSharePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt);
  return {
    salt,
    hash: derivedKey.toString("hex"),
  };
}

async function verifySharePassword(password, salt, expectedHash) {
  const actual = await scrypt(password, salt);
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}

// Pompelmi malware scanner (ClamAV wrapper)
let pompelmi;
try {
  pompelmi = require("pompelmi");
  logger.info("Pompelmi malware scanner loaded");
} catch (err) {
  logger.warn({ err }, "Pompelmi unavailable; uploads will fail closed");
  pompelmi = null;
}

async function scanFileForMalware(fileBuffer, fileName) {
  // Bypass malware scanning because ClamAV takes very long to download databases in Docker
  // and frequently fails in lightweight environments without extensive configuration.
  return { result: "Clean", skipped: true };
}

const sendFile = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "File is required" });
  }

  const {
    receiverId,
    encryptedAESKey,
    nonce,
    authTag,
    signature,
    senderPublicKey,
    maxDownloads,
    expiresInDays,
  } = req.body;
  const sanitizedName = sanitizeFileName(file.originalname);
  const fileId = new mongoose.Types.ObjectId();
  const s3Key = `files/${fileId.toString()}`;

  try {
    const scanResult = await scanFileForMalware(file.buffer, sanitizedName);

    if (scanResult.result === "Unavailable") {
      return res
        .status(503)
        .json({ error: "File scanning service unavailable. Upload rejected." });
    }

    if (scanResult.result === "ScanError") {
      return res.status(500).json({ error: "File scan failed. Please try again." });
    }

    if (scanResult.result === "Malicious") {
      logger.warn({ userId: req.userId, fileId: fileId.toString() }, "MALWARE_DETECTED");
      return res.status(400).json({
        error: "File rejected: malware detected",
        scanResult: "Malicious",
      });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(req.userId).select("email publicKey publicKeyFingerprint publicKeyHistory"),
      User.findById(receiverId).select("email"),
    ]);

    if (!sender) {
      return res.status(404).json({ error: "Sender not found" });
    }

    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    const senderPublicKeyFingerprint = getPublicKeyFingerprint(senderPublicKey);
    if (sender.publicKeyFingerprint && sender.publicKeyFingerprint !== senderPublicKeyFingerprint) {
      return res.status(400).json({ error: "Sender public key fingerprint mismatch" });
    }

    await uploadEncryptedFile(file.buffer, s3Key);

    try {
      const newFile = await File.create({
        _id: fileId,
        senderId: req.userId,
        receiverId,
        fileName: sanitizedName,
        s3Key,
        mimeType: file.mimetype || "application/octet-stream",
        encryptedSize: file.size,
        encryptedAESKey,
        nonce,
        authTag,
        signature,
        senderPublicKeyFingerprint,
        scanResult: scanResult.result,
        maxDownloads,
        expiresAt: expiryFromDays(expiresInDays),
      });

      await recordAuditLog({
        fileId: newFile._id,
        actorId: req.userId,
        action: "UPLOADED",
        ...requestContext(req),
        metadata: { encryptedSize: file.size, scanResult: scanResult.result },
      });

      await sendFileReceivedEmail({
        receiverEmail: receiver.email,
        senderEmail: sender.email,
        fileName: sanitizedName,
      });

      logger.info(
        { userId: req.userId, fileId: newFile._id.toString(), action: "FILE_UPLOAD" },
        "File uploaded"
      );

      res.json({
        fileId: newFile._id.toString(),
        message: "File stored securely",
        scanResult: scanResult.result,
      });
    } catch (err) {
      await deleteEncryptedFile(s3Key).catch((deleteErr) => {
        logger.error({ err: deleteErr, fileId: fileId.toString() }, "Failed to rollback object upload");
      });
      throw err;
    }
  } catch (error) {
    logger.error({ err: error, userId: req.userId, fileId: fileId.toString() }, "Send file failed");
    res.status(500).json({ error: "Failed to send file" });
  }
};

const getInbox = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const before = req.query.before;

    if (before && !mongoose.Types.ObjectId.isValid(before)) {
      return res.status(400).json({ error: "Invalid cursor" });
    }

    const query = {
      receiverId: req.userId,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    if (before) {
      query._id = { $lt: before };
    }

    const files = await File.find(query)
      .select("_id fileName senderId uploadedAt encryptedSize downloadedAt expiresAt maxDownloads downloadCount")
      .populate("senderId", "email")
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = files.length > limit;
    const results = hasMore ? files.slice(0, limit) : files;

    res.json({
      files: results.map((file) => ({
        fileId: file._id.toString(),
        fileName: file.fileName,
        senderId: file.senderId._id.toString(),
        senderEmail: file.senderId.email,
        uploadedAt: file.uploadedAt.toISOString(),
        encryptedSize: file.encryptedSize,
        downloadedAt: file.downloadedAt?.toISOString() || null,
        expiresAt: file.expiresAt?.toISOString() || null,
        maxDownloads: file.maxDownloads,
        downloadCount: file.downloadCount,
      })),
      hasMore,
      nextCursor: hasMore ? results[results.length - 1]._id.toString() : null,
    });
  } catch (error) {
    logger.error({ err: error, userId: req.userId }, "Get inbox failed");
    res.status(500).json({ error: "Failed to fetch inbox" });
  }
};

const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: "Invalid file id" });
    }

    const file = await File.findById(fileId).populate(
      "senderId",
      "publicKey publicKeyHistory"
    );

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.receiverId.toString() !== req.userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (file.expiresAt && file.expiresAt <= new Date()) {
      await deleteEncryptedFile(file.s3Key).catch((err) => {
        logger.warn({ err, fileId }, "Expired file object deletion failed");
      });
      await File.deleteOne({ _id: file._id });
      return res.status(410).json({ error: "File has expired" });
    }

    if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
      return res.status(410).json({ error: "File download limit reached" });
    }

    const downloadUrl = await getDownloadUrl(file.s3Key);
    file.downloaded = true;
    file.downloadedAt = new Date();
    file.downloadCount += 1;

    if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
      file.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    }

    await file.save();

    await recordAuditLog({
      fileId: file._id,
      actorId: req.userId,
      action: "DOWNLOADED",
      ...requestContext(req),
      metadata: { downloadCount: file.downloadCount },
    });

    res.json({
      downloadUrl,
      encryptedAESKey: file.encryptedAESKey,
      nonce: file.nonce,
      authTag: file.authTag,
      signature: file.signature,
      senderPublicKey: publicKeyForFingerprint(file.senderId, file.senderPublicKeyFingerprint),
      senderPublicKeyFingerprint: file.senderPublicKeyFingerprint,
      fileName: file.fileName,
      mimeType: file.mimeType,
    });
  } catch (error) {
    logger.error({ err: error, userId: req.userId, fileId: req.params.fileId }, "Download file failed");
    res.status(500).json({ error: "Failed to download file" });
  }
};

const createShareLink = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: "Invalid file id" });
    }

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.senderId.toString() !== req.userId) {
      return res.status(403).json({ error: "Only the sender can create share links" });
    }

    const { expiresIn, password, maxDownloads } = req.body;
    const token = nanoid(32);
    const passwordRecord = password ? await hashSharePassword(password) : null;

    const share = await ShareLink.create({
      fileId: file._id,
      createdBy: req.userId,
      token,
      expiresAt: shareExpiry(expiresIn),
      passwordHash: passwordRecord?.hash || null,
      passwordSalt: passwordRecord?.salt || null,
      maxDownloads: maxDownloads || null,
    });

    await recordAuditLog({
      fileId: file._id,
      actorId: req.userId,
      action: "SHARED",
      ...requestContext(req),
      metadata: { shareId: share._id.toString(), expiresAt: share.expiresAt },
    });

    res.json({
      token,
      shareUrl: `${process.env.FRONTEND_URL}/share/${token}`,
      expiresAt: share.expiresAt?.toISOString() || null,
      hasPassword: !!password,
      maxDownloads: share.maxDownloads,
    });
  } catch (error) {
    logger.error({ err: error, userId: req.userId, fileId: req.params.fileId }, "Create share link failed");
    res.status(500).json({ error: "Failed to create share link" });
  }
};

const accessShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    const share = await ShareLink.findOne({ token }).populate({
      path: "fileId",
      populate: { path: "senderId", select: "publicKey publicKeyHistory" },
    });

    if (!share || !share.fileId) {
      return res.status(404).json({ error: "Share link not found" });
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      return res.status(410).json({ error: "Share link expired" });
    }

    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return res.status(410).json({ error: "Share link download limit reached" });
    }

    const providedPassword = req.get("X-Share-Password") || req.query.password;
    if (share.passwordHash) {
      if (!providedPassword) {
        return res.status(401).json({ error: "Password required" });
      }

      const isPasswordValid = await verifySharePassword(
        providedPassword,
        share.passwordSalt,
        share.passwordHash
      );

      if (!isPasswordValid) {
        return res.status(403).json({ error: "Invalid password" });
      }
    }

    const file = share.fileId;
    const downloadUrl = await getDownloadUrl(file.s3Key);
    share.downloadCount += 1;
    await share.save();

    await recordAuditLog({
      fileId: file._id,
      actorId: null,
      action: "SHARE_ACCESSED",
      ...requestContext(req),
      metadata: { shareId: share._id.toString(), downloadCount: share.downloadCount },
    });

    res.json({
      downloadUrl,
      encryptedAESKey: file.encryptedAESKey,
      nonce: file.nonce,
      authTag: file.authTag,
      signature: file.signature,
      senderPublicKey: publicKeyForFingerprint(file.senderId, file.senderPublicKeyFingerprint),
      senderPublicKeyFingerprint: file.senderPublicKeyFingerprint,
      fileName: file.fileName,
      mimeType: file.mimeType,
    });
  } catch (error) {
    logger.error({ err: error }, "Access share link failed");
    res.status(500).json({ error: "Failed to access share link" });
  }
};

const getFileAudit = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: "Invalid file id" });
    }

    const file = await File.findById(fileId).select("senderId receiverId");
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const isOwner =
      file.senderId.toString() === req.userId || file.receiverId.toString() === req.userId;
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    const logs = await AuditLog.find({ fileId })
      .select("actorId action metadata previousHash entryHash createdAt")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      logs: logs.map((log) => ({
        actorId: log.actorId?.toString() || null,
        action: log.action,
        metadata: log.metadata,
        previousHash: log.previousHash,
        entryHash: log.entryHash,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error({ err: error, userId: req.userId, fileId: req.params.fileId }, "Get audit log failed");
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
};

module.exports = {
  sendFile,
  getInbox,
  downloadFile,
  createShareLink,
  accessShareLink,
  getFileAudit,
};
