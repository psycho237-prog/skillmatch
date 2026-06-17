const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
// NOTE: pawapay is NOT used in escrow routes.
// PawaPay is called ONLY in wallet.js (deposit top-up & withdrawal to mobile money).
// All escrow fund movements are instant in-app wallet-to-wallet database operations.

// Helper to determine who is provider vs client
function getEscrowParties(escrow, service) {
  const providerId = service.user_id;
  const clientId = (escrow.initiator_id === providerId) ? escrow.counterparty_id : escrow.initiator_id;
  return { providerId, clientId };
}

// Helper to notify via socket.io
function notifyUsers(req, userIds, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  // In a real app we might emit to user-specific rooms
  userIds.forEach(id => {
    io.emit(`user_notification_${id}`, { event, payload });
  });
}

// Helper to insert a system message in the chat
async function insertSystemMessage(conversationId, content) {
  try {
    await query(
      'INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES ($1, NULL, $2, false, NOW())',
      [conversationId, content]
    );
  } catch (err) {
    console.error('Failed to insert system message:', err);
  }
}

// POST /api/escrow/initiate
// Body: { serviceId, counterpartyId, conversationId }
// Creates the escrow record. No PawaPay needed — just sets up the agreement in the DB.
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const { serviceId, counterpartyId, conversationId } = req.body;
    const initiatorId = req.user.id;

    if (!serviceId || !counterpartyId || !conversationId) {
      return res.status(400).json({ error: 'Missing required fields: serviceId, counterpartyId, conversationId' });
    }

    // Retrieve service details
    const serviceRes = await query('SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL', [serviceId]);
    if (serviceRes.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found or has been removed' });
    }
    const service = serviceRes.rows[0];

    if (!service.service_type) {
      return res.status(400).json({ error: 'Service has no service_type configured.' });
    }
    if (service.service_type === 'SKILL_TO_SKILL' && (service.holdup_amount === null || service.holdup_amount === undefined)) {
      return res.status(400).json({ error: 'Skill-to-Skill service is missing holdupAmount.' });
    }
    if (service.service_type === 'SKILL_TO_CASH' && (!service.price || service.price <= 0)) {
      return res.status(400).json({ error: 'Service price is not set.' });
    }

    // Verify both users exist
    const initiatorRes = await query('SELECT id FROM users WHERE id = $1', [initiatorId]);
    const counterpartyRes = await query('SELECT id FROM users WHERE id = $1', [counterpartyId]);
    if (initiatorRes.rowCount === 0) return res.status(404).json({ error: 'Initiator not found' });
    if (counterpartyRes.rowCount === 0) return res.status(404).json({ error: 'Counterparty not found' });

    // Determine lock amounts based on service type
    let amountInitiator = 0;
    let amountCounterparty = 0;
    const providerId = service.user_id;
    const price = parseFloat(service.price) || 0;
    const holdupAmount = parseFloat(service.holdup_amount) || 0;

    if (service.service_type === 'SKILL_TO_CASH') {
      // Only the buyer (non-provider) locks funds
      if (initiatorId === providerId) {
        // Provider initiated — counterparty is the buyer
        amountInitiator = 0;
        amountCounterparty = price;
      } else {
        // Buyer initiated
        amountInitiator = price;
        amountCounterparty = 0;
      }
    } else {
      // SKILL_TO_SKILL: both lock the holdup amount
      amountInitiator = holdupAmount;
      amountCounterparty = holdupAmount;
    }

    const platformFee = service.service_type === 'SKILL_TO_CASH' ? parseFloat((price * 0.05).toFixed(2)) : 0.00;
    const currency = service.currency || 'XAF';

    // Check for an existing active escrow to prevent duplicates
    const existingRes = await query(
      `SELECT id FROM escrows 
       WHERE service_id = $1 
         AND ((initiator_id = $2 AND counterparty_id = $3) OR (initiator_id = $3 AND counterparty_id = $2))
         AND status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED', 'FORFEITED')
       LIMIT 1`,
      [serviceId, initiatorId, counterpartyId]
    );
    if (existingRes.rowCount > 0) {
      return res.status(409).json({ error: 'An active escrow already exists for this service between these users.', escrowId: existingRes.rows[0].id });
    }

    // Create the escrow record
    const insertRes = await query(
      `INSERT INTO escrows (
        type, service_id, initiator_id, counterparty_id, amount_initiator, amount_counterparty,
        currency, platform_fee, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AWAITING_COUNTERPARTY', NOW(), NOW()) RETURNING *`,
      [service.service_type, serviceId, initiatorId, counterpartyId, amountInitiator, amountCounterparty, currency, platformFee]
    );
    const escrow = insertRes.rows[0];

    // Link conversation to service
    await query('UPDATE conversations SET service_id = $1 WHERE id = $2', [serviceId, conversationId]);

    // System message in chat
    const amountStr = service.service_type === 'SKILL_TO_CASH'
      ? `${price} ${currency}`
      : `${holdupAmount} ${currency} hold each`;
    const msgText = service.service_type === 'SKILL_TO_CASH'
      ? `💳 Purchase request sent for "${service.title}" — ${amountStr}. Waiting for provider to accept.`
      : `🔄 Exchange initiated for "${service.title}" — ${amountStr}. Waiting for counterparty to accept.`;
    await insertSystemMessage(conversationId, msgText);

    notifyUsers(req, [counterpartyId], 'ESCROW_INITIATED', { escrowId: escrow.id, serviceTitle: service.title });

    res.status(201).json({ escrow });
  } catch (error) {
    console.error('Initiate escrow error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate escrow' });
  }
});

