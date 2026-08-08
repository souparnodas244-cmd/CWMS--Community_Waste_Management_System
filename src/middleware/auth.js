const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError } = require('../utils/helpers');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header.'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Requires one of roles: ${roles.join(', ')}`));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
