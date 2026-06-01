// ==================== EDIÇÃO DE QUESTÕES ====================

let currentEditId = null;

function abrirModalEdicao(id) { 
    const q = questoes.find(q=>q.id===id); 
    if(!q) return; 
    currentEditId=id; 
    document.getElementById("editMateria").value=q.materia; 
    document.getElementById("editAssunto").value=q.assunto; 
    document.getElementById("editEnunciado").value=q.enunciado; 
    document.getElementById("editAltA").value=q.alternativas.A||""; 
    document.getElementById("editAltB").value=q.alternativas.B||""; 
    document.getElementById("editAltC").value=q.alternativas.C||""; 
    document.getElementById("editAltD").value=q.alternativas.D||""; 
    document.getElementById("editAltE").value=q.alternativas.E||""; 
    document.getElementById("editCorreta").value=q.correta; 
    document.getElementById("editExplicacao").value=q.explicacao||""; 
    document.getElementById("editModal").style.display="flex"; 
}

function fecharModal() { 
    document.getElementById("editModal").style.display="none"; 
    currentEditId=null; 
}

// ==================== EXCLUIR QUESTÃO ====================

async function excluirQuestao(id) {
    if(confirm("🗑️ Tem certeza que deseja excluir esta questão permanentemente?")) {
        try {
            const res = await fetch(`${API_URL}/api/questoes/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.sucesso) {
                await carregarQuestoes();
                renderizarQuestoes();
                preencherFiltros();
                atualizarStats();
                alert("✅ Questão excluída com sucesso!");
            } else {
                alert("❌ Erro ao excluir questão!");
            }
        } catch(e) {
            console.error(e);
            alert("❌ Erro ao excluir questão!");
        }
    }
}



async function salvarEdicao() { 
    if(!currentEditId) return; 
    const q = questoes.find(q=>q.id===currentEditId); 
    if(q) { 
        q.materia = document.getElementById("editMateria").value; 
        q.assunto = document.getElementById("editAssunto").value; 
        q.enunciado = document.getElementById("editEnunciado").value; 
        q.alternativas = { 
            A: document.getElementById("editAltA").value, 
            B: document.getElementById("editAltB").value, 
            C: document.getElementById("editAltC").value, 
            D: document.getElementById("editAltD").value 
        }; 
        let e = document.getElementById("editAltE").value; 
        if(e) q.alternativas.E = e; 
        q.correta = document.getElementById("editCorreta").value.toUpperCase(); 
        q.explicacao = document.getElementById("editExplicacao").value; 
        
        await fetch(`${API_URL}/api/questoes/${currentEditId}`, { 
            method:'PUT', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify(q) 
        }); 
        await carregarQuestoes(); 
        renderizarQuestoes(); 
        carregarEstatisticas(); 
        fecharModal(); 
        alert("✅ Questão atualizada!"); 
    } 
}