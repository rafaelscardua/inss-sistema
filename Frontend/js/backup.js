// ==================== BACKUP E RESTAURAÇÃO ====================

function exportarBackup() { 
    const dados = { 
        questoes, 
        planoEstudos: dadosEstudo, 
        respostas: respostasUsuario, 
        data: new Date().toISOString() 
    }; 
    const blob = new Blob([JSON.stringify(dados,null,2)], {type:"application/json"}); 
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(blob); 
    a.download = `inss_backup_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`; 
    a.click(); 
    URL.revokeObjectURL(a.href); 
    alert("✅ Backup exportado!"); 
}

function importarBackup(file) { 
    const reader = new FileReader(); 
    reader.onload = async e => { 
        try { 
            const dados = JSON.parse(e.target.result); 
            if(dados.questoes) alert("Para restaurar questões, use a importação em lote."); 
        } catch(err) { 
            alert("❌ Erro ao ler arquivo!"); 
        } 
    }; 
    reader.readAsText(file); 
}