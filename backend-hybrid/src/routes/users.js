const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { generalLimiter, keyLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const { publicKeySchema } = require("../validation/schemas");
const {
  uploadPublicKey,
  getPublicKey,
  revokePublicKey,
} = require("../controllers/usersController");

// POST /users/public-key - Store user's public key
router.post("/public-key", keyLimiter, authMiddleware, validate(publicKeySchema), uploadPublicKey);

// GET /users/public-key?email= - Get receiver's public key
router.get("/public-key", generalLimiter, authMiddleware, getPublicKey);

// PUT /users/public-key - Revoke and update user's public key
router.put("/public-key", keyLimiter, authMiddleware, validate(publicKeySchema), revokePublicKey);

module.exports = router;
