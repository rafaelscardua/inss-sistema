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

    // Carregar anexos para cada assunto
    for (const disc of disciplinasPlano) {
        for (const assunto of disc.assuntos) {
            const anexoContainer = document.getElementById(`anexos-${disc.id}-${assunto.id}`);
            if (anexoContainer && typeof carregarAnexos === 'function') {
                carregarAnexos(disc.nome, assunto.nome, anexoContainer);
            }
        }
    }

    atualizarCardsPlano();
}



// ==================== ANEXOS ====================

async function carregarAnexos(materia, topico, elementoContainer) {
    // ... mantenha suas funções de anexos existentes ...
}


function atualizarCardsPlano() {
    let totalQuestoesGeral = 0;
    let totalAcertosGeral = 0;
    let topicosDominados = 0;
    
    for (const disc of disciplinasPlano) {
        for (const assunto of disc.assuntos) {
            const total = assunto.total_questoes || 0;
            const acertos = Math.round((assunto.progresso || 0) * total / 100);
            
            totalQuestoesGeral += total;
            totalAcertosGeral += acertos;
            
            // Tópico dominado = progresso >= 80%
            if ((assunto.progresso || 0) >= 80) {
                topicosDominados++;
            }
        }
    }
    
    const progressoGeral = totalQuestoesGeral > 0 
        ? Math.round((totalAcertosGeral / totalQuestoesGeral) * 100) 
        : 0;
    
    document.getElementById("progressoGeral").innerText = `${progressoGeral}%`;
    document.getElementById("topicosDominados").innerText = topicosDominados;
    
    // Subtópicos Feitos pode ser removido ou substituído
    document.getElementById("subtopicosFeitos").innerText = totalAcertosGeral;
}