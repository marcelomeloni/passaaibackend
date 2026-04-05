const supabase = require('../config/supabase');

const questionsController = {
  getQuestions: async (req, res) => {
  try {
    const {
      vestibular_id,
      ano,
      tema_id,
      materia,
      user_id,
      limit = 20,
      page = 1
    } = req.query;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Busca IDs já respondidos pelo usuário
    let excludeIds = [];
    if (user_id) {
      const { data: respondidas } = await supabase
        .from('users_questoes')
        .select('questao_id')
        .eq('user_id', user_id);
      excludeIds = (respondidas || []).map(r => r.questao_id);
    }

    let query = supabase
      .from('questoes')
      .select(`
        *,
        textos_base (conteudo, fonte),
        vestibulares (nome),
        questoes_temas (
          temas (id, nome, materia)
        )
      `, { count: 'exact' })
      .eq('ativo', true);

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    if (vestibular_id) query = query.eq('vestibular_id', vestibular_id);
    if (ano)           query = query.eq('ano', ano);
    if (tema_id)       query = query.eq('questoes_temas.tema_id', tema_id);
    if (materia)       query = query.eq('questoes_temas.temas.materia', materia);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return res.status(200).json({
      total: count,
      page: parseInt(page),
      per_page: parseInt(limit),
      data
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
},

  getQuestionById: async (req, res) => {
    const { id } = req.params;

    try {
      const { data, error } = await supabase
        .from('questoes')
        .select(`
          *,
          textos_base (*),
          vestibulares (nome),
          questoes_temas (
            temas (id, nome, materia)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ message: 'Questão não encontrada' });

      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  submitAnswer: async (req, res) => {
    try {
      const { user_id, questao_id, alternativa_escolhida, tempo_resposta = 0 } = req.body;

      if (!user_id || !questao_id || !alternativa_escolhida) {
        return res.status(400).json({ message: 'Dados incompletos para submissão' });
      }

      const { data: questao, error: qError } = await supabase
        .from('questoes')
        .select('resposta_correta, explicacao_gabarito')
        .eq('id', questao_id)
        .single();

      if (qError || !questao) {
        return res.status(404).json({ message: 'Questão não encontrada' });
      }

      const acertou = questao.resposta_correta === alternativa_escolhida;
      const xpGanho = acertou ? 10 : 2; 

      const { error: insertError } = await supabase
        .from('users_questoes')
        .insert([{
          user_id,
          questao_id,
          alternativa_escolhida,
          acertou,
          tempo_resposta,
          xp_ganho: xpGanho 
        }]);

      if (insertError) throw insertError;

      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('xp_total')
        .eq('id', user_id)
        .single();

      if (!userFetchError && userData) {
        await supabase
          .from('users')
          .update({ xp_total: (userData.xp_total || 0) + xpGanho })
          .eq('id', user_id);
      }

      return res.status(200).json({
        acertou,
        xp_ganho: xpGanho,
        resposta_correta: questao.resposta_correta,
        explicacao_gabarito: questao.explicacao_gabarito
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};

module.exports = questionsController;