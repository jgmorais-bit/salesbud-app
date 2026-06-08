# Contexto do projeto · salesbud-app (gerador de propostas)

SPA interno de geração de propostas comerciais da SalesBud. Dois fluxos: **Novos Clientes** (modular) e **Clientes de Base** (upsell por consumo). Calcula pacotes, gera Google Slides, exporta PDF e envia por e-mail (Make + Drive + Slides + Gmail). Vanilla HTML/CSS/JS; backend Supabase (`perfis`, `propostas`, `configuracoes` + Auth + RLS por dono). Engajamento SalesBud sob JGM.

**Repo PÚBLICO** (GitHub Pages). Nunca commitar segredo — `.env*` já ignorado; IDs de Make/webhook/Drive **devem** ficar redigidos no `CONTEXT_v8.md` (auditar a seção `### Make` antes de cada push — endpoint vivo não pode ir pro público).

## Ao iniciar qualquer sessão

1. Lê `CONTEXT_v8.md` — SoT canônica (516 linhas): status de produção, todos os IDs de infra, schema, regras de payload, as 20 decisões técnicas. **Começa aqui antes de qualquer mudança.**
2. Lê `GUIA_USUARIO.md` (fluxos do usuário) e `GUIA_MIGRACAO.md` (migração p/ conta organizacional) quando relevantes.

## Rodar / build / deploy

Sem toolchain. Abre `index.html` no navegador ou serve em `http://localhost:8000`. **Deploy = push na `main`** (GitHub Pages atualiza sozinho → `https://jgmorais-bit.github.io/salesbud-app/`). **Sem testes automatizados** (deferidos no CONTEXT — não existem `.test.js`).

---

## Arquitetura

`index.html` (3 telas: setup/login/app) + `styles.css` (design system: `--navy`/`--pink`/…) + 9 módulos em `js/` carregados **nesta ordem** (crítico — dependências por ordem de carga):
`config.js` (init Supabase, globals, syncs) → `pricing.js` → `ui.js` → `auth.js` → `novos.js` → `base.js` → `historico.js` → `admin.js` → `main.js` (router/webhooks).
Backend Supabase: 3 tabelas + Auth + **RLS por dono** (vendedor vê só as suas via `auth.uid()=owner_uid`; admin vê tudo).

## Invariantes que NÃO se quebram (peça client-facing)

- **Formatação de payload:** `fee_manutencao`/`mrr_integracao` = string **vazia** `""` quando zero (nunca `"—"` nem `"Não incluso"`); `setup_total` = `"Gratuito"` se zero; campos `*_detalhamento` listam componentes **sem** `R$`. `fmt(valor)` → `"R$ X.XXX"` ou `""`.
- **Duas tabelas de preço independentes:** `tabela_precos` (Novos) e `tabela_precos_base` (Base). `calcPrecoExato(horas, modulo)`: `'base'` lê a tabela Base, senão Novos. Não unificar.
- Mínimo **50 horas**; RD Station = campos **isentos** de custo; WhatsApp default **1 usuário**.
- **Make:** URL e token são campos separados e **ambos obrigatórios** — sem um, a proposta falha em silêncio.
- **Reenviar (no Histórico):** fire-and-forget, sem feedback de erro — se URL/token forem inválidos a UI mostra sucesso mas o Make rejeita em silêncio. Validar credenciais no Admin antes de contar com reenvio.

## Convenções

`camelCase` (JS) / `kebab-case` (IDs HTML). Estado em dois objetos: `state` (Novos) e `stateBase` (Base). Sync: Admin salva → Supabase + cache `localStorage`; leitura Supabase → fallback `localStorage` → defaults hardcoded. Desktop-only, sem emoji, pt-BR. Validade +15 dias.

**Governança de mudança (do CONTEXT):** fix vai direto na `main`; sprint/feature via branch + PR.

## Fronteira / terminologia

Preço, escopo e regras comerciais: a **verdade mora aqui** (app + Supabase) — o salesbud-kb aponta pra cá, não copia. Deal/PII (cliente, CNPJ) → CRM, nunca hardcoded no repo público. Termos de governança de KB (capilarizado, lente) são do `salesbud-kb` — aqui é código.

---

## Autonomia neste projeto

**Age direto (sem confirmar):**
- Ler qualquer arquivo
- Editar código/estilo; `git add`/`commit` local; rodar localmente

**Sempre confirma antes:**
- `git push` (gate do João — e **push = deploy em produção** via GitHub Pages; trate como modo-entrega)
- Deletar arquivos
- Commitar qualquer segredo (IDs de Make/webhook/Drive, Supabase service key)
- Operações fora do repo

## Estrutura rápida

~/salesbud-propostas/
├── CONTEXT_v8.md           ← SoT (ler primeiro)
├── index.html · styles.css
├── js/ (config, pricing, ui, auth, novos, base, historico, admin, main)
├── GUIA_USUARIO.md · GUIA_MIGRACAO.md · README.md
└── app.js                  ← stub deprecado (removível)
