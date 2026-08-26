// ==================== BACKUP E RESTAURAÇÃO (BANCO COMPLETO) ====================
// Faz backup/restore direto no servidor (PostgreSQL), não mais em memória do navegador.
// Só o admin pode exportar ou restaurar.

function getUsuarioLogado() {
    const usuarioSalvo = localStorage.getItem('usuario');
    return usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
}

async function exportarBackup() {
    const usuarioAtual = getUsuarioLogado();
    if (!usuarioAtual) {
        alert("❌ Faça login novamente para exportar o backup.");
        return;
    }

    try {
        const btn = document.getElementById("exportarDadosBtn");
        if (btn) { btn.disabled = true; btn.textContent = "⏳ Gerando backup..."; }

        const res = await fetch(`${API_URL}/api/admin/backup`, {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();

        if (!data.sucesso) {
            alert("❌ Erro ao gerar backup: " + (data.erro || "erro desconhecido"));
            return;
        }

        const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `inss_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(a.href);

        const totalLinhas = Object.values(data.backup.tabelas).reduce((soma, linhas) => soma + (linhas?.length || 0), 0);
        alert(`✅ Backup completo exportado! (${Object.keys(data.backup.tabelas).length} tabelas, ${totalLinhas} registros no total)`);
    } catch (e) {
        console.error(e);
        alert("❌ Erro ao exportar backup!");
    } finally {
        const btn = document.getElementById("exportarDadosBtn");
        if (btn) { btn.disabled = false; btn.textContent = "💾 Exportar Backup"; }
    }
}

function importarBackup(file) {
    const usuarioAtual = getUsuarioLogado();
    if (!usuarioAtual) {
        alert("❌ Faça login novamente para restaurar o backup.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async e => {
        let backup;
        try {
            backup = JSON.parse(e.target.result);
        } catch (err) {
            alert("❌ Arquivo de backup inválido (não é um JSON válido)!");
            return;
        }

        if (backup.versao !== 3 || !backup.tabelas || !backup.manifesto || !backup.checksum) {
            alert("❌ Backup inválido ou de uma versão antiga incompatível.");
            return;
        }

        const dataBackup = backup.data ? new Date(backup.data).toLocaleString() : "data desconhecida";
        const confirmacao = prompt(
            `⚠️ ATENÇÃO: isso vai APAGAR TODOS os dados atuais do banco (todos os usuários, questões, respostas, anexos etc) e substituir pelos dados do backup de ${dataBackup}.\n\nEsta ação NÃO PODE SER DESFEITA.\n\nDigite RESTAURAR (em maiúsculas) para confirmar:`
        );
        if (confirmacao !== "RESTAURAR") {
            alert("Restauração cancelada.");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/admin/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backup })
            });
            const data = await res.json();

            if (data.sucesso) {
                alert("✅ Backup restaurado com sucesso! A página vai recarregar agora.");
                location.reload();
            } else {
                alert("❌ Erro ao restaurar backup: " + (data.erro || "erro desconhecido"));
            }
        } catch (err) {
            console.error(err);
            alert("❌ Erro ao restaurar backup! Verifique sua conexão e tente novamente.");
        }
    };
    reader.readAsText(file);
}
