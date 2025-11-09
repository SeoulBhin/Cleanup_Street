const express = require('express');
const router = express.Router();
const db = require('../db');

// GET a single post by ID
router.get('/:postId', async (req, res) => {
  const { postId } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CREATE a new post
router.post('/', async (req, res) => {
  // For testing, default userId to 1 if not provided
  const userId = req.body.userId || 1;
  const { title, postBody, category, latitude, longitude, h3Index, previewId } = req.body;

  if (!title || !postBody || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // In a real app, you would also handle the image processing and linking here,
    // likely using the previewId to fetch the processed image data.
    // For now, we'll just insert the post text data.

    const location = (latitude && longitude) ? `SRID=4326;POINT(${longitude} ${latitude})` : null;

    const query = `
      INSERT INTO posts (user_id, title, content, category, location, h3_index, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *;
    `;
    
    const values = [
      userId,
      title,
      postBody,
      category,
      location,
      h3Index,
      previewId ? 'PROCESSING' : 'DONE' // Set status based on image presence
    ];

    const { rows } = await db.query(query, values);
    
    // Here you would typically associate the images from the preview table with the new post
    // and then mark the preview as 'used'.

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

module.exports = router;
