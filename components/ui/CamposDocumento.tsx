"use client";

import { useRef, useState } from "react";
import { consultarCep, consultarCnpj, type DadosCep, type DadosCnpj } from "@/lib/consultas-publicas";
import {
  decimalParaMoeda,
  ehCnpj,
  mascaraCep,
  mascaraCnpj,
  mascaraCpf,
  mascaraCpfCnpj,
  mascaraTelefone,
  moedaDigitadaParaDecimal,
  somenteDigitos,
  validarCnpj,
  validarCpf,
} from "@/lib/mascaras";

// Campos de cadastro com máscara, validação e preenchimento automático.
// Todos seguem o mesmo contrato dos <input> que substituem: `value` em texto
// e `onChange(texto)` — o formulário continua guardando uma string.

type Situacao = { tipo: "buscando" | "ok" | "aviso" | "erro"; texto: string } | null;

const CLASSE_SITUACAO: Record<NonNullable<Situacao>["tipo"], string> = {
  buscando: "text-gray-500",
  ok: "text-accent-dark",
  aviso: "text-gray-500",
  erro: "text-status-error",
};

function Mensagem({ situacao }: { situacao: Situacao }) {
  if (!situacao) return null;
  return (
    <p role={situacao.tipo === "erro" ? "alert" : "status"} className={`mt-1 text-xs ${CLASSE_SITUACAO[situacao.tipo]}`}>
      {situacao.texto}
    </p>
  );
}

interface PropsBase {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}

/** CNPJ (ou CPF/CNPJ no mesmo campo, com `aceitaCpf`). Ao completar um CNPJ
 * válido, consulta a Receita e entrega os dados em `onDados` — quem decide o
 * que preencher é o formulário. */
export function CampoCnpj({ id, value, onChange, disabled, aceitaCpf = false, onDados }: PropsBase & {
  aceitaCpf?: boolean;
  onDados?: (dados: DadosCnpj) => void;
}) {
  const [situacao, setSituacao] = useState<Situacao>(null);
  const ultimoConsultado = useRef("");

  async function aoDigitar(digitado: string) {
    const mascarado = aceitaCpf ? mascaraCpfCnpj(digitado) : mascaraCnpj(digitado);
    onChange(mascarado);

    const cnpj = !aceitaCpf || ehCnpj(mascarado);
    const completo = cnpj ? mascarado.length === 18 : mascarado.length === 14;
    if (!completo) {
      setSituacao(null);
      return;
    }

    if (!(cnpj ? validarCnpj(mascarado) : validarCpf(mascarado))) {
      setSituacao({ tipo: "erro", texto: `${cnpj ? "CNPJ" : "CPF"} inválido — confira os números.` });
      return;
    }
    if (!cnpj || !onDados) {
      setSituacao(null);
      return;
    }
    if (ultimoConsultado.current === mascarado) return;
    ultimoConsultado.current = mascarado;

    setSituacao({ tipo: "buscando", texto: "Buscando dados na Receita..." });
    const dados = await consultarCnpj(mascarado);
    if (ultimoConsultado.current !== mascarado) return; // digitou outro enquanto buscava
    if (!dados) {
      setSituacao({ tipo: "aviso", texto: "Não encontrei esse CNPJ na consulta — preencha os dados manualmente." });
      return;
    }
    onDados(dados);
    setSituacao({ tipo: "ok", texto: `Dados preenchidos: ${dados.razaoSocial}.` });
  }

  return (
    <>
      <input
        id={id}
        className="input-field"
        value={value}
        disabled={disabled}
        onChange={(e) => aoDigitar(e.target.value)}
        placeholder={aceitaCpf ? "CPF ou CNPJ" : "00.000.000/0000-00"}
        autoComplete="off"
      />
      <Mensagem situacao={situacao} />
    </>
  );
}

export function CampoCpf({ id, value, onChange, disabled }: PropsBase) {
  const invalido = value.length === 14 && !validarCpf(value);
  return (
    <>
      <input
        id={id}
        className="input-field"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(mascaraCpf(e.target.value))}
        placeholder="000.000.000-00"
        autoComplete="off"
      />
      <Mensagem situacao={invalido ? { tipo: "erro", texto: "CPF inválido — confira os números." } : null} />
    </>
  );
}

export function CampoTelefone({ id, value, onChange, disabled }: PropsBase) {
  return (
    <input
      id={id}
      type="tel"
      className="input-field"
      inputMode="tel"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(mascaraTelefone(e.target.value))}
      placeholder="(00) 00000-0000"
    />
  );
}

/** CEP: ao completar os 8 dígitos, busca rua/bairro, cidade e estado. */
export function CampoCep({ id, value, onChange, disabled, onEndereco }: PropsBase & { onEndereco: (dados: DadosCep) => void }) {
  const [situacao, setSituacao] = useState<Situacao>(null);
  const ultimoConsultado = useRef("");

  async function aoDigitar(digitado: string) {
    const mascarado = mascaraCep(digitado);
    onChange(mascarado);
    const digitos = somenteDigitos(mascarado);
    if (digitos.length !== 8) {
      setSituacao(null);
      return;
    }
    if (ultimoConsultado.current === digitos) return;
    ultimoConsultado.current = digitos;

    setSituacao({ tipo: "buscando", texto: "Buscando endereço..." });
    const dados = await consultarCep(digitos);
    if (ultimoConsultado.current !== digitos) return;
    if (!dados) {
      setSituacao({ tipo: "aviso", texto: "CEP não encontrado — preencha o endereço manualmente." });
      return;
    }
    onEndereco(dados);
    setSituacao({ tipo: "ok", texto: "Endereço preenchido — complete com o número." });
  }

  return (
    <>
      <input
        id={id}
        className="input-field"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => aoDigitar(e.target.value)}
        placeholder="00000-000"
        autoComplete="postal-code"
      />
      <Mensagem situacao={situacao} />
    </>
  );
}

/** Valor em reais. `value`/`onChange` trafegam o decimal em texto ("1234.56"),
 * igual ao <input type="number"> que este campo substitui; na tela aparece
 * "R$ 1.234,56" e a digitação entra pelos centavos. */
export function CampoMoeda({ id, value, onChange, disabled, placeholder = "0,00" }: PropsBase & { placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500">R$</span>
      <input
        id={id}
        className="input-field pl-10 text-right"
        inputMode="numeric"
        value={decimalParaMoeda(value)}
        disabled={disabled}
        onChange={(e) => onChange(moedaDigitadaParaDecimal(e.target.value))}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
