const supabase = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  // 1. Pega o token do header (formato: "Bearer TOKEN_AQUI")
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const userIdRequested = req.params.id;

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  try {
    // 2. Pede ao Supabase para validar o token e retornar o usuário
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    // 3. A MÁGICA: Verifica se o ID do token é o mesmo ID da URL
    // Se o usuário tentar acessar /api/profile/ID_DE_OUTRA_PESSOA, ele será bloqueado aqui
    if (userIdRequested && user.id !== userIdRequested) {
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para acessar estes dados.' });
    }

    // Adiciona os dados do usuário verificado na requisição para uso posterior
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno na verificação de segurança.' });
  }
};

module.exports = authMiddleware;