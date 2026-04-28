const crypto = require("crypto");

function extractSigningPublicKey(publicKey) {
  try {
    const parsed = JSON.parse(publicKey);
    return parsed.signing || publicKey;
  } catch {
    return publicKey;
  }
}

function getPublicKeyFingerprint(publicKey) {
  return crypto
    .createHash("sha256")
    .update(extractSigningPublicKey(publicKey))
    .digest("hex");
}

module.exports = {
  extractSigningPublicKey,
  getPublicKeyFingerprint,
};
