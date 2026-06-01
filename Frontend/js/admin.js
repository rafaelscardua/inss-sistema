// ==================== PAINEL DO ADMINISTRADOR ====================

let adminUsuarios = [];

function renderizarAdminPainel() {
    const container = document.getElementById("adminUsuariosList");
    if (!container) {
        console.log("Container adminUsuariosList não encontrado");
        return;
    }
    
    const totalUsuariosElem = document.getElementById("adminTotalUsuarios");
    const totalQuestoesElem = document.getElementById("adminTotalQuestoes");
    
    if (totalUsuariosElem) totalUsuariosElem.innerText = adminUsuarios.length;
    if (totalQuestoesElem) totalQuestoesElem.innerText = questoes?.length || 0;
    
    if (adminUsuarios.length === 0) {
        container.innerHTML = "<p>Nenhum usuário cadastrado ainda.</p>";
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
    for (let i = 0; i < adminUsuarios.length; i++) {
        const usr = adminUsuarios[i];
        html += `
            <div style="background: white; border-radius: 15px; padding: 20px; margin-bottom: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); cursor: pointer;" onclick="verDetalhesUsuario(${usr.id}, '${usr.nome}')">
                <strong style="color: #2c3e50;">👤 ${usr.nome}</strong><br>
                <small style="color: #7f8c8d;">📧 ${usr.email}</small><br>
                <small style="color: #7f8c8d;">📅 Cadastro: ${new Date(usr.data_criacao).toLocaleDateString()}</small><br>
                <button style="background: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 8px; margin-top: 10px; cursor: pointer;" onclick="event.stopPropagation(); verDetalhesUsuario(${usr.id}, '${usr.nome}')">📊 Ver Detalhes</button>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
    
    console.log("Admin renderizado com", adminUsuarios.length, "usuários");
}




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
    if (!container) {
        console.log("Container adminUsuariosList não encontrado");
        return;
    }
    
    const totalUsuariosElem = document.getElementById("adminTotalUsuarios");
    const totalQuestoesElem = document.getElementById("adminTotalQuestoes");
    
    if (totalUsuariosElem) totalUsuariosElem.innerText = adminUsuarios.length;
    if (totalQuestoesElem) totalQuestoesElem.innerText = questoes?.length || 0;
    
    if (adminUsuarios.length === 0) {
        container.innerHTML = "<p>Nenhum usuário cadastrado ainda.</p>";
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
    for (let i = 0; i < adminUsuarios.length; i++) {
        const usr = adminUsuarios[i];
        html += `
            <div class="question-card" style="margin-bottom: 10px; cursor: pointer;" onclick="verDetalhesUsuario(${usr.id}, '${usr.nome}')">
                <strong>👤 ${usr.nome}</strong><br>
                <small>📧 ${usr.email}</small><br>
                <small>📅 Cadastro: ${new Date(usr.data_criacao).toLocaleDateString()}</small>
                <button class="btn-small" style="margin-top: 10px; display: block;" onclick="event.stopPropagation(); verDetalhesUsuario(${usr.id}, '${usr.nome}')">📊 Ver Detalhes</button>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
    
    console.log("Admin renderizado com", adminUsuarios.length, "usuários");
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
    // Remove qualquer modal existente
    const modalExistente = document.querySelector('.modal-admin');
    if (modalExistente) modalExistente.remove();
    
    const estatisticasHtml = estatisticas.map(est => `
        <div style="border-bottom: 1px solid #ddd; padding: 10px;">
            <strong>${est.materia || 'Sem matéria'}</strong><br>
            📊 ${est.acertos || 0}/${est.total_respondidas || 0} acertos
            (${Math.round((est.acertos || 0)/(est.total_respondidas || 1)*100)}%)
        </div>
    `).join('') || "<p>Nenhuma questão respondida.</p>";
    
    const errosHtml = erros.map(err => `
        <div style="border-bottom: 1px solid #ddd; padding: 10px; cursor: pointer;" onclick="irParaQuestaoAdmin(${err.id})">
            <strong>${err.materia} | ${err.assunto}</strong><br>
            <small>${err.enunciado.substring(0, 100)}...</small><br>
            <span style="color: #e74c3c;">❌ Respondeu: ${err.resposta_usuario} (Correta: ${err.correta})</span>
        </div>
    `).join('') || "<p>Nenhum erro registrado.</p>";
    
    const modal = document.createElement('div');
    modal.className = 'modal-admin';
    modal.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: white !important;
        border-radius: 20px !important;
        padding: 25px !important;
        width: 90% !important;
        max-width: 600px !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
        z-index: 999999 !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 15px !important;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            <h3 style="margin: 0; color: #2c3e50;">📊 ${usuarioNome} - Estatísticas</h3>
            <button onclick="this.closest('.modal-admin').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <h4 style="color: #2c3e50;">📚 Desempenho por Matéria</h4>
        <div style="max-height: 200px; overflow-y: auto;">${estatisticasHtml}</div>
        <h4 style="color: #2c3e50;">❌ Últimos Erros (máx 50)</h4>
        <div style="max-height: 300px; overflow-y: auto;">${errosHtml}</div>
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