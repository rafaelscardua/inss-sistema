// ==================== IMPORTAÇÃO EM LOTE ====================

// ==================== DETECÇÃO (QUESTÕES E EXERCÍCIOS) ====================

function detectarQuestoes() {
    const tipo = document.getElementById("tipoImportacao")?.value || "questoes";

    if (tipo === 'exercicios') {
        detectarExercicios();
    } else {
        detectarQuestoesNormal();
    }
}

async function importarQuestoes() {
    const tipo = document.getElementById("tipoImportacao")?.value || "questoes";

    if (tipo === 'exercicios') {
        // ==================== IMPORTA EXERCÍCIOS ====================
        let importados = 0;
        for (let i = 0; i < questoesDetectadas.length; i++) {
            let ex = questoesDetectadas[i];
            let solucao = document.getElementById(`solucao_${i}`)?.value.trim();
            if (solucao) ex.solucao = solucao;

            try {
                const res = await fetch(`${API_URL}/api/exercicios`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ex)
                });
                const data = await res.json();
                if (data.sucesso) importados++;
            } catch (error) {
                console.error('Erro ao importar exercício:', error);
            }
        }
        alert(`✅ ${importados} exercícios importados!`);
        document.getElementById("previewArea").style.display = "none";
        document.getElementById("importTexto").value = "";
        questoesDetectadas = [];
        if (typeof renderizarExercicios === 'function') renderizarExercicios();
        return;
    }

    // ==================== IMPORTA QUESTÕES NORMAIS ====================
    let importadas = 0;
    for (let i = 0; i < questoesDetectadas.length; i++) {
        let q = questoesDetectadas[i];
        let correta = document.getElementById(`correta_${i}`)?.value.trim().toUpperCase();
        if (correta && q.alternativas[correta]) {
            q.correta = correta;
            try {
                const res = await fetch(`${API_URL}/api/questoes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(q)
                });
                const data = await res.json();
                if (data.sucesso) importadas++;
            } catch (error) {
                console.error('Erro ao importar questão:', error);
            }
        }
    }
    alert(`${importadas} questões importadas!`);
    document.getElementById("previewArea").style.display = "none";
    document.getElementById("importTexto").value = "";
    questoesDetectadas = [];
}

function detectarQuestoesNormal() {
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

    // Pegar matéria e assunto
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

    // Divide o texto em blocos
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

function detectarExercicios() {
    const texto = document.getElementById("importTexto").value;

    // Pegar matéria e assunto
    const materiaSelect = document.getElementById("importMateriaSelect");
    const assuntoSelect = document.getElementById("importAssuntoSelect");

    let materia = materiaSelect.value;
    let assunto = assuntoSelect.value;

    if (materia === 'nova') {
        materia = document.getElementById("importMateriaNova").value.trim();
    }
    if (assunto === 'nova') {
        assunto = document.getElementById("importAssuntoNova").value.trim();
    }

    if (!materia || !assunto || (materiaSelect.value === 'nova' && !materia) || (assuntoSelect.value === 'nova' && !assunto)) {
        alert('Selecione ou digite uma matéria e um assunto!');
        return;
    }

    const blocos = texto.split(/\n\s*\n/);
    let exerciciosTemp = [];

    for (let bloco of blocos) {
        if (!bloco.trim()) continue;

        let linhas = bloco.split('\n');
        let enunciado = "";
        let alternativas = {};
        let solucao = "";
        let correta = "";

        for (let linha of linhas) {
            linha = linha.trim();

            if (linha.toUpperCase().startsWith('SOLUÇÃO:') || linha.toUpperCase().startsWith('SOLUCAO:')) {
                solucao = linha.replace(/SOLUÇÃO:\s*/i, '').replace(/SOLUCAO:\s*/i, '');
                continue;
            }

            let matchAlt = linha.match(/^([a-eA-E])[\.\)]\s*(.*)/);
            if (matchAlt) {
                let letra = matchAlt[1].toUpperCase();
                let textoAlt = matchAlt[2];
                alternativas[letra] = textoAlt;
                continue;
            }

            let matchNum = linha.match(/^(\d+)[\.\)]\s*(.*)/);
            if (matchNum && !enunciado) {
                enunciado = matchNum[2];
                continue;
            }

            if (!enunciado) {
                enunciado += " " + linha;
            }
        }

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
            exerciciosTemp.push({
                materia: materia,
                assunto: assunto,
                enunciado: enunciado,
                alternativas: alternativas,
                correta: correta || 'A',
                solucao: solucao || 'Solução não fornecida'
            });
        }
    }

    questoesDetectadas = exerciciosTemp;
    mostrarPreviewExercicios();
}

function mostrarPreviewExercicios() {
    const previewArea = document.getElementById("previewArea");
    const previewList = document.getElementById("previewList");

    if (questoesDetectadas.length === 0) {
        previewList.innerHTML = "<p style='color:red;'>Nenhum exercício detectado! Verifique o formato (use SOLUÇÃO: no final).</p>";
        previewArea.style.display = "block";
        return;
    }

    previewList.innerHTML = questoesDetectadas.map((ex, idx) => `
        <div class="preview-item">
            <strong>Exercício ${idx + 1}</strong><br>
            <strong>Enunciado:</strong> ${ex.enunciado.substring(0, 200)}${ex.enunciado.length > 200 ? '...' : ''}<br>
            <strong>Alternativas:</strong> ${Object.entries(ex.alternativas).map(([k, v]) => `${k}) ${v.substring(0, 50)}`).join(' | ')}<br>
            <strong>📖 Solução Detectada:</strong> ${ex.solucao.substring(0, 100)}...<br>
            <div class="filtro-group" style="margin-top:10px;">
                <label>✏️ Editar Solução (se necessário):</label>
                <input type="text" id="solucao_${idx}" value="${ex.solucao.replace(/"/g, '&quot;')}" style="width:100%;">
            </div>
        </div>
    `).join('');

    previewArea.style.display = "block";
}

// Modificar a função importarQuestoes para lidar com exercícios no preview
const originalImportarQuestoes = window.importarQuestoes;
window.importarQuestoes = async function () {
    const tipo = document.getElementById("tipoImportacao")?.value || "questoes";

    if (tipo === 'exercicios') {
        let importados = 0;
        for (let i = 0; i < questoesDetectadas.length; i++) {
            let ex = questoesDetectadas[i];
            let solucao = document.getElementById(`solucao_${i}`)?.value.trim();
            if (solucao) ex.solucao = solucao;

            const res = await fetch(`${API_URL}/api/exercicios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ex)
            });
            if ((await res.json()).sucesso) importados++;
        }
        alert(`✅ ${importados} exercícios importados!`);
        document.getElementById("previewArea").style.display = "none";
        document.getElementById("importTexto").value = "";
        questoesDetectadas = [];
        if (typeof renderizarExercicios === 'function') renderizarExercicios();
    } else {
        await originalImportarQuestoes();
    }
}; F

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

