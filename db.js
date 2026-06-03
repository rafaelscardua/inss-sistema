const { Pool } = require('pg');

// Usa a variável de ambiente (NÃO hardcoded!)
const connectionString = process.env.DATABASE_URL;

console.log('DATABASE_URL existe?', !!connectionString);
console.log('Primeiros caracteres:', connectionString ? connectionString.substring(0, 50) + '...' : 'NÃO DEFINIDA');

if (!connectionString) {
  console.error('❌ DATABASE_URL não definida! O Railway deve fornecer esta variável.');
  process.exit(1);
}

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

    // Tabela de anexos
    await client.query(`
            CREATE TABLE IF NOT EXISTS anexos_topico (
                id SERIAL PRIMARY KEY,
                materia VARCHAR(100) NOT NULL,
                topico VARCHAR(100) NOT NULL,
                nome_original VARCHAR(255) NOT NULL,
                nome_arquivo VARCHAR(255) NOT NULL,
                tamanho_bytes INTEGER NOT NULL,
                data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    // ADICIONE ESTA LINHA AQUI (depois de criar a tabela)
    await client.query(`
    ALTER TABLE anexos_topico ADD COLUMN IF NOT EXISTS arquivo_base64 TEXT
`)
    // Tabela de disciplinas
    await client.query(`
        CREATE TABLE IF NOT EXISTS disciplinas (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL UNIQUE,
            ordem INTEGER DEFAULT 0,
            ativo BOOLEAN DEFAULT true,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de assuntos
    await client.query(`
        CREATE TABLE IF NOT EXISTS assuntos (
            id SERIAL PRIMARY KEY,
            disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE CASCADE,
            nome VARCHAR(100) NOT NULL,
            ordem INTEGER DEFAULT 0,
            ativo BOOLEAN DEFAULT true,
            UNIQUE(disciplina_id, nome)
        )
    `);

    // Adicionar colunas na tabela questoes_base (se não existirem)
    await client.query(`
        ALTER TABLE questoes_base ADD COLUMN IF NOT EXISTS disciplina_id INTEGER REFERENCES disciplinas(id)
    `);
    await client.query(`
        ALTER TABLE questoes_base ADD COLUMN IF NOT EXISTS assunto_id INTEGER REFERENCES assuntos(id)
    `);
    ;




    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };