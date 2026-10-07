from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Lista expandida e completa de categorias padrão
categorias = [
    # Categorias de Despesa
    {"id": 1, "nome": "Alimentação", "tipo": "despesa", "cor": "#ef4444"},
    {"id": 2, "nome": "Moradia", "tipo": "despesa", "cor": "#f59e0b"},
    {"id": 3, "nome": "Transporte", "tipo": "despesa", "cor": "#ec4899"},
    {"id": 4, "nome": "Lazer", "tipo": "despesa", "cor": "#8b5cf6"},
    {"id": 5, "nome": "Saúde", "tipo": "despesa", "cor": "#06b6d4"},
    {"id": 6, "nome": "Educação", "tipo": "despesa", "cor": "#3b82f6"},
    {"id": 7, "nome": "Outros", "tipo": "despesa", "cor": "#64748b"},

    # Categorias de Receita
    {"id": 8, "nome": "Salário", "tipo": "receita", "cor": "#10b981"},
    {"id": 9, "nome": "Investimentos", "tipo": "receita", "cor": "#059669"},
    {"id": 10, "nome": "Freelance", "tipo": "receita", "cor": "#047857"},
    {"id": 11, "nome": "Presente", "tipo": "receita", "cor": "#14b8a6"},
    {"id": 12, "nome": "Outros", "tipo": "receita", "cor": "#10b981"}
]

# Banco de dados temporário em memória para armazenar as transações
transacoes = []

# Rota principal para carregar o aplicativo HTML
@app.route('/')
def index():
    return render_template('index.html')

# API: Listar todas as Categorias
@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    return jsonify(categorias)

# API: Cadastrar Nova Categoria dinamicamente
@app.route('/api/categorias', methods=['POST'])
def add_categoria():
    dados = request.get_json() or {}
    
    if not dados.get("nome"):
        return jsonify({"erro": "O nome da categoria é obrigatório"}), 400

    nova_cat = {
        "id": len(categorias) + 1,
        "nome": dados.get("nome"),
        "tipo": str(dados.get("tipo", "despesa")).lower(),
        "cor": dados.get("cor", "#6366f1")
    }
    categorias.append(nova_cat)
    return jsonify({"sucesso": True, "categoria": nova_cat}), 201

# API: Listar todas as Transações
@app.route('/api/transacoes', methods=['GET'])
def get_transacoes():
    return jsonify(transacoes)

# API: Adicionar uma Nova Transação
@app.route('/api/transacoes', methods=['POST'])
def add_transacao():
    dados = request.get_json() or {}
    
    # Validação simples de campos obrigatórios
    if not dados.get("descricao") or dados.get("valor") is None:
        return jsonify({"erro": "Descrição e valor são obrigatórios"}), 400

    nova_transacao = {
        "id": len(transacoes) + 1 if not transacoes else max(t["id"] for t in transacoes) + 1,
        "descricao": dados.get("descricao"),
        "valor": float(dados.get("valor", 0)),
        "tipo": str(dados.get("tipo", "despesa")).lower(),
        "categoria": dados.get("categoria", "Outros"),
        "status": dados.get("status", "Pago/Recebido"),
        "data": dados.get("data")
    }
    transacoes.append(nova_transacao)
    return jsonify({"sucesso": True, "transacao": nova_transacao}), 201

# API: Excluir Transação pelo ID
@app.route('/api/transacoes/<int:transacao_id>', methods=['DELETE'])
def delete_transacao(transacao_id):
    global transacoes
    transacoes = [t for t in transacoes if t["id"] != transacao_id]
    return jsonify({"sucesso": True, "mensagem": "Transação removida com sucesso"}), 200

if __name__ == '__main__':
    app.run(debug=True)