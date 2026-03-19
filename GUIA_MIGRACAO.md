# Guia de Migração — Contas Pessoais → SalesBud Organizacional

> Documento de referência para quando decidir migrar as contas pessoais (Gmail, Google Drive, Google Cloud) para contas organizacionais SalesBud.

---

## Resumo

Hoje o SalesBud Propostas usa contas pessoais do João Morais em vários serviços. Isso funciona, mas gera riscos: se a conta pessoal for comprometida, todo o sistema é afetado. A migração transfere tudo para contas @salesbud.com.br.

---

## O que precisa migrar

| Serviço | Conta atual (pessoal) | Conta futura (organizacional) | Prioridade |
|---|---|---|---|
| Google Cloud (OAuth) | joaomoraisrossler@gmail.com | admin@salesbud.com.br (ou similar) | Alta |
| Gmail (envio de propostas) | joaomoraisrossler@gmail.com | propostas@salesbud.com.br | Alta |
| Google Drive (template + PDFs) | joaomoraisrossler@gmail.com | propostas@salesbud.com.br | Alta |
| GitHub (repositório) | jgmorais-bit | org SalesBud (opcional) | Baixa |
| Make (automação) | joaomoraisrossler@gmail.com | admin@salesbud.com.br | Média |
| Supabase | jgmorais-bit (GitHub) | Manter ou migrar | Baixa |

---

## Pré-requisitos

1. **Google Workspace ativo** para o domínio salesbud.com.br
   - Plano Business Starter (~R$33/mês/usuário) é suficiente
   - Criar conta: `propostas@salesbud.com.br` (ou `noreply@salesbud.com.br`)
   - Essa conta será usada pro Gmail, Drive e Cloud

2. **Acesso admin** ao Google Workspace da SalesBud

3. **Backup** de tudo antes de começar

---

## Etapa 1 — Google Cloud (OAuth)

**Impacto**: Make não consegue conectar nos serviços Google sem OAuth.

### Passos:

1. Acesse https://console.cloud.google.com com a conta organizacional
2. Crie novo projeto: `salesbud-propostas-org`
3. Ative as APIs:
   - Google Drive API
   - Google Slides API
   - Gmail API
4. Crie credencial OAuth:
   - Tipo: Web Application
   - Nome: `Make - Salesbud`
   - Redirect URIs (copiar exatamente):
     ```
     https://www.integromat.com/oauth/cb/google
     https://www.make.com/oauth/cb/google
     https://hook.us2.make.com/oauth/cb/google
     https://www.integromat.com/oauth/cb/google-restricted
     ```
5. Configure tela de consentimento OAuth:
   - User type: Internal (se Google Workspace) ou External
   - Adicionar o email organizacional como usuário de teste
6. Anote o novo **Client ID** e **Client Secret**

### No Make:
1. Abra o cenário
2. Em cada módulo Google (Drive, Slides, Gmail):
   - Clique na conexão → **Add new connection**
   - Use o novo Client ID + Secret da conta organizacional
   - Autorize com a conta `propostas@salesbud.com.br`
3. Remapeie cada módulo para usar a nova conexão
4. Teste com Run Once

---

## Etapa 2 — Google Drive (template + pasta)

**Impacto**: Template e pasta de propostas mudam de dono.

### Passos:

1. Na conta pessoal, abra o Google Drive
2. **Template Google Slides** (`salesbud_template_v2_revisada`):
   - Clique com botão direito → Compartilhar → adicione `propostas@salesbud.com.br` como Editor
   - OU faça uma cópia na conta organizacional
   - Se fizer cópia: anote o novo Template ID e atualize no app (Configurações → Template URL)
3. **Pasta "Propostas Salesbud"**:
   - Compartilhe com `propostas@salesbud.com.br` como Editor
   - OU crie nova pasta na conta organizacional
   - Se nova pasta: atualize o Folder ID no módulo Google Drive Copy (3) do Make

### No Make:
1. Módulo 3 (Google Drive Copy): atualizar Folder ID se mudou
2. Módulo 4 (Google Slides Template): atualizar Template ID se mudou
3. Teste com Run Once

