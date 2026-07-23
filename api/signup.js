// POST /api/signup — records a clinician sign-up (Vercel serverless function).
'use strict';

const { buildRecord, insertSignup } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const { ok, record, error } = buildRecord({
    body: req.body,
    userAgent: req.headers['user-agent'],
    ip,
  });
  if (!ok) return res.status(400).json({ error });

  try {
    await insertSignup(record);
  } catch (err) {
    console.error('signup insert failed:', err.message);
    return res.status(500).json({ error: 'Could not save your sign-up. Please try again.' });
  }
  return res.status(200).json({ ok: true });
};
