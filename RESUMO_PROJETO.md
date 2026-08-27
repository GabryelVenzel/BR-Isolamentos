# BR Isolamentos — Resumo Técnico do Projeto

> Documento gerado para consulta externa (outra pessoa, outra IA, outra ferramenta de
> revisão). Descreve o estado atual do sistema — arquitetura, módulos, telas, funções,
> modelo de dados, decisões tomadas e pontos em aberto — com detalhe suficiente para
> alguém sem acesso prévio ao código avaliar o projeto e sugerir melhorias com contexto
> real. Não contém credenciais nem segredos.
>
> Última atualização: 26/08/2026, depois de uma rodada extensa de trabalho que adicionou
> os módulos Comercial/Operacional/Financeiro/Resumo completos, reescreveu o motor de
> cálculo de orçamento (quantificação de materiais e mão de obra automáticas) e trocou o
> motor de geração de PDF por um nativo (vetorial). Este documento substitui integralmente
> a versão anterior, que descrevia só o estado inicial (calculadora de orçamento isolada).

---

## 1. Contexto do negócio

Empresa de prestação de serviços de isolamento térmico (quente e frio) para tubulações e
superfícies planas, localizada em Mogi das Cruzes, SP. O sistema é um **ERP interno** que
cobre o ciclo completo do negócio: captação de lead (Comercial) → orçamento técnico e
comercial (Engenharia/Orçamento) → execução da obra (Operacional) → faturamento
(Financeiro) → visão consolidada (Resumo). Substitui uma combinação de planilha Excel +
uma calculadora interna em Python/Streamlit (a calculadora térmica foi portada fielmente
para dentro do sistema; ver seção 6).

Uso interno, hoje com **login único compartilhado** via Supabase Auth (não há
diferenciação de permissão entre usuários — ver seção 11).

## 2. Stack técnica

- **Next.js 14** (App Router) + **TypeScript** (modo estrito) + **Tailwind CSS 3**
- **Supabase**: Postgres (dados, com Row Level Security em todas as tabelas), Auth
  (email + senha), Storage (múltiplos buckets — fotos de propostas, anexos de lead,
  serviço, parceiro, fornecedor e lançamento financeiro)
- **Zustand** (`lib/store.ts`) — estado do wizard de criação de orçamento, persistido em
  `localStorage` do navegador
- **Zod v4** — validação de entrada em toda a camada de use cases (`lib/validators/`)
- **@react-pdf/renderer** — geração de PDF **nativo/vetorial** (texto selecionável,
  paginação A4 real) para as duas Propostas de orçamento (Técnica e Comercial)
- **docx** — geração de arquivo Word (.docx) para as mesmas duas Propostas
- **html2canvas + jsPDF** — ainda usado, mas só para os PDFs do dashboard Resumo
  (gráficos Recharts/SVG, que o react-pdf não consegue desenhar diretamente) — ver seção
  9.2 para o porquê da divisão
- **Recharts** — gráficos do dashboard Resumo
- **Jest** + **@testing-library/react** — testes unitários (208 testes, só lógica pura —
  ver seção 12)
- **react-hook-form** — listado como dependência, pouco usado (a maioria dos formulários
  usa `useState` simples)
- Deploy: **Vercel**. Repositório: GitHub (privado, branch `main`).

## 3. Arquitetura de código

Desde a versão inicial, o projeto adotou uma camada de arquitetura em 3 níveis, replicada
de forma consistente para cada um dos 6 módulos:

```
app/api/<módulo>/.../route.ts   → Route handler HTTP fino: só faz parse do body,
                                    chama o Context, e devolve JSON (apiSuccess/apiError).
lib/contexts/<módulo>.ts        → Fachada única de acesso ao módulo: instancia os
                                    Repositories com o client Supabase da requisição atual
                                    e expõe métodos de negócio (ex.: `moverLead`,
                                    `criarServico`) que por trás chamam um Use Case.
lib/usecases/<módulo>/*.ts      → Regra de negócio pura (ou quase pura — algumas fazem
                                    I/O via repos injetados por parâmetro, não globais).
                                    Validam entrada com Zod (lib/validators/) e lançam
                                    erros tipados (lib/errors.ts: NotFoundError,
                                    ValidationError, ConflictError, OrcamentoConfigError).
lib/repositories/*.repository.ts → Uma classe por tabela, estende `BaseRepository<T>`
                                    (CRUD genérico: findById, create, update, delete) e
                                    adiciona queries específicas (joins, filtros).
```

Isso significa que **nenhuma tela ou componente chama o Supabase diretamente** para
regra de negócio — só os Repositories fazem isso (upload direto ao Storage a partir do
navegador é a única exceção deliberada, usada em todos os componentes de anexo/galeria:
o arquivo vai direto do navegador pro bucket, e só a URL resultante é enviada pra API).

