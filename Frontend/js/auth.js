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