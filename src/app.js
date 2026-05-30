
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const roomRoutes = require('./routes/rooms');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

/* -------------------------------------------------------------------------- */
/*                                   SECURITY                                 */
/* -------------------------------------------------------------------------- */

app.use(helmet());

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

/* -------------------------------------------------------------------------- */
/*                               RATE LIMITING                                */
/* -------------------------------------------------------------------------- */

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.',
  },
});

app.use('/api', limiter);

/* -------------------------------------------------------------------------- */
/*                               BODY PARSING                                 */
/* -------------------------------------------------------------------------- */

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* -------------------------------------------------------------------------- */
/*                                REQUEST LOGS                                */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

/* -------------------------------------------------------------------------- */
/*                                  ROOT ROUTE                                */
/* -------------------------------------------------------------------------- */

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SyncMusic',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    message: 'SyncMusic Backend Running',
  });
});

/* -------------------------------------------------------------------------- */
/*                               HEALTH CHECK                                 */
/* -------------------------------------------------------------------------- */

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    database: 'CONNECTED',
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/*                                  API ROUTES                                */
/* -------------------------------------------------------------------------- */

app.use('/api/rooms', roomRoutes);

/* -------------------------------------------------------------------------- */
/*                              ERROR HANDLERS                                */
/* -------------------------------------------------------------------------- */

app.use(notFound);
app.use(errorHandler);

module.exports = app;

