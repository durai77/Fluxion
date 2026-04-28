require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");
const connectDB = require("./config/db");
const logger = require("./config/logger");

const requiredEnv = [
  "MONGODB_URI",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "FRONTEND_URL",
  "REDIS_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing env var: ${key}`);
  }
});

if (process.env.FRONTEND_URL === "*") {
  throw new Error("FRONTEND_URL must be an exact origin when credentials are enabled");
}

// Import routes
const { generalLimiter } = require("./middleware/rateLimiter");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const filesRoutes = require("./routes/files");
const shareRoutes = require("./routes/share");
const webrtcRoutes = require("./routes/webrtc");

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Share-Password"],
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://accounts.google.com"],
        connectSrc: ["'self'", "https://accounts.google.com"],
        frameSrc: ["https://accounts.google.com"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);
app.use(
  pinoHttp({
    logger,
    redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Routes
app.use("/v1/auth", authRoutes);
app.use("/v1/users", usersRoutes);
app.use("/v1/files", filesRoutes);
app.use("/v1/share", shareRoutes);
app.use("/v1/webrtc", webrtcRoutes);

// Health check
app.get("/v1/health", (req, res) => {
  res.json({ status: "ok", message: "Zero-Trust Backend Running" });
});

// Error handler
app.use((err, req, res, next) => {
  req.log?.error({ err }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server running");
});
