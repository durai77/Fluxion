const User = require("../models/User");
const logger = require("../config/logger");
const {
  extractSigningPublicKey,
  getPublicKeyFingerprint,
} = require("../utils/keyFingerprint");

function normalizePublicKeyRecord(publicKey) {
  const signingPublicKey = extractSigningPublicKey(publicKey);
  return {
    publicKey,
    fingerprint: getPublicKeyFingerprint(signingPublicKey),
  };
}

// POST /users/public-key - Store user's public key
const uploadPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: "Public key is required" });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only allow setting public key once (registration only)
    if (user.publicKey) {
      return res.status(400).json({ error: "Public key already set" });
    }

    const record = normalizePublicKeyRecord(publicKey);
    user.publicKey = publicKey;
    user.publicKeyFingerprint = record.fingerprint;
    user.publicKeyHistory.push(record);
    await user.save();

    res.json({ message: "Public key stored" });
  } catch (error) {
    logger.error({ err: error, userId: req.userId }, "Upload public key failed");
    res.status(500).json({ error: "Failed to store public key" });
  }
};

// GET /users/public-key?email= - Get receiver's public key
const getPublicKey = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.publicKey) {
      return res
        .status(404)
        .json({ error: "User has not registered their public key" });
    }

    res.json({
      userId: user._id.toString(),
      publicKey: user.publicKey,
      publicKeyFingerprint: user.publicKeyFingerprint,
    });
  } catch (error) {
    logger.error({ err: error }, "Get public key failed");
    res.status(500).json({ error: "Failed to get public key" });
  }
};

// PUT /users/public-key - Revoke and update user's public key
const revokePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ error: "Public key is required" });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    user.publicKeyHistory.forEach((entry) => {
      if (!entry.revokedAt) {
        entry.revokedAt = now;
      }
    });

    const record = normalizePublicKeyRecord(publicKey);

    // Update the public key and preserve key history so old file signatures can
    // still be verified against the exact public key fingerprint used at upload.
    user.publicKey = publicKey;
    user.publicKeyFingerprint = record.fingerprint;
    user.publicKeyHistory.push(record);
    await user.save();

    res.json({ message: "Public key revoked and updated successfully" });
  } catch (error) {
    logger.error({ err: error, userId: req.userId }, "Revoke public key failed");
    res.status(500).json({ error: "Failed to revoke public key" });
  }
};

module.exports = { uploadPublicKey, getPublicKey, revokePublicKey };
