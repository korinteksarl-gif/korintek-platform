const express = require('express');
const { microsoftLogin, microsoftCallback, login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const router = express.Router();

router.get('/microsoft', microsoftLogin);
router.get('/microsoft/callback', microsoftCallback);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
