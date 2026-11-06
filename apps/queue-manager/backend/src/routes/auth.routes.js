const express = require('express');
const { login, me, microsoftLogin, microsoftCallback, exchange } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const { loginLimiter, exchangeLimiter } = require('../middleware/rateLimit');
const router = express.Router();

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);
router.get('/microsoft/login', microsoftLogin);
router.get('/microsoft/callback', microsoftCallback);

router.post('/exchange', exchangeLimiter, exchange);

module.exports = router;
