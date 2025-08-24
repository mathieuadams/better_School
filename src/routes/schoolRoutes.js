const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/* ---------------- helpers ---------------- */
function getOfstedLabel(rating) {
  const labels = { 1: 'Outstanding', 2: 'Good', 3: 'Requires Improvement', 4: 'Inadequate' };
  return labels[rating] || 'Not Inspected';
}
const toNum = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* =======================================================================
 * GET /api/schools/:urn
 * Returns a robust object even when optional tables are missing.
 * Pulls telephone, website, head names, lat/lon (if any) from uk_schools.
 * Also merges latest Ofsted + optional census/attendance.
 * Optional: ?debug=1 reveals which tables returned data.
 * ======================================================================= */
router.get('/:urn', async (req, res) => {
  try {
    const { urn } = req.params;
    const debug = req.query.debug === '1';

    if (!urn || isNaN(urn)) {
      return res.status(400).json({ error: 'Invalid URN provided' });
    }

    // 1) Base row from uk_schools
    const baseSql = `
      SELECT
        s.id, s.urn, s.la_code, s.establishment_number, s.name, s.name_lower, s.slug,
        s.establishment_status, s.type_of_establishment, s.establishment_group, s.phase_of_education,
        s.street, s.locality, s.town, s.county, s.postcode,
        s.latitude, s.longitude,
        s.local_authority, s.region, s.parliamentary_constituency, s.ward, s.urban_rural,
        s.website, s.telephone,
        s.head_title, s.head_first_name, s.head_last_name, s.head_job_title,
        s.gender, s.age_range_lower, s.age_range_upper,
        s.school_capacity, s.total_pupils, s.boys_count, s.girls_count,
        s.has_nursery, s.has_sixth_form, s.is_boarding_school, s.has_sen_provision,
        s.religious_character, s.religious_ethos, s.diocese, s.percentage_fsm,
        s.is_part_of_trust, s.trust_name, s.ukprn, s.uprn,
        s.date_opened, s.last_changed_date, s.created_at, s.updated_at
      FROM uk_schools s
      WHERE s.urn = $1
      LIMIT 1
    `;
    const baseR = await query(baseSql, [urn]);
    if (baseR.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    const s = baseR.rows[0];

    // 2) Optional merges (latest rows)
    const ofstedSql = `
      SELECT
        overall_effectiveness,
        inspection_date,
        publication_date,
        quality_of_education,
        behaviour_and_attitudes,
        personal_development,
        leadership_and_management,
        safeguarding_effective,
        sixth_form_provision,
        early_years_provision,
        previous_inspection_date,
        previous_overall_effectiveness,
        web_link
      FROM uk_ofsted_inspections
      WHERE urn = $1
      ORDER BY COALESCE(inspection_date, publication_date) DESC
      LIMIT 1
    `;
    const censusSql = `
      SELECT number_on_roll, number_girls, number_boys,
             percentage_fsm_ever6, percentage_eal, percentage_sen_support, percentage_sen_ehcp
      FROM uk_census_data
      WHERE urn = $1
      ORDER BY academic_year DESC NULLS LAST
      LIMIT 1
    `;
    const attendSql = `
      SELECT overall_absence_rate, persistent_absence_rate
      FROM uk_absence_data
      WHERE urn = $1
      ORDER BY academic_year DESC NULLS LAST
      LIMIT 1
    `;
    const [oR, cR, aR] = await Promise.all([
      query(ofstedSql, [urn]),
      query(censusSql, [urn]),
      query(attendSql, [urn]),
    ]);

    const o = oR.rows[0] || {};
    const c = cR.rows[0] || {};
    const a = aR.rows[0] || {};

    // Normalize leader name and contact
    const headteacher_name = [s.head_title, s.head_first_name, s.head_last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    // Coalesce demographics: prefer uk_schools totals but fall back to census
    const total_students = s.total_pupils ?? c.number_on_roll ?? null;
    const boys = s.boys_count ?? c.number_boys ?? null;
    const girls = s.girls_count ?? c.number_girls ?? null;

    // Build overall 0–10 rating based on Ofsted band
    let overall_rating = 5;
    if (o.overall_effectiveness === 1) overall_rating = 9;
    else if (o.overall_effectiveness === 2) overall_rating = 7;
    else if (o.overall_effectiveness === 3) overall_rating = 5;
    else if (o.overall_effectiveness === 4) overall_rating = 3;

    const payload = {
      success: true,
      school: {
        // Basic
        urn: s.urn,
        name: s.name,
        type: s.type_of_establishment,
        phase: s.phase_of_education,
        status: s.establishment_status,

        // Contact / map
        telephone: s.telephone || null,
        website: s.website || null,
        headteacher_name,
        headteacher_job_title: s.head_job_title || null,
        latitude: toNum(s.latitude),
        longitude: toNum(s.longitude),

        // Address
        address: {
          street: s.street,
          locality: s.locality,
          town: s.town,
          postcode: s.postcode,
          local_authority: s.local_authority,
          county: s.county || null,
          region: s.region || null,
        },

        // Characteristics
        characteristics: {
          gender: s.gender,
          age_range: `${s.age_range_lower ?? 'N/A'} - ${s.age_range_upper ?? 'N/A'}`,
          religious_character: s.religious_character,
          admissions_policy: s.admissions_policy || null,
          has_nursery: !!s.has_nursery,
          has_sixth_form: !!s.has_sixth_form,
          is_boarding_school: !!s.is_boarding_school,
          has_sen_provision: !!s.has_sen_provision,
        },

        // Demographics
        demographics: {
          total_students,
          boys,
          girls,
          fsm_percentage: s.percentage_fsm ?? c.percentage_fsm_ever6 ?? null,
          eal_percentage: c.percentage_eal ?? null,
          sen_support_percentage: c.percentage_sen_support ?? null,
          sen_ehcp_percentage: c.percentage_sen_ehcp ?? null,
        },

        // Attendance
        attendance: {
          overall_absence_rate: a.overall_absence_rate ?? null,
          persistent_absence_rate: a.persistent_absence_rate ?? null,
        },

        // Ofsted
        ofsted: {
          overall_effectiveness: o.overall_effectiveness ?? null,
          overall_label: getOfstedLabel(o.overall_effectiveness),
          inspection_date: o.inspection_date ?? null,
          publication_date: o.publication_date ?? null,
          quality_of_education: o.quality_of_education ?? null,
          behaviour_and_attitudes: o.behaviour_and_attitudes ?? null,
          personal_development: o.personal_development ?? null,
          leadership_and_management: o.leadership_and_management ?? null,
          safeguarding_effective: o.safeguarding_effective ?? null,
          sixth_form_provision: o.sixth_form_provision ?? null,
          early_years_provision: o.early_years_provision ?? null,
          previous_inspection_date: o.previous_inspection_date ?? null,
          previous_overall_effectiveness: o.previous_overall_effectiveness ?? null,
          web_link: o.web_link || null,
        },

        // Overall UI rating
        overall_rating,
      },
    };

    if (debug) {
      payload.__debug = {
        base_row: true,
        ofsted_row: !!oR.rows[0],
        census_row: !!cR.rows[0],
        attendance_row: !!aR.rows[0],
      };
    }

    return res.json(payload);
  } catch (err) {
    console.error('School fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch school information', message: err.message });
  }
});

/* =======================================================================
 * GET /api/schools/:urn/performance
 * ======================================================================= */
router.get('/:urn/performance', async (req, res) => {
  try {
    const { urn } = req.params;

    const ks2Sql = `
      SELECT * FROM uk_ks2_performance
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    const ks4Sql = `
      SELECT * FROM uk_ks4_performance
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    const ks5Sql = `
      SELECT * FROM uk_ks5_performance
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    const ks4DestSql = `
      SELECT * FROM uk_ks4_destinations
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;
    const ks5DestSql = `
      SELECT * FROM uk_ks5_destinations
      WHERE urn = $1
      ORDER BY academic_year DESC
      LIMIT 1
    `;

    const [ks2R, ks4R, ks5R, ks4DestR, ks5DestR] = await Promise.all([
      query(ks2Sql, [urn]),
      query(ks4Sql, [urn]),
      query(ks5Sql, [urn]),
      query(ks4DestSql, [urn]),
      query(ks5DestSql, [urn]),
    ]);

    return res.json({
      success: true,
      performance: {
        ks2: ks2R.rows[0] || null,
        ks4: ks4R.rows[0] || null,
        ks5: ks5R.rows[0] || null,
        destinations: {
          ks4: ks4DestR.rows[0] || null,
          ks5: ks5DestR.rows[0] || null,
        },
      },
    });
  } catch (err) {
    console.error('Performance fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch performance data', message: err.message });
  }
});

