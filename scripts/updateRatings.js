
// scripts/updateRatings.js
const { query } = require('../src/config/database');

async function updateStaleRatings() {
  // Find schools with stale ratings
  const result = await query(`
    SELECT COUNT(*) as count 
    FROM uk_schools 
    WHERE overall_rating IS NULL 
    OR rating_updated_at < NOW() - INTERVAL '30 days'
  `);
  
  console.log(`Found ${result.rows[0].count} schools needing update`);
  
  // Run the SQL function
  await query('SELECT * FROM batch_calculate_school_ratings()');
  
  console.log('Ratings updated successfully');
}

updateStaleRatings();