import os
import sqlite3
import traceback
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

app.secret_key = os.environ.get('SECRET_KEY', 'chave_secreta_padrao_desenvolvimento_123')
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('RENDER') is not None
)

DATABASE_URL = os.environ.get('DATABASE_URL')
DB_NAME = "database/financeiro.db"

def get_db():
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        url = DATABASE_URL.replace('postgres://', 'postgresql://')
        if 'sslmode' not in url:
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}sslmode=require"
        conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.DictCursor)
        return conn
    else:
        os.makedirs('database', exist_ok=True)
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    try:
        conn = get_db()
        cursor = conn.cursor()
        is_postgres = DATABASE_URL is not None

        pk_auto = "SERIAL PRIMARY KEY" if is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"

        # Tabela de Utilizadores
        cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS usuarios (
                id {pk_auto},
                nome TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                senha_hash TEXT NOT NULL,
                tipo_conta TEXT DEFAULT 'pessoal',
                is_admin INTEGER DEFAULT 0
            )
        ''')

        try:
            cursor.execute("ALTER TABLE usuarios ADD COLUMN tipo_conta TEXT DEFAULT 'pessoal';")
        except Exception:
            pass

       # Tabela de Transações
        cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS transacoes (
                id {pk_auto},
                usuario_id INTEGER NOT NULL,
                descricao TEXT NOT NULL,
                valor REAL NOT NULL,
                tipo TEXT NOT NULL,
                categoria TEXT NOT NULL,
                status TEXT NOT NULL,
                data TEXT NOT NULL
            )
        ''')

        try:
            cursor.execute("ALTER TABLE transacoes ADD COLUMN usuario_id INTEGER DEFAULT 1;")
        except Exception:
            pass

        # Tabela de Categorias
        cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS categorias (
                id {pk_auto},
                nome TEXT NOT NULL,
                tipo TEXT NOT NULL,
                tipo_conta TEXT DEFAULT 'pessoal'
            )
        ''')

        try:
            cursor.execute("ALTER TABLE categorias ADD COLUMN tipo_conta TEXT DEFAULT 'pessoal';")
        except Exception:
            pass

        # Recria as categorias padrão garantindo que os tipos de conta estão corretos
        cursor.execute("DELETE FROM categorias;")
        cats = [
            ('Salário', 'receita', 'pessoal'), ('Investimentos', 'receita', 'pessoal'), 
            ('Freelance', 'receita', 'pessoal'), ('Presente', 'receita', 'pessoal'),
            ('Alimentação', 'despesa', 'pessoal'), ('Moradia', 'despesa', 'pessoal'), 
            ('Transporte', 'despesa', 'pessoal'), ('Lazer', 'despesa', 'pessoal'), 
            ('Saúde', 'despesa', 'pessoal'), ('Educação', 'despesa', 'pessoal'), ('Outros', 'despesa', 'pessoal'),
            
            ('Vendas de Produtos', 'receita', 'empresarial'), ('Prestação de Serviços', 'receita', 'empresarial'), 
            ('Outras Receitas', 'receita', 'empresarial'),
            ('Fornecedores / Estoque', 'despesa', 'empresarial'), ('Folha de Pagamento', 'despesa', 'empresarial'), 
            ('Aluguel Comercial', 'despesa', 'empresarial'), ('Marketing e Vendas', 'despesa', 'empresarial'), 
            ('Impostos e Taxas', 'despesa', 'empresarial'), ('Manutenção e Operações', 'despesa', 'empresarial'), 
            ('Outros', 'despesa', 'empresarial')
        ]
        ph = "%s, %s, %s" if is_postgres else "?, ?, ?"
        cursor.executemany(f"INSERT INTO categorias (nome, tipo, tipo_conta) VALUES ({ph})", cats)

        conn.commit()
        conn.close()
        print("Base de dados limpa e sincronizada com sucesso!")
    except Exception as e:
        print(f"Erro crítico ao inicializar base de dados: {e}")

init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario_id' not in session:
            return jsonify({'error': 'Sessão expirada. Faça login novamente.'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'usuario_id' not in session:
        return render_template('login.html')
    return render_template('index.html', usuario_nome=session.get('usuario_nome'))

@app.route('/home')
def home():
    return render_template('home.html')

@app.route('/api/cadastro', methods=['POST'])
def cadastro():
    dados = request.get_json() or {}
    nome = dados.get('nome', '').strip()
    email = dados.get('email', '').strip().lower()
    senha = dados.get('senha', '').strip()
    tipo_conta = dados.get('tipo_conta', 'pessoal').strip().lower()

    if not nome or not email or not senha:
        return jsonify({'error': 'Preencha todos os campos.'}), 400

    senha_hash = generate_password_hash(senha)

    try:
        conn = get_db()
        cursor = conn.cursor()
        is_postgres = DATABASE_URL is not None
        ph = "%s, %s, %s, %s" if is_postgres else "?, ?, ?, ?"

        if is_postgres:
            cursor.execute(f"INSERT INTO usuarios (nome, email, senha_hash, tipo_conta) VALUES ({ph}) RETURNING id", (nome, email, senha_hash, tipo_conta))
            usuario_id = cursor.fetchone()[0]
        else:
            cursor.execute(f"INSERT INTO usuarios (nome, email, senha_hash, tipo_conta) VALUES ({ph})", (nome, email, senha_hash, tipo_conta))
            usuario_id = cursor.lastrowid
            
        conn.commit()
        conn.close()

        session['usuario_id'] = usuario_id
        session['usuario_nome'] = nome
        session['tipo_conta'] = tipo_conta
        session['is_admin'] = 0

        return jsonify({'message': 'Conta criada com sucesso!'}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': 'Este e-mail já está em uso.'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    dados = request.get_json() or {}
    email = dados.get('email', '').strip().lower()
    senha = dados.get('senha', '').strip()

    try:
        conn = get_db()
        cursor = conn.cursor()
        ph = "%s" if DATABASE_URL else "?"
        cursor.execute(f"SELECT id, nome, senha_hash, tipo_conta, is_admin FROM usuarios WHERE email = {ph}", (email,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user['senha_hash'], senha):
            session['usuario_id'] = user['id']
            session['usuario_nome'] = user['nome']
            session['tipo_conta'] = user['tipo_conta'] if 'tipo_conta' in user.keys() and user['tipo_conta'] else 'pessoal'
            session['is_admin'] = user['is_admin']
            return jsonify({'message': 'Login realizado com sucesso!'})
    except Exception as e:
        traceback.print_exc()
    
    return jsonify({'error': 'E-mail ou senha incorretos.'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Sessão encerrada.'})

@app.route('/api/transacoes', methods=['GET'])
@login_required
def get_transacoes():
    try:
        conn = get_db()
        cursor = conn.cursor()
        is_postgres = DATABASE_URL is not None
        ph = "%s" if is_postgres else "?"

        cursor.execute(f"SELECT id, descricao, valor, tipo, categoria, status, data FROM transacoes WHERE usuario_id = {ph} ORDER BY data DESC", (session['usuario_id'],))
        rows = cursor.fetchall()
        conn.close()

        resultado = [
            {
                'id': row['id'],
                'descricao': row['descricao'],
                'valor': float(row['valor']),
                'tipo': row['tipo'],
                'categoria': row['categoria'],
                'status': row['status'],
                'data': row['data']
            } for row in rows
        ]
        return jsonify(resultado)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/transacoes', methods=['POST'])
@login_required
def add_transacao():
    try:
        dados = request.get_json() or {}
        conn = get_db()
        cursor = conn.cursor()
        is_postgres = DATABASE_URL is not None

        ph = "%s, %s, %s, %s, %s, %s, %s" if is_postgres else "?, ?, ?, ?, ?, ?, ?"
        cursor.execute(f"""
            INSERT INTO transacoes (usuario_id, descricao, valor, tipo, categoria, status, data)
            VALUES ({ph})
        """, (
            session['usuario_id'],
            dados.get('descricao'),
            round(float(dados.get('valor', 0)), 2),
            str(dados.get('tipo', 'despesa')).lower(),
            dados.get('categoria', 'Outros'),
            dados.get('status', 'Pago/Recebido'),
            dados.get('data')
        ))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Transação salva com sucesso!'}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/transacoes/<int:transacao_id>', methods=['DELETE'])
@login_required
def delete_transacao(transacao_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        is_postgres = DATABASE_URL is not None
        if is_postgres:
            cursor.execute("DELETE FROM transacoes WHERE id = %s AND usuario_id = %s", (transacao_id, session['usuario_id']))
        else:
            cursor.execute("DELETE FROM transacoes WHERE id = ? AND usuario_id = ?", (transacao_id, session['usuario_id']))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Transação removida.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/categorias', methods=['GET'])
@login_required
def get_categorias():
    try:
        tipo_conta_usuario = session.get('tipo_conta', 'pessoal')
        conn = get_db()
        cursor = conn.cursor()
        is_postgres = DATABASE_URL is not None
        ph = "%s" if is_postgres else "?"

        cursor.execute(f"SELECT id, nome, tipo FROM categorias WHERE tipo_conta = {ph}", (tipo_conta_usuario,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([{'id': r['id'], 'nome': r['nome'], 'tipo': r['tipo']} for r in rows])
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)