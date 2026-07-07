const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDatabase } = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET não definida! Defina essa variável de ambiente (uma string longa e aleatória) no Railway.');
    process.exit(1);
}

const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Criar pasta uploads se não existir
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configurar multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

console.log('=== INICIANDO SERVIDOR ===');
console.log('PORT:', process.env.PORT);
console.log('ALLOWED_EMAILS:', process.env.ALLOWED_EMAILS);
console.log('DATABASE_URL existe?', !!process.env.DATABASE_URL);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Limite aumentado para 200mb porque o backup completo (com anexos em base64) pode ser grande
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(express.static(__dirname + '/Frontend'));
app.use(express.static('Frontend'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== AUTENTICAÇÃO REAL (JWT) ====================
// Antes, várias rotas confiavam num header (x-user-email) que o próprio
// navegador envia - ou seja, qualquer pessoa podia forjar esse header e se
// passar por outro usuário (inclusive o admin), sem precisar de senha.
// Agora a identidade vem de um token assinado pelo servidor no login, que só
// o próprio servidor sabe validar.

// Gera um token para o usuário logado, válido por 30 dias
function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, nome: usuario.nome, email: usuario.email },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// Middleware "leve": roda em toda requisição. Se vier um token válido no
// header Authorization, preenche req.usuario com os dados verificados.
// Não bloqueia quem não tiver token (rotas públicas como /api/login precisam
// continuar funcionando sem isso) - quem exige login usa exigirLogin/exigirAdmin.
function autenticar(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            req.usuario = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            req.usuario = null;
        }
    } else {
        req.usuario = null;
    }
    next();
}

