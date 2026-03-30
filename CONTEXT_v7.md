# SalesBud Propostas — Context Document v7
> Ultima atualizacao: 29/03/2026 · App em producao com componentes modulares

## Projeto

Gerador de propostas comerciais interno para o time de vendas SalesBud. Frontend em HTML/CSS/JS (3 arquivos), deploy via GitHub Pages. Configuracoes centralizadas no Supabase.

- **App em producao**: https://jgmorais-bit.github.io/salesbud-app
- **Repositorio**: https://github.com/jgmorais-bit/salesbud-app (publico)
- **Pasta local**: ~/salesbud-propostas/
- **Branch**: main
- **Arquivos**: index.html + styles.css + app.js
- **Desktop only** — nao ha versao mobile

---

## Status: PRODUCAO

### Funcionalidades completas
- Login centralizado via Supabase Auth (email/senha)
- Esqueci minha senha (Supabase envia email de recuperacao)
- Alterar senha pelo perfil (modal no dropdown do avatar)
- Usuarios criados via Supabase Dashboard (trigger auto-insert em perfis)
- Aba Novos Clientes — componentes modulares de integracao, WhatsApp, adicionais, payload
- Aba Clientes de Base — diagnostico, comparativo, upsell (sistema antigo de tiers)
- Historico compartilhado via Supabase com filtros, KPIs, export CSV, selecao em massa, edicao (obs_interna)
- Configuracoes centralizadas no Supabase: tabela de precos, faixas WhatsApp, CRMs, VOIPs, precos de integracao, adicionais
- CRM obrigatorio + lista customizavel por admin
- Tooltips informativos em cada componente de integracao
- Banner de boas praticas colapsavel
- Regra RD Station: campos personalizados isentos
- Timeout 60s com feedback progressivo
- Fallback localStorage quando Supabase offline
- Controle de acesso: vendedor vs admin

### Make — automacao 100% operacional (8 modulos + Resume)
```
Webhooks (1) -> Drive Copy (3) -> Slides Template (4) ->
Slides API Call/Delete (14) -> [Resume] -> Tools Set Variable (20) ->
Drive Download/PDF (11) -> Gmail Send (16) -> Webhooks Response (7)
```