Cada módulo (Comercial, Operacional, Financeiro, Resumo, Orçamento, Engenharia) tem um
arquivo `lib/contexts/<módulo>.ts` que é o único ponto de entrada usado pelas rotas de
API daquele módulo — funciona como um "service layer" único por módulo.

## 4. Os 6 módulos do sistema

A navegação principal (`components/Navbar.tsx`) tem 6 itens fixos. "Orçamento" agrupa 3
rotas de topo históricas sem prefixo de URL comum (`/historico`, `/novo-orcamento`,
`/config-precos`).

### 4.1 Resumo (`/resumo`) — dashboard executivo, tela inicial pós-login

- 4 abas internas (`components/modules/resumo/Dashboard{Geral,Comercial,Operacao,
  Financeira}.tsx`), cada uma com KPIs (`KPICard.tsx`) e gráficos Recharts próprios
  (funil de leads, receita vs. despesa, distribuição por tipo, top parceiros, projeção de
  caixa 30 dias).
- `AlertsBanner.tsx` — alertas cross-módulo (ex.: lead atrasado, custo fixo vencendo).
- Cada aba tem exportação em **PDF** (via `lib/pdf-generator.ts`, motor html2canvas — ver
  seção 9.2) e **CSV**.
- `lib/usecases/resumo/*` — funções puras de agregação (KPIs, funil, distribuição,
  projeção de caixa), consumidas pelos endpoints `app/api/resumo/**`.

### 4.2 Engenharia (`/engenharia`) — calculadora térmica avulsa

Tela única com uma calculadora rápida (não vinculada a nenhum orçamento) que expõe o
mesmo motor físico usado no wizard de orçamento (`lib/calculadora-termica.ts`) para
consulta pontual — útil para responder "quanto isolante preciso aqui" sem abrir o fluxo
completo de proposta. `CalculadoraForm.tsx` + `EconomiaSection.tsx` (a mesma tabela de
combustíveis de referência usada no wizard).

### 4.3 Comercial (`/comercial`) — CRM (funil de vendas)

- **Kanban de leads** (`KanbanBoard.tsx` + `LeadCardKanban.tsx`), etapas: Prospecção →
  Contato → Proposta → Negociação → Fechado / Perdido. Drag-and-drop é a única forma de
  mudar de etapa.
  - Mover para "Negociação" **exige** um orçamento vinculado (bloqueio movido de
    "Proposta" pra "Negociação" numa revisão recente — ver `moverLead.ts`).
  - Leads têm "temperatura" (quente/morno/frio). Marcar como **frio** agenda uma
    reativação automática (dias configuráveis por etapa, `mudarTemperatura.ts` +
    `AgendamentoLeadFrio`); o lead some do Kanban padrão enquanto frio e volta sozinho
    pra etapa **"prospecção"** (não a etapa de onde saiu) quando o prazo vence — checado
    sob demanda (`verificarReativacoesPendentes.ts`, chamado no início de toda listagem
    de leads, não um cron de verdade). O card mostra um badge "🔄 Retorno de
    Agendamento" quando `temperatura === "morno" && temperatura_anterior === "frio"`.
  - `Lead.valor_estimado` é **independente** do orçamento vinculado — vincular/trocar um
    orçamento não sobrescreve mais esse campo (decisão revertida numa rodada recente).
- **Detalhe do lead** (`LeadDetailModal.tsx`, modal, não rota própria — mas
  `app/comercial/[id]/page.tsx` existe como link direto/compartilhável pro mesmo
  conteúdo): dados, histórico de mudanças de etapa/temperatura, interações (timeline de
  contatos), anexos (`AnexosLead.tsx` — tabela própria `anexos_lead`, qualquer tipo de
  arquivo até 10MB, até 5 por lead).
- **Clientes** (`ClientesTab.tsx`) — cadastro compartilhado com o módulo Orçamento.
- **Leads Frios** (`LeadsFriosPanel.tsx`) — lista de agendamentos de reativação pendentes,
  permite cancelar antecipadamente.
- **Configurações** (`ConfiguracoesTab.tsx`) — responsáveis (roster usado também em
  Operacional para "Responsável do Serviço"), prazo máximo por etapa (marca lead como
  "atrasado"), dias de reativação por etapa de lead frio.
- **Relatórios** — funil de conversão, performance por responsável, tempo médio por
  etapa (`lib/usecases/comercial/relatorio.ts`).

### 4.4 Operacional (`/operacional`) — execução de obras

