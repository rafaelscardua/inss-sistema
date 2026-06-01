// ==================== AUTENTICAÇÃO ====================

function checkAuth() {
    const saved = localStorage.getItem('usuario');
    if (!saved) { 
        window.location.href = '/'; 
        return false; 
    }
    usuario = JSON.parse(saved);
    document.getElementById('userName').innerHTML = `👤 ${usuario.nome}`;
    return true;
}

function logout() { 
    localStorage.removeItem('usuario'); 
    window.location.href = '/'; 
}