// Exige que exista um usuário autenticado com token válido
function exigirLogin(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({ sucesso: false, erro: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    next();
}

// Exige que o usuário autenticado seja o administrador
function exigirAdmin(req, res, next) {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    if (!req.usuario || req.usuario.email !== adminEmail) {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    next();
}

app.use(autenticar);

// Inicializar banco de dados
initDatabase().catch(err => console.error('Erro ao inicializar banco:', err));

// ... resto do código continua igual ...

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
        const usuarioSemSenha = { id: usuario.id, nome: usuario.nome, email: usuario.email };
        const token = gerarToken(usuarioSemSenha);
        res.json({ sucesso: true, usuario: usuarioSemSenha, token });
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


// Criar nova questão (POST) - COM CRIAÇÃO AUTOMÁTICA DE DISCIPLINA E ASSUNTO
app.post('/api/questoes', async (req, res) => {
    const { materia, assunto, enunciado, alternativas, correta, explicacao } = req.body;

    try {
        // 1. Verificar ou criar a DISCIPLINA
        let disciplinaResult = await pool.query(
            'SELECT id FROM disciplinas WHERE nome = $1',
            [materia]
        );

        let disciplina_id;
        if (disciplinaResult.rows.length === 0) {
            const newDisciplina = await pool.query(
                'INSERT INTO disciplinas (nome) VALUES ($1) RETURNING id',
                [materia]
            );
            disciplina_id = newDisciplina.rows[0].id;
            console.log(`✅ Nova disciplina criada: ${materia} (id: ${disciplina_id})`);
        } else {
            disciplina_id = disciplinaResult.rows[0].id;
        }

        // 2. Verificar ou criar o ASSUNTO
        let assuntoResult = await pool.query(
            'SELECT id FROM assuntos WHERE nome = $1 AND disciplina_id = $2',
            [assunto, disciplina_id]
        );

        let assunto_id;
        if (assuntoResult.rows.length === 0) {
            const newAssunto = await pool.query(
                'INSERT INTO assuntos (disciplina_id, nome) VALUES ($1, $2) RETURNING id',
                [disciplina_id, assunto]
            );
            assunto_id = newAssunto.rows[0].id;
            console.log(`✅ Novo assunto criado: ${assunto} (id: ${assunto_id})`);
        } else {
            assunto_id = assuntoResult.rows[0].id;
        }

        // 3. Inserir a questão com os IDs
        const result = await pool.query(
            `INSERT INTO questoes_base (materia, assunto, enunciado, alternativas, correta, explicacao, disciplina_id, assunto_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [materia, assunto, enunciado, alternativas, correta, explicacao || '', disciplina_id, assunto_id]
        );

        res.json({ sucesso: true, questao: result.rows[0] });

    } catch (error) {
        console.error('Erro ao criar questão:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao criar questão: ' + error.message });
    }
});

// ==================== ROTAS DE PROGRESSO DOS ASSUNTOS ====================

// Atualizar progresso do assunto
app.put('/api/assuntos/:id/progresso', async (req, res) => {
    try {
        const { id } = req.params;
        const { progresso } = req.body;
        const userEmail = req.usuario?.email;

        console.log(`📊 Atualizando progresso do assunto ${id} para ${progresso}%`);

        // Verificar autenticação
        if (!userEmail) {
            return res.status(401).json({ erro: 'Email não fornecido' });
        }

        // Atualizar progresso
        await pool.query('UPDATE assuntos SET progresso = $1 WHERE id = $2', [progresso, id]);

        res.json({ sucesso: true, progresso });

    } catch (error) {
        console.error('Erro ao atualizar progresso:', error);
        res.status(500).json({ erro: error.message });
    }
});

// Atualizar status do assunto
app.put('/api/assuntos/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userEmail = req.usuario?.email;

        console.log(`📌 Atualizando status do assunto ${id} para ${status}`);

        if (!userEmail) {
            return res.status(401).json({ erro: 'Email não fornecido' });
        }

        await pool.query('UPDATE assuntos SET status = $1 WHERE id = $2', [status, id]);

        res.json({ sucesso: true, status });

    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== FAVORITOS ====================

// Buscar favoritos do usuário
app.get('/api/favoritos/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token vê os próprios favoritos
    try {
        const result = await pool.query(
            `SELECT q.*, f.data_favorito 
             FROM favoritos_usuario f
             JOIN questoes_base q ON f.questao_id = q.id
             WHERE f.usuario_id = $1
             ORDER BY f.data_favorito DESC`,
            [usuario_id]
        );
        res.json({ sucesso: true, favoritos: result.rows });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar favoritos' });
    }
});

// Adicionar favorito
app.post('/api/favoritos', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id;
    const { questao_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO favoritos_usuario (usuario_id, questao_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [usuario_id, questao_id]
        );
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao adicionar favorito' });
    }
});

// Remover favorito
app.delete('/api/favoritos/:usuario_id/:questao_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id;
    const { questao_id } = req.params;
    try {
        await pool.query(
            'DELETE FROM favoritos_usuario WHERE usuario_id = $1 AND questao_id = $2',
            [usuario_id, questao_id]
        );
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao remover favorito' });
    }
});



// ==================== ROTAS DE ANEXOS ====================

// 1º - DOWNLOAD (rota específica - tem que vir PRIMEIRO!)
app.get('/api/anexos/download/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM anexos_topico WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Anexo não encontrado' });
        }

        const anexo = result.rows[0];
        res.json({
            sucesso: true,
            arquivo_base64: anexo.arquivo_base64,
            nome_original: anexo.nome_original
        });
    } catch (error) {
        console.error('Erro no download:', error);
        res.status(500).json({ erro: 'Erro ao baixar' });
    }
});

// 2º - LISTAR todos (admin)
app.get('/api/anexos/todos', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        const result = await pool.query('SELECT * FROM anexos_topico ORDER BY id DESC');
        res.json({ sucesso: true, anexos: result.rows });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar anexos' });
    }
});

// 3º - LISTAR anexos de um tópico (rota com parâmetros genéricos - vem por último!)
app.get('/api/anexos/:materia/:topico', async (req, res) => {
    const { materia, topico } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, nome_original, tamanho_bytes, data_upload FROM anexos_topico WHERE materia = $1 AND topico = $2 ORDER BY data_upload DESC',
            [decodeURIComponent(materia), decodeURIComponent(topico)]
        );
        res.json({ sucesso: true, anexos: result.rows });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar anexos' });
    }
});

// 4º - UPLOAD (POST)
app.post('/api/anexos/upload', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ sucesso: false, erro: 'Apenas administrador pode adicionar anexos' });
    }

    const { materia, topico, nome_original, tamanho_bytes, arquivo_base64 } = req.body;

    try {
        await pool.query(
            `INSERT INTO anexos_topico (materia, topico, nome_original, nome_arquivo, tamanho_bytes, arquivo_base64) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [materia, topico, nome_original, Date.now() + '_' + nome_original, tamanho_bytes, arquivo_base64]
        );
        res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao salvar anexo:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar anexo' });
    }
});

// 5º - EXCLUIR (DELETE)
app.delete('/api/anexos/:id', async (req, res) => {
    const { id } = req.params;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ sucesso: false, erro: 'Apenas administrador pode excluir anexos' });
    }

    try {
        await pool.query('DELETE FROM anexos_topico WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao excluir anexo:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir anexo' });
    }
});



// ==================== ROTAS DE RESPOSTAS ====================

