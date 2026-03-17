# SalesBud Propostas — Context Document v4
> Última atualização: 16/03/2026 23h · Usar como briefing no início de cada nova sessão

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

---

## Estado atual

### Pronto e funcionando
- App no ar: https://jgmorais-bit.github.io/salesbud-app
- Login com admin/vendedor + sessão persistente (checkbox Manter conectado, TTL 8h/30 dias)
- Aba Novos Clientes — cálculo, breakdown, WhatsApp, desconto, payload
- Aba Clientes de Base — diagnóstico, comparativo, upsell
- Histórico com filtros, KPIs, export CSV, editar e excluir
- Configurações — webhook, Supabase, template, tabela de preços
- Fallback quando automação indisponível
- Botões Salvar proposta e Baixar PDF (PDF ainda não funcional — gera HTML temporário)
- Controle de acesso — vendedor não vê Usuários nem Configurações
- Payload com campo plano_integracao (basico/intermediario/avancado)
- Ajustes visuais implementados: "Sob consulta" negrito, botões texto no Histórico, redesign Clientes de Base, dropdown perfil avatar, grid CRM 3 colunas, badge plano sem redundância

### Make — fluxo 100% operacional (7 módulos)
Cenário: https://us2.make.com/2013800/scenarios/4420296/edit
Scheduling: ativo ("Immediately as data arrives")

```
Webhooks (1) → Google Drive Copy (3) → Google Slides Template (4) →
Google Slides API Call [delete slides] (14) → Google Drive Download/PDF (11) →
Gmail Send (16) → Webhooks Response (7)
```

- Módulo 1: **Webhooks** — Custom webhook ✅
- Módulo 3: **Google Drive** — Copy a File ✅
- Módulo 4: **Google Slides** — Create a Presentation From a Template ✅
- Módulo 14: **Google Slides** — Make an API Call (batchUpdate: deleta slides dos planos não selecionados) ✅
  - URL: `v1/presentations/{{4.Presentation ID}}:batchUpdate`
  - Body com if/else baseado em `1.plano_integracao` → deleta 2 dos 3 slides (p12/p13/p14)
- Módulo 11: **Google Drive** — Download a File (Advanced Settings: Convert Google Slides to PDF) ✅
- Módulo 16: **Gmail** — Send an Email ✅
  - Body type: Raw HTML
  - To: `1.vendedor_email`
  - Subject: `Proposta Salesbud - {{1.nome_empresa}}`
  - Link editável: `https://docs.google.com/presentation/d/{{4.Presentation ID}}/edit`
  - Attachment: `{{1.nome_empresa}}.pdf` com data de `11.Data`
- Módulo 7: **Webhooks** — Webhook Response ✅
  - Body JSON: `{ slides_url, pdf_url }` com `4.presentationId` e `11.Web Content Link`

### IDs dos slides de proposta no template
```
Slide 12 (Básico):        ID = p12
Slide 13 (Intermediário):  ID = p13
Slide 14 (Avançado):       ID = p14
```

---

## Pendências (ordem de prioridade)

### 1. [App] Botão "Baixar PDF" funcional
**Status**: O botão existe na UI mas gera HTML temporário. O webhook response do Make já retorna `pdf_url`.
**O que falta**: Quando gerarProposta() recebe response com sucesso, parsear o JSON e salvar `pdf_url` no state. O botão "Baixar PDF" deve abrir essa URL em nova aba. Aplicar nos dois módulos (Novos Clientes e Clientes de Base).

### 2. [App] Lógica CRM nativo vs API aberta
**Status**: Dropdown de CRM já tem opção "CRM com API aberta" + aviso. Mas o preço não muda.
**Regra**:
- CRMs nativos (HubSpot, Pipedrive, RD Station): Básico setup R$0 (grátis)
- Todos os outros CRMs: Básico setup R$1.200 (mesmo escopo de notas)
- Intermediário e Avançado: mantêm valores iguais independente do CRM
**O que falta**: Implementar lógica condicional em update()/updateBase() que altera setup do Básico quando CRM não-nativo, e atualiza visualmente o card + breakdown + payload.

