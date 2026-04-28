const crypto = require("crypto");
const AuditLog = require("../models/AuditLog");

function stableStringify(value) {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function hashEntry(entry) {
  return crypto.createHash("sha256").update(stableStringify(entry)).digest("hex");
}

async function recordAuditLog({ fileId, actorId, action, ip, userAgent, metadata = {} }) {
  const previous = await AuditLog.findOne({ fileId }).sort({ createdAt: -1 }).select("entryHash");
  const previousHash = previous?.entryHash || null;
  const entry = {
    fileId: fileId.toString(),
    actorId: actorId ? actorId.toString() : null,
    action,
    ip,
    userAgent,
    metadata,
    previousHash,
    createdAt: new Date().toISOString(),
  };

  return AuditLog.create({
    ...entry,
    previousHash,
    entryHash: hashEntry(entry),
  });
}

module.exports = { recordAuditLog };