// Registrar resposta
app.post('/api/respostas', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id;
    const { questao_id, acertou, resposta_usuario } = req.body;
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
app.get('/api/respostas/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token vê suas respostas
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

app.get('/api/estatisticas/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token vê suas estatísticas
    try {
        // Buscar total de questões por matéria
        const totaisResult = await pool.query(`
      SELECT 
        materia,
        COUNT(*) as total_questoes
      FROM questoes_base
      GROUP BY materia
    `);

        // Buscar acertos do usuário por matéria
        const acertosResult = await pool.query(`
      SELECT 
        q.materia,
        COUNT(*) as acertos
      FROM respostas_usuario r
      JOIN questoes_base q ON r.questao_id = q.id
      WHERE r.usuario_id = $1 AND r.acertou = true AND r.respondida = true
      GROUP BY q.materia
    `, [usuario_id]);

        // Criar mapa de totais
        const totaisMap = {};
        totaisResult.rows.forEach(row => {
            totaisMap[row.materia] = parseInt(row.total_questoes);
        });

        // Criar mapa de acertos
        const acertosMap = {};
        acertosResult.rows.forEach(row => {
            acertosMap[row.materia] = parseInt(row.acertos);
        });

        // Combinar
        const estatisticas = Object.keys(totaisMap).map(materia => ({
            materia: materia,
            total_questoes: totaisMap[materia],
            acertos: acertosMap[materia] || 0,
            total_respondidas: acertosMap[materia] || 0
        }));

        res.json({ sucesso: true, estatisticas });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
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



// ==================== ADMIN - EXCLUIR USUÁRIO ====================

// Middleware para verificar se é admin
async function isAdmin(email) {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    return email === adminEmail;
}


// ==================== ROTAS DE ADMIN ====================

// Middleware para verificar se é admin
async function isAdmin(email) {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    return email === adminEmail;
}

// Listar todos os usuários (apenas admin)
app.get('/api/admin/usuarios', async (req, res) => {
    try {
        const userEmail = req.usuario?.email;
        if (!await isAdmin(userEmail)) {
            return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
        }

        const result = await pool.query(
            'SELECT id, nome, email, data_criacao FROM usuarios ORDER BY nome'
        );
        res.json({ sucesso: true, usuarios: result.rows });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar usuários' });
    }
});

// Estatísticas detalhadas de um usuário específico (apenas admin)
app.get('/api/admin/estatisticas/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
    try {
        const userEmail = req.usuario?.email;
        if (!await isAdmin(userEmail)) {
            return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
        }

        const result = await pool.query(`
            SELECT 
                q.materia,
                COUNT(CASE WHEN r.respondida THEN 1 END) as total_respondidas,
                SUM(CASE WHEN r.acertou THEN 1 ELSE 0 END) as acertos
            FROM usuarios u
            LEFT JOIN respostas_usuario r ON u.id = r.usuario_id
            LEFT JOIN questoes_base q ON r.questao_id = q.id
            WHERE u.id = $1
            GROUP BY q.materia
            ORDER BY q.materia
        `, [usuario_id]);

        const errosResult = await pool.query(`
            SELECT 
                q.id, q.materia, q.assunto, q.enunciado, q.correta,
                r.resposta_usuario, r.data_resposta
            FROM respostas_usuario r
            JOIN questoes_base q ON r.questao_id = q.id
            WHERE r.usuario_id = $1 AND r.acertou = false
            ORDER BY r.data_resposta DESC
            LIMIT 50
        `, [usuario_id]);

        res.json({
            sucesso: true,
            estatisticas: result.rows,
            erros: errosResult.rows
        });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar estatísticas' });
    }
});

// Excluir usuário (apenas ADMIN)
app.delete('/api/admin/excluir-usuario/:id', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;
    const adminEmail = req.usuario?.email;

    console.log("Excluindo usuário:", id);
    console.log("Admin email:", adminEmail);

    // Verificar se é admin
    if (!await isAdmin(adminEmail)) {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }

    // Verificar senha do admin
    const adminResult = await pool.query('SELECT senha FROM usuarios WHERE email = $1', [adminEmail]);
    if (adminResult.rows.length === 0) {
        return res.status(401).json({ sucesso: false, erro: 'Admin não encontrado' });
    }

    const senhaValida = await bcrypt.compare(senha, adminResult.rows[0].senha);
    if (!senhaValida) {
        return res.status(401).json({ sucesso: false, erro: 'Senha incorreta' });
    }

    try {
        await pool.query('DELETE FROM respostas_usuario WHERE usuario_id = $1', [id]);
        await pool.query('DELETE FROM notas_usuario WHERE usuario_id = $1', [id]);
        //    await pool.query('DELETE FROM progresso_usuario WHERE usuario_id = $1', [id]);
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

        console.log("Usuário excluído com sucesso!");
        res.json({ sucesso: true, mensagem: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir usuário' });
    }
});




// Criar tabela progresso_usuario (se não existir)
app.post('/api/admin/criar-tabela-progresso', async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS progresso_usuario (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                materia VARCHAR(100) NOT NULL,
                topico VARCHAR(100) NOT NULL,
                status INTEGER DEFAULT 0,
                UNIQUE(usuario_id, materia, topico)
            )
        `);
        res.json({ sucesso: true, mensagem: 'Tabela progresso_usuario criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar tabela:', error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


// Deletar resposta de um usuário para uma questão específica (mantém a questão)
app.delete('/api/respostas/usuario/:usuarioId/questao/:questaoId', async (req, res) => {
    const { usuarioId, questaoId } = req.params;
    try {
        await pool.query(
            'DELETE FROM respostas_usuario WHERE usuario_id = $1 AND questao_id = $2',
            [usuarioId, questaoId]
        );
        res.json({ sucesso: true, mensagem: 'Resposta deletada' });
    } catch (error) {
        console.error('Erro ao deletar resposta:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao deletar resposta' });
    }
});

// ==================== EXCLUIR QUESTÃO ====================

// Excluir questão (DELETE)
app.delete('/api/questoes/:id', async (req, res) => {
    const { id } = req.params;
    console.log("Excluindo questão:", id);
    try {
        // Primeiro exclui as respostas associadas
        await pool.query('DELETE FROM respostas_usuario WHERE questao_id = $1', [id]);
        // Depois exclui a questão
        await pool.query('DELETE FROM questoes_base WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao excluir questão:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir questão: ' + error.message });
    }
});


// Atualizar questão (PUT)
app.put('/api/questoes/:id', async (req, res) => {
    const { id } = req.params;
    const { materia, assunto, enunciado, alternativas, correta, explicacao, disciplina_id, assunto_id } = req.body;
    try {
        await pool.query(
            `UPDATE questoes_base 
             SET materia = $1, assunto = $2, enunciado = $3, alternativas = $4, correta = $5, explicacao = $6,
             disciplina_id = $7, assunto_id = $8
             WHERE id = $9`,
            [materia, assunto, enunciado, alternativas, correta, explicacao || '', disciplina_id, assunto_id, id]
        );
        res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao atualizar questão:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar questão' });
    }
});

// ==================== ROTAS DE DISCIPLINAS E ASSUNTOS ====================


// Listar todas as disciplinas com seus assuntos
app.get('/api/admin/disciplinas', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        // Buscar disciplinas
        const disciplinasResult = await pool.query(
            'SELECT id, nome, ordem, ativo, data_criacao FROM disciplinas ORDER BY ordem, id'
        );

        const disciplinas = disciplinasResult.rows;

        // Buscar assuntos para cada disciplina
        for (let i = 0; i < disciplinas.length; i++) {
            const assuntosResult = await pool.query(
                'SELECT id, nome, ordem, ativo FROM assuntos WHERE disciplina_id = $1 ORDER BY ordem NULLS LAST, id',
                [disciplinas[i].id]
            );
            disciplinas[i].assuntos = assuntosResult.rows;
        }

        res.json({ sucesso: true, disciplinas });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ erro: 'Erro ao buscar disciplinas: ' + error.message });
    }
});

// Criar disciplina
app.post('/api/admin/disciplinas', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { nome } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO disciplinas (nome) VALUES ($1) RETURNING *',
            [nome]
        );
        res.json({ sucesso: true, disciplina: result.rows[0] });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao criar disciplina' });
    }
});

// Editar disciplina
app.put('/api/admin/disciplinas/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        await pool.query('UPDATE disciplinas SET nome = $1 WHERE id = $2', [nome, id]);
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao editar disciplina' });
    }
});

// Excluir disciplina
app.delete('/api/admin/disciplinas/:id', async (req, res) => {
    const { id } = req.params;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        await pool.query('DELETE FROM disciplinas WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao excluir disciplina' });
    }
});

// Criar assunto
app.post('/api/admin/assuntos', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { disciplina_id, nome } = req.body;
    console.log("Criando assunto:", { disciplina_id, nome });

    try {
        const result = await pool.query(
            'INSERT INTO assuntos (disciplina_id, nome) VALUES ($1, $2) RETURNING *',
            [disciplina_id, nome]
        );
        res.json({ sucesso: true, assunto: result.rows[0] });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({ erro: 'Erro ao criar assunto: ' + error.message });
    }
});

// Editar assunto
// Editar assunto
app.put('/api/admin/assuntos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        // 1. Buscar o nome antigo do assunto
        const assuntoAntigo = await pool.query(
            'SELECT nome FROM assuntos WHERE id = $1',
            [id]
        );

        if (assuntoAntigo.rows.length === 0) {
            return res.status(404).json({ erro: 'Assunto não encontrado' });
        }

        const nomeAntigo = assuntoAntigo.rows[0].nome;

        // 2. Atualizar o nome do assunto na tabela assuntos
        await pool.query('UPDATE assuntos SET nome = $1 WHERE id = $2', [nome, id]);

        // 3. Atualizar o campo 'assunto' em todas as questões que usam este assunto
        await pool.query(
            'UPDATE questoes_base SET assunto = $1 WHERE assunto_id = $2',
            [nome, id]
        );

        console.log(`✅ Assunto atualizado: "${nomeAntigo}" → "${nome}" (${id})`);
        console.log(`📝 Questões atualizadas: assunto_id = ${id}`);

        res.json({ sucesso: true });

    } catch (error) {
        console.error('Erro ao editar assunto:', error);
        res.status(500).json({ erro: 'Erro ao editar assunto: ' + error.message });
    }
});

// Excluir assunto
app.delete('/api/admin/assuntos/:id', async (req, res) => {
    const { id } = req.params;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        await pool.query('DELETE FROM assuntos WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao excluir assunto' });
    }
});

// Listar todos os assuntos (admin)
app.get('/api/admin/assuntos', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        const result = await pool.query('SELECT * FROM assuntos ORDER BY id');
        res.json({ sucesso: true, assuntos: result.rows });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar assuntos' });
    }
});

// Buscar disciplinas com progresso do usuário
// Buscar disciplinas com progresso do usuário (COM PERMISSÕES)
// OTIMIZADO: antes fazia 1 + D + (2 × A) queries (uma cascata por disciplina/assunto).
// Agora faz sempre 2 queries, não importa quantas disciplinas/assuntos existam.
app.get('/api/plano-estudos/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token vê seu próprio plano
    try {
        // 1ª query: disciplinas ativas
        const disciplinasResult = await pool.query(
            'SELECT id, nome FROM disciplinas WHERE ativo = true ORDER BY id'
        );

        // 2ª query: todos os assuntos permitidos para o usuário, já com total de questões
        // e acertos calculados via agregação (GROUP BY), em vez de uma query por assunto
        const assuntosResult = await pool.query(
            `SELECT
                a.disciplina_id,
                a.id AS assunto_id,
                a.nome AS assunto_nome,
                a.ordem,
                COUNT(DISTINCT q.id) AS total_questoes,
                COUNT(DISTINCT r.questao_id) AS acertos
             FROM assuntos a
             JOIN usuario_assuntos ua ON ua.assunto_id = a.id AND ua.usuario_id = $1
             LEFT JOIN questoes_base q ON q.disciplina_id = a.disciplina_id AND q.assunto_id = a.id
             LEFT JOIN respostas_usuario r ON r.questao_id = q.id AND r.usuario_id = $1 AND r.acertou = true
             WHERE a.ativo = true
             GROUP BY a.disciplina_id, a.id, a.nome, a.ordem
             ORDER BY a.ordem NULLS LAST, a.id`,
            [usuario_id]
        );

        // Agrupa os assuntos por disciplina em memória (rápido, já são poucos registros)
        const assuntosPorDisciplina = new Map();
        for (const row of assuntosResult.rows) {
            const total = parseInt(row.total_questoes);
            const acertos = parseInt(row.acertos);
            const assunto = {
                id: row.assunto_id,
                nome: row.assunto_nome,
                total_questoes: total,
                progresso: total > 0 ? Math.round((acertos / total) * 100) : 0
            };
            if (!assuntosPorDisciplina.has(row.disciplina_id)) {
                assuntosPorDisciplina.set(row.disciplina_id, []);
            }
            assuntosPorDisciplina.get(row.disciplina_id).push(assunto);
        }

        const disciplinas = disciplinasResult.rows.map(d => ({
            id: d.id,
            nome: d.nome,
            assuntos: assuntosPorDisciplina.get(d.id) || []
        }));

        res.json({ sucesso: true, disciplinas });
    } catch (error) {
        console.error('Erro ao buscar plano de estudos:', error);
        res.status(500).json({ erro: 'Erro ao buscar plano de estudos' });
    }
});

// ==================== META DIÁRIA E SEQUÊNCIA (STREAK) ====================

// Calcula quantos dias consecutivos o usuário bateu a meta diária.
// "dias" vem ordenado do mais recente para o mais antigo.
function calcularStreak(dias, metaDiaria, hojeStr) {
    const mapa = new Map(dias.map(d => [d.dia, parseInt(d.total)]));

    const cursor = new Date(hojeStr + 'T00:00:00Z');
    const formatar = (data) => data.toISOString().slice(0, 10);

    // Se hoje ainda não bateu a meta, não conta hoje ainda (mas também não quebra
    // o streak dos dias anteriores) - começa a contagem a partir de ontem
    const hojeBateu = (mapa.get(hojeStr) || 0) >= metaDiaria;
    if (!hojeBateu) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    let streak = 0;
    while ((mapa.get(formatar(cursor)) || 0) >= metaDiaria) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
}

// Buscar meta diária, progresso de hoje e sequência atual
app.get('/api/meta/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token vê sua própria meta
    try {
        const usuarioResult = await pool.query('SELECT meta_diaria FROM usuarios WHERE id = $1', [usuario_id]);
        if (usuarioResult.rows.length === 0) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        const metaDiaria = usuarioResult.rows[0].meta_diaria || 20;

        // Usa o fuso/relógio do próprio Postgres como referência de "hoje", pra não
        // depender do fuso horário do servidor Node
        const hojeResult = await pool.query(`SELECT to_char(NOW(), 'YYYY-MM-DD') AS hoje`);
        const hojeStr = hojeResult.rows[0].hoje;

        const diasResult = await pool.query(
            `SELECT to_char(data_resposta, 'YYYY-MM-DD') AS dia, COUNT(DISTINCT questao_id) AS total
             FROM respostas_usuario
             WHERE usuario_id = $1
             GROUP BY dia
             ORDER BY dia DESC
             LIMIT 400`,
            [usuario_id]
        );

        const respondidasHoje = diasResult.rows.find(d => d.dia === hojeStr);
        const streak = calcularStreak(diasResult.rows, metaDiaria, hojeStr);

        res.json({
            sucesso: true,
            meta_diaria: metaDiaria,
            respondidas_hoje: respondidasHoje ? parseInt(respondidasHoje.total) : 0,
            streak
        });
    } catch (error) {
        console.error('Erro ao buscar meta diária:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar meta diária' });
    }
});

// Atualizar a meta diária do usuário
app.put('/api/meta/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token muda sua própria meta
    const { meta_diaria } = req.body;

    const valor = parseInt(meta_diaria);
    if (!valor || valor <= 0 || valor > 1000) {
        return res.status(400).json({ sucesso: false, erro: 'Meta inválida. Use um número entre 1 e 1000.' });
    }

    try {
        await pool.query('UPDATE usuarios SET meta_diaria = $1 WHERE id = $2', [valor, usuario_id]);
        res.json({ sucesso: true, meta_diaria: valor });
    } catch (error) {
        console.error('Erro ao atualizar meta diária:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar meta diária' });
    }
});


// ==================== ROTAS DE PERMISSÕES POR USUÁRIO ====================

// Buscar assuntos permitidos para um usuário
app.get('/api/usuario/assuntos/:usuario_id', exigirLogin, async (req, res) => {
    const usuario_id = req.usuario.id; // ignora o :usuario_id da URL - só o dono do token vê suas próprias permissões
    try {
        const result = await pool.query(`
            SELECT a.id, a.nome, a.disciplina_id
            FROM assuntos a
            JOIN usuario_assuntos ua ON a.id = ua.assunto_id
            WHERE ua.usuario_id = $1 AND a.ativo = true
        `, [usuario_id]);
        res.json({ sucesso: true, assuntos: result.rows });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar assuntos do usuário' });
    }
});

// Admin: Listar permissões de um usuário
app.get('/api/admin/usuario/:usuario_id/permissoes', async (req, res) => {
    const { usuario_id } = req.params;
    const adminEmail = req.usuario?.email;
    const adminEmailConfig = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';

    if (adminEmail !== adminEmailConfig) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        // Buscar todos os assuntos
        const todosAssuntos = await pool.query('SELECT id, nome, disciplina_id FROM assuntos');

        // Buscar assuntos permitidos para este usuário
        const permitidos = await pool.query(
            'SELECT assunto_id FROM usuario_assuntos WHERE usuario_id = $1',
            [usuario_id]
        );

        const permitidosSet = new Set(permitidos.rows.map(r => r.assunto_id));

        const assuntos = todosAssuntos.rows.map(a => ({
            id: a.id,
            nome: a.nome,
            disciplina_id: a.disciplina_id,
            permitido: permitidosSet.has(a.id)
        }));

        res.json({ sucesso: true, assuntos });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar permissões' });
    }
});

// Admin: Atualizar permissões de um usuário
app.put('/api/admin/usuario/:usuario_id/permissoes', async (req, res) => {
    const { usuario_id } = req.params;
    const { assuntos_ids } = req.body;
    const adminEmail = req.usuario?.email;
    const adminEmailConfig = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';

    console.log(`📝 Atualizando permissões do usuário ${usuario_id}`);
    console.log(`Assuntos IDs:`, assuntos_ids);

    if (adminEmail !== adminEmailConfig) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    if (!assuntos_ids || !Array.isArray(assuntos_ids)) {
        return res.status(400).json({ erro: 'assuntos_ids deve ser um array' });
    }

    try {
        // Remover todas as permissões atuais
        await pool.query('DELETE FROM usuario_assuntos WHERE usuario_id = $1', [usuario_id]);
        console.log(`🗑️ Removidas permissões antigas do usuário ${usuario_id}`);

        // Adicionar as novas permissões
        for (const assunto_id of assuntos_ids) {
            await pool.query(
                'INSERT INTO usuario_assuntos (usuario_id, assunto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [usuario_id, assunto_id]
            );
        }
        console.log(`✅ Adicionadas ${assuntos_ids.length} permissões para o usuário ${usuario_id}`);

        res.json({ sucesso: true, mensagem: 'Permissões atualizadas' });
    } catch (error) {
        console.error('Erro ao atualizar permissões:', error);
        res.status(500).json({ erro: error.message });
    }
});




// ==================== ROTAS PARA ATIVAR/DESATIVAR ====================

// Ativar/desativar disciplina
app.put('/api/admin/disciplinas/:id/ativo', async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        await pool.query('UPDATE disciplinas SET ativo = $1 WHERE id = $2', [ativo, id]);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao atualizar disciplina:', error);
        res.status(500).json({ erro: 'Erro ao atualizar' });
    }
});

// Ativar/desativar assunto
app.put('/api/admin/assuntos/:id/ativo', async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        await pool.query('UPDATE assuntos SET ativo = $1 WHERE id = $2', [ativo, id]);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('Erro ao atualizar assunto:', error);
        res.status(500).json({ erro: 'Erro ao atualizar' });
    }
});


// ==================== EXERCÍCIOS ====================

// Listar exercícios
app.get('/api/exercicios', async (req, res) => {
    const { materia, assunto } = req.query;
    let query = 'SELECT * FROM exercicios';
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
        res.json({ sucesso: true, exercicios: result.rows });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar exercícios' });
    }
});

// Criar exercício (flexível - aceita qualquer formato)
app.post('/api/exercicios', async (req, res) => {
    const { materia, assunto, enunciado, alternativas, correta, solucao, explicacao } = req.body;

    try {
        // Validar campos obrigatórios
        if (!materia || !assunto || !enunciado) {
            return res.status(400).json({ erro: 'Campos obrigatórios: materia, assunto, enunciado' });
        }

        // Se alternativas não existir, criar um padrão dissertativo
        let alternativasFinal = alternativas;
        let corretaFinal = correta || '';

        if (!alternativasFinal || Object.keys(alternativasFinal).length === 0) {
            alternativasFinal = { "RESPOSTA": "Resposta dissertativa" };
            corretaFinal = "RESPOSTA";
        }

        // Garantir que alternativas seja um objeto válido
        if (typeof alternativasFinal === 'string') {
            try {
                alternativasFinal = JSON.parse(alternativasFinal);
            } catch (e) {
                alternativasFinal = { "RESPOSTA": alternativasFinal };
            }
        }

        const result = await pool.query(
            `INSERT INTO exercicios (materia, assunto, enunciado, alternativas, correta, solucao, explicacao) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [materia, assunto, enunciado, JSON.stringify(alternativasFinal), corretaFinal, solucao || '', explicacao || '']
        );

        res.json({ sucesso: true, exercicio: result.rows[0] });

    } catch (error) {
        console.error('Erro detalhado ao criar exercício:', error);
        res.status(500).json({ erro: error.message });
    }
});

// Deletar exercício
app.delete('/api/exercicios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM exercicios WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao deletar exercício' });
    }
});

