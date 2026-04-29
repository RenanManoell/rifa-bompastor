// ============================================
// SISTEMA DE RIFA - SEU BOM PASTOR
// VERSÃO FINAL COM LOADING E MÁSCARA
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycbw6bLdf_Rt45EXOmaRJrDQZ-kyoc-gQ7HJarDA6uUvAf-mHVBSwvCWcLpvcCyCqez6J/exec";


// Estado global
let numerosDisponiveis = [];
let carrinho = [];
let currentPaymentId = null;
let checkInterval = null;
let currentFilter = "all";

// Elementos DOM
const globalLoading = document.getElementById("globalLoading");
const toastContainer = document.getElementById("toastContainer");

// ============================================
// UTILITÁRIOS - LOADING E TOAST
// ============================================

function showLoading(show = true) {
    if (show) {
        globalLoading.classList.add("active");
    } else {
        globalLoading.classList.remove("active");
    }
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = type === "success" ? "✓" : type === "error" ? "✗" : type === "warning" ? "⚠" : "ℹ";
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function disableButton(btn, disable = true, originalText = null) {
    if (!btn) return;
    if (disable) {
        btn._originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-loading"></span> Aguarde...';
        btn.style.opacity = "0.7";
    } else {
        btn.disabled = false;
        btn.innerHTML = btn._originalText || originalText || btn.innerHTML;
        btn.style.opacity = "1";
    }
}

// Adicionar estilo para botão loading
const btnLoadingStyle = document.createElement("style");
btnLoadingStyle.textContent = `
    .btn-loading {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
`;
document.head.appendChild(btnLoadingStyle);

// ============================================
// MÁSCARA DE TELEFONE WHATSAPP
// ============================================

function formatPhone(value) {
    let numbers = value.replace(/\D/g, "");
    
    if (numbers.length === 0) return "";
    if (numbers.length <= 2) return `+${numbers}`;
    if (numbers.length <= 4) return `+${numbers.substring(0, 2)} (${numbers.substring(2)}`;
    if (numbers.length <= 7) return `+${numbers.substring(0, 2)} (${numbers.substring(2, 4)}) ${numbers.substring(4)}`;
    if (numbers.length <= 11) return `+${numbers.substring(0, 2)} (${numbers.substring(2, 4)}) ${numbers.substring(4, 9)}-${numbers.substring(9)}`;
    
    return `+${numbers.substring(0, 2)} (${numbers.substring(2, 4)}) ${numbers.substring(4, 9)}-${numbers.substring(9, 13)}`;
}

function applyPhoneMask(input) {
    if (!input) return;
    const rawValue = input.value.replace(/\D/g, "");
    if (rawValue.length > 13) {
        input.value = formatPhone(rawValue.slice(0, 13));
    } else {
        input.value = formatPhone(rawValue);
    }
}

// Aplicar máscara a todos os campos com classe phone-mask
function initPhoneMasks() {
    const phoneInputs = document.querySelectorAll(".phone-mask");
    phoneInputs.forEach(input => {
        input.addEventListener("input", () => applyPhoneMask(input));
        input.addEventListener("blur", () => {
            if (input.value.trim() && !input.value.startsWith("+55")) {
                const raw = input.value.replace(/\D/g, "");
                if (raw.length >= 10) {
                    input.value = formatPhone(raw);
                }
            }
        });
    });
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    initPhoneMasks();
    configurarEventos();
    
    await carregarInformacoesRifa();
    await carregarNumeros();
    atualizarCarrinhoUI();
    verificarPagamentoAposRetorno();
    
    // Inicializar filtros
    initFilters();
    
    // Animação do carrinho (minimizar/expandir)
    const cartHeader = document.getElementById("cartHeader");
    if (cartHeader) {
        cartHeader.addEventListener("click", () => {
            document.getElementById("cart").classList.toggle("cart-minimized");
        });
    }
});

