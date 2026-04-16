// app.js
// Main entry point for the Tuk-Tuk Tracking API

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const { initDatabase } = require('./db/database');
const routes           = require('./routes/index');
const openapiSpec      = require('./docs/openapi');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // sets security headers
app.use(cors());                                    // allow cross-origin requests
app.use(morgan('dev'));                              // log all requests to console

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));           // parse JSON request bodies

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Prevent someone from hammering the API with too many requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:       200,             // max 200 requests per window
  message:   { success: false, message: 'Too many requests, please slow down.' },
});
app.use('/api/', limiter);

// ── API Docs (Swagger) ───────────────────────────────────────────────────────
app.get('/api/swagger.json', (_req, res) => res.json(openapiSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

// Backwards/compat aliases (some clients expect these)
app.get('/api/v1/swagger', (req, res) => res.redirect(302, '/api-docs'));
app.get('/api/v1/swagger.json', (_req, res) => res.json(openapiSpec));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'Sri Lanka Police – Tuk-Tuk Tracking API',
    version: '1.0.0',
    health:  '/api/health',
    docs:    '/api-docs',
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────────────────────
// Only start the server when this file is run directly (not when required by tests)
if (require.main === module) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚦 Tuk-Tuk Tracking API`);
      console.log(`   Running  : http://localhost:${PORT}`);
      console.log(`   Health   : http://localhost:${PORT}/api/health`);
      console.log(`   Env      : ${process.env.NODE_ENV || 'development'}\n`);
    });
  });
}

// Export for tests
module.exports = { app, initDatabase };
