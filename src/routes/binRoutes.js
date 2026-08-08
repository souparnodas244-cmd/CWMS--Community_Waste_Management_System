const express = require('express');
const { body, validationResult } = require('express-validator');
const binService = require('../services/binService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError } = require('../utils/helpers');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
}

// Municipal admins register new bins.
router.post(
  '/',
  requireAuth,
  requireRole('MUNICIPAL_ADMIN'),
  [
    body('label').trim().notEmpty(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
  ],
  (req, res, next) => {
    try {
      checkValidation(req);
      res.status(201).json(binService.createBin(req.body));
    } catch (err) {
      next(err);
    }
  }
);

// Public read — citizens and municipal dashboard both need bin visibility.
router.get('/', requireAuth, (req, res, next) => {
  try {
    const { minFillLevel, wasteType } = req.query;
    res.json(
      binService.listBins({
        minFillLevel: minFillLevel !== undefined ? Number(minFillLevel) : undefined,
        wasteType,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    res.json(binService.getBin(req.params.id));
  } catch (err) {
    next(err);
  }
});

// IoT ingestion endpoint — an ESP32 + ultrasonic sensor (or the simulator) posts here.
router.post(
  '/:id/sensor-readings',
  [body('fillLevel').isInt({ min: 0, max: 100 })],
  (req, res, next) => {
    try {
      checkValidation(req);
      const result = binService.recordSensorReading(req.params.id, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/empty', requireAuth, requireRole('MUNICIPAL_ADMIN'), (req, res, next) => {
  try {
    res.json(binService.markEmptied(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
