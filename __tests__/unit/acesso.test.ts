import {
  SEM_ACESSO,
  acessoDeMetadata,
  emailPermitido,
  podeAcessarRota,
  rotaInicial,
  type Acesso,
} from "@/lib/acesso";
import { urlArquivo } from "@/lib/arquivos";

const admin: Acesso = { admin: true, modulos: [], ativo: true, trocarSenha: false };
const comercial: Acesso = { admin: false, modulos: ["comercial"], ativo: true, trocarSenha: false };
const operacional: Acesso = { admin: false, modulos: ["operacional"], ativo: true, trocarSenha: false };
const resumo: Acesso = { admin: false, modulos: ["resumo"], ativo: true, trocarSenha: false };
const inativo: Acesso = { admin: true, modulos: ["comercial"], ativo: false, trocarSenha: false };

describe("acessoDeMetadata", () => {
  it("conta sem espelho de acesso não tem acesso a nada", () => {
    expect(acessoDeMetadata(undefined)).toEqual(SEM_ACESSO);
    expect(acessoDeMetadata({ provider: "email" })).toEqual(SEM_ACESSO);
  });

  it("lê admin, módulos válidos, ativo e troca de senha", () => {
    expect(acessoDeMetadata({ admin: true, modulos: ["comercial", "inexistente", 3], ativo: true, trocar_senha: true })).toEqual({
      admin: true,
      modulos: ["comercial"],
      ativo: true,
      trocarSenha: true,
    });
  });

  it("só aceita os valores booleanos exatos", () => {
    expect(acessoDeMetadata({ admin: "true", ativo: 1 })).toEqual(SEM_ACESSO);
  });
});

describe("emailPermitido", () => {
  it("aceita só o domínio da empresa", () => {
    expect(emailPermitido("gabryel@br-isolamentos.com.br")).toBe(true);
    expect(emailPermitido("  Gabryel@BR-Isolamentos.com.br ")).toBe(true);
    expect(emailPermitido("gabryel@gmail.com")).toBe(false);
    expect(emailPermitido("gabryel@br-isolamentos.com.br.evil.com")).toBe(false);
    expect(emailPermitido("gabryel@xbr-isolamentos.com.br")).toBe(false);
  });
});

describe("rotaInicial", () => {
  it("administrador começa no Resumo", () => {
    expect(rotaInicial(admin)).toBe("/resumo");
  });

  it("usuário comum começa no primeiro módulo liberado", () => {
    expect(rotaInicial(comercial)).toBe("/comercial");
    expect(rotaInicial({ ...comercial, modulos: ["rh", "operacional"] })).toBe("/operacional/servicos");
  });

  it("inativo ou sem módulos não tem rota inicial", () => {
    expect(rotaInicial(inativo)).toBeNull();
    expect(rotaInicial({ ...comercial, modulos: [] })).toBeNull();
  });
});

