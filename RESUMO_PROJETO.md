# BR Isolamentos — Resumo Técnico do Projeto

> Documento gerado para consulta externa (outra IA/revisor). Descreve o estado atual do
> sistema, decisões tomadas, dados usados e pontos em aberto. Não contém credenciais.

## 1. Contexto do negócio

Empresa de prestação de serviços de isolamento térmico (quente e frio) para tubulações e
superfícies planas. O sistema é uma calculadora de orçamentos que substitui uma planilha
Excel + uma calculadora interna em Python/Streamlit (ainda em uso paralelo hoje). Uso
interno, hoje com **login único** compartilhado (era planejado para 3 sócios, simplificado
para 1 login por ora).

## 2. Stack técnica

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase**: Postgres (dados), Auth (email+senha), Storage (galeria de imagens das
  propostas)
- **Zustand** — estado do wizard de criação de orçamento (persistido em localStorage)
- **jsPDF + html2canvas** — geração de PDF a partir de componentes React renderizados
- **Recharts** — gráfico simples no dashboard
- **react-hook-form** — listado como dependência, pouco usado hoje (a maioria dos
  formulários usa `useState` simples, não `react-hook-form`)
- Deploy: **Vercel**. Repositório: GitHub (privado, branch `main`).

## 3. Modelo de dados (Postgres/Supabase)

Todas as tabelas têm RLS habilitado, política única `for all to authenticated using (true)`
(qualquer usuário autenticado tem acesso total — não há diferenciação de papel/role hoje
além de um campo `role` em `usuarios` que não é usado para nada no código ainda).

| Tabela | Papel |
|---|---|
| `usuarios` | Perfil complementar ao Supabase Auth (email, nome de exibição, role) |
| `clientes` | Clientes da empresa |
| `orcamentos` | **Cabeçalho** do orçamento: cliente, status, financeiro agregado |
| `itens_orcamento` | Um "trecho" técnico por linha (material, geometria, resultado térmico, quantificação). Um orçamento tem 1+ itens; quando há itens quente e frio no mesmo orçamento, ele é "misto" |
| `materiais_isolantes` | Catálogo de materiais isolantes: nome, `k_func` (fórmula de condutividade térmica em função de T), t_min/t_max, densidade, categoria |
| `acabamentos` | Catálogo de acabamentos externos: nome, emissividade |
| `precos_config` | Preço unitário + densidade de cada tipo de material comercial (manta, chapa, rebite, parafuso, arame, vedação P.U., vedacit) |
| `impostos_config` | Lista livre de impostos extras (nome, percentual, ativo) somados por cima do imposto "base" do regime tributário |
| `config_empresa` | Linha única: regime tributário, dados do Simples Nacional (anexo, RBT12), margem de lucro padrão, desconto competitivo, custos operacionais (mão de obra/km/hospedagem/frete), e a estimativa de gramas de Vedacit por junta |
| `imagens_proposta` | Galeria de fotos institucionais (Supabase Storage, bucket `propostas-imagens`) usada na Proposta Técnica |

`orcamentos.tipo_trabalho` ∈ `{quente, frio, misto}` (misto é derivado no app: todos os
itens do mesmo tipo → esse tipo, senão misto). `orcamentos.status` ∈ `{rascunho, proposta,
enviado, aceito, rejeitado}`.

### Dívida técnica conhecida no schema
As colunas técnicas antigas de `orcamentos` (material, temperatura_quente, área_m2 etc.)
ainda existem na tabela por compatibilidade (ficaram nullable, não são mais escritas pelo
app — os dados reais agora vivem em `itens_orcamento`). Isso é ruído no schema que poderia
ser limpo numa migração futura, quando não houver mais risco de perder dados de teste.

## 4. Motor de cálculo térmico (`lib/calculadora-termica.ts`)

Porte fiel de uma calculadora Python/Streamlit já usada pela empresa
(`2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py`), seguindo ASTM C680 / ISO 12241 / ABNT NBR
16281:

- **Condução** através da(s) camada(s) de isolante: placa plana (`k·ΔT/L`) ou tubulação
  (log de raio interno/externo).
- **Convecção** na face externa: natural (Rayleigh, correlações distintas para placa e
  cilindro) ou forçada (Reynolds, se houver vento ≥ 1 m/s).
- **Radiação** na face externa (Stefan-Boltzmann, usa a emissividade do acabamento
  selecionado).
- A temperatura de face fria é encontrada por **busca iterativa** (bisseção com passo
  decrescente) até condução = convecção + radiação.
- **Multi-camada**: calcula a temperatura em cada interface entre camadas — mas usa o
  mesmo k(T) do material selecionado para todas as camadas (simplificação herdada do
  código original; só é um problema real se o usuário um dia puder escolher materiais
  diferentes por camada, o que hoje não é possível na UI).
- **Frio/condensação**: ponto de orvalho pela fórmula de Magnus + busca da menor espessura
  (1 a 500 mm) que mantém a face fria acima do ponto de orvalho.
