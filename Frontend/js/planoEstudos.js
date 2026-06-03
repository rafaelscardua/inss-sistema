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
                               <label class="checkbox-estudado">
                 <input type="checkbox" class="check-estudado" data-id="${assunto.id}" data-respondidas="${respondidas}" data-total="${total}" onclick="toggleEstudado(this); return false;" ${respondidas >= total ? 'checked' : ''}>
    ✅ Estudado
</label>
                            </div>
                            <div id="anexos-${disc.id}-${assunto.id}" class="anexos-container"></div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
        container.appendChild(div);
    }

    // Adicionar evento de clique para os cabeçalhos
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
            await carregarPlanoEstudos(); // Recarregar para atualizar UI
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
            await carregarPlanoEstudos(); // Recarregar para atualizar UI
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
    try {
        const usuarioSalvo = localStorage.getItem('usuario');
        if (!usuarioSalvo) return;
        const usuario = JSON.parse(usuarioSalvo);

        const res = await fetch(`/api/anexos/${encodeURIComponent(materia)}/${encodeURIComponent(topico)}`, {
            headers: { 'x-user-email': usuario.email }
        });
        const data = await res.json();

        const isAdmin = usuario.email === 'rafaelscardua@gmail.com';

        let html = '<div style="margin-top: 10px; margin-left: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px;">';
        html += '<strong>📎 Anexos:</strong><br>';

        if (data.sucesso && data.anexos && data.anexos.length > 0) {
            for (const anexo of data.anexos) {
                const tamanho = formatarTamanho(anexo.tamanho_bytes);
                html += `
                    <div style="margin-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                        <span>📄 ${anexo.nome_original} (${tamanho})</span>
                        <div>
                            <button onclick="baixarAnexo(${anexo.id})" style="background: #3498db; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;">📥 Baixar</button>
                            ${isAdmin ? `<button onclick="excluirAnexo(${anexo.id}, this)" style="background: #e74c3c; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; margin-left: 5px;">🗑️ Excluir</button>` : ''}
                        </div>
                    </div>
                `;
            }
        } else {
            html += '<p style="margin: 5px 0;">Nenhum anexo.</p>';
        }

        if (isAdmin) {
            html += `
                <div style="margin-top: 10px;">
                    <button onclick="uploadAnexo('${materia}', '${topico}')" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">➕ Adicionar anexo</button>
                </div>
            `;
        }
        html += '</div>';

        if (elementoContainer) {
            elementoContainer.innerHTML = html;
        }
    } catch (e) {
        console.error('Erro ao carregar anexos:', e);
        if (elementoContainer) {
            elementoContainer.innerHTML = '<div style="color: red;">Erro ao carregar anexos</div>';
        }
    }
}

function formatarTamanho(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function uploadAnexo(materia, topico) {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (!usuarioSalvo) return;
    const usuario = JSON.parse(usuarioSalvo);

    if (usuario.email !== 'rafaelscardua@gmail.com') {
        alert("Apenas o administrador pode adicionar anexos.");
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;

            try {
                const res = await fetch('/api/anexos/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-email': usuario.email
                    },
                    body: JSON.stringify({
                        materia: materia,
                        topico: topico,
                        nome_original: file.name,
                        tamanho_bytes: file.size,
                        arquivo_base64: base64
                    })
                });
                const data = await res.json();
                if (data.sucesso) {
                    alert(`✅ Anexo "${file.name}" adicionado!`);
                    location.reload();
                } else {
                    alert(`❌ Erro: ${data.erro}`);
                }
            } catch (err) {
                console.error(err);
                alert("❌ Erro ao fazer upload");
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

async function baixarAnexo(id) {
    try {
        const usuarioSalvo = localStorage.getItem('usuario');
        const usuario = JSON.parse(usuarioSalvo);

        const res = await fetch(`/api/anexos/download/${id}`, {
            headers: { 'x-user-email': usuario.email }
        });
        const data = await res.json();

        if (data.sucesso && data.arquivo_base64) {
            const link = document.createElement('a');
            link.href = data.arquivo_base64;
            link.download = data.nome_original;
            link.click();
        } else {
            alert("❌ Erro ao baixar arquivo");
        }
    } catch (err) {
        console.error(err);
        alert("❌ Erro ao baixar");
    }
}

async function excluirAnexo(id, buttonElement) {
    if (!confirm("🗑️ Tem certeza que deseja excluir este anexo permanentemente?")) return;

    const usuarioSalvo = localStorage.getItem('usuario');
    if (!usuarioSalvo) return;
    const usuario = JSON.parse(usuarioSalvo);

    if (usuario.email !== 'rafaelscardua@gmail.com') {
        alert("Apenas o administrador pode excluir anexos.");
        return;
    }

    try {
        const res = await fetch(`/api/anexos/${id}`, {
            method: 'DELETE',
            headers: { 'x-user-email': usuario.email }
        });
        const data = await res.json();
        if (data.sucesso) {
            alert("✅ Anexo excluído com sucesso!");
            const div = buttonElement.closest('div');
            if (div) div.remove();
        } else {
            alert(`❌ Erro: ${data.erro}`);
        }
    } catch (err) {
        alert("❌ Erro ao excluir anexo");
    }
}

// ==================== RENDERIZAR PLANO DE ESTUDOS ====================

