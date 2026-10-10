// Contexto de Compras e Diárias (migração 044) — ponto único de entrada das
// rotas de /api/operacional/compras/* e das diárias de uma obra.

import type { SupabaseClient } from "@supabase/supabase-js";
import { historicoDePrecos, listaDeCompras, resumirDiarias, totalPedido, type HistoricoDeItem, type ItemListaCompras, type ResumoDiarias } from "../compras";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { situacaoValidade } from "../alertas";
import { hojeBrasilia } from "../financeiro";
import {
  CotacaoRepository,
  DiariaRepository,
  LancamentoFinanceiroRepository,
  PedidoCompraRepository,
  ServicoRepository,
  FuncionarioRepository,
  alocarFuncionarioNoServico,
  atualizarPrecoDoCatalogo,
  buscarConfigEmpresa,
  definirValidadeAnexoParceiro,
  listarDocumentosDeParceirosComValidade,
  listarDocumentosVencidosDeFuncionarios,
  listarPrecosDoCatalogo,
  listarTrechosDoOrcamento,
  removerFuncionarioDoServico,
  type FiltrosPedidoCompra,
} from "../repositories";
import type { ItemEscopo } from "../types";
import type { Cotacao, Diaria, PedidoCompra } from "../types/domain";
import { criarLancamento } from "../usecases/financeiro";
import { quantificarMateriais, type ParametrosQuantificacao } from "../usecases/orcamento";
import {
  AcaoPedidoCompraSchema,
  AlocarFuncionarioSchema,
  CreateDiariaSchema,
  GerarPedidoDaCotacaoSchema,
  ReceberPedidoCompraSchema,
  SalvarCotacaoSchema,
  SalvarPedidoCompraSchema,
  SalvarPropostaCotacaoSchema,
  ValidadeAnexoSchema,
  parseOrThrow,
} from "../validators";

export interface HistoricoDeItemComCatalogo extends HistoricoDeItem {
  /** Item do catálogo de preços do orçamento ligado a esta compra, se houver. */
  catalogo: { id: number; descricao: string; preco_unitario: number; unidade: string | null } | null;
}

export interface DocumentoVencidoDeParceiro {
  parceiroId: string;
  parceiro: string;
  nome: string;
  validade: string;
}

export interface DocumentoVencidoDeFuncionario {
  funcionarioId: string;
  funcionario: string;
  nome: string;
  validade: string;
}

/** O que a tela de obra precisa saber de um funcionário para alocá-lo. */
export interface FuncionarioParaObra {
  id: string;
  nome: string;
  cargo: string | null;
  tipos_trabalho: string[];
}