describe("podeAcessarRota", () => {
  it("inativo não acessa nada, nem sendo admin", () => {
    expect(podeAcessarRota(inativo, "/comercial", "GET")).toBe(false);
    expect(podeAcessarRota(inativo, "/api/usuarios", "GET")).toBe(false);
  });

  it("administrador acessa tudo", () => {
    expect(podeAcessarRota(admin, "/financeiro/lancamentos", "GET")).toBe(true);
    expect(podeAcessarRota(admin, "/rh/usuarios", "GET")).toBe(true);
    expect(podeAcessarRota(admin, "/api/rh/usuarios", "POST")).toBe(true);
  });

  it("páginas exigem o módulo correspondente", () => {
    expect(podeAcessarRota(comercial, "/comercial", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/comercial/abc", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/financeiro/lancamentos", "GET")).toBe(false);
    expect(podeAcessarRota(comercial, "/historico", "GET")).toBe(false);
    expect(podeAcessarRota(comercial, "/comercialx", "GET")).toBe(true); // rota desconhecida = livre (404 do Next)
  });

  it("gestão de usuários e auditoria são só de administrador, mesmo com o módulo RH", () => {
    const rh: Acesso = { ...comercial, modulos: ["rh"] };
    expect(podeAcessarRota(rh, "/rh", "GET")).toBe(true);
    expect(podeAcessarRota(rh, "/rh/funcionarios", "GET")).toBe(true);
    expect(podeAcessarRota(rh, "/api/rh/funcionarios", "POST")).toBe(true);
    expect(podeAcessarRota(rh, "/rh/usuarios", "GET")).toBe(false);
    expect(podeAcessarRota(rh, "/api/rh/usuarios", "GET")).toBe(false);
    expect(podeAcessarRota(rh, "/api/rh/usuarios/123/senha", "POST")).toBe(false);
    expect(podeAcessarRota(rh, "/api/rh/auditoria", "GET")).toBe(false);
  });

  it("Financeiro e RH são fechados também na leitura", () => {
    expect(podeAcessarRota(comercial, "/api/financeiro/lancamentos", "GET")).toBe(false);
    expect(podeAcessarRota(comercial, "/api/rh/funcionarios", "GET")).toBe(false);
  });

  it("Resumo lê o relatório financeiro, mas não o resto do Financeiro", () => {
    expect(podeAcessarRota(resumo, "/api/financeiro/relatorios", "GET")).toBe(true);
    expect(podeAcessarRota(resumo, "/api/financeiro/lancamentos", "GET")).toBe(false);
    expect(podeAcessarRota(resumo, "/api/resumo/kpis", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/resumo/kpis", "GET")).toBe(false);
  });

  it("leituras cruzadas entre módulos operacionais são livres; gravações não", () => {
    expect(podeAcessarRota(comercial, "/api/operacional/parceiros", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/orcamentos", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/operacional/parceiros", "POST")).toBe(false);
    expect(podeAcessarRota(comercial, "/api/orcamentos", "POST")).toBe(false);
    expect(podeAcessarRota(operacional, "/api/comercial/leads/1/mover", "POST")).toBe(false);
  });

  it("exceções de gravação entre módulos", () => {
    // Criar serviço a partir de um lead fechado.
    expect(podeAcessarRota(comercial, "/api/operacional/servicos", "POST")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/operacional/servicos/1/mover", "POST")).toBe(false);
    // Clientes são compartilhados por Comercial e Orçamento.
    expect(podeAcessarRota(comercial, "/api/clientes", "POST")).toBe(true);
    expect(podeAcessarRota(operacional, "/api/clientes", "POST")).toBe(false);
    // Cálculo térmico serve Engenharia e Orçamento.
    expect(podeAcessarRota({ ...comercial, modulos: ["engenharia"] }, "/api/engenharia/calcular-quente", "POST")).toBe(true);
    expect(podeAcessarRota({ ...comercial, modulos: ["orcamento"] }, "/api/calcular-termico", "POST")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/calcular-orcamento", "POST")).toBe(false);
  });

  it("rotas de sessão, anexos e conta são livres para qualquer ativo", () => {
    expect(podeAcessarRota(comercial, "/api/auth/senha", "POST")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/arquivo/leads-anexos/x.pdf", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/conta/senha", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/usuarios", "GET")).toBe(true);
    expect(podeAcessarRota(comercial, "/api/usuarios", "POST")).toBe(false);
  });
});

describe("urlArquivo", () => {
  const publica = "https://abc.supabase.co/storage/v1/object/public/leads-anexos/123/1700000-contrato%20final.pdf";

  it("converte a URL pública gravada para a rota protegida", () => {
    expect(urlArquivo(publica)).toBe("/api/arquivo/leads-anexos/123/1700000-contrato%20final.pdf");
  });

  it("acrescenta o nome para download", () => {
    expect(urlArquivo(publica, { baixarComo: "contrato final.pdf" })).toBe(
      "/api/arquivo/leads-anexos/123/1700000-contrato%20final.pdf?baixar=contrato%20final.pdf"
    );
  });

  it("descarta parâmetros da URL original e deixa passar o que não é do Storage", () => {
    expect(urlArquivo(`${publica}?t=1`)).toBe("/api/arquivo/leads-anexos/123/1700000-contrato%20final.pdf");
    expect(urlArquivo("https://exemplo.com/foto.jpg")).toBe("https://exemplo.com/foto.jpg");
    expect(urlArquivo(null)).toBe("");
  });
});
