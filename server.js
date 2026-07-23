/**
 * AloraAI — local dev server.
 *
 * Serves the static site from public/ and handles the sign-up + admin routes
 * using the SAME logic as the Vercel functions (see lib/store.js). On Vercel
 * this file isn't used — the api/*.js functions are. Run locally with:
 *
 *   npm start          (loads .env, uses Supabase if configured, else SQLite)
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  buildRecord, insertSignup, listSignups, renderAdminHtml, toCsv, storeKind, SUPABASE_URL, USE_SUPABASE,
} = require('./lib/store');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(12).toString('hex');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const authed = (url) => url.searchParams.get('token') === ADMIN_TOKEN;

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    if (req.method === 'POST' && pathname === '/api/signup') {
      const { ok, record, error } = buildRecord({ body: await readBody(req), userAgent: req.headers['user-agent'], ip: clientIp(req) });
      if (!ok) return sendJSON(res, 400, { error });
      try { await insertSignup(record); } catch (e) { console.error('signup failed:', e.message); return sendJSON(res, 500, { error: 'Could not save your sign-up. Please try again.' }); }
      console.log(`[signup] ${record.name} <${record.email}>`);
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'GET' && pathname === '/admin') {
      if (!authed(url)) { res.writeHead(401); return res.end('Unauthorized — append ?token=YOUR_ADMIN_TOKEN'); }
      const rows = await listSignups();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderAdminHtml(rows, ADMIN_TOKEN));
    }

    if (req.method === 'GET' && pathname === '/admin/export.csv') {
      if (!authed(url)) { res.writeHead(401); return res.end('Unauthorized — append ?token=YOUR_ADMIN_TOKEN'); }
      const rows = await listSignups();
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="alora-signups.csv"' });
      return res.end(toCsv(rows));
    }

    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
    res.writeHead(405); res.end('Method not allowed');
  } catch (err) {
    console.error('request error:', err.message);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  AloraAI running → http://localhost:${PORT}`);
  console.log(`  Storage backend → ${storeKind()}${USE_SUPABASE ? ` (${SUPABASE_URL})` : ' (local signups.db)'}`);
  console.log(`  Sign-ups admin  → http://localhost:${PORT}/admin?token=${ADMIN_TOKEN}`);
  console.log(`  CSV export      → http://localhost:${PORT}/admin/export.csv?token=${ADMIN_TOKEN}`);
  if (!process.env.ADMIN_TOKEN) console.log(`\n  (ADMIN_TOKEN not set — generated one for this run.)\n`);
});