export function createComprasContext(supabase: SupabaseClient) {
  const pedidoRepo = new PedidoCompraRepository(supabase);
  const cotacaoRepo = new CotacaoRepository(supabase);
  const diariaRepo = new DiariaRepository(supabase);
  const servicoRepo = new ServicoRepository(supabase);
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);

  return {
    // ----------------------------------------------------------------- Pedidos

    listarPedidos(filtros?: FiltrosPedidoCompra): Promise<PedidoCompra[]> {
      return pedidoRepo.listar(filtros);
    },

    async criarPedido(input: unknown, usuarioEmail?: string | null): Promise<PedidoCompra> {
      const { itens, ...dados } = parseOrThrow(SalvarPedidoCompraSchema, input);
      const pedido = await pedidoRepo.create({
        ...dados,
        servico_id: dados.servico_id ?? null,
        cotacao_id: dados.cotacao_id ?? null,
        previsao_entrega: dados.previsao_entrega ?? null,
        observacoes: dados.observacoes ?? null,
        valor_total: totalPedido(itens),
        criado_por: usuarioEmail ?? null,
      } as Partial<PedidoCompra>);
      await pedidoRepo.gravarItens(pedido.id, itens.map((i) => ({ ...i, preco_config_id: i.preco_config_id ?? null })));
      return pedidoRepo.buscar(pedido.id);
    },

    /** Pedido recebido ou cancelado não é mais editável — o recebido já gerou
     * conta a pagar com o valor da época. */
    async atualizarPedido(id: string, input: unknown): Promise<PedidoCompra> {
      const atual = await pedidoRepo.buscar(id);
      if (atual.status === "recebido" || atual.status === "cancelado") {
        throw new ConflictError(`Pedido ${atual.status} não pode ser alterado.`);
      }
      const { itens, ...dados } = parseOrThrow(SalvarPedidoCompraSchema, input);
      await pedidoRepo.update(id, {
        ...dados,
        servico_id: dados.servico_id ?? null,
        previsao_entrega: dados.previsao_entrega ?? null,
        observacoes: dados.observacoes ?? null,
        valor_total: totalPedido(itens),
        updated_at: new Date().toISOString(),
      } as Partial<PedidoCompra>);
      await pedidoRepo.gravarItens(id, itens.map((i) => ({ ...i, preco_config_id: i.preco_config_id ?? null })));
      return pedidoRepo.buscar(id);
    },

    async acaoPedido(id: string, input: unknown): Promise<PedidoCompra> {
      const { acao } = parseOrThrow(AcaoPedidoCompraSchema, input);
      const atual = await pedidoRepo.buscar(id);

      const transicoes: Record<typeof acao, { de: PedidoCompra["status"][]; para: PedidoCompra["status"] }> = {
        enviar: { de: ["rascunho"], para: "enviado" },
        cancelar: { de: ["rascunho", "enviado"], para: "cancelado" },
        reabrir: { de: ["enviado", "cancelado"], para: "rascunho" },
      };
      const transicao = transicoes[acao];
      if (!transicao.de.includes(atual.status)) {
        throw new ConflictError(`Não é possível ${acao} um pedido ${atual.status}.`);
      }
      await pedidoRepo.update(id, { status: transicao.para, updated_at: new Date().toISOString() } as Partial<PedidoCompra>);
      return pedidoRepo.buscar(id);
    },

    /** Recebe o pedido e gera a conta a pagar ligada ao fornecedor e à obra. */
    async receberPedido(id: string, input: unknown): Promise<PedidoCompra> {
      const dados = parseOrThrow(ReceberPedidoCompraSchema, input);
      const pedido = await pedidoRepo.buscar(id);
      if (pedido.status !== "rascunho" && pedido.status !== "enviado") {
        throw new ConflictError(`Não é possível receber um pedido ${pedido.status}.`);
      }

      let lancamentoId: string | null = null;
      if (!dados.sem_lancamento && pedido.valor_total > 0) {
        const lancamento = await criarLancamento(
          {
            tipo: "despesa",
            categoria: dados.categoria,
            descricao: `Compra ${pedido.numero} — ${pedido.fornecedor?.nome ?? "fornecedor"}`,
            valor: pedido.valor_total,
            data: dados.vencimento,
            data_competencia: dados.data_recebimento,
            forma_pagamento: dados.forma_pagamento ?? null,
            fornecedor_id: pedido.fornecedor_id,
            servico_id: pedido.servico_id,
            ...(dados.parcelas > 1 && { parcelas: dados.parcelas }),
          },
          { lancamentoRepo }
        );
        lancamentoId = lancamento.id;
      }

      await pedidoRepo.update(id, {
        status: "recebido",
        data_recebimento: dados.data_recebimento,
        lancamento_id: lancamentoId,
        updated_at: new Date().toISOString(),
      } as Partial<PedidoCompra>);
      return pedidoRepo.buscar(id);
    },

    /** Só rascunho ou cancelado — pedido enviado se cancela, recebido fica
     * como histórico de preço e de conta a pagar. */
    async excluirPedido(id: string): Promise<void> {
      const pedido = await pedidoRepo.buscar(id);
      if (pedido.status !== "rascunho" && pedido.status !== "cancelado") {
        throw new ConflictError(`Pedido ${pedido.status} não pode ser excluído — cancele-o antes, se ainda não foi recebido.`);
      }
      await pedidoRepo.delete(id);
    },

    // ---------------------------------------------------------------- Cotações

    listarCotacoes(): Promise<Cotacao[]> {
      return cotacaoRepo.listar();
    },

    async criarCotacao(input: unknown, usuarioEmail?: string | null): Promise<Cotacao> {
      const dados = parseOrThrow(SalvarCotacaoSchema, input);
      const cotacao = await cotacaoRepo.create({
        ...dados,
        servico_id: dados.servico_id ?? null,
        observacoes: dados.observacoes ?? null,
        criado_por: usuarioEmail ?? null,
      } as Partial<Cotacao>);
      return cotacaoRepo.findByIdOrThrow(cotacao.id);
    },

    async atualizarCotacao(id: string, input: unknown): Promise<Cotacao> {
      const dados = parseOrThrow(SalvarCotacaoSchema, input);
      await cotacaoRepo.update(id, {
        ...dados,
        servico_id: dados.servico_id ?? null,
        observacoes: dados.observacoes ?? null,
        updated_at: new Date().toISOString(),
      } as Partial<Cotacao>);
      return cotacaoRepo.findByIdOrThrow(id);
    },

    excluirCotacao(id: string): Promise<void> {
      return cotacaoRepo.delete(id);
    },

    async salvarProposta(cotacaoId: string, input: unknown): Promise<Cotacao> {
      const dados = parseOrThrow(SalvarPropostaCotacaoSchema, input);
      await cotacaoRepo.findByIdOrThrow(cotacaoId);
      await cotacaoRepo.salvarProposta(cotacaoId, {
        fornecedor_id: dados.fornecedor_id,
        precos: dados.precos,
        prazo_entrega_dias: dados.prazo_entrega_dias ?? null,
        condicao_pagamento: dados.condicao_pagamento ?? null,
        observacoes: dados.observacoes ?? null,
      });
      return cotacaoRepo.findByIdOrThrow(cotacaoId);
    },

    async removerProposta(cotacaoId: string, propostaId: string): Promise<Cotacao> {
      await cotacaoRepo.removerProposta(cotacaoId, propostaId);
      return cotacaoRepo.findByIdOrThrow(cotacaoId);
    },

    /** Transforma a proposta escolhida num pedido de compra em rascunho (com
     * os itens e preços dela) e marca a cotação como concluída. Item que o
     * fornecedor não cotou entra com preço zero, pra ser preenchido. */
    async gerarPedidoDaCotacao(cotacaoId: string, input: unknown, usuarioEmail?: string | null): Promise<PedidoCompra> {
      const { proposta_id } = parseOrThrow(GerarPedidoDaCotacaoSchema, input);
      const cotacao = await cotacaoRepo.findByIdOrThrow(cotacaoId);
      const proposta = (cotacao.propostas ?? []).find((p) => p.id === proposta_id);
      if (!proposta) throw new NotFoundError("Proposta não encontrada nesta cotação.");

      const itens = cotacao.itens.map((item) => ({
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        preco_unitario: proposta.precos?.[item.id] ?? 0,
        preco_config_id: null,
      }));

      const pedido = await pedidoRepo.create({
        fornecedor_id: proposta.fornecedor_id,
        servico_id: cotacao.servico_id,
        cotacao_id: cotacao.id,
        data_pedido: hojeBrasilia(),
        observacoes: [`Gerado da cotação ${cotacao.numero}.`, proposta.condicao_pagamento && `Pagamento: ${proposta.condicao_pagamento}.`].filter(Boolean).join(" "),
        valor_total: totalPedido(itens),
        criado_por: usuarioEmail ?? null,
      } as Partial<PedidoCompra>);
      await pedidoRepo.gravarItens(pedido.id, itens);
      await cotacaoRepo.update(cotacaoId, { status: "concluida", updated_at: new Date().toISOString() } as Partial<Cotacao>);
      return pedidoRepo.buscar(pedido.id);
    },

    // ------------------------------------------------------ Histórico de preços

    async historicoDePrecos(): Promise<HistoricoDeItemComCatalogo[]> {
      const [compras, catalogo] = await Promise.all([pedidoRepo.listarComprasDeItens(), listarPrecosDoCatalogo(supabase)]);
      const porId = new Map(catalogo.map((c) => [c.id, c]));
      return historicoDePrecos(compras).map((item) => {
        const c = item.preco_config_id !== null ? porId.get(item.preco_config_id) : undefined;
        return { ...item, catalogo: c ? { id: c.id, descricao: c.descricao, preco_unitario: Number(c.preco_unitario), unidade: c.unidade } : null };
      });
    },

    listarCatalogo() {
      return listarPrecosDoCatalogo(supabase);
    },

    /** Leva o preço de compra para o catálogo usado nos orçamentos. */
    async aplicarPrecoAoCatalogo(input: unknown): Promise<void> {
      const corpo = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
      const id = Number(corpo.preco_config_id);
      const preco = Number(corpo.preco_unitario);
      if (!Number.isInteger(id) || id <= 0) throw new ValidationError("Item do catálogo inválido.");
      if (!Number.isFinite(preco) || preco <= 0) throw new ValidationError("Preço inválido.");
      await atualizarPrecoDoCatalogo(supabase, id, preco);
    },

    // ------------------------------------------------- Lista de compras da obra

    /** Materiais quantificados do orçamento da obra, somados — `multiplicador`
     * escala a lista (orçamento por metro/unidade). */
    async listaDeComprasDaObra(servicoId: string, multiplicador: number): Promise<ItemListaCompras[]> {
      if (!Number.isFinite(multiplicador) || multiplicador <= 0) throw new ValidationError("Multiplicador inválido.");
      const servico = await servicoRepo.findByIdOrThrow(servicoId);
      if (!servico.orcamento_id) throw new ConflictError("Esta obra não tem orçamento vinculado.");

      const [trechos, config] = await Promise.all([listarTrechosDoOrcamento(supabase, servico.orcamento_id), buscarConfigEmpresa(supabase)]);
      if (!config) throw new ConflictError("Configuração da empresa não encontrada (parâmetros de quantificação).");

      const quantificados = trechos
        .filter((t) => Array.isArray(t.escopo_itens) && t.escopo_itens.length > 0)
        .map((t) => {
          const espessura = Number(t.espessura_necessaria_mm) || 0;
          const q = quantificarMateriais(t.escopo_itens as ItemEscopo[], espessura, config as unknown as ParametrosQuantificacao);
          return {
            isolante: t.material ? `${t.material}${espessura > 0 ? ` ${espessura}mm` : ""}` : "",
            acabamento: t.acabamento ?? "",
            ...q,
          };
        });
      return listaDeCompras(quantificados, multiplicador);
    },

    // ------------------------------------------------------------------ Diárias

    async diariasDoServico(servicoId: string): Promise<{ diarias: Diaria[]; resumo: ResumoDiarias }> {
      const diarias = await diariaRepo.listarPorServico(servicoId);
      return { diarias, resumo: resumirDiarias(diarias) };
    },

    async criarDiaria(servicoId: string, input: unknown, usuarioEmail?: string | null): Promise<Diaria> {
      const dados = parseOrThrow(CreateDiariaSchema, input);
      await servicoRepo.findByIdOrThrow(servicoId);
      const diaria = await diariaRepo.create({
        ...dados,
        parceiro_id: dados.parceiro_id ?? null,
        funcionario_id: dados.funcionario_id ?? null,
        funcao: dados.funcao ?? null,
        observacoes: dados.observacoes ?? null,
        servico_id: servicoId,
        criado_por: usuarioEmail ?? null,
      } as Partial<Diaria>);
      return diaria;
    },

    excluirDiaria(id: string): Promise<void> {
      return diariaRepo.delete(id);
    },

    // ------------------------------------------- Equipe própria (funcionários)

    /** Funcionários ativos e os documentos vencidos deles — para alocar numa
     * obra ou apontar diária. */
    async funcionariosParaObra(): Promise<{ funcionarios: FuncionarioParaObra[]; documentosVencidos: DocumentoVencidoDeFuncionario[] }> {
      const [ativos, documentosVencidos] = await Promise.all([
        new FuncionarioRepository(supabase).listar({ status: "ativo" }),
        listarDocumentosVencidosDeFuncionarios(supabase),
      ]);
      return {
        funcionarios: ativos.map((f) => ({ id: f.id, nome: f.nome, cargo: f.cargo, tipos_trabalho: f.tipos_trabalho ?? [] })),
        documentosVencidos,
      };
    },

    async alocarFuncionario(servicoId: string, input: unknown): Promise<void> {
      const dados = parseOrThrow(AlocarFuncionarioSchema, input);
      await servicoRepo.findByIdOrThrow(servicoId);
      await alocarFuncionarioNoServico(supabase, servicoId, dados.funcionario_id, dados.tipos_trabalho);
    },

    removerFuncionario(servicoId: string, execucaoId: string): Promise<void> {
      return removerFuncionarioDoServico(supabase, servicoId, execucaoId);
    },

    // --------------------------------------------- Documentação dos parceiros

    /** Documentos vencidos de parceiros ativos — aviso ao alocar numa obra. */
    async documentosVencidosDeParceiros(): Promise<DocumentoVencidoDeParceiro[]> {
      const hoje = hojeBrasilia();
      return (await listarDocumentosDeParceirosComValidade(supabase)).filter((d) => situacaoValidade(d.validade, hoje, 0) === "vencido");
    },

    async definirValidadeDoAnexo(parceiroId: string, anexoId: string, input: unknown): Promise<void> {
      const { validade } = parseOrThrow(ValidadeAnexoSchema, input);
      await definirValidadeAnexoParceiro(supabase, parceiroId, anexoId, validade);
    },
  };
}
