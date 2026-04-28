const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { googleAuth, getSession, refresh, logout } = require("../controllers/authController");
const { authLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const { googleAuthSchema } = require("../validation/schemas");

// POST /auth/google
router.post("/google", authLimiter, validate(googleAuthSchema), googleAuth);

// GET /auth/session
router.get("/session", authMiddleware, getSession);

// POST /auth/refresh
router.post("/refresh", refresh);

// POST /auth/logout
router.post("/logout", logout);

module.exports = router;
