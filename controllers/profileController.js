const supabase = require('../config/supabase');

const profileController = {
  // Buscar dados do perfil, conquistas e progresso diário
  getProfile: async (req, res) => {
    const { id } = req.params;

    try {
      // 1. Busca os dados do usuário + o relacionamento das conquistas desbloqueadas
      const { data: user, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          users_conquistas (
            conquista_id,
            conquistado_em
          )
        `)
        .eq('id', id)
        .single();

      if (userError) throw userError;
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

      // 2. Busca o catálogo mestre de todas as conquistas do sistema
      const { data: allConquistas, error: conquistasError } = await supabase
        .from('conquistas')
        .select('*');

      if (conquistasError) throw conquistasError;

      // 3. Mescla os dados: Verifica quais conquistas o usuário já possui
      const conquistasFormatadas = allConquistas.map((conquista) => {
        const userConquista = user.users_conquistas.find(
          (uc) => uc.conquista_id === conquista.id
        );

        return {
          id: conquista.id,
          nome: conquista.nome,
          descricao: conquista.descricao,
          icone: conquista.icone,
          xp_bonus: conquista.xp_bonus,
          conquistado: !!userConquista,
          conquistado_em: userConquista ? userConquista.conquistado_em : null
        };
      });

      // 4. Busca o progresso exclusivo de HOJE
      const today = new Date().toISOString().split('T')[0]; // Pega a data no formato YYYY-MM-DD
      
      const { data: progressoHoje } = await supabase
        .from('users_progresso_diario')
        .select('questoes_respondidas')
        .eq('user_id', id)
        .eq('data', today)
        .maybeSingle(); // maybeSingle não quebra a API se o usuário não tiver feito questões hoje

      const questoesRespondidasHoje = progressoHoje ? progressoHoje.questoes_respondidas : 0;

      // Limpa o objeto original do banco para não enviar dados redundantes
      delete user.users_conquistas;

      // 5. Retorna o perfil completo com as conquistas e o progresso de hoje
      return res.status(200).json({
        ...user,
        conquistas: conquistasFormatadas,
        questoes_respondidas_hoje: questoesRespondidasHoje // <-- Enviando o dado novo aqui!
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  // Atualizar dados do perfil (XP, metas, curso, etc)
  updateProfile: async (req, res) => {
    const { id } = req.params;
    const updates = req.body; 

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;

      return res.status(200).json({ 
        message: 'Perfil atualizado com sucesso!', 
        data: data[0] 
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};

module.exports = profileController;