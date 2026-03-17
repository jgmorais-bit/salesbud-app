# SalesBud Propostas — Context Document v5
> Última atualização: 17/03/2026 15h · Usar como briefing no início de cada nova sessão

## Projeto

Gerador de propostas comerciais interno para o time de vendas SalesBud (~12 AEs + 2 admins). Single-file HTML/CSS/JS, acessado via URL pinada no HubSpot em cada deal.

- **App em produção**: https://jgmorais-bit.github.io/salesbud-app
- **Repositório**: https://github.com/jgmorais-bit/salesbud-app (público)
- **Pasta local**: ~/salesbud-propostas/index.html
- **Branch**: main

---

## Decisões tomadas

- Single file index.html — GitHub Pages sem build step
- localStorage + Supabase — fallback transparente
- btoa() para senhas — obfuscação simples, Supabase Auth é o próximo passo
- Tela de setup inicial — admin define senhas no primeiro acesso
- Repositório público — GitHub Pages gratuito
- Premium removido da UI — vendas premium feitas manualmente
- Renomeação planos CRM: Lite→Básico, Básico→Intermediário, Intermediário→Avançado
- Desconto máx 10% — apenas caixinhas 0/5/10%, sem slider
- Setup abaixo do total no breakdown, parcelável em 12x
- Total com/sem WhatsApp mostrado separadamente quando WhatsApp ativo
- Make em vez de n8n — n8n trial expirou, Make plano gratuito
- OAuth customizado — conta Gmail pessoal requer OAuth custom no Google Cloud
- Sem versão mobile — desktop only via HubSpot
- Claude Code para todos os deploys
- plano_integracao adicionado ao payload (commit 639415e)
- Pasta "Propostas Salesbud" compartilhada como "Qualquer pessoa com o link = Editor"
- Variáveis por plano no template: preco_setup_basico (dinâmico) + hardcode nos slides 13/14
- CRM nativo vs API aberta: Básico gratuito para nativos, R$1.200 para não-nativos
- Timeout webhook 60s com feedback progressivo
- Botão "Baixar PDF" removido (redundante — PDF chega no email)

---

## Estado atual — TUDO FUNCIONANDO

### App em produção
- Login com admin/vendedor + sessão persistente (checkbox Manter conectado, TTL 8h/30 dias)
- Aba Novos Clientes — cálculo, breakdown, WhatsApp, desconto, payload
- Aba Clientes de Base — diagnóstico, comparativo, upsell
- Histórico com filtros por tipo/vendedor/período, KPIs, export CSV, editar, excluir, seleção em massa
- Configurações — webhook, Supabase, template, tabela de preços, lista de CRMs customizável
- Fallback quando automação indisponível
- Controle de acesso — vendedor não vê Usuários nem Configurações
- Lógica CRM nativo vs API aberta: Básico setup R$0 (nativo) ou R$1.200 (não-nativo)
- Toggle "Plano específico / Todos os planos" — envia 1 ou 3 slides ao cliente
- CRM obrigatório + lista customizável por admin
- Timeout 60s com feedback progressivo no botão (Enviando → Gerando → Exportando → Quase lá)

### Make — fluxo 100% operacional (8 módulos + error handler)
Cenário: https://us2.make.com/2013800/scenarios/4420296/edit
Scheduling: ativo ("Immediately as data arrives")

```
Webhooks (1) → Google Drive Copy (3) → Google Slides Template (4) →
Google Slides API Call [delete slides] (14) → [Resume error handler] →
Tools Set Variable (20) → Google Drive Download/PDF (11) →
Gmail Send (16) → Webhooks Response (7)
```

- Módulo 1: **Webhooks** — Custom webhook ✅
- Módulo 3: **Google Drive** — Copy a File ✅
- Módulo 4: **Google Slides** — Create a Presentation From a Template ✅
  - 12 Tags mapeadas incluindo preco_setup_basico e total_avancado
- Módulo 14: **Google Slides** — Make an API Call (batchUpdate) ✅
  - URL: `v1/presentations/{{4.Presentation ID}}:batchUpdate`
  - Body condicional: se "todos" → requests vazio (erro ignorado via Resume)
  - Se basico/intermediario/avancado → deleta os 2 slides dos outros planos
  - **Resume error handler**: quando plano_integracao="todos", erro é ignorado e fluxo continua
- Módulo 20: **Tools** — Set Variable ✅
  - slides_edit_url = `https://docs.google.com/presentation/d/` + `4.Presentation ID` + `/edit`
- Módulo 11: **Google Drive** — Download a File (Advanced Settings: Convert Google Slides to PDF) ✅
- Módulo 16: **Gmail** — Send an Email ✅
  - Body type: Raw HTML
  - To: `1.vendedor_email`
  - Subject: `Proposta Salesbud - {{1.nome_empresa}}`
  - Link editável: `{{20.slides_edit_url}}`
  - Attachment: `{{1.nome_empresa}}.pdf` com data de `11.Data`
  - Modelo de email para envio ao cliente incluído (copie e personalize)
