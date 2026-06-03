// ==================== PLANO DE ESTUDOS ====================

function carregarPlano() {
    const salvo = localStorage.getItem("inss_estudos");
    if (salvo) dadosEstudo = JSON.parse(salvo);
}

function salvarPlano() { 
    localStorage.setItem("inss_estudos", JSON.stringify(dadosEstudo)); 
}

function renderizarMaterias() {
    const container = document.getElementById("materiasContainer");
    if(!container) return;
    container.innerHTML = "";
    dadosEstudo.materias.forEach((m, mIdx) => {
        let totalSub=0, completos=0;
        m.topicos.forEach(t=>{ t.subtopicos?.forEach(s=>{ totalSub++; if(s.feito) completos++; }) });
        let progresso = totalSub ? Math.round((completos/totalSub)*100) : 0;
        const div = document.createElement("div"); div.className="materia";
        div.innerHTML = `
            <div class="materia-header" onclick="window.toggleMateria(${mIdx})">
                <div><b>${m.nome}</b> <span style="font-size:0.8em;">${progresso}%</span></div>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progresso}%"></div></div>
            </div>
            <div class="materia-content ${m.expandido ? '' : 'collapsed'}">
                ${m.topicos.map((t, tIdx) => `
                    <div class="topico">
                        <div class="topico-header">
                            <span class="topico-nome">📌 ${t.nome}</span>
                            <select class="status-select" data-m="${mIdx}" data-t="${tIdx}">
                                <option value="0" ${t.status===0?'selected':''}>🔴 Não iniciado</option>
                                <option value="1" ${t.status===1?'selected':''}>🟡 Estudando</option>
                                <option value="2" ${t.status===2?'selected':''}>🟠 Exercícios</option>
                                <option value="3" ${t.status===3?'selected':''}>🟢 Dominado</option>
                            </select>
                        </div>
                        <div class="subtopicos">
                            ${t.subtopicos?.map((sub, sIdx) => `<div class="subtopico"><input type="checkbox" class="sub-check" data-m="${mIdx}" data-t="${tIdx}" data-s="${sIdx}" ${sub.feito ? 'checked' : ''}> <label>${sub.nome}</label></div>`).join('')}
                        </div>
                        <div id="anexos-${mIdx}-${tIdx}" class="anexos-container"></div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(div);
    });
    
        // Carregar anexos para cada tópico
    dadosEstudo.materias.forEach((m, mIdx) => {
        m.topicos.forEach((t, tIdx) => {
            const anexoContainer = document.getElementById(`anexos-${mIdx}-${tIdx}`);
            if (anexoContainer) {
                carregarAnexos(m.nome, t.nome, anexoContainer);
            }
        });
    });
    
    document.querySelectorAll('.status-select').forEach(sel => sel.addEventListener('change', (e) => { 
        let [m,t] = [parseInt(sel.dataset.m), parseInt(sel.dataset.t)]; 
        dadosEstudo.materias[m].topicos[t].status = parseInt(sel.value); 
        salvarPlano(); 
        renderizarMaterias(); 
    }));
    
    document.querySelectorAll('.sub-check').forEach(chk => chk.addEventListener('change', (e) => { 
        let [m,t,s] = [parseInt(chk.dataset.m), parseInt(chk.dataset.t), parseInt(chk.dataset.s)]; 
        dadosEstudo.materias[m].topicos[t].subtopicos[s].feito = chk.checked; 
        salvarPlano(); 
        renderizarMaterias(); 
    }));       
    
}

window.toggleMateria = (idx) => { 
    dadosEstudo.materias[idx].expandido = !dadosEstudo.materias[idx].expandido; 
    salvarPlano(); 
    renderizarMaterias(); 
};


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
        
        if (data.sucesso && data.anexos.length > 0) {
            const isAdmin = usuario.email === 'rafaelscardua@gmail.com';
            
            let html = '<div style="margin-top: 10px; margin-left: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px;">';
            html += '<strong>📎 Anexos:</strong><br>';
            
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
        }
    } catch (e) {
        console.error('Erro ao carregar anexos:', e);
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
        
        // Converter para base64
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
            // Remover o elemento da tela
            const div = buttonElement.closest('div');
            if (div) div.remove();
        } else {
            alert(`❌ Erro: ${data.erro}`);
        }
    } catch (err) {
        alert("❌ Erro ao excluir anexo");
    }
}