function initFilters() {
    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            renderizarNumeros();
        });
    });
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function carregarInformacoesRifa() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=getRifaInfo`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('total-numeros').textContent = data.total_numeros || 1000;
            document.getElementById('disponiveis').textContent = data.disponiveis || 0;
            document.getElementById('vendidos').textContent = data.vendidos || 0;
            document.getElementById('valor-bilhete').innerHTML = formatarMoeda(data.valor_bilhete || 10);
            document.getElementById('data-sorteio').textContent = data.data_sorteio || 'Dia das Mães - Maio 2025';
            
            const percentual = data.total_numeros ? (data.vendidos / data.total_numeros) * 100 : 0;
            document.getElementById('progress-fill').style.width = `${percentual}%`;
            document.getElementById('percentual-vendido').textContent = `${Math.round(percentual)}%`;
        } else {
            showToast("Erro ao carregar informações da rifa", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro de conexão com o servidor", "error");
    } finally {
        showLoading(false);
    }
}

async function carregarNumeros() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=getNumbers`);
        const result = await response.json();
        
        if (result.success) {
            numerosDisponiveis = result.disponiveis || [];
            renderizarNumeros();
        } else {
            showToast("Erro ao carregar números", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro de conexão", "error");
    } finally {
        showLoading(false);
    }
}

function renderizarNumeros() {
    const grid = document.getElementById('numeros-grid');
    const totalNumeros = parseInt(document.getElementById('total-numeros').textContent) || 100;
    
    let html = '';
    for (let i = 1; i <= totalNumeros; i++) {
        const disponivel = numerosDisponiveis.includes(i);
        const noCarrinho = carrinho.includes(i);
        
        // Aplicar filtro
        if (currentFilter === "disponiveis" && (!disponivel || noCarrinho)) continue;
        if (currentFilter === "carrinho" && !noCarrinho) continue;
        
        let statusText = '';
        let statusClass = '';
        
        if (noCarrinho) {
            statusText = 'No carrinho';
            statusClass = 'selecionado';
        } else if (disponivel) {
            statusText = 'Disponível';
            statusClass = 'disponivel';
        } else {
            statusText = 'Vendido';
            statusClass = 'indisponivel';
        }
        
        html += `
            <div class="numero-card ${statusClass}" onclick="toggleCarrinho(${i})">
                <span class="numero-valor">${i}</span>
                <span class="numero-status">${statusText}</span>
            </div>
        `;
    }
    
    if (html === '') {
        html = '<div class="loading-grid">Nenhum número encontrado para este filtro</div>';
    }
    
    grid.innerHTML = html;
}

function toggleCarrinho(numero) {
    if (!numerosDisponiveis.includes(numero)) {
        showToast("Este número não está mais disponível", "error");
        return;
    }
    
    const index = carrinho.indexOf(numero);
    if (index === -1) {
        carrinho.push(numero);
        showToast(`Número ${numero} adicionado ao carrinho!`, "success");
    } else {
        carrinho.splice(index, 1);
        showToast(`Número ${numero} removido do carrinho`, "info");
    }
    
    carrinho.sort((a, b) => a - b);
    atualizarCarrinhoUI();
    renderizarNumeros();
}

function atualizarCarrinhoUI() {
    const carrinhoItens = document.getElementById('carrinho-itens');
    const carrinhoCount = document.getElementById('carrinho-count');
    const carrinhoTotal = document.getElementById('carrinho-total');
    const btnFinalizar = document.getElementById('btn-finalizar');
    
    const qtd = carrinho.length;
    carrinhoCount.textContent = `${qtd} número${qtd !== 1 ? 's' : ''}`;
    
    if (qtd === 0) {
        carrinhoItens.innerHTML = '<div class="cart-empty">Nenhum número selecionado</div>';
        carrinhoTotal.textContent = formatarMoeda(0);
        btnFinalizar.disabled = true;
        return;
    }
    
    const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace('R$&nbsp;', '').replace(',', '.')) || 10;
    const total = qtd * valorBilhete;
    console.log(document.getElementById('valor-bilhete').innerHTML);
    console.log(valorBilhete);
    
    let itensHtml = '';
    for (const num of carrinho) {
        itensHtml += `
            <div class="cart-item">
                <span class="cart-item-number">Nº ${num}</span>
                <button class="cart-item-remove" onclick="event.stopPropagation(); toggleCarrinho(${num})">✗ Remover</button>
            </div>
        `;
    }
    
    carrinhoItens.innerHTML = itensHtml;
    carrinhoTotal.textContent = formatarMoeda(total);
    btnFinalizar.disabled = false;
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
}

