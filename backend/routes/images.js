const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');

// --- Multer Setup ---
// Configure multer for temporary file storage
const upload = multer({ dest: 'tmp/' });

// --- Python Script Runner ---
// (This is copied from image-previews.js - consider refactoring to a shared utility)
const runMosaicScript = (inputPath) => {
  return new Promise((resolve, reject) => {
    const pythonBinary = process.env.IMAGE_PROCESSING_PYTHON_BINARY || 'python';
    const scriptPath = path.join(__dirname, '..', 'scripts', 'mosaic', 'mosaic_processor.py');
    const faceModelPath = path.join(__dirname, '..', 'models', 'face', 'yolov8n-face.pt');
    const plateModelPath = path.join(__dirname, '..', 'models', 'plate', 'plate-detector.pt');

    console.log('DEBUG: faceModelPath =', faceModelPath);
    console.log('DEBUG: plateModelPath =', plateModelPath);

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
        console.error(`[runMosaicScript] Python script exited with code ${code}`);
        console.error(errorOutput);
        return reject(new Error(`Image processing script failed with code ${code}. Error: ${errorOutput}`));
      }
      const delimiter = '---SPLIT---';
      const splitIndex = output.lastIndexOf(delimiter);
      if (splitIndex === -1) {
        console.error('[runMosaicScript] Missing delimiter in python output:', output);
        return reject(new Error('Unexpected output from python script.'));
      }

      const autoSection = output.slice(0, splitIndex).trim();
      const plateSection = output.slice(splitIndex + delimiter.length).trim();

      const autoBase64 = autoSection.split('\n').pop()?.trim();
      const plateBase64 = plateSection.split('\n').pop()?.trim();

      if (!autoBase64 || !plateBase64) {
        console.error('[runMosaicScript] Failed to parse base64 payloads:', output);
        return reject(new Error('Unexpected output from python script.'));
      }

      resolve({
        autoMosaicImage: `data:image/jpeg;base64,${autoBase64}`,
        plateVisibleImage: `data:image/jpeg;base64,${plateBase64}`,
      });
    });
  });
};


// --- Route Definition ---
// POST /api/images/upload
router.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  const tempFilePath = req.file.path;

  try {
    // Run the python script on the uploaded file
    const result = await runMosaicScript(tempFilePath);

    // Respond with the processed images
    res.status(200).json({
      autoMosaicImage: result.autoMosaicImage,
      plateVisibleImage: result.plateVisibleImage,
    });

  } catch (err) {
    console.error('Error during image upload processing:', err);
    res.status(500).json({ error: 'Failed to process image.' });
  } finally {
    // Clean up the temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupErr) {
      console.error('Failed to clean up temporary image file:', cleanupErr);
    }
  }
});

module.exports = router;