/* =======================================================================
 * GET /api/schools/:urn/performance/detailed
 * ======================================================================= */
router.get('/:urn/performance/detailed', async (req, res) => {
  try {
    const { urn } = req.params;

    const subjectVASql = `
      SELECT subject_name, qualification_type, value_added_score,
             lower_confidence_limit, upper_confidence_limit,
             number_of_entries, cohort_size
      FROM uk_subject_value_added
      WHERE urn = $1
      ORDER BY number_of_entries DESC
    `;
    const qualVASql = `
      SELECT qualification_type, value_added_score,
             lower_confidence_limit, upper_confidence_limit,
             number_of_entries, cohort_size
      FROM uk_qualification_value_added
      WHERE urn = $1
      ORDER BY number_of_entries DESC
    `;
    const stemSql = `
      SELECT * FROM uk_ks5_stem_participation
      WHERE urn = $1
      LIMIT 1
    `;

    const [subjectVA, qualVA, stem] = await Promise.all([
      query(subjectVASql, [urn]),
      query(qualVASql, [urn]),
      query(stemSql, [urn]),
    ]);

    return res.json({
      success: true,
      detailed_performance: {
        subject_value_added: subjectVA.rows,
        qualification_value_added: qualVA.rows,
        stem_participation: stem.rows[0] || null,
      },
    });
  } catch (err) {
    console.error('Detailed performance fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch detailed performance data', message: err.message });
  }
});

