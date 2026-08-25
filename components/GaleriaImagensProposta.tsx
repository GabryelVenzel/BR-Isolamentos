"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ImagemProposta {
  id: number;
  storage_path: string;
  url: string;
  legenda: string | null;
}

const BUCKET = "propostas-imagens";

interface Props {
  /** Chamado depois de qualquer mudança na galeria (upload/remoção/legenda)
   * — quem usa este componente embutido numa tela que também mostra essas
   * imagens (ex.: app/orcamento/[id]/download-pdf/page.tsx, na prévia da
   * Proposta Técnica) usa isso pra recarregar a própria lista, já que este
   * componente gerencia seu estado internamente. */
  onChange?: () => void;
}

/**
 * Fotos institucionais reutilizadas em todas as Propostas Técnicas (ver
 * components/PDFPreviewTecnica.tsx). Fica vazio até o usuário subir as primeiras fotos
 * reais da empresa — nenhuma imagem é inventada/baixada da internet.
 *
 * Vive na tela de Gerar Proposta (não mais em Configurar Preços — preço e
 * fotos são assuntos diferentes) porque é ali que as imagens são
 * efetivamente usadas/visualizadas na prévia, não faz sentido gerenciá-las
 * numa tela de configuração financeira. Não lê a pasta local
 * `3-FotosEvideos` diretamente: é uma pasta do disco do desenvolvedor, fora
 * de `public/` e fora do controle de versão — o app publicado na Vercel não
 * tem acesso a ela (serverless não enxerga o disco local de quem
 * desenvolveu). O Supabase Storage é o único jeito de fotos ficarem
 * disponíveis pro app já publicado, então o mecanismo de upload continua
 * sendo este, só que relocado. */
export default function GaleriaImagensProposta({ onChange }: Props) {
  const [imagens, setImagens] = useState<ImagemProposta[]>([]);
  const [enviando, setEnviando] = useState(false);
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

  async function enviarArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setEnviando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const caminho = `${Date.now()}-${arquivo.name}`;

      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
      if (erroUpload) {
        setErro(`Erro ao enviar imagem: ${erroUpload.message}`);
        return;
      }

      const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(caminho);

      const { error: erroInsert } = await supabase
        .from("imagens_proposta")
        .insert({ storage_path: caminho, url: publicUrl.publicUrl, legenda: null });
      if (erroInsert) {
        setErro(`Erro ao salvar imagem: ${erroInsert.message}`);
        return;
      }

      await carregar();
    } finally {
      setEnviando(false);
      event.target.value = "";
    }
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

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Imagens da proposta técnica</h2>
        <p className="text-sm text-gray-500">
          Fotos institucionais/de obras da BR Isolamentos, reutilizadas em toda Proposta
          Técnica gerada. Nenhuma foto genérica é usada — só o que você subir aqui.
        </p>
      </div>

      <div>
        <input type="file" accept="image/*" onChange={enviarArquivo} disabled={enviando} />
        {enviando && <p className="mt-1 text-sm text-gray-500">Enviando...</p>}
        {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
      </div>

      {imagens.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma imagem cadastrada ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {imagens.map((imagem) => (
            <div key={imagem.id} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem.url} alt={imagem.legenda ?? ""} className="h-32 w-full rounded-lg object-cover" />
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
  );
}
