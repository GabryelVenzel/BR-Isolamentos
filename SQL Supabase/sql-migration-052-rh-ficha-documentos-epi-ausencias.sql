-- ============================================================================
-- Migração 052 — RH: ficha completa, documentos com tipo e versões, EPI,
--                férias/afastamentos e pagamentos por funcionário
-- ============================================================================
-- O que muda:
--
--   1. Ficha do funcionário
--      - `funcionarios`: vínculo (CLT, PJ, sócio, diarista, outro), data de
--        desligamento e tamanhos de uniforme/EPI (camisa, calça, botina,
--        luva). Ficam aqui porque o Operacional também lê esta tabela.
--      - `funcionario_dados` (NOVA, uma linha por funcionário): o que é
--        sensível — RG, nascimento, endereço, contato de emergência, salário,
--        diária, PIS, CTPS, banco e PIX. Tabela à parte porque só quem tem o
--        módulo RH pode ler (o Operacional lê `funcionarios` para alocar em
--        obra e não deve ver salário nem conta bancária).
--
--   2. Documentos dos funcionários: `tipo_id` (tipo padrão — ASO, NR-35...)
--      e `data_emissao`. Com o tipo, a validade é calculada sozinha e, quando
--      um documento é renovado, o vencido do mesmo tipo deixa de contar como
--      pendência.
--
--   3. Documentos da empresa: `categoria`, `tipo_id` (item da lista de
--      obrigatórios) e versões — renovar um documento guarda a versão
--      anterior como histórico (`grupo_id` liga as versões; a anterior ganha
--      `arquivado_em`) em vez de duplicar a lista.
--
--   4. Listas configuráveis em RH → Configurações (`config_empresa`):
--      - `rh_tipos_documento`: tipos de documento de funcionário e a validade
--        padrão de cada um, em meses;
--      - `rh_documentos_obrigatorios`: documentos que a empresa precisa ter em
--        dia, com categoria e validade padrão.
--      As duas nascem com uma sugestão (ver abaixo) — CONFIRA OS PRAZOS.
--
--   5. `funcionario_epis` (NOVA): entregas de EPI (item, CA, quantidade, data
--      de entrega e de devolução) — base da ficha de EPI da NR-6.
--
--   6. `funcionario_ausencias` (NOVA): férias, atestados, afastamentos. Nesses
--      dias o funcionário não conta como disponível na capacidade e aparece
--      como ausente ao ser alocado numa obra.
--
--   7. `lancamentos_financeiros.funcionario_id`: liga um lançamento (salário,
--      pró-labore, adiantamento) a um funcionário, para a ficha mostrar o
--      histórico de pagamentos. Quem tem o módulo RH passa a ler os
--      lançamentos ligados a funcionário (só esses).
--
--   8. `documentos_vencidos_funcionarios()` (aviso ao alocar em obra) passa a
--      ignorar um documento vencido quando já existe outro mais novo do mesmo
--      tipo para o mesmo funcionário.
--
-- NADA é apagado. Funcionários, documentos e lançamentos existentes ficam
-- como estão (sem tipo, sem categoria, sem vínculo) até serem editados.
--
-- ORDEM: rodar ANTES de publicar o código deste bloco. É seguro rodar com a
-- versão atual do site no ar. Depende das migrações 039, 042 e 044.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ficha do funcionário
-- ----------------------------------------------------------------------------
alter table funcionarios add column if not exists vinculo varchar;
alter table funcionarios add column if not exists data_desligamento date;
alter table funcionarios add column if not exists tamanho_camisa varchar;
alter table funcionarios add column if not exists tamanho_calca varchar;
alter table funcionarios add column if not exists tamanho_botina varchar;
alter table funcionarios add column if not exists tamanho_luva varchar;

alter table funcionarios drop constraint if exists funcionarios_vinculo_check;
alter table funcionarios add constraint funcionarios_vinculo_check
  check (vinculo is null or vinculo in ('clt', 'pj', 'socio', 'diarista', 'outro'));

-- `id` próprio (além do vínculo único com o funcionário) porque a auditoria
-- registra cada alteração pelo `id` da linha.
create table if not exists funcionario_dados (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null unique references funcionarios (id) on delete cascade,
  rg varchar,
  data_nascimento date,
  cep varchar,
  endereco varchar,
  cidade varchar,
  estado varchar,
  contato_emergencia_nome varchar,
  contato_emergencia_telefone varchar,
  contato_emergencia_parentesco varchar,
  salario numeric(12, 2),
  valor_diaria numeric(12, 2),
  pis varchar,
  ctps varchar,
  banco varchar,
  agencia varchar,
  conta varchar,
  tipo_conta varchar,
  chave_pix varchar,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Documentos dos funcionários: tipo e emissão
-- ----------------------------------------------------------------------------
alter table funcionario_anexos add column if not exists tipo_id varchar;
alter table funcionario_anexos add column if not exists data_emissao date;

-- ----------------------------------------------------------------------------
-- 3. Documentos da empresa: categoria, tipo e versões
-- ----------------------------------------------------------------------------
alter table documentos_empresa add column if not exists categoria varchar;
alter table documentos_empresa add column if not exists tipo_id varchar;
alter table documentos_empresa add column if not exists grupo_id uuid not null default gen_random_uuid();
alter table documentos_empresa add column if not exists arquivado_em timestamptz;
create index if not exists idx_documentos_empresa_grupo on documentos_empresa (grupo_id);

-- ----------------------------------------------------------------------------
-- 4. Listas configuráveis do RH (sugestão inicial — confira os prazos)
-- ----------------------------------------------------------------------------
alter table config_empresa add column if not exists rh_tipos_documento jsonb;
alter table config_empresa add column if not exists rh_documentos_obrigatorios jsonb;

-- validade_meses: null = não vence.
update config_empresa
   set rh_tipos_documento = '[
     {"id": "aso",         "nome": "ASO (Atestado de Saúde Ocupacional)",       "validade_meses": 12},
     {"id": "nr35",        "nome": "NR-35 — Trabalho em altura",                "validade_meses": 24},
     {"id": "nr33",        "nome": "NR-33 — Espaço confinado",                  "validade_meses": 12},
     {"id": "nr10",        "nome": "NR-10 — Segurança em eletricidade",         "validade_meses": 24},
     {"id": "nr12",        "nome": "NR-12 — Máquinas e equipamentos",           "validade_meses": 24},
     {"id": "nr18",        "nome": "NR-18 — Construção (treinamento periódico)", "validade_meses": 24},
     {"id": "nr06",        "nome": "NR-06 — Uso de EPI (treinamento)",          "validade_meses": null},
     {"id": "integracao",  "nome": "Integração de segurança do cliente",        "validade_meses": 12},
     {"id": "ordem_servico","nome": "Ordem de serviço de segurança",            "validade_meses": null},
     {"id": "cnh",         "nome": "CNH",                                       "validade_meses": null}
   ]'::jsonb
 where rh_tipos_documento is null;

update config_empresa
   set rh_documentos_obrigatorios = '[
     {"id": "contrato_social", "nome": "Contrato Social (última alteração)",            "categoria": "juridico",   "validade_meses": null},
     {"id": "cartao_cnpj",     "nome": "Comprovante de Inscrição (Cartão CNPJ)",        "categoria": "juridico",   "validade_meses": null},
     {"id": "alvara",          "nome": "Alvará de funcionamento",                       "categoria": "juridico",   "validade_meses": 12},
     {"id": "cnd_federal",     "nome": "CND Federal (Receita/PGFN)",                    "categoria": "fiscal",     "validade_meses": 6},
     {"id": "cnd_estadual",    "nome": "CND Estadual",                                  "categoria": "fiscal",     "validade_meses": 6},
     {"id": "cnd_municipal",   "nome": "CND Municipal",                                 "categoria": "fiscal",     "validade_meses": 6},
     {"id": "crf_fgts",        "nome": "CRF — Regularidade do FGTS",                    "categoria": "fiscal",     "validade_meses": 1},
     {"id": "cndt",            "nome": "CNDT — Certidão de Débitos Trabalhistas",       "categoria": "fiscal",     "validade_meses": 6},
     {"id": "pgr",             "nome": "PGR — Programa de Gerenciamento de Riscos",     "categoria": "sst",        "validade_meses": 24},
     {"id": "pcmso",           "nome": "PCMSO",                                         "categoria": "sst",        "validade_meses": 12},
     {"id": "seguro_rc",       "nome": "Seguro de responsabilidade civil",              "categoria": "contratos",  "validade_meses": 12}
   ]'::jsonb
 where rh_documentos_obrigatorios is null;

-- ----------------------------------------------------------------------------
-- 5. Entregas de EPI
-- ----------------------------------------------------------------------------
create table if not exists funcionario_epis (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  item varchar not null,
  ca varchar,
  quantidade numeric(10, 2) not null default 1,
  data_entrega date not null,
  data_devolucao date,
  observacao text,
  registrado_por varchar,
  created_at timestamptz not null default now()
);
create index if not exists idx_funcionario_epis_funcionario on funcionario_epis (funcionario_id);

