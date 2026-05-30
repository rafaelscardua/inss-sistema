const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Inicializar banco
initDatabase();

// ==================== ROTAS DE USUÁRIO ====================

// Cadastro
app.post('/api/cadastrar', async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
      [nome, email, senhaHash]
    );
    res.json({ sucesso: true, usuario: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      res.status(400).json({ sucesso: false, erro: 'Email já cadastrado!' });
    } else {
      res.status(500).json({ sucesso: false, erro: 'Erro ao cadastrar' });
    }
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ sucesso: false, erro: 'Email ou senha inválidos' });
    }
    const usuario = result.rows[0];
    const valido = await bcrypt.compare(senha, usuario.senha);
    if (!valido) {
      return res.status(401).json({ sucesso: false, erro: 'Email ou senha inválidos' });
    }
    res.json({ sucesso: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao fazer login' });
  }
});

// ==================== ROTAS DE QUESTÕES ====================

// Criar questão (admin/sistema)
app.post('/api/questoes', async (req, res) => {
  const { materia, assunto, enunciado, alternativas, correta, explicacao } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO questoes_base (materia, assunto, enunciado, alternativas, correta, explicacao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [materia, assunto, enunciado, alternativas, correta, explicacao]
    );
    res.json({ sucesso: true, questao: result.rows[0] });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao criar questão' });
  }
});

// Listar questões (com filtro)
app.get('/api/questoes', async (req, res) => {
  const { materia, assunto } = req.query;
  let query = 'SELECT * FROM questoes_base';
  let params = [];
  let conditions = [];
  if (materia && materia !== 'todas') {
    conditions.push(`materia = $${params.length + 1}`);
    params.push(materia);
  }
  if (assunto && assunto !== 'todos') {
    conditions.push(`assunto = $${params.length + 1}`);
    params.push(assunto);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY id';
  try {
    const result = await pool.query(query, params);
    res.json({ sucesso: true, questoes: result.rows });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar questões' });
  }
});

// Importar múltiplas questões em lote
app.post('/api/questoes/lote', async (req, res) => {
  const { questoes } = req.body;
  let importadas = 0;
  for (const q of questoes) {
    try {
      await pool.query(
        'INSERT INTO questoes_base (materia, assunto, enunciado, alternativas, correta, explicacao) VALUES ($1, $2, $3, $4, $5, $6)',
        [q.materia, q.assunto, q.enunciado, q.alternativas, q.correta, q.explicacao || '']
      );
      importadas++;
    } catch (error) {
      console.error('Erro ao importar questão:', error);
    }
  }
  res.json({ sucesso: true, importadas });
});

// ==================== ROTAS DE RESPOSTAS DO USUÁRIO ====================

// Registrar resposta de uma questão
app.post('/api/respostas', async (req, res) => {
  const { usuario_id, questao_id, acertou, resposta_usuario } = req.body;
  try {
    await pool.query(
      `INSERT INTO respostas_usuario (usuario_id, questao_id, respondida, acertou, resposta_usuario, data_resposta)
       VALUES ($1, $2, true, $3, $4, NOW())
       ON CONFLICT (usuario_id, questao_id) 
       DO UPDATE SET respondida = true, acertou = $3, resposta_usuario = $4, data_resposta = NOW()`,
      [usuario_id, questao_id, acertou, resposta_usuario]
    );
    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao salvar resposta' });
  }
});

// Buscar respostas do usuário
app.get('/api/respostas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT questao_id, respondida, acertou, resposta_usuario FROM respostas_usuario WHERE usuario_id = $1',
      [usuario_id]
    );
    const respostas = {};
    result.rows.forEach(r => {
      respostas[r.questao_id] = { respondida: r.respondida, acertou: r.acertou, resposta_usuario: r.resposta_usuario };
    });
    res.json({ sucesso: true, respostas });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar respostas' });
  }
});

// ==================== ROTAS DE NOTAS ====================

app.post('/api/notas', async (req, res) => {
  const { usuario_id, questao_id, nota } = req.body;
  try {
    await pool.query(
      `INSERT INTO notas_usuario (usuario_id, questao_id, nota) VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, questao_id) DO UPDATE SET nota = $3`,
      [usuario_id, questao_id, nota]
    );
    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao salvar nota' });
  }
});

app.get('/api/notas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query('SELECT questao_id, nota FROM notas_usuario WHERE usuario_id = $1', [usuario_id]);
    const notas = {};
    result.rows.forEach(r => { notas[r.questao_id] = r.nota; });
    res.json({ sucesso: true, notas });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar notas' });
  }
});

// ==================== ESTATÍSTICAS DO USUÁRIO ====================

app.get('/api/estatisticas/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        q.materia,
        COUNT(DISTINCT r.questao_id) as total_respondidas,
        SUM(CASE WHEN r.acertou THEN 1 ELSE 0 END) as acertos
      FROM respostas_usuario r
      JOIN questoes_base q ON r.questao_id = q.id
      WHERE r.usuario_id = $1 AND r.respondida = true
      GROUP BY q.materia
    `, [usuario_id]);
    res.json({ sucesso: true, estatisticas: result.rows });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar estatísticas' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});