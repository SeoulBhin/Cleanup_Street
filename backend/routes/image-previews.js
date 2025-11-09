const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const db = require('../db');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Function to run the python script
const runMosaicScript = (inputPath) => {
  return new Promise((resolve, reject) => {
    const pythonBinary = process.env.IMAGE_PROCESSING_PYTHON_BINARY || 'python';
    const scriptPath = path.join(__dirname, '..', 'scripts', 'mosaic', 'mosaic_processor.py');
    const faceModelPath = path.join(__dirname, '..', '..', 'models', 'face', 'yolov8n-face.pt');
    const plateModelPath = path.join(__dirname, '..', '..', 'models', 'plate', 'plate-detector.pt');

    const args = [
      scriptPath,
      '--input', inputPath,
      '--face-model', faceModelPath,
      '--plate-model', plateModelPath,
    ];

    const py = spawn(pythonBinary, args);

    let output = '';
    let errorOutput = '';

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
        return reject(new Error('Image processing script failed.'));
      }
      const results = output.trim().split('---SPLIT---');
      if (results.length !== 2) {
        return reject(new Error('Unexpected output from python script.'));
      }
      resolve({
        autoMosaicImage: `data:image/jpeg;base64,${results[0]}`,
        plateVisibleImage: `data:image/jpeg;base64,${results[1]}`,
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
    return res.status(400).json({ error: 'imageUrl is required' });
  }

  const tmpDir = path.join(__dirname, '..', 'tmp');
  const randomName = crypto.randomBytes(16).toString('hex');
  const tmpFilePath = path.join(tmpDir, `${randomName}.tmp`);
  let tempFileSaved = false;

  try {
    // Decode Base64 and write to a temporary file
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(tmpFilePath, buffer);
    tempFileSaved = true;

    const result = await runMosaicScript(tmpFilePath);

    // Save the preview to the database
    const query = `
      INSERT INTO image_previews (user_id, original_image_url, auto_mosaic_image, plate_visible_image, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, auto_mosaic_image, plate_visible_image;
    `;
    // Storing the full base64 URL in original_image_url might be too large.
    // Consider storing a reference or a smaller version if this becomes an issue.
    const values = [userId, imageUrl, result.autoMosaicImage, result.plateVisibleImage];
    const { rows } = await db.query(query, values);
    const preview = rows[0];

    res.status(201).json({
      previewId: preview.id,
      autoMosaicImage: preview.auto_mosaic_image,
      plateVisibleImage: preview.plate_visible_image,
    });

  } catch (err) {
    console.error('Error during image preview creation:', err);
    res.status(500).json({ error: 'Failed to process image' });
  } finally {
    // Clean up the temporary file
    if (tempFileSaved) {
      try {
        await fs.unlink(tmpFilePath);
      } catch (cleanupErr) {
        console.error('Failed to clean up temporary image file:', cleanupErr);
      }
    }
  }
});

module.exports = router;
