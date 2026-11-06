const express = require('express');
const { microsoftLogin, microsoftCallback, me, exchange } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const { loginLimiter, exchangeLimiter } = require('../middleware/rateLimit');
const router = express.Router();

router.get('/microsoft/login', microsoftLogin);
router.get('/microsoft/callback', microsoftCallback);
router.get('/me', authenticate, me);

router.post('/exchange', exchangeLimiter, exchange);

module.exports = router;
