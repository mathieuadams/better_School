const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * @route   GET /api/search
 * @desc    Search schools by name, postcode, or location
 * @query   q (search term), type (name|postcode|location), limit, offset
 * @example /api/search?q=Westminster&type=name&limit=10
 */
router.get('/', async (req, res) => {
  try {
    const { 
      q, 
      type = 'all',
      limit = 20, 
      offset = 0,
      phase,
      ofsted,
      la 
    } = req.query;

    // Validate search query
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters long' 
      });
    }

    // Build the SQL query - now using stored overall_rating
    let sqlQuery = `
      SELECT 
        s.urn,
        s.name,
        s.postcode,
        s.town,
        s.local_authority,
        s.phase_of_education,
        s.type_of_establishment,
        s.street,
        s.religious_character,
        s.gender,
        s.overall_rating,
        s.rating_percentile,
        o.overall_effectiveness as ofsted_rating,
        o.inspection_date,
        c.number_on_roll,
        c.percentage_fsm_ever6 as fsm_percentage
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add search conditions based on type
    const searchTerm = `%${q.trim()}%`;
    
    if (type === 'name') {
      paramCount++;
      sqlQuery += ` AND LOWER(s.name) LIKE LOWER($${paramCount})`;
      params.push(searchTerm);
    } else if (type === 'postcode') {
      paramCount++;
      sqlQuery += ` AND LOWER(s.postcode) LIKE LOWER($${paramCount})`;
      params.push(searchTerm);
    } else if (type === 'location') {
      paramCount++;
      paramCount++;
      sqlQuery += ` AND (LOWER(s.town) LIKE LOWER($${paramCount-1}) OR LOWER(s.local_authority) LIKE LOWER($${paramCount}))`;
      params.push(searchTerm);
      params.push(searchTerm);
    } else {
      // Search all fields
      paramCount++;
      paramCount++;
      paramCount++;
      paramCount++;
      sqlQuery += ` AND (
        LOWER(s.name) LIKE LOWER($${paramCount-3}) OR 
        LOWER(s.postcode) LIKE LOWER($${paramCount-2}) OR 
        LOWER(s.town) LIKE LOWER($${paramCount-1}) OR 
        LOWER(s.local_authority) LIKE LOWER($${paramCount})
      )`;
      params.push(searchTerm);
      params.push(searchTerm);
      params.push(searchTerm);
      params.push(searchTerm);
    }

    // Add filters if provided
    if (phase) {
      paramCount++;
      sqlQuery += ` AND s.phase_of_education = $${paramCount}`;
      params.push(phase);
    }

    if (ofsted) {
      paramCount++;
      sqlQuery += ` AND o.overall_effectiveness = $${paramCount}`;
      params.push(parseInt(ofsted));
    }

    if (la) {
      paramCount++;
      sqlQuery += ` AND LOWER(s.local_authority) = LOWER($${paramCount})`;
      params.push(la);
    }

    // Order by overall_rating if available, otherwise by name
    sqlQuery += ` ORDER BY s.overall_rating DESC NULLS LAST, s.name ASC`;
    
    paramCount++;
    sqlQuery += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    sqlQuery += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    // Execute search query
    console.log('Executing search for:', q, 'Type:', type);
    
    const result = await query(sqlQuery, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      WHERE 1=1
    `;
    
    // Add the same WHERE conditions for count (without LIMIT/OFFSET)
    const countParams = params.slice(0, -2); // Remove limit and offset params
    
    if (type === 'name') {
      countQuery += ` AND LOWER(s.name) LIKE LOWER($1)`;
    } else if (type === 'postcode') {
      countQuery += ` AND LOWER(s.postcode) LIKE LOWER($1)`;
    } else if (type === 'location') {
      countQuery += ` AND (LOWER(s.town) LIKE LOWER($1) OR LOWER(s.local_authority) LIKE LOWER($2))`;
    } else {
      countQuery += ` AND (
        LOWER(s.name) LIKE LOWER($1) OR 
        LOWER(s.postcode) LIKE LOWER($2) OR 
        LOWER(s.town) LIKE LOWER($3) OR 
        LOWER(s.local_authority) LIKE LOWER($4)
      )`;
    }

    // Add filter conditions to count query if they exist
    let countParamOffset = type === 'location' ? 2 : (type === 'all' ? 4 : 1);
    
    if (phase) {
      countQuery += ` AND s.phase_of_education = $${countParamOffset + 1}`;
      countParamOffset++;
    }
    
    if (ofsted) {
      countQuery += ` AND o.overall_effectiveness = $${countParamOffset + 1}`;
      countParamOffset++;
    }
    
    if (la) {
      countQuery += ` AND LOWER(s.local_authority) = LOWER($${countParamOffset + 1})`;
    }

    const countResult = await query(countQuery, countParams);

    // Format response
    res.json({
      success: true,
      query: q,
      type: type,
      total: parseInt(countResult.rows[0]?.total || 0),
      limit: parseInt(limit),
      offset: parseInt(offset),
      schools: result.rows.map(school => ({
        ...school,
        ofsted_label: getOfstedLabel(school.ofsted_rating),
        overall_rating: school.overall_rating ? parseFloat(school.overall_rating) : null,
        rating_display: school.overall_rating ? `${parseFloat(school.overall_rating).toFixed(1)}/10` : 'N/A',
        percentile_text: school.rating_percentile ? `Top ${100 - school.rating_percentile}%` : null
      }))
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to search schools',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/search/postcode/:postcode
 * @desc    Search schools by specific postcode
 * @example /api/search/postcode/SW1A%201AA
 */
router.get('/postcode/:postcode', async (req, res) => {
  try {
    const { postcode } = req.params;
    const { radius = 3 } = req.query;

    // Now using stored overall_rating
    const sqlQuery = `
      SELECT 
        s.*,
        o.overall_effectiveness as ofsted_rating,
        c.number_on_roll
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      WHERE UPPER(SUBSTRING(s.postcode, 1, 4)) = UPPER(SUBSTRING($1, 1, 4))
      ORDER BY s.overall_rating DESC NULLS LAST, s.name
      LIMIT 50
    `;
    
    const result = await query(sqlQuery, [postcode]);
    
    res.json({
      success: true,
      postcode: postcode,
      radius: radius,
      total: result.rows.length,
      schools: result.rows.map(school => ({
        ...school,
        ofsted_label: getOfstedLabel(school.ofsted_rating),
        overall_rating: school.overall_rating ? parseFloat(school.overall_rating) : null,
        rating_display: school.overall_rating ? `${parseFloat(school.overall_rating).toFixed(1)}/10` : 'N/A'
      }))
    });

  } catch (error) {
    console.error('Postcode search error:', error);
    res.status(500).json({ 
      error: 'Failed to search by postcode',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/search/city/:city
 * @desc    Get top schools for a city/town
 * @example /api/search/city/london?limit=10
 */
router.get('/city/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { limit = 10, phase } = req.query;

    let sqlQuery = `
      SELECT 
        s.urn,
        s.name,
        s.postcode,
        s.town,
        s.phase_of_education,
        s.type_of_establishment,
        COALESCE(s.overall_rating, 5.0) as overall_rating,  -- Use stored rating or default to 5
        s.rating_percentile,
        o.overall_effectiveness as ofsted_rating,
        c.number_on_roll
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      WHERE LOWER(s.town) = LOWER($1) OR LOWER(s.local_authority) = LOWER($1)
    `;

    const params = [city];
    
    if (phase) {
      sqlQuery += ` AND s.phase_of_education = $2`;
      params.push(phase);
    }

    sqlQuery += ` ORDER BY s.overall_rating DESC NULLS LAST, o.overall_effectiveness ASC NULLS LAST`;
    sqlQuery += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(sqlQuery, params);

    // Get city statistics
    const statsSql = `
      SELECT 
        COUNT(DISTINCT s.urn) as total_schools,
        COUNT(DISTINCT CASE WHEN s.phase_of_education = 'Primary' THEN s.urn END) as primary_count,
        COUNT(DISTINCT CASE WHEN s.phase_of_education = 'Secondary' THEN s.urn END) as secondary_count,
        COUNT(DISTINCT CASE WHEN o.overall_effectiveness = 1 THEN s.urn END) as outstanding_count,
        COUNT(DISTINCT CASE WHEN o.overall_effectiveness = 2 THEN s.urn END) as good_count,
        AVG(s.overall_rating) as avg_rating
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      WHERE LOWER(s.town) = LOWER($1) OR LOWER(s.local_authority) = LOWER($1)
    `;

    const statsResult = await query(statsSql, [city]);
    const stats = statsResult.rows[0];

    res.json({
      success: true,
      city: city,
      statistics: {
        total_schools: parseInt(stats.total_schools) || 0,
        primary_schools: parseInt(stats.primary_count) || 0,
        secondary_schools: parseInt(stats.secondary_count) || 0,
        outstanding_schools: parseInt(stats.outstanding_count) || 0,
        good_schools: parseInt(stats.good_count) || 0,
        average_rating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : null
      },
      top_schools: result.rows.map(school => ({
        ...school,
        ofsted_label: getOfstedLabel(school.ofsted_rating),
        overall_rating: school.overall_rating ? parseFloat(school.overall_rating) : null,
        rating_display: school.overall_rating ? `${parseFloat(school.overall_rating).toFixed(1)}/10` : 'N/A'
      }))
    });

  } catch (error) {
    console.error('City search error:', error);
    res.status(500).json({ 
      error: 'Failed to get schools for city',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/search/suggestions
 * @desc    Get autocomplete suggestions
 * @query   q (search term)
 * @example /api/search/suggestions?q=West
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const sqlQuery = `
      (
        SELECT DISTINCT 
          name as suggestion,
          'school' as type,
          urn as id,
          overall_rating
        FROM uk_schools
        WHERE LOWER(name) LIKE LOWER($1)
        ORDER BY overall_rating DESC NULLS LAST
        LIMIT 5
      )
      UNION ALL
      (
        SELECT DISTINCT 
          town as suggestion,
          'town' as type,
          NULL as id,
          NULL as overall_rating
        FROM uk_schools
        WHERE LOWER(town) LIKE LOWER($1)
        AND town IS NOT NULL
        LIMIT 3
      )
      UNION ALL
      (
        SELECT DISTINCT 
          local_authority as suggestion,
          'la' as type,
          NULL as id,
          NULL as overall_rating
        FROM uk_schools
        WHERE LOWER(local_authority) LIKE LOWER($1)
        AND local_authority IS NOT NULL
        LIMIT 2
      )
      LIMIT 10
    `;
    
    const result = await query(sqlQuery, [`${q}%`]);
    
    res.json({
      success: true,
      suggestions: result.rows.map(row => ({
        ...row,
        rating_display: row.overall_rating ? `${parseFloat(row.overall_rating).toFixed(1)}/10` : null
      }))
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ 
      error: 'Failed to get suggestions',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/search/filters
 * @desc    Get available filter options
 * @example /api/search/filters
 */
router.get('/filters', async (req, res) => {
  try {
    // Get unique phases
    const phasesQuery = `
      SELECT DISTINCT phase_of_education as value, COUNT(*) as count
      FROM uk_schools
      WHERE phase_of_education IS NOT NULL
      GROUP BY phase_of_education
      ORDER BY count DESC
    `;
    
    // Get unique local authorities
    const laQuery = `
      SELECT DISTINCT local_authority as value, COUNT(*) as count
      FROM uk_schools
      WHERE local_authority IS NOT NULL
      GROUP BY local_authority
      ORDER BY local_authority
    `;
    
    // Get unique school types
    const typesQuery = `
      SELECT DISTINCT type_of_establishment as value, COUNT(*) as count
      FROM uk_schools
      WHERE type_of_establishment IS NOT NULL
      GROUP BY type_of_establishment
      ORDER BY count DESC
      LIMIT 20
    `;

    const [phases, localAuthorities, types] = await Promise.all([
      query(phasesQuery),
      query(laQuery),
      query(typesQuery)
    ]);

    res.json({
      success: true,
      filters: {
        phases: phases.rows,
        localAuthorities: localAuthorities.rows,
        types: types.rows,
        ofstedRatings: [
          { value: 1, label: 'Outstanding', count: null },
          { value: 2, label: 'Good', count: null },
          { value: 3, label: 'Requires Improvement', count: null },
          { value: 4, label: 'Inadequate', count: null }
        ]
      }
    });

  } catch (error) {
    console.error('Filters error:', error);
    res.status(500).json({ 
      error: 'Failed to get filters',
      message: error.message 
    });
  }
});

// Helper function to convert Ofsted rating to label
function getOfstedLabel(rating) {
  const labels = {
    1: 'Outstanding',
    2: 'Good',
    3: 'Requires Improvement',
    4: 'Inadequate'
  };
  return labels[rating] || 'Not Inspected';
}

module.exports = router;