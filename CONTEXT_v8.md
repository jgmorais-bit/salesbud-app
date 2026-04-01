# SalesBud Propostas -- Context Document v8
> Ultima atualizacao: 01/04/2026 -- Sprint 7: modularizacao codebase + fixes sessao 2 (payload limpo, mensalidade padronizada)

## Projeto

Gerador de propostas comerciais interno para o time de vendas SalesBud. Frontend em HTML/CSS/JS (3 arquivos), deploy via GitHub Pages. Configuracoes centralizadas no Supabase.

- **App em producao**: https://jgmorais-bit.github.io/salesbud-app
- **Repositorio**: https://github.com/jgmorais-bit/salesbud-app (publico)
- **Pasta local**: ~/salesbud-propostas/
- **Branch**: main (fixes diretos) | feature branches + PR para sprints
- **Arquivos**: index.html + styles.css + js/ (9 modulos) + app.js (deprecado, stub de compatibilidade)
- **Desktop only** -- nao ha versao mobile, sem emojis

---

## Status: PRODUCAO

### Funcionalidades completas
- Login centralizado via Supabase Auth (email/senha)
- Tela de "Carregando..." durante verificacao de sessao (sem flash de login ao recarregar)
- Toggle "Manter conectado" no login (marcado por padrao): desmarcado = sessao expira ao fechar browser
- Esqueci minha senha (Supabase envia email de recuperacao)
- Alterar senha pelo perfil (modal no dropdown do avatar)
- Usuarios criados via Supabase Dashboard (trigger auto-insert em perfis)
- Aba Novos Clientes -- componentes modulares de integracao, WhatsApp, adicionais, payload
- Aba Clientes de Base -- modelo Upgrade (horas adicionais), diagnostico, comparativo, componentes modulares
- Historico compartilhado via Supabase com filtros, KPIs, export CSV, selecao em massa, edicao (obs_interna)
- Botao "Reenviar" no historico: busca payload_json do Supabase e dispara webhook (fire-and-forget, cooldown 30s)
- Configuracoes centralizadas no Supabase: 2 tabelas de precos, faixas WhatsApp, CRMs, VOIPs, precos de integracao, adicionais
- CRM obrigatorio + lista customizavel por admin
- Tooltips informativos em cada componente de integracao (ambas as abas)
- Banner de boas praticas colapsavel (ambas as abas)
- Regra RD Station: campos personalizados isentos
- Breakdown detalhado com sub-itens de integracao MRR e setup (funcao compartilhada `renderBreakdown()`)
- Timeout 60s com feedback progressivo
- Fallback localStorage quando Supabase offline
- Controle de acesso: vendedor vs admin

### Codebase modularizado (Sprint 7)
app.js separado em 9 modulos em js/:
- config.js (347 linhas) -- globals, constantes, Supabase init, sync
- pricing.js (333 linhas) -- calculos de preco, tabelas, WhatsApp
- ui.js (173 linhas) -- telas, toast, utilitarios, breakdown
- auth.js (318 linhas) -- login/logout, sessao, setup, senha
- novos.js (515 linhas) -- formulario Novos Clientes
- base.js (595 linhas) -- formulario Clientes de Base
- historico.js (719 linhas) -- CRUD historico, export, PDF, reenviar
- admin.js (769 linhas) -- config UI, tabelas, usuarios CRUD
- main.js (278 linhas) -- DOMContentLoaded, iniciarApp, navTo, webhook

### Make -- automacao 100% operacional (8 modulos + Resume)
```
Webhooks (1) -> Drive Copy (3) -> Slides Template (4) ->
Slides API Call/Delete (14) -> [Resume] -> Tools Set Variable (20) ->
Drive Download/PDF (11) -> Gmail Send (16) -> Webhooks Response (7)
```
Plano: Core (~$9/mes)

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
Plano: Core (~$9/mes)
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
| salesbud_session | SESSAO (login fallback localStorage) |
| salesbud_last_email | INDIVIDUAL (pre-fill login) |
| salesbud_banner_dismissed_ver | INDIVIDUAL (banner dismiss) |
| salesbud_no_persist | FLAG (manter conectado = OFF: set 'true', apagado no logout) |

### sessionStorage
| Chave | Classificacao |
|---|---|
| salesbud_session_temp | FLAG (manter conectado = OFF: presente durante a sessao, limpa ao fechar browser) |

---

## Proposta Novos Clientes -- Componentes Modulares

### Fluxo
1. AE preenche dados do cliente (empresa, CRM, contato)
2. AE seleciona pacote de horas (tabela V2, 50h-1000h; minimo 50h, nao e possivel gerar com menos)
3. AE configura componentes de integracao:
   - Personalizacao de Regras (padrao vs personalizada)
   - Pipelines adicionais (0+)
   - Tarefas Automaticas (toggle)
   - Campos Personalizados (quantidade, blocos de 5)
   - VOIP (listado=incluso, nao-listado=consultar)
