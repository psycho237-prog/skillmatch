const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/ratings - Create a rating
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { escrowId, revieweeId, score, comment } = req.body;
    const reviewerId = req.user.id;

    if (!escrowId || !revieweeId || !score) {
      return res.status(400).json({ error: 'Missing required fields (escrowId, revieweeId, score)' });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' });
    }

    if (reviewerId === revieweeId) {
      return res.status(400).json({ error: 'You cannot rate yourself' });
    }

    // Verify Escrow is COMPLETED
    const escrowRes = await query('SELECT * FROM escrows WHERE id = $1', [escrowId]);
    if (escrowRes.rowCount === 0) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    const escrow = escrowRes.rows[0];

    if (escrow.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Ratings are only allowed after the escrow is COMPLETED' });
    }

    // Verify reviewer is a participant of the escrow
    const isInitiator = (escrow.initiator_id === reviewerId);
    const isCounterparty = (escrow.counterparty_id === reviewerId);
    if (!isInitiator && !isCounterparty) {
      return res.status(403).json({ error: 'You are not a participant in this escrow transaction' });
    }

    // Verify reviewee is also a participant
    if (escrow.initiator_id !== revieweeId && escrow.counterparty_id !== revieweeId) {
      return res.status(400).json({ error: 'The reviewee is not a participant in this escrow' });
    }

    // Verify no duplicate rating
    const checkRes = await query(
      'SELECT id FROM ratings WHERE reviewer_id = $1 AND escrow_id = $2',
      [reviewerId, escrowId]
    );
    if (checkRes.rowCount > 0) {
      return res.status(409).json({ error: 'You have already rated for this escrow' });
    }

    // Insert the rating
    await query(
      'INSERT INTO ratings (reviewer_id, reviewee_id, escrow_id, score, comment, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [reviewerId, revieweeId, escrowId, score, comment || null]
    );

    // Recompute reviewee.average_rating and total_ratings on users table
    await query(
      `UPDATE users 
       SET average_rating = (SELECT COALESCE(AVG(score), 0) FROM ratings WHERE reviewee_id = $1),
           total_ratings = (SELECT COUNT(*) FROM ratings WHERE reviewee_id = $1)
       WHERE id = $1`,
      [revieweeId]
    );

    // Clear rating_pending if both parties have rated
    const ratingsCountRes = await query('SELECT COUNT(*) FROM ratings WHERE escrow_id = $1', [escrowId]);
    const ratingsCount = parseInt(ratingsCountRes.rows[0].count);
    if (ratingsCount >= 2) {
      await query('UPDATE escrows SET rating_pending = false WHERE id = $1', [escrowId]);
    }

    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// GET /api/ratings/:userId - Get all ratings for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { rows } = await query(
      `SELECT r.*, u.display_name as reviewer_name, u.avatar_url as reviewer_avatar
       FROM ratings r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({ ratings: rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

module.exports = router;
