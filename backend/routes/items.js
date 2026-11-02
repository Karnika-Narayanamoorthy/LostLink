const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');

const {
  getItems, getItem, createItem, getMyItems, deleteItem, submitClaim
} = require('../controllers/itemController');

const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload   = require('../middleware/upload');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/',    optionalAuth, getItems);
router.get('/mine', protect, getMyItems);
router.get('/:id', optionalAuth, getItem);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.post('/', protect, upload.single('image'), [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 150 }),
  body('category').notEmpty().withMessage('Category is required')
    .isIn(['electronics','bags','documents','accessories','clothing','other']),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('type').isIn(['lost','found']).withMessage('Type must be lost or found')
], validate, createItem);

router.delete('/:id', protect, deleteItem);

// ── Claims ────────────────────────────────────────────────────────────────────
router.post('/:id/claims', protect, [
  body('verificationAnswer').trim().notEmpty().withMessage('Verification answer is required')
], validate, submitClaim);

module.exports = router;
