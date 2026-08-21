# BR Isolamentos — Calculadora de Orçamentos

Aplicação Next.js + Supabase para cálculo técnico (ASTM C680 / ISO 12241 / ABNT NBR 16281),
quantificação de materiais e orçamentos de isolamento térmico fixo.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Zustand ·
react-hook-form · jsPDF + html2canvas · Recharts

## Primeiros passos

```bash
npm install
npm run dev
# http://localhost:3000
```

`.env.local` já está preenchido com a URL/anon key do projeto Supabase (`doiddlafghiujsbxowaq`).
Se precisar apontar para outro projeto, copie `.env.example`.

## Banco de dados

Rode **todo** o conteúdo de [`sql-schema.sql`](./sql-schema.sql) no SQL Editor do Supabase
(Dashboard → SQL Editor → New query → colar → Run). Ele cria as tabelas, RLS e alguns dados de
exemplo.

⚠️ **Dados placeholder a validar** (marcados com comentário `PLACEHOLDER` no SQL):

- `materiais_isolantes` e `acabamentos`: valores de k(T)/emissividade de literatura técnica
  (ASTM/ASHRAE), usados só para a UI não ficar vazia. Substitua pelos valores reais das
  planilhas Google Sheets ("Isolantes 2" e "Emissividade") usadas por
  `2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py`.
- `precos_config`: todos os preços começam zerados — preencha em **Configurar Preços** antes de
  gerar orçamentos reais.
- `config_empresa.vedacit_gramas_por_junta` (padrão 50g): estimativa de quanto Vedacit é gasto
  por junta de vedação P.U. Não há essa referência nas planilhas originais — valide com a
  operação e ajuste em **Configurar Preços**.

## Usuários (3 sócios)

Não há tela de auto-cadastro. Crie os 3 usuários em Supabase Dashboard → Authentication → Users,
e opcionalmente um registro correspondente na tabela `usuarios` (nome/role) para exibição futura.

## Deploy (Vercel)

1. Import do repositório no Vercel.
2. Configure as env vars `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy.

## Estrutura

- `lib/calculadora-termica.ts` — motor térmico (porte do `CALCULADORA-TERMICA.py`).
- `lib/quantificador.ts` — "Método Expert" de quantificação de materiais.
- `lib/orcamento.ts` — pipeline financeiro (materiais → custos → impostos → margem → desconto).
- `app/novo-orcamento/step-1..5` — wizard de criação de orçamento (estado em `lib/store.ts`).
- `app/api/*` — rotas de cálculo e CRUD (Supabase, respeitando RLS via cookies de sessão).
