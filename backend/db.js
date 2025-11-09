const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || '3.24.168.37',
  database: process.env.DB_DATABASE || 'cleanup',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5433,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