- Módulo 7: **Webhooks** — Webhook Response ✅
  - Body JSON: `{ slides_url, pdf_url }` com `4.presentationId` e `11.Web Content Link`

### IDs dos slides de proposta no template
```
Slide 12 (Básico):         ID = p12
Slide 13 (Intermediário):  ID = p13
Slide 14 (Avançado):       ID = p14
```

### Template Google Slides — variáveis por slide
```
Slides 1-11: institucionais (fixos)
Slide 12 (Básico):
  - {{preco_setup_basico}} (dinâmico: Gratuito ou R$ 1.200)
  - {{pacote_horas}}, {{preco_mensalidade}}, {{total_geral_mes}}
  - {{preco_whatsapp}}, {{crm_cliente}}
Slide 13 (Intermediário):
  - Setup: R$ 1.200 (hardcode)
  - Fee: Não incluso (hardcode)
  - {{pacote_horas}}, {{preco_mensalidade}}, {{total_geral_mes}}
  - {{preco_whatsapp}}, {{crm_cliente}}
Slide 14 (Avançado):
  - Setup: R$ 3.000 (hardcode)
  - Fee: R$ 499/mês (hardcode)
  - {{pacote_horas}}, {{preco_mensalidade}}, {{total_avancado}}
  - {{preco_whatsapp}}, {{crm_cliente}}
Slide 15: Capa personalizada
  - {{nome_empresa}}, {{vendedor_nome}}, {{vendedor_email}}
```

---

## Pendências (ordem de prioridade)

### 1. [App] Configurar Supabase em produção
**Status**: Schema SQL pronto, UI de configuração no app pronta. Falta criar projeto no Supabase, rodar SQL, e configurar URL + anon key no app.
**Benefício**: Histórico compartilhado entre vendedores, visibilidade do gestor.

### 2. [HubSpot] Pinar URL nos deals

### 3. [App] Remover botão "Baixar PDF" (redundante)

### 4. [Futuro] Migrar contas pessoais para conta SalesBud

---

## Specs e regras de negócio

### Tabela de preços
```
50h=399 | 100h=599 | 150h=799 | 200h=990 | 300h=1490 | 400h=1990
500h=2490 | 750h=2990 | 1000h=3590 | 1250h=5390 | 1500h=6290
2000h=7990 | 3000h=12347 | 4000h=13558 | 5000h=16140
7500h=24210 | 10000h=32280
```

### Planos CRM (objeto INTEG no código)
```javascript
const INTEG = {
  basico:        { setup: 0,    fee: 0,   label: 'Somente notas e observações' },
  intermediario: { setup: 1200, fee: 0,   label: 'Até 5 campos personalizados' },
  avancado:      { setup: 3000, fee: 499, label: '10 campos + tarefas + 2 pipelines' }
};
// CRM nativo (HubSpot, Pipedrive, RD Station): basico.setup = 0
// CRM não-nativo: basico.setup = 1200 (via isCrmNativo() no runtime)
```

### Lógica CRM nativo vs API aberta (IMPLEMENTADO)
```
CRM nativo (HubSpot, Pipedrive, RD Station):
  → Básico: setup R$0, fee R$0, somente notas

CRM não-nativo (todos os outros):
  → Básico: setup R$1.200, fee R$0, somente notas
  → Intermediário: setup R$1.200, fee R$0 (sem mudança)
  → Avançado: setup R$3.000, fee R$499/mês (sem mudança)
```

### WhatsApp tiers
```
1-5u: R$100/u | 6-10u: R$90/u | 11-20u: R$80/u
21-30u: R$70/u | 31-50u: R$60/u | 51+u: R$50/u
```

### Payload JSON completo (versão atual)
```json
{
  "nome_empresa": "",
  "crm_cliente": "",
  "contato_nome": "",
  "contato_email": "",
  "titulo_proposta": "",
  "pacote_horas": "",
  "preco_mensalidade": "R$ X.XXX/mês",
  "fee_manutencao": "R$ 499/mês | Não incluso | Ver proposta",
  "preco_whatsapp": "R$ XXX/mês para X usuários | Não incluso",
  "total_geral_mes": "R$ X.XXX/mês",
  "detalhe_desconto": "Desconto de X% aplicado | Preço padrão",
  "preco_setup": "R$ X.XXX | Gratuito | Ver proposta",
  "preco_setup_basico": "Gratuito | R$ 1.200",
  "total_avancado": "R$ X.XXX/mês",
  "descricao_setup": "",
  "vendedor_nome": "",
  "vendedor_email": "",
  "vendedor_telefone": "",
  "vendedor_cidade": "",
  "desconto_pct": 0,
  "aprovacao_desconto": null,
  "template_url": "",
  "template_versao": "",
  "data_proposta": "DD/MM/AAAA",
  "validade_proposta": "DD/MM/AAAA",
  "tipo_proposta": "novo | upsell_base",
  "plano_integracao": "basico | intermediario | avancado | todos"
}
```

