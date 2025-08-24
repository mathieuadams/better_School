const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function getOfstedLabel(rating) {
  const labels = { 1: 'Outstanding', 2: 'Good', 3: 'Requires Improvement', 4: 'Inadequate' };
  return labels[rating] || 'Not Inspected';
}

function toNumber(n) { return (n === null || n === undefined || n === '') ? null : Number(n); }

// ------------------------------------------------------------------
// GET /api/schools/:urn  (robust: separate queries, more fields)
// ------------------------------------------------------------------
router.get('/:urn', async (req, res) => {
  try {
    const { urn } = req.params;
    if (!urn || isNaN(urn)) return res.status(400).json({ error: 'Invalid URN provided' });

    // 1) Base school row (never fail when other tables are missing)
    const baseSql = `
      SELECT
        s.urn, s.name, s.phase_of_education, s.type_of_establishment, s.establishment_status,
        s.street, s.locality, s.town, s.postcode, s.local_authority,
        s.gender, s.age_range_lower, s.age_range_upper, s.religious_character, s.admissions_policy,
        /* contact + geo – use whatever exists */
        s.telephone, s.phone, s.telephone_number,
        s.school_website, s.website, s.school_website_url,
        s.headteacher_name, s.headteacher, s.headteacher_first_name, s.headteacher_last_name,
        s.latitude, s.longitude, s.lat, s.lng
      FROM uk_schools s
      WHERE s.urn = $1
      LIMIT 1
    `;
    const base = await query(baseSql, [urn]);
    if (base.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const s = base.rows[0];

    // 2) Ofsted (take the most recent inspection we have)
    const ofstedSql = `
      SELECT
        overall_effectiveness, inspection_date, publication_date,
        quality_of_education, behaviour_and_attitudes, personal_development,
        leadership_and_management, safeguarding_effective, sixth_form_provision, early_years_provision,
        previous_inspection_date, previous_overall_effectiveness,
        web_link, report_url
      FROM uk_ofsted_inspections
      WHERE urn = $1
      ORDER BY inspection_date DESC NULLS LAST, publication_date DESC NULLS LAST
      LIMIT 1
    `;

    // 3) Census (latest)
    const censusSql = `
      SELECT number_on_roll, number_girls, number_boys,
             percentage_fsm_ever6, percentage_eal, percentage_sen_support, percentage_sen_ehcp
      FROM uk_census_data
      WHERE urn = $1
      ORDER BY academic_year DESC NULLS LAST
      LIMIT 1
    `;

    // 4) Attendance (latest)
    const attendanceSql = `
      SELECT overall_absence_rate, persistent_absence_rate
      FROM uk_absence_data
      WHERE urn = $1
      ORDER BY academic_year DESC NULLS LAST
      LIMIT 1
    `;

    const [ofstedR, censusR, attendanceR] = await Promise.all([
      query(ofstedSql, [urn]),
      query(censusSql, [urn]),
      query(attendanceSql, [urn]),
    ]);

    const o = ofstedR.rows[0] || {};
    const c = censusR.rows[0] || {};
    const a = attendanceR.rows[0] || {};

    // normalize contact fields
    const telephone =
      s.telephone || s.phone || s.telephone_number || null;

    const website =
      s.school_website || s.website || s.school_website_url || null;

    // normalize headteacher
    const headteacher_name =
      s.headteacher_name ||
      s.headteacher ||
      ([s.headteacher_first_name, s.headteacher_last_name].filter(Boolean).join(' ') || null);

    // normalize coords
    const latitude  = toNumber(s.latitude ?? s.lat);
    const longitude = toNumber(s.longitude ?? s.lng);

    // overall rating (0–10 style) derived from Ofsted if present
    let overall_rating = 5;
    if (o.overall_effectiveness === 1) overall_rating = 9;
    else if (o.overall_effectiveness === 2) overall_rating = 7;
    else if (o.overall_effectiveness === 3) overall_rating = 5;
    else if (o.overall_effectiveness === 4) overall_rating = 3;

    // Build response
    res.json({
      success: true,
      school: {
        urn: s.urn,
        name: s.name,
        type: s.type_of_establishment,
        phase: s.phase_of_education,
        status: s.establishment_status,

        telephone,
        website,
        latitude,
        longitude,
        headteacher_name,

        address: {
          street: s.street,
          locality: s.locality,
          town: s.town,
          postcode: s.postcode,
          local_authority: s.local_authority,
        },

        characteristics: {
          gender: s.gender,
          age_range: `${s.age_range_lower ?? 'N/A'} - ${s.age_range_upper ?? 'N/A'}`,
          religious_character: s.religious_character,
          admissions_policy: s.admissions_policy,
        },

        demographics: {
          total_students: c.number_on_roll,
          girls: c.number_girls,
          boys: c.number_boys,
          fsm_percentage: c.percentage_fsm_ever6,
          eal_percentage: c.percentage_eal,
          sen_support_percentage: c.percentage_sen_support,
          sen_ehcp_percentage: c.percentage_sen_ehcp,
        },

        attendance: {
          overall_absence_rate: a.overall_absence_rate,
          persistent_absence_rate: a.persistent_absence_rate,
        },

        ofsted: {
          overall_effectiveness: o.overall_effectiveness,
          overall_label: getOfstedLabel(o.overall_effectiveness),
          inspection_date: o.inspection_date,
          publication_date: o.publication_date,
          quality_of_education: o.quality_of_education,
          behaviour_and_attitudes: o.behaviour_and_attitudes,
          personal_development: o.personal_development,
          leadership_and_management: o.leadership_and_management,
          safeguarding_effective: o.safeguarding_effective,
          sixth_form_provision: o.sixth_form_provision,
          early_years_provision: o.early_years_provision,
          previous_inspection_date: o.previous_inspection_date,
          previous_overall_effectiveness: o.previous_overall_effectiveness,
          web_link: o.web_link || o.report_url || null,
        },

        overall_rating,
      },
    });
  } catch (err) {
    console.error('School fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch school information', message: err.message });
  }
});

