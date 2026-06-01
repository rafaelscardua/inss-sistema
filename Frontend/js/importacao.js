// ==================== IMPORTAÇÃO EM LOTE ====================

function detectarQuestoes() {
    const texto = document.getElementById("importTexto").value;
    const gabaritoTexto = document.getElementById("importGabarito").value;
    const materiaPadrao = document.getElementById("importMateria").value || "Geral";
    const assuntoPadrao = document.getElementById("importAssunto").value || "Geral";
    
    let gabaritoMap = new Map();
    if (gabaritoTexto.trim()) {
        const linhasGab = gabaritoTexto.split('\n');
        for (let linha of linhasGab) {
            linha = linha.trim().toUpperCase();
            let match = linha.match(/^(\d+)[\.\s\-:]+(.*)/);
            if (match) {
                let num = parseInt(match[1]);
                let resp = match[2].trim();
                if (resp.includes("LETRA")) {
                    let letraMatch = resp.match(/LETRA\s*([A-E])/);
                    if (letraMatch) resp = letraMatch[1];
                }
                gabaritoMap.set(num, resp);
            }
        }
    }
    
    const blocos = texto.split(/\n\s*\n/);
    let questoesTemp = [];
    
    for (let bloco of blocos) {
        if (!bloco.trim()) continue;
        
        let linhas = bloco.split('\n');
        let questao = {
            materia: materiaPadrao,
            assunto: assuntoPadrao,
            enunciado: "",
            alternativas: {},
            correta: "",
            explicacao: ""
        };
        
        let numero = null;
        let emAlternativas = false;
        let alternativas = [];
        
        for (let linha of linhas) {
            linha = linha.trim();
            if (!linha) continue;
            
            let matchNum = linha.match(/^(\d+)[\.\)]\s*(.*)/);
            if (matchNum) {
                numero = parseInt(matchNum[1]);
                questao.enunciado = matchNum[2];
                continue;
            }
            
            let matchAlt = linha.match(/^([a-eA-E])[\.\)]\s*(.*)/);
            if (matchAlt) {
                emAlternativas = true;
                let letra = matchAlt[1].toUpperCase();
                let textoAlt = matchAlt[2];
                questao.alternativas[letra] = textoAlt;
                alternativas.push(letra);
                continue;
            }
            
            if (!emAlternativas) {
                questao.enunciado += " " + linha;
            } else {
                let ultimaLetra = alternativas[alternativas.length - 1];
                if (ultimaLetra) {
                    questao.alternativas[ultimaLetra] += " " + linha;
                }
            }
        }
        
        if (Object.keys(questao.alternativas).length === 0) {
            questao.alternativas = { "A": "Certo", "B": "Errado" };
        }
        
        if (numero && gabaritoMap.has(numero)) {
            let resp = gabaritoMap.get(numero);
            if (resp === "CORRETO") {
                questao.correta = "A";
            } else if (resp === "ERRADO") {
                questao.correta = "B";
            } else if (questao.alternativas[resp]) {
                questao.correta = resp;
            }
        }
        
        if (questao.enunciado) {
            questoesTemp.push(questao);
        }
    }
    
    questoesDetectadas = questoesTemp;
    mostrarPreview();
}

function mostrarPreview() {
    const previewArea = document.getElementById("previewArea");
    const previewList = document.getElementById("previewList");
    
    if (questoesDetectadas.length === 0) {
        previewList.innerHTML = "<p style='color:red;'>Nenhuma questão detectada! Verifique o formato.</p>";
        previewArea.style.display = "block";
        return;
    }
    
    previewList.innerHTML = questoesDetectadas.map((q, idx) => `
        <div class="preview-item">
            <strong>Questão ${idx + 1}</strong><br>
            <strong>Enunciado:</strong> ${q.enunciado.substring(0, 200)}${q.enunciado.length > 200 ? '...' : ''}<br>
            <strong>Alternativas:</strong> ${Object.entries(q.alternativas).map(([k, v]) => `${k}) ${v.substring(0, 50)}`).join(' | ')}<br>
            <div class="filtro-group" style="margin-top:10px;">
                <label>✅ Resposta Correta:</label>
                <input type="text" id="correta_${idx}" placeholder="A/B/C/D/E ou CORRETO/ERRADO" value="${q.correta || ''}" style="width:150px;">
            </div>
        </div>
    `).join('');
    
    previewArea.style.display = "block";
}

async function importarQuestoes() {
    let importadas = 0;
    for(let i=0; i<questoesDetectadas.length; i++) {
        let q = questoesDetectadas[i];
        let correta = document.getElementById(`correta_${i}`)?.value.trim().toUpperCase();
        if(correta && q.alternativas[correta]) {
            q.correta = correta;
            const res = await fetch(`${API_URL}/api/questoes`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(q) 
            });
            if((await res.json()).sucesso) importadas++;
        }
    }
    if(importadas) { 
        await carregarQuestoes(); 
        preencherFiltros(); 
        renderizarQuestoes(); 
        carregarEstatisticas(); 
        atualizarStats(); 
    }
    alert(`${importadas} questões importadas!`);
    document.getElementById("previewArea").style.display = "none";
    document.getElementById("importTexto").value = "";
    questoesDetectadas = [];
}