### No app:
1. Configurações → Template da Proposta → atualizar URL se mudou

---

## Etapa 3 — Gmail (envio de propostas)

**Impacto**: Emails passam a ser enviados de `propostas@salesbud.com.br`.

### Passos:

1. No Make, módulo Gmail (16):
   - Trocar conexão para a conta organizacional
   - O "From" muda automaticamente para o email da nova conta
2. Testar: gerar proposta → verificar se o email chega com remetente correto

### Benefícios:
- Emails vêm de @salesbud.com.br (mais profissional)
- Não usa mais conta pessoal do João
- Melhor deliverability (menos chance de ir pra spam)

---

## Etapa 4 — Make

**Impacto**: Conta do Make muda de dono.

### Opção A — Transferir cenário (recomendado):
1. Crie conta Make com email organizacional
2. No cenário atual: Export blueprint (JSON)
3. Na conta nova: Import blueprint
4. Reconfigurar todas as conexões (Google, Webhooks)
5. Atualizar webhook URL no app (Configurações)

### Opção B — Manter conta pessoal:
- Só trocar as conexões Google dentro dos módulos
- Mais simples, menos arriscado

---

## Etapa 5 — GitHub (opcional)

**Impacto**: Baixo. O repo é público e o GitHub Pages funciona igual.

### Se quiser migrar:
1. Crie organização no GitHub: `salesbud-tech` (ou similar)
2. Transfira o repositório: Settings → Transfer ownership
3. URL muda para: `salesbud-tech.github.io/salesbud-app`
4. Atualizar:
   - Supabase URL Configuration (Site URL + Redirect URLs)
   - Links internos no Make (email template)
   - Bookmark dos vendedores

### Se não quiser migrar:
- Nenhuma ação necessária. O repo funciona igual em `jgmorais-bit`.

---

## Etapa 6 — Supabase (opcional)

**Impacto**: Baixo. O Supabase não depende da conta Google.

### Se quiser migrar:
1. Crie nova organização no Supabase com email organizacional
2. Crie novo projeto
3. Exporte dados: `pg_dump` do banco atual
4. Importe no novo projeto
5. Atualize URL + anon key no CONFIG_DEFAULT do app.js
6. Recrie usuários no Auth do novo projeto

### Se não quiser migrar:
- Nenhuma ação necessária. Pode apenas adicionar o email organizacional como membro da organização no Supabase.

---

## Checklist pós-migração

- [ ] Google Cloud: novo projeto com OAuth configurado
- [ ] Google Drive: template acessível pela conta organizacional
- [ ] Google Drive: pasta de propostas acessível
- [ ] Gmail: emails saindo de @salesbud.com.br
- [ ] Make: todas as conexões usando conta organizacional
- [ ] Make: webhook URL atualizada (se mudou)
- [ ] App: Template URL atualizada (se mudou)
- [ ] App: Supabase URL/key atualizados (se mudou)
- [ ] Testar: gerar proposta completa end-to-end
- [ ] Testar: login de vendedor + gerar proposta
- [ ] Comunicar time: nova URL (se mudou)

---

## Riscos e rollback

| Risco | Mitigação |
|---|---|
| Make para de funcionar | Manter conexões pessoais como backup até validar as novas |
| Template não encontrado | Manter compartilhamento com conta pessoal até confirmar |
| Emails não chegam | Testar SPF/DKIM do domínio organizacional antes de migrar |
| Vendedores perdem acesso | Migrar em horário de baixo uso (noite/fim de semana) |
| Google Drive cheio | Conta Workspace tem 30 GB+ por usuário |

---

## Estimativa de tempo

| Etapa | Tempo estimado |
|---|---|
| Google Cloud (OAuth) | 30 min |
| Google Drive (template + pasta) | 15 min |
| Gmail (conexão Make) | 10 min |
| Make (reconfigurar) | 30 min |
| Testes end-to-end | 30 min |
| **Total** | **~2 horas** |

---

## Quando fazer

Recomendado quando:
- SalesBud tiver Google Workspace ativo
- O time já estiver usando o app há pelo menos 2 semanas (estabilidade confirmada)
- Num horário de baixo uso (sexta à noite ou fim de semana)