// ============================================
// EVENTOS
// ============================================

function configurarEventos() {
    
    // Compra
    document.getElementById('close-dados').onclick = () => {
        document.getElementById('modal-dados').style.display = 'none';
        document.getElementById('form-dados').reset();
    };
    
    document.getElementById('form-dados').onsubmit = async (e) => {
        e.preventDefault();
        await processarPagamentoMultiplo();
    };
    
    document.getElementById('close-pix').onclick = () => {
        document.getElementById('modal-pix').style.display = 'none';
        if (checkInterval) clearInterval(checkInterval);
    };
    
    document.getElementById('verificar-pagamento').onclick = () => {
        verificarStatusPagamento();
    };
    
    document.getElementById('copiar-codigo').onclick = () => {
        const codigo = document.getElementById('pix-code').textContent;
        navigator.clipboard.writeText(codigo);
        showToast("Código PIX copiado!", "success");
    };
    
    document.getElementById('btn-finalizar').onclick = () => {
        if (carrinho.length === 0) {
            showToast("Selecione pelo menos um número", "warning");
            return;
        }
        document.getElementById('modal-dados').style.display = 'flex';
    };
    
    // Fechar modais ao clicar fora
    window.onclick = (e) => {
        const modais = ['modal-dados', 'modal-pix', 'modal-admin-login', 'modal-admin-panel'];
        modais.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (e.target === modal) {
                modal.style.display = 'none';
                if (modalId === 'modal-pix' && checkInterval) clearInterval(checkInterval);
            }
        });
    };
}

// ============================================
// PAGAMENTO PIX
// ============================================