4. AE ativa/desativa WhatsApp e define quantidade de usuarios (inicia em 1)
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
   - Score de adocao /5; tags "Ativo agora" e "Expansao possivel" (sem textos prescritivos)
4. CS informa horas mensais adicionais (campo direto ou calculadora de consumo)
   - totalHoras = horasAtuais + horasAdicionais
   - Linha informativa: "Atual: Xh + Adicional: Yh = Novo pacote: Zh"
   - Calculadora: coloca estimativa diretamente como horas adicionais (SEM subtrair horasAtuais)
     O CS insere os novos usuarios na calculadora -- o resultado ja sao as horas adicionais, nao o total
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
"Escopo da Integracao" removido de ambas as abas (redundante com breakdown).

---

## Template Google Slides

### Slide unico "Proposta Comercial"
- 3 slides antigos (Basica/Intermediaria/Avancada) substituidos por 1 slide unico modular
- Template ID: `1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA` (mesmo ID)

### Tags ativas no template (mapeadas no Make)
| Tag | Exemplo de valor |
|---|---|
| {{nome_empresa}} | Acme Corp |
| {{crm_cliente}} | HubSpot |
| {{pacote_horas}} | 100 |
| {{preco_mensalidade}} | R$ 599/mes |
| {{mensalidade_completa_somada}} | R$ 749/mes |
| {{mensalidade_detalhamento}} | Horas + Tarefas automaticas |
| {{fee_manutencao}} | R$ 150/mes ou "" |
| {{mrr_integracao_detalhamento}} | ver regras abaixo |
| {{setup_total}} | R$ 1.400 ou "Gratuito" |
| {{setup_detalhamento}} | ver regras abaixo |
| {{voip_cliente}} | Api4com |
| {{voip_status}} | Incluso / Consultar / Nao incluso |
| {{adicionais_lista}} | Chat com Bud R$ 150/mes |
| {{total_geral_mes}} | R$ 2.790/mes |
| {{vendedor_nome}} | Joao Silva |
| {{data_proposta}} | 01/04/2026 |

### Formato padronizado no template
- Mensalidade: `Total: {{mensalidade_completa_somada}} || Ref: {{mensalidade_detalhamento}}`
- Setup: `Total: {{setup_total}} || Ref: {{setup_detalhamento}}`

### Tags removidas do Make (obsoletas)
- `mensalidade_completa`, `preco_setup`, `preco_setup_basico`, `total_avancado`
- `detalhe_desconto`, `desconto_pct`, `descricao_setup`
- `integ_regras`, `integ_pipelines`, `integ_tarefas`, `integ_campos`, `integ_voip`
- `mrr_adicionais`, `adicionais_ativos`

---

## Historico

- Listagem de propostas com filtros, busca, KPIs
- Export CSV, selecao em massa
- Edicao de obs_interna
- Status: enviada, negociacao, aprovada, perdida (com motivo)
- Sem coluna de desconto (removida)
- Botao "Reenviar": disponivel para propostas com payload_json no Supabase; dispara webhook em fire-and-forget; cooldown de 30s para evitar duplicatas

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
| preco_mensalidade | Preco mensal so do pacote de horas |
| mensalidade_completa_somada | Soma horas + MRR integracao (ex: "R$ 1.459/mes") |
| mensalidade_detalhamento | Componentes MRR sem R$ (ex: "Horas + Tarefas automaticas") |
| fee_manutencao | MRR de integracao formatado ou "" quando zero |
| preco_whatsapp | WhatsApp formatado |
| total_geral_mes | MRR total (horas + integ + adicionais + WhatsApp) |
| vendedor_nome | Nome do vendedor |
| vendedor_email | Email do vendedor |
| vendedor_telefone | Telefone do vendedor |
| vendedor_cidade | Cidade do vendedor |
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
| setup_total | "Gratuito" ou valor formatado (ex: "R$ 1.400") |
| setup_detalhamento | ver regras abaixo |
| mrr_integracao | MRR de integracao formatado ou "" quando zero |
| mrr_integracao_detalhamento | ver regras abaixo |
| adicionais_lista | Lista de adicionais ativos |
| adicionais_total | Total de adicionais MRR |

### Regras de formatacao do payload

**`mensalidade_completa_somada`**
- Sempre: `fmt(precoFinal + mrrInteg) + '/mes'`
- Ex com integracao: `"R$ 1.459/mes"`, sem integracao: `"R$ 449/mes"`

**`mensalidade_detalhamento`**
- Sempre inclui "Horas"; adiciona componentes MRR ativos sem valores R$
- Ex: `"Horas + Tarefas automaticas + Campos personalizados (5)"`, ou apenas `"Horas"`

**`fee_manutencao`**
- mrrInteg > 0: valor formatado, ex: `"R$ 150/mes"`
- mrrInteg = 0: `""` (string vazia -- desaparece no template)

**`mrr_integracao`**
- mrrInteg > 0: `"R$ X/mes"`
- mrrInteg = 0: `""`

