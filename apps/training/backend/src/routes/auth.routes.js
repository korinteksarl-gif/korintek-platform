const express = require('express');
const { microsoftLogin, microsoftCallback, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/microsoft/login', microsoftLogin);
router.get('/microsoft/callback', microsoftCallback);
router.get('/me', authenticate, me);

module.exports = router;