- **Serviços** (`/operacional/servicos`) — Kanban de obras (Planejamento → Execução →
  Finalizado), único jeito de mudar etapa é arrastar o card; soltar em "Finalizado" abre
  o checklist de finalização em vez de mover direto.
  - Um serviço nasce de um lead **fechado** (`NovoServicoModal.tsx` — rastreabilidade
    Lead→Orçamento→Serviço, código curto O00001/L00001/S00001 gerado por trigger SQL).
  - **Parceiros vinculados**: um serviço pode ter **N parceiros**, cada um com seu
    próprio headcount ("pessoas mobilizadas") e tipos de trabalho
    (`servico_parceiros_execucao`, ver seção 5) — substitui um modelo antigo de "1
    parceiro principal + parceiros de apoio sem headcount". Adicionados/removidos na
    tela de Detalhes (`ModalAdicionarParceiroServico.tsx`), não na criação do serviço.
  - **Anexos**: uma única seção "Fotos do Projeto" (grid de thumbnails, até 20 fotos) +
    PDF Relatório (obrigatório pra finalizar). Requisito de finalização = fotos (mín. 1)
    + PDF — **não exige mais valor real** (removido; se informado, alimenta o relatório
    "Custo Real vs Orçado" do Resumo, senão o lançamento de receita automático usa o
    valor orçado como estimativa).
  - Finalizar um serviço cria automaticamente um **lançamento de receita pendente** no
    Financeiro (`finalizarServico.ts`).
- **Parceiros** (`/operacional/parceiros`) — cadastro de mão de obra terceirizada:
  tipos de trabalho (Bancada/Caldeiraria/Isolamentos Removíveis/Isolamentos Fixos),
  capacidade total de pessoas, Estado (dropdown fixo de 27 UF), anexos (documentação,
  só na edição, até 10 arquivos/20MB).
- **Fornecedores** (`/operacional/fornecedores`) — cadastro de materiais/equipamentos:
  "Tipos de fornecimento" (Isolantes/Chaparia/Ferramentas/Ferragens/Outros) em **múltipla
  escolha** (um fornecedor pode ter mais de uma categoria), filtro por tipo na listagem
  (`FiltroFornecedores.tsx`), anexos (mesmo padrão de Parceiros).
- **Capacidade** — soma `pessoas_mobilizadas` de **todos** os parceiros vinculados a
  serviços ativos num dia (`lib/usecases/operacional/capacidade.ts`), usada no calendário
  da Agenda para indicar dias "livre/atenção/crítico".
- **Agenda** — calendário mensal de execução (não alterado nas últimas rodadas de
  trabalho).

### 4.5 Orçamento — wizard de criação + histórico + configuração de preços

Ver seções 7 e 8 (motor de cálculo) e 9 (propostas) para o fluxo completo. Telas:
`/novo-orcamento/step-1..5`, `/historico`, `/config-precos`, `/orcamento/[id]`
(detalhe/resumo), `/orcamento/[id]/editar` (ajuste pós-criação), `/orcamento/[id]/
download-pdf` (as duas Propostas).

### 4.6 Financeiro (`/financeiro`)

- **Lançamentos** (`/financeiro/lancamentos`) — receitas/despesas avulsas, com anexos de
  PDF (até 5, 10MB cada, upload visual em card — `AnexosUpload.tsx`) e campo reservado
  `statusValidacao` (pending/coherent/inconsistent/error — infraestrutura pronta pra uma
  futura validação por IA dos anexos, ainda não usada).
- **Custos Fixos** (`/financeiro/custos-fixos`) — despesas recorrentes mensais, com dia
  de pagamento e histórico de pagamento mês a mês (`historico_custos_fixos`).
- **Categorias** (`/financeiro/categorias`) — categorias de lançamento, centralizadas
  (usadas tanto em Lançamentos quanto em Custos Fixos).
- **Configurações** (`/financeiro/configurações`) — parâmetros do ciclo financeiro.
- **Relatórios** — receita vs. despesa, saldo projetado (`lib/usecases/financeiro/
  relatorio.ts`).

## 5. Modelo de dados (Postgres/Supabase)

Todas as tabelas têm RLS habilitado, política única `for all to authenticated using
(true)` (qualquer usuário autenticado tem acesso total — não há diferenciação de
papel/role hoje, apesar de existir um campo `role` em `usuarios`).

O schema evoluiu por **19 migrações incrementais** (`sql-schema.sql` + `sql-migration-
002.sql` até `sql-migration-019-....sql`), todas aditivas/idempotentes (usam `if not
exists`/`if exists`, nunca fazem `drop table`/`drop column` de dado real — a única
exceção documentada é uma coluna `especialidade` removida de `parceiros` porque tinha
sido adicionada por engano na migração anterior, sem nenhum dado real dependendo dela).
**As migrações 005 a 019 ainda precisam ser aplicadas manualmente no SQL Editor do
Supabase em produção** — cada uma tem instruções de verificação no rodapé do arquivo.

### 5.1 Tabelas centrais (Orçamento/Cliente)

