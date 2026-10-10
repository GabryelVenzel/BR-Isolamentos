-- ============================================================================
-- Migração 040 — CEP nos cadastros de cliente, parceiro e fornecedor
-- ============================================================================
-- Os formulários passam a ter um campo CEP que preenche endereço, cidade e
-- estado automaticamente (consulta ao ViaCEP), e a busca por CNPJ também
-- devolve o CEP da empresa.
--
-- O que muda:
--   1. Coluna `cep` (texto, opcional) em `clientes`, `parceiros` e
--      `fornecedores`.
--   2. A view `v_clientes_resumo` (aba Comercial → Clientes) passa a trazer
--      `razao_social` e `cep`. Sem a razão social na view, editar um cliente
--      por essa aba abria o formulário com o campo vazio e, ao salvar, APAGAVA
--      a razão social que estava gravada.
--
-- NADA é apagado. As colunas novas nascem vazias.
--
-- ORDEM: rodar ANTES de publicar o código que usa o campo CEP (o cadastro
-- novo envia `cep` ao salvar; sem a coluna, salvar cliente, parceiro ou
-- fornecedor daria erro). É seguro rodar com a versão atual do site no ar.
--
-- Idempotente — pode rodar mais de uma vez.
-- ============================================================================

alter table clientes add column if not exists cep varchar;
alter table parceiros add column if not exists cep varchar;
alter table fornecedores add column if not exists cep varchar;

-- `create or replace view` só aceita colunas novas no FIM da lista — por isso
-- `razao_social` e `cep` vêm depois de `ultima_interacao`.
create or replace view v_clientes_resumo
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.telefone,
  c.email,
  c.endereco,
  c.cidade,
  c.estado,
  c.cnpj_cpf,
  c.criado_em,
  count(distinct l.id) as total_leads,
  greatest(max(l.updated_at), max(i.data_interacao)) as ultima_interacao,
  c.razao_social,
  c.cep
from clientes c
left join leads l on l.cliente_id = c.id
left join interacoes_lead i on i.lead_id = l.id
group by c.id;

-- ============================================================================
-- VERIFICAÇÃO
--
--   select id, nome, razao_social, cep from v_clientes_resumo limit 5;
--
-- (deve listar os clientes, com a razão social preenchida onde existir)
-- ============================================================================
