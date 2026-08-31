-- ============================================================================
-- BR Isolamentos — diagnóstico: quais migrações (002 a 031) já foram
-- aplicadas no seu banco Supabase.
--
-- Não é uma migração — não cria/altera nada, só CONSULTA o schema atual e
-- devolve uma linha só, com uma coluna booleana por migração (true = já
-- aplicada, false = falta aplicar). Cole no SQL Editor e rode.
--
-- Motivo de existir: os dois erros mais recentes ("Erro interno do
-- servidor" ao criar Custo Fixo e ao criar Categoria) batem exatamente com
-- o que a migração 009 introduz (tabela categorias_lancamentos e colunas
-- custos_fixos.dia_mes/notas) — sinal de que ela pode não ter sido aplicada
-- ainda, mesmo com migrações mais novas (ex.: 024) já rodadas. Como as
-- migrações desta sessão já passam de 20 arquivos, um checklist único evita
-- ter que adivinhar qual falta a cada novo erro.
-- ============================================================================

select
  to_regclass('public.impostos_config') is not null as m002_impostos_config,
  to_regclass('public.leads') is not null as m004_leads,
  exists(select 1 from information_schema.columns where table_name = 'clientes' and column_name = 'cidade') as m005_clientes_cidade,
  to_regclass('public.config_prazo_etapas') is not null as m006_config_prazo_etapas,
  exists(select 1 from information_schema.columns where table_name = 'usuarios' and column_name = 'telefone') as m007_usuarios_telefone,
  to_regclass('public.servicos') is not null as m008_servicos,
  to_regclass('public.categorias_lancamentos') is not null as m009_categorias_lancamentos,
  exists(select 1 from information_schema.columns where table_name = 'custos_fixos' and column_name = 'dia_mes') as m009_custos_fixos_dia_mes,
  exists(select 1 from information_schema.columns where table_name = 'precos_config' and column_name = 'especificacao') as m010_precos_config_especificacao,
  exists(select 1 from information_schema.columns where table_name = 'servicos' and column_name = 'tipos_trabalho') as m011_servicos_tipos_trabalho,
  to_regclass('public.anexos_lead') is not null as m012_anexos_lead,
  to_regclass('public.servico_parceiros_execucao') is not null as m013_servico_parceiros_execucao,
  not exists(select 1 from information_schema.columns where table_name = 'parceiros' and column_name = 'especialidade') as m014_parceiro_sem_especialidade,
  exists(select 1 from information_schema.columns where table_name = 'fornecedores' and column_name = 'tipos_fornecimento') as m015_fornecedores_tipos_fornecimento,
  exists(
    select 1 from pg_constraint
    where conname = 'precos_config_tipo_material_check' and pg_get_constraintdef(oid) like '%acessorio_arame%'
  ) as m016_catalogo_precos_revisado,
  exists(select 1 from information_schema.columns where table_name = 'precos_config' and column_name = 'ordem') as m017_precos_config_ordem,
  exists(select 1 from pg_proc where proname = 'set_ultima_atualizacao') as m018_fix_trigger_precos_config,
  exists(select 1 from information_schema.columns where table_name = 'config_empresa' and column_name = 'isolante_acrescimo_percentual') as m019_motor_quantificacao,
  exists(select 1 from information_schema.columns where table_name = 'itens_orcamento' and column_name = 'detalhamento_materiais') as m020_detalhamento_propostas,
  exists(select 1 from information_schema.columns where table_name = 'orcamentos' and column_name = 'observacoes_adicionais') as m021_observacoes_adicionais,
  exists(select 1 from information_schema.columns where table_name = 'imagens_proposta' and column_name = 'tipo_trabalho') as m022_imagens_proposta_tipo,
  -- 023 só muda o VALOR PADRÃO de 2 colunas (não dá pra checar de forma
  -- 100% confiável via schema — se a config já tiver sido personalizada, o
  -- valor abaixo não bateria mesmo com a migração aplicada). Informativo:
  (select isolante_acrescimo_percentual from config_empresa limit 1) as m023_isolante_acrescimo_atual_valor_informativo,
  (
    select data_type = 'timestamp with time zone'
    from information_schema.columns
    where table_name = 'leads' and column_name = 'created_at'
  ) as m024_leads_created_at_com_fuso,
  exists(select 1 from information_schema.columns where table_name = 'precos_config' and column_name = 'familia') as m025_precos_config_familia,
  exists(select 1 from information_schema.columns where table_name = 'leads' and column_name = 'eh_comissao') as m026_leads_comissao,
  exists(select 1 from information_schema.columns where table_name = 'parceiros' and column_name = 'categoria_parceiro') as m027_categoria_parceiro,
  exists(select 1 from precos_config where tipo_material = 'acessorio_rebite' and descricao = 'Rebite de Alumínio') as m028_renomeia_itens_catalogo,
  exists(select 1 from information_schema.columns where table_name = 'config_empresa' and column_name = 'arame_metros_por_m2') as m029_arame_por_metro,
  exists(select 1 from information_schema.columns where table_name = 'parceiros' and column_name = 'notas_isolador') as m030_notas_tipos_trabalho,
  exists(select 1 from information_schema.columns where table_name = 'clientes' and column_name = 'razao_social') as m031_razao_social,
  -- Bug relatado: "não consigo anexar arquivo no lead" — m012_anexos_lead (acima)
  -- só confere a TABELA; o upload em si depende do bucket do Storage e das
  -- políticas de insert/delete, que são criados na MESMA migração 012 mas em
  -- comandos separados — confira aqui se algum ficou faltando.
  exists(select 1 from storage.buckets where id = 'leads-anexos') as m012_bucket_leads_anexos,
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'authenticated_insert_leads_anexos') as m012_policy_insert_leads_anexos;

-- ============================================================================
-- Leia o resultado da esquerda pra direita: qualquer coluna "false" indica
-- uma migração que ainda falta rodar (exceto m023, que é só informativo —
-- veja o comentário acima). Rode os arquivos sql-migration-0XX-*.sql
-- correspondentes, NA ORDEM NUMÉRICA, pra cada "false" encontrado.
-- ============================================================================