// POST /api/escrow/accept
// Body: { escrowId } (Called by counterparty)
// ⚡ Wallet-to-wallet: locks funds from in-app wallet instantly. No PawaPay calls here.
router.post('/accept', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.body;
    const userId = req.user.id;

    const escrowRes = await query('SELECT * FROM escrows WHERE id = $1', [escrowId]);
    if (escrowRes.rowCount === 0) return res.status(404).json({ error: 'Escrow not found' });
    const escrow = escrowRes.rows[0];

    if (escrow.counterparty_id !== userId) {
      return res.status(403).json({ error: 'Only the counterparty can accept this transaction' });
    }
    if (escrow.status !== 'AWAITING_COUNTERPARTY') {
      return res.status(400).json({ error: 'Transaction cannot be accepted in its current status: ' + escrow.status });
    }

    const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
    const service = serviceRes.rows[0];

    let lockMsg = '';

    if (escrow.type === 'SKILL_TO_CASH') {
      // ── SKILL_TO_CASH: only the buyer (client) locks funds ──────────────────
      const { clientId } = getEscrowParties(escrow, service);
      const lockAmount = parseFloat(clientId === escrow.initiator_id ? escrow.amount_initiator : escrow.amount_counterparty);

      // Verify client wallet has enough balance
      const clientWalletRes = await query(
        'SELECT id, balance, pending_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [clientId]
      );
      if (clientWalletRes.rowCount === 0) {
        return res.status(400).json({ error: 'Buyer wallet not found. Please top up your wallet first.' });
      }
      const clientWallet = clientWalletRes.rows[0];
      if (parseFloat(clientWallet.balance) < lockAmount) {
        return res.status(400).json({
          error: `Insufficient wallet balance. Need ${lockAmount} ${escrow.currency}, have ${clientWallet.balance} ${escrow.currency}. Please top up your wallet.`
        });
      }

      // Lock: move from balance → pending_balance
      await query(
        'UPDATE wallets SET balance = balance - $1, pending_balance = pending_balance + $1, updated_at = NOW() WHERE user_id = $2',
        [lockAmount, clientId]
      );

      // Record escrow lock transaction
      await query(
        `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
         VALUES ($1, $2, 'ESCROW_LOCK', $3, $4, 'COMPLETED', $5, NOW())`,
        [crypto.randomUUID(), clientId, lockAmount, escrow.currency, escrow.id]
      );

      lockMsg = `🔒 Funds locked — ${lockAmount} ${escrow.currency} held in escrow`;

    } else {
      // ── SKILL_TO_SKILL: both parties lock their hold amount ──────────────────
      const lockAmountA = parseFloat(escrow.amount_initiator);
      const lockAmountB = parseFloat(escrow.amount_counterparty);

      const walletARes = await query(
        'SELECT id, balance, pending_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [escrow.initiator_id]
      );
      const walletBRes = await query(
        'SELECT id, balance, pending_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [escrow.counterparty_id]
      );

      if (walletARes.rowCount === 0) return res.status(400).json({ error: 'Initiator wallet not found. Please top up wallet first.' });
      if (walletBRes.rowCount === 0) return res.status(400).json({ error: 'Counterparty wallet not found. Please top up wallet first.' });

      if (parseFloat(walletARes.rows[0].balance) < lockAmountA) {
        return res.status(400).json({
          error: `Initiator has insufficient balance. Need ${lockAmountA} ${escrow.currency}, have ${walletARes.rows[0].balance}.`
        });
      }
      if (parseFloat(walletBRes.rows[0].balance) < lockAmountB) {
        return res.status(400).json({
          error: `Counterparty has insufficient balance. Need ${lockAmountB} ${escrow.currency}, have ${walletBRes.rows[0].balance}.`
        });
      }

      // Lock both
      await query(
        'UPDATE wallets SET balance = balance - $1, pending_balance = pending_balance + $1, updated_at = NOW() WHERE user_id = $2',
        [lockAmountA, escrow.initiator_id]
      );
      await query(
        'UPDATE wallets SET balance = balance - $1, pending_balance = pending_balance + $1, updated_at = NOW() WHERE user_id = $2',
        [lockAmountB, escrow.counterparty_id]
      );

      // Record lock transactions for both
      await query(
        `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
         VALUES ($1, $2, 'ESCROW_LOCK', $3, $4, 'COMPLETED', $5, NOW())`,
        [crypto.randomUUID(), escrow.initiator_id, lockAmountA, escrow.currency, escrow.id]
      );
      await query(
        `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
         VALUES ($1, $2, 'ESCROW_LOCK', $3, $4, 'COMPLETED', $5, NOW())`,
        [crypto.randomUUID(), escrow.counterparty_id, lockAmountB, escrow.currency, escrow.id]
      );

      lockMsg = `🔒 Exchange locked — ${lockAmountA} ${escrow.currency} held from both parties`;
    }

    // Set escrow to BOTH_LOCKED immediately (no webhook wait needed)
    await query(
      `UPDATE escrows SET status = 'BOTH_LOCKED', initiator_locked = true, counterparty_locked = true, updated_at = NOW() WHERE id = $1`,
      [escrowId]
    );

    // Send system message
    const convRes = await query(
      'SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))',
      [escrow.service_id, escrow.initiator_id, escrow.counterparty_id]
    );
    if (convRes.rowCount > 0) {
      await insertSystemMessage(convRes.rows[0].id, lockMsg);
    }

    notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'BOTH_LOCKED', { escrowId: escrow.id });

    res.json({ message: 'Transaction accepted. Funds locked from in-app wallet.' });
  } catch (error) {
    console.error('Accept escrow error:', error);
    res.status(500).json({ error: error.message || 'Failed to accept escrow' });
  }
});

