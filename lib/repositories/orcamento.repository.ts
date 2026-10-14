import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemOrcamento, Orcamento, StatusOrcamento } from "../types";
import { BaseRepository } from "./base";

export interface FiltrosOrcamento {
  status?: StatusOrcamento | string;
  clienteId?: number | string;
  dataInicio?: string;
  dataFim?: string;
}

export class OrcamentoRepository extends BaseRepository<Orcamento> {
  // Traz cliente e itens já resolvidos via join — evita N+1 nas telas de
  // histórico/detalhe, que sempre precisam desses dados juntos.
  protected select = "*, cliente:clientes(*), itens:itens_orcamento(*)";

  // LIXEIRA (migração 047) — ver `temLixeira` em ./base.ts.
  protected temLixeira = true;

  constructor(supabase: SupabaseClient) {
    super(supabase, "orcamentos");
  }

  async listar(filtros: FiltrosOrcamento = {}): Promise<Orcamento[]> {
    let query = this.ativos().order("criado_em", { ascending: false });

    if (filtros.status) query = query.eq("status", filtros.status);
    if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);
    if (filtros.dataInicio) query = query.gte("data_criacao", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data_criacao", filtros.dataFim);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Orcamento[];
  }

  /** Próximo número sequencial de orçamento no formato `ORC-<ano>-<seq>`.
   *
   * Bug relatado: a versão anterior usava `COUNT(*)` de todas as linhas + 1
   * — ao EXCLUIR um orçamento, a contagem cai, e o próximo número gerado
   * colidia com um `numero` que já existia (ex.: criou 0001..0006, excluiu
   * 0002 e 0006 → contagem vira 4 → "próximo" calculado era 0005, que já
   * existe → erro de valor duplicado ao salvar). Corrigido pra usar o MAIOR
   * sequencial já usado (extraído do `numero` do orçamento mais recente,
   * `ORDER BY id DESC LIMIT 1` — `numero` só cresce com a criação, nunca é
   * editado depois, então o maior `id` restante sempre tem o maior
   * sequencial restante, não importa o que foi excluído no meio). Isso dá
   * exatamente o comportamento pedido: excluir um do MEIO não afeta o
   * próximo número (continua a sequência normal); excluir o ÚLTIMO libera
   * esse número de novo pro próximo orçamento criado.
   *
   * A consulta olha TODOS os orçamentos, inclusive os que estão na lixeira
   * (migração 047): o número de um orçamento na lixeira continua reservado,
   * senão restaurá-lo colidiria com um criado depois.
   *
   * Não é atômico (mesma limitação do código original) — aceitável no
   * volume atual de uso por um único operador; se o cadastro passar a ser
   * concorrente, mover para uma sequence/função no Postgres. */
  async proximoNumero(): Promise<string> {
    const { data, error } = await this.queryBuilder().select("numero").order("id", { ascending: false }).limit(1);
    if (error) throw error;
    const ultimoNumero = data?.[0]?.numero as string | undefined;
    const ultimoSequencial = ultimoNumero ? Number(ultimoNumero.split("-").pop()) : 0;
    const proximoSequencial = (Number.isFinite(ultimoSequencial) ? ultimoSequencial : 0) + 1;
    return `ORC-${new Date().getFullYear()}-${String(proximoSequencial).padStart(4, "0")}`;
  }

  async criarComItens(
    cabecalho: Partial<Orcamento>,
    itens: Array<Partial<ItemOrcamento>>,
    criadoPor: string | null
  ): Promise<Orcamento> {
    const numero = await this.proximoNumero();

    const { data: orcamento, error: erroOrcamento } = await this.queryBuilder()
      .insert({ ...cabecalho, numero, criado_por: criadoPor })
      .select()
      .single();

    if (erroOrcamento) throw erroOrcamento;

    const { error: erroItens } = await this.supabase
      .from("itens_orcamento")
      .insert(itens.map((item) => ({ ...item, orcamento_id: orcamento.id })));

    if (erroItens) {
      // evita orçamento órfão sem itens — apagar de vez é só de administrador
      // (migração 047); pros demais o banco ignora o delete e o órfão vai pra
      // lixeira, que dá no mesmo pra quem usa.
      await this.queryBuilder().delete().eq("id", orcamento.id);
      await this.moverParaLixeira(orcamento.id, criadoPor);
      throw erroItens;
    }

    return this.findByIdOrThrow(orcamento.id);
  }

