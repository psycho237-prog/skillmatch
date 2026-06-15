const { query } = require('../config/database');

const requireSuperadmin = async (req, res, next) => {
  try {
    const userId = req.user.id; // requires authMiddleware to have run first
    const result = await query('SELECT role, status FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is ' + user.status });
    }
    
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden: Superadmin access required' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during authorization check' });
  }
};

/**
 * Log an admin action to the database
 */
const logAdminAction = async (adminId, action, targetId, targetType, details = {}) => {
  try {
    await query(
      'INSERT INTO admin_logs (admin_id, action, target_id, target_type, details) VALUES ($1, $2, $3, $4, $5)',
      [adminId, action, targetId, targetType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
};

module.exports = { requireSuperadmin, logAdminAction };