- **Financeiro/ambiental** (só para itens "quente"): economia mensal/anual e CO₂ evitado, a
  partir de perda com/sem isolante, combustível selecionado e regime de operação
  (horas/dia, dias/semana).

### Combustíveis (`COMBUSTIVEIS` em `lib/calculadora-termica.ts`)
Fonte: `2-DocumentaçãoTecnica/materials_internal.py`. 7 combustíveis (Vapor, Eletricidade,
Gás Natural, GLP, Óleo Diesel, Óleo Combustível BPF, Lenha de Eucalipto), cada um com custo
de referência, poder calorífico, eficiência do equipamento e fator de emissão de CO₂.

> ⚠️ **Ponto a revisar**: o fator de emissão da lenha de eucalipto é 0,05 kg CO₂/ton — bem
> menor que o valor antigo do código Python (1260, provável erro de unidade). O valor novo
> reflete a convenção de neutralidade de carbono da biomassa, mas isso faz o "CO₂ evitado"
> reportado para clientes com caldeira a lenha ficar praticamente zero. Vale uma segunda
> opinião sobre se essa é a forma certa de comunicar isso numa proposta comercial.

## 5. Quantificação de materiais (`lib/quantificador.ts`) — "Método Expert"

Fórmulas confirmadas em `ISOLAMENTO-FIXO.xlsx` (aba ISOLA) e no briefing original:

```
manta_kg     = espessura_m × área_m² × densidade_material × 1,20
chapa_kg     = espessura_m × área_m² × densidade_chapa    × 1,30
rebites      = ceil(área_m² × 20)
parafusos    = ceil(área_m² × 20)
arame_kg     = área_m² × 0,5   (500 g/m²)
vedacao_pu   = ceil(perímetro_m / 1,5)
vedacit_un   = ceil(vedacao_pu × gramas_por_junta / 360)
```

> ⚠️ **Assunção não documentada**: `gramas_por_junta` (padrão 50 g) não tem referência nas
> planilhas/documentos originais — foi uma estimativa para fechar a fórmula do Vedacit, que
> na fonte original só tinha "~R$45 a lata de 360g" (preço, não rendimento). Configurável em
> Configurar Preços, mas precisa validação com a operação real.
>
> A densidade da manta usa `materiais_isolantes.densidade_kg_m3` (do material isolante
> escolhido); a densidade da chapa usa `precos_config.densidade_kg_m3` (do cadastro de
> preços, ex.: aço galvanizado ~7850 kg/m³) — são fontes diferentes de propósito, mas vale
> confirmar se faz sentido para quem for revisar.

## 6. Motor financeiro (`lib/orcamento.ts`, `lib/tributos.ts`)

**Método de precificação: markup divisor** — impostos e margem de lucro são um percentual
do **preço de venda**, não do custo:

```
custoTotal   = materiais + mão de obra + deslocamento + hospedagem + frete
percentual   = %impostos + %margem
precoCheio   = custoTotal / (1 - percentual/100)
valorImposto = precoCheio × %imposto (por imposto, na lista)
margemLucro  = precoCheio × %margem
valorDesconto= precoCheio × %desconto
valorFinal   = precoCheio − valorDesconto
```

Bloqueia com erro explícito se `%impostos + %margem ≥ 100%`.

**Impostos**: `config_empresa.regime_tributario` ∈ `{simples_nacional, lucro_presumido,
personalizado}`.
- `simples_nacional`: alíquota efetiva calculada pela fórmula oficial (Anexo III ou IV,
  tabelas da LC 123/2006 hardcoded em `lib/tributos.ts`) sobre o RBT12 (receita bruta dos
  últimos 12 meses, informado pelo usuário). **Anexo IV está como padrão do sistema — não
  confirmado com contador.** Bloqueia o cálculo se RBT12 = 0.
- `lucro_presumido` / `personalizado`: sem imposto "base" automático — depende inteiramente
  da lista `impostos_config` (para lucro presumido, a intenção era pré-popular PIS/COFINS/
  ISS/IRPJ/CSLL, mas isso **não está implementado na UI ainda** — só existe a constante
  `IMPOSTOS_LUCRO_PRESUMIDO_PADRAO` em `lib/tributos.ts`, não conectada a nada).
- Qualquer imposto extra ativo em `impostos_config` é somado ao percentual base.

> ⚠️ **Ponto a revisar**: o app assume que a empresa realmente vai operar dentro do Simples
> Nacional (limite de R$ 4,8 milhões/ano) e que o enquadramento em serviços de instalação
> cai no Anexo IV. Nenhuma dessas duas coisas foi confirmada com contador — são defaults
> razoáveis, não fatos verificados.

## 7. Fluxo de criação de orçamento (wizard)

`app/novo-orcamento/step-1-cliente` → `step-2-especificacoes` → `step-3-calculos` →
`step-4-precos` → `step-5-revisao`, estado compartilhado via Zustand (`lib/store.ts`,
persistido em localStorage do navegador — **não hidrata entre dispositivos/abas
diferentes**, e não expira: um rascunho esquecido fica lá indefinidamente).

