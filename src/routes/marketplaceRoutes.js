const express = require('express');
const { body, validationResult } = require('express-validator');
const marketplaceService = require('../services/marketplaceService');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../utils/helpers');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
}

router.post(
  '/listings',
  requireAuth,
  [
    body('wasteType').isIn(['ORGANIC', 'RECYCLABLE', 'HAZARDOUS', 'MIXED']),
    body('quantityKg').isFloat({ min: 0.1 }),
    body('pricePerKg').isFloat({ min: 0 }),
  ],
  (req, res, next) => {
    try {
      checkValidation(req);
      res.status(201).json(marketplaceService.createListing(req.user.id, req.body));
    } catch (err) {
      next(err);
    }
  }
);

router.get('/listings', requireAuth, (req, res, next) => {
  try {
    res.json(marketplaceService.listListings(req.query));
  } catch (err) {
    next(err);
  }
});

router.get('/listings/mine', requireAuth, (req, res, next) => {
  try {
    res.json(marketplaceService.listMyListings(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/listings/:id/buy',
  requireAuth,
  [body('quantityKg').isFloat({ min: 0.01 })],
  (req, res, next) => {
    try {
      checkValidation(req);
      const tx = marketplaceService.buyListing(req.user.id, req.params.id, req.body);
      res.status(201).json(tx);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
