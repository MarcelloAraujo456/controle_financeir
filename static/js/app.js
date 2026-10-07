let chartEvolucaoInstance = null;
let chartCategoriasInstance = null;
let listaTransacoes = [];
let listaCategorias = [];

document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    const mesAnoAtual = hoje.toISOString().slice(0, 7);
    
    const filtroMesEl = document.getElementById('filtro-mes');
    if (filtroMesEl) filtroMesEl.value = mesAnoAtual;
    
    const inputData = document.getElementById('trans-data');
    if (inputData) inputData.valueAsDate = hoje;

    if (filtroMesEl) filtroMesEl.addEventListener('change', renderizarBalanacoResultado);
    
    const filtroBusca = document.getElementById('filtro-busca');
    if (filtroBusca) filtroBusca.addEventListener('input', renderizarBalanacoResultado);
    
    const filtroTipo = document.getElementById('filtro-tipo');
    if (filtroTipo) filtroTipo.addEventListener('change', renderizarBalanacoResultado);

    const selectTipo = document.getElementById('trans-tipo');
    if (selectTipo) selectTipo.addEventListener('change', atualizarOpcoesCategoriasForm);

    const formTransacao = document.getElementById('form-transacao-direta');
    if (formTransacao) formTransacao.addEventListener('submit', salvarTransacaoEntrada);

    carregarInicial();
});

// Navegação entre telas
window.navegarPara = (tela) => {
    const telas = ['inicial', 'entrada', 'resultado'];
    telas.forEach(t => {
        const el = document.getElementById(`tela-${t}`);
        const btn = document.getElementById(`nav-tela-${t}`);
        if (t === tela) {
            if (el) el.classList.remove('hidden');
            if (btn) btn.className = "text-xs font-semibold px-4 py-2 rounded-xl transition bg-indigo-600 text-white";
        } else {
            if (el) el.classList.add('hidden');
            if (btn) btn.className = "text-xs font-semibold px-4 py-2 rounded-xl transition bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700";
        }
    });

    atualizarTudo();
};

function formatarMoeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function carregarInicial() {
    await carregarCategorias();
    await carregarTransacoes();
}

async function carregarCategorias() {
    try {
        const res = await fetch('/api/categorias');
        listaCategorias = await res.json();
        atualizarOpcoesCategoriasForm();
    } catch (err) {
        console.error("Erro ao carregar categorias:", err);
    }
}

async function carregarTransacoes() {
    try {
        const res = await fetch('/api/transacoes');
        listaTransacoes = await res.json();
        atualizarTudo();
    } catch (err) {
        console.error("Erro ao carregar transações:", err);
    }
}

function atualizarTudo() {
    renderizarTabelaEntrada();
    renderizarBalanacoResultado();
}

// Renderiza a tabela dentro da Tela de Entrada
function renderizarTabelaEntrada() {
    const tabela = document.getElementById('tabela-registros-entrada');
    if (!tabela) return;
    tabela.innerHTML = '';

    if (!listaTransacoes || listaTransacoes.length === 0) {
        tabela.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-xs text-slate-500">Nenhum registro adicionado até o momento.</td></tr>`;
        return;
    }

    listaTransacoes.forEach(t => {
        const catObj = listaCategorias.find(c => c.nome === t.categoria);
        const corHex = catObj ? catObj.cor : '#6366f1';

        tabela.innerHTML += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-3 font-medium text-slate-200">${t.descricao}</td>
                <td class="p-3 text-xs"><span class="px-2 py-0.5 rounded-full ${t.tipo === 'Receita' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">${t.tipo}</span></td>
                <td class="p-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style="background-color: ${corHex}">${t.categoria || 'Geral'}</span></td>
                <td class="p-3 text-xs text-slate-400">${t.data}</td>
                <td class="p-3 text-xs font-semibold ${t.status === 'Pago/Recebido' ? 'text-emerald-400' : 'text-amber-400'}">${t.status}</td>
                <td class="p-3 text-right font-bold ${t.tipo === 'Receita' ? 'text-emerald-400' : 'text-rose-400'}">${t.tipo === 'Receita' ? '+' : '-'} R$ ${formatarMoeda(t.valor)}</td>
                <td class="p-3 text-right">
                    <button onclick="deletarTransacao(${t.id})" class="text-rose-400 hover:text-rose-300 text-xs font-semibold">Remover</button>
                </td>
            </tr>
        `;
    });
}

// Renderiza os totais, gráficos e a tabela completa no Resultado Final
function renderizarBalanacoResultado() {
    const filtroMesEl = document.getElementById('filtro-mes');
    const mesSel = filtroMesEl ? filtroMesEl.value : '';
    const buscaEl = document.getElementById('filtro-busca');
    const busca = buscaEl ? buscaEl.value.toLowerCase() : '';
    const tipoEl = document.getElementById('filtro-tipo');
    const tipo = tipoEl ? tipoEl.value : 'todos';

    const transFiltradasMes = mesSel 
        ? listaTransacoes.filter(t => t.data && t.data.startsWith(mesSel)) 
        : listaTransacoes;

    let totalReceitas = 0;
    let totalDespesas = 0;
    const catGastosMap = {};

    transFiltradasMes.forEach(t => {
        const val = Number(t.valor) || 0;
        if (t.tipo === 'Receita') {
            totalReceitas += val;
        } else {
            totalDespesas += val;
            const cat = t.categoria || 'Outros';
            catGastosMap[cat] = (catGastosMap[cat] || 0) + val;
        }
    });

    const saldo = totalReceitas - totalDespesas;
    const taxaGastos = totalReceitas > 0 ? ((totalDespesas / totalReceitas) * 100).toFixed(1) : 0;

    const elRec = document.getElementById('dash-receitas');
    const elDes = document.getElementById('dash-despesas');
    const elSal = document.getElementById('dash-saldo');
    const elTax = document.getElementById('dash-taxa');

    if (elRec) elRec.textContent = `R$ ${formatarMoeda(totalReceitas)}`;
    if (elDes) elDes.textContent = `R$ ${formatarMoeda(totalDespesas)}`;
    if (elSal) elSal.textContent = `R$ ${formatarMoeda(saldo)}`;
    if (elTax) elTax.textContent = `${taxaGastos}%`;

    const tabelaBalanco = document.getElementById('tabela-balanco-completo');
    if (tabelaBalanco) {
        tabelaBalanco.innerHTML = '';

        const transExibicao = transFiltradasMes.filter(t => {
            const desc = (t.descricao || '').toLowerCase();
            const bateBusca = desc.includes(busca);
            const bateTipo = tipo === 'todos' || t.tipo === tipo;
            return bateBusca && bateTipo;
        });

        if (transExibicao.length === 0) {
            tabelaBalanco.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-slate-500">Nenhuma informação encontrada para o balanço neste período.</td></tr>`;
        } else {
            transExibicao.forEach(t => {
                const catObj = listaCategorias.find(c => c.nome === t.categoria);
                const corHex = catObj ? catObj.cor : '#6366f1';
                
                tabelaBalanco.innerHTML += `
                    <tr class="hover:bg-slate-800/40 transition">
                        <td class="p-3 font-medium text-slate-200">${t.descricao}</td>
                        <td class="p-3 text-xs"><span class="px-2 py-0.5 rounded-full ${t.tipo === 'Receita' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">${t.tipo}</span></td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style="background-color: ${corHex}">${t.categoria || 'Geral'}</span></td>
                        <td class="p-3 text-xs text-slate-400">${t.data}</td>
                        <td class="p-3"><span class="text-xs ${t.status === 'Pago/Recebido' ? 'text-emerald-400' : 'text-amber-400'}">${t.status}</span></td>
                        <td class="p-3 text-right font-bold ${t.tipo === 'Receita' ? 'text-emerald-400' : 'text-rose-400'}">${t.tipo === 'Receita' ? '+' : '-'} R$ ${formatarMoeda(t.valor)}</td>
                    </tr>
                `;
            });
        }
    }

    renderizarGraficoEvolucao(totalReceitas, totalDespesas);
    renderizarGraficoCategorias(catGastosMap);
}

