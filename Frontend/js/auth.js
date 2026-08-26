// ==================== AUTENTICAÇÃO ====================

function checkAuth() {
    const saved = localStorage.getItem('usuario');
    const token = localStorage.getItem('inss_token');
    if (!saved || !token) {
        localStorage.removeItem('usuario');
        localStorage.removeItem('inss_token');
        window.location.href = '/';
        return false;
    }
    usuario = JSON.parse(saved);
    document.getElementById('userName').innerHTML = `👤 ${usuario.nome}`;
    return true;
}

function logout() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('inss_token');
    window.location.href = '/';
}

async function atualizarPermissoesInterface() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (!res.ok || !data.sucesso) return false;

        usuario = data.usuario;
        localStorage.setItem('usuario', JSON.stringify(usuario));
        const podeImportar = usuario.isAdmin === true;
        document.querySelector('[data-tab="importar"]')?.toggleAttribute('hidden', !podeImportar);
        document.getElementById('tab-importar')?.toggleAttribute('hidden', !podeImportar);
        return podeImportar;
    } catch (error) {
        console.error('Erro ao verificar permissões da interface:', error);
        return false;
    }
}
