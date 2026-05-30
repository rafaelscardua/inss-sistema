const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');
require('dotenv').config();

console.log('=== INICIANDO SERVIDOR ===');
console.log('PORT:', process.env.PORT);
console.log('ALLOWED_EMAILS:', process.env.ALLOWED_EMAILS);
console.log('DATABASE_URL existe?', !!process.env.DATABASE_URL);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/Frontend'));
app.use(express.static('Frontend'));

// Inicializar banco de dados
initDatabase().catch(err => console.error('Erro ao inicializar banco:', err));

// ==================== ROTAS DE USUÁRIO ====================

// Cadastro
// Cadastro com lista de emails permitidos
app.post('/api/cadastrar', async (req, res) => {
  const { nome, email, senha } = req.body;
  
  // Verifica se email está na lista de permitidos
  const allowedEmails = process.env.ALLOWED_EMAILS ? process.env.ALLOWED_EMAILS.split(',') : [];
  const isAllowed = allowedEmails.includes(email);
  
  if (!isAllowed) {
    return res.status(403).json({ 
      sucesso: false, 
      erro: 'Email não autorizado. Contate o administrador para se cadastrar.' 
    });
  }
  
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

// Listar questões
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

// ==================== ROTAS DE RESPOSTAS ====================

// Registrar resposta
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
      respostas[r.questao_id] = { 
        respondida: r.respondida, 
        acertou: r.acertou, 
        resposta_usuario: r.resposta_usuario 
      };
    });
    res.json({ sucesso: true, respostas });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: 'Erro ao buscar respostas' });
  }
});

// ==================== ESTATÍSTICAS ====================

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

console.log('=== CONFIGURAÇÕES APLICADAS ===');
console.log('Rotas registradas: /api/cadastrar, /api/login, /api/questoes');

// Rota principal - serve o login.html
app.get('/', (req, res) => {
  res.sendFile('login.html', { root: './Frontend' });
});

// Rota para qualquer outra página HTML
app.get('*.html', (req, res) => {
  res.sendFile(req.path, { root: './Frontend' });
});


app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});