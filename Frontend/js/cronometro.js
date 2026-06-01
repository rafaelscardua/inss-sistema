// ==================== CRONÔMETRO POMODORO ====================

function atualizarDisplay() { 
    let m = Math.floor(tempoRestante/60), s = tempoRestante%60; 
    document.getElementById("timerDisplay").textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; 
}

function iniciarTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(tempoRestante > 0) { 
            tempoRestante--; 
            atualizarDisplay(); 
        } else {
            clearInterval(timerInterval); 
            timerInterval = null;
            if(modoFoco) { 
                alert("🍅 Foco concluído! Pausa de 5 min!"); 
                modoFoco = false; 
                tempoRestante = 5*60; 
                atualizarDisplay(); 
            } else { 
                ciclos++; 
                alert(ciclos%4===0 ? "🎉 4 ciclos! Pausa longa de 15 min!" : "☕ Pausa concluída! Foco 25 min!"); 
                modoFoco = true; 
                tempoRestante = ciclos%4===0 ? 15*60 : 25*60; 
                atualizarDisplay(); 
            }
        }
    }, 1000);
}

function pausarTimer() { 
    if(timerInterval) { 
        clearInterval(timerInterval); 
        timerInterval = null; 
    } 
}

function resetarTimer() { 
    pausarTimer(); 
    modoFoco = true; 
    tempoRestante = 25*60; 
    ciclos = 0; 
    atualizarDisplay(); 
}