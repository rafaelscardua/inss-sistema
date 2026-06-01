// ==================== PAINEL DO ADMINISTRADOR ====================

let adminUsuarios = [];

async function carregarAdminUsuarios() {
    try {
        // Pega o usuário do localStorage diretamente
        const usuarioSalvo = localStorage.getItem('usuario');
        if (!usuarioSalvo) {
            console.log('Usuário não logado');
            return;
        }
        const usuario = JSON.parse(usuarioSalvo);
        
        console.log('Enviando email:', usuario.email); // Debug
        
        const res = await fetch(`${API_URL}/api/admin/usuarios`, {
            headers: { 
                'x-user-email': usuario.email
            }
        });
        const data = await res.json();
        console.log('Resposta:', data); // Debug
        
        if (data.sucesso) {
            adminUsuarios = data.usuarios;
            renderizarAdminPainel();
        } else {
            document.getElementById("adminUsuariosList").innerHTML = "<p>Acesso negado ou erro ao carregar usuários.</p>";
        }
    } catch(e) {
        console.error(e);
        document.getElementById("adminUsuariosList").innerHTML = "<p>Erro ao carregar dados.</p>";
    }
}

function renderizarAdminPainel() {
    const container = document.getElementById("adminUsuariosList");
    if (!container) return;
    
    document.getElementById("adminTotalUsuarios").innerText = adminUsuarios.length;
    document.getElementById("adminTotalQuestoes").innerText = questoes?.length || 0;
    
    if (adminUsuarios.length === 0) {
        container.innerHTML = "<p>Nenhum usuário cadastrado ainda.</p>";
        return;
    }
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            ${adminUsuarios.map(usr => `
                <div class="question-card" style="cursor: pointer;" onclick="verDetalhesUsuario(${usr.id}, '${usr.nome}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>👤 ${usr.nome}</strong><br>
                            <small>📧 ${usr.email}</small><br>
                            <small>📅 Cadastro: ${new Date(usr.data_criacao).toLocaleDateString()}</small>
                        </div>
                        <button class="btn-small" onclick="event.stopPropagation(); verDetalhesUsuario(${usr.id}, '${usr.nome}')">📊 Ver Detalhes</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function verDetalhesUsuario(usuarioId, usuarioNome) {
    try {
        const usuarioSalvo = localStorage.getItem('usuario');
        if (!usuarioSalvo) return;
        const usuario = JSON.parse(usuarioSalvo);
        
        const res = await fetch(`${API_URL}/api/admin/estatisticas/${usuarioId}`, {
            headers: { 
                'x-user-email': usuario.email
            }
        });
        const data = await res.json();
        if (data.sucesso) {
            mostrarModalDetalhes(usuarioNome, data.estatisticas, data.erros);
        }
    } catch(e) {
        console.error(e);
        alert("Erro ao carregar detalhes do usuário");
    }
}

function mostrarModalDetalhes(usuarioNome, estatisticas, erros) {
    const estatisticasHtml = estatisticas.map(est => `
        <div style="border-bottom: 1px solid #ddd; padding: 10px;">
            <strong>${est.materia || 'Sem matéria'}</strong><br>
            📊 ${est.acertos || 0}/${est.total_respondidas || 0} acertos
            (${Math.round((est.acertos || 0)/(est.total_respondidas || 1)*100)}%)
        </div>
    `).join('') || "<p>Nenhuma questão respondida.</p>";
    
    const errosHtml = erros.map(err => `
        <div style="border-bottom: 1px solid #ddd; padding: 10px; cursor: pointer;" onclick="window.parent.irParaQuestaoAdmin(${err.id})">
            <strong>${err.materia} | ${err.assunto}</strong><br>
            <small>${err.enunciado.substring(0, 100)}...</small><br>
            <span style="color: #e74c3c;">❌ Respondeu: ${err.resposta_usuario} (Correta: ${err.correta})</span>
        </div>
    `).join('') || "<p>Nenhum erro registrado.</p>";
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>📊 ${usuarioNome} - Estatísticas</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <h4>📚 Desempenho por Matéria</h4>
            ${estatisticasHtml}
            <h4 style="margin-top: 20px;">❌ Últimos Erros (máx 50)</h4>
            ${errosHtml}
        </div>
    `;
    document.body.appendChild(modal);
}

function irParaQuestaoAdmin(questaoId) {
    document.querySelector('.tab-btn[data-tab="questoes"]').click();
    setTimeout(() => {
        const el = document.getElementById(`q${questaoId}`);
        if(el) { 
            el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            el.style.transition = 'background 0.5s'; 
            el.style.background = '#fffde7'; 
            setTimeout(() => el.style.background = '', 2000); 
        }
    }, 100);
}