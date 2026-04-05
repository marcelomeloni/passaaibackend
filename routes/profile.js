const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middlewares/authMiddleware'); // Importa o segurança

// Rota protegida: O usuário só pega os dados se o ID dele bater com o da URL
router.get('/:id', authMiddleware, profileController.getProfile);

// Rota protegida: O usuário só atualiza se for o dono da conta
router.put('/:id', authMiddleware, profileController.updateProfile);

module.exports = router;