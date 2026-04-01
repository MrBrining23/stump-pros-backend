require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    console.log('Running database schema...');
    await pool.query(schema);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
