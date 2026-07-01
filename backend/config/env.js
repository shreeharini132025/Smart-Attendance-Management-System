/**
 * env.js - loads .env file via dotenv if available
 * Falls back gracefully in production where env vars are set externally (Render, etc.)
 */
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  // In production (Render, Vercel), env vars are injected by the platform
  require('dotenv').config();
}
