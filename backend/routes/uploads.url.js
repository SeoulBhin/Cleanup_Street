const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

const router = express.Router();

// 서버 uploads 경로 (server.js와 동일하게 계산)
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function toPublicUrl(req, filename) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}/uploads/${filename}`;
}

router.post("/", async (req, res) => {
  try {
    const { sourceUrl } = req.body || {};
    if (!sourceUrl || typeof sourceUrl !== "string") {
      return res.status(400).json({ message: "sourceUrl is required" });
    }

    // 기본 확장자 추정
    const lower = sourceUrl.toLowerCase();
    let ext = ".jpg";
    if (lower.includes(".png")) ext = ".png";
    else if (lower.includes(".webp")) ext = ".webp";
    else if (lower.includes(".gif")) ext = ".gif";

    // 파일명 생성 후 다운로드
    await ensureUploadDir();
    const filename = `${crypto.randomBytes(8).toString("hex")}${ext}`;
    const dest = path.join(UPLOAD_DIR, filename);

    const resp = await fetch(sourceUrl);
    if (!resp.ok) {
      return res
        .status(502)
        .json({ message: "Failed to fetch sourceUrl", status: resp.status });
    }

    const arrayBuf = await resp.arrayBuffer();
    await fs.writeFile(dest, Buffer.from(arrayBuf));

    const url = toPublicUrl(req, filename);
    res.json({ urls: [url] });
  } catch (err) {
    console.error("[uploads:url] error:", err);
    res.status(500).json({ message: "Failed to download and save image" });
  }
});

module.exports = router;
