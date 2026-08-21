# PROMPT INICIAL - Claude Code
## Estruturação Completa do Projeto: Isolamento Térmico Fixo

Copie e cole este prompt EXATAMENTE no seu Claude Code Desktop.

---

```
Você é um desenvolvedor Full Stack especialista em Next.js + Supabase.

OBJETIVO: Estruturar um projeto COMPLETO de calculadora de orçamentos para isolamento térmico fixo.

CONTEXTO:
- Empresa: Prestação de serviços isolamento térmico (quente/frio)
- Usuários: 3 sócios acessando via navegador
- Dados: PostgreSQL no Supabase (grátis)
- Deploy: Vercel (grátis)
- Framework: Next.js 14 + TypeScript + Tailwind CSS

================================
FUNCIONALIDADES PRINCIPAIS
================================

1. CÁLCULOS TÉRMICOS (Quente e Frio)
   ├─ Input: Material, temp quente, temp ambiente, geometria, área, diâmetro
   ├─ Processamento: Fórmulas ASTM C680 / ISO 12241
   ├─ Output: Espessura necessária, perda térmica, economia anual, CO2 evitado
   └─ Integração: API route em Next.js (/api/calcular-termico)

2. QUANTIFICAÇÃO DE MATERIAIS (Método Expert)
   ├─ Inputs: Espessura (mm), Área (m²), tipo isolante
   ├─ Cálculos automáticos:
   │  ├─ Manta: (esp × area × densidade) × 1.20
   │  ├─ Chapa: (esp × area × densidade) × 1.30
   │  ├─ Rebites: area × 20
   │  ├─ Parafusos: area × 20
   │  ├─ Arame: area × 500g
   │  ├─ Vedação P.U.: perímetro / 1.5
   │  └─ Vedacit: quantidade × 360g
   └─ Output: Tabela completa de materiais com quantidades

3. CONFIGURAÇÃO DE PREÇOS (Dinâmicos)
   ├─ Telas de administração onde define:
   │  ├─ Preço por m³: Manta, Chapa (por tipo/densidade)
   │  ├─ Preço unitário: Rebites, Parafusos, Vedação P.U., Vedacit
   │  ├─ Preço por kg: Arame
   │  ├─ Custos adicionais:
   │  │  ├─ Mão de obra (R$/hora)
   │  │  ├─ Deslocamento (R$/km)
   │  │  ├─ Hospedagem (R$/noite)
   │  │  └─ Frete (R$/tonelada ou % do valor)
   │  └─ Parâmetros financeiros:
   │     ├─ Alíquota ISS (ME: ~3-5%)
   │     ├─ Alíquota INSS (contribuinte: ~11%)
   │     ├─ Margem de lucro desejada (% ou R$ fixo)
   │     └─ Desconto competitivo (% opcional)
   └─ Storage: Tabela "precos_config" no Supabase

4. CÁLCULO FINAL DE ORÇAMENTO
   ├─ Fluxo:
   │  1. Calcula térmica → espessura
   │  2. Quantifica materiais
   │  3. Puxa preços do banco
   │  4. Calcula valor materiais
   │  5. Calcula custos operacionais (mão de obra, deslocamento, etc)
   │  6. Soma tudo
   │  7. Aplica impostos (ISS + INSS)
   │  8. Aplica margem de lucro
   │  9. Aplica desconto (se houver)
   │  10. Gera valor final
   └─ Output: Detalhamento completo + PDF proposta

5. GERENCIAMENTO DE ORÇAMENTOS
   ├─ Dashboard:
   │  ├─ Listar todos orçamentos
   │  ├─ Filtros: Cliente, data, status, valor
   │  ├─ Ações: Editar, duplicar, excluir, download PDF
   │  └─ Análises: Total/mês, ticket médio, conversão
   ├─ Criar novo orçamento (passo a passo)
   ├─ Visualizar detalhes completo
   ├─ Exportar para PDF (proposta profissional)
   └─ Salvar automaticamente no Supabase

6. AUTENTICAÇÃO
   ├─ Login simples (email + senha)
   ├─ Supabase Auth
   ├─ Apenas 3 sócios autorizado
   └─ Persistência de sessão

================================
ESTRUTURA NEXT.JS
================================

app/
├── layout.tsx                    (Layout global + navbar)
├── page.tsx                      (Home / Dashboard)
├── login/
│   └── page.tsx                 (Página de login)
├── novo-orcamento/
│   ├── page.tsx                 (Formulário novo orçamento)
│   ├── layout.tsx               (Layout com steps)
│   ├── step-1-cliente/          (Dados do cliente)
│   ├── step-2-especificacoes/   (Material, temperatura, geometria)
│   ├── step-3-calculos/         (Resultado térmica + quantificação)
│   ├── step-4-precos/           (Configurar preços)
│   └── step-5-revisao/          (Revisar + gerar proposta)
├── orcamento/
│   └── [id]/
│       ├── page.tsx             (Visualizar orçamento)
│       ├── editar/              (Editar existente)
│       └── download-pdf/        (Download proposta)
├── config-precos/
│   └── page.tsx                 (Administração de preços)
├── historico/
│   └── page.tsx                 (Histórico completo)
└── api/
    ├── calcular-termico/        (POST - cálculos térmicos)
    ├── quantificar/             (POST - quantificação)
    ├── calcular-orcamento/      (POST - valor final com impostos)
    ├── auth/
    │   ├── login/               (POST)
    │   └── logout/              (POST)
    └── orcamentos/
        ├── route.ts             (GET/POST)
        └── [id]/route.ts        (GET/PUT/DELETE)

lib/
├── supabase.ts                  (Client Supabase)
├── calculadora-termica.ts       (Funções de cálculo)
├── quantificador.ts             (Quantificação de materiais)
├── orcamento.ts                 (Cálculos financeiros + impostos)
└── pdf-generator.ts             (Geração de proposta em PDF)

components/
├── Navbar.tsx
├── FormCliente.tsx
├── FormEspecificacoes.tsx
├── TableMateriais.tsx
├── FormPrecos.tsx
├── TableOrcamentos.tsx
└── PDFPreview.tsx

================================
SUPABASE - TABELAS A CRIAR
================================

1. usuarios (autenticação)
   - id: UUID (PK)
   - email: VARCHAR (UNIQUE)
   - nome: VARCHAR
   - role: VARCHAR ('admin', 'consultor')
   - ativo: BOOLEAN
   - criado_em: TIMESTAMP

2. clientes
   - id: SERIAL (PK)
   - nome: VARCHAR
   - email: VARCHAR
   - telefone: VARCHAR
   - endereco: TEXT
   - cnpj_cpf: VARCHAR
   - criado_em: TIMESTAMP
   - criado_por: VARCHAR (FK usuarios.email)

3. orcamentos
   - id: SERIAL (PK)
   - numero: VARCHAR (UNIQUE)
   - cliente_id: INT (FK clientes.id)
   - data_criacao: TIMESTAMP
   - tipo_trabalho: VARCHAR ('quente', 'frio')
   
   ESPECIFICAÇÕES TÉCNICAS:
   - material: VARCHAR
   - temperatura_quente: FLOAT
   - temperatura_ambiente: FLOAT
   - geometria: VARCHAR ('plana', 'tubulacao')
   - diametro_mm: FLOAT
   - area_m2: FLOAT
   
   RESULTADOS CÁLCULOS:
   - espessura_necessaria_mm: FLOAT
   - perda_com_isolante: FLOAT
   - perda_sem_isolante: FLOAT
   - economia_anual: FLOAT
   - co2_ton_ano: FLOAT
   
   QUANTIFICAÇÃO:
   - manta_kg: FLOAT
   - chapa_kg: FLOAT
   - rebites: INT
   - parafusos: INT
   - arame_kg: FLOAT
   - vedacao_pu: INT
   - vedacit_un: INT
   
   FINANCEIRO:
   - valor_materiais: FLOAT
   - valor_mao_obra: FLOAT
   - valor_deslocamento: FLOAT
   - valor_hospedagem: FLOAT
   - valor_frete: FLOAT
   - subtotal: FLOAT
   - valor_iss: FLOAT
   - valor_inss: FLOAT
   - total_impostos: FLOAT
   - margem_lucro: FLOAT
   - valor_desconto: FLOAT
   - valor_final: FLOAT
   
   STATUS:
   - status: VARCHAR ('rascunho', 'proposta', 'enviado', 'aceito', 'rejeitado')
   - proposta_pdf_url: TEXT
   - criado_por: VARCHAR (FK usuarios.email)
   - criado_em: TIMESTAMP
   - atualizado_em: TIMESTAMP

4. precos_config
   - id: SERIAL (PK)
   - tipo_material: VARCHAR ('manta', 'chapa', 'arame', 'rebite', 'parafuso', 'vedacao', 'vedacit')
   - descricao: VARCHAR
   - preco_unitario: FLOAT (R$/m³ ou R$/kg ou R$/un)
   - densidade_kg_m3: FLOAT (se aplicável)
   - ativo: BOOLEAN
   - ultima_atualizacao: TIMESTAMP

5. config_empresa
   - id: SERIAL (PK)
   - nome_empresa: VARCHAR
   - email_empresa: VARCHAR
   - telefone_empresa: VARCHAR
   - cnpj: VARCHAR
   
   IMPOSTOS E TAXAS:
   - aliquota_iss_percentual: FLOAT (3-5 para ME)
   - aliquota_inss_percentual: FLOAT (11 para contribuinte)
   - margem_lucro_padrao: FLOAT (30, 40, 50% típico)
   - desconto_competitivo: FLOAT (0-20% opcional)
   
   CUSTOS OPERACIONAIS:
   - valor_hora_mao_obra: FLOAT
   - valor_km_deslocamento: FLOAT
   - valor_noite_hospedagem: FLOAT
   - valor_frete_por_tonelada: FLOAT (ou percentual)

================================
VARIÁVEIS DE AMBIENTE
================================

.env.local (você preenche após criar Supabase):

NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon

================================
DEPENDÊNCIAS A INSTALAR
================================

npm install:
- @supabase/supabase-js
- jspdf
- html2canvas (para PDFs)
- recharts (gráficos opcionais)
- zustand (state management)
- react-hook-form (forms)

================================
INSTRUÇÕES FINAIS
================================

1. Crie estrutura completa do projeto
2. Configure Supabase (credenciais no .env.local)
3. Gere arquivo SQL com todas as tabelas (para você copiar/colar no Supabase)
4. Crie todas as páginas listadas acima
5. Implemente APIs routes
6. Integre funções de cálculo
7. Crie componentes React reutilizáveis
8. Faça git init + git add . + git commit + git push para main

IMPORTANTE:
- Use TypeScript em tudo
- Adicione TypeScript interfaces para cada entidade (Usuario, Cliente, Orcamento, etc)
- Use Tailwind CSS para styling (design profissional mas simples)
- Código pronto para produção (sem console.log, com tratamento de erros)
- Estrutura de pasta organizada

Após concluir tudo, execute:
git push origin main

FOCO: Criar MVP funcional, pronto para conectar Supabase e fazer primeiro deploy no Vercel.
```

