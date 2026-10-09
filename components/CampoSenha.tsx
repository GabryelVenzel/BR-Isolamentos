"use client";

import { useState } from "react";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
}

/** Campo de senha com botão de mostrar/ocultar — usado no login e na troca
 * de senha. */
export default function CampoSenha({ id, label, value, onChange, autoComplete, required = true }: Props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div>
      <label className="label-field" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          required={required}
          className="input-field pr-20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-controls={id}
          className="absolute inset-y-0 right-0 px-3 font-montserrat text-xs font-semibold text-brand hover:underline"
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}
