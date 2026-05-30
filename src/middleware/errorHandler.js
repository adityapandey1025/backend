const logger = require('../utils/logger');

function notFound(req, res, next) {
  const err = new Error(`Not Found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status === 500) logger.error(err);
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