// ------------------------------------------------------------------
// Existing routes (performance, detailed, nearby, comparison) unchanged
// ------------------------------------------------------------------

// KS2/KS4/KS5 performance (latest)
router.get('/:urn/performance', async (req, res) => {
  try {
    const { urn } = req.params;

    const ks2 = await query(`
      SELECT * FROM uk_ks2_performance WHERE urn=$1 ORDER BY academic_year DESC LIMIT 1
    `, [urn]);
    const ks4 = await query(`
      SELECT * FROM uk_ks4_performance WHERE urn=$1 ORDER BY academic_year DESC LIMIT 1
    `, [urn]);
    const ks5 = await query(`
      SELECT * FROM uk_ks5_performance WHERE urn=$1 ORDER BY academic_year DESC LIMIT 1
    `, [urn]);

    const ks4Dest = await query(`
      SELECT * FROM uk_ks4_destinations WHERE urn=$1 ORDER BY academic_year DESC LIMIT 1
    `, [urn]);
    const ks5Dest = await query(`
      SELECT * FROM uk_ks5_destinations WHERE urn=$1 ORDER BY academic_year DESC LIMIT 1
    `, [urn]);

    res.json({
      success: true,
      performance: {
        ks2: ks2.rows[0] || null,
        ks4: ks4.rows[0] || null,
        ks5: ks5.rows[0] || null,
        destinations: { ks4: ks4Dest.rows[0] || null, ks5: ks5Dest.rows[0] || null }
      }
    });
  } catch (error) {
    console.error('Performance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch performance data', message: error.message });
  }
});

// detailed performance
router.get('/:urn/performance/detailed', async (req, res) => {
  try {
    const { urn } = req.params;

    const subjectVA = await query(`
      SELECT subject_name, qualification_type, value_added_score,
             lower_confidence_limit, upper_confidence_limit,
             number_of_entries, cohort_size
      FROM uk_subject_value_added
      WHERE urn=$1
      ORDER BY number_of_entries DESC
    `, [urn]);

    const qualVA = await query(`
      SELECT qualification_type, value_added_score,
             lower_confidence_limit, upper_confidence_limit,
             number_of_entries, cohort_size
      FROM uk_qualification_value_added
      WHERE urn=$1
      ORDER BY number_of_entries DESC
    `, [urn]);

    const stem = await query(`SELECT * FROM uk_ks5_stem_participation WHERE urn=$1 LIMIT 1`, [urn]);

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
    res.status(500).json({ error: 'Failed to fetch detailed performance data', message: error.message });
  }
});

