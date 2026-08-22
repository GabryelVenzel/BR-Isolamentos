# `lib/` — arquitetura da aplicação

Esta pasta é a base ("foundation") para escalar o projeto de MVP (wizard de
orçamentos) para uma plataforma com 6 módulos (Engenharia, Comercial,
Operacional, Orçamento, Financeiro, Resumo). O objetivo das camadas abaixo é
sempre o mesmo: **nenhuma lógica de negócio ou query direta ao Supabase dentro
de componente React ou API route** — só orquestração fina.

Para o guia de como adicionar um módulo novo seguindo este padrão, ver
[`CONVENTIONS.md`](../CONVENTIONS.md) na raiz do projeto.

## Camadas, da borda para o centro

```
app/api/**/route.ts        ← HTTP: parseia request, chama 1 contexto/use case, formata resposta
        │
lib/contexts/<modulo>.ts   ← Fachada do módulo: injeta o client do Supabase nos repositórios
        │                     e expõe as operações do módulo como um objeto único
        │
lib/usecases/<modulo>/*.ts ← Lógica de negócio pura (validar → buscar → decidir → persistir)
        │                     Reutilizável por API routes, Server Actions e (futuro) crons
        │
lib/repositories/*.ts      ← Data Access Layer: única camada que fala `supabase.from(...)`
        │
lib/validators/*.ts        ← Schemas Zod: validação de entrada em runtime
lib/types/*.ts              ← Tipos TypeScript compartilhados (compile-time)
lib/errors.ts               ← Hierarquia de erros (AppError → NotFoundError, ValidationError...)
lib/logger.ts                ← Logging estruturado (nunca `console.log` solto)
lib/cache.ts                  ← Cache em memória com TTL para leituras frequentes
```

### `lib/contexts/`

Um arquivo por módulo de negócio. Cada um exporta uma função
`create<Modulo>Context(supabase)` que devolve um objeto com os métodos do
módulo — é o único import que uma página ou API route precisa para trabalhar
com aquele domínio. Ver `lib/contexts/orcamento.ts` (módulo implementado) e
`lib/contexts/comercial.ts` (módulo ainda em scaffolding, aguardando tabela).

### `lib/types/`

- `common.ts` — tipos genéricos usados por mais de um módulo (`PageResult`,
  `ApiResponse`, `BaseEntity`).
- `api.ts` — tipos de request/response HTTP (paginação, filtros de listagem).
- `domain.ts` — ponto único de import para tipos de domínio. As entidades já
  existentes continuam declaradas em `lib/types.ts` (não duplicadas — apenas
  re-exportadas); as entidades dos módulos futuros (`Lead`, `Parceiro`,
  `ItemFinanceiro`) já estão declaradas aqui como contrato, mesmo sem tabela.

### `lib/repositories/`

`BaseRepository<T>` dá CRUD genérico (`findAll`, `findById`,
`findByIdOrThrow`, `create`, `update`, `delete`) a partir de um nome de
tabela. Repositórios concretos (`ClienteRepository`, `OrcamentoRepository`)
estendem essa base e adicionam queries específicas (`buscarPorNome`,
`listar` com filtros, etc.). **Toda query ao Supabase deve passar por um
repositório** — isso é o que permite trocar de banco, adicionar cache ou
mockar em teste sem tocar em use case/UI.

### `lib/usecases/`

Uma função por ação de negócio (`criarOrcamento`, `calcularTermico`,
`atualizarOrcamento`...), organizada em uma pasta por módulo. Um use case
recebe os repositórios como argumento explícito (injeção de dependência
manual) em vez de instanciá-los — isso os torna fáceis de testar com um
repositório fake, sem precisar de rede nem de um Supabase real.

### `lib/validators/`

Schemas Zod para validar entrada de API antes de qualquer lógica rodar.
`parseOrThrow(schema, input)` (em `lib/validators/index.ts`) valida e já
lança `ValidationError` (400) pronta para a resposta HTTP em caso de falha.

### `lib/errors.ts`, `lib/logger.ts`, `lib/cache.ts`

Transversais a todos os módulos — ver comentários no topo de cada arquivo.

## Compatibilidade das rotas existentes

As rotas herdadas do MVP (`/api/clientes`, `/api/orcamentos`,
`/api/calcular-*`, `/api/quantificar`) foram refatoradas para usar essas
camadas por dentro, mas **mantêm o formato de resposta original** (corpo cru:
array/objeto em sucesso, `{ error: string }` em falha) porque o frontend
existente já espera esse formato. Rotas dos módulos novos devem usar o
envelope `ApiResponse<T>` de `lib/types/common.ts` — ver `CONVENTIONS.md`.
