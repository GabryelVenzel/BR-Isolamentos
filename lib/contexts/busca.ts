// Busca geral (revisão de usabilidade) — o campo do cabeçalho (Ctrl+K) que
// acha lead, obra, orçamento, cliente, parceiro, fornecedor ou funcionário
// pelo código ou pelo nome, sem precisar saber em que módulo está. Cada
// consulta passa pelas regras de acesso do banco: quem não tem o módulo
// simplesmente não recebe resultado daquela tabela.

import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoResultadoBusca = "lead" | "servico" | "orcamento" | "cliente" | "parceiro" | "fornecedor" | "funcionario";

export interface ResultadoBusca {
  tipo: TipoResultadoBusca;
  id: string;
  titulo: string;
  detalhe: string | null;
  href: string;
}

const LIMITE = 6;

/** Escapa os curingas do ILIKE e as vírgulas/parênteses do filtro `or`. */
function termoSeguro(q: string): string {
  return q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ").trim();
}

export function createBuscaContext(supabase: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function consulta<T>(promessa: PromiseLike<{ data: any; error: unknown }>): Promise<T[]> {
    try {
      const { data, error } = await promessa;
      return error ? [] : ((data ?? []) as T[]);
    } catch {
      return [];
    }
  }

  return {
    async buscar(q: string): Promise<ResultadoBusca[]> {
      const termo = termoSeguro(q);
      if (termo.length < 2) return [];
      const like = `%${termo}%`;

      // Clientes que batem pelo nome — servem também para achar leads, obras
      // e orçamentos deles.
      const clientes = await consulta<{ id: number; nome: string; razao_social: string | null; cidade: string | null }>(
        supabase
          .from("clientes")
          .select("id, nome, razao_social, cidade")
          .is("excluido_em", null)
          .or(`nome.ilike.${like},razao_social.ilike.${like},cnpj_cpf.ilike.${like}`)
          .limit(LIMITE)
      );
      const idsClientes = clientes.map((c) => c.id);
      const filtroCliente = idsClientes.length > 0 ? `,cliente_id.in.(${idsClientes.join(",")})` : "";
      const doCliente = (coluna: string) => `${coluna}.ilike.${like}${filtroCliente}`;

      const [leads, servicos, orcamentos, parceiros, fornecedores, funcionarios] = await Promise.all([
        consulta<{ id: string; numero_lead: string | null; etapa: string; cliente: { nome: string } | null }>(
          supabase.from("leads").select("id, numero_lead, etapa, cliente:clientes(nome)").is("excluido_em", null).or(doCliente("numero_lead")).limit(LIMITE)
        ),
        consulta<{ id: string; numero_servico: string; etapa: string; cliente: { nome: string } | null }>(
          supabase.from("servicos").select("id, numero_servico, etapa, cliente:clientes(nome)").is("excluido_em", null).or(doCliente("numero_servico")).limit(LIMITE)
        ),
        consulta<{ id: number; numero: string; numero_orcamento: string | null; status: string; cliente: { nome: string } | null }>(
          supabase
            .from("orcamentos")
            .select("id, numero, numero_orcamento, status, cliente:clientes(nome)")
            .is("excluido_em", null)
            .or(`numero.ilike.${like},numero_orcamento.ilike.${like}${filtroCliente}`)
            .order("id", { ascending: false })
            .limit(LIMITE)
        ),
        consulta<{ id: string; nome: string; cidade?: string | null; categoria_parceiro?: string }>(supabase.from("parceiros").select("*").ilike("nome", like).limit(LIMITE)),
        consulta<{ id: string; nome: string; cidade?: string | null }>(supabase.from("fornecedores").select("*").ilike("nome", like).limit(LIMITE)),
        consulta<{ id: string; nome: string; cargo: string | null; numero_funcionario: string | null }>(
          supabase.from("funcionarios").select("id, nome, cargo, numero_funcionario").or(`nome.ilike.${like},numero_funcionario.ilike.${like}`).limit(LIMITE)
        ),
      ]);

      return [
        ...leads.map((l) => ({ tipo: "lead" as const, id: l.id, titulo: [l.numero_lead, l.cliente?.nome].filter(Boolean).join(" · ") || "Lead", detalhe: `Lead · ${l.etapa}`, href: `/comercial/leads/${l.id}` })),
        ...servicos.map((s) => ({ tipo: "servico" as const, id: s.id, titulo: [s.numero_servico, s.cliente?.nome].filter(Boolean).join(" · "), detalhe: `Obra · ${s.etapa}`, href: `/operacional/servicos/${s.id}` })),
        ...orcamentos.map((o) => ({
          tipo: "orcamento" as const,
          id: String(o.id),
          titulo: [o.numero, o.cliente?.nome].filter(Boolean).join(" · "),
          detalhe: `Orçamento${o.numero_orcamento ? ` ${o.numero_orcamento}` : ""} · ${o.status}`,
          href: `/orcamento/${o.id}`,
        })),
        ...clientes.map((c) => ({ tipo: "cliente" as const, id: String(c.id), titulo: c.nome, detalhe: ["Cliente", c.razao_social, c.cidade].filter(Boolean).join(" · "), href: `/comercial/clientes/${c.id}` })),
        ...parceiros.map((p) => {
          const cat = p.categoria_parceiro;
          const [rotulo, href] =
            cat === "parceria"
              ? ["Parceria", `/comercial/parcerias/${p.id}`]
              : cat === "representante"
                ? ["Representante", `/comercial/representantes/${p.id}`]
                : ["Prestador", `/operacional/prestadores/${p.id}`];
          return { tipo: "parceiro" as const, id: p.id, titulo: p.nome, detalhe: [rotulo, p.cidade].filter(Boolean).join(" · "), href };
        }),
        ...fornecedores.map((f) => ({ tipo: "fornecedor" as const, id: f.id, titulo: f.nome, detalhe: ["Fornecedor", f.cidade].filter(Boolean).join(" · "), href: `/operacional/fornecedores/${f.id}` })),
        ...funcionarios.map((f) => ({
          tipo: "funcionario" as const,
          id: f.id,
          titulo: f.nome,
          detalhe: ["Funcionário", f.numero_funcionario, f.cargo].filter(Boolean).join(" · "),
          href: `/rh/funcionarios/${f.id}`,
        })),
      ];
    },
  };
}
