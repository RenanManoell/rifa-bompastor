// ============================================
// SISTEMA DE RIFA - SEU BOM PASTOR
// VERSÃO FINAL - COM TIMEOUT E MENSAGENS
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycbw6bLdf_Rt45EXOmaRJrDQZ-kyoc-gQ7HJarDA6uUvAf-mHVBSwvCWcLpvcCyCqez6J/exec";
// Variáveis do Mercado Pago
let mp = null;
let cardForm = null;
let currentAmount = 0;

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
    const metodo = validarMetodoPagamento();
    
    if (!metodo) return;
    if (!nome || !email) {
        showToast("Preencha nome e e-mail", "warning");
        return;
    }
    
    telefone = telefone.replace(/\D/g, "");
    
    const btn = document.getElementById('btn-finalizar-pagamento');
    disableButton(btn, true);
    showLoading(true);
    
    try {
        const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace(/[^0-9,]/g, '').replace(',', '.')) || 10;
        currentAmount = carrinho.length * valorBilhete;
        const numerosStr = carrinho.join(',');
        
        const url = `${API_URL}?action=createMultiPayment&numeros=${encodeURIComponent(numerosStr)}&comprador=${encodeURIComponent(nome)}&email=${encodeURIComponent(email)}&telefone=${encodeURIComponent(telefone)}&metodo=${metodo}&valor_total=${currentAmount}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            currentPaymentId = result.paymentId;
            document.getElementById('modal-dados').style.display = 'none';
            document.getElementById('form-dados').reset();
            
            if (metodo === 'pix') {
                // PIX: mostra QR Code
                document.getElementById('qr-code').src = `data:image/png;base64,${result.pixCode}`;
                document.getElementById('pix-code').textContent = result.pixQrCode || result.pixCode;
                document.getElementById('valor-pagar-pix').textContent = formatarMoeda(result.valor_total);
                
                limparModalPix();
                document.getElementById('modal-pix').style.display = 'flex';
                iniciarTimerPagamento();
                iniciarVerificacaoAutomatica();
                
                showToast(`Pagamento PIX gerado! Total: ${formatarMoeda(result.valor_total)}`, "success");
            } else {
                // CARTÃO: abre modal com formulário
                atualizarParcelas(currentAmount);
                document.getElementById('modal-cartao').style.display = 'flex';
                
                // Inicializar Mercado Pago
                iniciarMercadoPago();
            }
            
            carrinho = [];
            atualizarCarrinhoUI();
            renderizarNumeros();
            
        } else {
            showToast(result.error || "Erro ao processar pagamento", "error");
        }
    } catch (error) {
        showToast("Erro de conexão. Tente novamente.", "error");
    } finally {
        disableButton(btn, false, "💳 Gerar pagamento");
        showLoading(false);
    }
}

// ============================================
// CHECKOUT TRANSPARENTE - CARTÃO
// ============================================

function iniciarMercadoPago() {
    // Public Key do Mercado Pago (coloque a sua)
    const publicKey = 'APP_USR-5f9067e1-6b8d-4ad6-8be5-e45da73b1660';
    
    if (!mp) {
        mp = new MercadoPago(publicKey, {
            locale: 'pt-BR'
        });
    }
}
async function processarPagamentoCartao() {
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const cardExpiry = document.getElementById('cardExpiry').value;
    const cardCvv = document.getElementById('cardCvv').value;
    const cardHolder = document.getElementById('cardHolder').value;
    const cardDocument = document.getElementById('cardDocument').value.replace(/\D/g, '');
    const installments = parseInt(document.getElementById('installments').value);
    
    // Validações
    if (!cardNumber || cardNumber.length < 13) {
        showToast("Número do cartão inválido", "warning");
        return;
    }
    
    if (!cardExpiry || !cardExpiry.includes('/')) {
        showToast("Data de validade inválida (MM/AA)", "warning");
        return;
    }
    
    if (!cardCvv || cardCvv.length < 3) {
        showToast("CVV inválido", "warning");
        return;
    }
    
    if (!cardHolder) {
        showToast("Nome do titular é obrigatório", "warning");
        return;
    }
    
    if (!cardDocument || cardDocument.length !== 11) {
        showToast("CPF inválido (11 dígitos)", "warning");
        return;
    }
    
    const [expMonth, expYear] = cardExpiry.split('/');
    
    const btn = document.getElementById('btn-pagar-cartao');
    const loading = document.getElementById('cartao-loading');
    const form = document.getElementById('form-cartao');
    
    btn.disabled = true;
    form.style.display = 'none';
    loading.style.display = 'block';
    
    try {
        iniciarMercadoPago();
        
        // CORREÇÃO: Criar token com os parâmetros corretos
        const cardToken = await mp.fields.createCardToken({
            cardNumber: cardNumber,
            cardholderName: cardHolder,
            identificationType: 'CPF',
            identificationNumber: cardDocument,
            securityCode: cardCvv,
            expirationMonth: expMonth,
            expirationYear: expYear
        });
        
        // Aguardar o token ser gerado
        const token = await cardToken.getToken();
        const tokenId = token.id;
        
        if (!tokenId) {
            throw new Error("Não foi possível gerar o token do cartão");
        }
        
        console.log("Token gerado:", tokenId);
        
        // Enviar para o backend (SEM payment_method_id - o MP detecta automaticamente)
        const url = `${API_URL}?action=processCardPayment&paymentId=${currentPaymentId}&token=${tokenId}&installments=${installments}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            showToast("✅ Pagamento aprovado! Enviando e-mail de confirmação...", "success");
            
            const modalContent = document.querySelector('#modal-cartao .modal-content');
            const formContainer = document.getElementById('form-cartao');
            const loadingContainer = document.getElementById('cartao-loading');
            
            if (formContainer) formContainer.style.display = 'none';
            if (loadingContainer) loadingContainer.style.display = 'none';
            
            const successDiv = document.createElement('div');
            successDiv.className = 'status-confirmado';
            successDiv.innerHTML = `
                <span style="font-size: 48px;">✅</span>
                <h3>Pagamento Confirmado!</h3>
                <p>Enviamos um e-mail de confirmação.</p>
                <p style="margin-top: 10px;">Agradecemos sua contribuição!</p>
            `;
            modalContent.appendChild(successDiv);
            
            setTimeout(() => {
                document.getElementById('modal-cartao').style.display = 'none';
                carregarNumeros();
                carregarInformacoesRifa();
                currentPaymentId = null;
                successDiv.remove();
                if (formContainer) formContainer.style.display = 'block';
            }, 4000);
        } else {
            showToast(result.error || "Erro ao processar pagamento", "error");
            form.style.display = 'block';
            loading.style.display = 'none';
        }
    } catch (error) {
        console.error("Erro no processamento do cartão:", error);
        showToast(error.message || "Erro ao processar cartão. Verifique os dados.", "error");
        form.style.display = 'block';
        loading.style.display = 'none';
    } finally {
        btn.disabled = false;
    }
}