async function processarPagamentoMultiplo() {
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    let telefone = document.getElementById('telefone').value.trim();
    
    if (!nome || !email) {
        showToast("Preencha nome e e-mail", "warning");
        return;
    }
    
    // Limpar telefone (remover formatação)
    telefone = telefone.replace(/\D/g, "");
    if (telefone && telefone.length < 10) {
        showToast("Digite um telefone válido com DDD", "warning");
        return;
    }
    
    const btn = document.getElementById('btn-finalizar-pagamento');
    disableButton(btn, true);
    showLoading(true);
    
    try {
        const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace('R$&nbsp;', '').replace(',', '.')) || 10;
        const valorTotal = carrinho.length * valorBilhete;
        
        const numerosStr = carrinho.join(',');
        const url = `${API_URL}?action=createMultiPayment&numeros=${encodeURIComponent(numerosStr)}&comprador=${encodeURIComponent(nome)}&email=${encodeURIComponent(email)}&telefone=${encodeURIComponent(telefone)}&metodo=pix&valor_total=${valorTotal}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            currentPaymentId = result.paymentId;
            document.getElementById('modal-dados').style.display = 'none';
            document.getElementById('form-dados').reset();
            
            document.getElementById('qr-code').src = `data:image/png;base64,${result.pixCode}`;
            document.getElementById('pix-code').textContent = result.pixQrCode;
            document.getElementById('valor-pagar-pix').textContent = formatarMoeda(result.valor_total);
            document.getElementById('modal-pix').style.display = 'flex';
            
            carrinho = [];
            atualizarCarrinhoUI();
            renderizarNumeros();
            
            showToast(`Pagamento gerado! Total: ${formatarMoeda(result.valor_total)}`, "success");
            iniciarVerificacaoAutomatica();
        } else {
            showToast(result.error || "Erro ao processar pagamento", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro de conexão. Tente novamente.", "error");
    } finally {
        disableButton(btn, false, "💳 Gerar pagamento PIX");
        showLoading(false);
    }
}

function iniciarVerificacaoAutomatica() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
        verificarStatusPagamento();
    }, 5000);
}

async function verificarStatusPagamento() {
    if (!currentPaymentId) {
        console.log("Sem paymentId para verificar");
        return;
    }
    
    console.log(`Verificando pagamento: ${currentPaymentId}`);
    
    try {
        const response = await fetch(`${API_URL}?action=checkPayment&paymentId=${currentPaymentId}`);
        const result = await response.json();
        
        console.log("Resultado da verificação:", result);
        
        if (result.success) {
            const statusDiv = document.getElementById('status-pagamento');
            
            // VERIFICAR SE É APENAS "pendente" ou se realmente está "aprovado"
            if (result.status === 'aprovado' || result.status === 'approved') {
                statusDiv.innerHTML = '<span class="status-icon">✓</span> Pagamento confirmado! Números reservados.';
                statusDiv.style.background = "#e8f3ef";
                statusDiv.style.color = "#2e7d64";
                
                showToast("Pagamento confirmado! Obrigado pela contribuição!", "success");
                
                if (checkInterval) clearInterval(checkInterval);
                
                setTimeout(() => {
                    document.getElementById('modal-pix').style.display = 'none';
                    carregarNumeros();
                    carregarInformacoesRifa();
                    currentPaymentId = null;
                }, 3000);
            } 
            else if (result.status === 'pendente' || result.status === 'reservado') {
                statusDiv.innerHTML = '<span class="status-icon">⏳</span> Aguardando pagamento... Escaneie o QR Code ou copie o código PIX.';
                statusDiv.style.background = "#fff8e1";
                statusDiv.style.color = "#b76e2e";
            }
            else if (result.status === 'pending') {
                statusDiv.innerHTML = '<span class="status-icon">⏳</span> Pagamento pendente. Aguardando confirmação do banco...';
            }
            else {
                statusDiv.innerHTML = `<span class="status-icon">ℹ</span> Status: ${result.status}`;
            }
        } else {
            console.error("Erro na verificação:", result.error);
        }
    } catch (error) {
        console.error("Erro ao verificar pagamento:", error);
    }
}

function verificarPagamentoAposRetorno() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const paymentId = urlParams.get('payment_id');
    
    if (paymentSuccess === 'true' && paymentId) {
        currentPaymentId = paymentId;
        document.getElementById('cartao-status').innerHTML = '⏳ Aguardando confirmação...';
        document.getElementById('modal-cartao').style.display = 'flex';
        iniciarVerificacaoAutomatica();
        
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ============================================
// TIMEOUT DE 5 MINUTOS
// ============================================

let timerTimeout = null;
let tempoRestante = 300; // 5 minutos em segundos

function iniciarTimerPagamento() {
    if (timerTimeout) clearInterval(timerTimeout);
    
    tempoRestante = 300; // 5 minutos
    const statusDiv = document.getElementById('status-pagamento');
    
    timerTimeout = setInterval(() => {
        if (tempoRestante <= 0) {
            clearInterval(timerTimeout);
            statusDiv.innerHTML = '<span class="status-icon">⏰</span> Tempo esgotado! Pagamento cancelado.';
            statusDiv.style.background = "#fdefef";
            statusDiv.style.color = "#c44569";
            mostrarToast("Tempo para pagamento expirou! Os números voltaram a ficar disponíveis.", "warning");
            
            setTimeout(() => {
                document.getElementById('modal-pix').style.display = 'none';
                carregarNumeros();
                carregarInformacoesRifa();
            }, 3000);
        } else {
            const minutos = Math.floor(tempoRestante / 60);
            const segundos = tempoRestante % 60;
            statusDiv.innerHTML = `<span class="status-icon">⏳</span> Aguardando pagamento... ${minutos}:${segundos.toString().padStart(2, '0')} restantes`;
            tempoRestante--;
        }
    }, 1000);
}

// Modificar a função processarPagamentoMultiplo para iniciar o timer
async function processarPagamentoMultiplo() {
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    let telefone = document.getElementById('telefone').value.trim();
    
    if (!nome || !email) {
        mostrarToast("Preencha nome e e-mail", "warning");
        return;
    }
    
    telefone = telefone.replace(/\D/g, "");
    
    const btn = document.getElementById('btn-finalizar-pagamento');
    disableButton(btn, true);
    showLoading(true);
    
    try {
        const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace('R$&nbsp;', '').replace(',', '.')) || 10;
        const valorTotal = carrinho.length * valorBilhete;
        
        const numerosStr = carrinho.join(',');
        const url = `${API_URL}?action=createMultiPayment&numeros=${encodeURIComponent(numerosStr)}&comprador=${encodeURIComponent(nome)}&email=${encodeURIComponent(email)}&telefone=${encodeURIComponent(telefone)}&metodo=pix&valor_total=${valorTotal}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            currentPaymentId = result.paymentId;
            document.getElementById('modal-dados').style.display = 'none';
            document.getElementById('form-dados').reset();
            
            document.getElementById('qr-code').src = `data:image/png;base64,${result.pixCode}`;
            document.getElementById('pix-code').textContent = result.pixQrCode || result.pixCode;
            document.getElementById('valor-pagar-pix').textContent = formatarMoeda(result.valor_total);
            document.getElementById('modal-pix').style.display = 'flex';
            
            // INICIAR TIMER DE 5 MINUTOS
            iniciarTimerPagamento();
            
            carrinho = [];
            atualizarCarrinhoUI();
            renderizarNumeros();
            
            mostrarToast(`Pagamento gerado! Você tem 5 minutos para pagar. Total: ${formatarMoeda(result.valor_total)}`, "success");
            iniciarVerificacaoAutomatica();
        } else {
            mostrarToast(result.error || "Erro ao processar pagamento", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarToast("Erro de conexão. Tente novamente.", "error");
    } finally {
        disableButton(btn, false, "💳 Gerar pagamento PIX");
        showLoading(false);
    }
}

