const supabase = require('../config/supabase');
const { format, subDays } = require('date-fns');

const getWeekDayPt = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00').getDay();
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d];
};

const statsController = {
  getDashboardStats: async (req, res) => {
    const { id } = req.params;

    try {
      const { data: ranksData, error: ranksErr } = await supabase.rpc('get_user_ranks_fast', { p_user_id: id });

      if (ranksErr) {
        console.error("Erro ao buscar ranks no Rpc:", ranksErr);
      }

      const ranksInfo = ranksData || {
        curso: "Não selecionado",
        modalidade: "Ampla Concorrência",
        global: { total: 1, pos: 1 },
        curso_rank: { total: 1, pos: 1 },
        mod_rank: { total: 1, pos: 1 }
      };

      const last7Days = [...Array(7)].map((_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd')).reverse();
      const { data: weeklyData } = await supabase
        .from('users_progresso_diario')
        .select('data, questoes_respondidas')
        .eq('user_id', id)
        .in('data', last7Days);

      const preparedWeekDays = last7Days.map(date => ({
        day: getWeekDayPt(date), 
        questoes: weeklyData?.find(d => {
          const dbDate = String(d.data).split('T')[0];
          return dbDate === date;
        })?.questoes_respondidas || 0
      }));

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

      const materiaStatsMap = processMateriaStats(materiaData);

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

      const formattedRecentActivity = recentActivity?.map(item => ({
        questao: `${item.questoes?.questoes_temas?.[0]?.temas?.nome || 'Tema'} — ${item.questoes?.vestibulares?.nome || 'Vestibular'} ${item.questoes?.ano || ''}`.trim(),
        acertou: !!item.acertou,
        xp: item.xp_ganho || 0,
        tempo: formatTempo(item.tempo_resposta || 0)
      })) || [];

      return res.status(200).json({
        rankGlobal: {
           pos: ranksInfo.global.pos.toLocaleString('pt-BR'),
           total: ranksInfo.global.total.toLocaleString('pt-BR'),
           top: `${Math.ceil((ranksInfo.global.pos / ranksInfo.global.total) * 100)}%`,
           delta: "+0",
           trend: "up"
        },
        rankCurso: {
           curso: ranksInfo.curso,
           pos: ranksInfo.curso_rank.pos.toLocaleString('pt-BR'),
           total: ranksInfo.curso_rank.total.toLocaleString('pt-BR'),
           top: `${Math.ceil((ranksInfo.curso_rank.pos / ranksInfo.curso_rank.total) * 100)}%`,
           delta: "+0",
           trend: "up"
        },
        rankModalidade: {
           mod: ranksInfo.modalidade,
           pos: ranksInfo.mod_rank.pos.toLocaleString('pt-BR'),
           total: ranksInfo.mod_rank.total.toLocaleString('pt-BR'),
           top: `${Math.ceil((ranksInfo.mod_rank.pos / ranksInfo.mod_rank.total) * 100)}%`,
           delta: "+0",
           trend: "up"
        },
        weekDays: preparedWeekDays, 
        materiaStats: materiaStatsMap,
        recentActivity: formattedRecentActivity 
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  }
};

function processMateriaStats(data) {
  if (!data || data.length === 0) return [];
  const stats = {};
  
  data.forEach(item => {
    const materia = item.questoes?.questoes_temas?.[0]?.temas?.materia || 'Outros';
    if (!stats[materia]) stats[materia] = { total: 0, acertos: 0 };
    stats[materia].total++;
    if (item.acertou) stats[materia].acertos++;
  });

  const matterColors = {
    'Matemática': '#ffc700',
    'Física': '#1a6fbf',
    'Química': '#0f9b57',
    'Biologia': '#f97316',
    'História': '#8b5cf6',
    'Geografia': '#ec4899',
    'Filosofia': '#14b8a6',
    'Sociologia': '#64748b',
    'Português': '#eab308',
    'Literatura': '#d946ef',
    'Inglês': '#3b82f6',
    'Espanhol': '#f43f5e',
    'Redação': '#06b6d4',
    'Outros': '#94a3b8'
  };

  const fallbackColors = ['#ffc700', '#1a6fbf', '#0f9b57', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

  return Object.keys(stats).map((m, i) => ({
    materia: m,
    acertos: Math.round((stats[m].acertos / stats[m].total) * 100),
    total: stats[m].total,
    color: matterColors[m] || fallbackColors[i % fallbackColors.length]
  }));
}

function formatTempo(segundos) {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}m ${seg}s`;
}

module.exports = statsController;