// Função para detectar a bandeira do cartão
function detectarBandeira(cardNumber) {
    const num = cardNumber.replace(/\s/g, '');
    const firstDigit = num.charAt(0);
    const firstTwo = num.substring(0, 2);
    const firstFour = num.substring(0, 4);
    
    // Visa
    if (firstDigit === '4') return 'visa';
    
    // Mastercard
    if (firstTwo >= '51' && firstTwo <= '55') return 'master';
    if (firstTwo >= '22' && firstTwo <= '27') return 'master';
    
    // American Express
    if (firstTwo === '34' || firstTwo === '37') return 'amex';
    
    // Elo
    if (firstFour === '4011' || firstFour === '4389' || firstFour === '4514' || firstFour === '5045') return 'elo';
    if (firstTwo === '50' || firstTwo === '52' || firstTwo === '53' || firstTwo === '54' || firstTwo === '55') return 'elo';
    if (firstTwo === '63' || firstTwo === '64') return 'elo';
    
    // Hipercard
    if (firstTwo === '38' || firstTwo === '60') return 'hipercard';
    
    // Padrão
    return 'visa';
}

// Eventos de máscara para o formulário de cartão
function configurarMascarasCartao() {
    const cardNumberInput = document.getElementById('cardNumber');
    const cardExpiryInput = document.getElementById('cardExpiry');
    const cardDocumentInput = document.getElementById('cardDocument');
    
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            this.value = formatCardNumber(this.value);
        });
    }
    
    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', function(e) {
            this.value = formatExpiry(this.value);
        });
    }
    
    if (cardDocumentInput) {
        cardDocumentInput.addEventListener('input', function(e) {
            this.value = formatCPF(this.value);
        });
    }
}

