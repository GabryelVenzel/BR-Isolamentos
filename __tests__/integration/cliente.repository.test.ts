import { ClienteRepository } from "@/lib/repositories";
import { NotFoundError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mock mínimo do query builder do supabase-js (`PostgrestFilterBuilder`): cada
 * método de filtro/chain (`select`, `eq`, `ilike`, `order`...) retorna a
 * própria instância para permitir encadeamento, e a instância é "thenable"
 * (implementa `.then`) para poder ser usada com `await` diretamente, exatamente
 * como o client real — o repositório não sabe (nem deveria saber) a diferença.
 */
class MockQueryBuilder {
  public calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private result: { data: unknown; error: unknown }) {}

  private chain(method: string, ...args: unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  select(...args: unknown[]) {
    return this.chain("select", ...args);
  }
  eq(...args: unknown[]) {
    return this.chain("eq", ...args);
  }
  ilike(...args: unknown[]) {
    return this.chain("ilike", ...args);
  }
  order(...args: unknown[]) {
    return this.chain("order", ...args);
  }
  limit(...args: unknown[]) {
    return this.chain("limit", ...args);
  }
  insert(...args: unknown[]) {
    return this.chain("insert", ...args);
  }
  update(...args: unknown[]) {
    return this.chain("update", ...args);
  }
  delete(...args: unknown[]) {
    return this.chain("delete", ...args);
  }
  maybeSingle(...args: unknown[]) {
    return this.chain("maybeSingle", ...args);
  }
  single(...args: unknown[]) {
    return this.chain("single", ...args);
  }

  then<T>(resolve: (value: { data: unknown; error: unknown }) => T, reject?: (reason: unknown) => T) {
    return Promise.resolve(this.result).then(resolve, reject);
  }
}

function createSupabaseMock(result: { data: unknown; error: unknown }) {
  const builder = new MockQueryBuilder(result);
  const from = jest.fn(() => builder);
  return { supabase: { from } as unknown as SupabaseClient, builder, from };
}

describe("ClienteRepository", () => {
  it("findAll consulta a tabela 'clientes' e devolve os dados", async () => {
    const clientesFake = [{ id: 1, nome: "Cliente A" }];
    const { supabase, from } = createSupabaseMock({ data: clientesFake, error: null });

    const repo = new ClienteRepository(supabase);
    const resultado = await repo.findAll();

    expect(from).toHaveBeenCalledWith("clientes");
    expect(resultado).toEqual(clientesFake);
  });

  it("findAll propaga o erro do Supabase em vez de engolir silenciosamente", async () => {
    const { supabase } = createSupabaseMock({ data: null, error: new Error("falha de rede") });
    const repo = new ClienteRepository(supabase);

    await expect(repo.findAll()).rejects.toThrow("falha de rede");
  });

  it("findById retorna null quando o registro não existe", async () => {
    const { supabase, builder } = createSupabaseMock({ data: null, error: null });
    const repo = new ClienteRepository(supabase);

    const resultado = await repo.findById(999);

    expect(resultado).toBeNull();
    expect(builder.calls).toContainEqual({ method: "eq", args: ["id", 999] });
  });

  it("findByIdOrThrow lança NotFoundError quando o registro não existe", async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null });
    const repo = new ClienteRepository(supabase);

    await expect(repo.findByIdOrThrow(999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("create insere o registro e devolve a linha criada", async () => {
    const clienteCriado = { id: 42, nome: "Cliente Novo" };
    const { supabase, builder } = createSupabaseMock({ data: clienteCriado, error: null });
    const repo = new ClienteRepository(supabase);

    const resultado = await repo.create({ nome: "Cliente Novo" });

    expect(resultado).toEqual(clienteCriado);
    expect(builder.calls[0]).toEqual({ method: "insert", args: [{ nome: "Cliente Novo" }] });
  });

  it("buscarPorNome usa ilike com o termo entre '%'", async () => {
    const { supabase, builder } = createSupabaseMock({ data: [], error: null });
    const repo = new ClienteRepository(supabase);

    await repo.buscarPorNome("Silva");

    expect(builder.calls).toContainEqual({ method: "ilike", args: ["nome", "%Silva%"] });
  });
});