**`mrr_integracao_detalhamento`**
- CRM = "Sem CRM": `""` (string vazia)
- CRM valido, sem extras MRR: `"Integracao padrao incluida"`
- Com extras: componentes sem R$, ex: `"Tarefas automaticas + Campos personalizados (5)"`

**`setup_total`**
- Setup = 0: `"Gratuito"`
- Setup > 0: valor formatado, ex: `"R$ 1.400"`

**`setup_detalhamento`**
- CRM = "Sem CRM": `"Sem integracao de CRM"`
- CRM nativo, sem extras de setup: `"CRM nativo -- setup gratuito"`
- Com extras: componentes sem R$, ex: `"CRM personalizado + Personalizacao de regras + 2 pipelines adicionais"`
  - Itens possiveis: "CRM personalizado", "Personalizacao de regras", "N pipeline(s) adicional(is)", "Tarefas automaticas", "N campos (B bloco(s))"

**`voip_status`**
- VOIP na lista de inclusos: `"Incluso"`
- VOIP nao listado: `"Consultar"`
- Sem VOIP selecionado: `"Nao incluso"`

### Variaveis exclusivas de Novos Clientes
Nenhuma variavel exclusiva (alem das compartilhadas acima).

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
3. **`plano_integracao: 'modular'`** -- ambos os modulos enviam componentes individuais.
4. **Toggle "Todos os planos" removido** -- sempre modular, sem opcao de tier unico.
5. **Modelo de upsell: Upgrade** -- campo "Horas mensais adicionais", total = atual + adicional, preco pela tabela Base por volume.
6. **"Escopo da Integracao" removido** -- redundante com breakdown detalhado de sub-itens.
7. **Textos prescritivos removidos do diagnostico** -- apenas score, tags "Ativo agora" e "Expansao possivel".
8. **App desktop only** -- sem versao mobile, tooltips por hover, sem emojis.
9. **Duas tabelas de precos independentes** -- Novos Clientes e Base/CS, editaveis separadamente pelo admin.
10. **`calcPrecoExato(horas, modulo)` parametrizado** -- `'base'` le de `tabela_precos_base`, default le de `tabela_precos`.
11. **Horas minimo 50** -- campo de horas inicia em 50 e nao aceita valor menor; nao e possivel gerar proposta com menos de 50h.
12. **WhatsApp inicia em 1 usuario** -- default corrigido de 5 para 1.
13. **Botao Reenviar: fire-and-forget** -- fetch sem await, feedback imediato, cooldown 30s. Disponivel para qualquer proposta com payload_json salvo no Supabase.
14. **Template slide unico** -- 3 slides antigos (Basica/Intermediaria/Avancada) substituidos por 1 slide modular com tags novas. Template ID inalterado.
15. **Loading screen anti-flash** -- overlay `screen-loading` cobre login/app durante verificacao de sessao. `screen-login` nao tem mais `active` por padrao. Timeout de 5s como fallback.
16. **"Manter conectado" OFF** -- grava `salesbud_no_persist` no localStorage + `salesbud_session_temp` no sessionStorage. Ao reabrir o browser (sessionStorage limpo), init detecta e faz signOut automatico antes de restaurar sessao.
17. **Codebase modularizado (Sprint 7)** -- app.js (3984 linhas) separado em 9 modulos em js/. app.js original substituido por stub de deprecacao. index.html carrega os 9 modulos na ordem correta.
18. **Payload limpo** -- 14 variaveis legadas removidas. Sem "Nao incluso" em campos numericos: usa string vazia "" para fee_manutencao, mrr_integracao quando zero.
19. **Calculadora Base sem subtracao** -- `aplicarBaseCalc()` coloca estimativa diretamente como horas adicionais, sem subtrair horasAtuais. CS insere apenas novos usuarios na calculadora.
20. **Detalhamento sem R$** -- setup_detalhamento e mrr_integracao_detalhamento listam componentes por nome; valores ficam em setup_total e mrr_integracao respectivamente.
21. **Mensalidade formato Total + Ref** -- padrao identico ao setup: mensalidade_completa_somada (total unico) + mensalidade_detalhamento (componentes sem R$).

---

## Workflow de Desenvolvimento

- **Fixes pequenos** (1-3 arquivos, sem risco de regressao): commit direto na main, Claude Sonnet auto
- **Sprints grandes** (multiplas funcionalidades ou refactor): feature branch + Pull Request, Claude Opus max effort
- Push apos cada commit

---

## Pendencias

- Tabela de precos Base: CS (Lilian/Carol) vai definir valores especificos (hoje usa mesma V2 como default)
- Adicionais (Chat com Bud, Contas Enriquecimento): removidos do template por enquanto; reativar quando tiverem precos definidos
- Testes automatizados: proximo passo apos estabilizacao do payload
- Migracao de contas pessoais para organizacionais (GUIA_MIGRACAO.md)
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
