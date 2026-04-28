const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { generalLimiter } = require("../middleware/rateLimiter");
const { createPeerToken } = require("../controllers/webrtcController");
const { webrtcTokenSchema } = require("../validation/schemas");

router.post("/token", generalLimiter, authMiddleware, validate(webrtcTokenSchema), createPeerToken);

module.exports = router;
