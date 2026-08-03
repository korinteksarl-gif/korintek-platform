const express = require('express');
const prisma = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole(['SUPER_ADMIN']));

// GET /api/v1/audit?limit=100
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