// POST /api/escrow/mark-delivered
// Provider asserts task is done. Status becomes PROVIDER_MARKED_DONE. Sets autoResolveAt to now + 48h.
router.post('/mark-delivered', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.body;
    const userId = req.user.id;

    const escrowRes = await query('SELECT * FROM escrows WHERE id = $1', [escrowId]);
    if (escrowRes.rowCount === 0) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    const escrow = escrowRes.rows[0];

    const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
    const service = serviceRes.rows[0];

    const providerId = service.user_id;

    if (userId !== providerId) {
      return res.status(403).json({ error: 'Only the service provider can mark this task as completed' });
    }

    if (escrow.status !== 'BOTH_LOCKED') {
      return res.status(400).json({ error: 'Cannot mark as delivered unless status is BOTH_LOCKED' });
    }

    const autoResolveAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h auto-confirm

    await query(
      `UPDATE escrows 
       SET status = 'PROVIDER_MARKED_DONE', auto_resolve_at = $1, provider_confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [autoResolveAt, escrowId]
    );

    // Insert system message in chat
    const convRes = await query('SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))', [
      escrow.service_id, escrow.initiator_id, escrow.counterparty_id
    ]);
    if (convRes.rowCount > 0) {
      await insertSystemMessage(convRes.rows[0].id, `📦 Provider marked service as delivered`);
    }

    notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'PROVIDER_MARKED_DONE', { escrowId });

    res.json({ message: 'Escrow marked as delivered. Awaiting client confirmation.', autoResolveAt });
  } catch (error) {
    console.error('Mark delivered error:', error);
    res.status(500).json({ error: 'Failed to mark escrow as delivered' });
  }
});

// POST /api/escrow/confirm
// SKILL_TO_CASH: client confirms delivery → payout (price - 5% fee) from locked funds to provider.
// SKILL_TO_SKILL: two-way handshake — each party confirms independently. Funds released when BOTH confirm.
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.body;
    const userId = req.user.id;

    const escrowRes = await query('SELECT * FROM escrows WHERE id = $1', [escrowId]);
    if (escrowRes.rowCount === 0) return res.status(404).json({ error: 'Escrow not found' });
    const escrow = escrowRes.rows[0];

    const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
    const service = serviceRes.rows[0];

    const { clientId, providerId } = getEscrowParties(escrow, service);

    if (escrow.type === 'SKILL_TO_SKILL') {
      // ── SKILL_TO_SKILL: two-way handshake ──────────────────────────────────
      if (userId !== clientId && userId !== providerId) {
        return res.status(403).json({ error: 'You are not a party to this escrow' });
      }
      if (escrow.status !== 'BOTH_LOCKED') {
        return res.status(400).json({ error: 'Cannot confirm exchange in current status: ' + escrow.status });
      }

      const isClient = userId === clientId;
      const alreadyConfirmedClient = !!escrow.client_confirmed_at;
      const alreadyConfirmedProvider = !!escrow.provider_confirmed_at;

      // Prevent double-confirming
      if (isClient && alreadyConfirmedClient) {
        return res.status(400).json({ error: 'You have already confirmed this exchange. Waiting for the other party.' });
      }
      if (!isClient && alreadyConfirmedProvider) {
        return res.status(400).json({ error: 'You have already confirmed this exchange. Waiting for the other party.' });
      }

      // Record this user's confirmation
      if (isClient) {
        await query('UPDATE escrows SET client_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1', [escrowId]);
      } else {
        await query('UPDATE escrows SET provider_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1', [escrowId]);
      }

      // Check if the OTHER party has also confirmed
      const bothConfirmed = isClient ? alreadyConfirmedProvider : alreadyConfirmedClient;

      if (!bothConfirmed) {
        // Notify the other party that this user confirmed
        const otherUserId = isClient ? providerId : clientId;
        notifyUsers(req, [otherUserId], 'EXCHANGE_PARTIAL_CONFIRM', { escrowId, confirmedBy: userId });

        const convRes = await query(
          'SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))',
          [escrow.service_id, escrow.initiator_id, escrow.counterparty_id]
        );
        if (convRes.rowCount > 0) {
          await insertSystemMessage(convRes.rows[0].id, `✅ One party confirmed the exchange — waiting for the other to confirm`);
        }
        return res.json({ message: 'Your confirmation recorded. Waiting for the other party to confirm.', status: 'PARTIAL_CONFIRM' });
      }

      // Both confirmed — process refund/release
      const freshEscrow = (await query('SELECT * FROM escrows WHERE id = $1', [escrowId])).rows[0];
      await processEscrowPayout(freshEscrow, service);

      const convRes = await query(
        'SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))',
        [escrow.service_id, escrow.initiator_id, escrow.counterparty_id]
      );
      if (convRes.rowCount > 0) {
        await insertSystemMessage(convRes.rows[0].id, `✅ Exchange complete — both parties confirmed, holds released`);
      }
      notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'COMPLETED', { escrowId });
      return res.json({ message: 'Exchange completed. Both confirmed. Holds released.' });

    } else {
      // ── SKILL_TO_CASH: only the client confirms after delivery ─────────────
      if (userId !== clientId) {
        return res.status(403).json({ error: 'Only the buyer can confirm receipt of service' });
      }
      if (escrow.status !== 'PROVIDER_MARKED_DONE' && escrow.status !== 'BOTH_LOCKED') {
        return res.status(400).json({ error: 'Cannot confirm escrow in current status: ' + escrow.status });
      }

      await processEscrowPayout(escrow, service);

      const convRes = await query(
        'SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))',
        [escrow.service_id, escrow.initiator_id, escrow.counterparty_id]
      );
      if (convRes.rowCount > 0) {
        await insertSystemMessage(convRes.rows[0].id, `✅ Service confirmed — funds released to provider`);
      }
      notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'COMPLETED', { escrowId });
      return res.json({ message: 'Service confirmed. Funds released to provider.' });
    }
  } catch (error) {
    console.error('Confirm escrow error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm escrow' });
  }
});

// Core logic for processing payout releases/refunds
// ⚡ Pure wallet-to-wallet — no PawaPay calls. All transfers are instant in-app.
async function processEscrowPayout(escrow, service) {
  const { providerId, clientId } = getEscrowParties(escrow, service);

  if (escrow.type === 'SKILL_TO_CASH') {
    // ── SKILL_TO_CASH: release client's locked funds, credit provider minus 5% fee ─
    const totalAmount = parseFloat(clientId === escrow.initiator_id ? escrow.amount_initiator : escrow.amount_counterparty);
    const feeAmount = parseFloat((totalAmount * 0.05).toFixed(2));
    const payoutAmount = parseFloat((totalAmount - feeAmount).toFixed(2));
    const currency = escrow.currency || 'XAF';

    // 1. Release client's locked pending funds
    await query(
      'UPDATE wallets SET pending_balance = pending_balance - $1, updated_at = NOW() WHERE user_id = $2',
      [totalAmount, clientId]
    );

    // 2. Credit provider's wallet
    await query(
      'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
      [payoutAmount, providerId]
    );

    // 3. Credit platform fee account
    await query(
      `UPDATE platform_account 
       SET balance = balance + $1, total_commissions = total_commissions + $1, total_transactions = total_transactions + 1, updated_at = NOW() 
       WHERE id = 1`,
      [feeAmount]
    );

    // 4. Record payout transaction (provider receives)
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
       VALUES ($1, $2, 'PAYOUT', $3, $4, 'COMPLETED', $5, NOW())`,
      [crypto.randomUUID(), providerId, payoutAmount, currency, escrow.id]
    );

    // 5. Record fee transaction
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
       VALUES ($1, $2, 'FEE', $3, $4, 'COMPLETED', $5, NOW())`,
      [crypto.randomUUID(), providerId, feeAmount, currency, escrow.id]
    );

    // 6. Record debit on client side
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
       VALUES ($1, $2, 'ESCROW_RELEASE', $3, $4, 'COMPLETED', $5, NOW())`,
      [crypto.randomUUID(), clientId, totalAmount, currency, escrow.id]
    );

    console.log(`[ESCROW PAYOUT] S2C: client=${clientId} paid ${totalAmount}, provider=${providerId} received ${payoutAmount}, fee=${feeAmount}`);

  } else {
    // ── SKILL_TO_SKILL: refund both hold amounts back from pending_balance → balance ─
    const refundA = parseFloat(escrow.amount_initiator);
    const refundB = parseFloat(escrow.amount_counterparty);
    const currency = escrow.currency || 'XAF';

    // Refund initiator
    await query(
      'UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
      [refundA, escrow.initiator_id]
    );

    // Refund counterparty
    await query(
      'UPDATE wallets SET pending_balance = pending_balance - $1, balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
      [refundB, escrow.counterparty_id]
    );

    // Record refund transactions for both
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
       VALUES ($1, $2, 'REFUND', $3, $4, 'COMPLETED', $5, NOW())`,
      [crypto.randomUUID(), escrow.initiator_id, refundA, currency, escrow.id]
    );
    await query(
      `INSERT INTO escrow_transactions (id, user_id, type, amount, currency, status, escrow_id, created_at)
       VALUES ($1, $2, 'REFUND', $3, $4, 'COMPLETED', $5, NOW())`,
      [crypto.randomUUID(), escrow.counterparty_id, refundB, currency, escrow.id]
    );

    console.log(`[ESCROW PAYOUT] S2S: initiator=${escrow.initiator_id} refunded ${refundA}, counterparty=${escrow.counterparty_id} refunded ${refundB}`);
  }

  // Mark escrow as COMPLETED
  await query(
    `UPDATE escrows SET status = 'COMPLETED', client_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [escrow.id]
  );
}

