const express = require('express');
const { microsoftLogin, microsoftCallback, login, me, exchange } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter, exchangeLimiter } = require('../middleware/rateLimit');
const router = express.Router();

router.get('/microsoft', microsoftLogin);
router.get('/microsoft/callback', microsoftCallback);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

router.post('/exchange', exchangeLimiter, exchange);

module.exports = router;