// ==================== FAVORITOS ====================
// (as rotas de favoritos já estão definidas mais acima no arquivo - havia uma
// duplicata inteira aqui que nunca era executada, o Express sempre usa a
// primeira rota que casa com o caminho; removida para não confundir)

// Mover assunto (subir/descer)
app.put('/api/admin/assuntos/:id/mover', async (req, res) => {
    const { id } = req.params;
    const { direcao } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    if (!direcao || (direcao !== 'subir' && direcao !== 'descer')) {
        return res.status(400).json({ erro: 'Direção inválida. Use "subir" ou "descer"' });
    }

    try {
        // Buscar assunto atual
        const assuntoAtual = await pool.query(
            'SELECT disciplina_id, ordem FROM assuntos WHERE id = $1',
            [id]
        );

        if (assuntoAtual.rows.length === 0) {
            return res.status(404).json({ erro: 'Assunto não encontrado' });
        }

        const disciplina_id = assuntoAtual.rows[0].disciplina_id;
        const ordemAtual = assuntoAtual.rows[0].ordem;

        if (direcao === 'subir') {
            // Buscar assunto imediatamente acima (menor ordem)
            const acima = await pool.query(
                `SELECT id, ordem FROM assuntos 
                 WHERE disciplina_id = $1 AND ordem < $2 
                 ORDER BY ordem DESC LIMIT 1`,
                [disciplina_id, ordemAtual]
            );

            if (acima.rows.length > 0) {
                const outroAssuntoId = acima.rows[0].id;
                const novaOrdem = acima.rows[0].ordem;

                await pool.query('UPDATE assuntos SET ordem = $1 WHERE id = $2', [ordemAtual, outroAssuntoId]);
                await pool.query('UPDATE assuntos SET ordem = $1 WHERE id = $2', [novaOrdem, id]);
            }

        } else if (direcao === 'descer') {
            // Buscar assunto imediatamente abaixo (maior ordem)
            const abaixo = await pool.query(
                `SELECT id, ordem FROM assuntos 
                 WHERE disciplina_id = $1 AND ordem > $2 
                 ORDER BY ordem ASC LIMIT 1`,
                [disciplina_id, ordemAtual]
            );

            if (abaixo.rows.length > 0) {
                const outroAssuntoId = abaixo.rows[0].id;
                const novaOrdem = abaixo.rows[0].ordem;

                await pool.query('UPDATE assuntos SET ordem = $1 WHERE id = $2', [ordemAtual, outroAssuntoId]);
                await pool.query('UPDATE assuntos SET ordem = $1 WHERE id = $2', [novaOrdem, id]);
            }
        }

        res.json({ sucesso: true });

    } catch (error) {
        console.error('Erro ao mover assunto:', error);
        res.status(500).json({ erro: error.message });
    }
});

