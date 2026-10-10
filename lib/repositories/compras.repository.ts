import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompraDeItem } from "../compras";
import type { Cotacao, CotacaoProposta, Diaria, PedidoCompra, PedidoCompraItem, StatusPedidoCompra } from "../types/domain";
import { BaseRepository } from "./base";

// Repositórios de compras e diárias (migração 044).

export interface FiltrosPedidoCompra {
  status?: StatusPedidoCompra | string;
  fornecedorId?: string;
  servicoId?: string;
}

type ItemParaGravar = Omit<PedidoCompraItem, "id" | "pedido_id" | "ordem">;

export class PedidoCompraRepository extends BaseRepository<PedidoCompra> {
  protected select =
    "*, itens:pedido_compra_itens(*), fornecedor:fornecedores(id, nome), servico:servicos(id, numero_servico, cliente:clientes(nome))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "pedidos_compra");
  }

  async listar(filtros: FiltrosPedidoCompra = {}): Promise<PedidoCompra[]> {
    let query = this.queryBuilder().select(this.select).order("created_at", { ascending: false });
    if (filtros.status) query = query.eq("status", filtros.status);
    if (filtros.fornecedorId) query = query.eq("fornecedor_id", filtros.fornecedorId);
    if (filtros.servicoId) query = query.eq("servico_id", filtros.servicoId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as unknown as PedidoCompra[]).map(ordenarItens);
  }

  async buscar(id: string): Promise<PedidoCompra> {
    return ordenarItens(await this.findByIdOrThrow(id));
  }

  /** Troca TODOS os itens do pedido pelos informados (apaga e regrava). */
  async gravarItens(pedidoId: string, itens: ItemParaGravar[]): Promise<void> {
    const apagar = await this.supabase.from("pedido_compra_itens").delete().eq("pedido_id", pedidoId);
    if (apagar.error) throw apagar.error;
    const inserir = await this.supabase
      .from("pedido_compra_itens")
      .insert(itens.map((item, ordem) => ({ ...item, preco_config_id: item.preco_config_id ?? null, pedido_id: pedidoId, ordem })));
    if (inserir.error) throw inserir.error;
  }

  /** Itens de pedidos enviados ou recebidos — a base do histórico de preços. */
  async listarComprasDeItens(): Promise<CompraDeItem[]> {
    const { data, error } = await this.supabase
      .from("pedido_compra_itens")
      .select("descricao, unidade, preco_unitario, quantidade, preco_config_id, pedido:pedidos_compra!inner(numero, data_pedido, status, fornecedor:fornecedores(id, nome))")
      .in("pedido.status", ["enviado", "recebido"]);
    if (error) throw error;

    type Linha = {
      descricao: string;
      unidade: string;
      preco_unitario: number;
      quantidade: number;
      preco_config_id: number | null;
      pedido: { numero: string; data_pedido: string; fornecedor: { id: string; nome: string } | null };
    };
    return ((data ?? []) as unknown as Linha[]).map((l) => ({
      descricao: l.descricao,
      unidade: l.unidade,
      preco_unitario: Number(l.preco_unitario),
      quantidade: Number(l.quantidade),
      data: l.pedido.data_pedido,
      pedido: l.pedido.numero,
      fornecedorId: l.pedido.fornecedor?.id ?? "",
      fornecedor: l.pedido.fornecedor?.nome ?? "—",
      preco_config_id: l.preco_config_id,
    }));
  }
}

function ordenarItens(pedido: PedidoCompra): PedidoCompra {
  return {
    ...pedido,
    valor_total: Number(pedido.valor_total),
    itens: [...(pedido.itens ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({ ...i, quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) })),
  };
}

export class CotacaoRepository extends BaseRepository<Cotacao> {
  protected select =
    "*, propostas:cotacao_propostas(*, fornecedor:fornecedores(id, nome)), servico:servicos(id, numero_servico, cliente:clientes(nome))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "cotacoes");
  }

  async listar(): Promise<Cotacao[]> {
    const { data, error } = await this.queryBuilder().select(this.select).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Cotacao[];
  }

  /** Cria ou atualiza a proposta de um fornecedor nesta cotação. */
  async salvarProposta(cotacaoId: string, proposta: Omit<CotacaoProposta, "id" | "cotacao_id" | "created_at" | "fornecedor">): Promise<void> {
    const { error } = await this.supabase
      .from("cotacao_propostas")
      .upsert({ ...proposta, cotacao_id: cotacaoId }, { onConflict: "cotacao_id,fornecedor_id" });
    if (error) throw error;
  }

  async removerProposta(cotacaoId: string, propostaId: string): Promise<void> {
    const { error } = await this.supabase.from("cotacao_propostas").delete().eq("id", propostaId).eq("cotacao_id", cotacaoId);
    if (error) throw error;
  }
}

