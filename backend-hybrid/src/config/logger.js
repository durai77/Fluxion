const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "body.credential",
      "body.password",
      "body.refreshToken",
      "body.privateKey",
      "token",
      "refreshToken",
    ],
    censor: "[REDACTED]",
  },
});

module.exports = logger;
