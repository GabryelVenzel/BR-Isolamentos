// Máscaras e validações de documentos brasileiros — funções PURAS, usadas
// nos formulários (enquanto digita) e nos validadores de servidor.

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// --- CPF -------------------------------------------------------------------

export function mascaraCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function validarCpf(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

// --- CNPJ ------------------------------------------------------------------
// Desde julho/2026 a Receita emite CNPJ ALFANUMÉRICO: os 12 primeiros
// caracteres podem ser letras ou números, os 2 dígitos verificadores
// continuam numéricos. O cálculo é o mesmo módulo 11 de sempre, usando
// (código ASCII − 48) como valor de cada caractere — para dígitos dá o
// próprio número, então CNPJs antigos (só numéricos) validam igual.

/** Só os 14 caracteres significativos do CNPJ, em maiúsculas. */
export function normalizarCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

export function mascaraCnpj(valor: string): string {
  const c = normalizarCnpj(valor);
  return c
    .replace(/^(.{2})(.)/, "$1.$2")
    .replace(/^(.{2})\.(.{3})(.)/, "$1.$2.$3")
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, "$1.$2.$3/$4")
    .replace(/^(.{2})\.(.{3})\.(.{3})\/(.{4})(.)/, "$1.$2.$3/$4-$5");
}

export function validarCnpj(valor: string): boolean {
  const c = normalizarCnpj(valor);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += (c.charCodeAt(i) - 48) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(c[12]) && digito(13) === Number(c[13]);
}

// --- CPF ou CNPJ no mesmo campo (cadastro de cliente) -------------------------

/** Tem letra ou mais de 11 caracteres → CNPJ; senão, CPF. */
export function ehCnpj(valor: string): boolean {
  const c = normalizarCnpj(valor);
  return /[A-Z]/.test(c) || c.length > 11;
}

export function mascaraCpfCnpj(valor: string): string {
  return ehCnpj(valor) ? mascaraCnpj(valor) : mascaraCpf(valor);
}

export function validarCpfCnpj(valor: string): boolean {
  return ehCnpj(valor) ? validarCnpj(valor) : validarCpf(valor);
}

// --- Telefone e CEP --------------------------------------------------------

/** (11) 91234-5678 ou (11) 1234-5678 — o hífen se ajusta ao tamanho. */
export function mascaraTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCep(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// --- Moeda -----------------------------------------------------------------
// O campo de valor guarda um número decimal em texto ("1234.56", o mesmo
// formato que os formulários já usavam com <input type="number">) e mostra
// "1.234,56". A digitação é no estilo de maquininha: cada dígito entra pelos
// centavos.

/** "1234.56" → "1.234,56" (vazio continua vazio). */
export function decimalParaMoeda(decimal: string): string {
  if (decimal === "" || decimal === null || decimal === undefined) return "";
  const numero = Number(decimal);
  if (!Number.isFinite(numero)) return "";
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Texto digitado no campo → decimal em texto. "1.234,5" + tecla "6" chega
 * aqui como "1.234,56"; apagar tudo devolve "". */
export function moedaDigitadaParaDecimal(digitado: string): string {
  const d = somenteDigitos(digitado).replace(/^0+(?=\d)/, "").slice(0, 13);
  if (d === "") return "";
  return (Number(d) / 100).toFixed(2);
}
