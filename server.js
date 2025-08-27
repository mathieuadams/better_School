require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ---- Database
const { pool, testConnection } = require('./src/config/database');

// ---- API routes
const schoolRoutes = require('./src/routes/schoolRoutes');
const searchRoutes = require('./src/routes/searchRoutes');

// ---- App
const app = express();
const PORT = process.env.PORT || 10000;

// Render / proxies
app.set('trust proxy', 1);

// ---- Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,  // allow inline for now
}));

// ---- CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// ---- Rate limit (API only)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// ---- Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Perf / logs
app.use(compression());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ---- Static
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));                       // serve /public root
app.use('/css', express.static(path.join(PUBLIC_DIR, 'css')));
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js')));
app.use('/components', express.static(path.join(PUBLIC_DIR, 'components')));
app.use('/images', express.static(path.join(PUBLIC_DIR, 'images')));

// ---- Health
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// ---- API Welcome
app.get('/api', (_req, res) => {
  res.json({
    message: 'Welcome to Better School UK API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      search: '/api/search',
      schools: '/api/schools/:urn',
    },
  });
});

// ---- API Routers
app.use('/api/schools', schoolRoutes);
app.use('/api/search', searchRoutes);

// ---- HTML pages helper function
const sendPublic = (res, file) => res.sendFile(path.join(PUBLIC_DIR, file));

// ---- Review API routes
const reviewRoutes = require('./src/routes/reviewRoutes');
app.use('/api', reviewRoutes);

// ---- Review HTML pages
app.get('/review', (_req, res) => sendPublic(res, 'review.html'));
app.get('/write-review', (_req, res) => sendPublic(res, 'write-review.html'));

// ---- Other HTML pages
app.get('/', (_req, res) => sendPublic(res, 'index.html'));
app.get('/search', (_req, res) => sendPublic(res, 'search.html'));
app.get('/compare', (_req, res) => sendPublic(res, 'compare.html'));
app.get('/about', (_req, res) => sendPublic(res, 'about.html'));

// ---- City routing
const ukCities = new Set([
  'london','birmingham','glasgow','liverpool','bristol','manchester',
  'sheffield','leeds','edinburgh','leicester','coventry','bradford',
  'cardiff','belfast','nottingham','kingston-upon-hull','newcastle',
  'stoke-on-trent','southampton','portsmouth','derby','plymouth',
  'wolverhampton','swansea','milton-keynes','northampton','york',
  'oxford','cambridge','norwich','brighton','bath','canterbury',
  'exeter','chester','durham','salisbury','lancaster','worcester','lincoln'
]);

// Serve city page at /:city (static SEO-friendly path)
app.get('/:city', (req, res, next) => {
  const { city } = req.params;
  // avoid intercepting known prefixes and assets
  const reserved = new Set(['api','css','js','components','images','favicon.ico','school','health','compare','about','search']);
  if (reserved.has(city.toLowerCase())) return next();

  if (ukCities.has(city.toLowerCase())) {
    return sendPublic(res, 'city.html');
  }
  return next(); // not a city we know → continue to 404/catch-all
});

// Serve school page at /school/:identifier (URN or URN-name)
app.get('/school/:identifier', (_req, res) => sendPublic(res, 'school.html'));

// Serve school page at /:city/:schoolIdentifier (e.g., /london/123456 or /london/123456-school-name)
app.get('/:city/:schoolIdentifier', (req, res, next) => {
  const { city } = req.params;
  // don’t swallow assets or API
  const reserved = new Set(['api','css','js','components','images','favicon.ico','health','compare','about','search']);
  if (reserved.has(city.toLowerCase())) return next();
  if (!ukCities.has(city.toLowerCase())) return next();
  return sendPublic(res, 'school.html');
});

// ---- Catch-all
app.get('*', (req, res) => {
  // If an unknown API route: proper 404 JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found', path: req.path });
  }
  // For unknown front-end paths, you can either:
  // 1) return 404, or
  // 2) send index.html to behave like an SPA.
  // Using 404 is usually better for SEO here since we serve explicit static pages.
  return res.status(404).send('Not Found');
});

// ---- Errors
app.use((err, _req, res, _next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ---- Start
const startServer = async () => {
  try {
    console.log('🔍 Testing database connection...');
    await testConnection();
    console.log('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Health:  http://localhost:${PORT}/health`);
      console.log(`📚 API:     http://localhost:${PORT}/api`);
      console.log(`🌐 Website: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Check your DATABASE_URL environment variable.');
    process.exit(1);
  }
};

startServer();

// ---- Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing connections...');
  try { await pool.end(); } catch {}
  process.exit(0);
});
