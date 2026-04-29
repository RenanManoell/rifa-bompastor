// ============================================
// PAINEL ADMINISTRATIVO
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycbw6bLdf_Rt45EXOmaRJrDQZ-kyoc-gQ7HJarDA6uUvAf-mHVBSwvCWcLpvcCyCqez6J/exec";

let currentTab = "dashboard";
let progressChart = null;
let arrecadacaoChart = null;

// Elementos DOM
const globalLoading = document.getElementById("globalLoading");
const toastContainer = document.getElementById("toastContainer");

function showLoading(show) {
    if (show) globalLoading.classList.add("active");
    else globalLoading.classList.remove("active");
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === "success" ? "✓" : "✗"}</span> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar se está logado
    const isLoggedIn = sessionStorage.getItem("admin_logged_in");
    if (!isLoggedIn) {
        const senha = prompt("Digite a senha de administrador:");
        if (senha === "bompastor2024") {
            sessionStorage.setItem("admin_logged_in", "true");
        } else {
            alert("Senha incorreta!");
            window.location.href = "index.html";
            return;
        }
    }
    
    configurarTabs();
    configurarEventos();
    await carregarTodosDados();
    
    // Atualizar a cada 30 segundos
    setInterval(carregarTodosDados, 300000);
});

function configurarTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentTab = btn.dataset.tab;
            
            document.querySelectorAll(".tab-content").forEach(content => {
                content.classList.remove("active");
            });
            document.getElementById(`tab-${currentTab}`).classList.add("active");
            
            if (currentTab === "dashboard") atualizarGraficos();
            if (currentTab === "numeros") carregarMatrizNumeros();
        });
    });
}

