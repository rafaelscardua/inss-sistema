// ==================== ESTATÍSTICAS COM LINKS ====================

// ==================== ESTATÍSTICAS COM LINKS ====================

async function carregarEstatisticas() {
    try {
        const res = await fetch(`${API_URL}/api/estatisticas/${usuario.id}`);
        const data = await res.json();
        if(data.sucesso && data.estatisticas.length) {
            document.getElementById("estatisticasDetalhadas").innerHTML = `
                <div class="stats-grid">
                    ${data.estatisticas.map(est => {
                        const percentual = Math.round((est.acertos / est.total_questoes) * 100);
                        return `
                            <div class="stat-card">
                                <h3>${est.materia}</h3>
                                <div class="value">${est.acertos}/${est.total_questoes}</div>
                                <div class="sub">${percentual}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            document.getElementById("estatisticasDetalhadas").innerHTML = "<p>Nenhuma questão respondida ainda.</p>";
        }
        
        const questoesComRespostas = questoes.map(q => ({ ...q, ...(respostasUsuario[q.id] || {}) }));
        const acertos = questoesComRespostas.filter(q => q.respondida && q.acertou === true);
        const erros = questoesComRespostas.filter(q => q.respondida && q.acertou === false);
        
        document.getElementById("listaAcertos").innerHTML = acertos.map(q => `<div onclick="irParaQuestao(${q.id})"><strong>${q.materia} | ${q.assunto}</strong><br><small>${q.enunciado.substring(0,80)}...</small><div style="color:#27ae60;">✅ Acertou!</div></div>`).join('') || "<p>Nenhuma questão acertada.</p>";
        document.getElementById("listaErros").innerHTML = erros.map(q => `<div onclick="irParaQuestao(${q.id})"><strong>${q.materia} | ${q.assunto}</strong><br><small>${q.enunciado.substring(0,80)}...</small><div style="color:#e74c3c;">❌ Errou! Correta: ${q.correta}</div></div>`).join('') || "<p>Nenhuma questão errada. Parabéns!</p>";
    } catch(e) { console.error(e); }
}

function irParaQuestao(id) {
    document.querySelector('.tab-btn[data-tab="questoes"]').click();
    setTimeout(() => {
        const el = document.getElementById(`q${id}`);
        if(el) { 
            el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            el.style.transition = 'background 0.5s'; 
            el.style.background = '#fffde7'; 
            setTimeout(() => el.style.background = '', 2000); 
        } else {
            alert(`Questão ${id} não encontrada! Use os filtros para visualizá-la.`);
        }
    }, 100);
}

function irParaQuestao(id) {
    document.querySelector('.tab-btn[data-tab="questoes"]').click();
    setTimeout(() => {
        const el = document.getElementById(`q${id}`);
        if(el) { 
            el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            el.style.transition = 'background 0.5s'; 
            el.style.background = '#fffde7'; 
            setTimeout(() => el.style.background = '', 2000); 
        } else {
            alert(`Questão ${id} encontrada! Use os filtros para visualizá-la.`);
        }
    }, 100);
}
