const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// All admin routes require authentication and Admin role
router.use(verifyToken);
router.use(requireRole('Admin'));

// ──────────────────────────────────────────────
//  MANAGER MANAGEMENT
// ──────────────────────────────────────────────

// GET /api/admin/managers — list all managers
router.get('/managers', async (req, res) => {
  try {
    const [managers] = await pool.query(
      `SELECT id, name, email, is_active, created_at
       FROM users
       WHERE role = 'Manager'
       ORDER BY created_at DESC`
    );
    res.json(managers);
  } catch (error) {
    console.error('Error fetching managers:', error);
    res.status(500).json({ message: 'Error fetching managers.' });
  }
});

// PATCH /api/admin/managers/:id/toggle — enable or disable a manager
router.patch('/managers/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, name, is_active, role FROM users WHERE id = ? AND role = 'Manager'`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Manager not found.' });
    }
    const manager = rows[0];
    const newStatus = manager.is_active === 1 ? 0 : 1;
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);
    res.json({
      message: `Manager ${newStatus === 1 ? 'enabled' : 'disabled'} successfully.`,
      is_active: newStatus
    });
  } catch (error) {
    console.error('Error toggling manager:', error);
    res.status(500).json({ message: 'Error updating manager status.' });
  }
});

// POST /api/admin/managers — create a new Manager account
router.post('/managers', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'Manager', 1]
    );

    res.status(201).json({
      message: 'Manager account created successfully.',
      manager: { id: result.insertId, name, email, is_active: 1, role: 'Manager' }
    });
  } catch (error) {
    console.error('Error creating manager:', error);
    res.status(500).json({ message: 'Error creating manager account.' });
  }
});

// ──────────────────────────────────────────────
//  ADMIN SETTINGS
// ──────────────────────────────────────────────

// GET /api/admin/settings — fetch all settings
router.get('/settings', async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT `key`, value FROM admin_settings');
    // Convert array to key-value object for easy frontend consumption
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching settings.' });
  }
});

// PUT /api/admin/settings — update one or more settings
router.put('/settings', async (req, res) => {
  const updates = req.body; // e.g. { response_time_limit: '30', response_time_unit: 'minutes' }
  if (!updates || typeof updates !== 'object' || !Object.keys(updates).length) {
    return res.status(400).json({ message: 'No settings provided.' });
  }

  try {
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        'INSERT INTO admin_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
        [key, value, value]
      );
    }
    res.json({ message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error saving settings.' });
  }
});

module.exports = router;