/* =======================================================================
 * GET /api/schools/:urn/nearby
 * (same LA + same phase for now)
 * ======================================================================= */
router.get('/:urn/nearby', async (req, res) => {
  try {
    const { urn } = req.params;
    const { limit = 10 } = req.query;

    const currentSql = `
      SELECT local_authority, phase_of_education
      FROM uk_schools
      WHERE urn = $1
      LIMIT 1
    `;
    const curR = await query(currentSql, [urn]);
    if (curR.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    const cur = curR.rows[0];

    const nearbySql = `
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
        AND s.urn <> $2
        AND s.phase_of_education = $3
      ORDER BY s.name
      LIMIT $4
    `;
    const nearR = await query(nearbySql, [
      cur.local_authority,
      urn,
      cur.phase_of_education,
      parseInt(limit, 10),
    ]);

    return res.json({
      success: true,
      current_school: {
        urn,
        local_authority: cur.local_authority,
        phase: cur.phase_of_education,
      },
      nearby_schools: nearR.rows.map(row => ({
        ...row,
        ofsted_label: getOfstedLabel(row.ofsted_rating),
      })),
    });
  } catch (err) {
    console.error('Nearby schools fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch nearby schools', message: err.message });
  }
});

/* =======================================================================
 * GET /api/schools/:urn/comparison
 * ======================================================================= */
router.get('/:urn/comparison', async (req, res) => {
  try {
    const { urn } = req.params;

    const compSql = `
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
      LIMIT 1
    `;
    const compR = await query(compSql, [urn]);
    if (compR.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    const school = compR.rows[0];

    const laAvgSql = `
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
    const natAvgSql = `
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

    const [laR, natR] = await Promise.all([
      query(laAvgSql, [school.local_authority, school.phase_of_education]),
      query(natAvgSql, [school.phase_of_education]),
    ]);

    return res.json({
      success: true,
      comparison: {
        school,
        local_authority_average: laR.rows[0],
        national_average: natR.rows[0],
      },
    });
  } catch (err) {
    console.error('Comparison fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch comparison data', message: err.message });
  }
});

module.exports = router;
