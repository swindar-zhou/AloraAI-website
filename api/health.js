// GET /api/health — diagnostic. Reports which env vars are present (booleans
// only, never the values) and which storage backend is active. Safe to expose.
'use strict';

const { storeKind } = require('../lib/store');

module.exports = (req, res) => {
  res.status(200).json({
    storeKind: storeKind(),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasSupabaseKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
    hasAdminToken: Boolean(process.env.ADMIN_TOKEN),
    nodeVersion: process.version,
  });
};
