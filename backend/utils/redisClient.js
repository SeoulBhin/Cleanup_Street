const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
});

redis.on("ready", () => console.log("✅ Redis connected"));
redis.on("error", (err) =>
  console.error("❌ Redis connection error:", err?.message || err)
);
redis.on("close", () => console.warn("⚠️ Redis connection closed"));

async function pingRedis(timeoutMs = 500) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("PING timeout")), timeoutMs)
  );
  const ping = redis.ping().then((res) => res === "PONG");
  return Promise.race([ping, timeout]);
}

module.exports = { redis, pingRedis };
