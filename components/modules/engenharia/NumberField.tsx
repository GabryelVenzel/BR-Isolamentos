"use client";

import { useEffect, useId, useState } from "react";

interface Props {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  required?: boolean;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Input numérico que começa VAZIO (não "0") e não força o usuário a apagar
 * um zero antes de digitar — problema comum de `<input type="number"
 * value={numero}>` ligado direto a um `useState<number>` (o valor sempre
 * "volta" formatado como número a cada render, então digitar "12." vira
 * "12" no meio do processo, atrapalhando quem está digitando um decimal).
 *
 * A solução é manter o TEXTO digitado como estado local (`texto`) e só
 * repassar pro componente pai a versão já convertida em `number | undefined`
 * via `onChange` — o pai nunca vê string, só número (ou `undefined` quando
 * vazio). `texto` só é resincronizado com `value` quando eles realmente
 * divergem (reset externo do formulário), nunca a cada tecla digitada.
 *
 * `type="text"` (com `inputMode="decimal"` pra abrir teclado numérico no
 * celular), não `type="number"`: um `<input type="number">` nativo aplica
 * seu próprio "algoritmo de sanitização" no valor (a spec HTML exige o
 * formato exato de "floating-point number" — um "12." no meio da digitação
 * de "12.5" não é válido nesse formato e o browser pode limpar o campo).
 * `type="text"` não sanitiza nada — o componente é quem decide o que é um
 * número válido antes de repassar pro `onChange`, sem interferência do
 * input nativo.
 */
export default function NumberField({ label, value, onChange, required, helperText, disabled, placeholder }: Props) {
  const id = useId();
  const [texto, setTexto] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    if (value === undefined) {
      setTexto("");
      return;
    }
    if (Number(texto) !== value) setTexto(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    setTexto(raw);
    if (raw.trim() === "") {
      onChange(undefined);
      return;
    }
    const numero = Number(raw);
    if (!Number.isNaN(numero)) onChange(numero);
  }

  return (
    <div>
      <label htmlFor={id} className="label-field">
        {label}
        {required && <span className="text-status-error"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="input-field"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
      />
      {helperText && <p className="mt-1 text-xs text-gray-400">{helperText}</p>}
    </div>
  );
}
