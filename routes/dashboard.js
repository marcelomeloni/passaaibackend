const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/:id
router.get('/:id', dashboardController.getDashboardData);

module.exports = router;
