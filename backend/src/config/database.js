const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skillmatch',
  user: process.env.DB_USER || 'skillmatch_user',
  password: process.env.DB_PASSWORD || 'skillmatch123',
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Helper function for quick querying
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
