const express = require('express');
const router = express.Router();
const questionsController = require('../controllers/questionsController');

router.get('/', questionsController.getQuestions);
router.get('/:id', questionsController.getQuestionById);
router.post('/submit', questionsController.submitAnswer);

module.exports = router;