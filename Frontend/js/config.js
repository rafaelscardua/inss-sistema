// ==================== CONFIGURAÇÕES GLOBAIS ====================

const API_URL = window.location.origin;

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