---

## ⚠️ ANTES DE COPIAR/COLAR

### **Passo 1: Confirme GitHub Setup**
```bash
# No seu terminal, verifique:
git config --global user.email
git config --global user.name
git config --global user.password  # ou token configurado
```

### **Passo 2: Crie repositório GitHub vazio**
```bash
# Em https://github.com/new
# Nome: isolamento-termico-web
# DEIXE em branco (não initialize com README)
```

### **Passo 3: Na sua pasta de trabalho**
```bash
# Navegue até a pasta onde quer o projeto
cd ~/sua-pasta-de-trabalho

# Claude Code vai criar os arquivos aqui
```

### **Passo 4: Abra Claude Code**
- Abra Claude Code Desktop
- Aponte para sua pasta de trabalho
- Cole o prompt acima exatamente como está

### **Passo 5: Depois que terminar**
```bash
# Claude vai fazer automaticamente, mas se não fizer:
git push origin main

# Pronto! Código no GitHub
```

---

## 🎯 PRÓXIMOS PASSOS (APÓS Claude terminar)

### **1. Supabase SQL (30 segundos)**
```
1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto
3. SQL Editor
4. Copie o SQL que Claude gerou
5. Ctrl+Enter para executar
```

### **2. Variáveis de Ambiente**
```
Claude vai gerar .env.example

Você copia as URLs do Supabase:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

E cola em .env.local na raiz do projeto
```

### **3. Testar Localmente**
```bash
npm install
npm run dev

# Abre http://localhost:3000
```

### **4. Deploy Vercel**
```
1. https://vercel.com
2. "Import from Git"
3. Seleciona seu repo do GitHub
4. Deploy (automático)
```

---

**PRONTO? Cole o prompt acima no Claude Code e deixa ele trabalhar! 🚀**
