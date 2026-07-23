// GET /admin/export.csv?token=... — CSV export (rewritten from /admin/export.csv).
'use strict';

const { listSignups, toCsv } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.query.token !== process.env.ADMIN_TOKEN) {
    return res.status(401).send('Unauthorized — append ?token=YOUR_ADMIN_TOKEN');
  }
  try {
    const rows = await listSignups();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="alora-signups.csv"');
    return res.status(200).send(toCsv(rows));
  } catch (err) {
    console.error('csv export failed:', err.message);
    return res.status(500).send('Server error.');
  }
};
