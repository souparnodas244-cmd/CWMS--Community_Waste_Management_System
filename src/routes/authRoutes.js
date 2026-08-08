const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../utils/helpers');

const router = express.Router();

function checkValidation(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new ApiError(422, 'Validation failed.', result.array());
  }
}

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('email').isEmail().withMessage('valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
    body('role').optional().isIn(authService.VALID_ROLES),
  ],
  (req, res, next) => {
    try {
      checkValidation(req);
      const result = authService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  (req, res, next) => {
    try {
      checkValidation(req);
      const result = authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const user = authService.getById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found.');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
