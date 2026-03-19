# SalesBud Propostas — Context Document v6 (FINAL)
> Última atualização: 18/03/2026 22h · App em produção, pronto para o time

## Projeto

Gerador de propostas comerciais interno para o time de vendas SalesBud. Single-file separado em HTML/CSS/JS, deploy via GitHub Pages.

- **App em produção**: https://jgmorais-bit.github.io/salesbud-app
- **Repositório**: https://github.com/jgmorais-bit/salesbud-app (público)
- **Pasta local**: ~/salesbud-propostas/
- **Branch**: main
- **Arquivos**: index.html + styles.css + app.js

---

## Status: PRODUÇÃO ✅

### Funcionalidades completas
- Login centralizado via Supabase Auth (email/senha)
- Esqueci minha senha (Supabase envia email de recuperação)
- Alterar senha pelo perfil (modal no dropdown do avatar)
- 12 usuários criados (2 admins + 10 vendedores)
- Aba Novos Clientes — cálculo, breakdown, WhatsApp, desconto, payload
- Aba Clientes de Base — diagnóstico, comparativo, upsell
- Histórico compartilhado via Supabase com filtros, KPIs, export CSV, seleção em massa
- Configurações centralizadas no Supabase (webhook, template, preços, CRMs)
- CRM obrigatório + lista customizável por admin
- Lógica CRM nativo vs API aberta (Básico: R$0 nativo / R$1.200 não-nativo)
- Toggle "Plano específico / Todos os planos"
- Timeout 60s com feedback progressivo
- Fallback localStorage quando Supabase offline
- Controle de acesso: vendedor vs admin

### Make — automação 100% operacional (8 módulos + Resume)
```
Webhooks (1) → Drive Copy (3) → Slides Template (4) →
Slides API Call/Delete (14) → [Resume] → Tools Set Variable (20) →
Drive Download/PDF (11) → Gmail Send (16) → Webhooks Response (7)
```

### Segurança
- Supabase Auth com bcrypt (substituiu SHA-256/localStorage)
- RLS policies por perfil (admin/vendedor)
- XSS: esc() escapa &, <, >, ", '
- Webhook token auth (X-SalesBud-Token)
- Dados de funcionários removidos do código-fonte
- Status proposta: rascunho → enviada (rastreável)

### Código refatorado
- Separado em 3 arquivos: index.html + styles.css + app.js
- app.js formatado com Prettier (3.176 linhas, 33 seções organizadas)
- Code review completo documentado em CODE_REVIEW.md

---

## Infraestrutura

### GitHub Pages
```
Conta: jgmorais-bit
Repo: salesbud-app
URL: https://jgmorais-bit.github.io/salesbud-app
```

### Make
```
URL cenário: https://us2.make.com/2013800/scenarios/4420296/edit
Webhook URL: https://hook.us2.make.com/zlre1nfzl93qufepv8vns9g5dgesclqc
Scheduling: Immediately as data arrives
Plano: Free (upgrade pra Core ~$9/mês quando liberar pro time)
```

### Supabase
```
Projeto: salesbud-propostas
URL: https://nrmfjyjxppbbdpsfhcft.supabase.co
Tabelas: propostas, perfis, configuracoes
Auth: 12 usuários configurados
RLS: authenticated + admin policies
Site URL: https://jgmorais-bit.github.io/salesbud-app/
```

### Google Cloud
```
Projeto: salesbud-propostas
OAuth Client: Make - Salesbud
APIs: Drive, Slides, Gmail
Credenciais: ver Google Cloud Console
```

### Google Drive
```
Template Slides ID: 1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA
Pasta Propostas: 1AZCtwIErvLvMZgHwie3xU9XtoFk0HrwC
Permissão: Qualquer pessoa com o link = Editor
```

---

## Pra liberar pro time

1. Mandar o link: `https://jgmorais-bit.github.io/salesbud-app`
2. Credenciais: email corporativo + senha `mudar123`
3. Pedir pra trocarem a senha (Alterar senha no perfil ou Esqueci minha senha)
4. Fazer upgrade do Make pra plano Core (~$9/mês)

---

## Backlog (nice to have)

- Refactor Etapa 3: eliminar duplicação (funções genéricas Novos Clientes / Base)
- Pinar URL do app nos deals do HubSpot
- Migrar contas Google pessoais → SalesBud organizacional
- Paginação no histórico (quando > 500 propostas)
- Cache client-side pra configurações
- Monitoramento de limites Supabase/Make
- Subpastas por mês no Google Drive
