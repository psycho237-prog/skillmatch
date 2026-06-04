const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * Intelligent contextual search for services.
 * Uses multiple strategies:
 * 1. Full-text search on title + description
 * 2. Semantic synonym expansion for common skill terms
 * 3. Category matching
 * 4. Tag matching
 * 5. Fuzzy partial matching
 */

// Synonym map for contextual search
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

function expandSearchTerms(query) {
  const lowerQuery = query.toLowerCase().trim();
  const terms = new Set([lowerQuery]);

  // Check for direct synonym matches
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (lowerQuery.includes(key) || synonyms.some(s => lowerQuery.includes(s))) {
      terms.add(key);
      synonyms.forEach(s => terms.add(s));
    }
  }

  // Split multi-word queries and check each word
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
    const { query, category, min_price, max_price, location, limit = 20, offset = 0 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const expandedTerms = expandSearchTerms(query);
    
    // Build OR conditions for expanded terms
    const orConditions = expandedTerms
      .slice(0, 10) // Limit to avoid overly broad searches
      .map(term => `title.ilike.%${term}%,description.ilike.%${term}%`)
      .join(',');

    let dbQuery = supabase
      .from('services')
      .select('*, users!services_user_id_fkey(display_name, avatar_url)')
      .eq('is_active', true)
      .or(orConditions);

    if (category && category !== 'All') {
      dbQuery = dbQuery.eq('category', category);
    }
    if (min_price) {
      dbQuery = dbQuery.gte('price', parseFloat(min_price));
    }
    if (max_price) {
      dbQuery = dbQuery.lte('price', parseFloat(max_price));
    }
    if (location) {
      dbQuery = dbQuery.ilike('location', `%${location}%`);
    }

    dbQuery = dbQuery
      .order('rating', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error } = await dbQuery;
    if (error) throw error;

    // Score and sort results by relevance
    const scoredResults = (data || []).map(service => {
      let score = 0;
      const lowerQuery = query.toLowerCase();
      const title = (service.title || '').toLowerCase();
      const description = (service.description || '').toLowerCase();

      // Exact title match gets highest score
      if (title === lowerQuery) score += 100;
      // Title contains query
      else if (title.includes(lowerQuery)) score += 50;
      // Description contains query
      if (description.includes(lowerQuery)) score += 25;
      // Rating boost
      score += (service.rating || 0) * 5;
      // Featured boost
      if (service.is_featured) score += 20;

      return { ...service, _relevance_score: score };
    });

    scoredResults.sort((a, b) => b._relevance_score - a._relevance_score);

    res.json({
      services: scoredResults,
      count: scoredResults.length,
      query,
      expanded_terms: expandedTerms.slice(0, 5),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
