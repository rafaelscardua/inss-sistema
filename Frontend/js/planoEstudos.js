// ==================== PLANO DE ESTUDOS (APENAS COM BANCO) ====================

let disciplinasPlano = [];

async function carregarPlanoEstudos() {
    try {
        const usuarioSalvo = localStorage.getItem('usuario');
        if (!usuarioSalvo) return;
        const usuario = JSON.parse(usuarioSalvo);

        const res = await fetch(`${API_URL}/api/plano-estudos/${usuario.id}`, {
            headers: { 'x-user-email': usuario.email }
        });
        const data = await res.json();

        if (data.sucesso) {
            disciplinasPlano = data.disciplinas;
            renderizarPlanoEstudos();
        }
    } catch (e) {
        console.error('Erro ao carregar plano:', e);
    }
}

function renderizarPlanoEstudos() {
    const container = document.getElementById("materiasContainer");
    if (!container) return;
    container.innerHTML = "";

    if (disciplinasPlano.length === 0) {
        container.innerHTML = "<p>Nenhuma disciplina cadastrada. Use o ADMIN para criar disciplinas.</p>";
        return;
    }

    for (const disc of disciplinasPlano) {
        let totalQuestoesDisc = 0;
        let totalAcertosDisc = 0;
        for (const assunto of disc.assuntos) {
            totalQuestoesDisc += assunto.total_questoes || 0;
            totalAcertosDisc += Math.round((assunto.progresso || 0) * (assunto.total_questoes || 0) / 100);
        }
        const progressoGeralDisc = totalQuestoesDisc > 0 ? Math.round((totalAcertosDisc / totalQuestoesDisc) * 100) : 0;

        const div = document.createElement("div");
        div.className = "materia";
        div.innerHTML = `
            <div class="materia-header">
                <div><b>📚 ${disc.nome}</b> <span style="font-size:0.8em;">${progressoGeralDisc}%</span></div>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progressoGeralDisc}%"></div></div>
            </div>
            <div class="materia-content collapsed">
                ${disc.assuntos.map(assunto => {
            const respondidas = Math.round((assunto.progresso || 0) * (assunto.total_questoes || 0) / 100);
            const total = assunto.total_questoes || 0;
            return `
                        <div class="topico" data-assunto-id="${assunto.id}">
                            <div class="topico-header">
                                <span class="topico-nome">📌 ${assunto.nome}</span>
                                <span class="progresso-texto" id="progresso-${assunto.id}">${assunto.progresso || 0}% (${respondidas}/${total})</span>
                                <select class="status-select" data-id="${assunto.id}">
                                    <option value="nao_iniciado" ${assunto.status === 'nao_iniciado' ? 'selected' : ''}>🔴 Não iniciado</option>
                                    <option value="estudando" ${assunto.status === 'estudando' ? 'selected' : ''}>🟡 Estudando</option>
                                    <option value="revisando" ${assunto.status === 'revisando' ? 'selected' : ''}>🟠 Revisando</option>
                                    <option value="dominado" ${assunto.status === 'dominado' ? 'selected' : ''}>🟢 Dominado</option>
                                </select>
                                <input type="checkbox" class="check-estudado" data-id="${assunto.id}" data-respondidas="${respondidas}" data-total="${total}" onclick="toggleEstudado(this); return false;" ${respondidas >= total ? 'checked' : ''}>
<label style="display: inline-block; cursor: pointer;">✅ Estudado</label>
                            </div>
                            <div id="anexos-${disc.id}-${assunto.id}" class="anexos-container"></div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
        container.appendChild(div);
    }

    // ==================== EVENTO DOS CABEÇALHOS ====================
    document.querySelectorAll('.materia-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            const content = header.nextElementSibling;
            content.classList.toggle('collapsed');
        });
    });

    

    // ==================== EVENTOS DOS SELECTS DE STATUS ====================
    document.querySelectorAll('.status-select').forEach(select => {
        select.removeEventListener('change', select._listener);

        select._listener = async function (e) {
            e.stopPropagation();
            const assuntoId = parseInt(select.dataset.id);
            const novoStatus = select.value;

            const usuario = JSON.parse(localStorage.getItem('usuario'));
            const res = await fetch(`/api/assuntos/${assuntoId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-email': usuario.email
                },
                body: JSON.stringify({ status: novoStatus })
            });

            const data = await res.json();
            if (data.sucesso) {
                await carregarPlanoEstudos();
            }
        };

        select.addEventListener('change', select._listener);
    });

    // Carregar anexos para cada assunto
    for (const disc of disciplinasPlano) {
        for (const assunto of disc.assuntos) {
            const anexoContainer = document.getElementById(`anexos-${disc.id}-${assunto.id}`);
            if (anexoContainer && typeof carregarAnexos === 'function') {
                carregarAnexos(disc.nome, assunto.nome, anexoContainer);
            }
        }
    }

    // ==================== SINCRONIZAR CHECKBOXES ====================
    document.querySelectorAll('.check-estudado').forEach(cb => {
        const topico = cb.closest('.topico');
        const progressoText = topico.querySelector('.progresso-texto');
        if (progressoText) {
            const progresso = parseInt(progressoText.innerText.split('%')[0]);
            cb.checked = (progresso === 100);
            // Atualizar o atributo data-respondidas
            if (cb.checked) {
                const total = parseInt(cb.getAttribute('data-total'));
                cb.setAttribute('data-respondidas', total);
            } else {
                cb.setAttribute('data-respondidas', '0');
            }
        }
    });
}
}

// Atualizar status do assunto
async function atualizarStatusAssunto(assuntoId, novoStatus) {
    try {
        const usuarioSalvo = localStorage.getItem('usuario');
        const usuario = JSON.parse(usuarioSalvo);

        const res = await fetch(`/api/assuntos/${assuntoId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': usuario.email
            },
            body: JSON.stringify({ status: novoStatus })
        });
        const data = await res.json();
        if (data.sucesso) {
            await carregarPlanoEstudos();
        } else {
            alert(`❌ Erro: ${data.erro}`);
        }
    } catch (e) {
        console.error('Erro ao atualizar status:', e);
        alert("❌ Erro ao atualizar status");
    }
}

// Incrementar progresso do assunto
async function incrementarProgressoAssunto(assuntoId, novoValor, total) {
    try {
        const usuarioSalvo = localStorage.getItem('usuario');
        const usuario = JSON.parse(usuarioSalvo);

        const novoProgresso = Math.round((novoValor / total) * 100);

        const res = await fetch(`/api/assuntos/${assuntoId}/progresso`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': usuario.email
            },
            body: JSON.stringify({ progresso: novoProgresso })
        });
        const data = await res.json();
        if (data.sucesso) {
            await carregarPlanoEstudos();
        } else {
            alert(`❌ Erro: ${data.erro}`);
        }
    } catch (e) {
        console.error('Erro ao incrementar progresso:', e);
        alert("❌ Erro ao incrementar progresso");
    }
}

// ==================== ANEXOS ====================

async function carregarAnexos(materia, topico, elementoContainer) {
    // ... mantenha suas funções de anexos existentes ...
}