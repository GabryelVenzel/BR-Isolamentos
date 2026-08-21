# Base de dados interna de materiais isolantes e acabamentos
# Todas as informações são armazenadas localmente para uso offline

MATERIALS = [

    # --- FIBRAS CERÂMICAS ---
    {
        'nome': 'Fibra Cerâmica 48kg/m³',
        'k_func': '0.00000014 * T**2 + 0.00015 * T + 0.048',
        't_min': 100,
        't_max': 800
    },
    {
        'nome': 'Fibra Cerâmica 64kg/m³',
        'k_func': '0.00000012 * T**2 + 0.00013 * T + 0.041',
        't_min': 100,
        't_max': 1000
    },
    {
        'nome': 'Fibra Cerâmica 96kg/m³',
        'k_func': '0.00000011 * T**2 + 0.00011 * T + 0.035',
        't_min': 100,
        't_max': 1260
    },
    {
        'nome': 'Fibra Cerâmica 128kg/m³',
        'k_func': '0.00000010 * T**2 + 0.00010 * T + 0.032',
        't_min': 100,
        't_max': 1400
    },
    # --- LÃS DE ROCHA ---
    {
        'nome': 'Lã de Rocha 32kg/m³',
        'k_func': '0.00000021 * T**2 + 0.00008 * T + 0.034',
        't_min': 20,
        't_max': 350
    },
    {
        'nome': 'Lã de Rocha 48kg/m³',
        'k_func': '0.00000019 * T**2 + 0.00007 * T + 0.033',
        't_min': 20,
        't_max': 450
    },
    {
        'nome': 'Lã de Rocha 64kg/m³',
        'k_func': '0.00000017 * T**2 + 0.00007 * T + 0.032',
        't_min': 20,
        't_max': 650
    },
     # --- FRIBRAS DE VIDRO ---
    {
        'nome': 'Manta de Fibra de Vidro (Uso Industrial) 48kg/m³',
        'k_func': '0.00000018 * T**2 + 0.00009 * T + 0.036',
        't_min': 20,
        't_max': 540
    },
    {
        'nome': 'Manta de fibra de vidro 130Kg/m³ até 800°C',
        'k_func': '0.0286 * math.exp(0.0029 * T)',
        't_min': 25,
        't_max': 800
    },
    # --- AEROGÉIS ESPECÍFICOS ---
    {
        'nome': 'Aerogel - Pyrogel XTE (Industrial)',
        'k_func': '0.021 + 0.0001 * T',
        't_min': -40,
        't_max': 650
    },
    {
        'nome': 'Aerogel - Cryogel Z (Criogênico)',
        'k_func': '0.014 + 0.00006 * T',
        't_min': -200,
        't_max': 125
    },
    # --- REFRATÁRIOS ---
    {
        'nome': 'Concreto Refratário Denso (1800kg/m³)',
        'k_func': '1.1', # Condutividade relativamente constante
        't_min': 100,
        't_max': 1400
    },
    {
        'nome': 'Concreto Refratário Isolante (800kg/m³)',
        'k_func': '0.0002 * T + 0.18',
        't_min': 100,
        't_max': 1100
    },
    # --- OUTROS ISOLANTES ---
    {
        'nome': 'Silicato de Cálcio 240kg/m³',
        'k_func': '0.00015 * T + 0.05',
        't_min': 100,
        't_max': 650
    },
    {
        'nome': 'Espuma Elastomérica 50kg/m³',
        'k_func': '0.0000001 * T**2 + 0.00008 * T + 0.034',
        't_min': -50,
        't_max': 110
    },
    {
        'nome': 'Espuma Rígida de Poliisocianurato (PIR) 35kg/m³',
        'k_func': '0.0001 * T + 0.023',
        't_min': -180,
        't_max': 150
    },
    {
        'nome': 'Vidro Celular (Foamglas) 120kg/m³',
        'k_func': '0.00017*T + 0.041',
        't_min': -268,
        't_max': 430
    },
        # --- ISOLANTES GRANULARES E CIMENTÍCIOS ---
    {
        'nome': 'Perlita Expandida (Granular)',
        'k_func': '0.00011 * T + 0.045',
        't_min': -200,
        't_max': 800
    },
    {
        'nome': 'Vermiculita Exfoliada (Granular)',
        'k_func': '0.00015 * T + 0.062',
        't_min': 50,
        't_max': 1100
    },
    
    # --- PLÁSTICOS E POLÍMEROS ---
    {
        'nome': 'Espuma Rígida de Poliuretano (PUR) 35kg/m³',
        'k_func': '0.00000005 * T**2 + 0.00008 * T + 0.025',
        't_min': -180,
        't_max': 110
    },
    {
        'nome': 'Poliestireno Extrudado (XPS) 30kg/m³',
        'k_func': '0.0001 * T + 0.029',
        't_min': -50,
        't_max': 75
    },
    {
        'nome': 'Poliestireno Expandido (EPS) 20kg/m³',
        'k_func': '0.00011 * T + 0.034',
        't_min': -50,
        't_max': 80
    },
]