function renderizarGraficoEvolucao(receitas, despesas) {
    const canvas = document.getElementById('chartEvolucao');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartEvolucaoInstance) chartEvolucaoInstance.destroy();

    chartEvolucaoInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Balanço do Mês'],
            datasets: [
                { label: 'Receitas', data: [receitas], backgroundColor: '#10b981', borderRadius: 8 },
                { label: 'Despesas', data: [despesas], backgroundColor: '#ef4444', borderRadius: 8 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
            }
        }
    });
}

function renderizarGraficoCategorias(catMap) {
    const canvas = document.getElementById('chartCategorias');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartCategoriasInstance) chartCategoriasInstance.destroy();

    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    const backgroundColors = labels.map(l => {
        const c = listaCategorias.find(cat => cat.nome === l);
        return c ? c.cor : '#6366f1';
    });

    if (labels.length === 0) {
        labels.push('Sem Despesas');
        data.push(1);
        backgroundColors.push('#334155');
    }

    chartCategoriasInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: backgroundColors, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } }
        }
    });
}

function atualizarOpcoesCategoriasForm() {
    const selectTipo = document.getElementById('trans-tipo');
    const selectCat = document.getElementById('trans-categoria');
    if (!selectTipo || !selectCat) return;

    const tipo = selectTipo.value;
    selectCat.innerHTML = '';

    const filtradas = listaCategorias.filter(c => c.tipo === tipo);
    if (filtradas.length === 0) {
        selectCat.innerHTML = `<option value="Geral">Geral</option>`;
    } else {
        filtradas.forEach(c => {
            selectCat.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
        });
    }
}

// Função para salvar a informação e atualizar imediatamente as duas telas
async function salvarTransacaoEntrada(e) {
    e.preventDefault();

    const descEl = document.getElementById('trans-descricao');
    const valEl = document.getElementById('trans-valor');
    const tipoEl = document.getElementById('trans-tipo');
    const catEl = document.getElementById('trans-categoria');
    const statEl = document.getElementById('trans-status');
    const dataEl = document.getElementById('trans-data');

    const nova = {
        descricao: descEl.value,
        valor: parseFloat(valEl.value),
        tipo: tipoEl.value,
        categoria: catEl ? catEl.value : 'Geral',
        status: statEl.value,
        data: dataEl.value
    };

    try {
        const res = await fetch('/api/transacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nova)
        });

        if (res.ok) {
            descEl.value = '';
            valEl.value = '';

            const badge = document.getElementById('badge-salvo');
            if (badge) {
                badge.classList.remove('hidden');
                setTimeout(() => badge.classList.add('hidden'), 2500);
            }

            // Recarrega os dados do servidor para atualizar instantaneamente as duas telas
            await carregarTransacoes();
        }
    } catch (err) {
        console.error("Erro ao salvar lançamento:", err);
    }
}

window.deletarTransacao = async (id) => {
    try {
        await fetch(`/api/transacoes/${id}`, { method: 'DELETE' });
        carregarTransacoes();
    } catch (err) {
        console.error("Erro ao deletar lançamento:", err);
    }
};