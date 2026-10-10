// Consultas a serviços públicos gratuitos para preencher cadastros:
//   - CNPJ → BrasilAPI (https://brasilapi.com.br), dados da Receita Federal;
//   - CEP  → ViaCEP (https://viacep.com.br), base dos Correios.
// Chamadas feitas direto do navegador (os dois serviços liberam CORS). O que
// sai do sistema é só o CNPJ ou o CEP digitado. Se o serviço estiver fora do
// ar ou não achar o registro, o cadastro segue normalmente — é só um atalho
// de preenchimento.

import { mascaraCep, mascaraTelefone, normalizarCnpj, somenteDigitos } from "./mascaras";

export interface DadosCnpj {
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  email: string;
}

export interface DadosCep {
  endereco: string;
  cidade: string;
  estado: string;
}

const TEMPO_LIMITE_MS = 8000;

async function buscarJson(url: string): Promise<unknown | null> {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(url, { signal: controle.signal });
    if (!resposta.ok) return null;
    return await resposta.json();
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
  }
}

const texto = (valor: unknown): string => (typeof valor === "string" ? valor.trim() : "");

/** "RUA DAS FLORES" → "Rua das Flores" (a Receita devolve tudo em maiúsculas). */
function capitalizar(valor: string): string {
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  const siglas = new Set(["sa", "s/a", "s.a.", "ltda", "ltda.", "me", "epp", "eireli", "mei", "ii", "iii", "iv", "sn", "s/n"]);
  return valor
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, i) => {
      if (siglas.has(palavra)) return palavra.toUpperCase();
      return i > 0 && minusculas.has(palavra) ? palavra : palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

function montarEndereco(partes: { logradouro: string; numero?: string; complemento?: string; bairro: string }): string {
  const rua = [partes.logradouro, partes.numero].filter(Boolean).join(", ");
  return [rua, partes.complemento, partes.bairro].filter(Boolean).join(" — ");
}

/** `null` quando o CNPJ não foi encontrado ou o serviço não respondeu. */
export async function consultarCnpj(cnpj: string): Promise<DadosCnpj | null> {
  const dados = (await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${normalizarCnpj(cnpj)}`)) as Record<string, unknown> | null;
  if (!dados || !texto(dados.razao_social)) return null;

  const logradouro = [texto(dados.descricao_tipo_de_logradouro), texto(dados.logradouro)].filter(Boolean).join(" ");
  return {
    razaoSocial: capitalizar(texto(dados.razao_social)),
    nomeFantasia: capitalizar(texto(dados.nome_fantasia)),
    endereco: montarEndereco({
      logradouro: capitalizar(logradouro),
      numero: texto(dados.numero),
      complemento: capitalizar(texto(dados.complemento)),
      bairro: capitalizar(texto(dados.bairro)),
    }),
    cidade: capitalizar(texto(dados.municipio)),
    estado: texto(dados.uf).toUpperCase(),
    cep: mascaraCep(texto(dados.cep) || String(dados.cep ?? "")),
    telefone: mascaraTelefone(texto(dados.ddd_telefone_1)),
    email: texto(dados.email).toLowerCase(),
  };
}

/** `null` quando o CEP não existe ou o serviço não respondeu. */
export async function consultarCep(cep: string): Promise<DadosCep | null> {
  const digitos = somenteDigitos(cep);
  if (digitos.length !== 8) return null;
  const dados = (await buscarJson(`https://viacep.com.br/ws/${digitos}/json/`)) as Record<string, unknown> | null;
  if (!dados || dados.erro) return null;
  return {
    endereco: montarEndereco({ logradouro: texto(dados.logradouro), bairro: texto(dados.bairro) }),
    cidade: texto(dados.localidade),
    estado: texto(dados.uf).toUpperCase(),
  };
}
