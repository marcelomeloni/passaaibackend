const supabase = require('../config/supabase');

const cursoController = {
  // Buscar todos os cursos
  getAllCursos: async (req, res) => {
    try {
      // Busca os cursos no banco de dados e ordena em ordem alfabética
      const { data: cursos, error } = await supabase
        .from('cursos')
        .select('id, nome, created_at')
        .order('nome', { ascending: true });

      if (error) throw error;

      return res.status(200).json(cursos);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
};

module.exports = cursoController;