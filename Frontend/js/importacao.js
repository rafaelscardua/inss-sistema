// ==================== IMPORTAÇÃO EM LOTE ====================

function detectarQuestoes() {
    const texto = document.getElementById("importTexto").value;
    const gabaritoTexto = document.getElementById("importGabarito").value;

    // Processa gabarito
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

    // NOVO: Pegar matéria (select ou novo input)
    let materiaPadrao = "";
    const materiaSelect = document.getElementById("importMateriaSelect");
    const materiaNova = document.getElementById("importMateriaNova");

    if (materiaSelect.value === "nova") {
        materiaPadrao = materiaNova.value.trim();
        if (!materiaPadrao) {
            alert("Digite o nome da nova matéria!");
            return;
        }
    } else if (materiaSelect.value) {
        materiaPadrao = materiaSelect.value;
    }

    // NOVO: Pegar assunto (select ou novo input)
    let assuntoPadrao = "";
    const assuntoSelect = document.getElementById("importAssuntoSelect");
    const assuntoNova = document.getElementById("importAssuntoNova");

    if (assuntoSelect.value === "nova") {
        assuntoPadrao = assuntoNova.value.trim();
        if (!assuntoPadrao) {
            alert("Digite o nome do novo assunto!");
            return;
        }
    } else if (assuntoSelect.value) {
        assuntoPadrao = assuntoSelect.value;
    }

    if (!materiaPadrao || !assuntoPadrao) {
        alert("Selecione ou digite uma matéria e um assunto!");
        return;
    }

    // Divide o texto em blocos de questões
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
    for (let i = 0; i < questoesDetectadas.length; i++) {
        let q = questoesDetectadas[i];
        let correta = document.getElementById(`correta_${i}`)?.value.trim().toUpperCase();
        if (correta && q.alternativas[correta]) {
            q.correta = correta;
            const res = await fetch(`${API_URL}/api/questoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(q)
            });
            if ((await res.json()).sucesso) importadas++;
        }
    }
    if (importadas) {
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

// ==================== IMPORTAÇÃO DE EXERCÍCIOS ====================

async function importarExercicios() {
    const texto = document.getElementById("importTexto").value;
    
    // Pegar matéria e assunto selecionados
    const materiaSelect = document.getElementById("importMateriaSelect");
    const assuntoSelect = document.getElementById("importAssuntoSelect");
    
    let materia = materiaSelect.value;
    let assunto = assuntoSelect.value;
    
    if (materia === 'nova') {
        materia = document.getElementById("importMateriaNova").value.trim();
        if (!materia) {
            alert('Digite o nome da nova matéria!');
            return;
        }
    }
    
    if (assunto === 'nova') {
        assunto = document.getElementById("importAssuntoNova").value.trim();
        if (!assunto) {
            alert('Digite o nome do novo assunto!');
            return;
        }
    }
    
    if (!materia || !assunto) {
        alert('Selecione ou digite uma matéria e um assunto!');
        return;
    }
    
    const blocos = texto.split(/\n\s*\n/);
    let exercicios = [];
    let importados = 0;
    
    for (let bloco of blocos) {
        if (!bloco.trim()) continue;
        
        let linhas = bloco.split('\n');
        let enunciado = "";
        let alternativas = {};
        let solucao = "";
        let correta = "";
        
        for (let linha of linhas) {
            linha = linha.trim();
            
            // Verificar se é a linha da solução
            if (linha.toUpperCase().startsWith('SOLUÇÃO:') || linha.toUpperCase().startsWith('SOLUCAO:')) {
                solucao = linha.replace(/SOLUÇÃO:\s*/i, '').replace(/SOLUCAO:\s*/i, '');
                continue;
            }
            
            // Verificar se é alternativa
            let matchAlt = linha.match(/^([a-eA-E])[\.\)]\s*(.*)/);
            if (matchAlt) {
                let letra = matchAlt[1].toUpperCase();
                let textoAlt = matchAlt[2];
                alternativas[letra] = textoAlt;
                continue;
            }
            
            // Verificar se é número da questão
            let matchNum = linha.match(/^(\d+)[\.\)]\s*(.*)/);
            if (matchNum && !enunciado) {
                enunciado = matchNum[2];
                continue;
            }
            
            if (!enunciado) {
                enunciado += " " + linha;
            }
        }
        
        // Determinar alternativa correta pela solução
        const letras = ['A', 'B', 'C', 'D', 'E'];
        for (let letra of letras) {
            if (solucao.toUpperCase().includes(`LETRA ${letra}`) || 
                solucao.toUpperCase().includes(`ALTERNATIVA ${letra}`) ||
                solucao.toUpperCase().startsWith(letra)) {
                correta = letra;
                break;
            }
        }
        
        if (enunciado && Object.keys(alternativas).length > 0) {
            exercicios.push({
                materia: materia,
                assunto: assunto,
                enunciado: enunciado,
                alternativas: alternativas,
                correta: correta || 'A',
                solucao: solucao || 'Solução não fornecida'
            });
        }
    }
    
    // Salvar exercícios
    for (const ex of exercicios) {
        try {
            const res = await fetch(`${API_URL}/api/exercicios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ex)
            });
            const data = await res.json();
            if (data.sucesso) importados++;
        } catch (error) {
            console.error('Erro ao salvar exercício:', error);
        }
    }
    
    alert(`✅ ${importados} exercícios importados!`);
    
    // Limpar campos
    document.getElementById("importTexto").value = "";
    document.getElementById("previewArea").style.display = "none";
    
    // Recarregar lista se a aba estiver ativa
    if (typeof renderizarExercicios === 'function') {
        renderizarExercicios();
    }
}

// Modificar a função detectarQuestoes para considerar o tipo
const originalDetectarQuestoes = window.detectarQuestoes;
window.detectarQuestoes = function() {
    const tipo = document.getElementById("tipoImportacao")?.value || "questoes";
    if (tipo === 'exercicios') {
        alert('Para exercícios, use o botão "Importar" diretamente. O formato deve conter SOLUÇÃO: no final.');
        return;
    }
    if (originalDetectarQuestoes) originalDetectarQuestoes();
};

// Modificar a função importarQuestoes para considerar o tipo
const originalImportarQuestoes = window.importarQuestoes;
window.importarQuestoes = async function() {
    const tipo = document.getElementById("tipoImportacao")?.value || "questoes";
    if (tipo === 'exercicios') {
        await importarExercicios();
    } else {
        if (originalImportarQuestoes) await originalImportarQuestoes();
    }
};