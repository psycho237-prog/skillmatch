const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/services - Get all services with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, min_price, max_price, location, sort, limit = 20, offset = 0, user_id } = req.query;

    let sql = `
      SELECT s.*, 
             json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as users,
             (SELECT COUNT(*) FROM favorites WHERE service_id = s.id) as likes_count,
             EXISTS(SELECT 1 FROM favorites WHERE service_id = s.id AND user_id = $1) as is_favorited
      FROM services s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true
    `;
    const params = [user_id || null];
    let paramCount = 2;

    if (category && category !== 'All') {
      sql += ` AND s.category = $${paramCount++}`;
      params.push(category);
    }
    if (min_price) {
      sql += ` AND s.price >= $${paramCount++}`;
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      sql += ` AND s.price <= $${paramCount++}`;
      params.push(parseFloat(max_price));
    }
    if (location) {
      sql += ` AND s.location ILIKE $${paramCount++}`;
      params.push(`%${location}%`);
    }

    if (sort === 'price_asc') {
      sql += ' ORDER BY s.price ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY s.price DESC';
    } else if (sort === 'rating') {
      sql += ' ORDER BY s.rating DESC';
    } else {
      sql += ' ORDER BY s.created_at DESC';
    }

    sql += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);
    
    // Convert users object appropriately equivalent to Supabase response
    const formattedData = rows.map(r => ({
      ...r,
      users: r.users
    }));

    res.json({ services: formattedData, count: rows.length });
  } catch (error) {
    console.error('Services fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});













// GET /api/services/categories - Get distinct categories
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/services/featured - Get featured services
router.get('/featured', async (req, res) => {
  try {
    const { user_id } = req.query;
    const { rows } = await query(`
      SELECT s.*, 
             json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as users,
             (SELECT COUNT(*) FROM favorites WHERE service_id = s.id) as likes_count,
             EXISTS(SELECT 1 FROM favorites WHERE service_id = s.id AND user_id = $1) as is_favorited
      FROM services s
      JOIN users u ON u.id = s.user_id
      WHERE s.is_active = true 
      ORDER BY s.featured DESC, s.rating DESC, s.created_at DESC
      LIMIT 10
    `, [user_id || null]);

    res.json({ services: rows });
  } catch (error) {
    console.error('Featured fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch featured services' });
  }
});

// GET /api/services/:id - Get single service
router.get('/:id', async (req, res) => {
  try {
    const serviceRes = await query(`
      SELECT s.*, 
             json_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'phone_number', u.phone_number) as users,
             (SELECT COUNT(*) FROM favorites WHERE service_id = s.id) as likes_count,
             EXISTS(SELECT 1 FROM favorites WHERE service_id = s.id AND user_id = $2) as is_favorited
      FROM services s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `, [req.params.id, req.query.user_id || null]);

    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceRes.rows[0];

    // Fetch reviews
    const reviewsRes = await query(`
      SELECT r.*, json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as users
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.service_id = $1
      ORDER BY r.created_at DESC
    `, [req.params.id]);

    service.reviews = reviewsRes.rows;

    res.json({ service });
  } catch (error) {
    console.error('Service details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//UPDATE FEATURED SCORE
async function updateFeaturedScore(serviceId){
  const sql = `
  UPDATE services s
  SET featured = (
    (s.rating * 0.5) + (s.review_count * 0.2) + (SELECT COUNT(*) FROM favorites f WHERE f.service_id = s.id) * 0.3 + 
    CASE
      WHEN s.created_at > NOW() - INTERVAL '7 days' THEN 10 
      WHEN s.created_at > NOW() - INTERVAL '30 days' THEN 5
      ELSE 0
      END 
  ),
  updated_at = NOW()
  WHERE s.id=$1
  `;

  await query(sql, [serviceId]);
}

// POST /api/services - Create a new service
router.post('/', async (req, res) => {
  try {
    const {
      user_id, title, description, category, price, price_type,
      currency, barter_skill,
      location, latitude, longitude, images, tags,
      service_type, holdup_amount, country
    } = req.body;

    if (!user_id || !title || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify user exists to prevent foreign key violation
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User session not found in database. Please log out and log in again.' });
    }

    const effectivePriceType = price_type || 'negotiable';
    const freshnessBonus = 10;
    const featuredScore = freshnessBonus;

    const insertSql = `
      INSERT INTO services (
        user_id, title, description, category, price, price_type,
        currency, barter_skill,
        location, latitude, longitude, images, tags,
        rating, review_count, featured, is_active, service_type, holdup_amount, country, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, $14, true, $15, $16, $17, NOW(), NOW()
      ) RETURNING *
    `;

    const params = [
      user_id, title, description, category,
      effectivePriceType === 'exchange' ? 0 : (price || 0),
      effectivePriceType,
      currency || 'XAF',
      barter_skill || null,
      location || '', latitude || null, longitude || null,
      images || '{}', tags || '{}',
      featuredScore,
      service_type || 'SKILL_TO_CASH',
      holdup_amount ? parseFloat(holdup_amount) : 0.00,
      country || 'CMR'
    ];

    const { rows } = await query(insertSql, params);
    const service = rows[0];

    console.log(`[SERVICE ADDED] ID: ${service.id} | Title: ${service.title} | Type: ${effectivePriceType} | Escrow: ${service.service_type}`);

    res.status(201).json({ service });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// POST /api/services/:id/reviews - Add a review and update aggregates
router.post('/:id/reviews', async (req, res) => {
  try {
    const { user_id, rating, content } = req.body;
    if (!user_id || !rating) return res.status(400).json({ error: 'Missing fields' });

    // Insert the review
    await query(
      'INSERT INTO reviews (service_id, user_id, rating, content) VALUES ($1, $2, $3, $4)', 
      [req.params.id, user_id, rating, content || '']
    );
    
    
    // Update service rating rolling average and count dynamically
    await query(`
      UPDATE services 
      SET rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE service_id = $1),
          review_count = (SELECT COUNT(*) FROM reviews WHERE service_id = $1)
      WHERE id = $1
    `, [req.params.id]);

    await updateFeaturedScore(req.params.id);
    res.json({ success: true, message: 'Rating applied' });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// PUT /api/services/:id - Update a service
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;

    // Check service existence and owner
    const serviceRes = await query('SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL', [serviceId]);
    if (serviceRes.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = serviceRes.rows[0];

    if (service.user_id !== userId) {
      return res.status(403).json({ error: 'Only the service owner can edit this service' });
    }

    const {
      title, description, category, price, price_type,
      currency, barter_skill, location, images,
      service_type, holdup_amount, country
    } = req.body;

    const sql = `
      UPDATE services 
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          price = COALESCE($4, price),
          price_type = COALESCE($5, price_type),
          currency = COALESCE($6, currency),
          barter_skill = $7,
          location = COALESCE($8, location),
          images = COALESCE($9, images),
          service_type = COALESCE($10, service_type),
          holdup_amount = COALESCE($11, holdup_amount),
          country = COALESCE($12, country),
          updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `;

    const params = [
      title || null,
      description || null,
      category || null,
      price !== undefined ? parseFloat(price) : null,
      price_type || null,
      currency || null,
      barter_skill !== undefined ? barter_skill : null,
      location || null,
      images || null,
      service_type || null,
      holdup_amount !== undefined ? (holdup_amount ? parseFloat(holdup_amount) : 0.00) : null,
      country || null,
      serviceId
    ];

    const updateRes = await query(sql, params);
    res.json({ service: updateRes.rows[0], message: 'Service updated successfully' });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id - Delete a service (Soft Delete with escrow verification)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;

    // Check service existence and owner
    const serviceRes = await query('SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL', [serviceId]);
    if (serviceRes.rowCount === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = serviceRes.rows[0];

    if (service.user_id !== userId) {
      return res.status(403).json({ error: 'Only the service owner can delete this service' });
    }

    // Block if any escrow linked has active status (not in COMPLETED, CANCELLED, REFUNDED, FORFEITED)
    const activeEscrowRes = await query(
      `SELECT id FROM escrows 
       WHERE service_id = $1 
         AND status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED', 'FORFEITED')`,
      [serviceId]
    );

    if (activeEscrowRes.rowCount > 0) {
      return res.status(400).json({ error: 'Cannot delete service with an active transaction. Wait for all transactions to complete or cancel them first.' });
    }

    // Soft delete only — set service.deletedAt = now and is_active = false
    await query('UPDATE services SET deleted_at = NOW(), is_active = false WHERE id = $1', [serviceId]);
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// POST /api/services/:id/favorite - Toggle favorite
router.post('/:id/favorite', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    // Optimized atomic toggle
    const deleteRes = await query('DELETE FROM favorites WHERE user_id = $1 AND service_id = $2', [user_id, req.params.id]);
    await updateFeaturedScore(req.params.id);

    if (deleteRes.rowCount > 0) {
      res.json({ favorited: false, message: 'Removed from favorites' });
    } else {
      try {
        await query('INSERT INTO favorites (user_id, service_id) VALUES ($1, $2)', [user_id, req.params.id]);
        await updateFeaturedScore(req.params.id);
        res.json({ favorited: true, message: 'Added to favorites' });
      } catch (insertError) {
        if (insertError.code === '23505') {
           res.json({ favorited: true, message: 'Already favorited' });
        } else {
           throw insertError;
        }
      }
    }
  } catch (error) {
    console.error('Favorite error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

module.exports = router;
