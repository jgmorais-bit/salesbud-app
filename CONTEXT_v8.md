# SalesBud Propostas -- Context Document v8
> Ultima atualizacao: 30/03/2026 -- App em producao com componentes modulares em ambas as abas

## Projeto

Gerador de propostas comerciais interno para o time de vendas SalesBud. Frontend em HTML/CSS/JS (3 arquivos), deploy via GitHub Pages. Configuracoes centralizadas no Supabase.

- **App em producao**: https://jgmorais-bit.github.io/salesbud-app
- **Repositorio**: https://github.com/jgmorais-bit/salesbud-app (publico)
- **Pasta local**: ~/salesbud-propostas/
- **Branch**: main
- **Arquivos**: index.html + styles.css + app.js
- **Desktop only** -- nao ha versao mobile, sem emojis

---

## Status: PRODUCAO

### Funcionalidades completas
- Login centralizado via Supabase Auth (email/senha)
- Esqueci minha senha (Supabase envia email de recuperacao)
- Alterar senha pelo perfil (modal no dropdown do avatar)
- Usuarios criados via Supabase Dashboard (trigger auto-insert em perfis)
- Aba Novos Clientes -- componentes modulares de integracao, WhatsApp, adicionais, payload
- Aba Clientes de Base -- modelo Upgrade (horas adicionais), diagnostico, comparativo, componentes modulares
- Historico compartilhado via Supabase com filtros, KPIs, export CSV, selecao em massa, edicao (obs_interna)
- Configuracoes centralizadas no Supabase: 2 tabelas de precos, faixas WhatsApp, CRMs, VOIPs, precos de integracao, adicionais
- CRM obrigatorio + lista customizavel por admin
- Tooltips informativos em cada componente de integracao (ambas as abas)
- Banner de boas praticas colapsavel (ambas as abas)
- Regra RD Station: campos personalizados isentos
- Breakdown detalhado com sub-itens de integracao MRR e setup (funcao compartilhada `renderBreakdown()`)
- Timeout 60s com feedback progressivo
- Fallback localStorage quando Supabase offline
- Controle de acesso: vendedor vs admin

### Make -- automacao 100% operacional (8 modulos + Resume)
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
Todas as configuracoes seguem a hierarquia:
1. **Gravacao**: Admin salva -> Supabase (tabela `configuracoes`) + cache localStorage
2. **Leitura**: Supabase -> cache localStorage -> default hardcoded no codigo
3. **Inicializacao**: `syncXxxFromSupabase()` chamado em `iniciarApp()`

### Chaves na tabela `configuracoes`
| Chave | Conteudo | localStorage key |
|---|---|---|
| `app_config` | webhook URL, token, template URL/versao | `salesbud_config` |
| `tabela_precos` | Array de {horas, preco} -- 21 faixas, 50h-1000h (Novos Clientes) | `salesbud_tabela` |
| `tabela_precos_base` | Array de {horas, preco} -- 21 faixas, 50h-1000h (Base/CS) | `salesbud_tabela_base` |
| `crm_list` | Lista de CRMs disponiveis | `salesbud_crm_list` |
| `whatsapp_faixas` | Faixas de preco WhatsApp {min, max, preco} | `salesbud_whatsapp_faixas` |
| `voip_list` | Lista de VOIPs inclusos | `salesbud_voip_list` |
| `integracao_precos` | Precos de cada componente de integracao | `salesbud_integ_precos` |
| `adicionais_config` | Adicionais opcionais {label, mrr, ativo} | `salesbud_adicionais` |

### Funcoes de sync (chamadas em iniciarApp)
```
syncConfigFromSupabase()
syncTabelaFromSupabase()
syncTabelaBaseFromSupabase()
syncCrmFromSupabase()
syncWhatsappFromSupabase()
syncVoipFromSupabase()
syncIntegPrecosFromSupabase()
syncAdicionaisFromSupabase()
```

### Duas tabelas de precos
- `tabela_precos` -- usada por Novos Clientes via `getTabelaAtiva()`
- `tabela_precos_base` -- usada por Base/CS via `getTabelaBaseAtiva()`
- `calcPrecoExato(horas, modulo)` -- parametrizado: se `modulo === 'base'` le da tabela Base, senao da tabela Novos
- Ambas editaveis independentemente pelo admin

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
| salesbud_tabela_base | CACHE (sync com Supabase) |
| salesbud_crm_list | CACHE (sync com Supabase) |
| salesbud_whatsapp_faixas | CACHE (sync com Supabase) |
| salesbud_voip_list | CACHE (sync com Supabase) |
| salesbud_integ_precos | CACHE (sync com Supabase) |
| salesbud_adicionais | CACHE (sync com Supabase) |
| salesbud_users_v1 | CACHE (fallback perfis) |
| salesbud_historico | CACHE (fallback propostas) |
| salesbud_session | SESSAO (login) |
| salesbud_last_email | INDIVIDUAL (pre-fill login) |
| salesbud_banner_dismissed_ver | INDIVIDUAL (banner dismiss) |

