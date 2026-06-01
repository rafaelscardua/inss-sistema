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
    
    let html = '';
    for(let i = 0; i < filtradas.length; i++) {
        const q = filtradas[i];
        const resp = respostasUsuario[q.id] || {};
        
        let alternativasHtml = '';
        for(let [letra, texto] of Object.entries(q.alternativas)) {
            let classes = "alternativa";
            if(resp.respondida) {
                if(letra === q.correta) classes += " correct-answer";
                if(letra === resp.resposta_usuario && resp.resposta_usuario !== q.correta) classes += " wrong-answer";
            }
            alternativasHtml += `<div class="${classes}" data-letra="${letra}" data-qid="${q.id}"><strong>${letra})</strong> ${texto}</div>`;
        }
        
        html += `
            <div class="question-card" id="q${q.id}">
                <div class="action-icons">
                    <button class="edit-btn" onclick="abrirModalEdicao(${q.id})">✏️</button>
                    <button class="delete-btn" onclick="excluirQuestao(${q.id})">🗑️</button>
                </div>
                <div class="question-text"><strong>📚 ${q.materia} | ${q.assunto}</strong><br>${q.enunciado}</div>
                <div class="alternativas" id="alt-${q.id}">${alternativasHtml}</div>
                ${!resp.respondida ? `<button class="btn-responder" data-id="${q.id}">✅ Responder</button>` : ''}
                ${resp.respondida ? `<div class="feedback ${resp.acertou ? 'correct' : 'wrong'}">${resp.acertou ? '✅ Correto! ' : '❌ Errado! '} ${q.explicacao || ''}</div>` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
    
    // Reatribuir eventos
    document.querySelectorAll('.btn-responder').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(btn.dataset.id);
            const quest = questoes.find(q => q.id === id);
            const selectedDiv = document.querySelector(`#alt-${id} .alternativa.selected`);
            if(!selectedDiv) {
                alert("Selecione uma alternativa primeiro!");
                return;
            }
            const selected = selectedDiv.dataset.letra;
            const acertou = (selected === quest.correta);
            await salvarResposta(id, acertou, selected);
            await carregarRespostas();
            renderizarQuestoes();
            carregarEstatisticas();
            atualizarStats();
        });
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