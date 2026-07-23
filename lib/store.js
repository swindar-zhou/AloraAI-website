/**
 * Shared storage + helpers for AloraAI sign-ups.
 *
 * Used by both the local dev server (server.js) and the Vercel serverless
 * functions (api/*.js), so the logic lives in exactly one place.
 *
 * Storage backend:
 *   - Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
 *   - Local SQLite file otherwise (used only for local dev / fallback).
 * On Vercel the env vars are set, so it always uses Supabase (the filesystem
 * is read-only/ephemeral there, so SQLite is never touched).
 */

'use strict';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

const COLUMNS = ['name', 'email', 'organization', 'location', 'linkedin', 'created_at', 'user_agent', 'ip'];

// --- backends ---------------------------------------------------------------
function makeSupabaseStore() {
  const base = `${SUPABASE_URL}/rest/v1/signups`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  return {
    kind: 'supabase',
    async insert(record) {
      const res = await fetch(`${base}?on_conflict=email`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase insert failed (${res.status}): ${await res.text().catch(() => '')}`);
    },
    async list() {
      const res = await fetch(`${base}?select=*&order=created_at.desc`, { headers });
      if (!res.ok) throw new Error(`Supabase list failed (${res.status}): ${await res.text().catch(() => '')}`);
      return res.json();
    },
  };
}

function makeSqliteStore() {
  const path = require('node:path');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(__dirname, '..', 'signups.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      organization TEXT, location TEXT, linkedin TEXT,
      created_at TEXT NOT NULL, user_agent TEXT, ip TEXT
    );
  `);
  const INSERT_SQL = `INSERT INTO signups (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`;
  return {
    kind: 'sqlite',
    async insert(record) {
      try {
        db.prepare(INSERT_SQL).run(...COLUMNS.map((c) => record[c] ?? ''));
      } catch (err) {
        if (String(err.message).includes('UNIQUE')) return;
        throw err;
      }
    },
    async list() {
      return db.prepare('SELECT * FROM signups ORDER BY created_at DESC').all();
    },
  };
}

let _store;
function store() {
  if (!_store) _store = USE_SUPABASE ? makeSupabaseStore() : makeSqliteStore();
  return _store;
}

// --- helpers ----------------------------------------------------------------
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const clean = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Validate + normalize an incoming sign-up. Returns { ok, record } or { ok:false, error }. */
function buildRecord({ body, userAgent, ip }) {
  let p = body;
  if (typeof p === 'string') { try { p = JSON.parse(p || '{}'); } catch { return { ok: false, error: 'Invalid request.' }; } }
  p = p || {};
  const record = {
    name: clean(p.name, 200),
    email: clean(p.email, 320).toLowerCase(),
    organization: clean(p.organization, 300),
    location: clean(p.location, 200),
    linkedin: clean(p.linkedin, 500),
    created_at: new Date().toISOString(),
    user_agent: clean(userAgent, 400),
    ip: clean(ip, 100),
  };
  if (!record.name) return { ok: false, error: 'Please include your name.' };
  if (!isEmail(record.email)) return { ok: false, error: 'Please include a valid email.' };
  return { ok: true, record };
}

async function insertSignup(record) { return store().insert(record); }
async function listSignups() { return store().list(); }
function storeKind() { return USE_SUPABASE ? 'supabase' : 'sqlite'; }

function renderAdminHtml(rows, token) {
  const cell = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const trs = rows.map((r) => `
    <tr><td>${cell(r.created_at)}</td><td>${cell(r.name)}</td><td>${cell(r.email)}</td>
    <td>${cell(r.organization)}</td><td>${cell(r.location)}</td><td>${cell(r.linkedin)}</td></tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>Sign-ups (${rows.length})</title>
    <style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;margin:40px;color:#201e1d}
    h1{font-size:22px}table{border-collapse:collapse;width:100%;margin-top:16px}
    th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #ddd;vertical-align:top}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666}
    .src{color:#888;font-size:12px}a.dl{display:inline-block;margin-top:12px}</style>
    <h1>Clinician sign-ups <span style="color:#888">(${rows.length})</span></h1>
    <p class="src">storage: ${storeKind()}</p>
    <a class="dl" href="/admin/export.csv?token=${encodeURIComponent(token)}">Download CSV &darr;</a>
    <table><thead><tr><th>When</th><th>Name</th><th>Email</th><th>Organization</th><th>Location</th><th>LinkedIn</th></tr></thead>
    <tbody>${trs || '<tr><td colspan="6" style="color:#888">No sign-ups yet.</td></tr>'}</tbody></table>`;
}

function toCsv(rows) {
  const headers = ['name', 'email', 'organization', 'location', 'linkedin', 'created_at'];
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  return lines.join('\n');
}

module.exports = {
  USE_SUPABASE, SUPABASE_URL, storeKind,
  buildRecord, insertSignup, listSignups, renderAdminHtml, toCsv,
};
