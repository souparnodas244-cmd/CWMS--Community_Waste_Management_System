const express = require('express');
const { body, validationResult } = require('express-validator');
const rewardService = require('../services/rewardService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError } = require('../utils/helpers');

const router = express.Router();

router.post(
  '/partners',
  requireAuth,
  requireRole('MUNICIPAL_ADMIN'),
  [body('name').trim().notEmpty(), body('pointsCost').isInt({ min: 1 })],
  (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
      res.status(201).json(rewardService.createPartner(req.body));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/partners', requireAuth, (req, res, next) => {
  try {
    res.json(rewardService.listPartners());
  } catch (err) {
    next(err);
  }
});

router.post('/redeem', requireAuth, [body('partnerId').notEmpty()], (req, res, next) => {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
    res.status(201).json(rewardService.redeem(req.user.id, req.body.partnerId));
  } catch (err) {
    next(err);
  }
});

router.get('/redemptions', requireAuth, (req, res, next) => {
  try {
    res.json(rewardService.listRedemptions(req.user.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
