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

    // Build the SQL query
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
        o.overall_effectiveness as ofsted_rating,
        o.inspection_date,
        o.overall_effectiveness as ofsted_score,
        c.number_on_roll,
        c.percentage_fsm_ever6 as fsm_percentage,
        CASE 
          WHEN o.overall_effectiveness = 1 THEN 9
          WHEN o.overall_effectiveness = 2 THEN 7
          WHEN o.overall_effectiveness = 3 THEN 5
          WHEN o.overall_effectiveness = 4 THEN 3
          ELSE 5
        END as overall_rating
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
      // Search in both town and local_authority fields
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

    // Add ordering and pagination
    sqlQuery += ` ORDER BY s.name ASC`;
    
    paramCount++;
    sqlQuery += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    sqlQuery += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    // Execute search query
    console.log('Executing search for:', q, 'Type:', type);
    console.log('SQL Query:', sqlQuery);
    console.log('Parameters:', params);
    
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
        overall_rating: school.overall_rating || 5
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

    // For now, simple postcode matching (in production, use PostGIS for radius search)
    const sqlQuery = `
      SELECT 
        s.*,
        o.overall_effectiveness as ofsted_rating,
        c.number_on_roll,
        CASE 
          WHEN o.overall_effectiveness = 1 THEN 9
          WHEN o.overall_effectiveness = 2 THEN 7
          WHEN o.overall_effectiveness = 3 THEN 5
          WHEN o.overall_effectiveness = 4 THEN 3
          ELSE 5
        END as overall_rating
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      WHERE UPPER(SUBSTRING(s.postcode, 1, 4)) = UPPER(SUBSTRING($1, 1, 4))
      ORDER BY s.name
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
        ofsted_label: getOfstedLabel(school.ofsted_rating)
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
          urn as id
        FROM uk_schools
        WHERE LOWER(name) LIKE LOWER($1)
        LIMIT 5
      )
      UNION ALL
      (
        SELECT DISTINCT 
          town as suggestion,
          'town' as type,
          NULL as id
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
          NULL as id
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
      suggestions: result.rows
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