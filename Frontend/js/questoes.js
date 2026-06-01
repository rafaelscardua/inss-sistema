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
        let alternativasHtml = Object.entries(q.alternativas).map(([letra, texto]) => {
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
                </div>
                <div class="question-text"><strong>📚 ${q.materia} | ${q.assunto}</strong><br>${q.enunciado}</div>
                <div class="alternativas">${alternativasHtml}</div>
                ${!resp.respondida ? `<button class="btn-responder" data-id="${q.id}">✅ Responder</button>` : ''}
                ${resp.respondida ? `<div class="feedback ${resp.acertou ? 'correct' : 'wrong'}">${resp.acertou ? '✅ Correto! ' : '❌ Errado! '} ${q.explicacao || ''}</div>` : ''}
            </div>
        `;
    }).join('');
    
    // Eventos das alternativas
    document.querySelectorAll('.alternativa').forEach(el => {
        if(!el.hasListener) {
            el.addEventListener('click', (e) => {
                if(document.querySelector(`.btn-responder[data-id="${el.dataset.qid}"]`)) {
                    document.querySelectorAll(`.alternativa[data-qid="${el.dataset.qid}"]`).forEach(a=>a.classList.remove('selected'));
                    el.classList.add('selected');
                    window.selectedAnswer[el.dataset.qid] = el.dataset.letra;
                }
            });
            el.hasListener = true;
        }
    });
    
    // Eventos dos botões responder
    document.querySelectorAll('.btn-responder').forEach(btn => {
        if(!btn.hasListener) {
            btn.addEventListener('click', async (e) => {
                let id = parseInt(btn.dataset.id);
                let quest = questoes.find(q=>q.id===id);
                if (!window.selectedAnswer || !window.selectedAnswer[id]) {
                    alert("Selecione uma alternativa primeiro!");
                    return;
                }
                let selected = window.selectedAnswer[id];
                let acertou = (selected === quest.correta);
                await salvarResposta(id, acertou, selected);
                await carregarRespostas();
                renderizarQuestoes();
                carregarEstatisticas();
                atualizarStats();
            });
            btn.hasListener = true;
        }
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