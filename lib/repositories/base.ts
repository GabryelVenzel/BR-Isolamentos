// Camada de acesso a dados (Data Access Layer). Cada tabela do Supabase ganha
// um repositório que estende `BaseRepository<T>` e herda CRUD genérico —
// queries específicas da tabela (ex.: `findByEtapa`, `findByClienteId`) são
// adicionadas na subclasse. Nenhuma query solta em componente/route deve
// chamar `supabase.from(...)` diretamente fora de um repositório: isso mantém
// a lógica de acesso a dados num único lugar por entidade, reutilizável entre
// API routes, server actions e (no futuro) jobs de cron.
//
// Nota de tipagem: o projeto não usa o gerador `supabase gen types` (client
// tipado como `SupabaseClient` genérico, sem `Database`), então o
// query builder do supabase-js não consegue inferir o formato da linha a
// partir de `.select(coluna)` quando `coluna` é uma `string` de variável (só
// funciona com literais). Por isso a query em si é montada via `queryBuilder()`
// (tipada como `any` internamente) e o resultado é convertido para `T`
// explicitamente no retorno de cada método público — a fronteira tipada é a
// assinatura pública do repositório, não a chamada ao Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "../errors";
import { logger } from "../logger";

export interface FindAllOptions {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

export class BaseRepository<T> {
  constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly table: string
  ) {}

  /** Colunas trazidas por padrão; sobrescrever em subclasse para incluir joins
   * (ex.: `"*, cliente:clientes(*)"`). */
  protected select = "*";

  /** `true` nas tabelas com LIXEIRA (colunas `excluido_em`/`excluido_por`,
   * migrações 045 e 047). "Excluir" nessas tabelas só marca a linha; ela some
   * de TODAS as leituras normais do repositório — `findAll`, `findById` e
   * as consultas próprias de cada subclasse, que partem de `ativos()` — e só
   * os métodos da seção "Lixeira", no fim desta classe, a enxergam. */
  protected temLixeira = false;

  /** Ponto único de acesso ao query builder do Supabase para esta tabela — ver
   * nota de tipagem no topo do arquivo. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected queryBuilder(): any {
    return this.supabase.from(this.table);
  }

  /** Ponto de partida de toda LEITURA: `select` já sem o que está na
   * lixeira. Aceita os mesmos argumentos de `.select()`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected ativos(colunas: string = this.select, opcoes?: Record<string, unknown>): any {
    const query = this.queryBuilder().select(colunas, opcoes);
    return this.temLixeira ? query.is("excluido_em", null) : query;
  }

  async findAll(options: FindAllOptions = {}): Promise<T[]> {
    let query = this.ativos();

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      logger.error(`Falha ao listar ${this.table}`, error);
      throw error;
    }
    return (data ?? []) as unknown as T[];
  }

  async findById(id: string | number): Promise<T | null> {
    const { data, error } = await this.ativos().eq("id", id).maybeSingle();

    if (error) {
      logger.error(`Falha ao buscar ${this.table} por id`, error, { id });
      throw error;
    }
    return (data as unknown as T) ?? null;
  }

  /** Como `findById`, mas lança `NotFoundError` (404) em vez de retornar `null` —
   * conveniente quando a ausência do registro é sempre um erro de entrada. */
  async findByIdOrThrow(id: string | number): Promise<T> {
    const registro = await this.findById(id);
    if (!registro) {
      throw new NotFoundError(`Registro não encontrado em "${this.table}" (id: ${id}).`);
    }
    return registro;
  }

  async create(dados: Partial<T>): Promise<T> {
    const { data, error } = await this.queryBuilder().insert(dados).select(this.select).single();

    if (error) {
      logger.error(`Falha ao criar registro em ${this.table}`, error, { dados });
      throw error;
    }
    return data as unknown as T;
  }

  async update(id: string | number, dados: Partial<T>): Promise<T> {
    const { data, error } = await this.queryBuilder()
      .update(dados)
      .eq("id", id)
      .select(this.select)
      .single();

    if (error) {
      logger.error(`Falha ao atualizar ${this.table}`, error, { id, dados });
      throw error;
    }
    return data as unknown as T;
  }

  async delete(id: string | number): Promise<void> {
    const { error } = await this.queryBuilder().delete().eq("id", id);
    if (error) {
      logger.error(`Falha ao excluir ${this.table}`, error, { id });
      throw error;
    }
  }

  // --- Lixeira (só nas tabelas com `temLixeira`) ---

  /** O que está na lixeira, do excluído mais recentemente para o mais antigo. */
  async listarLixeira(): Promise<T[]> {
    const { data, error } = await this.queryBuilder().select(this.select).not("excluido_em", "is", null).order("excluido_em", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as T[];
  }

  /** "Excluir" = mandar pra lixeira. Devolve `false` se o registro não
   * existe ou já estava lá. */
  async moverParaLixeira(id: string | number, usuarioEmail: string | null): Promise<boolean> {
    const { data, error } = await this.queryBuilder()
      .update({ excluido_em: new Date().toISOString(), excluido_por: usuarioEmail })
      .eq("id", id)
      .is("excluido_em", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async restaurarDaLixeira(id: string | number): Promise<boolean> {
    const { data, error } = await this.queryBuilder()
      .update({ excluido_em: null, excluido_por: null })
      .eq("id", id)
      .not("excluido_em", "is", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /** Remoção DEFINITIVA — só de quem já está na lixeira (o filtro impede
   * apagar de vez um registro ativo por engano). */
  async excluirDefinitivamente(id: string | number): Promise<boolean> {
    const { data, error } = await this.queryBuilder().delete().eq("id", id).not("excluido_em", "is", null).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }
}
