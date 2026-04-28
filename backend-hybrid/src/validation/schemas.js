const { z } = require("zod");

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");
const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, "Invalid base64 value");

const googleAuthSchema = z.object({
  credential: z.string().min(20).max(10000),
});

const publicKeySchema = z.object({
  publicKey: z.string().min(100).max(10000),
});

const sendFileSchema = z.object({
  receiverId: objectId,
  encryptedAESKey: base64.min(50).max(2000),
  nonce: base64.min(16).max(32),
  authTag: base64.min(16).max(50),
  signature: base64.min(50).max(2000),
  senderPublicKey: z.string().min(100).max(5000),
  maxDownloads: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int().min(1).max(1000).nullable()),
  expiresInDays: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.number().int().min(1).max(365).nullable()),
});

const shareFileSchema = z.object({
  expiresIn: z.enum(["1h", "24h", "7d", "never"]).default("24h"),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
  maxDownloads: z.number().int().min(1).max(1000).nullable().optional(),
});

const webrtcTokenSchema = z.object({
  peerId: z.string().min(6).max(64).optional(),
});

module.exports = {
  objectId,
  googleAuthSchema,
  publicKeySchema,
  sendFileSchema,
  shareFileSchema,
  webrtcTokenSchema,
};
