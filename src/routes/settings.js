const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/settings — any authenticated user can read public settings
// Used by Manager dashboard to get the response_time_limit
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT `key`, value FROM admin_settings');
    const settingsMap = {};
    rows.forEach(s => { settingsMap[s.key] = s.value; });
    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ message: 'Error fetching settings.' });
  }
});

module.exports = router;
