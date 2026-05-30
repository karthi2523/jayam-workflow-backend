const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { canTransition } = require('../utils/workflowEngine');

router.use(verifyToken);

router.post('/', async (req, res) => {
  const { title, description, category, priority } = req.body;
  
  if (!title || !description || !category || !priority) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO requests (title, description, category, priority, user_id, status)
       VALUES (?, ?, ?, ?, ?, 'Submitted')`,
      [title, description, category, priority, req.user.id]
    );

    await pool.query(
      `INSERT INTO request_logs (request_id, new_status, changed_by, role, comment)
       VALUES (?, 'Submitted', ?, ?, 'Request created')`,
      [result.insertId, req.user.id, req.user.role]
    );

    res.status(201).json({ message: 'Request created', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating request' });
  }
});

router.get('/my-requests', requireRole('User'), async (req, res) => {
  try {
    const [requests] = await pool.query(
      'SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests' });
  }
});

router.get('/', requireRole('Manager', 'Admin'), async (req, res) => {
  const { status, category } = req.query;
  
  try {
    let query = `
      SELECT r.*, u.name as user_name 
      FROM requests r 
      JOIN users u ON r.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    
    if (category) {
      query += ' AND r.category = ?';
      params.push(category);
    }

    query += ' ORDER BY r.created_at DESC';

    const [requests] = await pool.query(query, params);
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching requests' });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const [logs] = await pool.query(
      `SELECT l.*, u.name as user_name 
       FROM request_logs l 
       JOIN users u ON l.changed_by = u.id 
       WHERE l.request_id = ? 
       ORDER BY l.timestamp DESC`,
      [req.params.id]
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, comment } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'New status is required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [id]);
    const request = rows[0];
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (req.user.role === 'User' && request.user_id !== req.user.id) {
       return res.status(403).json({ message: 'Forbidden' });
    }

    if (!canTransition(request.status, status, req.user.role)) {
      return res.status(403).json({ 
        message: `Invalid transition from ${request.status} to ${status} for role ${req.user.role}` 
      });
    }

    await pool.query(
      'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    await pool.query(
      `INSERT INTO request_logs (request_id, old_status, new_status, changed_by, role, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, request.status, status, req.user.id, req.user.role, comment || '']
    );

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating status' });
  }
});

module.exports = router;