function configurarEventos() {
    document.getElementById("btn-sair").onclick = () => {
        sessionStorage.removeItem("admin_logged_in");
        window.location.href = "index.html";
    };
    
    document.getElementById("btn-vender-manual").onclick = () => venderNumeroManual();
    document.getElementById("btn-buscar").onclick = () => buscarNumero();
    document.getElementById("btn-refresh").onclick = () => carregarTodosDados();
    document.getElementById("btn-exportar").onclick = () => exportarCSV();
    document.getElementById("btn-salvar-config").onclick = () => salvarConfiguracoes();
    document.getElementById("buscar-venda")?.addEventListener("input", () => filtrarVendas());
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function carregarTodosDados() {
    showLoading(true);
    try {
        await Promise.all([
            carregarEstatisticas(),
            carregarVendas(),
            carregarTopContribuintes(),
            carregarConfiguracoes()
        ]);
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar dados", "error");
    } finally {
        showLoading(false);
    }
}

async function carregarEstatisticas() {
    const response = await fetch(`${API_URL}?action=getRifaInfo&_=${Date.now()}`);
    const result = await response.json();
    
    if (result.success) {
        const data = result.data;
        const total = data.total_numeros || 100;
        const vendidos = data.vendidos || 0;
        const disponiveis = data.disponiveis || 0;
        const percentual = (vendidos / total) * 100;
        const valor = data.valor_bilhete || 10;
        const arrecadado = vendidos * valor;
        
        document.getElementById("total-numeros").textContent = total;
        document.getElementById("disponiveis").textContent = disponiveis;
        document.getElementById("vendidos").textContent = vendidos;
        document.getElementById("percentual").textContent = `${Math.round(percentual)}%`;
        document.getElementById("stat-arrecadado").textContent = formatarMoeda(arrecadado);
        document.getElementById("stat-media").textContent = formatarMoeda(arrecadado / (vendidos || 1));
        
        atualizarGraficos(total, vendidos, disponiveis);
    }
}

function atualizarGraficos(total, vendidos, disponiveis) {
    if (progressChart) progressChart.destroy();
    if (arrecadacaoChart) arrecadacaoChart.destroy();
    
    const ctx1 = document.getElementById("progressChart")?.getContext("2d");
    if (ctx1) {
        progressChart = new Chart(ctx1, {
            type: "doughnut",
            data: {
                labels: ["Vendidos", "Disponíveis"],
                datasets: [{
                    data: [vendidos || 0, disponiveis || 0],
                    backgroundColor: ["#2d5a4b", "#e2dfd8"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: "bottom" } }
            }
        });
    }
    
    const ctx2 = document.getElementById("arrecadacaoChart")?.getContext("2d");
    if (ctx2) {
        arrecadacaoChart = new Chart(ctx2, {
            type: "bar",
            data: {
                labels: ["Meta", "Arrecadado"],
                datasets: [{
                    label: "Valor (R$)",
                    data: [(total || 100) * 10, (vendidos || 0) * 10],
                    backgroundColor: ["#d4a373", "#2d5a4b"],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: "bottom" } }
            }
        });
    }
}

async function carregarVendas() {
    const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
    const result = await response.json();
    
    if (result.success) {
        const ocupados = result.ocupados || [];
        window.vendasData = ocupados;
        renderizarTabelaVendas(ocupados);
        
        const ultimas = ocupados.slice(-10).reverse();
        const container = document.getElementById("ultimas-vendas-chart");
        if (container) {
            if (ultimas.length === 0) {
                container.innerHTML = '<div class="venda-item">Nenhuma venda registrada</div>';
            } else {
                container.innerHTML = ultimas.map(v => `
                    <div class="venda-item">
                        <strong>Nº ${v.numero}</strong>
                        <span>${v.comprador || "Anônimo"}</span>
                        <span class="${v.status === 'pago' ? 'status-pago' : 'status-pendente'}">
                            ${v.status === 'pago' ? '✓ Pago' : '⏳ Pendente'}
                        </span>
                    </div>
                `).join("");
            }
        }
    }
}

function renderizarTabelaVendas(vendas) {
    const tbody = document.getElementById("vendas-tbody");
    if (!tbody) return;
    
    if (vendas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Nenhuma venda registrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = vendas.map(v => `
        <tr>
            <td><strong>${v.numero}</strong></td>
            <td>${v.comprador || "-"}</td>
            <td>-</td>
            <td>-</td>
            <td>R$ 10,00</td>
            <td class="${v.status === 'pago' ? 'status-pago' : 'status-pendente'}">${v.status === 'pago' ? 'Pago' : 'Pendente'}</td>
            <td>-</td>
        </tr>
    `).join("");
}

function filtrarVendas() {
    const termo = document.getElementById("buscar-venda").value.toLowerCase();
    if (!window.vendasData) return;
    
    const filtradas = window.vendasData.filter(v => 
        v.numero.toString().includes(termo) || 
        (v.comprador || "").toLowerCase().includes(termo)
    );
    renderizarTabelaVendas(filtradas);
}

async function carregarTopContribuintes() {
    const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
    const result = await response.json();
    
    if (result.success) {
        const pagos = (result.ocupados || []).filter(v => v.status === "pago");
        const contribuintes = {};
        pagos.forEach(v => {
            if (v.comprador) {
                contribuintes[v.comprador] = (contribuintes[v.comprador] || 0) + 1;
            }
        });
        
        const top = Object.entries(contribuintes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const container = document.getElementById("top-contribuintes");
        if (container) {
            if (top.length === 0) {
                container.innerHTML = '<div class="top-item">Nenhum contribuinte ainda</div>';
            } else {
                container.innerHTML = top.map(([nome, qtd]) => `
                    <div class="top-item">
                        <strong>${nome}</strong>
                        <span>${qtd} número${qtd !== 1 ? 's' : ''}</span>
                    </div>
                `).join("");
            }
        }
    }
}

async function carregarMatrizNumeros() {
    const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
    const result = await response.json();
    
    if (result.success) {
        const disponiveis = result.disponiveis || [];
        const ocupados = result.ocupados || [];
        const total = 100;
        
        let html = "";
        for (let i = 1; i <= total; i++) {
            const disponivel = disponiveis.includes(i);
            const vendido = ocupados.some(o => o.numero === i && o.status === "pago");
            let classe = "matriz-numero";
            if (disponivel) classe += " disponivel";
            if (vendido) classe += " vendido";
            html += `<div class="${classe}">${i}</div>`;
        }
        
        const container = document.getElementById("matriz-numeros");
        if (container) container.innerHTML = html;
    }
}

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

async function venderNumeroManual() {
    const numero = document.getElementById("venda-numero").value;
    const nome = document.getElementById("venda-nome").value;
    const email = document.getElementById("venda-email").value;
    const telefone = document.getElementById("venda-telefone").value;
    
    if (!numero || !nome || !email) {
        showToast("Preencha número, nome e e-mail", "error");
        return;
    }
    
    showLoading(true);
    try {
        const url = `${API_URL}?action=createPayment&numero=${numero}&comprador=${encodeURIComponent(nome)}&email=${encodeURIComponent(email)}&telefone=${encodeURIComponent(telefone)}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            showToast(`Venda do número ${numero} registrada para ${nome}`, "success");
            document.getElementById("venda-numero").value = "";
            document.getElementById("venda-nome").value = "";
            document.getElementById("venda-email").value = "";
            document.getElementById("venda-telefone").value = "";
            await carregarTodosDados();
            if (currentTab === "numeros") carregarMatrizNumeros();
        } else {
            showToast(result.error || "Erro ao registrar venda", "error");
        }
    } catch (error) {
        showToast("Erro de conexão", "error");
    } finally {
        showLoading(false);
    }
}

async function buscarNumero() {
    const numero = document.getElementById("buscar-numero").value;
    if (!numero) return;
    
    showLoading(true);
    try {
        const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.success) {
            const disponiveis = result.disponiveis || [];
            const ocupados = result.ocupados || [];
            const disponivel = disponiveis.includes(parseInt(numero));
            const ocupado = ocupados.find(o => o.numero == numero);
            
            const div = document.getElementById("resultado-busca");
            div.style.display = "block";
            
            if (disponivel) {
                div.innerHTML = `<span style="color:#2e7d64;">✓ Número ${numero} está disponível</span>`;
                div.style.background = "#e8f3ef";
            } else if (ocupado) {
                div.innerHTML = `<span style="color:#c44569;">✗ Número ${numero} vendido para ${ocupado.comprador || "desconhecido"}</span>`;
                div.style.background = "#fdefef";
            } else {
                div.innerHTML = `<span style="color:#e6b12e;">⚠ Número ${numero} não encontrado</span>`;
                div.style.background = "#fef5e6";
            }
        }
    } catch (error) {
        showToast("Erro ao buscar", "error");
    } finally {
        showLoading(false);
    }
}

function exportarCSV() {
    if (!window.vendasData) return;
    
    let csv = "Número,Comprador,Status\n";
    window.vendasData.forEach(v => {
        csv += `${v.numero},"${v.comprador || ""}",${v.status}\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("CSV exportado com sucesso!", "success");
}

async function carregarConfiguracoes() {
    const response = await fetch(`${API_URL}?action=getRifaInfo&_=${Date.now()}`);
    const result = await response.json();
    
    if (result.success) {
        const data = result.data;
        document.getElementById("config-valor").value = data.valor_bilhete || 10;
        document.getElementById("config-total").value = data.total_numeros || 100;
        document.getElementById("config-data").value = data.data_sorteio || "";
    }
}

async function salvarConfiguracoes() {
    showToast("Configurações salvas! (Recarregue a página para ver efeitos)", "success");
}