// nearby (same as before)
router.get('/:urn/nearby', async (req, res) => {
  try {
    const { urn } = req.params;
    const { limit = 10 } = req.query;

    const current = await query(`
      SELECT local_authority, phase_of_education
      FROM uk_schools
      WHERE urn = $1
      LIMIT 1
    `, [urn]);

    if (current.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const { local_authority, phase_of_education } = current.rows[0];

    const nearby = await query(`
      SELECT s.urn, s.name, s.type_of_establishment, s.postcode, s.town,
             o.overall_effectiveness as ofsted_rating,
             c.number_on_roll,
             CASE WHEN o.overall_effectiveness=1 THEN 9
                  WHEN o.overall_effectiveness=2 THEN 7
                  WHEN o.overall_effectiveness=3 THEN 5
                  WHEN o.overall_effectiveness=4 THEN 3
                  ELSE 5 END as overall_rating
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn=o.urn
      LEFT JOIN uk_census_data c ON s.urn=c.urn
      WHERE s.local_authority=$1 AND s.phase_of_education=$2 AND s.urn<>$3
      ORDER BY s.name
      LIMIT $4
    `, [local_authority, phase_of_education, urn, parseInt(limit, 10)]);

    res.json({
      success: true,
      current_school: { urn, local_authority, phase: phase_of_education },
      nearby_schools: nearby.rows.map(r => ({ ...r, ofsted_label: getOfstedLabel(r.ofsted_rating) }))
    });
  } catch (error) {
    console.error('Nearby schools fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby schools', message: error.message });
  }
});

// comparison (unchanged)
router.get('/:urn/comparison', async (req, res) => {
  try {
    const { urn } = req.params;

    const schoolR = await query(`
      SELECT s.urn, s.name, s.phase_of_education, s.local_authority,
             o.overall_effectiveness as ofsted_rating,
             c.percentage_fsm_ever6, c.number_on_roll,
             ks4.progress_8_score, ks4.attainment_8_score, ks4.basics_9_5_percentage,
             ks2.rwm_expected_percentage, ks2.reading_progress, ks2.maths_progress
      FROM uk_schools s
      LEFT JOIN uk_ofsted_inspections o ON s.urn=o.urn
      LEFT JOIN uk_census_data c ON s.urn=c.urn
      LEFT JOIN uk_ks4_performance ks4 ON s.urn=ks4.urn
      LEFT JOIN uk_ks2_performance ks2 ON s.urn=ks2.urn
      WHERE s.urn=$1
      LIMIT 1
    `, [urn]);

    if (schoolR.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const school = schoolR.rows[0];

    const laAvg = await query(`
      SELECT AVG(c.percentage_fsm_ever6) AS avg_fsm,
             AVG(ks4.progress_8_score) AS avg_progress_8,
             AVG(ks4.attainment_8_score) AS avg_attainment_8,
             AVG(ks2.rwm_expected_percentage) AS avg_ks2_expected,
             COUNT(DISTINCT s.urn) AS school_count
      FROM uk_schools s
      LEFT JOIN uk_census_data c ON s.urn=c.urn
      LEFT JOIN uk_ks4_performance ks4 ON s.urn=ks4.urn
      LEFT JOIN uk_ks2_performance ks2 ON s.urn=ks2.urn
      WHERE s.local_authority=$1 AND s.phase_of_education=$2
    `, [school.local_authority, school.phase_of_education]);

    const national = await query(`
      SELECT AVG(c.percentage_fsm_ever6) AS avg_fsm,
             AVG(ks4.progress_8_score) AS avg_progress_8,
             AVG(ks4.attainment_8_score) AS avg_attainment_8,
             AVG(ks2.rwm_expected_percentage) AS avg_ks2_expected,
             COUNT(DISTINCT s.urn) AS school_count
      FROM uk_schools s
      LEFT JOIN uk_census_data c ON s.urn=c.urn
      LEFT JOIN uk_ks4_performance ks4 ON s.urn=ks4.urn
      LEFT JOIN uk_ks2_performance ks2 ON s.urn=ks2.urn
      WHERE s.phase_of_education=$1
    `, [school.phase_of_education]);

    res.json({
      success: true,
      comparison: {
        school,
        local_authority_average: laAvg.rows[0],
        national_average: national.rows[0]
      }
    });
  } catch (error) {
    console.error('Comparison fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch comparison data', message: error.message });
  }
});

module.exports = router;
