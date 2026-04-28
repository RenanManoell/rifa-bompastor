// ============================================
// SISTEMA DE RIFA - SEU BOM PASTOR
// VERSÃO FINAL COM LOADING E MÁSCARA
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycbw6bLdf_Rt45EXOmaRJrDQZ-kyoc-gQ7HJarDA6uUvAf-mHVBSwvCWcLpvcCyCqez6J/exec";
const ADMIN_SENHA = "bompastor2024";

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
    
    const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace('R$', '').replace(',', '.')) || 10;
    const total = qtd * valorBilhete;
    
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
    // Admin
    document.getElementById('btn-admin').onclick = () => {
        document.getElementById('modal-admin-login').style.display = 'flex';
    };
    
    document.getElementById('close-admin-login').onclick = () => {
        document.getElementById('modal-admin-login').style.display = 'none';
        document.getElementById('admin-senha').value = '';
    };
    
    document.getElementById('btn-login-admin').onclick = () => {
        const senha = document.getElementById('admin-senha').value;
        if (senha === ADMIN_SENHA) {
            document.getElementById('modal-admin-login').style.display = 'none';
            abrirPainelAdmin();
        } else {
            showToast("Senha incorreta", "error");
        }
    };
    
    document.getElementById('close-admin-panel').onclick = () => {
        document.getElementById('modal-admin-panel').style.display = 'none';
    };
    
    document.getElementById('refresh-admin').onclick = () => {
        carregarDadosAdmin();
    };
    
    document.getElementById('btn-buscar').onclick = () => {
        buscarNumeroAdmin();
    };
    
    document.getElementById('btn-vender-manual').onclick = () => {
        venderNumeroManual();
    };
    
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
// ADMIN
// ============================================

async function abrirPainelAdmin() {
    document.getElementById('modal-admin-panel').style.display = 'flex';
    await carregarDadosAdmin();
}

async function carregarDadosAdmin() {
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=getRifaInfo`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const total = data.total_numeros || 100;
            const vendidos = data.vendidos || 0;
            const disponiveis = data.disponiveis || 0;
            const valor = data.valor_bilhete || 10;
            
            document.getElementById('admin-total').textContent = total;
            document.getElementById('admin-disponiveis').textContent = disponiveis;
            document.getElementById('admin-vendidos').textContent = vendidos;
            document.getElementById('admin-arrecadado').textContent = formatarMoeda(vendidos * valor);
        }
        
        await carregarUltimasVendas();
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar dados admin", "error");
    } finally {
        showLoading(false);
    }
}

async function carregarUltimasVendas() {
    try {
        const response = await fetch(`${API_URL}?action=getNumbers`);
        const result = await response.json();
        
        if (result.success) {
            const ocupados = result.ocupados || [];
            const ultimas = ocupados.slice(-10).reverse();
            
            const container = document.getElementById('ultimas-vendas-lista');
            if (ultimas.length === 0) {
                container.innerHTML = '<div class="cart-empty">Nenhuma venda registrada</div>';
            } else {
                let html = '';
                for (const venda of ultimas) {
                    html += `
                        <div class="sale-item">
                            <span class="sale-number">Nº ${venda.numero}</span>
                            <span class="sale-buyer">${venda.comprador || 'Desconhecido'}</span>
                            <span style="color:${venda.status === 'pago' ? '#2e7d64' : '#e6b12e'}; font-size:11px;">
                                ${venda.status === 'pago' ? '✓ Pago' : '⏳ Pendente'}
                            </span>
                        </div>
                    `;
                }
                container.innerHTML = html;
            }
        }
    } catch (error) {
        console.error(error);
    }
}

async function buscarNumeroAdmin() {
    const numero = document.getElementById('buscar-numero').value;
    if (!numero) {
        showToast("Digite um número para buscar", "warning");
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=getNumbers`);
        const result = await response.json();
        
        if (result.success) {
            const disponiveis = result.disponiveis || [];
            const ocupados = result.ocupados || [];
            
            const disponivel = disponiveis.includes(parseInt(numero));
            const ocupado = ocupados.find(o => o.numero == numero);
            
            const resultadoDiv = document.getElementById('resultado-busca');
            resultadoDiv.style.display = 'block';
            
            if (disponivel) {
                resultadoDiv.innerHTML = `<span style="color:#2e7d64;">✓ Número ${numero} está disponível para venda</span>`;
                resultadoDiv.style.background = "#e8f3ef";
            } else if (ocupado) {
                resultadoDiv.innerHTML = `<span style="color:#c44569;">✗ Número ${numero} vendido para ${ocupado.comprador || 'desconhecido'}</span>`;
                resultadoDiv.style.background = "#fdefef";
            } else {
                resultadoDiv.innerHTML = `<span style="color:#e6b12e;">⚠ Número ${numero} não encontrado</span>`;
                resultadoDiv.style.background = "#fef5e6";
            }
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao buscar número", "error");
    } finally {
        showLoading(false);
    }
}

async function venderNumeroManual() {
    const numero = document.getElementById('venda-numero').value;
    const nome = document.getElementById('venda-nome').value;
    const email = document.getElementById('venda-email').value;
    const telefone = document.getElementById('venda-telefone').value;
    
    if (!numero || !nome || !email) {
        showToast("Preencha número, nome e e-mail", "warning");
        return;
    }
    
    const btn = document.getElementById('btn-vender-manual');
    disableButton(btn, true);
    showLoading(true);
    
    try {
        const url = `${API_URL}?action=createPayment&numero=${numero}&comprador=${encodeURIComponent(nome)}&email=${encodeURIComponent(email)}&telefone=${encodeURIComponent(telefone)}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            showToast(`Venda do número ${numero} registrada para ${nome}`, "success");
            
            document.getElementById('venda-numero').value = '';
            document.getElementById('venda-nome').value = '';
            document.getElementById('venda-email').value = '';
            document.getElementById('venda-telefone').value = '';
            
            await carregarDadosAdmin();
            await carregarNumeros();
            await carregarInformacoesRifa();
        } else {
            showToast(result.error || "Erro ao registrar venda", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro de conexão", "error");
    } finally {
        disableButton(btn, false, "Registrar venda");
        showLoading(false);
    }
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
        const valorBilhete = parseFloat(document.getElementById('valor-bilhete').innerHTML.replace('R$', '').replace(',', '.')) || 10;
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
    if (!currentPaymentId) return;
    
    try {
        const response = await fetch(`${API_URL}?action=checkPayment&paymentId=${currentPaymentId}`);
        const result = await response.json();
        
        if (result.success) {
            const statusDiv = document.getElementById('status-pagamento');
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
                }, 3000);
            } else if (result.status === 'pendente') {
                statusDiv.innerHTML = '<span class="status-icon">⏳</span> Aguardando pagamento...';
            } else {
                statusDiv.innerHTML = `<span class="status-icon">ℹ</span> Status: ${result.status}`;
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
        document.getElementById('cartao-status').innerHTML = '⏳ Aguardando confirmação...';
        document.getElementById('modal-cartao').style.display = 'flex';
        iniciarVerificacaoAutomatica();
        
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}