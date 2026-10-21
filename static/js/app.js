let transacoes = [];
let categorias = [];
let chartEvolucaoInstance = null;
let chartCategoriasInstance = null;

// Formatação precisa de moeda
function formatarMoeda(valor) {
    const num = Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Navegação entre Telas
async function navegarPara(tela) {
    document.getElementById('tela-inicial').classList.add('hidden');
    document.getElementById('tela-entrada').classList.add('hidden');
    document.getElementById('tela-resultado').classList.add('hidden');

    const btnInicial = document.getElementById('nav-tela-inicial');
    const btnEntrada = document.getElementById('nav-tela-entrada');
    const btnResultado = document.getElementById('nav-tela-resultado');

    const estiloAtivo = "px-3 py-2 rounded-xl transition bg-indigo-600 text-white font-semibold";
    const estiloInativo = "px-3 py-2 rounded-xl transition bg-slate-800 text-slate-300 hover:bg-slate-700";

    if (btnInicial) btnInicial.className = estiloInativo;
    if (btnEntrada) btnEntrada.className = estiloInativo;
    if (btnResultado) btnResultado.className = estiloInativo;

    if (tela === 'inicial') {
        document.getElementById('tela-inicial').classList.remove('hidden');
        if (btnInicial) btnInicial.className = estiloAtivo;
    } else if (tela === 'entrada') {
        document.getElementById('tela-entrada').classList.remove('hidden');
        if (btnEntrada) btnEntrada.className = estiloAtivo;
    } else if (tela === 'resultado') {
        document.getElementById('tela-resultado').classList.remove('hidden');
        if (btnResultado) btnResultado.className = estiloAtivo;
        await carregarTransacoes();
        atualizarOpcoesFiltroData();
        atualizarDashboard();
    }
}

// Carregar Categorias
async function carregarCategorias() {
    try {
        const res = await fetch('/api/categorias');
        categorias = await res.json();
    } catch (err) {
        console.error("Erro ao carregar categorias:", err);
    }
}

// Atualizar select de Categorias pelo Tipo
const elTransTipo = document.getElementById('trans-tipo');
if (elTransTipo) {
    elTransTipo.addEventListener('change', function() {
        const tipoSelecionado = this.value.toLowerCase();
        const selectCategoria = document.getElementById('trans-categoria');
        selectCategoria.innerHTML = '<option value="" disabled selected>-- Selecione a Categoria --</option>';

        const filtradas = categorias.filter(c => c.tipo.toLowerCase() === tipoSelecionado);

        filtradas.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.nome;
            option.textContent = cat.nome;
            selectCategoria.appendChild(option);
        });
    });
}

// Sincronizar Data no Select de Mês de Referência
const elMesRef = document.getElementById('registro-mes-referencia');
if (elMesRef) {
    elMesRef.addEventListener('change', function() {
        if (this.value) {
            document.getElementById('trans-data').value = `${this.value}-01`;
        }
    });
}

// Guardar Transação
const elFormTransacao = document.getElementById('form-transacao-direta');
if (elFormTransacao) {
    elFormTransacao.addEventListener('submit', async function(e) {
        e.preventDefault();

        const mesRefAtual = document.getElementById('registro-mes-referencia').value;
        const dataSelecionada = document.getElementById('trans-data').value;

        const novaTransacao = {
            descricao: document.getElementById('trans-descricao').value.trim(),
            valor: parseFloat(document.getElementById('trans-valor').value),
            tipo: document.getElementById('trans-tipo').value.toLowerCase(),
            categoria: document.getElementById('trans-categoria').value,
            status: document.getElementById('trans-status').value,
            data: dataSelecionada
        };

        try {
            const res = await fetch('/api/transacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novaTransacao)
            });

            if (res.ok) {
                this.reset();
                document.getElementById('registro-mes-referencia').value = mesRefAtual;
                document.getElementById('trans-data').value = dataSelecionada;
                document.getElementById('trans-categoria').innerHTML = '<option value="" disabled selected>-- Selecione o Tipo primeiro --</option>';
                
                const badge = document.getElementById('badge-salvo');
                if (badge) {
                    badge.classList.remove('hidden');
                    setTimeout(() => badge.classList.add('hidden'), 3000);
                }

                await carregarTransacoes();
            } else {
                alert('Erro ao guardar a transação. Verifique os dados.');
            }
        } catch (err) {
            console.error("Erro ao guardar transação:", err);
            alert('Erro de conexão com o servidor.');
        }
    });
}