// ==================== BACKUP E RESTAURAÇÃO COMPLETA DO BANCO (ADMIN) ====================

// Lista de tabelas que fazem parte do backup. Se uma tabela não existir no banco
// (ex.: schema ainda não tem `exercicios` criada), ela é simplesmente ignorada.
const TABELAS_BACKUP = [
    'usuarios',
    'disciplinas',
    'assuntos',
    'questoes_base',
    'exercicios',
    'respostas_usuario',
    'notas_usuario',
    'anexos_topico',
    'favoritos_usuario',
    'usuario_assuntos',
    'progresso_usuario'
];

// Exportar backup completo do banco (admin) - inclui TODOS os usuários e anexos
app.get('/api/admin/backup', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }

    try {
        const backup = {
            versao: 2,
            data: new Date().toISOString(),
            tabelas: {}
        };

        for (const tabela of TABELAS_BACKUP) {
            try {
                const result = await pool.query(`SELECT * FROM ${tabela}`);
                backup.tabelas[tabela] = result.rows;
            } catch (err) {
                // Tabela não existe nesse banco (ex.: schema mais antigo) - só avisa e segue
                console.warn(`⚠️ Tabela "${tabela}" não encontrada durante o backup, pulando.`);
            }
        }

        res.json({ sucesso: true, backup });
    } catch (error) {
        console.error('Erro ao gerar backup:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao gerar backup: ' + error.message });
    }
});

