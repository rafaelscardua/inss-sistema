// ==================== PLANO DE ESTUDOS ====================

function carregarPlano() {
    const salvo = localStorage.getItem("inss_estudos");
    if (salvo) dadosEstudo = JSON.parse(salvo);
}

function salvarPlano() { 
    localStorage.setItem("inss_estudos", JSON.stringify(dadosEstudo)); 
}

function renderizarMaterias() {
    const container = document.getElementById("materiasContainer");
    if(!container) return;
    container.innerHTML = "";
    dadosEstudo.materias.forEach((m, mIdx) => {
        let totalSub=0, completos=0;
        m.topicos.forEach(t=>{ t.subtopicos?.forEach(s=>{ totalSub++; if(s.feito) completos++; }) });
        let progresso = totalSub ? Math.round((completos/totalSub)*100) : 0;
        const div = document.createElement("div"); div.className="materia";
        div.innerHTML = `
            <div class="materia-header" onclick="window.toggleMateria(${mIdx})">
                <div><b>${m.nome}</b> <span style="font-size:0.8em;">${progresso}%</span></div>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progresso}%"></div></div>
            </div>
            <div class="materia-content ${m.expandido ? '' : 'collapsed'}">
                ${m.topicos.map((t, tIdx) => `
                    <div class="topico">
                        <div class="topico-header">
                            <span class="topico-nome">📌 ${t.nome}</span>
                            <select class="status-select" data-m="${mIdx}" data-t="${tIdx}">
                                <option value="0" ${t.status===0?'selected':''}>🔴 Não iniciado</option>
                                <option value="1" ${t.status===1?'selected':''}>🟡 Estudando</option>
                                <option value="2" ${t.status===2?'selected':''}>🟠 Exercícios</option>
                                <option value="3" ${t.status===3?'selected':''}>🟢 Dominado</option>
                            </select>
                        </div>
                        <div class="subtopicos">
                            ${t.subtopicos?.map((sub, sIdx) => `<div class="subtopico"><input type="checkbox" class="sub-check" data-m="${mIdx}" data-t="${tIdx}" data-s="${sIdx}" ${sub.feito ? 'checked' : ''}> <label>${sub.nome}</label></div>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(div);
    });
    
    document.querySelectorAll('.status-select').forEach(sel => sel.addEventListener('change', (e) => { 
        let [m,t] = [parseInt(sel.dataset.m), parseInt(sel.dataset.t)]; 
        dadosEstudo.materias[m].topicos[t].status = parseInt(sel.value); 
        salvarPlano(); 
        renderizarMaterias(); 
    }));
    
    document.querySelectorAll('.sub-check').forEach(chk => chk.addEventListener('change', (e) => { 
        let [m,t,s] = [parseInt(chk.dataset.m), parseInt(chk.dataset.t), parseInt(chk.dataset.s)]; 
        dadosEstudo.materias[m].topicos[t].subtopicos[s].feito = chk.checked; 
        salvarPlano(); 
        renderizarMaterias(); 
    }));
}

window.toggleMateria = (idx) => { 
    dadosEstudo.materias[idx].expandido = !dadosEstudo.materias[idx].expandido; 
    salvarPlano(); 
    renderizarMaterias(); 
};