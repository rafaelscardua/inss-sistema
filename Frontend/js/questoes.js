// ==================== FUNÇÕES DE QUESTÕES ====================

function atualizarStats() {
    let totalSub = 0, completos = 0, topicosDom = 0;
    dadosEstudo.materias.forEach(m => m.topicos.forEach(t => { 
        if(t.status===3) topicosDom++; 
        t.subtopicos?.forEach(s => { 
            totalSub++; 
            if(s.feito) completos++; 
        }); 
    }));
    
    document.getElementById("progressoGeral").innerText = totalSub === 0 ? 0 : Math.round((completos/totalSub)*100)+"%";
    document.getElementById("topicosDominados").innerText = topicosDom;
    document.getElementById("subtopicosFeitos").innerText = completos;
    
    let acertos = Object.values(respostasUsuario).filter(r => r.acertou === true).length;
    document.getElementById("totalAcertos").innerText = acertos;
    document.getElementById("totalQuestoes").innerText = questoes.length;
    
    let respondidas = Object.values(respostasUsuario).filter(r => r.respondida === true).length;
    let taxa = respondidas ? Math.round((acertos/respondidas)*100) : 0;
    document.getElementById("taxaAcertos").innerText = taxa+"%";
    document.getElementById("revisarQuestoes").innerText = Object.values(respostasUsuario).filter(r => r.acertou === false).length;
}

function renderizarQuestoes() {
    const materia = document.getElementById("filtroMateria")?.value || "todas";
    const assunto = document.getElementById("filtroTopico")?.value || "todos";
    const status = document.getElementById("filtroStatus")?.value || "todas";
    
    let filtradas = questoes.filter(q => (materia === "todas" || q.materia === materia) && (assunto === "todos" || q.assunto === assunto));
    if(status === "naoRespondidas") filtradas = filtradas.filter(q => !respostasUsuario[q.id]?.respondida);
    if(status === "corretas") filtradas = filtradas.filter(q => respostasUsuario[q.id]?.acertou === true);
    if(status === "erradas") filtradas = filtradas.filter(q => respostasUsuario[q.id]?.acertou === false);
    
    const container = document.getElementById("questoesList");
    if(!container) return;
    
    if(filtradas.length === 0) { 
        container.innerHTML = "<p style='text-align:center; padding:40px;'>Nenhuma questão encontrada</p>"; 
        return; 
    }
    
    container.innerHTML = filtradas.map(q => {
        const resp = respostasUsuario[q.id] || {};
        // FILTRAR alternativas vazias - REMOVE C e D sem texto
        const alternativasValidas = Object.entries(q.alternativas).filter(([letra, texto]) => texto && texto.trim() !== "");
        let alternativasHtml = alternativasValidas.map(([letra, texto]) => {
            let classes = "alternativa";
            if(resp.respondida) {
                if(letra === q.correta) classes += " correct-answer";
                if(letra === resp.resposta_usuario && resp.resposta_usuario !== q.correta) classes += " wrong-answer";
            }
            return `<div class="${classes}" data-letra="${letra}" data-qid="${q.id}"><strong>${letra})</strong> ${texto}</div>`;
        }).join('');
        
        return `
            <div class="question-card" id="q${q.id}">
                <div class="action-icons">
                    <button class="edit-btn" onclick="abrirModalEdicao(${q.id})">✏️</button>
                    <button class="delete-btn" onclick="excluirQuestao(${q.id})">🗑️</button>
                    ${resp.respondida ? `<button class="reset-btn" onclick="resetarResposta(${q.id})" title="Resetar resposta">🔄</button>` : ''}
                </div>
                <div class="question-text"><strong>📚 ${q.materia} | ${q.assunto}</strong><br>${q.enunciado}</div>
                <div class="alternativas" id="alt-${q.id}">${alternativasHtml}</div>
                ${!resp.respondida ? `<button class="btn-responder" data-id="${q.id}">✅ Responder</button>` : ''}
                ${resp.respondida ? `<div class="feedback ${resp.acertou ? 'correct' : 'wrong'}">${resp.acertou ? '✅ Correto! ' : '❌ Errado! '} ${q.explicacao || ''}</div>` : ''}
            </div>
        `;
    }).join('');

async function resetarResposta(questaoId) {
    if(confirm("🔄 Tem certeza que deseja resetar sua resposta para esta questão? Você poderá respondê-la novamente.")) {
        try {
            // Envia resposta vazia para resetar
            await fetch(`${API_URL}/api/respostas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario_id: usuario.id,
                    questao_id: questaoId,
                    acertou: false,
                    resposta_usuario: ''
                })
            });
            await carregarRespostas();
            renderizarQuestoes();
            carregarEstatisticas();
            atualizarStats();
            alert("✅ Resposta resetada! Você pode responder novamente.");
        } catch(e) {
            console.error(e);
            alert("❌ Erro ao resetar resposta");
        }
    }
}


    
    // Eventos das alternativas
    document.querySelectorAll('.alternativa').forEach(el => {
        el.onclick = () => {
            const qid = el.dataset.qid;
            document.querySelectorAll(`.alternativa[data-qid="${qid}"]`).forEach(a => a.classList.remove('selected'));
            el.classList.add('selected');
            window.selectedAnswer = window.selectedAnswer || {};
            window.selectedAnswer[qid] = el.dataset.letra;
        };
    });
    
    // Eventos dos botões responder
    document.querySelectorAll('.btn-responder').forEach(btn => {
        btn.onclick = async () => {
            const id = parseInt(btn.dataset.id);
            const selected = window.selectedAnswer ? window.selectedAnswer[id] : null;
            if(!selected) {
                alert("Selecione uma alternativa primeiro!");
                return;
            }
            const quest = questoes.find(q => q.id === id);
            const acertou = (selected === quest.correta);
            await salvarResposta(id, acertou, selected);
            await carregarRespostas();
            renderizarQuestoes();
            carregarEstatisticas();
            atualizarStats();
        };
    });
}

function preencherFiltros() {
    let materias = [...new Set(questoes.map(q=>q.materia))];
    let selectMateria = document.getElementById("filtroMateria");
    if(selectMateria) {
        selectMateria.innerHTML = '<option value="todas">Todas</option>' + materias.map(m=>`<option value="${m}">${m}</option>`).join('');
        selectMateria.onchange = () => {
            let assuntos = [...new Set(questoes.filter(q=>q.materia === selectMateria.value).map(q=>q.assunto))];
            let selectTopico = document.getElementById("filtroTopico");
            if(selectTopico) selectTopico.innerHTML = '<option value="todos">Todos</option>' + assuntos.map(a=>`<option value="${a}">${a}</option>`).join('');
            renderizarQuestoes();
        };
        selectMateria.dispatchEvent(new Event('change'));
    }
}