FINISHES = [
    {
        'acabamento': 'Jaqueta Térmica Removível (Tecido)',
        'emissividade': 0.90
    },
    {
        'acabamento': 'Alumínio Polido (Novo)',
        'emissividade': 0.05
    },
    {
        'acabamento': 'Alumínio Rústico/Fosco',
        'emissividade': 0.07
    },
    {
        'acabamento': 'Alumínio Oxidado/Intemperizado',
        'emissividade': 0.25
    },
    {
        'acabamento': 'Aço Inox Polido (Novo)',
        'emissividade': 0.08
    },
    {
        'acabamento': 'Aço Inox Intemperizado',
        'emissividade': 0.85
    },
    {
        'acabamento': 'Aço Galvanizado (Novo)',
        'emissividade': 0.23
    },
    {
        'acabamento': 'Aço Galvanizado Oxidado',
        'emissividade': 0.28
    },
    {
        'acabamento': 'Superfície Pintada (Tinta Esmalte Branca)',
        'emissividade': 0.87
    },
    {
        'acabamento': 'Superfície Pintada (Tinta Esmalte Preta Fosca)',
        'emissividade': 0.97
    },
    {
        'acabamento': 'Superfície Pintada (Tinta Alumínio)',
        'emissividade': 0.31
    },
]

# Combustíveis para cálculo financeiro
COMBUSTIVEIS = {
    # Valor de "v" (custo) é um placeholder. "pc" é a energia em kWh/ton.
    # "fator_emissao" agora representa a média da geração por gás natural (kg CO2/ton vapor).
    "Vapor (ton)":                       {"v": 150.00, "pc": 628.00, "ef": 1.00, "fator_emissao": 134.0},
    
    "Eletricidade (kWh)":                {"v": 0.75, "pc": 1.00,  "ef": 1.00, "fator_emissao": 0.0358},
    "Gás Natural (m³)":                  {"v": 3.60, "pc": 9.65,  "ef": 0.75, "fator_emissao": 2.0},
    "GLP (Gás Liquefeito de Petróleo) (kg)": {"v": 6.80, "pc": 12.78, "ef": 0.78, "fator_emissao": 3.0},
    "Óleo Diesel (L)":                   {"v": 6.10, "pc": 10.11, "ef": 0.82, "fator_emissao": 2.63},
    "Óleo Combustível BPF (kg)":         {"v": 3.50, "pc": 11.34, "ef": 0.80, "fator_emissao": 3.15},
    
    # Fator de emissão corrigido para perto de zero, refletindo a neutralidade de carbono da biomassa.
    "Lenha de Eucalipto (ton)":          {"v": 200.00,"pc": 3500.00,"ef": 0.70, "fator_emissao": 0.05},
}

class MaterialsDatabase:
    """Classe para gerenciar a base de dados de materiais e acabamentos"""
    
    def __init__(self):
        self.materials = MATERIALS
        self.finishes = FINISHES
        self.fuels = COMBUSTIVEIS
    
    def get_materials(self):
        """Retorna lista de materiais disponíveis"""
        return self.materials
    
    def get_finishes(self):
        """Retorna lista de acabamentos disponíveis"""
        return self.finishes
    
    def get_fuels(self):
        """Retorna lista de combustíveis disponíveis"""
        return self.fuels
    
    def get_material_by_name(self, name):
        """Busca material por nome"""
        for material in self.materials:
            if material['nome'] == name:
                return material
        return None
    
    def get_finish_by_name(self, name):
        """Busca acabamento por nome"""
        for finish in self.finishes:
            if finish['acabamento'] == name:
                return finish
        return None
    
    def get_fuel_by_name(self, name):
        """Busca combustível por nome"""
        return self.fuels.get(name, None)

# Instância global para uso na aplicação
materials_db = MaterialsDatabase()

