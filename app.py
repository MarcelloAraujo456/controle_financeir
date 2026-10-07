from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Base de dados simples em memória (ou substitua pela sua conexão SQLite/Banco)
transacoes = []
# app.py

categorias = [
    # Categorias de Despesa
    {"id": 1, "nome": "Alimentação", "tipo": "Despesa", "cor": "#ef4444"},
    {"id": 2, "nome": "Lazer", "tipo": "Despesa", "cor": "#f59e0b"},
    {"id": 3, "nome": "Moradia/Aluguel", "tipo": "Despesa", "cor": "#ec4899"},
    {"id": 4, "nome": "Transporte", "tipo": "Despesa", "cor": "#8b5cf6"},
    {"id": 5, "nome": "Saúde", "tipo": "Despesa", "cor": "#06b6d4"},
    {"id": 6, "nome": "Educação", "tipo": "Despesa", "cor": "#3b82f6"},
    {"id": 7, "nome": "Outras Despesas", "tipo": "Despesa", "cor": "#64748b"},

    # Categorias de Receita
    {"id": 8, "nome": "Salário", "tipo": "Receita", "cor": "#10b981"},
    {"id": 9, "nome": "Freelance/Extra", "tipo": "Receita", "cor": "#059669"},
    {"id": 10, "nome": "Investimentos", "tipo": "Receita", "cor": "#047857"},
    {"id": 11, "nome": "Vendas", "tipo": "Receita", "cor": "#14b8a6"},
    {"id": 12, "nome": "Outras Receitas", "tipo": "Receita", "cor": "#10b981"}
]
proximo_id = 1

@app.route('/')
def index():
    return render_template('index.html')

# API de Categorias
@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    return jsonify(categorias)

# API de Transações (Registros)
@app.route('/api/transacoes', methods=['GET'])
def get_transacoes():
    return jsonify(transacoes)

@app.route('/api/transacoes', methods=['POST'])
def add_transacao():
    global proximo_id
    dados = request.get_json()
    
    nova_transacao = {
        "id": proximo_id,
        "descricao": dados.get("descricao", ""),
        "valor": float(dados.get("valor", 0)),
        "tipo": dados.get("tipo", "Despesa"),
        "categoria": dados.get("categoria", "Geral"),
        "status": dados.get("status", "Pago/Recebido"),
        "data": dados.get("data", "")
    }
    
    transacoes.append(nova_transacao)
    proximo_id += 1
    return jsonify({"sucesso": True, "transacao": nova_transacao}), 201

@app.route('/api/transacoes/<int:transacao_id>', methods=['DELETE'])
def delete_transacao(transacao_id):
    global transacoes
    transacoes = [t for t in transacoes if t["id"] != transacao_id]
    return jsonify({"sucesso": True})

if __name__ == '__main__':
    app.run(debug=True)