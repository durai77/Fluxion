const Redis = require("ioredis");
const logger = require("./logger");

const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

module.exports = redis;