// Registrar evento do formulário de cartão
document.addEventListener('DOMContentLoaded', function() {
    configurarMascarasCartao();
    
    const formCartao = document.getElementById('form-cartao');
    if (formCartao) {
        formCartao.onsubmit = async (e) => {
            e.preventDefault();
            await processarPagamentoCartao();
        };
    }
    
    const closeCartao = document.getElementById('close-cartao-modal');
    if (closeCartao) {
        closeCartao.onclick = () => {
            document.getElementById('modal-cartao').style.display = 'none';
            // Resetar formulário
            document.getElementById('form-cartao').style.display = 'block';
            document.getElementById('cartao-loading').style.display = 'none';
            document.getElementById('form-cartao').reset();
        };
    }
});

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

// ============================================
// FORMATAÇÃO DE CARTÃO E CPF
// ============================================

function formatCardNumber(value) {
    let numbers = value.replace(/\D/g, "");
    numbers = numbers.substring(0, 16);
    let formatted = "";
    for (let i = 0; i < numbers.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += " ";
        formatted += numbers[i];
    }
    return formatted;
}

function formatExpiry(value) {
    let numbers = value.replace(/\D/g, "");
    if (numbers.length >= 2) {
        return numbers.substring(0, 2) + "/" + numbers.substring(2, 4);
    }
    return numbers;
}

function formatCPF(value) {
    let numbers = value.replace(/\D/g, "");
    numbers = numbers.substring(0, 11);
    if (numbers.length > 9) {
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (numbers.length > 6) {
        return numbers.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
    } else if (numbers.length > 3) {
        return numbers.replace(/(\d{3})(\d{3})/, "$1.$2");
    }
    return numbers;
}

// ============================================
// CALCULAR PARCELAS
// ============================================

function calcularParcelas(valor) {
    const parcelas = [
        { num: 1, taxa: 0, descricao: "1x sem juros" },
        { num: 2, taxa: 2.5, descricao: "2x com juros de 2,5%" },
        { num: 3, taxa: 3.5, descricao: "3x com juros de 3,5%" },
        { num: 4, taxa: 4.5, descricao: "4x com juros de 4,5%" },
        { num: 5, taxa: 5.5, descricao: "5x com juros de 5,5%" },
        { num: 6, taxa: 6.5, descricao: "6x com juros de 6,5%" }
    ];
    
    return parcelas.map(p => {
        let valorParcela = valor;
        if (p.taxa > 0) {
            valorParcela = valor * (1 + p.taxa / 100);
        }
        const valorFormatado = (valorParcela / p.num).toFixed(2);
        return {
            num: p.num,
            valor: valorFormatado,
            descricao: `${p.num}x de R$ ${valorFormatado.replace('.', ',')} ${p.taxa > 0 ? '(com juros)' : '(sem juros)'}`
        };
    });
}

function atualizarParcelas(valor) {
    const parcelas = calcularParcelas(valor);
    const select = document.getElementById('installments');
    if (select) {
        select.innerHTML = parcelas.map(p => 
            `<option value="${p.num}">${p.descricao}</option>`
        ).join('');
    }
}