export class DiariaRepository extends BaseRepository<Diaria> {
  protected select = "*, parceiro:parceiros(id, nome), funcionario:funcionarios(id, nome)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "diarias");
  }

  async listarPorServico(servicoId: string): Promise<Diaria[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("servico_id", servicoId)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as Diaria[]).map((d) => ({ ...d, valor: Number(d.valor) }));
  }
}

/** Documentos de parceiros ATIVOS com validade preenchida — base do aviso ao
 * alocar um parceiro numa obra e dos alertas (migração 044). */
export async function listarDocumentosDeParceirosComValidade(
  supabase: SupabaseClient
): Promise<Array<{ parceiroId: string; parceiro: string; nome: string; validade: string }>> {
  const { data, error } = await supabase
    .from("parceiro_anexos")
    .select("nome_arquivo, validade, parceiro:parceiros!inner(id, nome, ativo)")
    .not("validade", "is", null)
    .eq("parceiro.ativo", true);
  if (error) throw error;
  type Linha = { nome_arquivo: string; validade: string; parceiro: { id: string; nome: string } };
  return ((data ?? []) as unknown as Linha[]).map((l) => ({ parceiroId: l.parceiro.id, parceiro: l.parceiro.nome, nome: l.nome_arquivo, validade: l.validade }));
}

/** Trechos do orçamento de uma obra, só com o que a quantificação de
 * materiais precisa (lista de compras da obra). */
export async function listarTrechosDoOrcamento(
  supabase: SupabaseClient,
  orcamentoId: number
): Promise<Array<{ material: string | null; acabamento: string | null; espessura_necessaria_mm: number | null; escopo_itens: unknown }>> {
  const { data, error } = await supabase
    .from("itens_orcamento")
    .select("material, acabamento, espessura_necessaria_mm, escopo_itens")
    .eq("orcamento_id", orcamentoId)
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as Array<{ material: string | null; acabamento: string | null; espessura_necessaria_mm: number | null; escopo_itens: unknown }>;
}

/** Linha única de `config_empresa` (parâmetros de quantificação). */
export async function buscarConfigEmpresa(supabase: SupabaseClient): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from("config_empresa").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

/** Preço atual dos itens do catálogo de orçamento, por id. */
export async function listarPrecosDoCatalogo(
  supabase: SupabaseClient
): Promise<Array<{ id: number; descricao: string; preco_unitario: number; unidade: string | null; ativo: boolean }>> {
  const { data, error } = await supabase.from("precos_config").select("id, descricao, preco_unitario, unidade, ativo").order("descricao");
  if (error) throw error;
  return (data ?? []) as Array<{ id: number; descricao: string; preco_unitario: number; unidade: string | null; ativo: boolean }>;
}

/** Documentos vencidos de funcionários ativos — via função do banco
 * (`documentos_vencidos_funcionarios`, migração 044), que não expõe a tabela
 * de documentos do RH a quem só tem o módulo Operacional. */
export async function listarDocumentosVencidosDeFuncionarios(
  supabase: SupabaseClient
): Promise<Array<{ funcionarioId: string; funcionario: string; nome: string; validade: string }>> {
  const { data, error } = await supabase.rpc("documentos_vencidos_funcionarios");
  if (error) throw error;
  type Linha = { funcionario_id: string; funcionario: string; nome: string; validade: string };
  return ((data ?? []) as Linha[]).map((l) => ({ funcionarioId: l.funcionario_id, funcionario: l.funcionario, nome: l.nome, validade: l.validade }));
}

/** Alocação de funcionários da equipe própria numa obra (migração 044). */
export async function alocarFuncionarioNoServico(supabase: SupabaseClient, servicoId: string, funcionarioId: string, tiposTrabalho: string[]): Promise<void> {
  const { error } = await supabase
    .from("servico_funcionarios_execucao")
    .upsert({ servico_id: servicoId, funcionario_id: funcionarioId, tipos_trabalho: tiposTrabalho }, { onConflict: "servico_id,funcionario_id" });
  if (error) throw error;
}

export async function removerFuncionarioDoServico(supabase: SupabaseClient, servicoId: string, execucaoId: string): Promise<void> {
  const { error } = await supabase.from("servico_funcionarios_execucao").delete().eq("id", execucaoId).eq("servico_id", servicoId);
  if (error) throw error;
}

export async function atualizarPrecoDoCatalogo(supabase: SupabaseClient, id: number, precoUnitario: number): Promise<void> {
  const { error } = await supabase.from("precos_config").update({ preco_unitario: precoUnitario }).eq("id", id);
  if (error) throw error;
}

export async function definirValidadeAnexoParceiro(supabase: SupabaseClient, parceiroId: string, anexoId: string, validade: string | null): Promise<void> {
  const { error } = await supabase.from("parceiro_anexos").update({ validade }).eq("id", anexoId).eq("parceiro_id", parceiroId);
  if (error) throw error;
}
