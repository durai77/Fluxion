const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const redis = require("../config/redis");
const logger = require("../config/logger");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge,
  };
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

function signAccessToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

async function setRefreshToken(userId, refreshToken) {
  const hashedRefresh = hashRefreshToken(refreshToken);
  await redis.setex(`refresh:${hashedRefresh}`, REFRESH_TOKEN_TTL_SECONDS, userId.toString());
}

async function issueAuthCookies(res, userId) {
  // Access tokens are short-lived JWTs used only by the server through an
  // httpOnly cookie, reducing impact if browser JavaScript is compromised.
  const accessToken = signAccessToken(userId);

  // Refresh tokens are high-entropy random values. Only a SHA-256 hash is kept
  // in Redis, allowing server-side revocation without storing the raw secret.
  const refreshToken = crypto.randomBytes(64).toString("hex");
  await setRefreshToken(userId, refreshToken);

  res.cookie("accessToken", accessToken, cookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie("refreshToken", refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE_MS));
  res.clearCookie("token", cookieOptions(0));
}

// POST /auth/google
const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: "Credential is required" });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    if (!email) {
      return res.status(400).json({ error: "Email not found in token" });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await User.create({ email });
      isNewUser = true;
    }

    await issueAuthCookies(res, user._id);
    logger.info({ userId: user._id.toString(), isNewUser }, "User authenticated");

    res.json({
      isNewUser,
      userId: user._id.toString(),
    });
  } catch (error) {
    logger.warn({ err: error }, "Google authentication failed");
    res.status(401).json({ error: "Authentication failed" });
  }
};

const getSession = async (req, res) => {
  res.json({ userId: req.userId });
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    const hashedRefresh = hashRefreshToken(refreshToken);
    const redisKey = `refresh:${hashedRefresh}`;
    const userId = await redis.get(redisKey);

    if (!userId) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    await redis.del(redisKey);
    await issueAuthCookies(res, userId);
    logger.info({ userId }, "Refresh token rotated");
    res.json({ userId });
  } catch (error) {
    logger.warn({ err: error }, "Token refresh failed");
    res.status(401).json({ error: "Token refresh failed" });
  }
};

const logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    await redis.del(`refresh:${hashRefreshToken(refreshToken)}`);
  }

  res.clearCookie("accessToken", cookieOptions(0));
  res.clearCookie("refreshToken", cookieOptions(0));
  res.clearCookie("token", cookieOptions(0));
  res.status(204).send();
};

module.exports = { googleAuth, getSession, refresh, logout };
