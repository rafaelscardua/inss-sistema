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
            setTimeout(() => {
                atualizarCardsPlano();
            }, 200);
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

    // Garantir que os cards sejam atualizados após o DOM estar pronto
    setTimeout(() => {
        atualizarCardsPlano();
    }, 100);
}



// ==================== ANEXOS ====================

// ==================== ANEXOS ====================

async function carregarAnexos(materia, topico, elementoContainer) {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const isAdmin = usuario.email === 'rafaelscardua@gmail.com';

        const res = await fetch(`/api/anexos/${encodeURIComponent(materia)}/${encodeURIComponent(topico)}`, {
            headers: { 'x-user-email': usuario.email }
        });
        const data = await res.json();

        if (data.sucesso && data.anexos && data.anexos.length > 0) {
            elementoContainer.innerHTML = `
                <div style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 8px;">
                    <strong>📎 Mapas Mentais e Anexos:</strong>
                    <ul style="margin-top: 5px; list-style: none; padding-left: 0;">
                        ${data.anexos.map(anexo => `
                            <li style="margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                                <a href="#" onclick="baixarAnexo(${anexo.id}, '${anexo.nome_original}'); return false;" style="text-decoration: none; color: #3498db;">
                                    📄 ${anexo.nome_original} (${formatarBytes(anexo.tamanho_bytes)})
                                </a>
                                ${isAdmin ? `
                                    <button onclick="deletarAnexo(${anexo.id})" style="background: #e74c3c; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; margin-left: 10px;">
                                        🗑️
                                    </button>
                                ` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            elementoContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Erro ao carregar anexos:', error);
        elementoContainer.innerHTML = '';
    }
}
function formatarBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function baixarAnexo(id, nomeOriginal) {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const res = await fetch(`/api/anexos/download/${id}`, {
            headers: { 'x-user-email': usuario.email }
        });
        const data = await res.json();
        
        if (data.sucesso && data.arquivo_base64) {
            const extensao = nomeOriginal.split('.').pop().toLowerCase();
            
            // Para arquivos que podem ser visualizados no navegador
            if (extensao === 'pdf') {
                // Criar blob com o tipo correto
                const byteCharacters = atob(data.arquivo_base64.split(',')[1] || data.arquivo_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } 
            else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extensao)) {
                // Imagens
                const byteCharacters = atob(data.arquivo_base64.split(',')[1] || data.arquivo_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: `image/${extensao === 'jpg' ? 'jpeg' : extensao}` });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            else {
                // Para outros arquivos, faz o download
                const link = document.createElement('a');
                link.href = data.arquivo_base64;
                link.download = nomeOriginal;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else {
            alert('Erro ao abrir anexo');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao abrir anexo');
    }
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

    // Questões Restantes = Total Geral - Total Acertos
    const questoesRestantes = totalQuestoesGeral - totalAcertosGeral;
    document.getElementById("subtopicosFeitos").innerText = questoesRestantes;

    document.getElementById("totalAcertos").innerText = totalAcertosGeral;
}