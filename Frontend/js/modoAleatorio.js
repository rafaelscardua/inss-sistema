// ==================== MODO ALEATÓRIO ====================

async function iniciarModoAleatorio(quantidade) {
    await carregarQuestoes();
    if (!questoes.length) { alert("Nenhuma questão cadastrada!"); return; }
    
    // NÃO filtrar por respondidas - pegar TODAS as questões
    let filtradas = [...questoes];
    
    // Aplica filtro de status APENAS se não for "todas"
    const filtroStatus = document.getElementById("filtroStatus")?.value || "todas";
    
    if (filtroStatus === "corretas") {
        filtradas = filtradas.filter(q => respostasUsuario[q.id]?.acertou === true);
    } else if (filtroStatus === "erradas") {
        filtradas = filtradas.filter(q => respostasUsuario[q.id]?.acertou === false);
    }
    // "naoRespondidas" e "todas" - não filtra
    
    if (filtradas.length === 0) { 
        alert("Nenhuma questão encontrada com o filtro selecionado!"); 
        return; 
    }
    
    // Embaralhar
    for (let i = filtradas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtradas[i], filtradas[j]] = [filtradas[j], filtradas[i]];
    }
    
    questoesAleatorias = filtradas.slice(0, Math.min(quantidade, filtradas.length));
    indiceAleatorioAtual = 0;
    modoAleatorioAtivo = true;
    mostrarQuestaoAleatoria();
}

function mostrarQuestaoAleatoria() {
    if (!modoAleatorioAtivo || indiceAleatorioAtual >= questoesAleatorias.length) {
        alert(`🎉 Parabéns! Você completou ${questoesAleatorias.length} questões!`);
        encerrarModoAleatorio();
        return;
    }
    
    const quest = questoesAleatorias[indiceAleatorioAtual];
    const resp = respostasUsuario[quest.id] || { respondida: false };
    const container = document.getElementById("questoesList");
    
    let alternativasHtml = Object.entries(quest.alternativas).map(([letra, texto]) => {
        let classes = "alternativa";
        // Mostrar visualmente se já foi respondida (mas permite re-responder)
        if(resp.respondida) {
            if(letra === quest.correta) classes += " correct-answer";
            if(letra === resp.resposta_usuario && resp.resposta_usuario !== quest.correta) classes += " wrong-answer";
        }
        return `<div class="${classes}" data-letra="${letra}" data-qid="${quest.id}"><strong>${letra})</strong> ${texto}</div>`;
    }).join('');
    
    // Exibir feedback se já foi respondida, mas SEMPRE mostrar botão responder
    const feedbackHtml = resp.respondida ? `
        <div class="feedback ${resp.acertou ? 'correct' : 'wrong'}">
            ${resp.acertou ? '✅ Resposta anterior: CORRETA' : '❌ Resposta anterior: ERRADA'}
            <br><small>Responda novamente para atualizar!</small>
        </div>
    ` : '';
    
    container.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span>🎲 <strong>MODO ALEATÓRIO</strong></span><br>
                <small>Questão ${indiceAleatorioAtual + 1} de ${questoesAleatorias.length}</small>
            </div>
            <div>
                <span style="margin-right: 15px;">✅ Acertos: ${questoesAleatorias.filter((_,i) => i < indiceAleatorioAtual && respostasUsuario[questoesAleatorias[i].id]?.acertou === true).length}</span>
                <button class="btn-small" id="sairAleatorioBtn" style="background: #e74c3c;">❌ Sair</button>
            </div>
        </div>
        <div class="question-card">
            <div class="question-text"><strong>📚 ${quest.materia} | ${quest.assunto}</strong><br>${quest.enunciado}</div>
            <div class="alternativas" id="altAleatorio">${alternativasHtml}</div>
            <button class="btn-responder" id="respAleatorioBtn">✅ Responder</button>
            ${feedbackHtml}
        </div>
    `;
    
    // Evento das alternativas
    document.querySelectorAll('#altAleatorio .alternativa').forEach(el => {
        el.onclick = () => {
            document.querySelectorAll('#altAleatorio .alternativa').forEach(a=>a.classList.remove('selected'));
            el.classList.add('selected');
            window.selectedAleatorio = el.dataset.letra;
        };
    });
    
    // Evento do botão responder - SEMPRE ativo, mesmo para questões já respondidas
    document.getElementById("respAleatorioBtn").onclick = async () => {
        let selected = window.selectedAleatorio;
        if(!selected) { 
            alert("Selecione uma alternativa primeiro!"); 
            return; 
        }
        const acertou = (selected === quest.correta);
        
        // Salvar resposta (sobrescreve a anterior)
        await fetch(`${API_URL}/api/respostas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: usuario.id,
                questao_id: quest.id,
                acertou: acertou,
                resposta_usuario: selected
            })
        });
        
        // Recarregar dados
        await carregarRespostas();
        
        // Ir para próxima questão
        indiceAleatorioAtual++;
        mostrarQuestaoAleatoria();
        
        // Atualizar estatísticas
        if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
        if(typeof atualizarStats === 'function') atualizarStats();
    };
    
    document.getElementById("sairAleatorioBtn").onclick = () => encerrarModoAleatorio();
}

