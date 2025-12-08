const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  // Default to the current EC2 public IP so the app keeps working if env vars are missing.
  host: process.env.DB_HOST || '52.63.57.185',
  database: process.env.DB_DATABASE || 'cleanup',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5433,
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
