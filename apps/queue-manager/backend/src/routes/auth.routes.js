const express = require('express');
const { login, me, microsoftLogin, microsoftCallback } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticate, me);
router.get('/microsoft/login', microsoftLogin);
router.get('/microsoft/callback', microsoftCallback);

module.exports = router;
