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
    if (questoesDetectadas.length === 0) {
        alert('Detecte e revise os itens antes de importar.');
        return;
    }

    const itens = questoesDetectadas.map((item, indice) => ({ ...item }));
    if (tipo === 'exercicios') {
        itens.forEach((item, indice) => {
            item.solucao = document.getElementById(`solucao_${indice}`)?.value.trim() || '';
            const campoCorreta = document.getElementById(`correta_ex_${indice}`);
            if (campoCorreta) {
                let correta = campoCorreta.value.trim().toUpperCase();
                if (correta === 'CORRETO' || correta === 'VERDADEIRO') correta = 'A';
                if (correta === 'ERRADO' || correta === 'FALSO') correta = 'B';
                item.correta = correta;
            }
        });
    } else {
        for (let i = 0; i < itens.length; i++) {
            let correta = document.getElementById(`correta_${i}`)?.value.trim().toUpperCase() || '';
            if (correta === 'CORRETO' || correta === 'VERDADEIRO') correta = 'A';
            if (correta === 'ERRADO' || correta === 'FALSO') correta = 'B';
            if (!correta || !Object.prototype.hasOwnProperty.call(itens[i].alternativas, correta)) {
                alert(`Resposta correta inválida no item ${i + 1}. Corrija antes de importar.`);
                document.getElementById(`correta_${i}`)?.focus();
                return;
            }
            itens[i].correta = correta;
        }
    }

    const botao = document.getElementById('confirmarImportacaoBtn');
    if (botao) {
        botao.disabled = true;
        botao.textContent = '⏳ Importando lote...';
    }

    try {
        const endpoint = tipo === 'exercicios' ? '/api/importar/exercicios' : '/api/importar/questoes';
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itens })
        });
        const data = await res.json();
        if (!res.ok || !data.sucesso) {
            throw new Error(data.erro || 'Falha ao importar o lote');
        }

        const qtdDuplicados = data.duplicados?.length || 0;
        alert(`✅ Importação concluída: ${data.importados} novo(s), ${qtdDuplicados} duplicado(s) ignorado(s).`);
        document.getElementById("previewArea").style.display = "none";
        document.getElementById("importTexto").value = "";
        document.getElementById("importGabarito").value = "";
        questoesDetectadas = [];
        if (tipo === 'exercicios' && typeof renderizarExercicios === 'function') renderizarExercicios();
        if (tipo === 'questoes' && typeof carregarQuestoes === 'function') await carregarQuestoes();
    } catch (error) {
        console.error('Erro ao importar lote:', error);
        alert(`❌ ${error.message}\n\nNenhum item foi gravado. O conteúdo foi mantido para correção.`);
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = '✅ Importar';
        }
    }
}