// Carregar Transações
async function carregarTransacoes() {
    try {
        const res = await fetch('/api/transacoes');
        if (res.status === 401) {
            window.location.reload();
            return;
        }
        transacoes = await res.json();
        renderizarRegistrosEntrada();
    } catch (err) {
        console.error("Erro ao carregar transações:", err);
    }
}

// Filtros de Data
function atualizarOpcoesFiltroData() {
    const selectMes = document.getElementById('filtro-mes');
    const selectAno = document.getElementById('filtro-ano');
    if (!selectMes) return;
    
    const valorMesAtual = selectMes.value;
    const valorAnoAtual = selectAno ? selectAno.value : '';
    
    const anosUnicos = [...new Set(transacoes.map(t => t.data.slice(0, 4)))].sort().reverse();
    const mesesUnicos = [...new Set(transacoes.map(t => t.data.slice(0, 7)))].sort().reverse();

    if (selectAno) {
        selectAno.innerHTML = '<option value="">Todos os Anos</option>';
        anosUnicos.forEach(a => {
            const option = document.createElement('option');
            option.value = a;
            option.textContent = a;
            selectAno.appendChild(option);
        });
        selectAno.value = valorAnoAtual;
    }

    selectMes.innerHTML = '<option value="">Todos os Meses</option>';
    mesesUnicos.forEach(m => {
        const [ano, mes] = m.split('-');
        const option = document.createElement('option');
        option.value = m;
        option.textContent = `${mes}/${ano}`;
        selectMes.appendChild(option);
    });

    selectMes.value = valorMesAtual;
}

