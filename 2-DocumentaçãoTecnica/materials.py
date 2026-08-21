import sqlite3
import os

class MaterialsDB:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'app.db')
        self.init_db()
    
    def init_db(self):
        """Inicializa o banco de dados com as tabelas necessárias"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Tabela de materiais isolantes
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                k_func TEXT NOT NULL,
                t_min REAL NOT NULL,
                t_max REAL NOT NULL
            )
        ''')
        
        # Tabela de acabamentos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS finishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                acabamento TEXT NOT NULL,
                emissividade REAL NOT NULL
            )
        ''')
        
        # Inserir dados padrão se não existirem
        cursor.execute('SELECT COUNT(*) FROM materials')
        if cursor.fetchone()[0] == 0:
            materials_data = [
                ('Manta de fibra cerâmica 96Kg/m³ até 1260°C', '0.0317 * math.exp(0.0024 * T)', 25, 1260),
                ('Manta de fibra cerâmica 128Kg/m³ até 1260°C', '0.0349 * math.exp(0.0021 * T)', 25, 1260),
                ('Manta de fibra de vidro 130kg/m³ até 800°C', '0.0286 * math.exp(0.0029 * T)', 25, 800),
                ('Lã de rocha 48kg/m³ até 300°C', '0.0333 * math.exp(0.0048 * T)', 25, 300),
                ('Lã de rocha 64kg/m³ até 300°C', '0.0333 * math.exp(0.0036 * T)', 25, 300),
                ('Lã de Vidro 12kg/m³', '4.2e-2', -20, 230),
                ('Aerogel 160kg/m³ até 650°C', '0.0183 * math.exp(0.0022 * T)', 25, 650),
                ('Microporoso 220kg/m³ até 1000°C', '0.0215 + 2e-06*T + 2e-08*T**2 + 0.0*T**3 + 0.0*T**4', 25, 1000),
                ('Espuma elastomérica 50kg/m³', '0.034 + 8e-05*T + 1e-06*T**2 + 0.0*T**3 + 0.0*T**4', -50, 110),
                ('Silicato de cálcio 240kg/m³', '0.052 + 0.000133 * T', 25, 815),
                ('Perlita expandida', '5.05e-2', -40, 650),
                ('Vidro celular (Foamglas)', '4.5e-2', -268, 482),
                ('Espuma Rígida de Poliisocianurato (PIR)', '2.2e-2', -70, 150)
            ]
            cursor.executemany('INSERT INTO materials (nome, k_func, t_min, t_max) VALUES (?, ?, ?, ?)', materials_data)
        
        cursor.execute('SELECT COUNT(*) FROM finishes')
        if cursor.fetchone()[0] == 0:
            finishes_data = [
                ('Jaqueta térmica removível (ε = 0,90)', 0.90),
                ('Isolamento Fixo - Alumínio Novo (ε = 0,15)', 0.15),
                ('Isolamento Fixo - Alumínio Desgastado (ε = 0,45)', 0.45),
                ('Isolamento Fixo - Aço Inox Novo (ε = 0,20)', 0.20),
                ('Isolamento Fixo - Aço Inox Desgastado (ε = 0,65)', 0.65),
                ('Isolamento Fixo - Aço Galvanizado Novo (ε = 0,25)', 0.25),
                ('Isolamento Fixo - Aço Galvanizado Desgastado (ε = 0,80)', 0.80)
            ]
            cursor.executemany('INSERT INTO finishes (acabamento, emissividade) VALUES (?, ?)', finishes_data)
        
        conn.commit()
        conn.close()
    
    def get_materials(self):
        """Retorna todos os materiais"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM materials')
        materials = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': m[0],
                'nome': m[1],
                'k_func': m[2],
                't_min': m[3],
                't_max': m[4]
            }
            for m in materials
        ]
    
    def get_finishes(self):
        """Retorna todos os acabamentos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM finishes')
        finishes = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': f[0],
                'acabamento': f[1],
                'emissividade': f[2]
            }
            for f in finishes
        ]
    
    def get_material_by_name(self, name):
        """Retorna um material específico pelo nome"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM materials WHERE nome = ?', (name,))
        material = cursor.fetchone()
        conn.close()
        
        if material:
            return {
                'id': material[0],
                'nome': material[1],
                'k_func': material[2],
                't_min': material[3],
                't_max': material[4]
            }
        return None
    
    def get_finish_by_name(self, name):
        """Retorna um acabamento específico pelo nome"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM finishes WHERE acabamento = ?', (name,))
        finish = cursor.fetchone()
        conn.close()
        
        if finish:
            return {
                'id': finish[0],
                'acabamento': finish[1],
                'emissividade': finish[2]
            }
        return None