| Tabela | Papel |
|---|---|
| `usuarios` | Perfil complementar ao Supabase Auth (email, nome, telefone, role) |
| `clientes` | Clientes (compartilhado entre Comercial e Orçamento) |
| `orcamentos` | Cabeçalho: cliente, `tipo_trabalho` (quente/frio/misto, derivado), `tipo_proposta` (`material_mo`/`somente_mo`), financeiro agregado, status, `atribuido_a` |
| `itens_orcamento` | Um "trecho" técnico por linha: `escopo_itens` (jsonb, lista de itens de área/tubo/curva), material/acabamento (nome + especificação), resultado térmico, `trabalho_altura`, `eficiencia_global`, preços/subtotais por m² |
| `materiais_isolantes` | Catálogo FÍSICO: nome, `k_func` (condutividade em função de T), t_min/t_max, densidade, categoria — usado só pelo motor de cálculo térmico |
| `acabamentos` | Catálogo físico de acabamentos: nome, emissividade |
| `precos_config` | Catálogo COMERCIAL por m² (chaparia Inox/Galvanizado/Alumínio × 4 espessuras; isolante Fibra Cerâmica/Lã de Rocha × 4 densidades + Espuma Elastomérica única; + 4 "Materiais Adicionais" — Arame/Parafuso/Rebite/Silicone, preço por unidade própria) — ver seção 8 |
| `impostos_config` | Lista livre de impostos extras somados por cima do imposto "base" do regime tributário |
| `config_empresa` | Linha única: regime tributário, RBT12, margem de lucro, custos operacionais (mão de obra/km/hospedagem/frete), + 12 parâmetros do motor de quantificação/mão de obra automática (seção 8.2) |
| `imagens_proposta` | Galeria de fotos de referência (Storage bucket `propostas-imagens`), usada na Proposta Técnica |

`materiais_isolantes`/`acabamentos` (catálogo **físico**, usado só na física do cálculo
térmico) e `precos_config` (catálogo **comercial**, o que aparece pro usuário escolher)
são deliberadamente desacoplados — não têm as mesmas densidades/nomes. A ponte entre os
dois (`lib/usecases/orcamento/materialFisico.ts`) escolhe, dentro da mesma categoria, o
material físico de densidade mais próxima da densidade comercial escolhida — não exige
que os dois catálogos batam 1:1.

### 5.2 Módulo Comercial

`leads`, `historico_mudancas_leads`, `interacoes_lead`, `anexos_lead`,
`agendamentos_lead_frio`, `config_reativacao_leads_frios`, `config_prazo_etapas`.

### 5.3 Módulo Operacional

`parceiros`, `fornecedores`, `servicos`, `historico_servicos`, `interacoes_servico`,
`agendamentos`, `servico_parceiros_execucao` (múltiplos parceiros por serviço, cada linha
com `pessoas_mobilizadas`/`tipos_trabalho` próprios), `parceiro_anexos`,
`fornecedor_anexos`.

### 5.4 Módulo Financeiro

`lancamentos_financeiros` (campo `anexos` jsonb — array de `{url, nome, tamanho,
statusValidacao, notasValidacao}`, não uma tabela própria, porque um lançamento tem no
máximo 5 anexos), `custos_fixos`, `historico_custos_fixos`, `categorias_lancamento`,
`config_financeiro`.

### 5.5 Convenções observadas no schema

- Cada módulo tem seu próprio sistema de código curto sequencial via trigger SQL:
  O00001 (orçamento), L00001 (lead), S00001 (serviço), P00001 (parceiro), F00001
  (fornecedor) — gerados em `before insert`, não confundir com `orcamentos.numero`
  ("ORC-2026-0001", o número "oficial" da proposta, já impresso em PDFs antigos).
- Padrão de anexos: a maioria dos módulos usa uma **tabela própria** (uma linha por
  arquivo — `anexos_lead`, `parceiro_anexos`, `fornecedor_anexos`); só
  `lancamentos_financeiros.anexos` usa **jsonb** (decisão deliberada: reserva campos de
  uma futura validação por IA, e o limite é sempre pequeno — 5 arquivos).
- Colunas/tabelas **nunca são removidas** quando uma feature muda de formato — ficam
  marcadas `@deprecated` no código TypeScript (`lib/types.ts`) e o app para de escrever
  nelas, mas o dado histórico continua acessível. Exemplos: `orcamentos` ainda tem
  colunas do modelo antigo "Método Expert" (pré-migração 010); `servicos.
  parceiro_principal_id`/`foto_principal_url` (pré-migração 013).

## 6. Motor de cálculo térmico (`lib/calculadora-termica.ts`)

Porte fiel de uma calculadora Python/Streamlit já usada pela empresa
(`2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py`), seguindo ASTM C680 / ISO 12241 / ABNT
NBR 16281. **Não foi alterado** nas rodadas recentes de trabalho — permanece a fonte de
verdade da física.

- **Condução** através da(s) camada(s) de isolante: placa plana (`k·ΔT/L`) ou tubulação
  (log de raio interno/externo).
- **Convecção** na face externa: natural (Rayleigh) ou forçada (Reynolds, se vento ≥ 1
  m/s).
