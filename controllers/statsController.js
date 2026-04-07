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
      const { data: user } = await supabase
        .from('users')
        .select('xp_total, curso_desejado, modalidade')
        .eq('id', id)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const userXp = user.xp_total || 0;
      const userCurso = user.curso_desejado;
      const userMod = user.modalidade || 'Ampla Concorrência';

      const [
        { count: countTotalUsers },
        { count: higherXpTotalUsers },
        { count: countCursoUsers },
        { count: higherXpCursoUsers },
        { count: countModUsers },
        { count: higherXpModUsers }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gt('xp_total', userXp),
        userCurso 
          ? supabase.from('users').select('*', { count: 'exact', head: true }).eq('curso_desejado', userCurso) 
          : Promise.resolve({ count: 1 }),
        userCurso 
          ? supabase.from('users').select('*', { count: 'exact', head: true }).eq('curso_desejado', userCurso).gt('xp_total', userXp)
          : Promise.resolve({ count: 0 }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('modalidade', userMod),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('modalidade', userMod).gt('xp_total', userXp)
      ]);

      const positionGlobal = (higherXpTotalUsers || 0) + 1;
      const totalGlobal = countTotalUsers || 1;

      const positionCurso = (higherXpCursoUsers || 0) + 1;
      const totalCurso = countCursoUsers || 1;

      const positionMod = (higherXpModUsers || 0) + 1;
      const totalMod = countModUsers || 1;

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
           pos: positionGlobal.toLocaleString('pt-BR'),
           total: totalGlobal.toLocaleString('pt-BR'),
           top: `${Math.ceil((positionGlobal / totalGlobal) * 100)}%`,
           delta: "+0",
           trend: "up"
        },
        rankCurso: {
           curso: userCurso || "Não selecionado",
           pos: positionCurso.toLocaleString('pt-BR'),
           total: totalCurso.toLocaleString('pt-BR'),
           top: `${Math.ceil((positionCurso / totalCurso) * 100)}%`,
           delta: "+0",
           trend: "up"
        },
        rankModalidade: {
           mod: userMod,
           pos: positionMod.toLocaleString('pt-BR'),
           total: totalMod.toLocaleString('pt-BR'),
           top: `${Math.ceil((positionMod / totalMod) * 100)}%`,
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