---

## Infraestrutura e credenciais

### GitHub
```
Conta: jgmorais-bit
Repo: salesbud-app
URL produção: https://jgmorais-bit.github.io/salesbud-app
```

### Make
```
Conta: joaomoraisrossler@gmail.com
URL cenário: https://us2.make.com/2013800/scenarios/4420296/edit
Webhook URL: https://hook.us2.make.com/zlre1nfzl93qufepv8vns9g5dgesclqc
Scheduling: Immediately as data arrives (ativo)
```

### Google Cloud — projeto salesbud-propostas
```
Project Number: 992477413767
OAuth Client: Make - Salesbud
Client ID: (ver Google Cloud Console)
Client Secret: (ver Google Cloud Console)
APIs ativas: Google Drive API, Google Slides API, Gmail API
Redirect URIs:
  https://www.integromat.com/oauth/cb/google
  https://www.make.com/oauth/cb/google
  https://hook.us2.make.com/oauth/cb/google
  https://www.integromat.com/oauth/cb/google-restricted
Usuário de teste: joaomoraisrossler@gmail.com
```

### Google Drive
```
Template Slides ID: 1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA
Template URL: https://docs.google.com/presentation/d/1noZ8EHZJ4EPUrvuowd2UZjl24Lj9QXKH2ErPClZT_XA/edit
Pasta Propostas SalesBud ID: 1AZCtwIErvLvMZgHwie3xU9XtoFk0HrwC
Permissão pasta: Qualquer pessoa com o link = Editor
```

### Supabase SQL (pendente configuração)
```sql
CREATE TABLE propostas (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  vendedor_id INTEGER, vendedor_nome TEXT,
  tipo_proposta TEXT DEFAULT 'novo',
  nome_empresa TEXT, crm_cliente TEXT,
  contato_nome TEXT, contato_email TEXT,
  pacote_horas TEXT, preco_mensalidade TEXT, preco_setup TEXT,
  desconto_pct INTEGER DEFAULT 0,
  integ_tipo TEXT, whatsapp_info TEXT,
  status_proposta TEXT DEFAULT 'enviada',
  motivo_perda TEXT, data_proposta TEXT,
  validade_proposta TEXT, payload_json JSONB
);
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON propostas FOR ALL USING (true);
```

### Usuários
```
rafael.weigand@salesbud.com.br   — admin (CEO)
joao.morais@salesbud.com.br      — admin
caio.barbosa@salesbud.com.br     — vendedor
carol.almeida@salesbud.com.br    — vendedor
eduardo.zarur@salesbud.com.br    — vendedor
fabio.daux@salesbud.com.br       — vendedor
gabrielle.garcia@salesbud.com.br — vendedor
isabelle.nied@salesbud.com.br    — vendedor
lilian.lopes@salesbud.com.br     — vendedor
luana.bonin@salesbud.com.br      — vendedor
lucas.winter@salesbud.com.br     — vendedor
matheus.weigand@salesbud.com.br  — vendedor
```

---

## Changelog completo

### Sessão 16-17/03/2026

#### Make — automação completa
1. PDF corrompido → Advanced Settings: Convert Google Slides to PDF
2. Slides errados → API Call batchUpdate com deleção condicional por plano
3. Email rascunho → Send Email com Raw HTML + template para cliente
4. Link editável → módulo Tools Set Variable com URL pré-montada
5. Variáveis por plano → preco_setup_basico (dinâmico) + hardcode nos slides 13/14
6. Toggle "Todos os planos" → Resume error handler pula deleção
7. Webhook Response atualizado com slides_url e pdf_url
8. Scheduling ativado: Immediately as data arrives
9. Pasta compartilhada: Qualquer pessoa com o link = Editor

#### App (Claude Code)
1. Botão Baixar PDF funcional via webhook response (depois removido — redundante)
2. Lógica CRM nativo vs API aberta no pricing (isCrmNativo())
3. Histórico: seleção em massa + filtro por período
4. Timeout 60s + feedback progressivo no botão
5. Toggle "Plano específico / Todos os planos"
6. Payload com preco_setup_basico e total_avancado
7. CRM obrigatório + lista customizável por admin
8. Ajustes visuais: "Sob consulta" negrito, botões texto, redesign Base, dropdown perfil, grid 3 colunas, badge sem redundância

#### Template Google Slides
1. {{preco_setup}} → {{preco_setup_basico}} no slide 12
2. Hardcode R$1.200/R$3.000 e fees nos slides 13/14
3. {{total_avancado}} no slide 14
4. {{crm_cliente}} adicionado em todos os slides de proposta
