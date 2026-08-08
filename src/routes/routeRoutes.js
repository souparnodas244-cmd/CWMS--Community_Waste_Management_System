const express = require('express');
const { body, validationResult } = require('express-validator');
const routeService = require('../services/routeOptimizationService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError } = require('../utils/helpers');

const router = express.Router();

router.post(
  '/optimize',
  requireAuth,
  requireRole('MUNICIPAL_ADMIN'),
  [
    body('vehicleId').trim().notEmpty(),
    body('depot.latitude').isFloat({ min: -90, max: 90 }),
    body('depot.longitude').isFloat({ min: -180, max: 180 }),
    body('binIds').optional().isArray(),
  ],
  (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
      res.status(201).json(routeService.buildOptimizedRoute(req.body));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', requireAuth, (req, res, next) => {
  try {
    res.json(routeService.listRoutes());
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/status',
  requireAuth,
  requireRole('MUNICIPAL_ADMIN'),
  [body('status').notEmpty()],
  (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
      res.json(routeService.updateRouteStatus(req.params.id, req.body.status));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
