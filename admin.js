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
    try {
        const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.success) {
            const ocupados = result.ocupados || [];
            window.vendasData = ocupados;
            renderizarTabelaVendas(ocupados);
            
            // FUNÇÃO PARA CONVERTER DATA PARA TIMESTAMP
            const parseData = (dataStr) => {
                if (!dataStr) return 0;
                try {
                    let data;
                    if (typeof dataStr === 'string') {
                        // Formato brasileiro: dd/MM/yyyy HH:mm
                        if (dataStr.includes('/')) {
                            const partes = dataStr.split(' ');
                            const dataPartes = partes[0].split('/');
                            if (dataPartes.length === 3) {
                                data = new Date(
                                    parseInt(dataPartes[2]), // ano
                                    parseInt(dataPartes[1]) - 1, // mês (0-11)
                                    parseInt(dataPartes[0]), // dia
                                    0, 0, 0
                                );
                                // Adicionar hora se existir
                                if (partes[1]) {
                                    const horaPartes = partes[1].split(':');
                                    if (horaPartes.length >= 2) {
                                        data.setHours(parseInt(horaPartes[0]), parseInt(horaPartes[1]));
                                    }
                                }
                            } else {
                                data = new Date(dataStr);
                            }
                        } else if (dataStr.includes('T')) {
                            // Formato ISO
                            data = new Date(dataStr);
                        } else {
                            data = new Date(dataStr);
                        }
                    } else if (typeof dataStr === 'object' && dataStr.getTime) {
                        data = dataStr;
                    } else {
                        data = new Date(dataStr);
                    }
                    
                    const timestamp = data.getTime();
                    return isNaN(timestamp) ? 0 : timestamp;
                } catch(e) {
                    return 0;
                }
            };
            
            // Filtrar apenas vendas pagas COM data válida
            const vendasComData = ocupados.filter(v => {
                if (v.status !== 'pago') return false;
                if (!v.data_pagamento) return false;
                const timestamp = parseData(v.data_pagamento);
                return timestamp > 0;
            });
            
            // ORDENAR POR DATA/HORA (mais recente primeiro)
            vendasComData.sort((a, b) => {
                const timeA = parseData(a.data_pagamento);
                const timeB = parseData(b.data_pagamento);
                return timeB - timeA; // Do mais novo para o mais antigo
            });
            
            // Pegar as 10 mais recentes
            const ultimas = vendasComData.slice(0, 50);
            
            const container = document.getElementById("ultimas-vendas-chart");
            if (container) {
                if (ultimas.length === 0) {
                    container.innerHTML = '<div class="venda-item">Nenhuma venda registrada</div>';
                } else {
                    container.innerHTML = ultimas.map(v => {
                        // Formatar data para exibição resumida
                        let dataResumida = "";
                        if (v.data_pagamento) {
                            try {
                                let data;
                                if (typeof v.data_pagamento === 'string') {
                                    if (v.data_pagamento.includes('/')) {
                                        const partes = v.data_pagamento.split(' ');
                                        const dataPartes = partes[0].split('/');
                                        if (dataPartes.length === 3) {
                                            data = new Date(
                                                parseInt(dataPartes[2]),
                                                parseInt(dataPartes[1]) - 1,
                                                parseInt(dataPartes[0])
                                            );
                                            if (partes[1]) {
                                                const horaPartes = partes[1].split(':');
                                                if (horaPartes.length >= 2) {
                                                    data.setHours(parseInt(horaPartes[0]), parseInt(horaPartes[1]));
                                                }
                                            }
                                        } else {
                                            data = new Date(v.data_pagamento);
                                        }
                                    } else {
                                        data = new Date(v.data_pagamento);
                                    }
                                } else {
                                    data = new Date(v.data_pagamento);
                                }
                                
                                if (!isNaN(data.getTime())) {
                                    const dia = data.getDate().toString().padStart(2, '0');
                                    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
                                    const hora = data.getHours().toString().padStart(2, '0');
                                    const minuto = data.getMinutes().toString().padStart(2, '0');
                                    dataResumida = `${dia}/${mes} ${hora}:${minuto}`;
                                }
                            } catch(e) {
                                dataResumida = "";
                            }
                        }
                        
                        return `
                            <div class="venda-item">
                                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                    <div>
                                        <strong style="background: #2d5a4b; color: white; padding: 2px 8px; border-radius: 20px; font-size: 12px;">
                                            Nº ${v.numero}
                                        </strong>
                                        <span style="margin-left: 10px; font-size: 13px;">${v.comprador || "Anônimo"}</span>
                                    </div>
                                    <div>
                                        <span style="font-size: 11px; color: #888;">${dataResumida}</span>
                                        <span style="margin-left: 8px; color: #2e7d64;">✓</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join("");
                }
            }
        }
    } catch (error) {
        console.error("Erro ao carregar vendas:", error);
        showToast("Erro ao carregar vendas", "error");
    }
}

function renderizarTabelaVendas(vendas) {
    const tbody = document.getElementById("vendas-tbody");
    if (!tbody) return;
    
    if (vendas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Nenhuma venda registrada</td></tr>';
        return;
    }
    
    // Obter o valor do bilhete
    const valorBilheteTexto = document.getElementById('valor-bilhete')?.innerHTML || 'R$ 10,00';
    const valorBilhete = parseFloat(valorBilheteTexto.replace(/[^0-9,]/g, '').replace(',', '.')) || 10;
    
    tbody.innerHTML = vendas.map(v => {
        // FUNÇÃO CORRIGIDA PARA FORMATAR DATA
        let dataFormatada = "-";
        if (v.data_pagamento && v.data_pagamento !== "Invalid Date") {
            try {
                let data;
                
                // Verificar se é string ISO
                if (typeof v.data_pagamento === 'string') {
                    // Tentar criar data de diferentes formatos
                    if (v.data_pagamento.includes('T')) {
                        // Formato ISO
                        data = new Date(v.data_pagamento);
                    } else if (v.data_pagamento.includes('/')) {
                        // Formato brasileiro dd/MM/yyyy
                        const partes = v.data_pagamento.split(' ');
                        const dataPartes = partes[0].split('/');
                        if (dataPartes.length === 3) {
                            data = new Date(dataPartes[2], dataPartes[1] - 1, dataPartes[0]);
                            // Se tiver hora
                            if (partes[1]) {
                                const horaPartes = partes[1].split(':');
                                if (horaPartes.length === 2) {
                                    data.setHours(parseInt(horaPartes[0]), parseInt(horaPartes[1]));
                                }
                            }
                        } else {
                            data = new Date(v.data_pagamento);
                        }
                    } else {
                        data = new Date(v.data_pagamento);
                    }
                } else {
                    data = new Date(v.data_pagamento);
                }
                
                // Verificar se a data é válida
                if (!isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else {
                    // Se ainda assim for inválido, mostrar o valor original
                    dataFormatada = String(v.data_pagamento);
                }
            } catch(e) {
                console.error("Erro ao formatar data:", e);
                dataFormatada = String(v.data_pagamento);
            }
        } else if (v.data_pagamento && typeof v.data_pagamento === 'string') {
            // Mostrar o valor original mesmo se tiver "Invalid Date"
            dataFormatada = v.data_pagamento;
        }
        
        // Formatar telefone
        let telefoneFormatado = "-";
        if (v.telefone) {
            let numbers = String(v.telefone).replace(/\D/g, "");
            if (numbers.length === 11) {
                telefoneFormatado = `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`;
            } else if (numbers.length === 10) {
                telefoneFormatado = `(${numbers.substring(0, 2)}) ${numbers.substring(2, 6)}-${numbers.substring(6)}`;
            } else {
                telefoneFormatado = v.telefone;
            }
        }
        
        return `
            <tr>
                <td><strong>${v.numero}</strong></td>
                <td>${v.comprador || "-"}</td>
                <td>${v.email || "-"}</td>
                <td>${telefoneFormatado}</td>
                <td>${formatarMoeda(valorBilhete)}</td>
                <td class="${v.status === 'pago' ? 'status-pago' : 'status-pendente'}">
                    ${v.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}
                </td>
                <td>${dataFormatada}</td>
                <td>${v.numero_sorteado === 'SIM' ? '⭐ Sorteado' : '-'}</td>
            </tr>
        `;
    }).join("");
}

function formatPhoneDisplay(telefone) {
    if (!telefone) return "-";
    
    // Converter para string e remover tudo que não é número
    let numbers = String(telefone).replace(/\D/g, "");
    
    if (numbers.length === 11) {
        // celular com 9 dígitos: (11) 91234-5678
        return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`;
    } else if (numbers.length === 10) {
        // telefone fixo: (11) 1234-5678
        return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 6)}-${numbers.substring(6)}`;
    } else if (numbers.length === 13 && numbers.startsWith("55")) {
        // com código do país +55 (11) 91234-5678
        return `+${numbers.substring(0, 2)} (${numbers.substring(2, 4)}) ${numbers.substring(4, 9)}-${numbers.substring(9)}`;
    }
    
    // Se não conseguir formatar, retorna o original
    return telefone;
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
    try {
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
    } catch (error) {
        console.error("Erro ao carregar top contribuintes:", error);
    }
}

async function carregarMatrizNumeros() {
    const response = await fetch(`${API_URL}?action=getNumbers&_=${Date.now()}`);
    const result = await response.json();
    
    if (result.success) {
        const disponiveis = result.disponiveis || [];
        const ocupados = result.ocupados || [];
        const total = 1000;
        
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
    
    // Cabeçalho do CSV
    let csv = "Número;Comprador;E-mail;Telefone;Valor;Status;Data Pagamento;Número Sorteado\n";
    
    // Obter o valor do bilhete
    const valorBilheteTexto = document.getElementById('valor-bilhete')?.innerHTML || 'R$ 10,00';
    const valorBilhete = parseFloat(valorBilheteTexto.replace(/[^0-9,]/g, '').replace(',', '.')) || 10;
    
    window.vendasData.forEach(v => {
        // ===== MESMA LÓGICA DE FORMATAÇÃO DE DATA DO RENDERIZAR TABELA =====
        let dataFormatada = "";
        if (v.data_pagamento && v.data_pagamento !== "Invalid Date") {
            try {
                let data;
                
                // Verificar se é string ISO
                if (typeof v.data_pagamento === 'string') {
                    // Tentar criar data de diferentes formatos
                    if (v.data_pagamento.includes('T')) {
                        // Formato ISO
                        data = new Date(v.data_pagamento);
                    } else if (v.data_pagamento.includes('/')) {
                        // Formato brasileiro dd/MM/yyyy
                        const partes = v.data_pagamento.split(' ');
                        const dataPartes = partes[0].split('/');
                        if (dataPartes.length === 3) {
                            data = new Date(dataPartes[2], dataPartes[1] - 1, dataPartes[0]);
                            // Se tiver hora
                            if (partes[1]) {
                                const horaPartes = partes[1].split(':');
                                if (horaPartes.length === 2) {
                                    data.setHours(parseInt(horaPartes[0]), parseInt(horaPartes[1]));
                                }
                            }
                        } else {
                            data = new Date(v.data_pagamento);
                        }
                    } else {
                        data = new Date(v.data_pagamento);
                    }
                } else {
                    data = new Date(v.data_pagamento);
                }
                
                // Verificar se a data é válida
                if (!isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else {
                    dataFormatada = String(v.data_pagamento);
                }
            } catch(e) {
                dataFormatada = String(v.data_pagamento);
            }
        } else if (v.data_pagamento && typeof v.data_pagamento === 'string') {
            dataFormatada = v.data_pagamento;
        }
        
        // Formatar telefone (só números para o CSV)
        let telefone = v.telefone || "";
        telefone = String(telefone).replace(/\D/g, "");
        
        // Formatar valor com vírgula
        const valorFormatado = valorBilhete.toFixed(2).replace('.', ',');
        
        // Status
        const statusTexto = v.status === 'pago' ? 'Pago' : 'Pendente';
        
        // Número sorteado
        const sorteado = (v.status === 'pago' && v.numero_sorteado === 'SIM') ? 'SIM' : 'NÃO';
        
        // Adicionar linha ao CSV
        csv += `${v.numero};"${v.comprador || ""}";"${v.email || ""}";"${telefone}";${valorFormatado};${statusTexto};"${dataFormatada}";${sorteado}\n`;
    });
    
    // Criar arquivo com BOM para suporte a acentos
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    
    // Nome do arquivo com data
    const agora = new Date();
    const dataStr = `${agora.getFullYear()}-${(agora.getMonth()+1).toString().padStart(2,'0')}-${agora.getDate().toString().padStart(2,'0')}`;
    link.download = `vendas_${dataStr}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
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
