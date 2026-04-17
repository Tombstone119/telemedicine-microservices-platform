const { ApiError } = require('../utils/errors');
const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  logger.error('Unhandled error', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    error: 'Internal server error',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
