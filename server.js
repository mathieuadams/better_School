require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import database connection
const { pool, testConnection } = require('./src/config/database');

// Import routes
const schoolRoutes = require('./src/routes/schoolRoutes');
const searchRoutes = require('./src/routes/searchRoutes');

// Create Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Trust proxy (required for Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable for now to allow inline scripts
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/components', express.static(path.join(__dirname, 'public/components')));

// Health check endpoint (Render uses this)
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.status(200).json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// API Welcome route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to Better School UK API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      search: '/api/search',
      schools: '/api/schools/:urn'
    }
  });
});

// API Routes
app.use('/api/schools', schoolRoutes);
app.use('/api/search', searchRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get('/school/:urn', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'school.html'));
});

app.get('/compare', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'compare.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// Catch-all route for SPA routing (if needed)
app.get('*', (req, res) => {
  // Check if it's an API route that wasn't found
  if (req.path.startsWith('/api')) {
    res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.path 
    });
  } else {
    // For non-API routes, serve the index page
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    await testConnection();
    console.log('✅ Database connected successfully');
    
    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Base: http://localhost:${PORT}/api`);
      console.log(`🌐 Website: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Please check your DATABASE_URL environment variable');
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing connections...');
  await pool.end();
  process.exit(0);
});