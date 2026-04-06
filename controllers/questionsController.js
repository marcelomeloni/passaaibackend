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

      // 1. Busca os dados da questão para validar o acerto
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

      // 2. Insere a resposta do usuário na tabela de relação (users_questoes)
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

      // 3. Busca os dados atuais do usuário para processar Streak e XP
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('xp_total, ultimo_estudo, streak_atual, streak_maximo, meta_diaria_questoes')
        .eq('id', user_id)
        .single();

      if (userFetchError || !userData) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // --- LOGIC: STREAK ---
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // "YYYY-MM-DD"

      let newStreakAtual = userData.streak_atual || 0;
      let newStreakMaximo = userData.streak_maximo || 0;

      if (!userData.ultimo_estudo || userData.ultimo_estudo < yesterdayStr) {
        // Null ou antes de ontem: Reseta
        newStreakAtual = 1;
      } else if (userData.ultimo_estudo === yesterdayStr) {
        // Ontem: Incrementa
        newStreakAtual += 1;
      } else if (userData.ultimo_estudo === todayStr) {
        // Hoje: Mantém (usuário já havia respondido algo hoje)
        // newStreakAtual não muda
      }

      if (newStreakAtual > newStreakMaximo) {
        newStreakMaximo = newStreakAtual;
      }

      // --- LOGIC: DAILY PROGRESS ---
      // Pegamos o progresso atual do dia (se existir) para incrementar via código
      const { data: dailyProgress } = await supabase
        .from('users_progresso_diario')
        .select('questoes_respondidas, xp_ganho_dia')
        .eq('user_id', user_id)
        .eq('data', todayStr)
        .single();

      const questoesRespondidasHoje = (dailyProgress?.questoes_respondidas || 0) + 1;
      const xpGanhoHoje = (dailyProgress?.xp_ganho_dia || 0) + xpGanho;
      
      const metaDiaria = userData.meta_diaria_questoes || 10;
      const metaBatida = questoesRespondidasHoje >= metaDiaria;

      // Upsert no progresso diário (assume que user_id + data compõe uma Unique Key / Constraint)
      await supabase
        .from('users_progresso_diario')
        .upsert([{
          user_id,
          data: todayStr,
          questoes_respondidas: questoesRespondidasHoje,
          xp_ganho_dia: xpGanhoHoje,
          meta_batida: metaBatida
        }], { onConflict: 'user_id, data' });

      // --- UPDATE: USER PROFILE ---
      await supabase
        .from('users')
        .update({ 
          xp_total: (userData.xp_total || 0) + xpGanho,
          ultimo_estudo: todayStr,
          streak_atual: newStreakAtual,
          streak_maximo: newStreakMaximo
        })
        .eq('id', user_id);

      // Retorna o resultado para o Frontend
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