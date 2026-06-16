const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
}

const WebSocket = require('ws');

// Polyfill global WebSocket for Supabase Realtime in Node < 22
global.WebSocket = WebSocket;

const supabase = createClient(
  supabaseUrl ,
  supabaseServiceKey,
  { auth: { persistSession: false } }
);

module.exports = { supabase };
