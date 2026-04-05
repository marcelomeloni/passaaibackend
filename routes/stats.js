const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rota para pegar todos os dados das estatísticas
router.get('/:id', authMiddleware, statsController.getDashboardStats);

module.exports = router;