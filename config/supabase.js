const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Obtém as variáveis de ambiente do seu arquivo .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Validação simples para evitar erros de conexão caso esqueça o .env
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_ANON_KEY não foram definidos no arquivo .env');
  process.exit(1);
}

// Inicializa o cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;