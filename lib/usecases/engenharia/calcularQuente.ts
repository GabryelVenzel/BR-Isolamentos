// Use case do painel "Quente" da calculadora rápida (módulo Engenharia).
// Fiel ao painel "Quente" de 2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py
// (linha ~390: `encontrar_temperatura_face_fria(Tq, To, L_total/1000,
// k_func_str, geometry, emissividade, pipe_diameter_mm/1000)`) — repare que
// `wind_speed_ms` nunca é passado nessa chamada, então usa o default da
// função (0). O painel "Quente" do Python simplesmente NÃO TEM campo de
// vento — o pior cenário térmico (maior perda, isolamento dimensionado pra
// segurança) é sem ventilação forçada alguma. Diferente do painel "Frio",
// que tem esse campo (ver calcularFrio.ts).

import {
  calcularPerdaSemIsolante,
  encontrarTemperaturaFaceFria,
} from "../../calculadora-termica";
import { ConfigurationError, ValidationError } from "../../errors";
import { CalcularQuenteSchema, parseOrThrow } from "../../validators";
import type { Acabamento, MaterialIsolante } from "../../types";

export interface ResultadoQuente {
  espessura_mm: number;
  temperatura_face_fria: number;
  perda_com_isolante_kw_m2: number;
  perda_sem_isolante_kw_m2: number;
}

/** v_wind hardcoded em 0 — ver comentário no topo do arquivo. */
const VENTO_QUENTE_MS = 0;

export function calcularQuente(
  input: unknown,
  contexto: { material: MaterialIsolante; acabamento: Acabamento }
): ResultadoQuente {
  const dados = parseOrThrow(CalcularQuenteSchema, input);
  const { material, acabamento } = contexto;

  if (dados.temperatura_quente < material.t_min || dados.temperatura_quente > material.t_max) {
    throw new ValidationError(
      `Material inadequado para ${dados.temperatura_quente}°C (limites de "${material.nome}": ${material.t_min}°C a ${material.t_max}°C).`
    );
  }

  const pipeDiameterM = dados.geometria === "tubulacao" ? (dados.diametro_mm ?? 0) / 1000 : undefined;
  const lTotalM = dados.espessura_mm / 1000;

  const { temperaturaFaceFria, qTransferencia, convergiu } = encontrarTemperaturaFaceFria(
    dados.temperatura_quente,
    dados.temperatura_ambiente,
    lTotalM,
    material.k_func,
    dados.geometria,
    acabamento.emissividade,
    pipeDiameterM,
    VENTO_QUENTE_MS
  );

  if (!convergiu || temperaturaFaceFria === null || qTransferencia === null) {
    throw new ConfigurationError("O cálculo não convergiu. Verifique os dados de entrada.");
  }

  const perdaSemIsolanteKwM2 = calcularPerdaSemIsolante(
    dados.temperatura_quente,
    dados.temperatura_ambiente,
    dados.geometria,
    acabamento.emissividade,
    pipeDiameterM,
    VENTO_QUENTE_MS
  );

  return {
    espessura_mm: dados.espessura_mm,
    temperatura_face_fria: temperaturaFaceFria,
    perda_com_isolante_kw_m2: qTransferencia / 1000,
    perda_sem_isolante_kw_m2: perdaSemIsolanteKwM2,
  };
}