// POST /api/escrow/dispute
// SKILL_TO_CASH: only the client can dispute.
// SKILL_TO_SKILL: either party can dispute from BOTH_LOCKED or PROVIDER_MARKED_DONE.
// Disputing freezes the locked funds for admin review.
router.post('/dispute', authenticateToken, async (req, res) => {
  try {
    const { escrowId, hasProof, proofUrl } = req.body;
    const userId = req.user.id;

    const escrowRes = await query('SELECT * FROM escrows WHERE id = $1', [escrowId]);
    if (escrowRes.rowCount === 0) return res.status(404).json({ error: 'Escrow not found' });
    const escrow = escrowRes.rows[0];

    const serviceRes = await query('SELECT * FROM services WHERE id = $1', [escrow.service_id]);
    const service = serviceRes.rows[0];
    const { clientId, providerId } = getEscrowParties(escrow, service);

    // Authorization: for S2C only client disputes; for S2S either party can
    const isParty = (userId === clientId || userId === providerId);
    if (!isParty) return res.status(403).json({ error: 'You are not a party to this escrow' });
    if (escrow.type === 'SKILL_TO_CASH' && userId !== clientId) {
      return res.status(403).json({ error: 'Only the buyer can open a dispute for a cash-for-skill transaction' });
    }

    const allowedStatuses = ['BOTH_LOCKED', 'PROVIDER_MARKED_DONE'];
    if (!allowedStatuses.includes(escrow.status)) {
      return res.status(400).json({ error: `Dispute can only be opened when escrow is in BOTH_LOCKED or PROVIDER_MARKED_DONE state. Current: ${escrow.status}` });
    }

    const status = hasProof ? 'DISPUTED' : 'DISPUTE_NO_PROOF';
    const autoResolveAt = hasProof
      ? new Date(Date.now() + 72 * 60 * 60 * 1000) // 72h with proof — admin reviews
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h without proof — provider wins

    await query(
      `UPDATE escrows 
       SET status = $1, dispute_started_at = NOW(), auto_resolve_at = $2, dispute_proof_url = $3, updated_at = NOW() 
       WHERE id = $4`,
      [status, autoResolveAt, proofUrl || null, escrowId]
    );

    // System message in chat
    const convRes = await query(
      'SELECT id FROM conversations WHERE service_id = $1 AND ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))',
      [escrow.service_id, escrow.initiator_id, escrow.counterparty_id]
    );
    if (convRes.rowCount > 0) {
      await insertSystemMessage(
        convRes.rows[0].id,
        `⚠️ Dispute opened — ${hasProof ? 'proof submitted, 72h admin review' : 'no proof, 24h auto-resolve (provider wins)'}. Funds remain locked.`
      );
    }

    notifyUsers(req, [escrow.initiator_id, escrow.counterparty_id], 'DISPUTED', { escrowId, status });

    res.json({ message: 'Dispute logged. Funds remain locked pending admin review.', status, autoResolveAt });
  } catch (error) {
    console.error('Log dispute error:', error);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

// GET /api/escrow/:id/status
router.get('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const escrowRes = await query(
      `SELECT e.*, 
              s.title as service_title, s.price as service_price, s.holdup_amount as service_holdup,
              u1.display_name as initiator_name, u1.avatar_url as initiator_avatar,
              u2.display_name as counterparty_name, u2.avatar_url as counterparty_avatar
       FROM escrows e
       JOIN services s ON e.service_id = s.id
       JOIN users u1 ON e.initiator_id = u1.id
       JOIN users u2 ON e.counterparty_id = u2.id
       WHERE e.id = $1`,
      [id]
    );

    if (escrowRes.rowCount === 0) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    const escrow = escrowRes.rows[0];

    // Build standard event timeline dynamically based on dates
    const timeline = [];
    if (escrow.created_at) timeline.push({ event: 'INITIATED', at: escrow.created_at });
    if (escrow.initiator_locked && escrow.counterparty_locked) {
      timeline.push({ event: 'LOCKED', at: escrow.updated_at });
    }
    if (escrow.provider_confirmed_at) {
      timeline.push({ event: 'PROVIDER_MARKED_DONE', at: escrow.provider_confirmed_at });
    }
    if (escrow.dispute_started_at) {
      timeline.push({ event: escrow.status, at: escrow.dispute_started_at });
    }
    if (escrow.client_confirmed_at) {
      timeline.push({ event: escrow.status, at: escrow.client_confirmed_at });
    }

    res.json({ escrow: { ...escrow, timeline } });
  } catch (error) {
    console.error('Get escrow status error:', error);
    res.status(500).json({ error: 'Failed to fetch escrow status' });
  }
});

// GET /api/escrow/active/:conversationId - Find active escrow for conversation
router.get('/active/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Fetch conversation details
    const convRes = await query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
    if (convRes.rowCount === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const conv = convRes.rows[0];

    if (!conv.service_id) {
      return res.json({ escrow: null });
    }

    // Find active escrow (not in final terminal status)
    const activeRes = await query(
      `SELECT * FROM escrows 
       WHERE service_id = $1 
         AND ((initiator_id = $2 AND counterparty_id = $3) OR (initiator_id = $3 AND counterparty_id = $2))
         AND status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED', 'FORFEITED')
       ORDER BY created_at DESC LIMIT 1`,
      [conv.service_id, conv.user1_id, conv.user2_id]
    );

    if (activeRes.rowCount === 0) {
      return res.json({ escrow: null });
    }

    res.json({ escrow: activeRes.rows[0] });
  } catch (error) {
    console.error('Get active escrow error:', error);
    console.log('peeer');
    res.status(500).json({ error: 'Failed to fetch active escrow' });
  }
});

module.exports = { router, processEscrowPayout };