---

## Proposta Novos Clientes -- Componentes Modulares

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
5. AE ativa/desativa adicionais opcionais (configurados pelo admin)
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

## Proposta Clientes de Base -- Modelo Upgrade

### Conceito
O CS informa o consumo atual do cliente e propoe horas ADICIONAIS. O sistema calcula o novo pacote total e o delta de valor.

### Fluxo
1. CS preenche dados do cliente (empresa, CRM, contato)
2. CS informa Consumo Atual: horas contratadas, usuarios ativos, valor mensal pago, usuarios WhatsApp contratados
3. CS preenche Diagnostico: CRM ativa? (nativo? campos?), VOIP? (nativo? campos?), WhatsApp ativo?
4. CS informa horas mensais adicionais (campo direto ou calculadora de consumo)
   - totalHoras = horasAtuais + horasAdicionais
   - Calculadora: estimativa - horasAtuais = adicional (minimo 0)
5. CS configura componentes de integracao (mesmos de Novos Clientes)
6. CS configura WhatsApp e adicionais opcionais
7. App calcula:
   - precoNovo = calcPrecoExato(totalHoras, 'base')
   - totalMensal = precoNovo + mrrIntegracao + mrrAdicionais + whatsTotal
   - delta = totalMensal - valorAtual
8. CS gera proposta de upsell

### Score de Adocao (/5)
Baseado no diagnostico:
- CRM (nativo/externo): 1 ponto
- Campos CRM: 1 ponto
- VOIP (nativo/externo): 1 ponto
- Campos VOIP: 1 ponto
- WhatsApp: 1 ponto

Tags: "Ativo agora" (items ativos) + "Expansao possivel" (oportunidades)

### Comparativo Atual x Proposta
- ATUAL: horas e valor do Consumo Atual
- PROPOSTA: totalHoras e totalMensal
- Delta: "+R$ X/mes (+Y%)"

---

## Breakdown Detalhado (compartilhado entre as abas)

Funcao `renderBreakdown(containerId, dados)` gera o breakdown com sub-itens:

```
Mensalidade                          R$ 1.490/mes

Integracao                           R$ 250/mes
  | Tarefas automaticas              R$ 50/mes
  | Campos personalizados (10)       R$ 200/mes

Adicionais                           R$ 150/mes
  | Chat com Bud                     R$ 150/mes

Subtotal                             R$ 1.890/mes
WhatsApp (10 users)                  R$ 900/mes
----------------------------------------------
Total s/ WA                          R$ 1.890/mes
Total c/ WA                          R$ 2.790/mes

+ Setup (implantacao . pontual)      R$ 1.400
  | CRM personalizado                R$ 600
  | Personalizacao de regras         R$ 900
  | Tarefas automaticas              R$ 100

VOIP: Api4com (incluso)
```

Regras: linhas so aparecem se valor > 0. Se setup = 0, bloco omitido. Se VOIP = "Sem VOIP", linha omitida.

---

## Historico

- Listagem de propostas com filtros, busca, KPIs
- Export CSV, selecao em massa
- Edicao de obs_interna
- Status: enviada, negociacao, aprovada, perdida (com motivo)
- Sem coluna de desconto (removida)

---

## Admin / Configuracoes

- Tabela de precos Novos Clientes (editavel, sync Supabase)
- Tabela de precos Base/CS (editavel, sync Supabase, independente)
- Faixas WhatsApp (editaveis)
- CRMs (adicionaveis, nativos protegidos: HubSpot, Pipedrive, RD Station)
- VOIPs (adicionaveis)
- Precos de integracao (editaveis por componente)
- Adicionais opcionais (toggle ativo + valor MRR por adicional)
- Importacao de tabela via .xlsx/.csv
- Gestao de usuarios: via Supabase Dashboard + trigger automatico

---

## Payload do Webhook

### Variaveis compartilhadas (Novos + Base)

| Variavel | Descricao |
|---|---|
| nome_empresa | Nome da empresa |
| crm_cliente | CRM selecionado |
| contato_nome | Nome do contato |
| contato_email | Email do contato |
| titulo_proposta | "Salesbud - Apresentacao e Proposta - {empresa}" |
| pacote_horas | Quantidade de horas do pacote |
| preco_mensalidade | Preco mensal do pacote |
| fee_manutencao | MRR de integracao |
| preco_whatsapp | WhatsApp formatado |
| total_geral_mes | MRR total |
| detalhe_desconto | "Preco padrao" (fixo) |
| preco_setup | Setup total |
| descricao_setup | Detalhamento dos componentes de setup |
| vendedor_nome | Nome do vendedor |
| vendedor_email | Email do vendedor |
| vendedor_telefone | Telefone do vendedor |
| vendedor_cidade | Cidade do vendedor |
| desconto_pct | 0 (fixo) |
| template_url | URL do template |
| template_versao | Versao do template |
| data_proposta | Data formatada |
| validade_proposta | Data + 15 dias (fixo) |
| tipo_proposta | 'novo' ou 'upsell_base' |
| plano_integracao | 'modular' (fixo) |
| personalizacao_regras | "Sim" / "Nao" |
| pipelines_adicionais | Numero de pipelines extras |
| tarefas_automaticas | "Sim" / "Nao" |
| campos_personalizados | Quantidade de campos |
| campos_blocos | Blocos de 5 campos |
| voip_cliente | VOIP selecionado |
| voip_status | "Incluso" / "Consultar" / "Nao incluso" |
| setup_total | Setup total formatado |
| setup_detalhamento | Detalhamento do setup |
| mrr_integracao | MRR de integracao formatado |
| mrr_integracao_detalhamento | Detalhe do MRR |
| adicionais_lista | Lista de adicionais ativos |
| adicionais_total | Total de adicionais MRR |

