"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TipoImagem = "quente" | "frio" | "ambos" | null;

interface ImagemProposta {
  id: number;
  storage_path: string;
  url: string;
  legenda: string | null;
  /** Migração 022 — de que tipo de sistema é a instalação da foto, pra
   * Proposta Técnica/Comercial filtrar por `orcamento.tipo_trabalho`. `null`
   * = fotos cadastradas antes da migração, tratadas como "ambos". */
  tipo_trabalho: TipoImagem;
}

const BUCKET = "propostas-imagens";
const LABEL_TIPO: Record<Exclude<TipoImagem, null>, string> = { quente: "Quente", frio: "Frio", ambos: "Ambos" };

interface Props {
  /** Chamado depois de qualquer mudança na galeria (upload/remoção/legenda/
   * tipo) — quem usa este componente embutido numa tela que também mostra
   * essas imagens (app/orcamento/[id]/download-pdf/page.tsx) usa isso pra
   * recarregar a própria lista, já que este componente gerencia seu estado
   * internamente. */
  onChange?: () => void;
}

/**
 * Fotos institucionais reutilizadas nas Propostas Técnica e Comercial (ver
 * components/pdf-native/*.tsx), filtradas por tipo de sistema (quente/frio/
 * ambos, migração 022) conforme `orcamento.tipo_trabalho` de cada proposta
 * gerada. Fica vazio até o usuário subir as primeiras fotos reais da
 * empresa — nenhuma imagem é inventada/baixada da internet.
 *
 * Não lê a pasta local `3-FotosEvideos` diretamente: é uma pasta do disco de
 * quem desenvolve, fora de `public/` e fora do controle de versão — o app
 * publicado na Vercel não tem acesso a ela (serverless não enxerga o disco
 * local de quem desenvolveu). O Supabase Storage é o único jeito de fotos
 * ficarem disponíveis pro app já publicado, então o upload continua sendo
 * feito por aqui, pelo navegador, por quem já está logado no sistema.
 *
 * Vive na tela de Gerar Proposta (app/orcamento/[id]/download-pdf), dentro
 * de um bloco recolhível — já foi removida daqui e de Configurar Preços em
 * rodadas anteriores por deixar a tela poluída; o `<details>` resolve isso
 * sem tirar a funcionalidade de novo. */
export default function GaleriaImagensProposta({ onChange }: Props) {
  const [imagens, setImagens] = useState<ImagemProposta[]>([]);
  const [tipoNovoUpload, setTipoNovoUpload] = useState<TipoImagem>("ambos");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("imagens_proposta").select("*").order("criado_em", { ascending: false });
    setImagens(data ?? []);
    onChange?.();
  }

  useEffect(() => {
    carregar();
  }, []);

  async function enviarArquivos(event: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files ?? []);
    if (arquivos.length === 0) return;

    setErro(null);
    const supabase = createSupabaseBrowserClient();

    for (const arquivo of arquivos) {
      setEnviando(arquivo.name);
      const caminho = `${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) {
        setErro(`Erro ao enviar "${arquivo.name}": ${erroUpload.message}`);
        continue;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const { error: erroInsert } = await supabase
        .from("imagens_proposta")
        .insert({ storage_path: caminho, url: publicUrl.publicUrl, legenda: null, tipo_trabalho: tipoNovoUpload });
      if (erroInsert) {
        setErro(`Erro ao salvar "${arquivo.name}": ${erroInsert.message}`);
      }
    }

    await carregar();
    setEnviando(null);
    event.target.value = "";
  }

  async function remover(imagem: ImagemProposta) {
    const supabase = createSupabaseBrowserClient();
    await supabase.storage.from(BUCKET).remove([imagem.storage_path]);
    await supabase.from("imagens_proposta").delete().eq("id", imagem.id);
    setImagens((prev) => prev.filter((i) => i.id !== imagem.id));
    onChange?.();
  }

  async function atualizarLegenda(imagem: ImagemProposta, legenda: string) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("imagens_proposta").update({ legenda }).eq("id", imagem.id);
    setImagens((prev) => prev.map((i) => (i.id === imagem.id ? { ...i, legenda } : i)));
    onChange?.();
  }

  async function atualizarTipo(imagem: ImagemProposta, tipo: TipoImagem) {
    const supabase = createSupabaseBrowserClient();
    await supabase.from("imagens_proposta").update({ tipo_trabalho: tipo }).eq("id", imagem.id);
    setImagens((prev) => prev.map((i) => (i.id === imagem.id ? { ...i, tipo_trabalho: tipo } : i)));
    onChange?.();
  }

  return (
    <details className="card group">
      <summary className="cursor-pointer text-lg font-semibold">📷 Gerenciar fotos de referência ({imagens.length})</summary>

      <div className="mt-4 space-y-4">
        <p className="text-sm text-gray-500">
          Fotos institucionais/de obras da BR Isolamentos, reutilizadas nas Propostas Técnica e Comercial — filtradas
          automaticamente pelo tipo do orçamento (uma proposta "Frio" não mostra fotos marcadas só "Quente", e
          vice-versa). Nenhuma foto genérica é usada — só o que você subir aqui.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="label-field">Tipo das próximas fotos</label>
            <select className="input-field" value={tipoNovoUpload ?? "ambos"} onChange={(e) => setTipoNovoUpload(e.target.value as TipoImagem)}>
              <option value="ambos">Ambos (quente e frio)</option>
              <option value="quente">Quente</option>
              <option value="frio">Frio</option>
            </select>
          </div>
          <div>
            <label className="label-field">Selecionar fotos</label>
            <input type="file" accept="image/*" multiple onChange={enviarArquivos} disabled={enviando !== null} />
          </div>
        </div>
        {enviando && <p className="text-sm text-gray-500">Enviando "{enviando}"...</p>}
        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {imagens.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma imagem cadastrada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {imagens.map((imagem) => (
              <div key={imagem.id} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagem.url} alt={imagem.legenda ?? ""} className="h-32 w-full rounded-lg object-cover" />
                <select
                  className="input-field text-xs"
                  value={imagem.tipo_trabalho ?? "ambos"}
                  onChange={(e) => atualizarTipo(imagem, e.target.value as TipoImagem)}
                >
                  {(Object.keys(LABEL_TIPO) as Array<Exclude<TipoImagem, null>>).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {LABEL_TIPO[tipo]}
                    </option>
                  ))}
                </select>
                <input
                  className="input-field text-xs"
                  placeholder="Legenda (opcional)"
                  defaultValue={imagem.legenda ?? ""}
                  onBlur={(e) => atualizarLegenda(imagem, e.target.value)}
                />
                <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => remover(imagem)}>
                  remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
