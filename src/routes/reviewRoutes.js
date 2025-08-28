// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const toInt = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const clientIP = (req) => req.ip || req.connection?.remoteAddress || '';

router.get('/schools/:urn/reviews', async (req, res) => {
  const { urn } = req.params;
  const page = Math.max(toInt(req.query.page ?? '1', 10), 1);
  const limit = clamp(Math.max(toInt(req.query.limit ?? '20', 10), 1), 1, 50);
  const offset = (page - 1) * limit;
  const sort = (req.query.sort || 'recent').toString();

  let orderBy = 'r.created_at DESC';
  if (sort === 'helpful') orderBy = 'r.helpful_count DESC, r.created_at DESC';
  else if (sort === 'rating_high') orderBy = 'r.overall_rating DESC, r.created_at DESC';
  else if (sort === 'rating_low') orderBy = 'r.overall_rating ASC, r.created_at DESC';

  try {
    const countQ = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM uk_school_reviews
       WHERE urn = $1 AND COALESCE(is_published, true) = true`,
      [urn]
    );
    const total = countQ.rows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const reviewsQ = await pool.query(
      `
      SELECT
        r.*,
        s.name AS school_name,
        s.town AS town,
        TRIM(TO_CHAR(r.created_at, 'Mon DD, YYYY')) AS formatted_date
      FROM uk_school_reviews r
      JOIN uk_schools s ON r.urn = s.urn
      WHERE r.urn = $1
        AND COALESCE(r.is_published, true) = true
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
      `,
      [urn, limit, offset]
    );

    // Try precomputed stats row
    const statsRow = await pool.query(
      'SELECT * FROM uk_school_review_stats WHERE urn = $1',
      [urn]
    );
    const hasPrecomputed = statsRow.rows[0] && Number(statsRow.rows[0].total_reviews) > 0;

    let stats;
    if (hasPrecomputed) {
      stats = statsRow.rows[0];
    } else {
      // Compute live stats (fallback or always, if you prefer)
      const live = await pool.query(
        `
        SELECT
          COUNT(*)::int AS total_reviews,
          ROUND(AVG(overall_rating)::numeric, 1) AS avg_overall_rating,
          SUM(CASE WHEN overall_rating=5 THEN 1 ELSE 0 END)::int AS star5,
          SUM(CASE WHEN overall_rating=4 THEN 1 ELSE 0 END)::int AS star4,
          SUM(CASE WHEN overall_rating=3 THEN 1 ELSE 0 END)::int AS star3,
          SUM(CASE WHEN overall_rating=2 THEN 1 ELSE 0 END)::int AS star2,
          SUM(CASE WHEN overall_rating=1 THEN 1 ELSE 0 END)::int AS star1,
          ROUND(100.0 * AVG(CASE WHEN would_recommend THEN 1 ELSE 0 END)::numeric, 0) AS recommendation_percentage,
          ROUND(AVG(NULLIF(family_engagement_rating,0))::numeric,1) AS family_avg,
          COUNT(NULLIF(family_engagement_rating,0))::int AS family_count,
          ROUND(AVG(NULLIF(learning_rating,0))::numeric,1) AS learning_avg,
          COUNT(NULLIF(learning_rating,0))::int AS learning_count,
          ROUND(AVG(NULLIF(teaching_rating,0))::numeric,1) AS teaching_avg,
          COUNT(NULLIF(teaching_rating,0))::int AS teaching_count,
          ROUND(AVG(NULLIF(safety_rating,0))::numeric,1) AS safety_avg,
          COUNT(NULLIF(safety_rating,0))::int AS safety_count,
          ROUND(AVG(NULLIF(social_emotional_rating,0))::numeric,1) AS social_avg,
          COUNT(NULLIF(social_emotional_rating,0))::int AS social_count,
          ROUND(AVG(NULLIF(special_education_rating,0))::numeric,1) AS special_avg,
          COUNT(NULLIF(special_education_rating,0))::int AS special_count
        FROM uk_school_reviews
        WHERE urn = $1 AND COALESCE(is_published, true) = true
        `,
        [urn]
      );
      const d = live.rows[0] || {};
      stats = {
        urn: Number(urn),
        total_reviews: d.total_reviews || 0,
        avg_overall_rating: d.avg_overall_rating ?? null,
        recommendation_percentage: d.recommendation_percentage ?? 0,
        distribution: { 5: d.star5||0, 4: d.star4||0, 3: d.star3||0, 2: d.star2||0, 1: d.star1||0 },
        categories: {
          family:  { average: d.family_avg,  count: d.family_count },
          learning:{ average: d.learning_avg,count: d.learning_count },
          teaching:{ average: d.teaching_avg,count: d.teaching_count },
          safety:  { average: d.safety_avg,  count: d.safety_count },
          social:  { average: d.social_avg,  count: d.social_count },
          special: { average: d.special_avg, count: d.special_count }
        }
      };
    }

    res.json({
      stats,
      reviews: reviewsQ.rows,
      pagination: { page, limit, total, totalPages }
    });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/schools/:urn/reviews', async (req, res) => {
  const { urn } = req.params;
  const ip = clientIP(req);
  const {
    overall_rating,
    learning_rating,
    teaching_rating,
    social_emotional_rating,
    special_education_rating,
    safety_rating,
    family_engagement_rating,
    would_recommend,
    review_text,
    review_title,
    reviewer_type,
    reviewer_name
  } = req.body || {};

  try {
    if (overall_rating == null || would_recommend == null || !review_text || !reviewer_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (review_text.length < 50 || review_text.length > 2500) {
      return res.status(400).json({ error: 'Review must be between 50 and 2500 characters' });
    }

    const rl = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM uk_school_reviews
       WHERE urn = $1 AND reviewer_ip = $2
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [urn, ip]
    );
    if ((rl.rows[0]?.cnt || 0) > 0) {
      return res.status(429).json({ error: 'You can only submit one review per school per day' });
    }

    const ins = await pool.query(
      `
      INSERT INTO uk_school_reviews (
        urn, overall_rating, learning_rating, teaching_rating,
        social_emotional_rating, special_education_rating, safety_rating,
        family_engagement_rating, would_recommend, review_text, review_title,
        reviewer_type, reviewer_name, reviewer_ip, is_published
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, true)
      RETURNING *
      `,
      [
        urn, overall_rating, learning_rating, teaching_rating,
        social_emotional_rating, special_education_rating, safety_rating,
        family_engagement_rating, would_recommend, review_text, review_title,
        reviewer_type, reviewer_name, ip
      ]
    );

    res.status(201).json({ success: true, review: ins.rows[0] });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.post('/reviews/:reviewId/helpful', async (req, res) => {
  const { reviewId } = req.params;
  const ip = clientIP(req);
  try {
    const already = await pool.query(
      `SELECT 1 FROM uk_review_helpful_votes WHERE review_id = $1 AND voter_ip = $2`,
      [reviewId, ip]
    );
    if (already.rows.length) {
      return res.status(400).json({ error: 'You have already marked this review as helpful' });
    }

    await pool.query('BEGIN');
    await pool.query(`INSERT INTO uk_review_helpful_votes (review_id, voter_ip) VALUES ($1, $2)`, [reviewId, ip]);
    const upd = await pool.query(
      `UPDATE uk_school_reviews SET helpful_count = COALESCE(helpful_count,0) + 1 WHERE id = $1 RETURNING id, helpful_count`,
      [reviewId]
    );
    await pool.query('COMMIT');

    if (!upd.rowCount) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true, id: upd.rows[0].id, helpful_count: upd.rows[0].helpful_count });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error marking review as helpful:', err);
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

router.post('/reviews/:reviewId/report', async (req, res) => {
  const { reviewId } = req.params;
  const { reason, details } = req.body || {};
  const ip = clientIP(req);
  if (!reason) return res.status(400).json({ error: 'Report reason is required' });

  try {
    await pool.query(
      `INSERT INTO uk_review_reports (review_id, report_reason, report_details, reporter_ip)
       VALUES ($1, $2, $3, $4)`,
      [reviewId, reason, details || null, ip]
    );

    const upd = await pool.query(
      `UPDATE uk_school_reviews SET report_count = COALESCE(report_count,0) + 1 WHERE id = $1 RETURNING id`,
      [reviewId]
    );
    if (!upd.rowCount) return res.status(404).json({ error: 'Review not found' });

    res.json({ success: true, message: 'Review has been reported for moderation' });
  } catch (err) {
    console.error('Error reporting review:', err);
    res.status(500).json({ error: 'Failed to report review' });
  }
});

router.get('/schools/:urn/review-stats', async (req, res) => {
  const { urn } = req.params;
  try {
    const q = await pool.query(
      `
      SELECT 
        rs.*,
        s.name AS school_name,
        s.postcode,
        s.town
      FROM uk_school_review_stats rs
      JOIN uk_schools s ON rs.urn = s.urn
      WHERE rs.urn = $1
      `,
      [urn]
    );

    if (!q.rows.length) {
      return res.json({
        urn: Number(urn),
        total_reviews: 0,
        avg_overall_rating: null,
        recommendation_percentage: 0
      });
    }

    res.json(q.rows[0]);
  } catch (err) {
    console.error('Error fetching review stats:', err);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

module.exports = router;
