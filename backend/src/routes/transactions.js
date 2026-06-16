const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { lockFunds, unlockFunds, transferLockedFunds } = require('../config/wallet');

router.use(authenticateToken);

// GET /api/transactions - List user's transactions
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT t.*, 
        p.display_name as provider_name, p.avatar_url as provider_avatar,
        b.display_name as beneficiary_name, b.avatar_url as beneficiary_avatar
       FROM transactions t
       LEFT JOIN users p ON t.provider_id = p.id
       LEFT JOIN users b ON t.beneficiary_id = b.id
       WHERE t.provider_id = $1 OR t.beneficiary_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions - Create a new transaction
router.post('/', async (req, res) => {
  try {
    const initiatorId = req.user.id;
    const { 
      type, provider_id, beneficiary_id, service_id, 
      title, description, amount,
      counterpart_service_id, counterpart_title, counterpart_description, counterpart_amount,
      due_date
    } = req.body;

    // Validate parties
    if (provider_id === beneficiary_id) {
      return res.status(400).json({ error: 'Provider and beneficiary cannot be the same' });
    }
    if (initiatorId !== provider_id && initiatorId !== beneficiary_id) {
      return res.status(403).json({ error: 'Initiator must be part of the transaction' });
    }

    // Insert transaction
    const result = await query(
      `INSERT INTO transactions (
        type, status, initiator_id, provider_id, beneficiary_id, 
        service_id, title, description, amount, 
        counterpart_service_id, counterpart_title, counterpart_description, counterpart_amount,
        due_date
      ) VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        type, initiatorId, provider_id, beneficiary_id, 
        service_id, title, description, amount,
        counterpart_service_id, counterpart_title, counterpart_description, counterpart_amount,
        due_date || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/:id/accept - Accept a transaction and lock funds
router.post('/:id/accept', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const txId = req.params.id;

    // Get transaction
    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [txId]);
    if (txRes.rows.length === 0) throw new Error('Transaction not found');
    const tx = txRes.rows[0];

    if (tx.status !== 'pending') throw new Error('Transaction is not pending');
    if (userId === tx.initiator_id) throw new Error('You cannot accept your own initiated transaction');
    if (userId !== tx.provider_id && userId !== tx.beneficiary_id) throw new Error('Not part of transaction');

    // Lock funds based on type
    if (tx.type === 'cash_for_skill') {
      // Lock beneficiary's funds
      await lockFunds(client, tx.beneficiary_id, tx.amount, tx.id, `Cash for Skill: ${tx.title}`);
    } else if (tx.type === 'skill_for_skill') {
      // Lock both parties' funds
      await lockFunds(client, tx.provider_id, tx.amount, tx.id, `Skill Exchange (Provider): ${tx.title}`);
      await lockFunds(client, tx.beneficiary_id, tx.counterpart_amount || tx.amount, tx.id, `Skill Exchange (Beneficiary): ${tx.title}`);
    }

    // Update status
    const updated = await client.query(
      "UPDATE transactions SET status = 'in_progress', agreed_at = NOW(), started_at = NOW() WHERE id = $1 RETURNING *",
      [tx.id]
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/transactions/:id/complete - Mark service as completed (provider only for C4S)
router.post('/:id/complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const txId = req.params.id;

    const txRes = await query('SELECT * FROM transactions WHERE id = $1', [txId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    const tx = txRes.rows[0];

    if (tx.status !== 'in_progress') return res.status(400).json({ error: 'Transaction must be in_progress' });
    
    let updated;
    if (tx.type === 'cash_for_skill') {
      if (userId !== tx.provider_id) return res.status(403).json({ error: 'Only provider can mark completed' });
      updated = await query(
        "UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *",
        [tx.id]
      );
    } else {
      // For skill for skill, just mark it completed overall.
      updated = await query(
        "UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *",
        [tx.id]
      );
    }
    
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/:id/confirm - Confirm delivery and release funds
router.post('/:id/confirm', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.id;
    const txId = req.params.id;

    const txRes = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [txId]);
    if (txRes.rows.length === 0) throw new Error('Transaction not found');
    let tx = txRes.rows[0];

    if (tx.type === 'cash_for_skill') {
      if (userId !== tx.beneficiary_id) throw new Error('Only beneficiary can confirm delivery for Cash transactions');
      if (tx.status !== 'completed' && tx.status !== 'proof_submitted') throw new Error('Service is not completed yet');

      // Release funds from beneficiary to provider
      await transferLockedFunds(client, tx.beneficiary_id, tx.provider_id, tx.amount, tx.commission_rate, tx.id, `Payment released: ${tx.title}`);
      
      const updated = await client.query(
        "UPDATE transactions SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1 RETURNING *",
        [tx.id]
      );
      tx = updated.rows[0];
    } 
    else if (tx.type === 'skill_for_skill') {
      if (tx.status !== 'completed' && tx.status !== 'in_progress') throw new Error('Service must be completed or in_progress');
      if (userId !== tx.provider_id && userId !== tx.beneficiary_id) throw new Error('Not part of transaction');

      // Update the correct flag
      if (userId === tx.provider_id) {
        await client.query("UPDATE transactions SET provider_confirmed = TRUE, provider_confirmed_at = NOW() WHERE id = $1", [tx.id]);
        tx.provider_confirmed = true;
      } else {
        await client.query("UPDATE transactions SET beneficiary_confirmed = TRUE, beneficiary_confirmed_at = NOW() WHERE id = $1", [tx.id]);
        tx.beneficiary_confirmed = true;
      }

      // If both confirmed, release funds back (minus commission)
      if (tx.provider_confirmed && tx.beneficiary_confirmed) {
        // Unlock provider funds minus commission (meaning platform takes commission, rest goes back to provider)
        await transferLockedFunds(client, tx.provider_id, tx.provider_id, tx.amount, tx.commission_rate, tx.id, `Skill Exchange Released (Provider): ${tx.title}`);
        
        // Unlock beneficiary funds minus commission
        const bAmount = tx.counterpart_amount || tx.amount;
        await transferLockedFunds(client, tx.beneficiary_id, tx.beneficiary_id, bAmount, tx.commission_rate, tx.id, `Skill Exchange Released (Beneficiary): ${tx.title}`);
        
        const updated = await client.query(
          "UPDATE transactions SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1 RETURNING *",
          [tx.id]
        );
        tx = updated.rows[0];
      } else {
        const updated = await client.query("SELECT * FROM transactions WHERE id = $1", [tx.id]);
        tx = updated.rows[0];
      }
    }

    await client.query('COMMIT');
    res.json(tx);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/transactions/:id/dispute - Open a dispute
router.post('/:id/dispute', async (req, res) => {
  try {
    const userId = req.user.id;
    const txId = req.params.id;
    const { reason } = req.body;

    const txRes = await query('SELECT * FROM transactions WHERE id = $1', [txId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    const tx = txRes.rows[0];

    if (userId !== tx.provider_id && userId !== tx.beneficiary_id) return res.status(403).json({ error: 'Not part of transaction' });
    if (tx.status === 'confirmed' || tx.status === 'resolved' || tx.status === 'disputed' || tx.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot dispute transaction in this state' });
    }

    const updated = await query(
      "UPDATE transactions SET status = 'disputed', dispute_opened_at = NOW(), dispute_opened_by = $1, dispute_reason = $2 WHERE id = $3 RETURNING *",
      [userId, reason, tx.id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/:id/cancel - Cancel a pending transaction
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = req.user.id;
    const txId = req.params.id;

    const txRes = await query('SELECT * FROM transactions WHERE id = $1', [txId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    const tx = txRes.rows[0];

    if (userId !== tx.provider_id && userId !== tx.beneficiary_id) return res.status(403).json({ error: 'Not part of transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Only pending transactions can be cancelled directly' });

    const updated = await query(
      "UPDATE transactions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1 RETURNING *",
      [tx.id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/:id/proof - Submit proof of delivery
router.post('/:id/proof', async (req, res) => {
  try {
    const userId = req.user.id;
    const txId = req.params.id;
    const { description, files } = req.body;

    const txRes = await query('SELECT * FROM transactions WHERE id = $1', [txId]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    const tx = txRes.rows[0];

    if (userId !== tx.beneficiary_id && userId !== tx.provider_id) return res.status(403).json({ error: 'Not part of transaction' });

    await query(
      "INSERT INTO transaction_proofs (transaction_id, submitted_by, type, description, files) VALUES ($1, $2, 'delivery', $3, $4)",
      [tx.id, userId, description, JSON.stringify(files || [])]
    );

    if (tx.status === 'completed' && userId === tx.beneficiary_id) {
      await query("UPDATE transactions SET status = 'proof_submitted', proof_submitted_at = NOW() WHERE id = $1", [tx.id]);
    }

    res.json({ message: 'Proof submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type = 'ALL' } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT t.id as "transactionId",
             t.type,
             t.status,
             t.amount::float as amount,
             t.currency,
             COALESCE(e.platform_fee::float, 0) as "platformFee",
             COALESCE(t.pawapay_deposit_id, t.pawapay_payout_id) as "pawapayRef",
             t.created_at as "createdAt",
             COALESCE(e.rating_pending, false) as "ratingPending",
             CASE 
                WHEN e.id IS NOT NULL THEN
                  json_build_object(
                    'id', e.id,
                    'type', e.type,
                    'status', e.status,
                    'timeline', json_build_array(
                      json_build_object('event', 'INITIATED', 'at', e.created_at),
                      json_build_object('event', 'LOCKED', 'at', e.updated_at),
                      json_build_object('event', 'PROVIDER_MARKED_DONE', 'at', e.provider_confirmed_at),
                      json_build_object('event', e.status, 'at', e.client_confirmed_at)
                    )
                  )
                ELSE NULL
             END as escrow,
             CASE
                WHEN s.id IS NOT NULL THEN
                  json_build_object(
                    'id', s.id,
                    'title', s.title,
                    'serviceType', s.service_type,
                    'price', s.price::float,
                    'holdupAmount', s.holdup_amount::float
                  )
                ELSE NULL
             END as service,
             CASE
                WHEN c.id IS NOT NULL THEN
                  json_build_object(
                    'id', c.id,
                    'name', c.display_name,
                    'avatar', c.avatar_url,
                    'averageRating', c.average_rating::float
                  )
                ELSE NULL
             END as counterparty
      FROM escrow_transactions t
      LEFT JOIN escrows e ON t.escrow_id = e.id
      LEFT JOIN services s ON e.service_id = s.id
      LEFT JOIN users c ON (c.id = (CASE WHEN t.user_id = e.initiator_id THEN e.counterparty_id ELSE e.initiator_id END))
      WHERE t.user_id = $1
    `;

    const params = [userId];
    let paramCount = 2;

    if (type !== 'ALL') {
      sql += ` AND t.type = $${paramCount++}`;
      params.push(type);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);

    res.json({ transactions: rows });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// GET /api/transactions/summary
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get Total Earned (completed payouts)
    const earnedRes = await query(
      `SELECT COALESCE(SUM(amount), 0)::float as sum 
       FROM escrow_transactions 
       WHERE user_id = $1 AND type = 'PAYOUT' AND status = 'COMPLETED' AND escrow_id IS NOT NULL`,
      [userId]
    );

    // Get Total Spent (completed deposits)
    const spentRes = await query(
      `SELECT COALESCE(SUM(amount), 0)::float as sum 
       FROM escrow_transactions 
       WHERE user_id = $1 AND type = 'DEPOSIT' AND status = 'COMPLETED' AND escrow_id IS NOT NULL`,
      [userId]
    );

    // Get Active Escrows count
    const activeRes = await query(
      `SELECT COUNT(*)::int as count 
       FROM escrows 
       WHERE (initiator_id = $1 OR counterparty_id = $1) 
         AND status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED', 'FORFEITED')`,
      [userId]
    );

    // Get Completed Deals count
    const completedRes = await query(
      `SELECT COUNT(*)::int as count 
       FROM escrows 
       WHERE (initiator_id = $1 OR counterparty_id = $1) 
         AND status = 'COMPLETED'`,
      [userId]
    );

    // Get Disputes count (DISPUTED or FORFEITED)
    const disputesRes = await query(
      `SELECT COUNT(*)::int as count 
       FROM escrows 
       WHERE (initiator_id = $1 OR counterparty_id = $1) 
         AND status IN ('DISPUTED', 'FORFEITED')`,
      [userId]
    );

    // Get User wallet currency
    const walletRes = await query('SELECT currency FROM wallets WHERE user_id = $1', [userId]);
    const currency = walletRes.rowCount > 0 ? walletRes.rows[0].currency : 'XAF';

    res.json({
      totalEarned: earnedRes.rows[0].sum,
      totalSpent: spentRes.rows[0].sum,
      activeEscrows: activeRes.rows[0].count,
      completedDeals: completedRes.rows[0].count,
      disputes: disputesRes.rows[0].count,
      currency
    });
  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
});

// POST /api/transactions/topup - Sandbox developer wallet topup
router.post('/topup', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount = 5000, currency = 'XAF' } = req.body;

    // Credit user wallet balance in wallets
    await query(
      `INSERT INTO wallets (user_id, balance, currency, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()`,
      [userId, parseFloat(amount), currency]
    );

    // Insert completed DEPOSIT transaction
    const depositId = require('crypto').randomUUID();
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, pawapay_deposit_id, amount, currency, status, created_at)
       VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, 'COMPLETED', NOW())`,
      [require('crypto').randomUUID(), userId, depositId, parseFloat(amount), currency]
    );

    const walletRes = await query('SELECT balance::float as balance FROM wallets WHERE user_id = $1', [userId]);
    res.json({ balance: walletRes.rows[0].balance, message: 'Top up successful' });
  } catch (error) {
    console.error('Sandbox top up error:', error);
    res.status(500).json({ error: 'Failed to process sandbox top up' });
  }
});

module.exports = router;
