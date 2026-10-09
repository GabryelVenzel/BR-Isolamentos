// Controle de acesso por módulo (migração 039). Arquivo PURO (sem Supabase,
// sem next/headers) de propósito: é importado pelo middleware (Edge runtime),
// por rotas de API e por componentes de cliente.
//
// Fonte de verdade: tabela `usuarios` (`role` = "admin" e `modulos`), que é
// o que as regras de acesso do banco consultam. O `app_metadata` do usuário
// no Supabase Auth guarda um espelho ({ admin, modulos, ativo, trocar_senha })
// gravado pela MESMA rota que altera `usuarios` (app/api/rh/usuarios) — é o
// que o middleware lê, sem precisar de uma consulta extra ao banco a cada
// requisição. `app_metadata` só pode ser escrito com a chave de serviço, o
// próprio usuário não consegue alterá-lo.

/** Só contas deste domínio podem entrar no sistema ou ser cadastradas. */
export const DOMINIO_EMAIL = "br-isolamentos.com.br";

export const MODULOS = ["resumo", "engenharia", "comercial", "operacional", "orcamento", "financeiro", "rh"] as const;
export type Modulo = (typeof MODULOS)[number];

export const LABEL_MODULO: Record<Modulo, string> = {
  resumo: "Resumo",
  engenharia: "Engenharia",
  comercial: "Comercial",
  operacional: "Operacional",
  orcamento: "Orçamento",
  financeiro: "Financeiro",
  rh: "RH",
};

/** Rota de entrada de cada módulo, na ordem da Navbar. */
export const ROTA_INICIAL_MODULO: Record<Modulo, string> = {
  resumo: "/resumo",
  engenharia: "/engenharia",
  comercial: "/comercial",
  operacional: "/operacional/servicos",
  orcamento: "/historico",
  financeiro: "/financeiro/lancamentos",
  rh: "/rh",
};

export interface Acesso {
  admin: boolean;
  modulos: Modulo[];
  ativo: boolean;
  trocarSenha: boolean;
}

export const SEM_ACESSO: Acesso = { admin: false, modulos: [], ativo: false, trocarSenha: false };

export function ehModulo(valor: unknown): valor is Modulo {
  return typeof valor === "string" && (MODULOS as readonly string[]).includes(valor);
}

/** Lê o espelho de acesso do `app_metadata`. Conta sem o espelho (ex.: criada
 * direto no painel do Supabase, fora da tela RH → Usuários) não tem acesso a
 * nada até um administrador configurá-la. */
export function acessoDeMetadata(appMetadata: Record<string, unknown> | null | undefined): Acesso {
  if (!appMetadata) return SEM_ACESSO;
  const modulos = Array.isArray(appMetadata.modulos) ? appMetadata.modulos.filter(ehModulo) : [];
  return {
    admin: appMetadata.admin === true,
    modulos,
    ativo: appMetadata.ativo === true,
    trocarSenha: appMetadata.trocar_senha === true,
  };
}

export function emailPermitido(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DOMINIO_EMAIL}`);
}

export function podeAcessarModulo(acesso: Acesso, modulo: Modulo): boolean {
  return acesso.ativo && (acesso.admin || acesso.modulos.includes(modulo));
}

/** Primeira tela que o usuário pode abrir (ordem da Navbar) — destino do
 * login e de qualquer redirecionamento por falta de permissão. */
export function rotaInicial(acesso: Acesso): string | null {
  if (!acesso.ativo) return null;
  const modulo = MODULOS.find((m) => podeAcessarModulo(acesso, m));
  return modulo ? ROTA_INICIAL_MODULO[modulo] : null;
}

type Regra = { livre: true } | { apenasAdmin: true } | { modulos: Modulo[] };

function comecaCom(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

/** O que uma rota exige. `livre` = qualquer usuário ATIVO; `modulos` = ter
 * pelo menos um dos módulos listados; `apenasAdmin` = só administrador.
 *
 * Leituras (GET) das APIs de Comercial/Operacional/Orçamento/Engenharia são
 * livres de propósito: as telas se cruzam (o detalhe do lead lista
 * orçamentos e parceiros, "Novo Serviço" lista leads, etc.) — o que cada um
 * VÊ no menu é decidido pelas páginas. Financeiro e RH são fechados também
 * na leitura, e o banco repete essa regra (migração 039). */
export function regraDaRota(pathname: string, metodo: string): Regra {
  const leitura = metodo === "GET" || metodo === "HEAD";

  // Gestão de usuários e registro de alterações: só administrador.
  if (comecaCom(pathname, "/rh/usuarios") || comecaCom(pathname, "/api/rh/usuarios") || comecaCom(pathname, "/api/rh/auditoria")) {
    return { apenasAdmin: true };
  }

  if (comecaCom(pathname, "/api")) {
    if (comecaCom(pathname, "/api/auth") || comecaCom(pathname, "/api/arquivo")) return { livre: true };

    // Os dashboards do Resumo consomem os relatórios dos outros módulos.
    if (leitura && pathname === "/api/financeiro/relatorios") return { modulos: ["financeiro", "resumo"] };
    if (comecaCom(pathname, "/api/financeiro")) return { modulos: ["financeiro"] };
    if (comecaCom(pathname, "/api/rh")) return { modulos: ["rh"] };
    if (comecaCom(pathname, "/api/resumo")) return { modulos: ["resumo"] };

    if (leitura) return { livre: true };

    if (comecaCom(pathname, "/api/usuarios")) return { apenasAdmin: true };
    // "Criar serviço" também é oferecido no detalhe de um lead fechado.
    if (pathname === "/api/operacional/servicos") return { modulos: ["operacional", "comercial"] };
    if (comecaCom(pathname, "/api/operacional")) return { modulos: ["operacional"] };
    if (comecaCom(pathname, "/api/comercial")) return { modulos: ["comercial"] };
    if (comecaCom(pathname, "/api/clientes")) return { modulos: ["comercial", "orcamento"] };
    if (comecaCom(pathname, "/api/engenharia") || comecaCom(pathname, "/api/calcular-termico") || comecaCom(pathname, "/api/quantificar")) {
      return { modulos: ["engenharia", "orcamento"] };
    }
    return { modulos: ["orcamento"] };
  }

  if (comecaCom(pathname, "/resumo")) return { modulos: ["resumo"] };
  if (comecaCom(pathname, "/engenharia")) return { modulos: ["engenharia"] };
  if (comecaCom(pathname, "/comercial")) return { modulos: ["comercial"] };
  if (comecaCom(pathname, "/operacional")) return { modulos: ["operacional"] };
  if (comecaCom(pathname, "/financeiro")) return { modulos: ["financeiro"] };
  if (comecaCom(pathname, "/rh")) return { modulos: ["rh"] };
  if (["/historico", "/novo-orcamento", "/config-precos", "/orcamento"].some((p) => comecaCom(pathname, p))) {
    return { modulos: ["orcamento"] };
  }

  // "/", "/conta/...", "/sem-acesso".
  return { livre: true };
}

export function podeAcessarRota(acesso: Acesso, pathname: string, metodo: string): boolean {
  if (!acesso.ativo) return false;
  const regra = regraDaRota(pathname, metodo);
  if ("livre" in regra) return true;
  if (acesso.admin) return true;
  if ("apenasAdmin" in regra) return false;
  return regra.modulos.some((m) => acesso.modulos.includes(m));
}
