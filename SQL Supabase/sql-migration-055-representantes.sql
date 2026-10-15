-- ============================================================================
-- Migração 055 — Representantes comerciais
-- ============================================================================
-- O que muda:
--
--   1. Parceiros ganham a categoria "representante": pessoas/empresas que
--      representam a BR Isolamentos comercialmente e recebem comissão sobre
--      as vendas. Ficam no Comercial (subaba Representantes), ao lado de
--      Parcerias (que também saiu do Operacional para o Comercial).
--      `percentual_comissao_padrao`: o % que o representante costuma receber
--      — vem preenchido ao criar um lead dele (pode ser mudado no lead).
--
--   2. Leads de representante: `representante_id` e
--      `percentual_representante`. É um lead normal (venda nossa, com
--      orçamento); o valor do cartão é a nossa proposta e o sistema mostra o
--      líquido (valor − comissão do representante). Não confundir com lead de
--      parceria (`eh_comissao`), que é indicação que NÓS fazemos e pela qual
--      recebemos comissão.
--
-- NADA é apagado. Leads e parceiros existentes ficam como estão.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar. Depende das migrações 026, 027 e 053.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- 1. Representante como categoria de parceiro
alter table parceiros drop constraint if exists parceiros_categoria_parceiro_check;
alter table parceiros add constraint parceiros_categoria_parceiro_check
  check (categoria_parceiro in ('prestador', 'parceria', 'representante'));

alter table parceiros add column if not exists percentual_comissao_padrao numeric(5, 2)
  check (percentual_comissao_padrao is null or (percentual_comissao_padrao >= 0 and percentual_comissao_padrao <= 100));

-- 2. Lead de representante
alter table leads add column if not exists representante_id uuid;
alter table leads drop constraint if exists leads_representante_id_fkey;
alter table leads add constraint leads_representante_id_fkey
  foreign key (representante_id) references parceiros (id);

alter table leads add column if not exists percentual_representante numeric(5, 2);
alter table leads drop constraint if exists leads_percentual_representante_check;
alter table leads add constraint leads_percentual_representante_check
  check (percentual_representante is null or (percentual_representante >= 0 and percentual_representante <= 100));

-- Um lead é de parceria OU de representante, nunca os dois.
alter table leads drop constraint if exists leads_parceria_ou_representante;
alter table leads add constraint leads_parceria_ou_representante
  check (not (eh_comissao and representante_id is not null));

create index if not exists idx_leads_representante_id on leads (representante_id);

-- ============================================================================
-- VERIFICAÇÃO
--
--   select categoria_parceiro, count(*) from parceiros group by 1;
--   select count(*) from leads where representante_id is not null;   -- 0
--   select conname from pg_constraint where conrelid = 'leads'::regclass
--    and conname like 'leads_%parceiro%';   -- leads_parceiro_id_fkey deve existir
-- ============================================================================