### Variaveis exclusivas de Novos Clientes
| Variavel | Descricao |
|---|---|
| integ_regras | Boolean (legado) |
| integ_pipelines | Numerico (legado) |
| integ_tarefas | Boolean (legado) |
| integ_campos | Numerico (legado) |
| integ_voip | String (legado) |
| mrr_adicionais | Numerico (legado) |
| adicionais_ativos | String (legado) |
| preco_setup_basico | Referencia: setup CRM basico |
| total_avancado | Referencia: total com tudo |

### Variaveis exclusivas de Base
| Variavel | Descricao |
|---|---|
| num_usuarios | Usuarios ativos atuais |
| horas_atual | Horas contratadas atuais |
| valor_atual | Valor mensal pago |
| horas_adicionais | Horas adicionais propostas |
| horas_proposto | Total: atual + adicional |
| valor_proposto | Valor total proposto |
| acrescimo_mensal | Delta: proposto - atual |
| diag_crm | Diagnostico CRM |
| diag_voip | Diagnostico VOIP |
| diag_whatsapp | Diagnostico WhatsApp |
| whatsapp_atual | Usuarios WhatsApp contratados |

---

## Decisoes Tecnicas

1. **Formulario de criacao de usuario removido** -- trigger `on_auth_user_created` substitui. Usuarios criados via Supabase Dashboard com "Auto Confirm User".
2. **Desconto e validade removidos da UI** -- payload mantem `desconto_pct: 0` e `validade_proposta` com +15 dias fixos para compatibilidade com Make.
3. **plano_integracao: 'modular'** -- ambos os modulos enviam componentes individuais.
4. **Toggle "Todos os planos" removido** -- sempre modular, sem opcao de tier unico.
5. **Modelo de upsell: Upgrade** -- campo "Horas mensais adicionais", total = atual + adicional, preco pela tabela Base por volume.
6. **"Escopo da Integracao" removido** -- redundante com breakdown detalhado de sub-itens.
7. **Textos prescritivos removidos do diagnostico** -- apenas score, tags "Ativo agora" e "Expansao possivel".
8. **App desktop only** -- sem versao mobile, tooltips por hover, sem emojis.
9. **Duas tabelas de precos independentes** -- Novos Clientes e Base/CS, editaveis separadamente pelo admin.
10. **`calcPrecoExato(horas, modulo)` parametrizado** -- `'base'` le de `tabela_precos_base`, default le de `tabela_precos`.

---

## Pendencias

- Tabela de precos Base: CS vai definir valores especificos (hoje usa mesma V2 como default)
- Template Google Slides: precisa de tags novas para variaveis modulares do payload
- Make: precisa mapear variaveis novas do payload (integracao, adicionais, diagnostico)
- Migracao de contas pessoais para organizacionais (GUIA_MIGRACAO.md)
- Upgrade do Make para plano Core (~$9/mes)
- Paginacao no historico (quando > 500 propostas)
- V3 futura: emissao automatizada de minuta/contrato

---

## IDs Importantes

| Recurso | ID |
|---|---|
| Google Slides template | 1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA |
| Google Drive folder | 1AZCtwIErvLvMZgHwie3xU9XtoFk0HrwC |
| Supabase project | nrmfjyjxppbbdpsfhcft.supabase.co |
| Make scenario | https://us2.make.com/2013800/scenarios/4420296/edit |
| Make webhook | https://hook.us2.make.com/zlre1nfzl93qufepv8vns9g5dgesclqc |

---

## Precos de Integracao (defaults hardcoded)

| Componente | Setup | MRR |
|---|---|---|
| CRM personalizado (nao-nativo) | R$ 600 | -- |
| Personalizacao de regras | R$ 900 | -- |
| Pipeline adicional | R$ 400/pipeline | -- |
| Tarefas automaticas | R$ 100 | R$ 50/mes |
| Campos personalizados | R$ 100/bloco de 5 | R$ 100/bloco/mes |
| CRM nativo (HubSpot, Pipedrive, RD Station) | Gratuito | -- |
| RD Station campos | Isento | Isento |
