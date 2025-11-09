const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).send('API OK');
});

const postRoutes = require('./routes/posts');

const imagePreviewRoutes = require('./routes/image-previews');
const imageRoutes = require('./routes/images');

app.use('/api/posts', postRoutes);
app.use('/api/image-previews', imagePreviewRoutes);
app.use('/api/images', imageRoutes);

/*
app.get('/api/system/demo-user', async (req, res) => {
  try {
    const db = require('./db');
    const { rows } = await db.query('SELECT user_id FROM users WHERE username = $1', ['demo-user']);
    if (rows.length === 0) {
      // This is for the case where the demo user might not be created yet.
      // The original Spring Boot code created it on startup. We'll need a similar mechanism.
      // For now, let's try to create it if it doesn't exist.
      const { rows: newRows } = await db.query(
        "INSERT INTO users (username, email, password, role, created_at) VALUES ('demo-user', 'demo@example.com', 'password', 'USER', NOW()) ON CONFLICT (username) DO NOTHING RETURNING user_id;"
      );
      if (newRows.length > 0) {
        return res.json({ userId: newRows[0].user_id });
      }
      // If it still doesn't exist, query again.
      const { rows: finalRows } = await db.query('SELECT user_id FROM users WHERE username = $1', ['demo-user']);
      if (finalRows.length === 0) {
        return res.status(404).json({ error: 'Demo user not found and could not be created.' });
      }
      return res.json({ userId: finalRows[0].user_id });
    }
    res.json({ userId: rows[0].user_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get demo user' });
  }
});
*/

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