// Renderização Híbrida (Desktop Tabela / Mobile Cards)
function renderizarRegistrosEntrada() {
    const tbody = document.getElementById('tabela-registros-entrada');
    const containerMobile = document.getElementById('cards-registros-entrada-mobile');
    
    if (tbody) tbody.innerHTML = '';
    if (containerMobile) containerMobile.innerHTML = '';

    transacoes.slice().reverse().forEach(t => {
        const eReceita = t.tipo.toLowerCase() === 'receita';
        const corTexto = eReceita ? 'text-emerald-400' : 'text-rose-400';
        const corBadge = eReceita ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

        // Linha Tabela Desktop
        if (tbody) {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800/50 hover:bg-slate-800/30";
            tr.innerHTML = `
                <td class="p-3 font-medium text-white">${t.descricao}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${corBadge}">${t.tipo}</span></td>
                <td class="p-3 text-slate-400">${t.categoria}</td>
                <td class="p-3 text-slate-400">${t.data}</td>
                <td class="p-3 text-slate-400">${t.status}</td>
                <td class="p-3 text-right font-bold ${corTexto}">${eReceita ? '+' : '-'} ${formatarMoeda(t.valor)}</td>
                <td class="p-3 text-right">
                    <button onclick="excluirTransacao(${t.id})" class="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-xs">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

        // Card Mobile
        if (containerMobile) {
            const card = document.createElement('div');
            card.className = "bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center gap-3";
            card.innerHTML = `
                <div class="space-y-1">
                    <div class="font-bold text-white text-sm">${t.descricao}</div>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${corBadge}">${t.tipo}</span>
                        <span>• ${t.categoria}</span>
                        <span>• ${t.data}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-extrabold text-sm ${corTexto}">${eReceita ? '+' : '-'} ${formatarMoeda(t.valor)}</div>
                    <button onclick="excluirTransacao(${t.id})" class="text-rose-400 text-xs font-bold mt-1">Apagar 🗑️</button>
                </div>
            `;
            containerMobile.appendChild(card);
        }
    });
}

// Excluir Transação
async function excluirTransacao(id) {
    if (!confirm('Deseja realmente apagar esta transação?')) return;
    try {
        const res = await fetch(`/api/transacoes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await carregarTransacoes();
            atualizarOpcoesFiltroData();
            atualizarDashboard();
        }
    } catch (err) {
        console.error("Erro ao apagar transação:", err);
    }
}

// Dashboard e Cálculos Financeiros
function atualizarDashboard() {
    const elFiltroAno = document.getElementById('filtro-ano');
    const elFiltroMes = document.getElementById('filtro-mes');
    const elFiltroBusca = document.getElementById('filtro-busca');
    const elFiltroTipo = document.getElementById('filtro-tipo');

    if (!elFiltroMes) return;

    const filtroAno = elFiltroAno ? elFiltroAno.value : '';
    const filtroMes = elFiltroMes.value;
    const filtroBusca = elFiltroBusca ? elFiltroBusca.value.toLowerCase() : '';
    const filtroTipo = elFiltroTipo ? elFiltroTipo.value.toLowerCase() : 'todos';

    let transacoesFiltradas = transacoes.filter(t => {
        const bateAno = filtroAno ? t.data.startsWith(filtroAno) : true;
        const bateMes = filtroMes ? t.data.startsWith(filtroMes) : true;
        const bateBusca = t.descricao.toLowerCase().includes(filtroBusca) || t.categoria.toLowerCase().includes(filtroBusca);
        const bateTipo = filtroTipo === 'todos' ? true : t.tipo.toLowerCase() === filtroTipo;
        return bateAno && bateMes && bateBusca && bateTipo;
    });

    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoesFiltradas.forEach(t => {
        const val = Math.round((Number(t.valor) + Number.EPSILON) * 100) / 100;
        if (t.tipo.toLowerCase() === 'receita') totalReceitas += val;
        if (t.tipo.toLowerCase() === 'despesa') totalDespesas += val;
    });

    totalReceitas = Math.round((totalReceitas + Number.EPSILON) * 100) / 100;
    totalDespesas = Math.round((totalDespesas + Number.EPSILON) * 100) / 100;

    const saldoTotal = Math.round(((totalReceitas - totalDespesas) + Number.EPSILON) * 100) / 100;
    const taxaComprometimento = totalReceitas > 0 ? ((totalDespesas / totalReceitas) * 100).toFixed(1) : 0;

    const elRec = document.getElementById('total-receitas');
    const elDesp = document.getElementById('total-despesas');
    const elSaldo = document.getElementById('saldo-total');
    const elTaxa = document.getElementById('dash-taxa');

    if (elRec) elRec.innerText = formatarMoeda(totalReceitas);
    if (elDesp) elDesp.innerText = formatarMoeda(totalDespesas);
    if (elSaldo) {
        elSaldo.innerText = formatarMoeda(saldoTotal);
        elSaldo.className = `text-lg sm:text-2xl font-extrabold mt-1 ${saldoTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }
    if (elTaxa) elTaxa.innerText = `${taxaComprometimento}%`;

    // Renderizar Lista Filtrada
    const tbody = document.getElementById('lista-transacoes');
    const containerMobile = document.getElementById('cards-historico-mobile');

    if (tbody) tbody.innerHTML = '';
    if (containerMobile) containerMobile.innerHTML = '';

    transacoesFiltradas.forEach(t => {
        const eReceita = t.tipo.toLowerCase() === 'receita';
        const corTexto = eReceita ? 'text-emerald-400' : 'text-rose-400';
        const corBadge = eReceita ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

        if (tbody) {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800/50 hover:bg-slate-800/30";
            tr.innerHTML = `
                <td class="p-3 font-medium text-white">${t.descricao}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${corBadge}">${t.tipo}</span></td>
                <td class="p-3 text-slate-400">${t.categoria}</td>
                <td class="p-3 text-slate-400">${t.data}</td>
                <td class="p-3 text-slate-400">${t.status}</td>
                <td class="p-3 text-right font-bold ${corTexto}">${eReceita ? '+' : '-'} ${formatarMoeda(t.valor)}</td>
            `;
            tbody.appendChild(tr);
        }

        if (containerMobile) {
            const card = document.createElement('div');
            card.className = "bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center";
            card.innerHTML = `
                <div>
                    <div class="font-bold text-white text-sm">${t.descricao}</div>
                    <div class="text-xs text-slate-400">${t.categoria} • ${t.data}</div>
                </div>
                <div class="font-extrabold text-sm ${corTexto}">${eReceita ? '+' : '-'} ${formatarMoeda(t.valor)}</div>
            `;
            containerMobile.appendChild(card);
        }
    });

    renderizarGraficos(totalReceitas, totalDespesas, transacoesFiltradas);
}

// Renderizar Gráficos
function renderizarGraficos(receitas, despesas, listaFiltrada) {
    const elChartEvolucao = document.getElementById('chartEvolucao');
    if (elChartEvolucao) {
        const ctxEvolucao = elChartEvolucao.getContext('2d');
        if (chartEvolucaoInstance) chartEvolucaoInstance.destroy();

        chartEvolucaoInstance = new Chart(ctxEvolucao, {
            type: 'bar',
            data: {
                labels: ['Receitas', 'Despesas'],
                datasets: [{
                    label: 'Total',
                    data: [receitas, despesas],
                    backgroundColor: ['#10B981', '#F43F5E'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: '#94A3B8' }, grid: { color: '#334155' } },
                    x: { ticks: { color: '#94A3B8' }, grid: { display: false } }
                }
            }
        });
    }

    const elChartCategorias = document.getElementById('chartCategorias');
    if (elChartCategorias) {
        const categoriasMap = {};
        listaFiltrada.filter(t => t.tipo.toLowerCase() === 'despesa').forEach(t => {
            const val = Math.round((Number(t.valor) + Number.EPSILON) * 100) / 100;
            categoriasMap[t.categoria] = (categoriasMap[t.categoria] || 0) + val;
        });

        const labelsCat = Object.keys(categoriasMap);
        const valoresCat = Object.values(categoriasMap);

        const ctxCategorias = elChartCategorias.getContext('2d');
        if (chartCategoriasInstance) chartCategoriasInstance.destroy();

        chartCategoriasInstance = new Chart(ctxCategorias, {
            type: 'doughnut',
            data: {
                labels: labelsCat.length ? labelsCat : ['Sem despesas'],
                datasets: [{
                    data: valoresCat.length ? valoresCat : [1],
                    backgroundColor: ['#6366F1', '#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#64748B']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94A3B8', boxWidth: 12 } }
                }
            }
        });
    }
}

// Listeners dos Filtros
const elFiltroAno = document.getElementById('filtro-ano');
if (elFiltroAno) elFiltroAno.addEventListener('change', atualizarDashboard);

const elFiltroMes = document.getElementById('filtro-mes');
if (elFiltroMes) elFiltroMes.addEventListener('change', atualizarDashboard);

const elFiltroBusca = document.getElementById('filtro-busca');
if (elFiltroBusca) elFiltroBusca.addEventListener('input', atualizarDashboard);

const elFiltroTipo = document.getElementById('filtro-tipo');
if (elFiltroTipo) elFiltroTipo.addEventListener('change', atualizarDashboard);

// Logout
async function fazerLogout() {
    try {
        const res = await fetch('/api/logout', { method: 'POST' });
        if (res.ok) window.location.reload();
    } catch (err) {
        console.error("Erro ao encerrar sessão:", err);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    const hoje = new Date();
    const anoMesAtual = hoje.toISOString().slice(0, 7);
    
    const elMesRef = document.getElementById('registro-mes-referencia');
    const elData = document.getElementById('trans-data');

    if (elMesRef) elMesRef.value = anoMesAtual;
    if (elData) elData.value = hoje.toISOString().split('T')[0];

    // ORDEM CRÍTICA: Carregar categorias PRIMEIRO para preencher os selects
    await carregarCategorias();
    await carregarTransacoes();
    navegarPara('inicial');
});