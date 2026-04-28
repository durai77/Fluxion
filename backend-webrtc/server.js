require("dotenv").config();
const jwt = require("jsonwebtoken");
const pino = require("pino");
const { PeerServer } = require("peer");

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const PORT = process.env.PORT || 9000;

["JWT_SECRET", "FRONTEND_URL"].forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing env var: ${key}`);
  }
});

if (process.env.FRONTEND_URL === "*") {
  throw new Error("FRONTEND_URL must be an exact origin");
}

const peerServer = PeerServer({
  port: PORT,
  host: "0.0.0.0",
  path: "/",
  allow_discovery: false,
  concurrent_limit: 5000,
  alive_timeout: 90000,
  expire_timeout: 5000,
  corsOptions: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

peerServer.on("connection", (client) => {
  const peerId = client.getId();
  const token = typeof client.getToken === "function" ? client.getToken() : null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.peerId !== peerId) {
      throw new Error("Peer ID mismatch");
    }

    logger.info({ peerId, userId: payload.userId }, "Peer connected");
  } catch (err) {
    logger.warn({ err, peerId }, "Rejected unauthenticated peer");
    client.getSocket()?.close();
  }
});

peerServer.on("disconnect", (client) => {
  logger.info({ peerId: client.getId() }, "Peer disconnected");
});

logger.info({ port: PORT }, "PeerJS server running");
