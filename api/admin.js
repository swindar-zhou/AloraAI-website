// GET /admin?token=... — HTML dashboard of sign-ups (rewritten from /admin).
'use strict';

const { listSignups, renderAdminHtml } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.query.token !== process.env.ADMIN_TOKEN) {
    return res.status(401).send('Unauthorized — append ?token=YOUR_ADMIN_TOKEN');
  }
  try {
    const rows = await listSignups();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderAdminHtml(rows, process.env.ADMIN_TOKEN));
  } catch (err) {
    console.error('admin list failed:', err.message);
    return res.status(500).send('Server error.');
  }
};
