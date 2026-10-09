-- ============================================================================
-- BR Isolamentos — Migração 007: telefone em usuarios (roster de
-- responsáveis do CRM, gerenciado pela aba Configurações do módulo
-- Comercial)
--
-- Contexto: "usuarios" já era usada como roster de responsáveis (dropdown
-- "Responsável" do Kanban, via /api/usuarios) — não é uma tabela de
-- credenciais em si (login é 100% via Supabase Auth, `usuarios` é só o
-- perfil complementar). Adicionar/editar uma linha aqui NÃO cria acesso de
-- login — só cadastra alguém como responsável possível por um lead. Por
-- isso não foi criada uma tabela nova (`responsaveis_comercial` ou
-- similar): seria duplicar exatamente o que `usuarios` já faz, e quebraria a
-- referência existente de `leads.atribuido_a`/`orcamentos.atribuido_a`
-- (ambos `references usuarios (email)`).
--
-- Único campo que faltava pro formulário de cadastro pedido (nome, email,
-- telefone): telefone.
-- ============================================================================

alter table usuarios add column if not exists telefone varchar;

-- ============================================================================
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================================
