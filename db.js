const { Pool } = require('pg');

// TEMPORÁRIO: URL hardcoded para teste
const connectionString = "postgresql://postgres:CzEDhLkLAzrcDFeTFlDITQSXyIfeZpIe@postgres.railway.internal:5432/railway";

console.log('Usando URL hardcoded');

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Conectando ao banco...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS questoes_base (
        id SERIAL PRIMARY KEY,
        materia VARCHAR(100) NOT NULL,
        assunto VARCHAR(100) NOT NULL,
        enunciado TEXT NOT NULL,
        alternativas JSONB NOT NULL,
        correta VARCHAR(1) NOT NULL,
        explicacao TEXT,
        criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS respostas_usuario (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        questao_id INTEGER REFERENCES questoes_base(id) ON DELETE CASCADE,
        respondida BOOLEAN DEFAULT FALSE,
        acertou BOOLEAN DEFAULT FALSE,
        resposta_usuario VARCHAR(1),
        data_resposta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(usuario_id, questao_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notas_usuario (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        questao_id INTEGER REFERENCES questoes_base(id) ON DELETE CASCADE,
        nota TEXT,
        UNIQUE(usuario_id, questao_id)
      )
    `);

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };