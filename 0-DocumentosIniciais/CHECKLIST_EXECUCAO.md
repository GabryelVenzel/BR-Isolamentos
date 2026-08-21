# ✅ CHECKLIST DE EXECUÇÃO
## Do Zero até Vercel em 1 dia

---

## 📋 FASE 1: SETUP INICIAL (30 MINUTOS)

### [ ] PASSO 1: GitHub
```
1. Vá para https://github.com/new
2. Crie repositório:
   - Nome: isolamento-termico-web
   - DEIXE vazio (sem README, .gitignore, license)
   - Click "Create repository"
3. Copie a URL (exemplo: https://github.com/seu-user/isolamento-termico-web.git)
4. Salve em algum lugar (vai usar no terminal)
```

### [ ] PASSO 2: Configurar Git Localmente
```bash
# Terminal/PowerShell

# Se nunca fez antes:
git config --global user.email "seu@email.com"
git config --global user.name "Seu Nome"

# Verificar:
git config --global user.email
git config --global user.name

# Resultado: deve mostrar seu email e nome
```

### [ ] PASSO 3: GitHub Token
```
1. Vá para: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Configure:
   - Expires: "No expiration" (ou 1 ano)
   - Scopes: 
     ✅ repo (full control)
     ✅ workflow
4. Click "Generate token"
5. COPIE o token (aparece uma única vez!)
6. Guarde em local seguro (vai usar 1 vez)
```

### [ ] PASSO 4: Supabase
```
1. Vá para https://supabase.com
2. Click "Start for free"
3. Use GitHub para login (mais fácil)
4. Crie novo projeto:
   - Nome: isolamento-termico
   - Região: São Paulo (closest)
   - Password: algo forte
5. Aguarde ~1 minuto
6. Quando abrir o Dashboard, copie:
   - Project URL
   - Anon Key (próximo de "API Keys")
7. Salve em arquivo .env.local (claude vai gerar template)
```

### [ ] PASSO 5: Vercel
```
1. Vá para https://vercel.com
2. Click "Sign in with GitHub"
3. Autorize
4. Pronto! (não precisa fazer nada agora)
```

---

## 💻 FASE 2: GERAR CÓDIGO (2 HORAS)

### [ ] PASSO 6: Abrir Claude Code
```
1. Abra Claude Code Desktop
2. File → Open Folder
3. Navegue para sua pasta de trabalho
4. Click "Select folder"
5. Aguarde carregar
```

### [ ] PASSO 7: Copiar/Colar Prompt
```
1. Abra o arquivo: PROMPT_CLAUDE_CODE_INICIAL.md
2. Copie TUDO entre as 3 linhas de backticks (```)
   (não copie as linhas de backticks, só o conteúdo)
3. Cole no Claude Code Desktop
4. Clique "Send"
5. Aguarde Claude trabalhar (5-10 minutos)
```

### [ ] PASSO 8: Confirmar Estrutura
Verifique se criou:
```
✅ app/ (páginas Next.js)
✅ lib/ (funções utilitárias)
✅ components/ (componentes React)
✅ public/ (imagens/assets)
✅ package.json
✅ tsconfig.json
✅ next.config.js
✅ tailwind.config.js
✅ .env.local (ou .env.example)
✅ .gitignore
✅ sql-schema.sql (arquivo com DDL)
```

---

## 🗄️ FASE 3: SUPABASE (5 MINUTOS)

### [ ] PASSO 9: Executar SQL no Supabase
```
1. Vá para: https://supabase.com/dashboard
2. Selecione projeto "isolamento-termico"
3. No sidebar: SQL Editor
4. Click "New query"
5. Copie conteúdo do arquivo sql-schema.sql que Claude gerou
6. Cole no editor
7. Click "RUN" (ou Ctrl+Enter)
8. Aguarde executar (deve mostrar "Success")
```

### [ ] PASSO 10: Copiar Credenciais
```
1. Dashboard → Settings → API
2. Copie:
   - Project URL
   - Anon Key
3. Na pasta do projeto, abra .env.local
4. Preencha:
   NEXT_PUBLIC_SUPABASE_URL=cole-a-url-aqui
   NEXT_PUBLIC_SUPABASE_ANON_KEY=cole-a-chave-aqui
