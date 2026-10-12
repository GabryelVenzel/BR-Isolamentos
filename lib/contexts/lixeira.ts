// Contexto da LIXEIRA (migrações 045 e 047): listar, restaurar e remover de
// vez o que foi excluído de serviços, leads, orçamentos, clientes e
// lançamentos. Só administrador chega aqui (regra de rota em lib/acesso.ts)
// — além da rotina diária, que roda com a chave de serviço.
//
// Mandar algo PARA a lixeira não passa por aqui: é o "excluir" de cada
// módulo (ex.: `removerLead` em lib/contexts/comercial.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "../errors";
import { formatarData, formatarMoeda } from "../format";
import { DIAS_NA_LIXEIRA, TIPOS_LIXEIRA, type ItemLixeira, type TipoLixeira } from "../lixeira";
import { logger } from "../logger";
import {
  ClienteRepository,
  LancamentoFinanceiroRepository,
  LeadRepository,
  OrcamentoRepository,
  ServicoRepository,
} from "../repositories";
import type { BaseRepository } from "../repositories/base";
import type { Cliente, Orcamento } from "../types";
import type { LancamentoFinanceiro, Lead, Servico } from "../types/domain";

type Excluivel = { id: string | number; excluido_em?: string | null; excluido_por?: string | null };

interface Fonte<T extends Excluivel> {
  repo: BaseRepository<T>;
  resumir: (registro: T) => { titulo: string; detalhe: string | null };
}

function juntar(...partes: Array<string | null | undefined | false>): string | null {
  const validas = partes.filter(Boolean) as string[];
  return validas.length > 0 ? validas.join(" · ") : null;
}

export function createLixeiraContext(supabase: SupabaseClient) {
  const fontes = {
    servicos: {
      repo: new ServicoRepository(supabase),
      resumir: (s: Servico) => ({
        titulo: juntar(s.numero_servico, s.cliente?.nome) ?? "Serviço",
        detalhe: s.valor_orcado != null ? formatarMoeda(s.valor_orcado) : null,
      }),
    } satisfies Fonte<Servico>,
    leads: {
      repo: new LeadRepository(supabase),
      resumir: (l: Lead) => ({
        titulo: juntar(l.numero_lead, l.cliente?.nome) ?? "Lead",
        detalhe: juntar(`Etapa: ${l.etapa}`, l.valor_estimado ? formatarMoeda(l.valor_estimado) : null),
      }),
    } satisfies Fonte<Lead>,
    orcamentos: {
      repo: new OrcamentoRepository(supabase),
      resumir: (o: Orcamento) => ({
        titulo: juntar(o.numero, o.cliente?.nome) ?? "Orçamento",
        detalhe: o.valor_final != null ? formatarMoeda(o.valor_final) : null,
      }),
    } satisfies Fonte<Orcamento>,
    clientes: {
      repo: new ClienteRepository(supabase),
      resumir: (c: Cliente) => ({ titulo: c.nome, detalhe: juntar(c.razao_social, c.telefone, c.email) }),
    } satisfies Fonte<Cliente>,
    lancamentos: {
      repo: new LancamentoFinanceiroRepository(supabase),
      resumir: (l: LancamentoFinanceiro) => ({
        titulo: l.descricao || l.categoria,
        detalhe: juntar(
          l.tipo === "receita" ? "Receita" : "Despesa",
          formatarMoeda(l.valor),
          `vencimento ${formatarData(l.data)}`,
          l.parcela_numero != null && l.parcela_total != null && `parcela ${l.parcela_numero}/${l.parcela_total}`,
          l.pago ? "pago" : "em aberto"
        ),
      }),
    } satisfies Fonte<LancamentoFinanceiro>,
  };

  // Uma só assinatura para percorrer as cinco fontes sem repetir o código.
  const fonte = (tipo: TipoLixeira) => fontes[tipo] as unknown as Fonte<Excluivel>;

  async function listar(tipo: TipoLixeira): Promise<ItemLixeira[]> {
    const { repo, resumir } = fonte(tipo);
    const registros = await repo.listarLixeira();
    return registros.map((r) => ({
      id: String(r.id),
      ...resumir(r),
      excluido_em: r.excluido_em as string,
      excluido_por: r.excluido_por ?? null,
    }));
  }

  return {
    listar,

    async restaurar(tipo: TipoLixeira, id: string): Promise<void> {
      if (!(await fonte(tipo).repo.restaurarDaLixeira(id))) throw new NotFoundError("Registro não encontrado na lixeira.");
    },

    /** Remoção definitiva. Se outro registro ainda depende deste (ex.:
     * cliente com serviço), o banco recusa e a rota devolve a mensagem
     * amigável de "existem outros registros vinculados" (lib/errors.ts). */
    async excluirDeVez(tipo: TipoLixeira, id: string): Promise<void> {
      if (!(await fonte(tipo).repo.excluirDefinitivamente(id))) throw new NotFoundError("Registro não encontrado na lixeira.");
    },

    /** Rotina diária: remove de vez o que passou de `DIAS_NA_LIXEIRA` dias na
     * lixeira. Um a um, na ordem de `TIPOS_LIXEIRA` (clientes depois de leads
     * e orçamentos, que dependem deles) — um registro que o banco se recuse a
     * apagar fica para a próxima rodada sem travar os demais. Devolve o que
     * foi removido ("leads: L00012"). */
    async esvaziarVencidos(agora: Date = new Date()): Promise<string[]> {
      const limite = agora.getTime() - DIAS_NA_LIXEIRA * 24 * 60 * 60 * 1000;
      const removidos: string[] = [];

      for (const tipo of TIPOS_LIXEIRA) {
        const vencidos = (await listar(tipo)).filter((item) => new Date(item.excluido_em).getTime() < limite);
        for (const item of vencidos) {
          try {
            if (await fonte(tipo).repo.excluirDefinitivamente(item.id)) removidos.push(`${tipo}: ${item.titulo}`);
          } catch (error) {
            logger.error("Lixeira: não foi possível remover de vez um registro vencido", error, { tipo, id: item.id });
          }
        }
      }
      return removidos;
    },
  };
}
