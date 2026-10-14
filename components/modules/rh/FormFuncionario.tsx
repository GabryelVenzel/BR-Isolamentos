"use client";

import { useState } from "react";
import { CampoCep, CampoCpf, CampoMoeda, CampoTelefone } from "@/components/ui/CamposDocumento";
import MultiSelectTiposTrabalho, { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import { LABEL_VINCULO, VINCULOS, type VinculoFuncionario } from "@/lib/rh";
import type { Funcionario, FuncionarioDados, StatusFuncionario, TipoTrabalhoOperacional } from "@/lib/types/domain";
import { toast } from "./toast";

const STATUS_OPCOES: Array<{ valor: StatusFuncionario; label: string }> = [
  { valor: "ativo", label: "Ativo" },
  { valor: "inativo", label: "Inativo" },
  { valor: "desligado", label: "Desligado" },
];

type Dados = Omit<FuncionarioDados, "funcionario_id">;
const DADOS_VAZIOS: Dados = {
  rg: null,
  data_nascimento: null,
  cep: null,
  endereco: null,
  cidade: null,
  estado: null,
  contato_emergencia_nome: null,
  contato_emergencia_telefone: null,
  contato_emergencia_parentesco: null,
  salario: null,
  valor_diaria: null,
  pis: null,
  ctps: null,
  banco: null,
  agencia: null,
  conta: null,
  tipo_conta: null,
  chave_pix: null,
};

interface Props {
  /** `null` = novo cadastro. */
  funcionario: (Funcionario & { dados?: FuncionarioDados | null }) | null;
  onSalvo: (funcionario: Funcionario) => void;
}

/** Ficha do funcionário — aba "Dados" (migração 052): cadastro, contratação,
 * dados pessoais, contato de emergência, banco/PIX e tamanhos de uniforme e
 * EPI. Os dados sensíveis (pessoais, salário, banco) são gravados numa tabela
 * à parte, que só o módulo RH lê. */
export default function FormFuncionario({ funcionario, onSalvo }: Props) {
  const [f, setF] = useState(() => ({
    nome: funcionario?.nome ?? "",
    cargo: funcionario?.cargo ?? "",
    cpf: funcionario?.cpf ?? "",
    telefone: funcionario?.telefone ?? "",
    email: funcionario?.email ?? "",
    data_admissao: funcionario?.data_admissao ?? "",
    data_desligamento: funcionario?.data_desligamento ?? "",
    status: funcionario?.status ?? ("ativo" as StatusFuncionario),
    vinculo: (funcionario?.vinculo ?? "") as VinculoFuncionario | "",
    notas: funcionario?.notas ?? "",
    tipos_trabalho: (funcionario?.tipos_trabalho ?? []) as TipoTrabalhoOperacional[],
    tamanho_camisa: funcionario?.tamanho_camisa ?? "",
    tamanho_calca: funcionario?.tamanho_calca ?? "",
    tamanho_botina: funcionario?.tamanho_botina ?? "",
    tamanho_luva: funcionario?.tamanho_luva ?? "",
  }));
  const [d, setD] = useState<Dados>(() => ({ ...DADOS_VAZIOS, ...(funcionario?.dados ?? {}) }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const campo = (nome: keyof typeof f) => ({ value: (f[nome] as string) ?? "", onChange: (e: { target: { value: string } }) => setF((x) => ({ ...x, [nome]: e.target.value })) });
  const dado = (nome: keyof Dados) => ({ value: (d[nome] as string | null) ?? "", onChange: (e: { target: { value: string } }) => setD((x) => ({ ...x, [nome]: e.target.value || null })) });

  async function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do funcionário.");
    setErro(null);
    setSalvando(true);
    const vazio = (v: string) => (v.trim() ? v.trim() : null);
    const payload = {
      nome: f.nome.trim(),
      cargo: vazio(f.cargo),
      cpf: vazio(f.cpf),
      telefone: vazio(f.telefone),
      email: vazio(f.email),
      data_admissao: vazio(f.data_admissao),
      data_desligamento: vazio(f.data_desligamento),
      status: f.status,
      vinculo: f.vinculo || null,
      notas: vazio(f.notas),
      tipos_trabalho: f.tipos_trabalho,
      tamanho_camisa: vazio(f.tamanho_camisa),
      tamanho_calca: vazio(f.tamanho_calca),
      tamanho_botina: vazio(f.tamanho_botina),
      tamanho_luva: vazio(f.tamanho_luva),
      dados: d,
    };
    try {
      const response = await fetch(funcionario ? `/api/rh/funcionarios/${funcionario.id}` : "/api/rh/funcionarios", {
        method: funcionario ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) return setErro(data.error ?? "Erro ao salvar funcionário.");
      toast.sucesso(funcionario ? "Ficha atualizada." : "Colaborador cadastrado.");
      onSalvo(data.data);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Secao titulo="Cadastro">
        <Grade>
          <Campo rotulo="Nome" obrigatorio>
            <input className="input-field" {...campo("nome")} />
          </Campo>
          <Campo rotulo="Cargo">
            <input className="input-field" placeholder="Ex.: Isolador, Encarregado..." {...campo("cargo")} />
          </Campo>
          <Campo rotulo="CPF">
            <CampoCpf value={f.cpf} onChange={(v) => setF((x) => ({ ...x, cpf: v }))} />
          </Campo>
          <Campo rotulo="Telefone">
            <CampoTelefone value={f.telefone} onChange={(v) => setF((x) => ({ ...x, telefone: v }))} />
          </Campo>
          <Campo rotulo="E-mail">
            <input className="input-field" type="email" {...campo("email")} />
          </Campo>
          <Campo rotulo="Status">
            <select className="input-field" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value as StatusFuncionario }))}>
              {STATUS_OPCOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </select>
          </Campo>
        </Grade>
        <div>
          <p className="label-field">Funções</p>
          <MultiSelectTiposTrabalho value={f.tipos_trabalho} onChange={(tipos) => setF((x) => ({ ...x, tipos_trabalho: tipos }))} options={TIPOS_TRABALHO_OPCOES} />
          <p className="mt-1 text-xs text-gray-500">Usadas ao alocar o funcionário numa obra, em Operacional → Serviços.</p>
        </div>
      </Secao>

      <Secao titulo="Contratação">
        <Grade>
          <Campo rotulo="Vínculo">
            <select className="input-field" value={f.vinculo} onChange={(e) => setF((x) => ({ ...x, vinculo: e.target.value as VinculoFuncionario | "" }))}>
              <option value="">Não informado</option>
              {VINCULOS.map((v) => (
                <option key={v} value={v}>
                  {LABEL_VINCULO[v]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data de admissão">
            <input type="date" className="input-field" {...campo("data_admissao")} />
          </Campo>
          <Campo rotulo="Data de desligamento">
            <input type="date" className="input-field" {...campo("data_desligamento")} />
          </Campo>
          <Campo rotulo={f.vinculo === "socio" ? "Pró-labore mensal" : "Salário mensal"}>
            <CampoMoeda value={d.salario == null ? "" : String(d.salario)} onChange={(v) => setD((x) => ({ ...x, salario: v === "" ? null : Number(v) }))} />
          </Campo>
          <Campo rotulo="Valor da diária">
            <CampoMoeda value={d.valor_diaria == null ? "" : String(d.valor_diaria)} onChange={(v) => setD((x) => ({ ...x, valor_diaria: v === "" ? null : Number(v) }))} />
          </Campo>
          <Campo rotulo="PIS/NIS">
            <input className="input-field" {...dado("pis")} />
          </Campo>
          <Campo rotulo="CTPS (número e série)">
            <input className="input-field" {...dado("ctps")} />
          </Campo>
        </Grade>
      </Secao>

      <Secao titulo="Dados pessoais">
        <Grade>
          <Campo rotulo="RG">
            <input className="input-field" {...dado("rg")} />
          </Campo>
          <Campo rotulo="Data de nascimento">
            <input type="date" className="input-field" {...dado("data_nascimento")} />
          </Campo>
          <Campo rotulo="CEP">
            <CampoCep
              value={d.cep ?? ""}
              onChange={(v) => setD((x) => ({ ...x, cep: v || null }))}
              onEndereco={(end) => setD((x) => ({ ...x, endereco: end.endereco || x.endereco, cidade: end.cidade || x.cidade, estado: end.estado || x.estado }))}
            />
          </Campo>
          <Campo rotulo="Endereço (rua, número, bairro)" largo>
            <input className="input-field" {...dado("endereco")} />
          </Campo>
          <Campo rotulo="Cidade">
            <input className="input-field" {...dado("cidade")} />
          </Campo>
          <Campo rotulo="Estado (UF)">
            <input className="input-field" maxLength={2} {...dado("estado")} />
          </Campo>
        </Grade>
        <p className="text-sm font-semibold text-gray-600">Contato de emergência</p>
        <Grade>
          <Campo rotulo="Nome">
            <input className="input-field" {...dado("contato_emergencia_nome")} />
          </Campo>
          <Campo rotulo="Telefone">
            <CampoTelefone value={d.contato_emergencia_telefone ?? ""} onChange={(v) => setD((x) => ({ ...x, contato_emergencia_telefone: v || null }))} />
          </Campo>
          <Campo rotulo="Parentesco">
            <input className="input-field" placeholder="Ex.: esposa, mãe" {...dado("contato_emergencia_parentesco")} />
          </Campo>
        </Grade>
      </Secao>

      <Secao titulo="Dados bancários / PIX">
        <Grade>
          <Campo rotulo="Banco">
            <input className="input-field" {...dado("banco")} />
          </Campo>
          <Campo rotulo="Agência">
            <input className="input-field" {...dado("agencia")} />
          </Campo>
          <Campo rotulo="Conta">
            <input className="input-field" {...dado("conta")} />
          </Campo>
          <Campo rotulo="Tipo de conta">
            <select className="input-field" value={d.tipo_conta ?? ""} onChange={(e) => setD((x) => ({ ...x, tipo_conta: e.target.value || null }))}>
              <option value="">Não informado</option>
              <option value="corrente">Corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="pagamento">Conta de pagamento</option>
            </select>
          </Campo>
          <Campo rotulo="Chave PIX" largo>
            <input className="input-field" placeholder="CPF, celular, e-mail ou chave aleatória" {...dado("chave_pix")} />
          </Campo>
        </Grade>
      </Secao>

      <Secao titulo="Tamanhos de uniforme e EPI">
        <Grade>
          <Campo rotulo="Camisa">
            <input className="input-field" placeholder="P, M, G, GG..." {...campo("tamanho_camisa")} />
          </Campo>
          <Campo rotulo="Calça">
            <input className="input-field" placeholder="Ex.: 42" {...campo("tamanho_calca")} />
          </Campo>
          <Campo rotulo="Botina">
            <input className="input-field" placeholder="Ex.: 41" {...campo("tamanho_botina")} />
          </Campo>
          <Campo rotulo="Luva">
            <input className="input-field" placeholder="Ex.: 9" {...campo("tamanho_luva")} />
          </Campo>
        </Grade>
      </Secao>

      <Secao titulo="Notas">
        <textarea className="input-field" rows={3} {...campo("notas")} />
      </Secao>

      {erro && <p className="text-sm text-status-error">{erro}</p>}
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : funcionario ? "Salvar ficha" : "Cadastrar"}
        </button>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Grade({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Campo({ rotulo, obrigatorio, largo, children }: { rotulo: string; obrigatorio?: boolean; largo?: boolean; children: React.ReactNode }) {
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <label className="label-field">
        {rotulo}
        {obrigatorio && <span className="text-status-error"> *</span>}
      </label>
      {children}
    </div>
  );
}