// Restaurar backup completo do banco (admin) - APAGA TUDO e substitui pelos dados do arquivo
app.post('/api/admin/restore', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }

    const { backup } = req.body;
    if (!backup || !backup.tabelas || typeof backup.tabelas !== 'object') {
        return res.status(400).json({ sucesso: false, erro: 'Arquivo de backup inválido' });
    }

    // Só mexe nas tabelas que: (1) estão na whitelist do servidor E (2) vieram no arquivo
    const tabelasParaRestaurar = TABELAS_BACKUP.filter(t => Array.isArray(backup.tabelas[t]));

    if (tabelasParaRestaurar.length === 0) {
        return res.status(400).json({ sucesso: false, erro: 'Nenhuma tabela reconhecida no arquivo de backup' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Desabilita triggers (inclui checagem de foreign keys) para poder inserir sem se
        // preocupar com a ordem entre tabelas relacionadas
        for (const tabela of tabelasParaRestaurar) {
            await client.query(`ALTER TABLE ${tabela} DISABLE TRIGGER ALL`);
        }

        // Apaga todos os dados atuais dessas tabelas e reseta os IDs (auto-incremento)
        await client.query(`TRUNCATE ${tabelasParaRestaurar.join(', ')} RESTART IDENTITY CASCADE`);

        // Reinsere linha por linha, respeitando as colunas de cada tabela
        for (const tabela of tabelasParaRestaurar) {
            const linhas = backup.tabelas[tabela];
            for (const linha of linhas) {
                const colunas = Object.keys(linha);
                if (colunas.length === 0) continue;
                const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
                const valores = colunas.map(c => linha[c]);
                await client.query(
                    `INSERT INTO ${tabela} (${colunas.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
                    valores
                );
            }
        }

        // Reabilita os triggers/foreign keys
        for (const tabela of tabelasParaRestaurar) {
            await client.query(`ALTER TABLE ${tabela} ENABLE TRIGGER ALL`);
        }

        // Corrige as sequências de auto-incremento para continuarem depois do maior ID restaurado
        for (const tabela of tabelasParaRestaurar) {
            try {
                await client.query(`
                    SELECT setval(
                        pg_get_serial_sequence('${tabela}', 'id'),
                        GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${tabela}), 1)
                    )
                `);
            } catch (e) {
                // Tabela sem coluna "id" serial - ignora
            }
        }

        await client.query('COMMIT');
        res.json({ sucesso: true, mensagem: 'Backup restaurado com sucesso!', tabelas: tabelasParaRestaurar });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao restaurar backup:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao restaurar backup: ' + error.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// ==================== LIMPAR DUPLICATAS ====================

app.post('/api/admin/limpar-duplicatas', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.usuario?.email;

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        // 1. Contar duplicatas antes
        const antesResult = await pool.query('SELECT COUNT(*) FROM questoes_base');
        const antes = parseInt(antesResult.rows[0].count);

        // 2. Remover duplicatas mantendo a mais antiga
        await pool.query(`
            DELETE FROM questoes_base a
            USING questoes_base b
            WHERE a.id > b.id
              AND a.materia = b.materia
              AND a.assunto = b.assunto
              AND a.enunciado = b.enunciado
        `);

        // 3. Remover respostas órfãs
        await pool.query(`
            DELETE FROM respostas_usuario ru
            WHERE NOT EXISTS (
                SELECT 1 FROM questoes_base qb 
                WHERE qb.id = ru.questao_id
            )
        `);

        // 4. Contar removidas
        const depoisResult = await pool.query('SELECT COUNT(*) FROM questoes_base');
        const depois = parseInt(depoisResult.rows[0].count);
        const removidas = antes - depois;

        res.json({ sucesso: true, removidas });

    } catch (error) {
        console.error('Erro ao limpar duplicatas:', error);
        res.status(500).json({ erro: error.message });
    }
});
