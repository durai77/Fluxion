const express = require("express");
const router = express.Router();
const { downloadLimiter } = require("../middleware/rateLimiter");
const { accessShareLink } = require("../controllers/filesController");

// GET /share/:token - Access a time-limited share link
router.get("/:token", downloadLimiter, accessShareLink);

module.exports = router;
