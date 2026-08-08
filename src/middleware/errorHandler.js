const { ApiError } = require('../utils/helpers');

function notFoundHandler(req, res, next) {
  next(new ApiError(404, `No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
    details: err.details || undefined,
  });
}

module.exports = { notFoundHandler, errorHandler };
