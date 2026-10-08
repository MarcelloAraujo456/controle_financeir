let transacoes = [];
let categorias = [];
let chartEvolucaoInstance = null;
let chartCategoriasInstance = null;

// Navegação entre Telas
async function navegarPara(tela) {
    document.getElementById('tela-inicial').classList.add('hidden');
    document.getElementById('tela-entrada').classList.add('hidden');
    document.getElementById('tela-resultado').classList.add('hidden');

    const btnInicial = document.getElementById('nav-tela-inicial');
    const btnEntrada = document.getElementById('nav-tela-entrada');
    const btnResultado = document.getElementById('nav-tela-resultado');

    const estiloAtivo = "text-xs font-semibold px-4 py-2 rounded-xl transition bg-indigo-600 text-white";
    const estiloInativo = "text-xs font-semibold px-4 py-2 rounded-xl transition bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700";

    btnInicial.className = estiloInativo;
    btnEntrada.className = estiloInativo;
    btnResultado.className = estiloInativo;

    if (tela === 'inicial') {
        document.getElementById('tela-inicial').classList.remove('hidden');
        btnInicial.className = estiloAtivo;
    } else if (tela === 'entrada') {
        document.getElementById('tela-entrada').classList.remove('hidden');
        btnEntrada.className = estiloAtivo;
    } else if (tela === 'resultado') {
        document.getElementById('tela-resultado').classList.remove('hidden');
        btnResultado.className = estiloAtivo;
        await carregarTransacoes();
        atualizarOpcoesFiltroMes();
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
document.getElementById('trans-tipo').addEventListener('change', function() {
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

// Ajusta o campo de data quando o Mês de Referência muda na Tela de Registro
document.getElementById('registro-mes-referencia').addEventListener('change', function() {
    if (this.value) {
        // Define a data do registro como o dia 1 do mês escolhido (ex: 2026-10-01)
        document.getElementById('trans-data').value = `${this.value}-01`;
    }
});

// Enviar Transação
document.getElementById('form-transacao-direta').addEventListener('submit', async function(e) {
    e.preventDefault();

    const novaTransacao = {
        descricao: document.getElementById('trans-descricao').value,
        valor: parseFloat(document.getElementById('trans-valor').value),
        tipo: document.getElementById('trans-tipo').value.toLowerCase(),
        categoria: document.getElementById('trans-categoria').value,
        status: document.getElementById('trans-status').value,
        data: document.getElementById('trans-data').value
    };

    try {
        const res = await fetch('/api/transacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaTransacao)
        });

        if (res.ok) {
            this.reset();
            
            // Mantém o Mês de Referência e ajusta a data para o dia padrão
            const mesRef = document.getElementById('registro-mes-referencia').value || new Date().toISOString().slice(0, 7);
            document.getElementById('registro-mes-referencia').value = mesRef;
            document.getElementById('trans-data').value = `${mesRef}-01`;
            document.getElementById('trans-categoria').innerHTML = '<option value="" disabled selected>-- Selecione primeiro o Tipo --</option>';
            
            const badge = document.getElementById('badge-salvo');
            if (badge) {
                badge.classList.remove('hidden');
                setTimeout(() => badge.classList.add('hidden'), 3000);
            }

            await carregarTransacoes();
        }
    } catch (err) {
        console.error("Erro ao guardar transação:", err);
    }
});

// Carregar Transações
async function carregarTransacoes() {
    try {
        const res = await fetch('/api/transacoes');
        transacoes = await res.json();
        renderizarTabelaEntrada();
    } catch (err) {
        console.error("Erro ao procurar transações:", err);
    }
}

// Popula o filtro de meses dinamicamente com base nas transações cadastradas
function atualizarOpcoesFiltroMes() {
    const selectMes = document.getElementById('filtro-mes');
    const valorAtual = selectMes.value;
    
    // Obtém todos os meses únicos no formato YYYY-MM presentes nas transações
    const mesesUnicos = [...new Set(transacoes.map(t => t.data.slice(0, 7)))].sort().reverse();

    selectMes.innerHTML = '<option value="">Todos os Meses</option>';
    
    mesesUnicos.forEach(m => {
        const [ano, mes] = m.split('-');
        const option = document.createElement('option');
        option.value = m;
        option.textContent = `${mes}/${ano}`;
        selectMes.appendChild(option);
    });

    selectMes.value = valorAtual;
}

// Renderizar Tabela na Tela de Registro
function renderizarTabelaEntrada() {
    const tbody = document.getElementById('tabela-registros-entrada');
    if (!tbody) return;
    tbody.innerHTML = '';

    transacoes.slice().reverse().forEach(t => {
        const tr = document.createElement('tr');
        const eReceita = t.tipo.toLowerCase() === 'receita';
        
        tr.innerHTML = `
            <td class="p-3 font-medium text-white">${t.descricao}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${eReceita ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
                    ${t.tipo}
                </span>
            </td>
            <td class="p-3 text-slate-400">${t.categoria}</td>
            <td class="p-3 text-slate-400">${t.data}</td>
            <td class="p-3 text-slate-400">${t.status}</td>
            <td class="p-3 text-right font-bold ${eReceita ? 'text-emerald-400' : 'text-rose-400'}">
                ${eReceita ? '+' : '-'} R$ ${parseFloat(t.valor).toFixed(2)}
            </td>
            <td class="p-3 text-right">
                <button onclick="excluirTransacao(${t.id})" class="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-xs">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Excluir Transação
async function excluirTransacao(id) {
    try {
        const res = await fetch(`/api/transacoes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await carregarTransacoes();
            atualizarOpcoesFiltroMes();
            atualizarDashboard();
        }
    } catch (err) {
        console.error("Erro ao apagar transação:", err);
    }
}

// Atualizar Dashboard e Relatórios
function atualizarDashboard() {
    const filtroMes = document.getElementById('filtro-mes').value;
    const filtroBusca = document.getElementById('filtro-busca').value.toLowerCase();
    const filtroTipo = document.getElementById('filtro-tipo').value.toLowerCase();

    let transacoesFiltradas = transacoes.filter(t => {
        // Se filtroMes estiver vazio (""), mostra TODOS os meses
        const bateMes = filtroMes ? t.data.startsWith(filtroMes) : true;
        const bateBusca = t.descricao.toLowerCase().includes(filtroBusca) || t.categoria.toLowerCase().includes(filtroBusca);
        const bateTipo = filtroTipo === 'todos' ? true : t.tipo.toLowerCase() === filtroTipo;
        return bateMes && bateBusca && bateTipo;
    });

    let totalReceitas = 0;
    let totalDespesas = 0;

    transacoesFiltradas.forEach(t => {
        if (t.tipo.toLowerCase() === 'receita') totalReceitas += parseFloat(t.valor);
        if (t.tipo.toLowerCase() === 'despesa') totalDespesas += parseFloat(t.valor);
    });

    const saldoTotal = totalReceitas - totalDespesas;
    const taxaComprometimento = totalReceitas > 0 ? ((totalDespesas / totalReceitas) * 100).toFixed(1) : 0;

    document.getElementById('total-receitas').innerText = `R$ ${totalReceitas.toFixed(2)}`;
    document.getElementById('total-despesas').innerText = `R$ ${totalDespesas.toFixed(2)}`;
    
    const elSaldo = document.getElementById('saldo-total');
    elSaldo.innerText = `R$ ${saldoTotal.toFixed(2)}`;
    elSaldo.className = `text-2xl font-extrabold mt-2 ${saldoTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

    document.getElementById('dash-taxa').innerText = `${taxaComprometimento}%`;

    const tbody = document.getElementById('lista-transacoes');
    if (tbody) {
        tbody.innerHTML = '';

        transacoesFiltradas.forEach(t => {
            const tr = document.createElement('tr');
            const eReceita = t.tipo.toLowerCase() === 'receita';
            
            tr.innerHTML = `
                <td class="p-3 font-medium text-white">${t.descricao}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${eReceita ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
                        ${t.tipo}
                    </span>
                </td>
                <td class="p-3 text-slate-400">${t.categoria}</td>
                <td class="p-3 text-slate-400">${t.data}</td>
                <td class="p-3 text-slate-400">${t.status}</td>
                <td class="p-3 text-right font-bold ${eReceita ? 'text-emerald-400' : 'text-rose-400'}">
                    ${eReceita ? '+' : '-'} R$ ${parseFloat(t.valor).toFixed(2)}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

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
                    label: 'Total (R$)',
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
            categoriasMap[t.categoria] = (categoriasMap[t.categoria] || 0) + parseFloat(t.valor);
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

// Event Listeners dos Filtros
document.getElementById('filtro-mes').addEventListener('change', atualizarDashboard);
document.getElementById('filtro-busca').addEventListener('input', atualizarDashboard);
document.getElementById('filtro-tipo').addEventListener('change', atualizarDashboard);

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    const hoje = new Date();
    const anoMesAtual = hoje.toISOString().slice(0, 7);
    
    // Configura o mês de referência padrão e a data do registro
    document.getElementById('registro-mes-referencia').value = anoMesAtual;
    document.getElementById('trans-data').value = hoje.toISOString().split('T')[0];

    await carregarCategorias();
    await carregarTransacoes();
    navegarPara('inicial');
});