- **Radiação** na face externa (Stefan-Boltzmann, usa a emissividade do acabamento
  escolhido).
- Temperatura de face fria por **busca iterativa** (bisseção) até condução = convecção +
  radiação.
- **Frio/condensação**: ponto de orvalho (fórmula de Magnus) + busca da menor espessura
  que mantém a face fria acima do ponto de orvalho.
- **Financeiro/ambiental** (só "quente"): economia mensal/anual e CO₂ evitado, a partir
  de perda com/sem isolante, combustível e regime de operação (horas/dia, dias/semana).
  Combustíveis de referência em `COMBUSTIVEIS` (`lib/calculadora-termica.ts`): Vapor,
  Eletricidade, Gás Natural, GLP, Óleo Diesel, Óleo BPF, Lenha de Eucalipto.

> ⚠️ **Ponto a revisar (herdado, não resolvido)**: o fator de emissão da lenha de
> eucalipto é bem menor que o valor do código Python original (convenção de
> neutralidade de carbono da biomassa) — o "CO₂ evitado" para clientes com caldeira a
> lenha fica praticamente zero. Vale confirmar se essa é a forma certa de comunicar isso
> numa proposta comercial.

## 7. Fluxo de criação de orçamento (wizard, 5 telas)

`app/novo-orcamento/step-1-cliente` → `step-2-escopo` → `step-3-especificacoes` →
`step-4-precos` → `step-5-revisao`. Estado compartilhado via Zustand
(`useWizardStore`, `lib/store.ts`), persistido em `localStorage` — não hidrata entre
dispositivos, e um rascunho esquecido fica lá indefinidamente (sem expiração).

Um orçamento pode ter **múltiplos trechos** (`WizardItem[]`) — ex.: linha de vapor
quente + linha de água gelada no mesmo projeto ("orçamento misto"). O usuário preenche
Escopo + Especificações + Preços um trecho por vez; ao confirmar (Tela 4 → "Próximo"), o
trecho entra na lista e, se for o último, segue pra Revisão.

- **Tela 1 (Cliente)**: busca/cadastra cliente + escolhe **Tipo de Proposta**
  (`tipoProposta`, vale pro orçamento inteiro): "Material + Mão de Obra" (padrão) ou
  "Somente Mão de Obra" (zera todo o custo de material no cálculo final).
- **Tela 2 (Escopo)**: lista de itens de área do trecho atual — Tubulação (`π × Ø(m) ×
  comprimento(m)`), Curva (`π × Ø(m) × 1,5 × 0,5 × quantidade`), Plano (metragem manual).
  Soma vira a metragem total do trecho. Também define aqui o toggle **"Trabalho em
  altura (> 2m)?"** — único fator de mão de obra sem como ser deduzido do Escopo (ver
  seção 8.2; "tem curvas" e "tubulação < 4"" já são deduzidos automaticamente dos itens
  cadastrados aqui, não pedidos de novo).
- **Tela 3 (Especificações)**: tipo de trabalho (quente/frio, nunca os dois no mesmo
  trecho), material isolante e acabamento — escolhidos do catálogo comercial
  (`precos_config`) OU digitados como **"Outro material"** (nome + preço manual por m²,
  sem dado físico cadastrado — nesse caso o trecho **pula o cálculo térmico** e vai
  direto pra Preços só com quantificação/preço). Temperaturas, economia de energia
  (combustível/horas de operação, só "quente"). Roda o cálculo térmico
  (`/api/calcular-termico`) ao avançar.
