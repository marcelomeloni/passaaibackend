const express = require('express');
const router = express.Router();
const cursoController = require('../controllers/cursoController');
// const authMiddleware = require('../middlewares/authMiddleware'); // Descomente se quiser exigir login para listar cursos

// Rota GET para buscar todos os cursos
// Se quiser proteger a rota, basta adicionar o middleware: router.get('/', authMiddleware, cursoController.getAllCursos);
router.get('/', cursoController.getAllCursos);

module.exports = router;