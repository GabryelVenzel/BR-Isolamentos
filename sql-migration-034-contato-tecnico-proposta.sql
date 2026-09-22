-- ============================================================================
-- BR Isolamentos — Migração 034: Contato do responsável técnico na Proposta
-- Técnica.
--
-- Pré-requisito: sql-migration-033-modulo-rh.sql já aplicado.
-- 100% aditiva e idempotente.
--
-- Pedido explícito: um bloco estrategicamente posicionado na Proposta
-- Técnica com WhatsApp/telefone, e-mail e CNPJ de um contato comercial
-- nomeado. `config_empresa.cnpj` já existia no schema (sem uso em nenhuma
-- tela/template) — passa a ser exibido nesse bloco. Nome/cargo/WhatsApp/
-- e-mail do responsável técnico são campos novos, DISTINTOS de
-- telefone_empresa/email_empresa (linha genérica "Contato: X · Y" do
-- rodapé, que continua existindo em paralelo) — aqui é o contato pessoal de
-- quem responde tecnicamente pela proposta, não a linha geral da empresa.
-- ============================================================================

alter table config_empresa add column if not exists responsavel_tecnico_nome varchar;
alter table config_empresa add column if not exists responsavel_tecnico_cargo varchar;
alter table config_empresa add column if not exists responsavel_tecnico_whatsapp varchar;
alter table config_empresa add column if not exists responsavel_tecnico_email varchar;

-- Preenche com os dados informados pelo usuário. Ajustável depois em
-- Configurar Preços → "Contato técnico (Proposta Técnica)".
update config_empresa
set
  cnpj = coalesce(cnpj, '64.343.539/0001-26'),
  responsavel_tecnico_nome = coalesce(responsavel_tecnico_nome, 'Fabiano Garcia'),
  responsavel_tecnico_cargo = coalesce(responsavel_tecnico_cargo, 'Responsável Técnico'),
  responsavel_tecnico_whatsapp = coalesce(responsavel_tecnico_whatsapp, '+55 11 92113-2612'),
  responsavel_tecnico_email = coalesce(responsavel_tecnico_email, 'fabiano.garcia@br-isolamentos.com.br');

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================================
