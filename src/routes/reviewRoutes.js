// reviewRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get reviews for a school
router.get('/schools/:urn/reviews', async (req, res) => {
  try {
    const { urn } = req.params;
    const { page = 1, limit = 20, sort = 'recent' } = req.query;
    const offset = (page - 1) * limit;

    // Get review stats
    const statsQuery = `
      SELECT * FROM uk_school_review_stats WHERE urn = $1
    `;
    const statsResult = await pool.query(statsQuery, [urn]);

    // Build sort clause
    let orderBy = 'created_at DESC';
    if (sort === 'helpful') orderBy = 'helpful_count DESC, created_at DESC';
    if (sort === 'rating_high') orderBy = 'overall_rating DESC, created_at DESC';
    if (sort === 'rating_low') orderBy = 'overall_rating ASC, created_at DESC';

    // Get reviews with pagination
    const reviewsQuery = `
      SELECT 
        r.*,
        s.name as school_name,
        TO_CHAR(r.created_at, 'Month DD, YYYY') as formatted_date
      FROM uk_school_reviews r
      JOIN uk_schools s ON r.urn = s.urn
      WHERE r.urn = $1 AND r.is_published = true
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    
    const reviewsResult = await pool.query(reviewsQuery, [urn, limit, offset]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM uk_school_reviews 
      WHERE urn = $1 AND is_published = true
    `;
    const countResult = await pool.query(countQuery, [urn]);
    const totalReviews = parseInt(countResult.rows[0].count);

    res.json({
      stats: statsResult.rows[0] || null,
      reviews: reviewsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalReviews,
        totalPages: Math.ceil(totalReviews / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Submit a new review
router.post('/schools/:urn/reviews', async (req, res) => {
  try {
    const { urn } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress;
    
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
    } = req.body;

    // Validate required fields
    if (!overall_rating || !would_recommend || !review_text || !reviewer_type) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Validate review text length
    if (review_text.length < 50 || review_text.length > 2500) {
      return res.status(400).json({ 
        error: 'Review must be between 50 and 2500 characters' 
      });
    }

    // Check for rate limiting (max 1 review per IP per school per day)
    const rateLimitQuery = `
      SELECT COUNT(*) FROM uk_school_reviews 
      WHERE urn = $1 AND reviewer_ip = $2 
      AND created_at > NOW() - INTERVAL '24 hours'
    `;
    const rateLimitResult = await pool.query(rateLimitQuery, [urn, clientIp]);
    
    if (parseInt(rateLimitResult.rows[0].count) > 0) {
      return res.status(429).json({ 
        error: 'You can only submit one review per school per day' 
      });
    }

    // Insert the review
    const insertQuery = `
      INSERT INTO uk_school_reviews (
        urn, overall_rating, learning_rating, teaching_rating,
        social_emotional_rating, special_education_rating,
        safety_rating, family_engagement_rating,
        would_recommend, review_text, review_title,
        reviewer_type, reviewer_name, reviewer_ip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      urn, overall_rating, learning_rating, teaching_rating,
      social_emotional_rating, special_education_rating,
      safety_rating, family_engagement_rating,
      would_recommend, review_text, review_title,
      reviewer_type, reviewer_name, clientIp
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      success: true,
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Mark a review as helpful
router.post('/reviews/:reviewId/helpful', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Check if already voted
    const checkQuery = `
      SELECT * FROM uk_review_helpful_votes 
      WHERE review_id = $1 AND voter_ip = $2
    `;
    const checkResult = await pool.query(checkQuery, [reviewId, clientIp]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'You have already marked this review as helpful' 
      });
    }

    // Begin transaction
    await pool.query('BEGIN');

    // Insert vote
    await pool.query(
      'INSERT INTO uk_review_helpful_votes (review_id, voter_ip) VALUES ($1, $2)',
      [reviewId, clientIp]
    );

    // Update helpful count
    await pool.query(
      'UPDATE uk_school_reviews SET helpful_count = helpful_count + 1 WHERE id = $1',
      [reviewId]
    );

    await pool.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

// Report a review
router.post('/reviews/:reviewId/report', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason, details } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!reason) {
      return res.status(400).json({ error: 'Report reason is required' });
    }

    const insertQuery = `
      INSERT INTO uk_review_reports (
        review_id, report_reason, report_details, reporter_ip
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    await pool.query(insertQuery, [reviewId, reason, details, clientIp]);

    // Update report count
    await pool.query(
      'UPDATE uk_school_reviews SET report_count = report_count + 1 WHERE id = $1',
      [reviewId]
    );

    res.json({ success: true, message: 'Review has been reported for moderation' });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ error: 'Failed to report review' });
  }
});

// Get review statistics for a school
router.get('/schools/:urn/review-stats', async (req, res) => {
  try {
    const { urn } = req.params;

    const query = `
      SELECT 
        rs.*,
        s.name as school_name,
        s.postcode,
        s.town
      FROM uk_school_review_stats rs
      JOIN uk_schools s ON rs.urn = s.urn
      WHERE rs.urn = $1
    `;

    const result = await pool.query(query, [urn]);

    if (result.rows.length === 0) {
      return res.json({
        urn: parseInt(urn),
        total_reviews: 0,
        avg_overall_rating: null,
        recommendation_percentage: 0
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({ error: 'Failed to fetch review statistics' });
  }
});

module.exports = router;