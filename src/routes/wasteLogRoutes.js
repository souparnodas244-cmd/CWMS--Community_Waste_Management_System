const express = require('express');
const { body, validationResult } = require('express-validator');
const wasteLogService = require('../services/wasteLogService');
const upload = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../utils/helpers');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  upload.single('image'),
  [body('claimedWasteType').isIn(['ORGANIC', 'RECYCLABLE', 'HAZARDOUS', 'MIXED'])],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) throw new ApiError(422, 'Validation failed.', result.array());
      if (!req.file) throw new ApiError(422, 'An "image" file is required.');

      const outcome = await wasteLogService.submitWasteLog(req.user.id, {
        claimedWasteType: req.body.claimedWasteType,
        imagePath: req.file.path,
      });
      res.status(201).json(outcome);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', requireAuth, (req, res, next) => {
  try {
    res.json(wasteLogService.listWasteLogs(req.user.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
