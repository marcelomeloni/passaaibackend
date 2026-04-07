const supabase = require('../config/supabase');
const { formatDistanceToNow } = require('date-fns');
const { ptBR } = require('date-fns/locale/pt-BR');

const dashboardController = {
  getDashboardData: async (req, res) => {
    const { id } = req.params;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_user_dashboard_fast', { p_user_id: id });
        
      if (rpcErr) {
        console.error("Erro ao buscar stats por RPC:", rpcErr);
      }

      const computedStats = rpcData?.stats || {
        xp: 0,
        streak: 0,
        questoesResolvidas: 0,
        acertoMedio: '0%'
      };

      const { data: questoesInfo } = await supabase
        .from('users_questoes')
        .select(`
          acertou, respondido_em,
          questoes ( 
            enunciado,
            questoes_temas ( temas ( nome, materia ) )
          )
        `)
        .eq('user_id', id);

      // Processamento Materias
      const mapMaterias = {};
      questoesInfo?.forEach(q => {
        const mat = q.questoes?.questoes_temas?.[0]?.temas?.materia || 'Outros';
        if (!mapMaterias[mat]) mapMaterias[mat] = { acertos: 0, total: 0 };
        mapMaterias[mat].total++;
        if (q.acertou) mapMaterias[mat].acertos++;
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
      
      const fallbackColors = ['#ffc700', '#1a6fbf', '#0f9b57', '#f97316', '#8b5cf6'];
      
      const desempenhoMaterias = Object.keys(mapMaterias)
        .map((mat, i) => ({
          materia: mat,
          acertos: mapMaterias[mat].acertos,
          total: mapMaterias[mat].total,
          color: matterColors[mat] || fallbackColors[i % fallbackColors.length]
        }))
        .sort((a, b) => b.total - a.total).slice(0, 5); // 5 principais

      // Processamento Histórico
      const recentActivity = [...(questoesInfo || [])]
        .sort((a, b) => new Date(b.respondido_em) - new Date(a.respondido_em))
        .slice(0, 4)
        .map(q => ({
          subject: q.questoes?.questoes_temas?.[0]?.temas?.materia || 'Diversos',
          time: formatDistanceToNow(new Date(q.respondido_em), { locale: ptBR, addSuffix: true }),
          correct: !!q.acertou,
          content: q.questoes?.questoes_temas?.[0]?.temas?.nome || 'Questão Prática'
        }));

      return res.status(200).json({
        stats: computedStats,
        desempenhoMaterias,
        recentActivity
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  }
};

module.exports = dashboardController;
