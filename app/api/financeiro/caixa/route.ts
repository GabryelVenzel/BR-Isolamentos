import { responder, sessao } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

/** Ponto de partida do fluxo de caixa (migração 053): saldo em conta numa
 * data. A partir dela o saldo de hoje soma tudo que foi pago/recebido. */
export async function GET() {
  const { supabase } = await sessao();
  return responder("ler o saldo inicial do caixa", async () => {
    const { data, error } = await supabase.from("config_empresa").select("id, caixa_data_inicial, caixa_saldo_inicial").limit(1).maybeSingle();
    if (error) throw error;
    return data;
  });
}

export async function PUT(request: Request) {
  const { supabase } = await sessao();
  const corpo = await request.json().catch(() => null);
  return responder("salvar o saldo inicial do caixa", async () => {
    const data = String(corpo?.caixa_data_inicial ?? "");
    const saldo = Number(corpo?.caixa_saldo_inicial);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ValidationError("Informe a data inicial do caixa.");
    if (!Number.isFinite(saldo)) throw new ValidationError("Informe o saldo inicial (pode ser zero).");
    const { data: atual, error: erroLeitura } = await supabase.from("config_empresa").select("id").limit(1).single();
    if (erroLeitura) throw erroLeitura;
    const { data: salvo, error } = await supabase
      .from("config_empresa")
      .update({ caixa_data_inicial: data, caixa_saldo_inicial: saldo })
      .eq("id", atual.id)
      .select("id, caixa_data_inicial, caixa_saldo_inicial")
      .single();
    if (error) throw error;
    return salvo;
  });
}
