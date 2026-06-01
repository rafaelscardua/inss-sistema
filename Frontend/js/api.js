// ==================== FUNÇÕES DE API ====================

async function carregarQuestoes() {
    try {
        const res = await fetch(`${API_URL}/api/questoes`);
        const data = await res.json();
        if (data.sucesso) { 
            questoes = data.questoes; 
            if (questoes.length) nextQuestaoId = Math.max(...questoes.map(q=>q.id)) + 1; 
        }
    } catch(e) { console.error(e); }
}

async function carregarRespostas() {
    try {
        const res = await fetch(`${API_URL}/api/respostas/${usuario.id}`);
        const data = await res.json();
        if (data.sucesso) respostasUsuario = data.respostas;
    } catch(e) { console.error(e); }
}

async function salvarResposta(questaoId, acertou, respostaUsuario) {
    try {
        await fetch(`${API_URL}/api/respostas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                usuario_id: usuario.id, 
                questao_id: questaoId, 
                acertou, 
                resposta_usuario: respostaUsuario 
            })
        });
    } catch(e) { console.error(e); }
}