const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Criar tabelas
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Tabela de usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de questões (base compartilhada)
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

    // Tabela de respostas dos usuários
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

    // Tabela de notas pessoais dos usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS notas_usuario (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        questao_id INTEGER REFERENCES questoes_base(id) ON DELETE CASCADE,
        nota TEXT,
        UNIQUE(usuario_id, questao_id)
      )
    `);

    // Tabela de progresso nos estudos (tópicos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS progresso_usuario (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        materia VARCHAR(100) NOT NULL,
        topico VARCHAR(100) NOT NULL,
        status INTEGER DEFAULT 0,
        UNIQUE(usuario_id, materia, topico)
      )
    `);

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };