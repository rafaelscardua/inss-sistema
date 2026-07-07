// ==================== META DIÁRIA E SEQUÊNCIA (STREAK) ====================

async function carregarMetaDiaria() {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (!usuarioSalvo) return;
    const usuarioAtual = JSON.parse(usuarioSalvo);

    try {
        const res = await fetch(`${API_URL}/api/meta/${usuarioAtual.id}`, {
            headers: { 'x-user-email': usuarioAtual.email }
        });
        const data = await res.json();
        if (data.sucesso) renderizarMetaDiaria(data);
    } catch (e) {
        console.error('Erro ao carregar meta diária:', e);
    }
}

function renderizarMetaDiaria(data) {
    const textoEl = document.getElementById("metaProgressoTexto");
    const fillEl = document.getElementById("metaProgressoFill");
    const streakEl = document.getElementById("metaStreakTexto");
    if (!textoEl || !fillEl || !streakEl) return;

    const { meta_diaria, respondidas_hoje, streak } = data;
    const percentual = meta_diaria > 0 ? Math.min(100, Math.round((respondidas_hoje / meta_diaria) * 100)) : 0;

    textoEl.textContent = `${respondidas_hoje}/${meta_diaria} hoje`;
    fillEl.style.width = percentual + "%";
    fillEl.classList.toggle("meta-completa", respondidas_hoje >= meta_diaria);

    if (streak > 0) {
        streakEl.textContent = `🔥 ${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}`;
    } else {
        streakEl.textContent = "Responda hoje para começar sua sequência";
    }
}

async function editarMetaDiaria() {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (!usuarioSalvo) return;
    const usuarioAtual = JSON.parse(usuarioSalvo);

    const novaMeta = prompt("Quantas questões você quer responder por dia?", "20");
    if (novaMeta === null) return; // cancelou

    const valor = parseInt(novaMeta);
    if (!valor || valor <= 0) {
        alert("Digite um número válido maior que zero.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/meta/${usuarioAtual.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-email': usuarioAtual.email },
            body: JSON.stringify({ meta_diaria: valor })
        });
        const data = await res.json();
        if (data.sucesso) {
            await carregarMetaDiaria();
        } else {
            alert("❌ Erro ao salvar meta: " + (data.erro || "erro desconhecido"));
        }
    } catch (e) {
        console.error('Erro ao salvar meta diária:', e);
        alert("❌ Erro ao salvar meta diária");
    }
}
