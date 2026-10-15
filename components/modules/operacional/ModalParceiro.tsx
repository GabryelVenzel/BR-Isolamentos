"use client";

import { useState } from "react";
import { CampoCep, CampoCnpj, CampoCpf, CampoTelefone } from "@/components/ui/CamposDocumento";
import { toast } from "./toast";
import ParceiroAnexos from "./ParceiroAnexos";
import { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";
import type { CategoriaParceiro, Parceiro, TipoTrabalhoOperacional } from "@/lib/types/domain";
import FecharComEsc from "@/components/ui/FecharComEsc";

interface Props {
  parceiro: Parceiro | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
  /** "pagina": o formulário dentro da ficha em página própria (revisão de
   * usabilidade); padrão: janela. */
  modo?: "janela" | "pagina";
  /** Cadastro novo: aba de onde veio (Prestadores ou Parcerias). */
  categoria?: CategoriaParceiro;
}

// Reaproveita a mesma lista usada no multi-select de tipos de trabalho de um
// Serviço (migração 027) — uma fonte só, evita as duas telas divergirem de
// novo (era o caso antes: esta tinha sua própria cópia da lista de 4).
const TIPOS = TIPOS_TRABALHO_OPCOES;

const CATEGORIAS_PARCEIRO: Array<{ valor: CategoriaParceiro; label: string; descricao: string }> = [
  { valor: "prestador", label: "Prestador", descricao: "Fornece mão de obra — aparece na Agenda e pode ser vinculado a um Serviço." },
  { valor: "parceria", label: "Parceria", descricao: "Recebe nossas indicações e nos paga comissão — não aparece na Agenda." },
  { valor: "representante", label: "Representante", descricao: "Representa a empresa nas vendas e recebe comissão sobre o que vende." },
];

// Uma nota por tipo de trabalho (migração 030 — bug relatado: só bancada/
// caldeiraria tinham campo de nota, faltavam as outras 5 categorias novas
// da migração 027). Mapa central em vez de 7 campos de formulário/JSX
// hardcoded separados — extensível se a lista de tipos crescer de novo.
const CAMPO_NOTAS: Record<TipoTrabalhoOperacional, keyof Parceiro> = {
  bancada: "notas_bancada",
  isolador: "notas_isolador",
  funileiro_tracador: "notas_funileiro_tracador",
  caldeiraria: "notas_caldeiraria",
  caldeiraria_montagem: "notas_caldeiraria_montagem",
  removivel_montagem: "notas_removivel_montagem",
  removivel_fabricacao: "notas_removivel_fabricacao",
  ajudante: "notas_ajudante",
};

interface Form {
  nome: string;
  razaoSocial: string;
  telefone: string;
  cnpj: string;
  email: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
  categoriaParceiro: CategoriaParceiro;
  tiposTrabalho: TipoTrabalhoOperacional[];
  notas: Record<TipoTrabalhoOperacional, string>;
  totalPessoas: string;
  percentualPadrao: string;
}

function paraForm(p: Parceiro | null, categoria: CategoriaParceiro): Form {
  return {
    nome: p?.nome ?? "",
    razaoSocial: p?.razao_social ?? "",
    telefone: p?.telefone ?? "",
    cnpj: p?.cnpj ?? "",
    email: p?.email ?? "",
    cep: p?.cep ?? "",
    endereco: p?.endereco ?? "",
    cidade: p?.cidade ?? "",
    estado: p?.estado ?? "",
    categoriaParceiro: p?.categoria_parceiro ?? categoria,
    tiposTrabalho: p?.tipos_trabalho ?? [],
    notas: Object.fromEntries(
      TIPOS_TRABALHO_OPCOES.map((t) => [t.valor, (p?.[CAMPO_NOTAS[t.valor]] as string | null) ?? ""])
    ) as Record<TipoTrabalhoOperacional, string>,
    totalPessoas: p?.total_pessoas != null ? String(p.total_pessoas) : "",
    percentualPadrao: p?.percentual_comissao_padrao != null ? String(p.percentual_comissao_padrao) : "",
  };
}

export default function ModalParceiro({ parceiro, onFechar, onSalvo, modo = "janela", categoria = "prestador" }: Props) {
  const pagina = modo === "pagina";
  const [form, setForm] = useState<Form>(paraForm(parceiro, categoria));
  // Parceria (só indicação) não tem tipos de trabalho nem capacidade.
  const prestador = form.categoriaParceiro === "prestador";
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarTipo(tipo: TipoTrabalhoOperacional) {
    setForm((prev) => ({
      ...prev,
      tiposTrabalho: prev.tiposTrabalho.includes(tipo)
        ? prev.tiposTrabalho.filter((t) => t !== tipo)
        : [...prev.tiposTrabalho, tipo],
    }));
  }

  function alterarNota(tipo: TipoTrabalhoOperacional, valor: string) {
    setForm((prev) => ({ ...prev, notas: { ...prev.notas, [tipo]: valor } }));
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do parceiro.");
      return;
    }
    if (prestador && form.tiposTrabalho.length === 0) {
      setErro("Selecione pelo menos um tipo de trabalho.");
      return;
    }
    setErro(null);
    setSalvando(true);

    // Nota só é gravada se o tipo estiver marcado (desmarcar um tipo limpa a
    // nota correspondente) — mesmo comportamento de sempre, agora pras 7
    // categorias em vez de só 2.
    const notasPayload = Object.fromEntries(
      TIPOS_TRABALHO_OPCOES.map((t) => [CAMPO_NOTAS[t.valor], form.tiposTrabalho.includes(t.valor) ? form.notas[t.valor] || null : null])
    );

    const payload = {
      nome: form.nome,
      razao_social: form.razaoSocial || null,
      telefone: form.telefone || null,
      cnpj: form.cnpj || null,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      categoria_parceiro: form.categoriaParceiro,
      tipos_trabalho: form.tiposTrabalho,
      ...notasPayload,
      total_pessoas: form.totalPessoas ? Number(form.totalPessoas) : null,
      ...(form.categoriaParceiro === "representante" && { percentual_comissao_padrao: form.percentualPadrao === "" ? null : Number(form.percentualPadrao) }),
    };

    try {
      const response = parceiro
        ? await fetch(`/api/operacional/parceiros/${parceiro.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/operacional/parceiros", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErro(data.error ?? "Erro ao salvar parceiro.");
        return;
      }

      toast.sucesso(parceiro ? "Parceiro atualizado." : "Parceiro cadastrado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={pagina ? "" : "modal-fundo z-50"}>
      {!pagina && <FecharComEsc onFechar={onFechar} />}
      <div
        className={pagina ? "card" : "modal-caixa sm:max-w-2xl"}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={pagina ? "sr-only" : "mb-4 font-montserrat text-lg font-bold text-brand"}>
          {parceiro ? "Editar cadastro" : { prestador: "Novo Prestador", parceria: "Nova Parceria", representante: "Novo Representante" }[categoria]}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">
                Nome Fantasia<span className="text-status-error"> *</span>
              </label>
              <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Razão Social</label>
              <input
                className="input-field"
                value={form.razaoSocial}
                onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Telefone</label>
              <CampoTelefone value={form.telefone} onChange={(v) => setForm((f) => ({ ...f, telefone: v }))} />
            </div>
            <div>
              <label className="label-field">CNPJ</label>
              <CampoCnpj
                value={form.cnpj}
                onChange={(v) => setForm((f) => ({ ...f, cnpj: v }))}
                onDados={(d) =>
                  setForm((f) => ({
                    ...f,
                    nome: f.nome || d.nomeFantasia || d.razaoSocial,
                    razaoSocial: f.razaoSocial || d.razaoSocial,
                    telefone: f.telefone || d.telefone,
                    email: f.email || d.email,
                    cep: f.cep || d.cep,
                    endereco: f.endereco || d.endereco,
                    cidade: f.cidade || d.cidade,
                    estado: f.estado || d.estado,
                  }))
                }
              />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Estado</label>
              <select
                className="input-field"
                value={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {ESTADOS_BRASIL.map((uf) => (
                  <option key={uf.sigla} value={uf.sigla}>
                    {uf.sigla} ({uf.nome})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">CEP</label>
              <CampoCep
                value={form.cep}
                onChange={(v) => setForm((f) => ({ ...f, cep: v }))}
                onEndereco={(d) => setForm((f) => ({ ...f, endereco: d.endereco, cidade: d.cidade, estado: d.estado }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Endereço</label>
              <input className="input-field" value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Cidade</label>
              <input className="input-field" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
          </div>

          {/* Cadastro novo já nasce na aba de onde veio; na edição dá para
              mudar de aba (cadastro feito no lugar errado). */}
          {parceiro && (
          <div className="border-t border-gray-100 pt-4">
            <p className="label-field mb-2">
              Tipo de cadastro<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CATEGORIAS_PARCEIRO.map((c) => (
                <label
                  key={c.valor}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm ${
                    form.categoriaParceiro === c.valor ? "border-brand bg-brand-light/40" : "border-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-gray-800">
                    <input
                      type="radio"
                      name="categoria_parceiro"
                      checked={form.categoriaParceiro === c.valor}
                      onChange={() => setForm((f) => ({ ...f, categoriaParceiro: c.valor }))}
                    />
                    {c.label}
                  </span>
                  <span className="text-xs text-gray-500">{c.descricao}</span>
                </label>
              ))}
            </div>
          </div>
          )}

          {form.categoriaParceiro === "representante" && (
            <div className="border-t border-gray-100 pt-4">
              <label className="label-field" htmlFor="parc-percentual">
                % de comissão padrão
              </label>
              <input
                id="parc-percentual"
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="input-field max-w-[10rem]"
                value={form.percentualPadrao}
                onChange={(e) => setForm((f) => ({ ...f, percentualPadrao: e.target.value }))}
              />
              <p className="mt-1 text-xs text-gray-400">Vem preenchido nos leads deste representante; dá para mudar em cada lead.</p>
            </div>
          )}

          {prestador && (
            <>

          <div className="border-t border-gray-100 pt-4">
            <p className="label-field mb-2">
              Tipos de trabalho<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.tiposTrabalho.includes(t.valor)} onChange={() => alternarTipo(t.valor)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {form.tiposTrabalho.length > 0 && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="label-field">Notas por tipo de trabalho</p>
              {TIPOS.filter((t) => form.tiposTrabalho.includes(t.valor)).map((t) => (
                <input
                  key={t.valor}
                  className="input-field"
                  placeholder={`Notas — ${t.label}`}
                  value={form.notas[t.valor]}
                  onChange={(e) => alterarNota(t.valor, e.target.value)}
                />
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="label-field">Total de pessoas (capacidade máxima)</label>
            <input
              type="number"
              min={1}
              className="input-field max-w-[10rem]"
              value={form.totalPessoas}
              onChange={(e) => setForm((f) => ({ ...f, totalPessoas: e.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-400">
              Quantas pessoas mobilizadas/disponíveis por dia é calculado a partir dos serviços ativos — ver aba
              Capacidade.
            </p>
          </div>
            </>
          )}

          {/* Anexos só na edição (pedido explícito) — um parceiro recém-criado
              ainda não tem `id` real pra associar os documentos, e o próprio
              fluxo é "cadastra o parceiro primeiro, documentação depois". */}
          {parceiro && (
            <div className="border-t border-gray-100 pt-4">
              <ParceiroAnexos parceiroId={parceiro.id} />
            </div>
          )}

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className={pagina ? "mt-4 flex justify-end gap-3" : "rodape-modal flex justify-end gap-3"}>
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : parceiro ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
