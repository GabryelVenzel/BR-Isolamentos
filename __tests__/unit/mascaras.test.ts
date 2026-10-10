import {
  decimalParaMoeda,
  ehCnpj,
  mascaraCep,
  mascaraCnpj,
  mascaraCpf,
  mascaraCpfCnpj,
  mascaraTelefone,
  moedaDigitadaParaDecimal,
  validarCnpj,
  validarCpf,
  validarCpfCnpj,
} from "@/lib/mascaras";

describe("CPF", () => {
  it("formata enquanto digita", () => {
    expect(mascaraCpf("529")).toBe("529");
    expect(mascaraCpf("5299")).toBe("529.9");
    expect(mascaraCpf("52998224725")).toBe("529.982.247-25");
    expect(mascaraCpf("529.982.247-25999")).toBe("529.982.247-25");
  });

  it("valida os dígitos verificadores", () => {
    expect(validarCpf("529.982.247-25")).toBe(true);
    expect(validarCpf("52998224725")).toBe(true);
    expect(validarCpf("529.982.247-26")).toBe(false);
    expect(validarCpf("111.111.111-11")).toBe(false);
    expect(validarCpf("123")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("formata enquanto digita", () => {
    expect(mascaraCnpj("11")).toBe("11");
    expect(mascaraCnpj("11222")).toBe("11.222");
    expect(mascaraCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(mascaraCnpj("11.222.333/0001-81999")).toBe("11.222.333/0001-81");
  });

  it("valida CNPJ numérico", () => {
    expect(validarCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCnpj("11222333000181")).toBe(true);
    expect(validarCnpj("11.222.333/0001-82")).toBe(false);
    expect(validarCnpj("00.000.000/0000-00")).toBe(false);
    expect(validarCnpj("11.222.333/0001")).toBe(false);
  });

  it("valida CNPJ alfanumérico (formato emitido desde julho/2026)", () => {
    // Exemplo oficial da Receita Federal para o novo formato.
    expect(validarCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(validarCnpj("12abc34501de35")).toBe(true);
    expect(validarCnpj("12.ABC.345/01DE-36")).toBe(false);
    expect(mascaraCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("CPF ou CNPJ no mesmo campo", () => {
  it("decide pelo tamanho ou pela presença de letra", () => {
    expect(ehCnpj("52998224725")).toBe(false);
    expect(ehCnpj("529982247251")).toBe(true);
    expect(ehCnpj("12ABC")).toBe(true);
  });

  it("aplica a máscara e a validação do documento certo", () => {
    expect(mascaraCpfCnpj("52998224725")).toBe("529.982.247-25");
    expect(mascaraCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(validarCpfCnpj("529.982.247-25")).toBe(true);
    expect(validarCpfCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCpfCnpj("11.222.333/0001-80")).toBe(false);
  });
});

describe("telefone e CEP", () => {
  it("telefone fixo e celular", () => {
    expect(mascaraTelefone("")).toBe("");
    expect(mascaraTelefone("11")).toBe("(11");
    expect(mascaraTelefone("1140028922")).toBe("(11) 4002-8922");
    expect(mascaraTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(mascaraTelefone("(11) 98765-4321 99")).toBe("(11) 98765-4321");
  });

  it("CEP", () => {
    expect(mascaraCep("08710")).toBe("08710");
    expect(mascaraCep("08710500")).toBe("08710-500");
    expect(mascaraCep("08710-5001")).toBe("08710-500");
  });
});

describe("moeda", () => {
  it("mostra o decimal no formato brasileiro", () => {
    expect(decimalParaMoeda("")).toBe("");
    expect(decimalParaMoeda("32")).toBe("32,00");
    expect(decimalParaMoeda("1234.5")).toBe("1.234,50");
    expect(decimalParaMoeda("29335.97")).toBe("29.335,97");
  });

  it("a digitação entra pelos centavos", () => {
    expect(moedaDigitadaParaDecimal("1")).toBe("0.01");
    expect(moedaDigitadaParaDecimal("0,012")).toBe("0.12");
    expect(moedaDigitadaParaDecimal("1.234,56")).toBe("1234.56");
    // acrescentar um dígito a "32,00" → "320,05"
    expect(moedaDigitadaParaDecimal("32,005")).toBe("320.05");
    // apagar o último dígito de "32,00" → "3,20"
    expect(moedaDigitadaParaDecimal("32,0")).toBe("3.20");
    expect(moedaDigitadaParaDecimal("")).toBe("");
    expect(moedaDigitadaParaDecimal("0,00")).toBe("0.00");
  });
});
