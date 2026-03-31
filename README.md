# SalesBud Propostas

Gerador de propostas comerciais para o time de vendas SalesBud. Calcula pacotes, configura integracoes modulares, gera apresentacoes no Google Slides, exporta PDF e envia por email -- tudo automatizado.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript (vanilla) |
| Hospedagem | GitHub Pages |
| Autenticacao | Supabase Auth |
| Banco de dados | Supabase (PostgreSQL) |
| Configuracoes | Supabase (tabela configuracoes, 8 chaves) |
| Automacao | Make (webhook -> Google Drive -> Slides -> Gmail) |
| Template | Google Slides com variaveis dinamicas |

## Arquitetura

```
index.html + styles.css + app.js
         |
         v
    Supabase
    - Auth (usuarios)
    - perfis (dados do vendedor)
    - propostas (historico)
    - configuracoes (8 chaves de config compartilhada)
    - Trigger: on_auth_user_created
         |
         v
    Make (8 modulos)
    Webhook -> Copy -> Slides -> Delete -> Set URL -> PDF -> Gmail -> Response
```

## Funcionalidades

### Novos Clientes (componentes modulares)
- Calculo de pacote de horas (tabela V2, 50h-1000h, editavel pelo admin)
- Componentes de integracao: Personalizacao de Regras, Pipelines, Tarefas, Campos, VOIP
- WhatsApp com faixas editaveis pelo admin
- Adicionais opcionais configuraveis
- Tooltips informativos em cada componente
- Banner "Ver boas praticas" colapsavel
- Regra RD Station: campos personalizados isentos
- Breakdown detalhado com sub-itens de integracao MRR e setup

### Clientes de Base (modelo Upgrade)
- Consumo Atual: horas, usuarios, valor mensal, WhatsApp contratados
- Diagnostico de expansao (CRM, VOIP, WhatsApp) com score de adocao /5
- Campo "Horas mensais adicionais" -- total = atual + adicional
- Mesmos componentes modulares de Novos Clientes
- Comparativo Atual x Proposta com delta
- Breakdown detalhado compartilhado
- Tabela de precos exclusiva Base (editavel independentemente)

### Historico
- Filtros por tipo, vendedor, periodo
- Selecao em massa, export CSV
- Edicao de proposta (empresa, contato, obs_interna)
- Status: enviada, negociacao, aprovada, perdida (com motivo)

### Configuracoes (admin)
- Tabela de precos Novos Clientes
- Tabela de precos Base/CS (independente)
- Faixas de preco WhatsApp
- Lista de CRMs disponiveis (3 nativos protegidos)
- Lista de VOIPs inclusos
- Precos de componentes de integracao
- Adicionais opcionais (label, MRR, ativo/inativo)
- Importacao de tabela via .xlsx/.csv

### Gestao de usuarios
- Criacao via Supabase Dashboard (trigger auto-insert em perfis)
- Edicao de perfil pelo admin no app
- Ativar/desativar usuarios

## Setup local

```bash
git clone https://github.com/jgmorais-bit/salesbud-app.git
cd salesbud-app
# Abrir index.html no navegador -- nao precisa de build
```

## Deploy

Push para `main` -> GitHub Pages atualiza automaticamente.

## Documentacao

- `CONTEXT_v8.md` -- documento de contexto completo (referencia principal)
- `GUIA_USUARIO.md` -- guia de uso para AEs, CS e admins
- `GUIA_MIGRACAO.md` -- plano de migracao de contas pessoais para organizacionais