### 3. [App] Configurar Supabase em produção

### 4. [HubSpot] Pinar URL nos deals

### 5. [Futuro] Migrar contas pessoais para conta SalesBud

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
// NOTA: quando CRM não-nativo, basico.setup deve ser 1200 (pendente implementação)
```

### Lógica CRM nativo vs API aberta (pendente implementação)
```
CRM nativo (HubSpot, Pipedrive, RD Station):
  → Básico: setup R$0, fee R$0, somente notas

CRM com API aberta / outros (Salesforce, Moskit, Ploomes, Notion, Zoho, Outro, Sem CRM):
  → Básico: setup R$1.200, fee R$0, somente notas (ou até 5 campos)
  → Intermediário: setup R$1.200, fee R$0, até 5 campos (sem mudança)
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
  "fee_manutencao": "R$ 499/mês | Não incluso",
  "preco_whatsapp": "R$ XXX/mês para X usuários | Não incluso",
  "total_geral_mes": "R$ X.XXX/mês",
  "detalhe_desconto": "Desconto de X% aplicado | Preço padrão",
  "preco_setup": "R$ X.XXX | Gratuito | Sob consulta",
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
  "plano_integracao": "basico | intermediario | avancado"
}
```

### Variáveis do template Google Slides
```
{{pacote_horas}}        → pacote_horas
{{preco_mensalidade}}   → preco_mensalidade
{{preco_setup}}         → preco_setup
{{fee_manutencao}}      → fee_manutencao
{{preco_whatsapp_user}} → calculado no Make
{{total_geral_mes}}     → total_geral_mes
{{nome_empresa}}        → nome_empresa (slide 15 capa)
{{vendedor_nome}}       → vendedor_nome (slide 15)
{{vendedor_email}}      → vendedor_email (slide 15)
```

### Estrutura do template Google Slides
```
Slides 1-11:  institucionais (fixos, não editar)
Slide 12:     Proposta Básico     (ID interno: p12)
Slide 13:     Proposta Intermediário (ID interno: p13)
Slide 14:     Proposta Avançado   (ID interno: p14)
Slide 15:     Capa personalizada (nome_empresa, vendedor_nome, vendedor_email)
              — deve ser o slide 1 para o cliente (reordenar no Drive)
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
Client ID: <GOOGLE_CLIENT_ID>
Client Secret: <GOOGLE_CLIENT_SECRET>
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

### Supabase SQL
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

## Changelog (sessão 16/03/2026)

### Make — 3 fixes críticos resolvidos
1. **PDF corrompido** → Google Drive Download: ativado Advanced Settings, "Convert Google Slides Files to Format: PDF"
2. **Slides errados** → Novo módulo Google Slides "Make an API Call" (14) com batchUpdate que deleta slides dos planos não selecionados baseado em `plano_integracao`
3. **Email rascunho → envio real** → Trocou "Create a Draft" por "Send an Email" (16) com Raw HTML, link editável do Slides, PDF como attachment

### Make — ajustes complementares
4. Webhook Response (7) atualizado com `4.presentationId` e `11.Web Content Link`
5. Scheduling ativado: "Immediately as data arrives"
6. Pasta compartilhada: "Qualquer pessoa com o link = Editor"
7. Template de email pro cliente configurado pelo vendedor diretamente

### Ajustes visuais (Claude Code — já implementados)
- "Sob consulta de viabilidade técnica" — último item do scope, cor preta negrito
- Botões Editar/Excluir no Histórico — texto simples em vez de emoji
- Redesign Clientes de Base — homogeneizar com Novos Clientes
- Dropdown de perfil no avatar — nome, cargo, Sair da conta
- Grid CRM 3 colunas iguais
- Badge do plano sem redundância