function encerrarModoAleatorio() {
    modoAleatorioAtivo = false;
    questoesAleatorias = [];
    indiceAleatorioAtual = 0;
    renderizarQuestoes();
    if(simuladoTimerInterval) { clearInterval(simuladoTimerInterval); simuladoTimerInterval = null; }
}

// ==================== SIMULADO AVANÇADO ====================

function abrirSimuladoModal() {
    const selectMaterias = document.getElementById("simuladoMaterias");
    if(selectMaterias) {
        const materiasUnicas = [...new Set(questoes.map(q => q.materia))];
        selectMaterias.innerHTML = '<option value="todas">Todas as matérias</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    }
    const selectAssuntos = document.getElementById("simuladoAssuntos");
    if(selectAssuntos) {
        const assuntosUnicos = [...new Set(questoes.map(q => q.assunto))];
        selectAssuntos.innerHTML = '<option value="todos">Todos os assuntos</option>' + assuntosUnicos.map(a => `<option value="${a}">${a}</option>`).join('');
    }
    document.getElementById("simuladoModal").style.display = "flex";
}

function fecharSimuladoModal() { document.getElementById("simuladoModal").style.display = "none"; }

async function iniciarSimulado() {
    const quantidade = parseInt(document.getElementById("simuladoQtd")?.value) || 20;
    const materiasSelecionadas = Array.from(document.getElementById("simuladoMaterias")?.selectedOptions || []).map(o => o.value);
    const assuntosSelecionados = Array.from(document.getElementById("simuladoAssuntos")?.selectedOptions || []).map(o => o.value);
    const apenasNaoRespondidas = document.getElementById("simuladoApenasNaoRespondidas")?.checked || false;
    const apenasErradas = document.getElementById("simuladoApenasErradas")?.checked || false;
    const comTimer = document.getElementById("simuladoTimer")?.checked || false;
    const timerMinutos = parseInt(document.getElementById("simuladoTimerMinutos")?.value) || 30;
    
    await carregarQuestoes();
    
    let filtradas = [...questoes];
    
    if (!materiasSelecionadas.includes("todas") && materiasSelecionadas.length > 0) {
        filtradas = filtradas.filter(q => materiasSelecionadas.includes(q.materia));
    }
    if (!assuntosSelecionados.includes("todos") && assuntosSelecionados.length > 0) {
        filtradas = filtradas.filter(q => assuntosSelecionados.includes(q.assunto));
    }
    
    // Filtros opcionais (não bloqueiam, apenas selecionam)
    if (apenasNaoRespondidas) {
        filtradas = filtradas.filter(q => !respostasUsuario[q.id]?.respondida);
    } else if (apenasErradas) {
        filtradas = filtradas.filter(q => respostasUsuario[q.id]?.acertou === false);
    }
    
    if (filtradas.length === 0) { alert("Nenhuma questão encontrada com os filtros selecionados!"); return; }
    
    for (let i = filtradas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtradas[i], filtradas[j]] = [filtradas[j], filtradas[i]];
    }
    
    questoesAleatorias = filtradas.slice(0, Math.min(quantidade, filtradas.length));
    indiceAleatorioAtual = 0;
    modoAleatorioAtivo = true;
    
    fecharSimuladoModal();
    
    if (comTimer) {
        simuladoTempoRestante = timerMinutos * 60;
        if(simuladoTimerInterval) clearInterval(simuladoTimerInterval);
        simuladoTimerInterval = setInterval(() => {
            if(simuladoTempoRestante <= 0) {
                clearInterval(simuladoTimerInterval);
                alert("⏰ Tempo esgotado! Finalizando simulado.");
                encerrarModoAleatorio();
            } else {
                simuladoTempoRestante--;
            }
        }, 1000);
    }
    
    mostrarQuestaoAleatoria();
}

function fecharResultadoModal() { document.getElementById("resultadoModal").style.display = "none"; }