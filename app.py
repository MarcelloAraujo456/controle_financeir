import sqlite3
import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'sua_chave_secreta_super_segura_aqui'

DB_NAME = "database/financeiro.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs('database', exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabela de Utilizadores
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0
        )
    ''')
    
    # Tabela de Transações (isolada por usuario_id)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            tipo TEXT NOT NULL,
            categoria TEXT NOT NULL,
            status TEXT NOT NULL,
            data TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        )
    ''')

    # Tabela de Categorias
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL
        )
    ''')

    cursor.execute("SELECT COUNT(*) FROM categorias")
    if cursor.fetchone()[0] == 0:
        cats = [
            ('Salário', 'receita'), ('Investimentos', 'receita'), ('Freelance', 'receita'), ('Presente', 'receita'),
            ('Alimentação', 'despesa'), ('Moradia', 'despesa'), ('Transporte', 'despesa'),
            ('Lazer', 'despesa'), ('Saúde', 'despesa'), ('Educação', 'despesa'), ('Outros', 'despesa')
        ]
        cursor.executemany("INSERT INTO categorias (nome, tipo) VALUES (?, ?)", cats)

    conn.commit()
    conn.close()

init_db()

# --- ROTAS DE AUTENTICAÇÃO ---

@app.route('/')
def index():
    if 'usuario_id' not in session:
        return render_template('login.html')
    return render_template('index.html', usuario_nome=session.get('usuario_nome'))

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.get_json() or {}
    nome = dados.get('nome')
    email = dados.get('email', '').strip().lower()
    senha = dados.get('senha')

    if not nome or not email or not senha:
        return jsonify({'error': 'Preencha todos os campos.'}), 400

    senha_hash = generate_password_hash(senha)

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)", (nome, email, senha_hash))
        conn.commit()
        
        usuario_id = cursor.lastrowid
        session['usuario_id'] = usuario_id
        session['usuario_nome'] = nome
        session['is_admin'] = 0

        conn.close()
        return jsonify({'message': 'Conta criada com sucesso!'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Este e-mail já está cadastrado.'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    dados = request.get_json() or {}
    email = dados.get('email', '').strip().lower()
    senha = dados.get('senha')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, senha_hash, is_admin FROM usuarios WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['senha_hash'], senha):
        session['usuario_id'] = user['id']
        session['usuario_nome'] = user['nome']
        session['is_admin'] = user['is_admin']
        return jsonify({'message': 'Login realizado com sucesso!'})
    
    return jsonify({'error': 'E-mail ou senha incorretos.'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Sessão encerrada.'})

# --- ROTAS DE TRANSAÇÕES (ISOLADAS POR UTILIZADOR) ---

@app.route('/api/transacoes', methods=['GET'])
def get_transacoes():
    if 'usuario_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transacoes WHERE usuario_id = ? ORDER BY data DESC", (session['usuario_id'],))
    rows = cursor.fetchall()
    conn.close()

    resultado = [dict(row) for row in rows]
    return jsonify(resultado)

@app.route('/api/transacoes', methods=['POST'])
def add_transacao():
    if 'usuario_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401

    dados = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO transacoes (usuario_id, descricao, valor, tipo, categoria, status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        session['usuario_id'],
        dados.get('descricao'),
        float(dados.get('valor', 0)),
        str(dados.get('tipo', 'despesa')).lower(),
        dados.get('categoria', 'Outros'),
        dados.get('status', 'Pago/Recebido'),
        dados.get('data')
    ))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Transação salva com sucesso!'}), 201

@app.route('/api/transacoes/<int:transacao_id>', methods=['DELETE'])
def delete_transacao(transacao_id):
    if 'usuario_id' not in session:
        return jsonify({'error': 'Não autorizado'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transacoes WHERE id = ? AND usuario_id = ?", (transacao_id, session['usuario_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Transação removida.'})

@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categorias")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

if __name__ == '__main__':
    app.run(debug=True, port=5000)