- Step 1: busca ou cadastra cliente.
- Step 2: especificações de **um item/trecho** (material, acabamento, geometria,
  temperaturas, camadas de espessura, etc.).
- Step 3: calcula esse item (térmico + quantificação) e permite "Adicionar outro trecho"
  (volta pro step 2 com um rascunho novo) ou seguir — suporta múltiplos itens no mesmo
  orçamento (base do "misto").
- Step 4: custos operacionais (únicos para o orçamento inteiro, não por item) + cálculo
  financeiro final.
- Step 5: revisão de tudo, salva como rascunho ou como proposta.

## 8. Propostas em PDF

Duas propostas geradas via `html2canvas` (screenshot do componente React) + `jsPDF`
(`lib/pdf-generator.ts`), acessíveis em `/orcamento/[id]/download-pdf`:

- **Proposta Técnica** (`components/PDFPreviewTecnica.tsx`): conceitual, sem valores.
  Explica os princípios físicos, adapta o texto conforme o orçamento seja quente/frio/misto,
  detalha economia energética e/ou prevenção de condensação por item. Tem uma seção de
  imagens que só aparece se houver fotos cadastradas em `imagens_proposta` — **hoje está
  vazia**, nenhuma foto foi cadastrada ainda.
- **Proposta Comercial** (`components/PDFPreviewComercial.tsx`): com valores, detalhamento
  de materiais por item e de impostos.

> Limitação conhecida: geração de PDF via screenshot (html2canvas) é sensível a fontes,
> quebras de página e pode ficar pesado/lento para orçamentos com muitos itens — não foi
> testado com um orçamento grande de verdade ainda.

## 9. Autenticação

Supabase Auth (email + senha). Um único login hoje: usuário `BR-ISOLAMENTO` (apelido
resolvido para um email fixo em `lib/auth-usuarios.ts`, hardcoded no código — não vem do
banco). RLS de todas as tabelas exige apenas "autenticado", sem diferenciação por usuário/
role.

> ⚠️ Isso significa que qualquer pessoa com uma conta autenticada válida (hoje só 1) tem
> acesso total a clientes, preços e orçamentos — não há controle de permissão granular.
> Aceitável para uso interno de poucas pessoas, mas seria um problema se o time crescer.

## 10. Estado atual / pendências conhecidas (não é trabalho da IA revisora resolver, mas é
    contexto necessário para não sugerir "melhorias" que já estão nos planos)

- Preços em `precos_config` ainda **zerados** — orçamentos gerados hoje têm valor
  financeiro incorreto até serem preenchidos.
- `simples_nacional_rbt12` ainda **zerado** — cálculo de orçamento bloqueia até ser
  preenchido.
- Usuário único do Supabase Auth precisa ser criado manualmente (não é possível via código
  com a anon key disponível).
- Densidade de 4 materiais isolantes (Aerogel Pyrogel/Cryogel, Perlita Expandida,
  Vermiculita Exfoliada) são estimativas de literatura, não da fonte de dados real.
- Nenhuma foto foi cadastrada na galeria da Proposta Técnica ainda.
- Sem testes automatizados (unitários ou e2e) em nenhuma parte do sistema.
- Sem tratamento de "orçamento grande" (muitos itens) testado ponta a ponta.

## 11. Estrutura de pastas (resumo)

```
app/
  page.tsx                       Dashboard
  login/                         Login
  novo-orcamento/step-1..5/      Wizard de criação
  orcamento/[id]/                Detalhe, editar, download-pdf
  config-precos/                 Preços, impostos, regime tributário, galeria de imagens
  historico/                     Lista/filtros de orçamentos
  api/                           Route handlers (cálculo térmico, quantificação, orçamento,
                                  auth, CRUD de orçamentos/clientes/preços/impostos)
lib/
  calculadora-termica.ts         Motor físico
  quantificador.ts                Método Expert de quantificação
  orcamento.ts / tributos.ts     Motor financeiro + Simples Nacional
  store.ts                        Estado do wizard (Zustand)
  supabase/{client,server,middleware}.ts
components/                       Formulários, tabelas, previews de PDF, galeria de imagens
sql-schema.sql                    Schema completo (instalação nova)
sql-migration-002.sql             Migração incremental (banco já em produção)
```

## 12. Perguntas em aberto para quem for revisar

1. O modelo "1 login compartilhado, sem diferenciação de permissão" é aceitável a médio
   prazo, ou vale investir em papéis (admin vs. consultor) desde já?
2. A precificação por markup divisor está correta para o caso de uso, ou a empresa tem
   alguma particularidade de negociação que não se encaixa nesse modelo (ex.: descontos por
   volume, contratos recorrentes)?
3. O fluxo de wizard com múltiplos itens (para orçamento misto) é intuitivo o suficiente,
   ou merece uma revisão de UX?
4. Vale a pena migrar a geração de PDF de html2canvas+jsPDF para algo mais robusto (ex.:
   geração server-side) antes de escalar o uso?
5. Existe necessidade de histórico/auditoria de alterações em orçamentos (quem mudou o quê
   e quando), hoje inexistente?