### Seguranca
- Supabase Auth com bcrypt
- RLS policies por perfil (admin/vendedor)
- XSS: esc() escapa &, <, >, ", '
- Webhook token auth (X-SalesBud-Token)
- Dados de funcionarios removidos do codigo-fonte

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
URL cenario: https://us2.make.com/2013800/scenarios/4420296/edit
Webhook URL: https://hook.us2.make.com/zlre1nfzl93qufepv8vns9g5dgesclqc
Scheduling: Immediately as data arrives
Plano: Free (upgrade pra Core ~$9/mes quando liberar pro time)
```

### Supabase
```
Projeto: salesbud-propostas
URL: https://nrmfjyjxppbbdpsfhcft.supabase.co
Tabelas: propostas, perfis, configuracoes
Auth: usuarios via Dashboard + trigger on_auth_user_created
RLS: authenticated + admin policies
Site URL: https://jgmorais-bit.github.io/salesbud-app/
```

### Google Cloud
```
Projeto: salesbud-propostas
OAuth Client: Make - Salesbud
APIs: Drive, Slides, Gmail
```

### Google Drive
```
Template Slides ID: 1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA
Pasta Propostas: 1AZCtwIErvLvMZgHwie3xU9XtoFk0HrwC
Permissao: Qualquer pessoa com o link = Editor
```

---

## Arquitetura de Dados

### Padrao de sync (configuracoes compartilhadas)
Todas as configuracoes que devem ser iguais para todos os usuarios seguem:
1. **Gravacao**: Admin salva -> Supabase (tabela `configuracoes`) + cache localStorage
2. **Leitura**: Supabase -> cache localStorage -> default hardcoded no codigo
3. **Inicializacao**: `syncXxxFromSupabase()` chamado em `iniciarApp()`

### Chaves na tabela `configuracoes`
| Chave | Conteudo | Tipo |
|---|---|---|
| `app_config` | webhook URL, token, template URL/versao | objeto |
| `tabela_precos` | Array de {horas, preco} — 21 faixas, 50h-1000h | array |
| `crm_list` | Lista de CRMs disponiveis | array de strings |
| `whatsapp_faixas` | Faixas de preco WhatsApp {min, max, preco} | array |
| `voip_list` | Lista de VOIPs inclusos | array de strings |
| `integracao_precos` | Precos de cada componente de integracao | objeto |
| `adicionais_config` | Adicionais opcionais {label, mrr, ativo} | objeto |

### Tabela `propostas`
Colunas: id, created_at, vendedor_id, vendedor_uuid, vendedor_nome, tipo_proposta, nome_empresa, crm_cliente, contato_nome, contato_email, pacote_horas, preco_mensalidade, preco_setup, desconto_pct, integ_tipo, whatsapp_info, status_proposta, motivo_perda, payload_json, data_proposta, validade_proposta, obs_interna

### Tabela `perfis`
Colunas: id (UUID -> auth.users), nome, cargo, email, telefone, cidade, perfil (admin/vendedor), status (ativo/inativo), created_at, updated_at

Trigger `on_auth_user_created`: insere automaticamente em `perfis` quando um usuario e criado no Supabase Auth.

### localStorage (apenas cache/individual)
| Chave | Classificacao |
|---|---|
| salesbud_config | CACHE (sync com Supabase) |
| salesbud_tabela | CACHE (sync com Supabase) |
| salesbud_crm_list | CACHE (sync com Supabase) |
| salesbud_whatsapp_faixas | CACHE (sync com Supabase) |
| salesbud_voip_list | CACHE (sync com Supabase) |
| salesbud_integ_precos | CACHE (sync com Supabase) |
| salesbud_adicionais | CACHE (sync com Supabase) |
| salesbud_users_v1 | CACHE (fallback perfis) |
| salesbud_historico | CACHE (fallback propostas) |
| salesbud_session | SESSAO (login legacy) |
| salesbud_last_email | INDIVIDUAL (pre-fill login) |
| salesbud_banner_dismissed_ver | INDIVIDUAL (banner dismiss) |

---

## Proposta Novos Clientes — Componentes Modulares

### Fluxo
1. AE preenche dados do cliente (empresa, CRM, contato)
2. AE seleciona pacote de horas (tabela V2, 50h-1000h)
3. AE configura componentes de integracao:
   - Personalizacao de Regras (padrao vs personalizada)
   - Pipelines adicionais (0+)
   - Tarefas Automaticas (toggle)
   - Campos Personalizados (quantidade, blocos de 5)
   - VOIP (listado=incluso, nao-listado=consultar)
4. AE ativa/desativa WhatsApp e define quantidade de usuarios
5. AE ativa/desativa adicionais opcionais
6. App calcula: Setup total + MRR total (horas + integracao + WhatsApp + adicionais)
7. AE gera proposta -> webhook -> Make -> Google Slides -> PDF -> email

### Calculo de precos
- **Setup total** = CRM personalizado (R$600) + Regras (R$900) + Pipelines (R$400/cada) + Tarefas (R$100) + Campos (R$100/bloco de 5)
- **MRR total** = Pacote horas + Tarefas (R$50) + Campos (R$100/bloco) + WhatsApp + Adicionais
- Regra RD Station: campos personalizados isentos de setup e MRR
- CRMs nativos (HubSpot, Pipedrive, RD Station): setup CRM gratuito

### Tabela de precos V2 (fallback hardcoded)
21 faixas: 50h (R$449), 70h (R$499), 100h (R$599), ..., 1000h (R$3.590)

### Faixas WhatsApp (fallback hardcoded)
1-10: R$100, 11-25: R$90, 26-40: R$85, 41-60: R$80, 61+: R$75

---

## Proposta Clientes de Base — Sistema Antigo

Mantém 3 tiers fixos: Basico, Intermediario, Avancado.
- Basico: setup 0 (nativo) ou 1.200 (nao-nativo), fee 0
- Intermediario: setup 1.200, fee 0
- Avancado: setup 3.000, fee 499/mes

Toggle "Plano especifico / Todos os planos".
Diagnostico de expansao com VOIP, CRM, WhatsApp, CS.

**Pendencia**: redesenho para componentes modulares (mesma abordagem de Novos Clientes).

---

## Payload do Webhook (Novos Clientes)

Variaveis enviadas para o Make/Google Slides:

| Variavel | Descricao |
|---|---|
| nome_empresa | Nome da empresa do cliente |
| crm_cliente | CRM selecionado |
| contato_nome | Nome do contato |
| contato_email | Email do contato |
| titulo_proposta | Titulo formatado para o Slides |
| pacote_horas | Quantidade de horas |
| preco_mensalidade | Preco mensal do pacote |
| fee_manutencao | MRR de integracao |
| preco_whatsapp | WhatsApp formatado |
| total_geral_mes | MRR total (pacote + integ + whats + adicionais) |
| detalhe_desconto | "Preco padrao" (fixo) |
| preco_setup | Setup total |
| descricao_setup | Detalhamento dos componentes |
| vendedor_nome | Nome do vendedor |
| vendedor_email | Email do vendedor |
| vendedor_telefone | Telefone do vendedor |
| vendedor_cidade | Cidade do vendedor |
| desconto_pct | 0 (fixo — removido da UI) |
| template_url | URL do template |
| template_versao | Versao do template |
| data_proposta | Data formatada |
| validade_proposta | Data + 15 dias (fixo) |
| tipo_proposta | 'novo' ou 'upsell_base' |
| plano_integracao | 'modular' (Novos) ou tier key (Base) |
| integ_regras | boolean — personalizacao de regras |
| integ_pipelines | numero — pipelines adicionais |
| integ_tarefas | boolean — tarefas automaticas |
| integ_campos | numero — campos personalizados |
| integ_voip | VOIP selecionado ou 'Sem VOIP' |
| mrr_integracao | MRR numerico de integracao |
| mrr_adicionais | MRR numerico de adicionais |
| adicionais_ativos | Lista dos adicionais ativos |
| preco_setup_basico | Referencia: setup CRM basico |
| total_avancado | Referencia: total com tudo |

---

## Decisoes Tecnicas

1. **Formulario de criacao de usuario removido** — trigger `on_auth_user_created` substitui. Usuarios criados via Supabase Dashboard com "Auto Confirm User".
2. **Desconto e validade removidos da UI** — payload mantém `desconto_pct: 0` e `validade_proposta` com +15 dias fixos para compatibilidade com Make.
3. **plano_integracao: 'modular'** — Novos Clientes envia componentes individuais em vez de tier. Base mantém tiers antigos.
4. **App desktop only** — sem versao mobile, tooltips por hover.

---

## Pendencias

- Redesenho da aba Clientes de Base (componentes modulares)
- Migracao de contas pessoais para organizacionais (GUIA_MIGRACAO.md)
- Upgrade do Make para plano Core (~$9/mes)
- Paginacao no historico (quando > 500 propostas)
- Subpastas por mes no Google Drive

---

## IDs Importantes

| Recurso | ID |
|---|---|
| Google Slides template | 1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA |
| Google Drive folder | 1AZCtwIErvLvMZgHwie3xU9XtoFk0HrwC |
| Supabase project | nrmfjyjxppbbdpsfhcft.supabase.co |
| Make scenario | https://us2.make.com/2013800/scenarios/4420296/edit |
| Make webhook | https://hook.us2.make.com/zlre1nfzl93qufepv8vns9g5dgesclqc |
