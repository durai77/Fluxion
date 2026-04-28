const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  publicKey: {
    type: String,
    default: null,
  },
  publicKeyFingerprint: {
    type: String,
    default: null,
    index: true,
  },
  publicKeyHistory: [
    {
      publicKey: { type: String, required: true },
      fingerprint: { type: String, required: true, index: true },
      createdAt: { type: Date, default: Date.now },
      revokedAt: { type: Date, default: null },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
