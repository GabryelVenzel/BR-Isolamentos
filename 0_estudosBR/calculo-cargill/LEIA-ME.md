# Estudo Cargill — Linhas 1 e 2 (memória de cálculo interna)

Não enviar ao cliente. Base para o estudo detalhado.

## Como reproduzir
```
node rodar.js 0.2191     # Ø 8"   -> resultados_DN8.json
node rodar.js 0.5        # Ø 500  -> resultados_D500.json
node graficos.js DN8     # PNGs em graficos/ (usa Chrome headless)
node gerar-relatorio.js DN8   # .docx em 0_estudosBR/
```

## Modelo (modelo.js)
- Motor: `engine/calculadora-termica.js`, compilado de `lib/calculadora-termica.ts` (mesmo motor do site).
- Materiais: fibra cerâmica 96 kg/m³ (atual) e lã de rocha 64 kg/m³ (novo), k(T) de `materials_internal.py`.
- Acabamentos: alumínio oxidado ε 0,25 (atual), alumínio fosco novo ε 0,07 (novo).
- Linha marchada em passos de 0,5 m: m·cp·dT = −q'(T)·dx. 10 m iniciais em área fechada (30 °C, sem vento), resto ao ar livre (25 °C, 2 m/s).
- Calibração: a vazão (m·cp) é ajustada para o estado atual reproduzir o ΔT medido (30 e 35 °C); a mesma vazão calcula o isolamento novo.

## Hipóteses que mais mexem no resultado (validar em campo)
1. Fibra cerâmica 96 kg/m³ e 100 mm: adotados por decisão do usuário. Se for maior, 50 mm piora ainda mais.
2. Fator de degradação da fibra cerâmica (1,3): hipótese; laboratório indica 1,03 a 1,24 (ver referências no relatório). Equilíbrio dos 50 mm só com fator ≈ 1,6+.
3. Diâmetro: 8" (cliente) x Ø 500 (desenhos). O ΔT depois é quase igual; a energia (kWh, R$) escala com a área.
4. Vazão não informada: implícita de ~990 Nm³/h (Ø 8", 19 m/s) ou ~1.890 Nm³/h (Ø 500, 6,5 m/s).
5. Novo: k da lã de rocha +5% (singularidades). k da base do site para lã 64 é otimista frente a isotubo comercial (~100+ kg/m³).
6. Financeiro: R$ 7,50/m³ (referência do site), 7.920 h/ano, PCI 9,65, eficiência 0,75, 2,0 kg CO2/m³.
7. Termografia feita com ε 0,97 em chapa de alumínio: valores absolutos subestimados (só uso qualitativo).
