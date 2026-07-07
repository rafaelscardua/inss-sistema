// ==================== CONFIGURAÇÕES GLOBAIS ====================

const API_URL = window.location.origin;

// ==================== AUTENTICAÇÃO AUTOMÁTICA NAS REQUISIÇÕES ====================
// Em vez de editar toda chamada fetch(...) espalhada pelos arquivos .js do
// projeto pra anexar o token, interceptamos o fetch nativo aqui uma única vez:
// toda requisição feita para a própria API já sai com o header Authorization,
// sem precisar mexer em mais nada.
(function () {
    const fetchOriginal = window.fetch;
    window.fetch = function (input, init = {}) {
        const token = localStorage.getItem('inss_token');
        if (!token) return fetchOriginal(input, init);

        const options = { ...init };
        options.headers = new Headers(init.headers || {});
        options.headers.set('Authorization', `Bearer ${token}`);

        return fetchOriginal(input, options).then(response => {
            if (response.status === 401) {
                // Sessão expirada ou inválida - manda de volta pro login
                localStorage.removeItem('usuario');
                localStorage.removeItem('inss_token');
                if (!window.location.pathname.endsWith('/') && window.location.pathname !== '/login.html') {
                    window.location.href = '/';
                }
            }
            return response;
        });
    };
})();

// Variáveis globais
let usuario = null;
let questoes = [];
let respostasUsuario = {};

// Dados do plano de estudos (localStorage)
let dadosEstudo = {
    materias: [
        { nome: "📖 LÍNGUA PORTUGUESA", expandido: true, topicos: [{ nome: "Compreensão e Interpretação", status: 0, subtopicos: [{ nome: "Ideias principais", feito: false }] }] },
        { nome: "🧮 RACIOCÍNIO LÓGICO", expandido: true, topicos: [{ nome: "Estruturas Lógicas", status: 0, subtopicos: [{ nome: "Conectivos", feito: false }] }] },
        { nome: "⚖️ LEGISLAÇÃO INSS", expandido: true, topicos: [{ nome: "Lei 8.213/91", status: 0, subtopicos: [{ nome: "Benefícios", feito: false }] }] },
        { nome: "🏛️ DIREITO CONSTITUCIONAL", expandido: true, topicos: [{ nome: "Seguridade Social", status: 0, subtopicos: [{ nome: "Princípios", feito: false }] }] },
        { nome: "💻 INFORMÁTICA", expandido: true, topicos: [{ nome: "Backup e Segurança", status: 0, subtopicos: [{ nome: "Tipos de backup", feito: false }] }] }
    ]
};

let nextQuestaoId = 1;
window.selectedAnswer = {};

// Variáveis do modo aleatório
let modoAleatorioAtivo = false;
let questoesAleatorias = [];
let indiceAleatorioAtual = 0;
let simuladoTimerInterval = null;
let simuladoTempoRestante = 0;

// Variáveis do cronômetro
let timerInterval = null;
let tempoRestante = 25 * 60;
let modoFoco = true;
let ciclos = 0;

// Variáveis da importação
let questoesDetectadas = [];