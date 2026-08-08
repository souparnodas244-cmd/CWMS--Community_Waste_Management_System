const express = require('express');
const dashboardService = require('../services/dashboardService');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', requireAuth, requireRole('MUNICIPAL_ADMIN'), (req, res, next) => {
  try {
    res.json(dashboardService.getSummary());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