5. Salve arquivo
```

---

## 🚀 FASE 4: TESTAR LOCALMENTE (15 MINUTOS)

### [ ] PASSO 11: Instalar Dependências
```bash
# Terminal na pasta do projeto

npm install

# Aguarde (pode levar 2-3 minutos)
# Vai mostrar "added XXX packages"
```

### [ ] PASSO 12: Rodar Localmente
```bash
npm run dev

# Resultado:
# ✓ Ready in 1234ms
# ▲ Next.js 14.0.0
# - Local: http://localhost:3000
```

### [ ] PASSO 13: Testar no Navegador
```
1. Abra: http://localhost:3000
2. Você deve ver:
   - Logo/Título da empresa
   - Botões para "Novo Orçamento"
   - Link de Login
3. Se funcionar: ✅ Tudo ok!
```

---

## 📤 FASE 5: PUSH GITHUB (5 MINUTOS)

### [ ] PASSO 14: Git Commit & Push
```bash
# Terminal na pasta do projeto

# Adicionar tudo
git add .

# Commit
git commit -m "Initial project setup - Next.js + Supabase"

# Verificar remote
git remote -v
# Se não mostrar nada (erro), adicione:
git remote add origin https://github.com/seu-user/isolamento-termico-web.git

# Push para GitHub
git push origin main

# Se pedir credentials, use:
# Username: seu-usuario-github
# Password: cole-o-token-aqui (não a senha!)

# Resultado: deve mostrar
# To https://github.com/seu-user/isolamento-termico-web.git
# [new branch]      main -> main
```

---

## 🌐 FASE 6: DEPLOY VERCEL (10 MINUTOS)

### [ ] PASSO 15: Conectar Vercel
```
1. Vá para: https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Selecione: isolamento-termico-web
5. Click "Import"
```

### [ ] PASSO 16: Configurar Variáveis
```
1. Você vai para "Environment Variables"
2. Adicione duas variáveis:
   
   Nome: NEXT_PUBLIC_SUPABASE_URL
   Valor: cole-a-url-do-supabase
   
   Nome: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Valor: cole-a-chave-do-supabase

3. Click "Deploy"
4. Aguarde ~1 minuto (vai mostrar "Building")
5. Quando terminar, vai dar URL da app:
   https://seu-projeto-xxx.vercel.app
```

### [ ] PASSO 17: Testar no Ar
```
1. Clique na URL que Vercel gerou
2. Sua app deve carregar idêntica ao localhost
3. Teste funcionalidades principais:
   - Página inicial
   - Login
   - Novo orçamento
```

---

## 🎯 CHECKLIST FINAL

### Tudo Pronto Se:
- [ ] App local funciona em http://localhost:3000
- [ ] Código está no GitHub (vercel vê)
- [ ] Supabase tem tabelas criadas
- [ ] App está online em vercel.app
- [ ] Todos os 3 sócios conseguem acessar (compartilha URL)

### Próximas Melhorias (depois):
- [ ] Adicionar autenticação (login dos sócios)
- [ ] Testar cálculos térmicos com dados reais
- [ ] Ajustar preços na config_empresa
- [ ] Gerar primeira proposta em PDF
- [ ] Compartilhar com clientes

---

## 🆘 TROUBLESHOOTING

### Erro: "git push rejected"
```
Solução:
git pull origin main
git push origin main
```

### Erro: "NEXT_PUBLIC_SUPABASE_URL is not set"
```
Solução:
1. Verifique .env.local
2. Variáveis devem ter "NEXT_PUBLIC_" na frente
3. Reinicie: npm run dev
```

### Erro: "Table does not exist"
```
Solução:
1. Abra SQL Editor no Supabase
2. Cole sql-schema.sql novamente
3. Click RUN
4. Reinicie app local
```

### Vercel não vê mudanças após push
```
Solução:
Vercel auto-deploy pode levar 30-60 segundos
Aguarde e refresh a página
```

---

## 📞 SUPORTE

Se algo não funcionar:
1. Copie o erro exato
2. Volte ao Claude Code
3. Faça novo prompt descrevendo o erro
4. Claude vai debugar e corrigir

---

**🎉 PARABÉNS! Sua app está no ar!**

Próximo passo: compartilhe URL com seus 3 sócios
e comece a usar para gerar orçamentos reais.