-- ----------------------------------------------------------------------------
-- 6. Férias e afastamentos
-- ----------------------------------------------------------------------------
create table if not exists funcionario_ausencias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipo varchar not null check (tipo in ('ferias', 'atestado', 'afastamento', 'folga', 'outro')),
  inicio date not null,
  fim date not null,
  observacao text,
  registrado_por varchar,
  created_at timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists idx_funcionario_ausencias_funcionario on funcionario_ausencias (funcionario_id);
create index if not exists idx_funcionario_ausencias_periodo on funcionario_ausencias (inicio, fim);

-- ----------------------------------------------------------------------------
-- 7. Lançamento ligado a funcionário
-- ----------------------------------------------------------------------------
alter table lancamentos_financeiros add column if not exists funcionario_id uuid references funcionarios (id) on delete set null;
create index if not exists idx_lancamentos_funcionario on lancamentos_financeiros (funcionario_id) where funcionario_id is not null;

-- Leitura: a regra da migração 044 + quem tem RH lê o que é ligado a funcionário.
drop policy if exists "acesso_lancamentos_leitura" on lancamentos_financeiros;
create policy "acesso_lancamentos_leitura" on lancamentos_financeiros
  for select to authenticated
  using (
    public.tem_modulo('financeiro', 'resumo')
    or ((servico_id is not null or fornecedor_id is not null) and public.tem_modulo('operacional'))
    or (lead_id is not null and public.tem_modulo('comercial'))
    or (funcionario_id is not null and public.tem_modulo('rh'))
  );

-- ----------------------------------------------------------------------------
-- Regras de acesso e auditoria das tabelas novas
-- ----------------------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  -- Dados sensíveis e EPI: só o módulo RH.
  foreach v_tabela in array array['funcionario_dados', 'funcionario_epis']
  loop
    execute format('alter table %I enable row level security', v_tabela);
    execute format('drop policy if exists %I on %I', 'acesso_rh_' || v_tabela, v_tabela);
    execute format(
      'create policy %I on %I for all to authenticated using (public.tem_modulo(''rh'')) with check (public.tem_modulo(''rh''))',
      'acesso_rh_' || v_tabela, v_tabela
    );
  end loop;

  -- Ausências: qualquer usuário ativo lê (a capacidade e a alocação de obras
  -- precisam saber quem está fora); só o RH grava.
  alter table funcionario_ausencias enable row level security;
  drop policy if exists "acesso_ausencias_leitura" on funcionario_ausencias;
  create policy "acesso_ausencias_leitura" on funcionario_ausencias
    for select to authenticated using (public.usuario_ativo());
  drop policy if exists "acesso_ausencias_gravacao" on funcionario_ausencias;
  create policy "acesso_ausencias_gravacao" on funcionario_ausencias
    for all to authenticated using (public.tem_modulo('rh')) with check (public.tem_modulo('rh'));

  foreach v_tabela in array array['funcionario_dados', 'funcionario_epis', 'funcionario_ausencias']
  loop
    execute format('drop trigger if exists trg_auditoria on %I', v_tabela);
    execute format(
      'create trigger trg_auditoria after insert or update or delete on %I for each row execute function public.registrar_auditoria()',
      v_tabela
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8. Documento vencido só conta se não houver outro mais novo do mesmo tipo
-- ----------------------------------------------------------------------------
create or replace function public.documentos_vencidos_funcionarios()
returns table (funcionario_id uuid, funcionario text, nome text, validade date)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.nome::text, a.nome::text, a.validade
    from funcionario_anexos a
    join funcionarios f on f.id = a.funcionario_id
   where public.usuario_ativo()
     and f.status = 'ativo'
     and a.validade is not null
     and a.validade < (now() at time zone 'America/Sao_Paulo')::date
     and not exists (
       select 1
         from funcionario_anexos b
        where b.funcionario_id = a.funcionario_id
          and a.tipo_id is not null
          and b.tipo_id = a.tipo_id
          and b.id <> a.id
          and (b.validade is null or b.validade > a.validade)
     );
$$;

revoke all on function public.documentos_vencidos_funcionarios() from public;
grant execute on function public.documentos_vencidos_funcionarios() to authenticated;

-- ============================================================================
-- VERIFICAÇÃO
--
-- 1) Tabelas novas (3 linhas):
--   select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('funcionario_dados', 'funcionario_epis', 'funcionario_ausencias')
--    order by 1;
--
-- 2) Listas do RH (10 tipos de documento e 11 obrigatórios na primeira vez):
--   select jsonb_array_length(rh_tipos_documento) as tipos,
--          jsonb_array_length(rh_documentos_obrigatorios) as obrigatorios
--     from config_empresa;
--
-- 3) Lançamentos: a regra de leitura inclui o RH:
--   select qual from pg_policies
--    where tablename = 'lancamentos_financeiros' and policyname = 'acesso_lancamentos_leitura';
-- ============================================================================
