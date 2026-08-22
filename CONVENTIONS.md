# Convenções — como adicionar um módulo novo

Guia prático para quando um dos módulos hoje em scaffolding (Comercial,
Operacional, Financeiro) — ou um módulo totalmente novo — for implementado de
verdade. Segue o padrão já usado pelo módulo Orçamento (o único 100%
implementado nas 4 camadas). Ver a visão geral das camadas em
[`lib/README.md`](lib/README.md).

## Passo a passo

1. **Tabela no Supabase.** Escrever a migration SQL (novo arquivo
   `sql-migration-00N.sql`, seguindo o padrão dos existentes). Definir
   `not null`/`check` constraints no banco — não confiar só na validação da
   aplicação.

2. **Tipo de domínio.** Se o tipo já existe como scaffolding em
   `lib/types/domain.ts` (caso de `Lead`, `Parceiro`, `ItemFinanceiro`),
   revisar contra o schema real da tabela. Se for módulo novo, declarar a
   interface ali seguindo o padrão `BaseEntity` (`id`, `created_at`,
   `updated_at`) de `lib/types/common.ts`.

3. **Validador Zod.** Criar/revisar `lib/validators/<entidade>.ts` com
   `Create<Entidade>Schema` e `Update<Entidade>Schema` (`.partial()` do
   Create). Exportar em `lib/validators/index.ts`.

4. **Repositório.** Criar `lib/repositories/<entidade>.repository.ts`
   estendendo `BaseRepository<T>`. Adicionar só os métodos de query
   específicos daquela entidade (filtros comuns, joins). Exportar em
   `lib/repositories/index.ts`.

5. **Use cases.** Criar `lib/usecases/<modulo>/<acao>.ts`, um arquivo por
   ação de negócio. Um use case:
   - recebe os repositórios necessários como parâmetro explícito (nunca
     instancia `new XRepository(...)` internamente — isso é responsabilidade
     do contexto/rota, e é o que permite testar o use case com um repositório
     fake);
   - valida a entrada com `parseOrThrow` de `lib/validators`;
   - lança `AppError`/subclasses de `lib/errors.ts` para qualquer falha
     prevista (nunca `throw new Error("...")` genérico);
   - não formata resposta HTTP — isso é trabalho da API route.

   Exportar tudo em `lib/usecases/<modulo>/index.ts`.

6. **Contexto.** Em `lib/contexts/<modulo>.ts`, trocar o corpo das funções
   que hoje lançam `NotImplementedError` pela implementação real, chamando os
   use cases do passo 5. Manter a assinatura pública (não quebrar quem já
   importa o contexto).

7. **API route.** Nova rota em `app/api/<modulo>/<recurso>/route.ts`.
   Módulos novos usam o envelope de resposta `ApiResponse<T>`
   (`apiSuccess`/`apiError` de `lib/types/common.ts`), diferente das rotas
   legadas do MVP que devolvem corpo cru (ver "Compatibilidade" no
   `lib/README.md`). Padrão:

   ```ts
   import { NextResponse } from "next/server";
   import { apiError, apiSuccess } from "@/lib/types/common";
   import { toHttpError } from "@/lib/errors";

   export async function GET(request: Request) {
     try {
       const data = await ctx.listar(/* ... */);
       return NextResponse.json(apiSuccess(data));
     } catch (error) {
       const { message, statusCode } = toHttpError(error);
       return NextResponse.json(apiError(message), { status: statusCode });
     }
   }
   ```

8. **Testes.** Ao menos um teste unitário para lógica de decisão não-trivial
   do use case (ex.: regra de transição de estado) e um teste de integração
   do repositório com um client Supabase mockado. Ver
   `__tests__/unit/tributos.test.ts` e
   `__tests__/integration/cliente.repository.test.ts` como referência.

## Regras que não mudam entre módulos

- **Impostos**: qualquer cálculo financeiro que envolva tributos deve
  reutilizar `lib/tributos.ts` / `lib/usecases/orcamento/calcularOrcamento.ts`
  — a carga tributária é sempre a real e completa do regime configurado
  (Simples Nacional pela fórmula oficial, ou Lucro Presumido/Personalizado
  somando os impostos configurados), nunca um percentual único simplificado.
- **Nada de `supabase.from(...)` fora de `lib/repositories/`.**
- **Nada de `console.log` solto** — usar `lib/logger.ts`.
- **Erros previstos sempre como `AppError`** (`lib/errors.ts**), nunca
  `throw new Error("string")` genérico em código de negócio.
