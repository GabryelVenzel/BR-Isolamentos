// Use case do painel "Frio" da calculadora rápida (módulo Engenharia). Fiel
// ao painel "Frio" de 2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py: usa
// Umidade Relativa do ar (%) como entrada — NÃO ponto de orvalho direto — e
// calcula a temperatura de orvalho internamente pela fórmula de Magnus
// (linha ~518-519 do Python), exatamente como `calcularEspessuraMinimaCondensacao`
// já faz. Emissividade fixa em 0.9 (Python passa 0.9 direto na chamada,
// sem selecionar acabamento nesse painel) — por isso não há
// `acabamento_id` aqui, diferente do painel Quente.
//
// O painel Frio do Python também tem campo de velocidade do vento (default
// 0 m/s, "convecção natural") — mantido aqui, diferente do painel Quente
// (ver calcularQuente.ts) que não tem esse campo.
//
// Resultado inclui `temperatura_face_fria` e `perda_*_kw_m2`, que o Python
// não exibe pro usuário nesse painel (só espessura + orvalho) — adicionados
// aqui porque são fisicamente reais (não inventados: saem de rodar a mesma
// função de convergência já usada, só uma vez a mais na espessura
// encontrada) e dão mais contexto de engenharia sem alterar o método de
// cálculo em si.

import {
  calcularEspessuraMinimaCondensacao,
  calcularPerdaSemIsolante,
  encontrarTemperaturaFaceFria,
} from "../../calculadora-termica";
import { ConfigurationError, ValidationError } from "../../errors";
import { CalcularFrioSchema, parseOrThrow } from "../../validators";
import type { MaterialIsolante } from "../../types";

const EMISSIVIDADE_FRIO = 0.9;

export interface ResultadoFrio {
  espessura_minima_mm: number;
  temperatura_orvalho: number;
  temperatura_face_fria: number;
  perda_com_isolante_kw_m2: number;
  perda_sem_isolante_kw_m2: number;
}

export function calcularFrio(input: unknown, contexto: { material: MaterialIsolante }): ResultadoFrio {
  const dados = parseOrThrow(CalcularFrioSchema, input);
  const { material } = contexto;

  if (dados.temperatura_interna < material.t_min || dados.temperatura_interna > material.t_max) {
    throw new ValidationError(
      `Material inadequado para ${dados.temperatura_interna}°C (limites de "${material.nome}": ${material.t_min}°C a ${material.t_max}°C).`
    );
  }

  const pipeDiameterM = dados.geometria === "tubulacao" ? (dados.diametro_mm ?? 0) / 1000 : undefined;

  const { temperaturaOrvalho, espessuraMinimaMm, convergiu } = calcularEspessuraMinimaCondensacao(
    dados.temperatura_interna,
    dados.temperatura_ambiente,
    dados.umidade_relativa,
    material.k_func,
    dados.geometria,
    pipeDiameterM,
    dados.velocidade_vento_ms
  );

  if (!convergiu || espessuraMinimaMm === null) {
    throw new ConfigurationError("Não foi possível encontrar uma espessura que evite condensação até 500 mm.");
  }

  // Segunda passada na espessura já encontrada, só pra extrair temperatura
  // de face fria / perda térmica reais nesse ponto (ver nota no topo do
  // arquivo) — mesma física, sem custo de precisão adicional.
  const { temperaturaFaceFria, qTransferencia } = encontrarTemperaturaFaceFria(
    dados.temperatura_interna,
    dados.temperatura_ambiente,
    espessuraMinimaMm / 1000,
    material.k_func,
    dados.geometria,
    EMISSIVIDADE_FRIO,
    pipeDiameterM,
    dados.velocidade_vento_ms
  );

  const perdaSemIsolanteKwM2 = calcularPerdaSemIsolante(
    dados.temperatura_interna,
    dados.temperatura_ambiente,
    dados.geometria,
    EMISSIVIDADE_FRIO,
    pipeDiameterM,
    dados.velocidade_vento_ms
  );

  return {
    espessura_minima_mm: espessuraMinimaMm,
    temperatura_orvalho: temperaturaOrvalho,
    temperatura_face_fria: temperaturaFaceFria ?? temperaturaOrvalho,
    perda_com_isolante_kw_m2: qTransferencia !== null ? qTransferencia / 1000 : 0,
    perda_sem_isolante_kw_m2: perdaSemIsolanteKwM2,
  };
}
