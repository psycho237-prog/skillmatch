const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// GET /api/services - Get all services with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, min_price, max_price, location, sort, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('services')
      .select('*, users!services_user_id_fkey(display_name, avatar_url)')
      .eq('is_active', true);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    if (min_price) {
      query = query.gte('price', parseFloat(min_price));
    }
    if (max_price) {
      query = query.lte('price', parseFloat(max_price));
    }
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    if (sort === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('price', { ascending: false });
    } else if (sort === 'rating') {
      query = query.order('rating', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ services: data, count: data.length });
  } catch (error) {
    console.error('Services fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/services/featured - Get featured services
router.get('/featured', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*, users!services_user_id_fkey(display_name, avatar_url)')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('rating', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ services: data });
  } catch (error) {
    console.error('Featured fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch featured services' });
  }
});

// GET /api/services/categories - Get distinct categories
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ categories: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/services/:id - Get single service
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*, users!services_user_id_fkey(id, display_name, avatar_url, email), reviews(*, users(display_name, avatar_url))')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ service: data });
  } catch (error) {
    res.status(404).json({ error: 'Service not found' });
  }
});

// POST /api/services - Create a new service
router.post('/', async (req, res) => {
  try {
    const {
      user_id, title, description, category, price, price_type,
      location, latitude, longitude, images, tags
    } = req.body;

    if (!user_id || !title || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        user_id,
        title,
        description,
        category,
        price: price || 0,
        price_type: price_type || 'negotiable',
        location: location || '',
        latitude: latitude || null,
        longitude: longitude || null,
        images: images || [],
        tags: tags || [],
        rating: 0,
        review_count: 0,
        is_active: true,
        is_featured: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ service: data });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT /api/services/:id - Update a service
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ service: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id - Delete a service
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
