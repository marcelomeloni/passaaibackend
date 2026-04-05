const supabase = require('../config/supabase');
const { startOfWeek, endOfWeek, format, subDays } = require('date-fns');

const statsController = {
  getDashboardStats: async (req, res) => {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: user } = await supabase
        .from('users')
        .select('xp_total, streak_atual, streak_maximo, meta_diaria_questoes')
        .eq('id', id)
        .single();

      const { data: todayProgress } = await supabase
        .from('users_progresso_diario')
        .select('xp_ganho_dia, questoes_respondidas')
        .eq('user_id', id)
        .eq('data', today)
        .single();

      const { data: allQuestions } = await supabase
        .from('users_questoes')
        .select('acertou')
        .eq('user_id', id);

      const totalQuestions = allQuestions?.length || 0;
      const totalCorrect = allQuestions?.filter(q => q.acertou).length || 0;
      const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

      const last7Days = [...Array(7)].map((_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd')).reverse();
      const { data: weeklyData } = await supabase
        .from('users_progresso_diario')
        .select('data, questoes_respondidas')
        .eq('user_id', id)
        .in('data', last7Days);

      const { data: materiaData } = await supabase
        .from('users_questoes')
        .select(`
          acertou,
          questoes (
            questoes_temas (
              temas (materia)
            )
          )
        `)
        .eq('user_id', id);

      const materiaStats = processMateriaStats(materiaData);

      const { data: recentActivity } = await supabase
        .from('users_questoes')
        .select(`
          acertou, xp_ganho, tempo_resposta, respondido_em,
          questoes (
            enunciado, ano,
            vestibulares (nome),
            questoes_temas (temas (nome))
          )
        `)
        .eq('user_id', id)
        .order('respondido_em', { ascending: false })
        .limit(5);

      return res.status(200).json({
        statCards: [
          { label: "XP Total", value: user?.xp_total || 0, sub: `+${todayProgress?.xp_ganho_dia || 0} hoje` },
          { label: "Sequência", value: `${user?.streak_atual || 0} dias`, sub: `Recorde: ${user?.streak_maximo || 0}` },
          { label: "Questões", value: totalQuestions, sub: `${todayProgress?.questoes_respondidas || 0} hoje` },
          { label: "Taxa de acerto", value: `${accuracy}%`, sub: `Total de ${totalCorrect} acertos` }
        ],
        weekDays: last7Days.map(date => ({
          day: format(new Date(date + 'T00:00:00'), 'eee'), 
          questoes: weeklyData?.find(d => d.data === date)?.questoes_respondidas || 0,
          meta: user?.meta_diaria_questoes || 10
        })),
        materiaStats,
        recentActivity: recentActivity?.map(item => ({
          questao: `${item.questoes.questoes_temas[0]?.temas.nome} — ${item.questoes.vestibulares.nome} ${item.questoes.ano}`,
          acertou: item.acertou,
          xp: item.xp_ganho,
          tempo: formatTempo(item.tempo_resposta)
        }))
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};

function processMateriaStats(data) {
  if (!data || data.length === 0) return [];
  const stats = {};
  
  data.forEach(item => {
    const materia = item.questoes.questoes_temas[0]?.temas.materia || 'Outros';
    if (!stats[materia]) stats[materia] = { total: 0, acertos: 0 };
    stats[materia].total++;
    if (item.acertou) stats[materia].acertos++;
  });

  return Object.keys(stats).map(m => ({
    materia: m,
    acertos: Math.round((stats[m].acertos / stats[m].total) * 100),
    total: stats[m].total
  }));
}

function formatTempo(segundos) {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}m ${seg}s`;
}

module.exports = statsController;