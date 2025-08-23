const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * @route   GET /api/schools/:urn
 * @desc    Get detailed school information by URN
 * @example /api/schools/100000
 */
router.get('/:urn', async (req, res) => {
  try {
    const { urn } = req.params;
    
    // Validate URN
    if (!urn || isNaN(urn)) {
      return res.status(400).json({ 
        error: 'Invalid URN provided' 
      });
    }

    // Get basic school information
    const schoolQuery = `
      SELECT 
        s.*,
        o.overall_effectiveness as ofsted_rating,
        o.inspection_date,
        o.publication_date,
        o.overall_effectiveness as ofsted_score,
        o.quality_of_education,
        o.behaviour_and_attitudes,
        o.personal_development,
        o.leadership_and_management,
        o.safeguarding_effective,
        o.sixth_form_provision,
        o.early_years_provision,
        o.previous_inspection_date,
        o.previous_overall_effectiveness,
        c.number_on_roll,
        c.number_girls,
        c.number_boys,
        c.percentage_fsm_ever6,
        c.percentage_eal,
        c.percentage_sen_support,
        c.percentage_sen_ehcp,
        a.overall_absence_rate,
        a.persistent_absence_rate,
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
      LEFT JOIN uk_absence_data a ON s.urn = a.urn
      WHERE s.urn = $1
    `;
    
    const schoolResult = await query(schoolQuery, [urn]);
    
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'School not found' 
      });
    }

    const school = schoolResult.rows[0];
    
    // Format the response
    res.json({
      success: true,
      school: {
        // Basic Information
        urn: school.urn,
        name: school.name,
        type: school.type_of_establishment,
        phase: school.phase_of_education,
        status: school.establishment_status,
        
        // Contact & Location
        address: {
          street: school.street,
          locality: school.locality,
          town: school.town,
          postcode: school.postcode,
          local_authority: school.local_authority
        },
        
        // School Characteristics
        characteristics: {
          gender: school.gender,
          age_range: `${school.age_range_lower || 'N/A'} - ${school.age_range_upper || 'N/A'}`,
          religious_character: school.religious_character,
          admissions_policy: school.admissions_policy
        },
        
        // Student Demographics
        demographics: {
          total_students: school.number_on_roll,
          girls: school.number_girls,
          boys: school.number_boys,
          fsm_percentage: school.percentage_fsm_ever6,
          eal_percentage: school.percentage_eal,
          sen_support_percentage: school.percentage_sen_support,
          sen_ehcp_percentage: school.percentage_sen_ehcp
        },
        
        // Attendance
        attendance: {
          overall_absence_rate: school.overall_absence_rate,
          persistent_absence_rate: school.persistent_absence_rate
        },
        
        // Ofsted Information
        ofsted: {
          overall_effectiveness: school.ofsted_rating,
          overall_label: getOfstedLabel(school.ofsted_rating),
          inspection_date: school.inspection_date,
          publication_date: school.publication_date,
          quality_of_education: school.quality_of_education,
          behaviour_and_attitudes: school.behaviour_and_attitudes,
          personal_development: school.personal_development,
          leadership_and_management: school.leadership_and_management,
          safeguarding_effective: school.safeguarding_effective,
          sixth_form_provision: school.sixth_form_provision,
          early_years_provision: school.early_years_provision,
          previous_inspection_date: school.previous_inspection_date,
          previous_overall_effectiveness: school.previous_overall_effectiveness
        },
        
        // Overall Rating (calculated)
        overall_rating: school.overall_rating || 5
      }
    });

  } catch (error) {
    console.error('School fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch school information',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/schools/:urn/performance
 * @desc    Get school performance data (KS2, KS4, KS5)
 * @example /api/schools/100000/performance
 */
router.get('/:urn/performance', async (req, res) => {
  try {
    const { urn } = req.params;
    
    // Get KS2 Performance
    const ks2Query = `
      SELECT * FROM uk_ks2_performance 
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    
    // Get KS4 Performance
    const ks4Query = `
      SELECT * FROM uk_ks4_performance 
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    
    // Get KS5 Performance
    const ks5Query = `
      SELECT * FROM uk_ks5_performance 
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    
    // Get Destinations Data
    const ks4DestQuery = `
      SELECT * FROM uk_ks4_destinations 
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    
    const ks5DestQuery = `
      SELECT * FROM uk_ks5_destinations 
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;

    // Execute all queries in parallel
    const [ks2Result, ks4Result, ks5Result, ks4DestResult, ks5DestResult] = await Promise.all([
      query(ks2Query, [urn]),
      query(ks4Query, [urn]),
      query(ks5Query, [urn]),
      query(ks4DestQuery, [urn]),
      query(ks5DestQuery, [urn])
    ]);

    res.json({
      success: true,
      performance: {
        ks2: ks2Result.rows[0] || null,
        ks4: ks4Result.rows[0] || null,
        ks5: ks5Result.rows[0] || null,
        destinations: {
          ks4: ks4DestResult.rows[0] || null,
          ks5: ks5DestResult.rows[0] || null
        }
      }
    });

  } catch (error) {
    console.error('Performance fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch performance data',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/schools/:urn/performance/detailed
 * @desc    Get detailed subject-level performance data
 * @example /api/schools/100000/performance/detailed
 */
router.get('/:urn/performance/detailed', async (req, res) => {
  try {
    const { urn } = req.params;
    
    // Get subject value-added scores
    const subjectVAQuery = `
      SELECT 
        subject_name,
        qualification_type,
        value_added_score,
        lower_confidence_limit,
        upper_confidence_limit,
        number_of_entries,
        cohort_size
      FROM uk_subject_value_added
      WHERE urn = $1
      ORDER BY number_of_entries DESC
    `;
    
    // Get qualification value-added scores
    const qualVAQuery = `
      SELECT 
        qualification_type,
        value_added_score,
        lower_confidence_limit,
        upper_confidence_limit,
        number_of_entries,
        cohort_size
      FROM uk_qualification_value_added
      WHERE urn = $1
      ORDER BY number_of_entries DESC
    `;
    
    // Get KS5 STEM participation
    const stemQuery = `
      SELECT * FROM uk_ks5_stem_participation
      WHERE urn = $1
      LIMIT 1
    `;

    const [subjectVA, qualVA, stem] = await Promise.all([
      query(subjectVAQuery, [urn]),
      query(qualVAQuery, [urn]),
      query(stemQuery, [urn])
    ]);

    res.json({
      success: true,
      detailed_performance: {
        subject_value_added: subjectVA.rows,
        qualification_value_added: qualVA.rows,
        stem_participation: stem.rows[0] || null
      }
    });

  } catch (error) {
    console.error('Detailed performance fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch detailed performance data',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/schools/:urn/nearby
 * @desc    Get nearby schools (same local authority for now)
 * @example /api/schools/100000/nearby
 */
router.get('/:urn/nearby', async (req, res) => {
  try {
    const { urn } = req.params;
    const { limit = 10 } = req.query;
    
    // First get the school's local authority
    const schoolQuery = `
      SELECT local_authority, phase_of_education, postcode
      FROM uk_schools
      WHERE urn = $1
    `;
    
    const schoolResult = await query(schoolQuery, [urn]);
    
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    const school = schoolResult.rows[0];
    
    // Find nearby schools in same LA and similar phase
    const nearbyQuery = `
      SELECT 
        s.urn,
        s.name,
        s.type_of_establishment,
        s.postcode,
        s.town,
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
      WHERE s.local_authority = $1
        AND s.urn != $2
        AND s.phase_of_education = $3
      ORDER BY s.name
      LIMIT $4
    `;
    
    const nearbyResult = await query(nearbyQuery, [
      school.local_authority,
      urn,
      school.phase_of_education,
      parseInt(limit)
    ]);

    res.json({
      success: true,
      current_school: {
        urn: urn,
        local_authority: school.local_authority,
        phase: school.phase_of_education
      },
      nearby_schools: nearbyResult.rows.map(s => ({
        ...s,
        ofsted_label: getOfstedLabel(s.ofsted_rating)
      }))
    });

  } catch (error) {
    console.error('Nearby schools fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nearby schools',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/schools/:urn/comparison
 * @desc    Get comparison data with similar schools
 * @example /api/schools/100000/comparison
 */
router.get('/:urn/comparison', async (req, res) => {
  try {
    const { urn } = req.params;
    
    // Get school details and performance for comparison
    const comparisonQuery = `
      SELECT 
        s.urn,
        s.name,
        s.phase_of_education,
        s.local_authority,
        o.overall_effectiveness as ofsted_rating,
        c.percentage_fsm_ever6,
        c.number_on_roll,
        ks4.progress_8_score,
        ks4.attainment_8_score,
        ks4.basics_9_5_percentage,
        ks2.rwm_expected_percentage,
        ks2.reading_progress,
        ks2.maths_progress
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn = o.urn
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      LEFT JOIN uk_ks4_performance ks4 ON s.urn = ks4.urn
      LEFT JOIN uk_ks2_performance ks2 ON s.urn = ks2.urn
      WHERE s.urn = $1
    `;
    
    const schoolResult = await query(comparisonQuery, [urn]);
    
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    const school = schoolResult.rows[0];
    
    // Get LA average
    const laAverageQuery = `
      SELECT 
        AVG(c.percentage_fsm_ever6) as avg_fsm,
        AVG(ks4.progress_8_score) as avg_progress_8,
        AVG(ks4.attainment_8_score) as avg_attainment_8,
        AVG(ks2.rwm_expected_percentage) as avg_ks2_expected,
        COUNT(DISTINCT s.urn) as school_count
      FROM uk_schools s
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      LEFT JOIN uk_ks4_performance ks4 ON s.urn = ks4.urn
      LEFT JOIN uk_ks2_performance ks2 ON s.urn = ks2.urn
      WHERE s.local_authority = $1
        AND s.phase_of_education = $2
    `;
    
    const laResult = await query(laAverageQuery, [school.local_authority, school.phase_of_education]);
    
    // Get national average
    const nationalAverageQuery = `
      SELECT 
        AVG(c.percentage_fsm_ever6) as avg_fsm,
        AVG(ks4.progress_8_score) as avg_progress_8,
        AVG(ks4.attainment_8_score) as avg_attainment_8,
        AVG(ks2.rwm_expected_percentage) as avg_ks2_expected,
        COUNT(DISTINCT s.urn) as school_count
      FROM uk_schools s
      LEFT JOIN uk_census_data c ON s.urn = c.urn
      LEFT JOIN uk_ks4_performance ks4 ON s.urn = ks4.urn
      LEFT JOIN uk_ks2_performance ks2 ON s.urn = ks2.urn
      WHERE s.phase_of_education = $1
    `;
    
    const nationalResult = await query(nationalAverageQuery, [school.phase_of_education]);

    res.json({
      success: true,
      comparison: {
        school: school,
        local_authority_average: laResult.rows[0],
        national_average: nationalResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Comparison fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch comparison data',
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