const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

const SYNONYM_MAP = {
  'developer': ['programmer', 'coder', 'software engineer', 'dev', 'coding', 'development', 'web developer', 'app developer'],
  'designer': ['graphic designer', 'ui designer', 'ux designer', 'design', 'creative', 'artist', 'illustrator'],
  'writer': ['content writer', 'copywriter', 'author', 'blogger', 'writing', 'editing', 'proofreading'],
  'teacher': ['tutor', 'instructor', 'coach', 'mentor', 'trainer', 'teaching', 'education', 'lesson'],
  'photographer': ['photo', 'photography', 'cameraman', 'videographer', 'shooting'],
  'plumber': ['plumbing', 'pipe', 'water', 'drain', 'faucet', 'toilet repair'],
  'electrician': ['electrical', 'wiring', 'power', 'circuit', 'electric'],
  'mechanic': ['car repair', 'auto', 'vehicle', 'engine', 'automotive', 'garage'],
  'cleaner': ['cleaning', 'maid', 'housekeeping', 'janitorial', 'sanitation'],
  'chef': ['cook', 'cooking', 'cuisine', 'catering', 'meal prep', 'food'],
  'driver': ['delivery', 'transport', 'chauffeur', 'courier', 'ride', 'taxi'],
  'gardener': ['landscaping', 'lawn', 'garden', 'plants', 'yard', 'mowing'],
  'painter': ['painting', 'house painting', 'wall', 'interior', 'exterior'],
  'carpenter': ['woodwork', 'furniture', 'carpentry', 'cabinet', 'wood'],
  'translator': ['translation', 'interpreter', 'language', 'localization'],
  'accountant': ['accounting', 'bookkeeper', 'tax', 'finance', 'financial'],
  'hairdresser': ['haircut', 'stylist', 'barber', 'hair', 'beauty', 'salon'],
  'massage': ['masseuse', 'therapy', 'spa', 'wellness', 'relaxation'],
  'repair': ['fix', 'maintenance', 'handyman', 'fixing', 'broken'],
  'music': ['musician', 'guitar', 'piano', 'singing', 'vocal', 'instrument', 'dj'],
  'fitness': ['personal trainer', 'gym', 'workout', 'exercise', 'yoga', 'sport'],
  'marketing': ['seo', 'social media', 'advertising', 'digital marketing', 'branding'],
  'moving': ['mover', 'relocation', 'packing', 'hauling', 'furniture moving'],
};

function expandSearchTerms(searchQuery) {
  const lowerQuery = searchQuery.toLowerCase().trim();
  const terms = new Set([lowerQuery]);

  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (lowerQuery.includes(key) || synonyms.some(s => lowerQuery.includes(s))) {
      terms.add(key);
      synonyms.forEach(s => terms.add(s));
    }
  }

  const words = lowerQuery.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (key.includes(word) || word.includes(key) || synonyms.some(s => s.includes(word) || word.includes(s))) {
        terms.add(key);
        synonyms.forEach(s => terms.add(s));
      }
    }
  }

  return Array.from(terms);
}

// POST /api/search - Intelligent contextual search
router.post('/', async (req, res) => {
  try {
    const { query: searchQuery, category, min_price, max_price, location, limit = 20, offset = 0, user_id } = req.body;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const expandedTerms = expandSearchTerms(searchQuery).slice(0, 5); // Limit terms for pg query performance
    
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

    // Build ILIKE conditions
    if (expandedTerms.length > 0) {
        const orConditions = expandedTerms.map(term => {
            params.push(`%${term}%`);
            const p = paramCount++;
            return `(s.title ILIKE $${p} OR s.description ILIKE $${p})`;
        }).join(' OR ');
        sql += ` AND (${orConditions})`;
    }

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

    sql += ` ORDER BY s.rating DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);

    // Score and sort results by relevance
    const scoredResults = rows.map(service => {
      let score = 0;
      const lowerQuery = searchQuery.toLowerCase();
      const title = (service.title || '').toLowerCase();
      const description = (service.description || '').toLowerCase();

      if (title === lowerQuery) score += 100;
      else if (title.includes(lowerQuery)) score += 50;
      if (description.includes(lowerQuery)) score += 25;
      score += (service.rating || 0) * 5;
      if (service.is_featured) score += 20;

      return { ...service, _relevance_score: score };
    });

    scoredResults.sort((a, b) => b._relevance_score - a._relevance_score);

    res.json({
      services: scoredResults,
      count: scoredResults.length,
      query: searchQuery,
      expanded_terms: expandedTerms,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