function detectarQuestoesNormal() {
    const texto = document.getElementById("importTexto").value;
    const gabaritoTexto = document.getElementById("importGabarito").value;

    if (!texto.trim()) {
        alert('Cole ao menos uma questão para detectar.');
        return;
    }

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
    const solucaoTexto = document.getElementById("importGabarito")?.value.trim() || '';

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

    if (!texto.trim()) {
        alert('Cole ao menos um exercício para detectar.');
        return;
    }

    const solucoesPorNumero = new Map();
    for (const linha of solucaoTexto.split('\n')) {
        const match = linha.trim().match(/^(\d+)[\.\)\-:]\s*(.+)$/);
        if (match) solucoesPorNumero.set(Number(match[1]), match[2].trim());
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
        let tipo = "dissertativa";
        let numero = exerciciosTemp.length + 1;
        let ultimaAlternativa = null;
        let emSolucao = false;

        for (let linha of linhas) {
            linha = linha.trim();

            // Detecta SOLUÇÃO: se existir (opcional)
            if (linha.toUpperCase().startsWith('SOLUÇÃO:') || linha.toUpperCase().startsWith('SOLUCAO:')) {
                solucao = linha.replace(/SOLUÇÃO:\s*/i, '').replace(/SOLUCAO:\s*/i, '');
                emSolucao = true;
                ultimaAlternativa = null;
                continue;
            }

            // Detecta alternativas (A, B, C, D, E)
            let matchAlt = linha.match(/^([a-eA-E])[\.\)]\s*(.*)/);
            if (matchAlt) {
                tipo = "multipla_escolha";
                let letra = matchAlt[1].toUpperCase();
                let textoAlt = matchAlt[2];
                alternativas[letra] = textoAlt;
                ultimaAlternativa = letra;
                emSolucao = false;
                continue;
            }

            // Detecta Verdadeiro/Falso
            if (linha.toUpperCase() === 'VERDADEIRO' || linha.toUpperCase() === 'V') {
                tipo = "verdadeiro_falso";
                alternativas = { "A": "Verdadeiro", "B": "Falso" };
                ultimaAlternativa = null;
                continue;
            }
            if (linha.toUpperCase() === 'FALSO' || linha.toUpperCase() === 'F') {
                tipo = "verdadeiro_falso";
                alternativas = { "A": "Verdadeiro", "B": "Falso" };
                ultimaAlternativa = null;
                continue;
            }

            // Detecta número da questão
            let matchNum = linha.match(/^(\d+)[\.\)]\s*(.*)/);
            if (matchNum && !enunciado) {
                numero = Number(matchNum[1]);
                enunciado = matchNum[2];
                continue;
            }

            if (emSolucao) {
                solucao += `${solucao ? ' ' : ''}${linha}`;
            } else if (ultimaAlternativa) {
                alternativas[ultimaAlternativa] += ` ${linha}`;
            } else {
                enunciado += `${enunciado ? ' ' : ''}${linha}`;
            }
        }

        // Se não tem alternativas e é dissertativa, criar estrutura
        if (tipo === "dissertativa" && Object.keys(alternativas).length === 0) {
            alternativas = {
                "RESPOSTA": "Campo para resposta dissertativa"
            };
        }

        // Soluções numeradas no campo separado substituem a solução embutida.
        if (solucoesPorNumero.has(numero)) solucao = solucoesPorNumero.get(numero);
        if (!solucoesPorNumero.size && blocos.filter(b => b.trim()).length === 1 && solucaoTexto) {
            solucao = solucaoTexto;
        }

        // Determina alternativa correta (apenas para múltipla escolha)
        if (tipo === "multipla_escolha") {
            const letras = ['A', 'B', 'C', 'D', 'E'];
            for (let letra of letras) {
                if (solucao.toUpperCase().includes(`LETRA ${letra}`) ||
                    solucao.toUpperCase().includes(`ALTERNATIVA ${letra}`) ||
                    solucao.toUpperCase().startsWith(letra)) {
                    correta = letra;
                    break;
                }
            }
        } else if (tipo === "verdadeiro_falso") {
            if (/\b(VERDADEIRO|CORRETO)\b/i.test(solucao)) {
                correta = "A";
            } else if (/\b(FALSO|ERRADO)\b/i.test(solucao)) {
                correta = "B";
            }
        }

        if (enunciado) {
            exerciciosTemp.push({
                materia: materia,
                assunto: assunto,
                enunciado: enunciado,
                alternativas: alternativas,
                correta: correta || (tipo === "dissertativa" ? "RESPOSTA" : ""),
                solucao: solucao,
                tipo: tipo  // Guarda o tipo do exercício
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
        previewList.innerHTML = "<p style='color:red;'>Nenhum exercício detectado! Verifique o formato.</p>";
        previewArea.style.display = "block";
        return;
    }

    previewList.innerHTML = questoesDetectadas.map((ex, idx) => `
        <div class="preview-item">
            <strong>Exercício ${idx + 1}</strong><br>
            <strong>Enunciado:</strong> ${escapeHtml(ex.enunciado.substring(0, 200))}${ex.enunciado.length > 200 ? '...' : ''}<br>
            <strong>Alternativas:</strong> ${Object.entries(ex.alternativas).map(([k, v]) => `${escapeHtml(k)}) ${escapeHtml(v.substring(0, 50))}`).join(' | ')}<br>
            ${Object.prototype.hasOwnProperty.call(ex.alternativas, 'RESPOSTA') ? '' : `
            <div class="filtro-group" style="margin-top:10px;">
                <label>✅ Resposta Correta:</label>
                <input type="text" id="correta_ex_${idx}" value="${escapeHtml(ex.correta || '')}" placeholder="A/B/C/D/E">
            </div>`}
            <div class="filtro-group" style="margin-top:10px;">
                <label>✏️ Solução (multilinha):</label><br>
                <textarea id="solucao_${idx}" rows="3" style="width:100%;">${escapeHtml(ex.solucao || '')}</textarea>
            </div>
        </div>
    `).join('');

    previewArea.style.display = "block";
}

// Modificar a função importarQuestoes para lidar com exercícios no preview


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
            <strong>Enunciado:</strong> ${escapeHtml(q.enunciado.substring(0, 200))}${q.enunciado.length > 200 ? '...' : ''}<br>
            <strong>Alternativas:</strong> ${Object.entries(q.alternativas).map(([k, v]) => `${escapeHtml(k)}) ${escapeHtml(v.substring(0, 50))}`).join(' | ')}<br>
            <div class="filtro-group" style="margin-top:10px;">
                <label>✅ Resposta Correta:</label>
                <input type="text" id="correta_${idx}" placeholder="A/B/C/D/E ou CORRETO/ERRADO" value="${escapeHtml(q.correta || '')}" style="width:150px;">
            </div>
        </div>
    `).join('');

    previewArea.style.display = "block";
}

function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[caractere]);
}

