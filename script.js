// ============================================
// SISTEMA DE RIFA - SEU BOM PASTOR
// VERSÃO FINAL - COM TIMEOUT E MENSAGENS
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycbw6bLdf_Rt45EXOmaRJrDQZ-kyoc-gQ7HJarDA6uUvAf-mHVBSwvCWcLpvcCyCqez6J/exec";

// Estado global
let numerosDisponiveis = [];
let carrinho = [];
let currentPaymentId = null;
let checkInterval = null;
let currentFilter = "all";

// Timer do pagamento
let timerTimeout = null;
let tempoRestante = 300; // 5 minutos

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
    }, 4000);
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

// Estilo para botão loading
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
    .qr-area { text-align: center; margin: 15px 0; }
    .qr-area img { max-width: 200px; border-radius: 12px; }
    .status-confirmado { background: #e8f3ef; color: #2e7d64; padding: 15px; border-radius: 12px; text-align: center; }
    .status-cancelado { background: #fdefef; color: #c44569; padding: 15px; border-radius: 12px; text-align: center; }
`;
document.head.appendChild(btnLoadingStyle);

// ============================================
// MÁSCARA DE TELEFONE
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
    input.value = formatPhone(rawValue.slice(0, 13));
}

function initPhoneMasks() {
    const phoneInputs = document.querySelectorAll(".phone-mask");
    phoneInputs.forEach(input => {
        input.addEventListener("input", () => applyPhoneMask(input));
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
    initFilters();
    
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
        const response = await fetch(`${API_URL}?action=getRifaInfo&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            document.getElementById('total-numeros').textContent = data.total_numeros || 100;
            document.getElementById('disponiveis').textContent = data.disponiveis || 0;
            document.getElementById('vendidos').textContent = data.vendidos || 0;
            document.getElementById('valor-bilhete').innerHTML = formatarMoeda(data.valor_bilhete || 10);
            document.getElementById('data-sorteio').textContent = data.data_sorteio || 'Dia das Mães - Maio 2025';
            
            const percentual = data.total_numeros ? (data.vendidos / data.total_numeros) * 100 : 0;
            document.getElementById('progress-fill').style.width = `${percentual}%`;
            document.getElementById('percentual-vendido').textContent = `${Math.round(percentual)}%`;
        }
    } catch (error) {
        showToast("Erro ao carregar informações", "error");
    } finally {
        showLoading(false);
    }
}

async function carregarNumeros() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.success) {
            numerosDisponiveis = result.disponiveis || [];
            renderizarNumeros();
        }
    } catch (error) {
        showToast("Erro ao carregar números", "error");
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
        
        html += `<div class="numero-card ${statusClass}" onclick="toggleCarrinho(${i})">
                    <span class="numero-valor">${i}</span>
                    <span class="numero-status">${statusText}</span>
                </div>`;
    }
    
    grid.innerHTML = html || '<div class="loading-grid">Nenhum número encontrado</div>';
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
    
    const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace(/[^0-9,]/g, '').replace(',', '.')) || 10;
    const total = qtd * valorBilhete;
    
    let itensHtml = '';
    for (const num of carrinho) {
        itensHtml += `<div class="cart-item">
                        <span class="cart-item-number">Nº ${num}</span>
                        <button class="cart-item-remove" onclick="event.stopPropagation(); toggleCarrinho(${num})">✗ Remover</button>
                    </div>`;
    }
    
    carrinhoItens.innerHTML = itensHtml;
    carrinhoTotal.textContent = formatarMoeda(total);
    btnFinalizar.disabled = false;
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
}

// ============================================
// TIMER E PAGAMENTO
// ============================================