  /** Atualiza o cabeçalho e TROCA os trechos de um orçamento (edição pelo
   * wizard). Os trechos novos entram antes de os antigos saírem: se a
   * inclusão falhar, o orçamento continua com os trechos que tinha. */
  async atualizarComItens(id: number | string, cabecalho: Partial<Orcamento>, itens: Array<Partial<ItemOrcamento>>): Promise<Orcamento> {
    const { data: antigos, error: erroAntigos } = await this.supabase.from("itens_orcamento").select("id").eq("orcamento_id", id);
    if (erroAntigos) throw erroAntigos;

    const { error: erroItens } = await this.supabase.from("itens_orcamento").insert(itens.map((item) => ({ ...item, orcamento_id: id })));
    if (erroItens) throw erroItens;

    const idsAntigos = (antigos ?? []).map((i: { id: number }) => i.id);
    if (idsAntigos.length > 0) {
      const { error: erroRemocao } = await this.supabase.from("itens_orcamento").delete().in("id", idsAntigos);
      if (erroRemocao) throw erroRemocao;
    }

    return this.update(id, cabecalho);
  }

  // --- Cópia do wizard guardada junto do orçamento (migração 049) — o que
  // permite reabri-lo para editar exatamente como foi montado. Tabela à
  // parte, fora do `select` padrão, para não pesar as listagens. ---

  /** `null` quando o orçamento não tem a cópia (anterior à migração 049) ou
   * a tabela ainda não existe. */
  async buscarEstadoWizard(id: number | string): Promise<unknown | null> {
    const { data, error } = await this.supabase.from("orcamento_wizard_estado").select("estado").eq("orcamento_id", id).maybeSingle();
    if (error) return null;
    return (data as { estado: unknown } | null)?.estado ?? null;
  }

  /** Guarda (ou substitui) a cópia. Falhar aqui não pode derrubar o
   * salvamento do orçamento em si — devolve `false` e quem chama segue. */
  async salvarEstadoWizard(id: number | string, estado: unknown): Promise<boolean> {
    const { error } = await this.supabase
      .from("orcamento_wizard_estado")
      .upsert({ orcamento_id: id, estado, atualizado_em: new Date().toISOString() }, { onConflict: "orcamento_id" });
    return !error;
  }

  /** Orçamentos aceitos num intervalo (por `data_criacao`), só as colunas
   * usadas pra "Distribuição de Receita por Tipo" do dashboard (Resumo) —
   * soma `valor_final` agrupado por `tipo_trabalho` no use case chamador.
   * Usa o valor de venda do orçamento (não o que já foi efetivamente
   * recebido em `lancamentos_financeiros`) porque nem todo orçamento aceito
   * necessariamente tem um lançamento financeiro vinculado ainda — como
   * indicador de "mix de vendas por tipo de trabalho" isso é mais confiável
   * que depender dessa vinculação manual. */
  async listarAceitosPorPeriodo(
    dataInicio: string,
    dataFim: string,
    responsavel?: string
  ): Promise<Array<{ tipo_trabalho: string; valor_final: number }>> {
    let query = this.ativos("tipo_trabalho, valor_final")
      .eq("status", "aceito")
      .gte("data_criacao", dataInicio)
      .lte("data_criacao", dataFim);
    if (responsavel) query = query.eq("atribuido_a", responsavel);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Array<{ tipo_trabalho: string; valor_final: number }>;
  }
}