// Modificar a função verificarStatusPagamento para parar o timer quando pagar
async function verificarStatusPagamento() {
    if (!currentPaymentId) return;
    
    try {
        const response = await fetch(`${API_URL}?action=checkPayment&paymentId=${currentPaymentId}`);
        const result = await response.json();
        
        if (result.success) {
            const statusDiv = document.getElementById('status-pagamento');
            
            if (result.status === 'approved' || result.status === 'aprovado') {
                // PARAR O TIMER
                if (timerTimeout) clearInterval(timerTimeout);
                
                statusDiv.innerHTML = '<span class="status-icon">✓</span> Pagamento confirmado! Números reservados.';
                statusDiv.style.background = "#e8f3ef";
                statusDiv.style.color = "#2e7d64";
                
                mostrarToast("Pagamento confirmado! Obrigado pela contribuição!", "success");
                
                if (checkInterval) clearInterval(checkInterval);
                
                setTimeout(() => {
                    document.getElementById('modal-pix').style.display = 'none';
                    carregarNumeros();
                    carregarInformacoesRifa();
                    currentPaymentId = null;
                }, 3000);
            } 
            else if (result.status === 'cancelled' || result.status === 'cancelado') {
                if (timerTimeout) clearInterval(timerTimeout);
                statusDiv.innerHTML = '<span class="status-icon">✗</span> Pagamento cancelado.';
                statusDiv.style.background = "#fdefef";
                statusDiv.style.color = "#c44569";
                
                setTimeout(() => {
                    document.getElementById('modal-pix').style.display = 'none';
                    carregarNumeros();
                    carregarInformacoesRifa();
                }, 2000);
            }
            else if (result.status === 'pending') {
                // O timer já está rodando, não precisa fazer nada
            }
        }
    } catch (error) {
        console.error("Erro ao verificar pagamento:", error);
    }
}

// Função para cancelar pagamentos expirados (chamar a cada minuto)
async function verificarPagamentosExpirados() {
    try {
        const response = await fetch(`${API_URL}?action=cancelExpiredPayments`);
        const result = await response.json();
        if (result.success && result.cancelados > 0) {
            console.log(`${result.cancelados} pagamentos expirados cancelados`);
            await carregarNumeros();
            await carregarInformacoesRifa();
        }
    } catch (error) {
        console.error("Erro ao verificar pagamentos expirados:", error);
    }
}

// Chamar verificação de expirados a cada minuto
setInterval(() => {
    verificarPagamentosExpirados();
}, 60000); // 1 minuto