function iniciarTimerPagamento() {
    if (timerTimeout) clearInterval(timerTimeout);
    tempoRestante = 300;
    
    timerTimeout = setInterval(() => {
        if (tempoRestante <= 0) {
            clearInterval(timerTimeout);
            clearInterval(checkInterval);
            
            // Mostrar mensagem de cancelamento no modal
            const modalContent = document.querySelector('#modal-pix .modal-content');
            const qrArea = document.querySelector('.qr-area');
            const copyArea = document.querySelector('.copy-area');
            const pixValue = document.querySelector('.pix-value');
            const verifyBtn = document.getElementById('verificar-pagamento');
            
            if (qrArea) qrArea.style.display = 'none';
            if (copyArea) copyArea.style.display = 'none';
            if (pixValue) pixValue.style.display = 'none';
            if (verifyBtn) verifyBtn.style.display = 'none';
            
            const statusDiv = document.getElementById('status-pagamento');
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div class="status-cancelado">
                        <span style="font-size: 48px;">⏰</span>
                        <h3>Tempo esgotado!</h3>
                        <p>O prazo de 5 minutos para pagamento expirou.</p>
                        <p>Os números voltaram a ficar disponíveis para compra.</p>
                        <p style="margin-top: 10px; font-size: 12px;">Você pode selecioná-los novamente.</p>
                    </div>
                `;
            }
            
            showToast("Tempo esgotado! Os números voltaram a ficar disponíveis.", "warning");
            
            setTimeout(() => {
                document.getElementById('modal-pix').style.display = 'none';
                carregarNumeros();
                carregarInformacoesRifa();
                currentPaymentId = null;
                // Restaurar elementos para próxima vez
                if (qrArea) qrArea.style.display = 'block';
                if (copyArea) copyArea.style.display = 'flex';
                if (pixValue) pixValue.style.display = 'block';
                if (verifyBtn) verifyBtn.style.display = 'block';
            }, 5000);
        } else {
            const minutos = Math.floor(tempoRestante / 60);
            const segundos = tempoRestante % 60;
            const statusDiv = document.getElementById('status-pagamento');
            if (statusDiv && !statusDiv.innerHTML.includes('class="status-confirmado"') && !statusDiv.innerHTML.includes('status-cancelado')) {
                statusDiv.innerHTML = `<span class="status-icon">⏳</span> Aguardando pagamento... ${minutos}:${segundos.toString().padStart(2, '0')} restantes`;
            }
            tempoRestante--;
        }
    }, 1000);
}

function mostrarConfirmacaoEmail(numeros, email) {
    const modalContent = document.querySelector('#modal-pix .modal-content');
    const qrArea = document.querySelector('.qr-area');
    const copyArea = document.querySelector('.copy-area');
    const pixValue = document.querySelector('.pix-value');
    const verifyBtn = document.getElementById('verificar-pagamento');
    
    if (qrArea) qrArea.style.display = 'none';
    if (copyArea) copyArea.style.display = 'none';
    if (pixValue) pixValue.style.display = 'none';
    if (verifyBtn) verifyBtn.style.display = 'none';
    
    const numerosStr = Array.isArray(numeros) ? numeros.join(", ") : numeros;
    const statusDiv = document.getElementById('status-pagamento');
    
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="status-confirmado">
                <span style="font-size: 48px;">📧</span>
                <h3>Pagamento Confirmado!</h3>
                <p><strong>Números: ${numerosStr}</strong></p>
                <p>Enviamos um e-mail de confirmação para:</p>
                <p><strong>${email}</strong></p>
                <p style="margin-top: 10px;">Verifique sua caixa de entrada ou spam.</p>
                <p style="margin-top: 15px; font-size: 12px;">Agradecemos sua contribuição! 🙏</p>
            </div>
        `;
    }
    
    showToast(`Pagamento confirmado! E-mail enviado para ${email}`, "success");
}

function mostrarCancelamentoExpirado() {
    const modalContent = document.querySelector('#modal-pix .modal-content');
    const qrArea = document.querySelector('.qr-area');
    const copyArea = document.querySelector('.copy-area');
    const pixValue = document.querySelector('.pix-value');
    const verifyBtn = document.getElementById('verificar-pagamento');
    
    if (qrArea) qrArea.style.display = 'none';
    if (copyArea) copyArea.style.display = 'none';
    if (pixValue) pixValue.style.display = 'none';
    if (verifyBtn) verifyBtn.style.display = 'none';
    
    const statusDiv = document.getElementById('status-pagamento');
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="status-cancelado">
                <span style="font-size: 48px;">⏰</span>
                <h3>Pagamento Cancelado</h3>
                <p>O tempo para realizar o pagamento expirou.</p>
                <p>Os números voltaram a ficar disponíveis para compra.</p>
            </div>
        `;
    }
}

function limparModalPix() {
    const qrArea = document.querySelector('.qr-area');
    const copyArea = document.querySelector('.copy-area');
    const pixValue = document.querySelector('.pix-value');
    const verifyBtn = document.getElementById('verificar-pagamento');
    
    if (qrArea) qrArea.style.display = 'block';
    if (copyArea) copyArea.style.display = 'flex';
    if (pixValue) pixValue.style.display = 'block';
    if (verifyBtn) verifyBtn.style.display = 'block';
    
    const statusDiv = document.getElementById('status-pagamento');
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="status-icon">⏳</span> Aguardando pagamento...';
        statusDiv.style.background = "#fff8e1";
        statusDiv.style.color = "#b76e2e";
    }
}

// ============================================
// EVENTOS
// ============================================

function configurarEventos() {
    // ADICIONAR ESTILO VISUAL AOS BOTÕES DE MÉTODO DE PAGAMENTO
    const metodoOptions = document.querySelectorAll('.metodo-option');
    metodoOptions.forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        if (radio) {
            radio.addEventListener('change', function() {
                metodoOptions.forEach(opt => opt.classList.remove('selected'));
                if (this.checked) {
                    option.classList.add('selected');
                }
            });
            // Se já estiver marcado, adiciona a classe
            if (radio.checked) {
                option.classList.add('selected');
            }
        }
    });
    
    // Resto do código existente...
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
        if (timerTimeout) clearInterval(timerTimeout);
        limparModalPix();
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
        const modais = ['modal-dados', 'modal-pix', 'modal-cartao'];
        modais.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (e.target === modal) {
                modal.style.display = 'none';
                if (modalId === 'modal-pix') {
                    if (checkInterval) clearInterval(checkInterval);
                    if (timerTimeout) clearInterval(timerTimeout);
                    limparModalPix();
                }
            }
        });
    };
    
    // Fechar modal cartão
    const closeCartao = document.getElementById('close-cartao');
    if (closeCartao) {
        closeCartao.onclick = () => {
            document.getElementById('modal-cartao').style.display = 'none';
        };
    }
}

// ============================================
// PAGAMENTO
// ============================================

async function processarPagamentoMultiplo() {
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    let telefone = document.getElementById('telefone').value.trim();
    
    // VALIDAR SE O MÉTODO DE PAGAMENTO FOI SELECIONADO
    const metodo = validarMetodoPagamento();
    if (!metodo) {
        return; // Impede prosseguir se não selecionou
    }
    
    if (!nome || !email) {
        showToast("Preencha nome e e-mail", "warning");
        return;
    }
    
    telefone = telefone.replace(/\D/g, "");
    if (telefone && telefone.length < 10) {
        showToast("Digite um telefone válido com DDD", "warning");
        return;
    }
    
    const btn = document.getElementById('btn-finalizar-pagamento');
    disableButton(btn, true);
    showLoading(true);
    
    try {
        const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace(/[^0-9,]/g, '').replace(',', '.')) || 10;
        const valorTotal = carrinho.length * valorBilhete;
        const numerosStr = carrinho.join(',');
        
        const url = `${API_URL}?action=createMultiPayment&numeros=${encodeURIComponent(numerosStr)}&comprador=${encodeURIComponent(nome)}&email=${encodeURIComponent(email)}&telefone=${encodeURIComponent(telefone)}&metodo=${metodo}&valor_total=${valorTotal}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            currentPaymentId = result.paymentId;
            document.getElementById('modal-dados').style.display = 'none';
            document.getElementById('form-dados').reset();
            
            // Resetar seleção de método para a próxima vez
            document.querySelectorAll('input[name="metodo"]').forEach(radio => radio.checked = false);
            document.querySelector('input[value="pix"]').checked = true; // Padrão PIX
            
            if (metodo === 'pix') {
                // PIX: mostra QR Code
                document.getElementById('qr-code').src = `data:image/png;base64,${result.pixCode}`;
                document.getElementById('pix-code').textContent = result.pixQrCode || result.pixCode;
                document.getElementById('valor-pagar-pix').textContent = formatarMoeda(result.valor_total);
                
                limparModalPix();
                document.getElementById('modal-pix').style.display = 'flex';
                iniciarTimerPagamento();
                iniciarVerificacaoAutomatica();
                
                showToast(`Pagamento PIX gerado! Você tem 5 minutos para pagar. Total: ${formatarMoeda(result.valor_total)}`, "success");
            } else {
                // CARTÃO: redireciona para o link do Mercado Pago
                if (result.payment_link) {
                    showToast(`Redirecionando para pagamento com cartão...`, "info");
                    // Salvar dados para recuperar depois
                    sessionStorage.setItem('compra_pendente', JSON.stringify({
                        paymentId: result.paymentId,
                        numeros: carrinho,
                        valor_total: result.valor_total
                    }));
                    // Redirecionar para o link do Mercado Pago
                    window.location.href = result.payment_link;
                } else {
                    showToast("Erro ao gerar link de pagamento", "error");
                }
            }
            
            const numerosComprados = [...carrinho];
            carrinho = [];
            atualizarCarrinhoUI();
            renderizarNumeros();
            
        } else {
            showToast(result.error || "Erro ao processar pagamento", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro de conexão. Tente novamente.", "error");
    } finally {
        disableButton(btn, false, "💳 Gerar pagamento");
        showLoading(false);
    }
}

// ============================================
// VALIDAÇÃO DO MÉTODO DE PAGAMENTO
// ============================================

function validarMetodoPagamento() {
    const metodoSelecionado = document.querySelector('input[name="metodo"]:checked');
    if (!metodoSelecionado) {
        showToast("Por favor, selecione uma forma de pagamento: PIX ou Cartão", "warning");
        return null;
    }
    return metodoSelecionado.value;
}

function iniciarVerificacaoAutomatica() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
        verificarStatusPagamento();
    }, 4000);
}

