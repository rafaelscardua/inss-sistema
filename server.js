const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');
require('dotenv').config();

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
const upload = multer({ storage });

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
// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
        const userEmail = req.headers['x-user-email'];

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
        const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
        const userEmail = req.headers['x-user-email'];
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
        const userEmail = req.headers['x-user-email'];
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
    const adminEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
                'SELECT id, nome, ordem, ativo FROM assuntos WHERE disciplina_id = $1 ORDER BY ordem, id',
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
    const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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
app.put('/api/admin/assuntos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.headers['x-user-email'];

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    try {
        await pool.query('UPDATE assuntos SET nome = $1 WHERE id = $2', [nome, id]);
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao editar assunto' });
    }
});

// Excluir assunto
app.delete('/api/admin/assuntos/:id', async (req, res) => {
    const { id } = req.params;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.headers['x-user-email'];

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

// Rota temporária para debug (apenas admin)
app.post('/api/admin/sql', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.headers['x-user-email'];

    if (userEmail !== adminEmail) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { query } = req.body;
    try {
        const result = await pool.query(query);
        res.json({ rows: result.rows });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

// Listar todos os assuntos (admin)
app.get('/api/admin/assuntos', async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.headers['x-user-email'];

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
app.get('/api/plano-estudos/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
    try {
        // Buscar apenas disciplinas ATIVAS
        const disciplinasResult = await pool.query(
            'SELECT id, nome FROM disciplinas WHERE ativo = true ORDER BY id'
        );

        const disciplinas = disciplinasResult.rows;

        // Para cada disciplina, buscar os assuntos PERMITIDOS para o usuário
        for (const disc of disciplinas) {
            // Buscar apenas assuntos ATIVOS E PERMITIDOS para este usuário
            const assuntosResult = await pool.query(
                `SELECT a.id, a.nome 
                 FROM assuntos a
                 JOIN usuario_assuntos ua ON a.id = ua.assunto_id
                 WHERE a.disciplina_id = $1 AND a.ativo = true AND ua.usuario_id = $2
                 ORDER BY a.id`,
                [disc.id, usuario_id]
            );

            // Para cada assunto, buscar progresso do usuário
            for (const assunto of assuntosResult.rows) {
                // Contar questões totais do assunto
                const totalResult = await pool.query(
                    'SELECT COUNT(*) FROM questoes_base WHERE disciplina_id = $1 AND assunto_id = $2',
                    [disc.id, assunto.id]
                );
                const total = parseInt(totalResult.rows[0].count);

                // Contar questões respondidas corretamente
                const acertosResult = await pool.query(
                    `SELECT COUNT(*) FROM respostas_usuario r
                     JOIN questoes_base q ON r.questao_id = q.id
                     WHERE r.usuario_id = $1 AND q.disciplina_id = $2 AND q.assunto_id = $3 AND r.acertou = true`,
                    [usuario_id, disc.id, assunto.id]
                );
                const acertos = parseInt(acertosResult.rows[0].count);

                assunto.progresso = total > 0 ? Math.round((acertos / total) * 100) : 0;
                assunto.total_questoes = total;
            }

            disc.assuntos = assuntosResult.rows;
        }

        res.json({ sucesso: true, disciplinas });
    } catch (error) {
        console.error('Erro ao buscar plano de estudos:', error);
        res.status(500).json({ erro: 'Erro ao buscar plano de estudos' });
    }
});


// ==================== ROTAS DE PERMISSÕES POR USUÁRIO ====================

// Buscar assuntos permitidos para um usuário
app.get('/api/usuario/assuntos/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;
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
    const adminEmail = req.headers['x-user-email'];
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
    const { assuntos_ids } = req.body; // array de IDs de assuntos permitidos
    const adminEmail = req.headers['x-user-email'];
    const adminEmailConfig = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    
    if (adminEmail !== adminEmailConfig) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }
    
    try {
        // Remover todas as permissões atuais
        await pool.query('DELETE FROM usuario_assuntos WHERE usuario_id = $1', [usuario_id]);
        
        // Adicionar as novas permissões
        for (const assunto_id of assuntos_ids) {
            await pool.query(
                'INSERT INTO usuario_assuntos (usuario_id, assunto_id) VALUES ($1, $2)',
                [usuario_id, assunto_id]
            );
        }
        
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar permissões' });
    }
});





// ==================== ROTAS PARA ATIVAR/DESATIVAR ====================

// Ativar/desativar disciplina
app.put('/api/admin/disciplinas/:id/ativo', async (req, res) => {
    const { id } = req.params;
    const { ativo } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'rafaelscardua@gmail.com';
    const userEmail = req.headers['x-user-email'];

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
    const userEmail = req.headers['x-user-email'];

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


app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
