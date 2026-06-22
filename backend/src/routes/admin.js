const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requireSuperadmin, logAdminAction } = require('../middleware/admin');
const { sendPushNotification } = require('../config/notifications');
const { logWalletTransaction } = require('../config/wallet'); // need to import or reimplement, let's just use raw query for manual credit

router.use(authenticateToken);
router.use(requireSuperadmin);

// ==========================================
// 1. PARAMÈTRES ET STATISTIQUES GLOBALES
// ==========================================
router.get('/settings', async (req, res) => {
  try {
    const { rows } = await query('SELECT setting_key, setting_value, description FROM platform_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    if (!settings['commission_percentage']) settings['commission_percentage'] = 5.0;
    if (!settings['pro_monthly_price']) settings['pro_monthly_price'] = 5000;
    if (!settings['pro_yearly_price']) settings['pro_yearly_price'] = 50000;
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Invalid settings' });

    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO platform_settings (setting_key, setting_value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/stats', async (req, res) => {
  try {
    // Users metrics
    const totalUsers = await query("SELECT count(*) FROM users");
    const newUsersToday = await query("SELECT count(*) FROM users WHERE created_at >= current_date");
    const newUsers7d = await query("SELECT count(*) FROM users WHERE created_at >= current_date - interval '7 days'");
    const newUsers30d = await query("SELECT count(*) FROM users WHERE created_at >= current_date - interval '30 days'");
    
    // Active users: 1 transaction this month
    const activeUsers = await query(`
      SELECT count(DISTINCT u.id) 
      FROM users u 
      JOIN transactions t ON (u.id = t.provider_id OR u.id = t.beneficiary_id OR u.id = t.initiator_id)
      WHERE t.created_at >= date_trunc('month', current_date)
    `);
    const suspendedUsers = await query("SELECT count(*) FROM users WHERE status = 'suspended'");

    // Transactions metrics
    const totalTx = await query("SELECT count(*) FROM transactions");
    const pendingTx = await query("SELECT count(*) FROM transactions WHERE status = 'pending'");
    const completedTx = await query("SELECT count(*) FROM transactions WHERE status = 'completed' OR status = 'confirmed'");
    const disputedTx = await query("SELECT count(*) FROM transactions WHERE status = 'disputed'");
    const cancelledTx = await query("SELECT count(*) FROM transactions WHERE status IN ('cancelled', 'expired')");

    // Pro Users and Featured Services
    const proUsersCountRes = await query(`SELECT count(*) FROM users WHERE subscription_tier = 'premium' AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW())`);
    const featuredServicesRes = await query(`SELECT count(*) FROM services WHERE is_featured = true AND (featured_until IS NULL OR featured_until > NOW()) AND deleted_at IS NULL`);

    // Commission metrics
    const platformRes = await query("SELECT balance, total_commissions, total_transactions FROM platform_account WHERE id = 1");
    const commissionsTotal = platformRes.rows[0]?.total_commissions || 0;
    
    const commToday = await query("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE type = 'commission' AND created_at >= current_date");
    const comm7d = await query("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE type = 'commission' AND created_at >= current_date - interval '7 days'");
    const comm30d = await query("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions WHERE type = 'commission' AND created_at >= current_date - interval '30 days'");

    res.json({
      users: {
        total: parseInt(totalUsers.rows[0].count),
        new_today: parseInt(newUsersToday.rows[0].count),
        new_7d: parseInt(newUsers7d.rows[0].count),
        new_30d: parseInt(newUsers30d.rows[0].count),
        active_this_month: parseInt(activeUsers.rows[0].count),
        suspended: parseInt(suspendedUsers.rows[0].count),
        pro_users: parseInt(proUsersCountRes.rows[0].count)
      },
      services: {
        featured: parseInt(featuredServicesRes.rows[0].count)
      },
      transactions: {
        total: parseInt(totalTx.rows[0].count),
        pending: parseInt(pendingTx.rows[0].count),
        completed: parseInt(completedTx.rows[0].count),
        disputed: parseInt(disputedTx.rows[0].count),
        cancelled: parseInt(cancelledTx.rows[0].count)
      },
      commissions: {
        total: parseFloat(commissionsTotal),
        today: parseFloat(commToday.rows[0].total),
        week: parseFloat(comm7d.rows[0].total),
        month: parseFloat(comm30d.rows[0].total)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. HISTORIQUE DES TRANSACTIONS
// ==========================================
router.get('/transactions', async (req, res) => {
  try {
    const { type, status, min_amount, max_amount, search, limit = 50, offset = 0 } = req.query;
    let queryStr = `
      SELECT t.*, 
        p.display_name as provider_name, p.phone_number as provider_phone,
        b.display_name as beneficiary_name, b.phone_number as beneficiary_phone
      FROM transactions t
      LEFT JOIN users p ON t.provider_id = p.id
      LEFT JOIN users b ON t.beneficiary_id = b.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (type) { queryStr += ` AND t.type = $${paramIdx++}`; params.push(type); }
    if (status) { queryStr += ` AND t.status = $${paramIdx++}`; params.push(status); }
    if (min_amount) { queryStr += ` AND t.amount >= $${paramIdx++}`; params.push(parseFloat(min_amount)); }
    if (max_amount) { queryStr += ` AND t.amount <= $${paramIdx++}`; params.push(parseFloat(max_amount)); }
    if (search) {
      queryStr += ` AND (p.display_name ILIKE $${paramIdx} OR b.display_name ILIKE $${paramIdx} OR t.id::text ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    queryStr += ` ORDER BY t.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryStr, params);
    
    // Also get total count for pagination
    const countQueryStr = queryStr.split('ORDER BY')[0].replace('SELECT t.*, \n        p.display_name as provider_name, p.phone_number as provider_phone,\n        b.display_name as beneficiary_name, b.phone_number as beneficiary_phone', 'SELECT count(*)');
    const countParams = params.slice(0, -2);
    const countRes = await query(countQueryStr, countParams);

    res.json({
      transactions: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions/:id', async (req, res) => {
  try {
    const tx = await query(`
      SELECT t.*, 
        p.display_name as provider_name, p.phone_number as provider_phone, p.avatar_url as provider_avatar,
        b.display_name as beneficiary_name, b.phone_number as beneficiary_phone, b.avatar_url as beneficiary_avatar
      FROM transactions t
      LEFT JOIN users p ON t.provider_id = p.id
      LEFT JOIN users b ON t.beneficiary_id = b.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (tx.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    
    const proofs = await query('SELECT * FROM transaction_proofs WHERE transaction_id = $1', [req.params.id]);
    
    res.json({ ...tx.rows[0], proofs: proofs.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. GESTION DES DÉPÔTS / RETRAITS
// ==========================================
router.get('/wallet-ops', async (req, res) => {
  try {
    const { type, status, search, limit = 50, offset = 0 } = req.query;
    let queryStr = `
      SELECT w.*, u.display_name as user_name, u.phone_number as user_phone
      FROM wallet_transactions w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.type IN ('deposit', 'withdrawal')
    `;
    const params = [];
    let paramIdx = 1;

    if (type) { queryStr += ` AND w.type = $${paramIdx++}`; params.push(type); }
    if (status) { queryStr += ` AND w.status = $${paramIdx++}`; params.push(status); }
    if (search) {
      queryStr += ` AND (u.display_name ILIKE $${paramIdx} OR u.phone_number ILIKE $${paramIdx} OR w.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    queryStr += ` ORDER BY w.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. GESTION DES UTILISATEURS
// ==========================================
router.get('/users', async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    let queryStr = `
      SELECT u.id, u.display_name, u.phone_number, u.created_at, u.status, u.role,
             w.balance, w.pending_balance,
             (SELECT count(*) FROM transactions t WHERE t.provider_id = u.id OR t.beneficiary_id = u.id) as tx_count
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (status) { queryStr += ` AND u.status = $${paramIdx++}`; params.push(status); }
    if (search) {
      queryStr += ` AND (u.display_name ILIKE $${paramIdx} OR u.phone_number ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    queryStr += ` ORDER BY u.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const result = await query("UPDATE users SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await logAdminAction(req.user.id, 'change_user_status', req.params.id, 'user', { status, reason });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créditer / Débiter manuellement un portefeuille (cas d'erreur sandbox)
router.post('/users/:id/wallet-manual', async (req, res) => {
  const client = await pool.connect();
  try {
    const { action, amount, reason } = req.body; // action: 'credit' | 'debit'
    if (!reason) throw new Error('Reason is required');
    if (!amount || amount <= 0) throw new Error('Invalid amount');

    await client.query('BEGIN');
    const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [req.params.id]);
    if (walletRes.rows.length === 0) throw new Error('Wallet not found');
    const wallet = walletRes.rows[0];

    const amountNum = parseFloat(amount);
    let newBalance = parseFloat(wallet.balance);

    if (action === 'credit') {
      newBalance += amountNum;
    } else if (action === 'debit') {
      if (newBalance < amountNum) throw new Error('Insufficient balance');
      newBalance -= amountNum;
    } else {
      throw new Error('Invalid action');
    }

    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.id]);
    
    // Log in wallet history
    const type = action === 'credit' ? 'deposit' : 'withdrawal';
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_before, balance_after, pending_before, pending_after, description, reference_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [wallet.id, req.params.id, type, amountNum, wallet.balance, newBalance, wallet.pending_balance, wallet.pending_balance, `Ajustement manuel: ${reason}`, 'admin_adjustment']
    );

    // Log admin action
    await client.query(
      'INSERT INTO admin_logs (admin_id, action, target_id, target_type, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'manual_wallet_adjustment', req.params.id, 'wallet', JSON.stringify({ action, amount: amountNum, reason })]
    );

    await client.query('COMMIT');
    res.json({ message: 'Wallet adjusted successfully', new_balance: newBalance });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. GESTION DES LITIGES
// ==========================================
router.get('/disputes', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let queryStr = `
      SELECT t.*, 
        p.display_name as provider_name, p.phone_number as provider_phone,
        b.display_name as beneficiary_name, b.phone_number as beneficiary_phone
      FROM transactions t
      LEFT JOIN users p ON t.provider_id = p.id
      LEFT JOIN users b ON t.beneficiary_id = b.id
      WHERE t.status = 'disputed' OR t.status = 'resolved'
    `;
    const params = [];
    let paramIdx = 1;

    if (status) { queryStr += ` AND t.status = $${paramIdx++}`; params.push(status); }
    queryStr += ` ORDER BY t.dispute_opened_at DESC NULLS LAST LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/disputes/:id/resolve', async (req, res) => {
  const client = await pool.connect();
  try {
    const { resolution, providerSharePercentage, reason } = req.body; 
    // resolution: 'provider_wins', 'beneficiary_wins', 'split', 'auto_refund'
    if (!reason) throw new Error('Resolution reason required');

    await client.query('BEGIN');
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (txRes.rows.length === 0) throw new Error('Transaction not found');
    const tx = txRes.rows[0];

    if (tx.status !== 'disputed') throw new Error('Transaction is not in disputed state');

    let providerUnlockAmount = 0;
    let beneficiaryUnlockAmount = 0;
    const amount = parseFloat(tx.amount);
    
    // Resolve logic based on type and resolution
    if (tx.type === 'cash_for_skill') {
      // Funds are locked in beneficiary wallet
      if (resolution === 'provider_wins') {
        // Unlock from beneficiary and transfer to provider (minus commission)
        const commissionAmount = amount * tx.commission_rate;
        const transferAmount = amount - commissionAmount;

        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1 WHERE user_id = $2', [amount, tx.beneficiary_id]);
        await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [transferAmount, tx.provider_id]);
        await client.query('UPDATE platform_account SET balance = balance + $1, total_commissions = total_commissions + $1 WHERE id = 1', [commissionAmount]);
      } else if (resolution === 'beneficiary_wins') {
        // Unlock and return to beneficiary (no commission)
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1 WHERE user_id = $2', [amount, tx.beneficiary_id]);
      } else if (resolution === 'split') {
        // Split logic based on percentage to provider (0-100)
        const pShare = (amount * providerSharePercentage) / 100;
        const bShare = amount - pShare;
        
        // Let's not take commission on split, or maybe take proportional commission? For simplicity, we just refund fully or transfer without commission for split to avoid complex edge cases, OR take comm only on provider part.
        // I will just unlock and transfer
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $2 WHERE user_id = $3', [amount, bShare, tx.beneficiary_id]);
        await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [pShare, tx.provider_id]);
      }
    } else if (tx.type === 'skill_for_skill') {
      // Funds are locked in BOTH wallets
      const bAmount = parseFloat(tx.counterpart_amount || tx.amount);
      if (resolution === 'auto_refund' || resolution === 'split') {
        // Return to both
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1 WHERE user_id = $2', [amount, tx.provider_id]);
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1 WHERE user_id = $2', [bAmount, tx.beneficiary_id]);
      } else if (resolution === 'provider_wins') {
        // Provider gets his money back + maybe beneficiary money as compensation? 
        // For simplicity: S4S dispute resolution usually means refunding both or transferring. 
        // If provider wins, provider gets both? That's what the specs hint: "fonds retenus selon la decision".
        // Let's just refund the provider, and give beneficiary's locked funds to provider as compensation.
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1 WHERE user_id = $2', [amount, tx.provider_id]);
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1 WHERE user_id = $2', [bAmount, tx.beneficiary_id]);
        await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [bAmount, tx.provider_id]);
      } else if (resolution === 'beneficiary_wins') {
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1 WHERE user_id = $2', [bAmount, tx.beneficiary_id]);
        await client.query('UPDATE wallets SET pending_balance = pending_balance - $1 WHERE user_id = $2', [amount, tx.provider_id]);
        await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [amount, tx.beneficiary_id]);
      }
    }

    const updated = await client.query(
      `UPDATE transactions 
       SET status = 'resolved', dispute_resolution = $1, dispute_notes = $2, resolved_by = $3, resolved_at = NOW() 
       WHERE id = $4 RETURNING *`,
      [resolution, reason, req.user.id, tx.id]
    );

    // Log admin action
    await client.query(
      'INSERT INTO admin_logs (admin_id, action, target_id, target_type, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'resolve_dispute', tx.id, 'dispute', JSON.stringify({ resolution, reason })]
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);

    // Send Push Notifications asynchronously
    if (resolution === 'provider_wins') {
      sendPushNotification(tx.provider_id, 'Litige Remporté ✅', 'Votre litige a été tranché en votre faveur. Vos fonds ont été crédités.');
      sendPushNotification(tx.beneficiary_id, 'Litige Perdu ❌', 'Le litige a été tranché en faveur du prestataire.');
    } else if (resolution === 'beneficiary_wins') {
      sendPushNotification(tx.beneficiary_id, 'Litige Remporté ✅', 'Votre litige a été tranché en votre faveur. Vos fonds vous ont été remboursés.');
      sendPushNotification(tx.provider_id, 'Litige Perdu ❌', 'Le litige a été tranché en faveur du client.');
    } else if (resolution === 'split') {
      sendPushNotification(tx.provider_id, 'Litige Partagé ⚖️', 'Le litige a été résolu par un partage équitable.');
      sendPushNotification(tx.beneficiary_id, 'Litige Partagé ⚖️', 'Le litige a été résolu par un partage équitable.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 6. LOGS D'ACTIVITÉ
// ==========================================
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await query(
      `SELECT a.*, u.display_name as admin_name 
       FROM admin_logs a 
       LEFT JOIN users u ON a.admin_id = u.id 
       ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
