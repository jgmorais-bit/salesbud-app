# SalesBud Propostas

Gerador de propostas comerciais para o time de vendas SalesBud. Calcula pacotes, gera apresentações no Google Slides, exporta PDF e envia por email — tudo automatizado.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript (vanilla) |
| Hospedagem | GitHub Pages |
| Autenticação | Supabase Auth |
| Banco de dados | Supabase (PostgreSQL) |
| Automação | Make (webhook → Google Drive → Slides → Gmail) |
| Template | Google Slides com variáveis dinâmicas |

## Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  index.html │     │  styles.css  │     │     app.js       │
│  (markup)   │────▶│  (estilos)   │     │  (3.176 linhas)  │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                  │
                    ┌─────────────────────────────▼──────────┐
                    │           Supabase                      │
                    │  ┌──────────┐ ┌────────┐ ┌───────────┐│
                    │  │ Auth     │ │perfis  │ │propostas  ││
                    │  │(12 users)│ │(perfil)│ │(histórico)││
                    │  └──────────┘ └────────┘ └───────────┘│
                    │  ┌──────────────┐                      │
                    │  │configuracoes │                      │
                    │  └──────────────┘                      │
                    └────────────────────────────────────────┘
                                                  │
                    ┌─────────────────────────────▼──────────┐
                    │           Make (8 módulos)              │
                    │  Webhook → Copy → Slides → Delete →    │
                    │  Set URL → PDF → Gmail → Response      │
                    └────────────────────────────────────────┘
```

## Funcionalidades

- **Novos Clientes**: cálculo de pacote, integração CRM, WhatsApp, desconto, proposta
- **Clientes de Base**: diagnóstico, comparativo atual vs proposta, upsell
- **Histórico**: filtros por tipo/vendedor/período, seleção em massa, export CSV
- **Automação**: gera Slides, exporta PDF, envia email com link editável
- **Lógica CRM**: nativo (HubSpot/Pipedrive/RD) = setup grátis; API aberta = R$1.200
- **Todos os planos**: envia os 3 slides de proposta num único arquivo

## Setup local

```bash
git clone https://github.com/jgmorais-bit/salesbud-app.git
cd salesbud-app
# Abrir index.html no navegador — não precisa de build
```

## Deploy

Push pra `main` → GitHub Pages atualiza automaticamente (~1 min).

```bash
git add .
git commit -m "descrição da mudança"
git push
```

## Estrutura de arquivos

```
├── index.html          # Markup HTML
├── styles.css          # Estilos CSS
├── app.js              # Lógica JavaScript (3.176 linhas, 33 seções)
├── CONTEXT_v6.md       # Documento de contexto do projeto
├── CODE_REVIEW.md      # Relatório de code review
└── README.md           # Este arquivo
```

## Configuração

### Supabase
URL e anon key estão como defaults no `app.js` (CONFIG_DEFAULT). Tabelas necessárias: `propostas`, `perfis`, `configuracoes`.

### Make
Webhook URL configurável pela aba Configurações (admin only). Token de autenticação opcional via header `X-SalesBud-Token`.

### Google Slides
Template com variáveis `{{variavel}}` substituídas automaticamente pelo Make. Slides 12/13/14 = propostas por plano, Slide 15 = capa.

## Usuários

Gerenciados via Supabase Auth + tabela `perfis`. Admin cria contas no dashboard do Supabase e gerencia perfis pelo app.

| Perfil | Acesso |
|---|---|
| Admin | Tudo: Propostas, Histórico, Usuários, Configurações |
| Vendedor | Propostas e Histórico apenas |

## Limites conhecidos

| Recurso | Limite | Ação |
|---|---|---|
| Make (free) | 1.000 ops/mês | Upgrade Core ~$9/mês |
| Supabase (free) | 500 MB banco, 500 MB bandwidth | Upgrade Pro $25/mês com 50+ users |
| GitHub Pages | 100 GB bandwidth/mês | Suficiente para 100+ users |
| Google Drive (pessoal) | 15 GB | Migrar pra Workspace quando cheio |
