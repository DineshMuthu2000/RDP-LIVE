const express = require('express');
const { z } = require('zod');
const { login, getProfile } = require('../controllers/authController');
const validate = require('../middlewares/validateMiddleware');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getProfile);

module.exports = router;
