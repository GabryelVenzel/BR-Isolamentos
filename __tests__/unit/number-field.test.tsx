import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import NumberField from "@/components/modules/engenharia/NumberField";

/** Wrapper com estado real (igual como a página usa o componente) — testar
 * o NumberField "solto" com um mock de onChange não pegaria o bug original
 * (input começando em "0", perdendo o "." de um decimal no meio da
 * digitação), que só aparece quando o valor volta pro componente via prop
 * a cada render. */
function Wrapper() {
  const [valor, setValor] = useState<number | undefined>(undefined);
  return <NumberField label="Campo" value={valor} onChange={setValor} />;
}

describe("NumberField", () => {
  it("começa vazio, não com '0'", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText("Campo") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("digitar 1, depois 2, depois 3 forma '123' (não '0123')", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText("Campo") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "1" } });
    expect(input.value).toBe("1");

    fireEvent.change(input, { target: { value: "12" } });
    expect(input.value).toBe("12");

    fireEvent.change(input, { target: { value: "123" } });
    expect(input.value).toBe("123");
  });

  it("apagar tudo (backspace) volta pro vazio, não pro '0'", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText("Campo") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "50" } });
    expect(input.value).toBe("50");

    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
  });

  it("não perde o ponto decimal no meio da digitação (ex.: '12.' antes de '12.5')", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText("Campo") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.change(input, { target: { value: "12." } });
    // Ponto de decimal sozinho não deve "sumir" mesmo o valor numérico
    // equivalente já ser 12 (mesmo valor de antes do ponto).
    expect(input.value).toBe("12.");

    fireEvent.change(input, { target: { value: "12.5" } });
    expect(input.value).toBe("12.5");
  });
});