async function verificarStatusPagamento() {
    if (!currentPaymentId) return;
    
    try {
        const response = await fetch(`${API_URL}?action=checkPayment&paymentId=${currentPaymentId}&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.success) {
            if (result.status === 'aprovado' || result.status === 'approved') {
                // Parar timers
                if (timerTimeout) clearInterval(timerTimeout);
                if (checkInterval) clearInterval(checkInterval);
                
                // Mostrar mensagem de confirmação com email
                const email = document.getElementById('email')?.value || '';
                mostrarConfirmacaoEmail(result.numero || carrinho, email);
                
                setTimeout(() => {
                    document.getElementById('modal-pix').style.display = 'none';
                    limparModalPix();
                    carregarNumeros();
                    carregarInformacoesRifa();
                    currentPaymentId = null;
                }, 6000);
            }
            else if (result.status === 'cancelado' || result.status === 'cancelled') {
                if (timerTimeout) clearInterval(timerTimeout);
                if (checkInterval) clearInterval(checkInterval);
                
                mostrarCancelamentoExpirado();
                
                setTimeout(() => {
                    document.getElementById('modal-pix').style.display = 'none';
                    limparModalPix();
                    carregarNumeros();
                    carregarInformacoesRifa();
                    currentPaymentId = null;
                }, 4000);
            }
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
        
        // Recuperar dados da compra pendente
        const compraPendente = sessionStorage.getItem('compra_pendente');
        if (compraPendente) {
            const dados = JSON.parse(compraPendente);
            currentPaymentId = dados.paymentId;
            sessionStorage.removeItem('compra_pendente');
        }
        
        // Mostrar modal de aguardando confirmação
        const modalCartao = document.getElementById('modal-cartao');
        if (modalCartao) {
            document.getElementById('cartao-status').innerHTML = '⏳ Aguardando confirmação do pagamento...';
            modalCartao.style.display = 'flex';
        }
        
        iniciarVerificacaoAutomatica();
        
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}