- **Tela 4 (Preços)** — a mais complexa, reescrita recentemente:
  - **Resumo técnico**: análise térmica em caixas (Temperatura, Perda de Energia,
    Economia e Sustentabilidade) — vazio/avisado se o trecho usa material customizado.
  - **Quantificação de materiais e mão de obra**: tabela com uma linha por material
    (Isolante, Acabamento, Rebite, Parafuso, Arame, Silicone) + Mão de obra, cada uma
    com quantidade/preço calculados automaticamente (seção 8) e um ícone de lápis que
    abre um modal único pra sobrescrever quantidade e/ou preço **só deste orçamento**
    (não altera o catálogo/parâmetros globais).
  - **Custos operacionais** (deslocamento/hospedagem/frete/desconto extra) — editados
    aqui, valem pro orçamento inteiro (não por trecho); o resumo financeiro final
    continua exibido na Revisão.
  - Botões: "← Voltar" e "Próximo →" (que confirma o trecho e vai pra Revisão — "+
    Adicionar outro trecho" foi removido daqui, essa ação já existe na Revisão).
- **Tela 5 (Revisão)**: lista de todos os trechos (com Editar/Excluir, que reabre o
  trecho no Escopo), resumo financeiro final (`calcularOrcamento`), botões "Salvar
  rascunho" / "Gerar Proposta PDF/Word →" e "+ Adicionar novo trecho".

## 8. Motores de cálculo do orçamento

### 8.1 Quantificação de materiais (`lib/usecases/orcamento/quantificarMateriais.ts`)

Substituiu o "Método Expert" antigo (kg, descontinuado na migração 010 — ver seção 8.4).
Toda fórmula parte da **metragem total do trecho** (m²) e de parâmetros configuráveis em
`config_empresa` (editáveis em Configurar Preços, seção "Quantificação de materiais"):

```
isolante_m2    = metragem × (1 + isolante_acrescimo_percentual/100)   [padrão 20%]
acabamento_m2  = metragem × (1 + acabamento_acrescimo_percentual/100) [padrão 30%]
rebite_un      = round(metragem × rebite_por_m2)                      [padrão 20/m²]
parafuso_un    = round(metragem × parafusos_por_m2)                   [padrão 20/m²]
arame_g        = metragem × arame_gramas_por_m2                       [padrão 500g/m²]
silicone_frascos = round(metragem / silicone_intervalo_m2)            [padrão 1 a cada 2m²]
```

Os 4 materiais adicionais (Arame/Parafuso/Rebite/Silicone) têm preço próprio no catálogo
comercial (`precos_config`, tipos `acessorio_*`), com unidade própria (kg/centena/frasco,
não m²).

### 8.2 Mão de obra automática (`lib/usecases/orcamento/calcularMaoObraAutomatica.ts`)

Substituiu um campo manual "Mão de obra (horas)" que existia no wizard. Referência: 1
dupla (2 pessoas) = `m2_por_hora_dupla` m²/hora (padrão 2), jornada de `horas_uteis_dia`
horas (padrão 9). A eficiência é o **produto** (nunca soma) de todos os fatores que se
aplicam ao trecho:

```
eficiência = (tubulação < 4"? × eficiencia_tubulacao_pequena : 1)
           × (tem curvas?     × eficiencia_curva             : 1)
           × (trabalho altura? × eficiencia_altura            : 1)
           × eficiencia_fator_br   [sempre aplicado — rendimento da dupla brasileira]

horas_base      = metragem ÷ m2_por_hora_dupla
horas_ajustadas = horas_base ÷ eficiência
dias_necessarios = horas_ajustadas ÷ horas_uteis_dia
```

"Tem curvas" e "tubulação < 4" (101,6mm)" são **deduzidos automaticamente** dos itens de
Escopo do trecho (`temCurvasNoEscopo`/`temTubulacaoPequena`, `lib/usecases/orcamento/
escopo.ts`) — não são campos manuais. "Trabalho em altura" é o único fator sem esse
proxy, definido manualmente na Tela 2.

### 8.3 Precificação do trecho (`lib/usecases/orcamento/precificarTrecho.ts`)

Combina os dois motores acima: soma o custo de todos os materiais (ou zera, se
`tipo_proposta === "somente_mo"`) + `horas_ajustadas × valor_hora_mao_obra`. Overrides
feitos na Tela 4 (lápis por linha) substituem os valores calculados só para aquele
trecho/orçamento.

### 8.4 Motor financeiro do orçamento inteiro (`lib/orcamento.ts`, `lib/tributos.ts`)

**Método de precificação: markup divisor** — impostos e margem são um percentual do
**preço de venda**, não do custo. Opera sobre o ORÇAMENTO INTEIRO (soma de todos os
trechos), não trecho a trecho — o regime tributário não muda de trecho pra trecho.

```
custoTotal    = Σ(subtotal_material + subtotal_mao_obra dos trechos) + deslocamento + hospedagem + frete
percentual    = %impostos + %margem
precoCheio    = custoTotal / (1 − percentual/100)
valorImposto  = precoCheio × %imposto (por imposto da lista)
margemLucro   = precoCheio × %margem
valorDesconto = precoCheio × %desconto   [0% por padrão — não é mais um valor configurável escondido]
valorFinal    = precoCheio − valorDesconto
```

Bloqueia com erro explícito se `%impostos + %margem ≥ 100%`.

**Impostos**: `config_empresa.regime_tributario` ∈ `{simples_nacional, lucro_presumido,
personalizado}`.
- `simples_nacional`: alíquota efetiva pela fórmula oficial (Anexo III ou IV, LC
  123/2006, `lib/tributos.ts`) sobre o RBT12 informado. **Anexo IV é o padrão do
  sistema — não confirmado com contador.** Bloqueia se RBT12 = 0.
- `lucro_presumido`/`personalizado`: sem imposto "base" automático, depende
  inteiramente da lista `impostos_config`.

> ⚠️ **Ponto a revisar (herdado)**: o enquadramento no Simples Nacional/Anexo IV é
> um default razoável, não confirmado com contador.

### 8.5 Modelo "Método Expert" (legado, `lib/quantificador.ts`)

O modelo antigo de quantificação em **kg** (manta/chapa/rebite/parafuso/arame/vedação
PU/vedacit) foi **descontinuado para orçamentos novos** na migração 010, substituído
pelo catálogo comercial por m² (seção 8.1). O código continua existindo só para exibir
corretamente orçamentos criados antes dessa migração — `/api/quantificar` ficou órfão
(nenhuma tela atual o chama).

## 9. Propostas de orçamento

### 9.1 PDF nativo (`components/pdf-native/*.tsx`, via `@react-pdf/renderer`)

Substituiu a geração por captura de tela (html2canvas + jsPDF) — o motor antigo produzia
uma imagem PNG por página (texto não selecionável, resolução limitada, corte se o
conteúdo passasse da margem). O motor novo desenha o PDF de verdade (texto, tabelas,
linhas como primitivos do formato) e pagina em A4 sozinho.

- **Proposta Técnica** (`PropostaTecnicaDocument.tsx`): conceitual — por que isolar,
  princípios físicos, blocos de economia/CO₂ (quente) ou prevenção de condensação
  (frio) por trecho, escopo contemplado, tabela de especificação técnica por trecho,
  galeria de imagens de referência (se houver fotos em `imagens_proposta`). Só fontes
  nativas (Helvetica) — sem fonte de marca customizada, decisão deliberada pra não
  arriscar quebrar a geração por causa de um `Font.register()` de rede.
- **Proposta Comercial** (`PropostaComercialDocument.tsx`): com valores — especificações
  técnicas, detalhamento de materiais por trecho (R$/m², só se não for orçamento
  "legado" pré-migração 010), custos operacionais, resumo financeiro completo (todos os
  impostos + margem + desconto), benefícios (economia/CO₂).
- Preview ao vivo na tela via `<PDFViewer>` (iframe com o PDF de verdade, não uma prévia
  HTML separada que podia divergir do arquivo baixado).
- Acessível em `/orcamento/[id]/download-pdf`, que também tem um botão "← Retornar ao
  Histórico".

### 9.2 Word (.docx, `lib/docx-generator.ts`)

**As duas** propostas têm versão Word: `gerarPropostaComercialDocx` e
`gerarPropostaTecnicaDocx` (mesmo conteúdo textual/tabela da versão PDF, sem as imagens
de referência — só o PDF as embute). Geradas com a lib `docx` (não é uma conversão do
PDF).

### 9.3 Por que o Resumo (dashboard) NÃO usa o motor de PDF nativo

Os 4 exports de PDF do dashboard Resumo continuam em `lib/pdf-generator.ts`
(html2canvas + jsPDF) — react-pdf só desenha os próprios primitivos, não consegue
renderizar componentes React/Recharts (SVG) arbitrários. Esse motor foi corrigido (não
substituído) pra não cortar conteúdo: captura cada bloco/card individualmente (a quebra
de página só acontece ENTRE blocos, nunca no meio de um) e fatia um bloco que sozinho é
maior que uma página inteira em vez de deixar o excesso sumir da borda.

## 10. Autenticação

Supabase Auth (email + senha), um único usuário compartilhado hoje. O campo de login
aceita um "apelido" (ex.: `BR-ISOLAMENTO`), resolvido para o email real em
`lib/auth-usuarios.ts` antes de chamar `signInWithPassword`. Middleware
(`middleware.ts`) exige sessão válida em toda rota exceto `/login` e `/api/**`
(as rotas de API fazem sua própria checagem via `createSupabaseServerClient`); falha
"silenciosa" (deixa passar) se o Supabase estiver indisponível, pra não derrubar o site
inteiro com 500.

> ⚠️ RLS de todas as tabelas exige só "autenticado", sem diferenciação por usuário/role
> — qualquer conta autenticada tem acesso total. Aceitável pro uso interno atual (poucas
> pessoas), seria um problema se o time crescer e precisar de permissões diferentes.

## 11. Testes automatizados

**208 testes unitários** (Jest), todos sobre **lógica pura** — funções de cálculo/regra
de negócio isoladas, sem mockar o Supabase (os repositórios são injetados por parâmetro
nos use cases, e os testes passam fakes simples em memória). Cobrem: motor de cálculo
térmico, quantificação de materiais e mão de obra automática (reproduzindo os cenários
numéricos exatos definidos com o usuário), motor financeiro/tributos, regras de
Comercial (mover lead, temperatura/reativação, prazo por etapa), Operacional
(capacidade, finalizar serviço), Financeiro (custo fixo, relatório). **Não há testes de
integração (API/banco) nem end-to-end** — a validação desses fluxos é manual/visual.

Comando: `npx jest`. Validação padrão antes de qualquer commit: `npx tsc --noEmit` (type
check) + `npx jest` + `npx next build`.

## 12. Estrutura de pastas (resumo)

```
app/
  page.tsx                        Redirect pra /resumo
  login/                          Login
  resumo/                         Dashboard executivo (4 abas internas)
  engenharia/                     Calculadora térmica avulsa
  comercial/[id]?/                CRM — Kanban de leads, clientes, relatórios
  operacional/{servicos,parceiros,fornecedores}/  Execução de obras
  financeiro/{lancamentos,custos-fixos,categorias,configuracoes}/
  novo-orcamento/step-1..5/       Wizard de criação de orçamento
  orcamento/[id]/{,editar,download-pdf}/  Detalhe, ajuste pós-criação, Propostas
  historico/                      Lista/filtros de orçamentos
  config-precos/                  Catálogo de preços + config. financeira da empresa
  api/                            Route handlers — um subdiretório por módulo
lib/
  calculadora-termica.ts          Motor físico (não muda entre versões deste doc)
  quantificador.ts                Método Expert (legado, kg)
  orcamento.ts / tributos.ts      Motor financeiro do orçamento inteiro
  store.ts                        Estado do wizard (Zustand)
  contexts/{comercial,operacional,financeiro,resumo,orcamento,engenharia}.ts
  usecases/{comercial,operacional,financeiro,resumo,orcamento,engenharia}/*.ts
  repositories/*.repository.ts    Uma classe por tabela
  validators/*.ts                 Schemas Zod de entrada
  types.ts / types/domain.ts      Tipos centrais (types.ts = Orçamento/Engenharia;
                                   types/domain.ts = Comercial/Operacional/Financeiro)
  pdf-generator.ts                Motor html2canvas (só Resumo)
  docx-generator.ts               Geração de Word (as duas Propostas)
components/
  pdf-native/                     Documentos react-pdf (Propostas Técnica/Comercial)
  modules/{comercial,operacional,financeiro,resumo,engenharia}/  Componentes por módulo
  Navbar.tsx, TableOrcamentos.tsx, FormPrecos.tsx, FormConfigEmpresa.tsx, ...
sql-schema.sql                    Schema base (instalação nova)
sql-migration-002.sql .. 019.sql  19 migrações incrementais (005-019 ainda
                                   pendentes de aplicar em produção)
__tests__/unit/*.test.ts          208 testes Jest
```

## 13. Estado atual / pendências conhecidas

- **Migrações 005 a 019 pendentes de aplicar no Supabase de produção** — o código já
  assume que existem (ex.: telas de Comercial/Operacional/Financeiro não vão funcionar
  sem elas).
- Preços em `precos_config` (catálogo comercial) precisam ser preenchidos/revisados após
  a reestruturação de espessuras/densidades da migração 016 — os itens recriados
  nasceram com preço R$ 0,00.
- `simples_nacional_rbt12` precisa estar preenchido, senão o cálculo de orçamento
  bloqueia.
- Densidade de 4 materiais isolantes físicos (Aerogel Pyrogel/Cryogel, Perlita
  Expandida, Vermiculita Exfoliada) são estimativas de literatura, não de fonte real.
- Sem testes de integração/e2e — só unitários sobre lógica pura.
- RLS sem diferenciação de permissão por usuário (ver seção 10).
- Regime tributário Simples Nacional/Anexo IV não confirmado com contador (ver 8.4).
- O modo "Somente Mão de Obra" (`tipo_proposta`) e o material "Outro" (customizado) são
  recentes — vale testar com dados reais antes de confiar neles em propostas de verdade.

## 14. Perguntas em aberto para quem for revisar

1. O modelo "1 login compartilhado, sem diferenciação de permissão" é aceitável a médio
   prazo, ou vale investir em papéis (admin vs. consultor) — já existe um campo `role`
   em `usuarios` não usado para nada?
2. A precificação por markup divisor (impostos/margem sobre o preço de venda) está
   correta pro caso de uso, ou a empresa tem alguma particularidade de negociação que
   não se encaixa (descontos por volume, contratos recorrentes)?
3. Os parâmetros do motor de quantificação/mão de obra (acréscimos %, pessoas/m²/hora,
   fatores de eficiência) em `config_empresa` — os valores padrão vieram de uma
   especificação do usuário ("Security States Grave"); vale uma segunda validação
   desses números contra a operação real antes de usar em propostas de valor alto.
4. Existe necessidade de histórico/auditoria de alterações em orçamentos (quem mudou o
   quê e quando)? Hoje só existe timeline de mudança de ETAPA (Comercial) e de
   status/etapa (Operacional) — não há log de quem editou um orçamento já criado.
5. O modelo de "trabalho em altura" como único fator manual de mão de obra (os outros
   dois — tubulação pequena e curvas — são deduzidos do Escopo) cobre bem os casos reais
   de obra, ou faltam outros fatores de dificuldade que a operação encontra no campo
   (ex.: acesso restrito, trabalho noturno)?
6. Vale reativar/expandir a validação por IA de anexos financeiros
   (`statusValidacao`/`notasValidacao` em `lancamentos_financeiros.anexos`) — a
   infraestrutura de dados já existe, mas nenhuma tela usa isso ainda?
