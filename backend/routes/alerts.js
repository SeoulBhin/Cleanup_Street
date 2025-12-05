const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getAlerts, markAlertRead } = require('../controllers/alerts.controller');

router.get('/', requireAuth, getAlerts);

router.patch('/:alertId/read', requireAuth, markAlertRead);

module.exports = router;
