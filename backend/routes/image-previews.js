const express = require('express');
const router = express.Router();
const { spawn } = require("child_process");
const db = require("../db");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const fetch = require("node-fetch");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function downloadOrDecodeToFile(src, prefix = "upload") {
  await ensureUploadDir();
  const filename = `${prefix}-${crypto.randomBytes(8).toString("hex")}.jpg`;
  const destPath = path.join(UPLOAD_DIR, filename);

  // data URI
  if (src.startsWith("data:")) {
    const base64 = src.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    await fs.writeFile(destPath, buf);
    return destPath;
  }

  // http(s) URL
  if (src.startsWith("http")) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    await fs.writeFile(destPath, buf);
    return destPath;
  }

  throw new Error("Unsupported image source (expected data URI or http URL)");
}

async function saveBase64ToUploads(base64Payload, suffix) {
  await ensureUploadDir();
  const filename = `${suffix}-${crypto.randomBytes(8).toString("hex")}.jpg`;
  const destPath = path.join(UPLOAD_DIR, filename);
  const base64 = base64Payload.replace(/^data:image\/\w+;base64,/, "");
  const buf = Buffer.from(base64, "base64");
  await fs.writeFile(destPath, buf);
  return destPath;
}

function toPublicUrl(req, filePath) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const basename = path.basename(filePath);
  return `${proto}://${host}/uploads/${basename}`;
}

// Function to run the python script
const runMosaicScript = (inputPath) => {
  return new Promise((resolve, reject) => {
    const pythonBinary =
      process.env.IMAGE_PROCESSING_PYTHON_BINARY || "python";
    const scriptPath = path.join(
      __dirname,
      "..",
      "scripts",
      "mosaic",
      "mosaic_processor.py"
    );
    const faceModelPath = path.join(
      __dirname,
      "..",
      "models",
      "face",
      "yolov8n-face.pt"
    );
    const plateModelPath = path.join(
      __dirname,
      "..",
      "models",
      "plate",
      "plate-detector.pt"
    );

    console.log("DEBUG: faceModelPath =", faceModelPath);
    console.log("DEBUG: plateModelPath =", plateModelPath);

    const args = [
      scriptPath,
      "--input",
      inputPath,
      "--face-model",
      faceModelPath,
      "--plate-model",
      plateModelPath,
    ];

    const py = spawn(pythonBinary, args);

    let output = "";
    let errorOutput = "";

    py.stdout.on('data', (data) => {
      output += data.toString();
    });

    py.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    py.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        console.error(errorOutput);
        return reject(new Error("Image processing script failed."));
      }
      const delimiter = "---SPLIT---";
      const splitIndex = output.lastIndexOf(delimiter);
      if (splitIndex === -1) {
        console.error(
          "[runMosaicScript] Missing delimiter in python output:",
          output
        );
        return reject(new Error("Unexpected output from python script."));
      }

      const autoSection = output.slice(0, splitIndex).trim();
      const plateSection = output.slice(splitIndex + delimiter.length).trim();

      const autoBase64 = autoSection.split('\n').pop()?.trim();
      const plateBase64 = plateSection.split('\n').pop()?.trim();

      if (!autoBase64 || !plateBase64) {
        console.error(
          "[runMosaicScript] Failed to parse base64 payloads:",
          output
        );
        return reject(new Error("Unexpected output from python script."));
      }

      resolve({
        autoMosaicImage: `data:image/jpeg;base64,${autoBase64}`,
        plateVisibleImage: `data:image/jpeg;base64,${plateBase64}`,
      });
    });
  });
};


// POST /api/image-previews
router.post('/', async (req, res) => {
  // For testing purposes, default userId to 1 if not provided.
  const userId = req.body.userId || 1;
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  const tmpDir = path.join(__dirname, "..", "tmp");
  const randomName = crypto.randomBytes(16).toString("hex");
  const previewId = crypto.randomUUID();
  const tmpFilePath = path.join(tmpDir, `${randomName}.tmp`);
  let tempFileSaved = false;

  try {
    // 1) 입력 이미지(data URI 또는 URL)를 파일로 저장
    let sourcePath = null;
    if (imageUrl.startsWith("data:") || imageUrl.startsWith("http")) {
      sourcePath = await downloadOrDecodeToFile(imageUrl, "source");
    } else {
      // 업로드된 /uploads/... 같은 경로는 바로 활용
      sourcePath = path.join(
        __dirname,
        "..",
        imageUrl.startsWith("/uploads/")
          ? imageUrl.replace(/^\//, "")
          : imageUrl
      );
    }

    tempFileSaved = true;

    // 2) 파이썬으로 모자이크 처리 (base64 두 장 반환)
    const result = await runMosaicScript(sourcePath);

    // 3) base64를 파일로 저장하고 URL 생성
    const autoPath = await saveBase64ToUploads(result.autoMosaicImage, "auto");
    const platePath = await saveBase64ToUploads(
      result.plateVisibleImage,
      "plate"
    );
    const autoUrl = toPublicUrl(req, autoPath);
    const plateUrl = toPublicUrl(req, platePath);

    // 4) DB에 URL만 저장
    const query = `
      INSERT INTO image_previews (preview_id, user_id, original_image_url, auto_mosaic_image, plate_visible_image, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING preview_id, auto_mosaic_image, plate_visible_image;
    `;
    const values = [previewId, userId, imageUrl, autoUrl, plateUrl];
    const { rows } = await db.query(query, values);
    const preview = rows[0];

    res.status(201).json({
      previewId: preview.preview_id,
      autoMosaicImage: preview.auto_mosaic_image,
      plateVisibleImage: preview.plate_visible_image,
    });
  } catch (err) {
    console.error("Error during image preview creation:", err);
    res.status(500).json({ error: "Failed to process image" });
  } finally {
    // Clean up the temporary file
    if (tempFileSaved) {
      try {
        await fs.unlink(tmpFilePath);
      } catch (cleanupErr) {
        console.error("Failed to clean up temporary image file:", cleanupErr);
      }
    }
  }
});

module.exports = router;
