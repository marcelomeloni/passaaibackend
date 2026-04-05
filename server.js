// Importação de dependências
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Para ler as variáveis de ambiente (como as chaves do Supabase)

// Inicialização do app Express
const app = express();

// Middlewares globais
app.use(cors()); // Permite requisições do seu frontend
app.use(express.json()); // Permite que o servidor entenda requisições com corpo em JSON

// Importação dos arquivos de rotas
const profileRoutes = require('./routes/profile');
const questionsRoutes = require('./routes/questions');
const statsRoutes = require('./routes/stats');

// Configuração dos endpoints base (prefixo /api)
app.use('/api/profile', profileRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/stats', statsRoutes);

// Rota de verificação (Health Check) para testes rápidos
app.get('/', (req, res) => {
  res.json({ message: 'API do Sistema de Provas rodando com sucesso!' });
});

// Tratamento de rotas não encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Definição da porta e inicialização do servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`▶ Rota de Perfil:    http://localhost:${PORT}/api/profile`);
  console.log(`▶ Rota de Questões:  http://localhost:${PORT}/api/questions`);
  console.log(`▶ Rota de Status:    http://localhost:${PORT}/api/stats`);
});