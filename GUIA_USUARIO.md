# SalesBud Propostas — Guia do Usuário

## Acesso

1. Abra: **https://jgmorais-bit.github.io/salesbud-app**
2. Faça login com seu email @salesbud.com.br e a senha fornecida
3. Na primeira vez, troque sua senha: clique no seu avatar (canto inferior esquerdo) → **Alterar senha**

## Esqueci minha senha

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Digite seu email e clique **"Enviar link de recuperação"**
3. Verifique sua caixa de entrada (e spam) — chegará um email do Supabase Auth
4. Clique no link do email → defina uma nova senha

---

## Gerar Proposta (Novos Clientes)

### Passo 1 — Dados do cliente
- Preencha o **nome da empresa** (obrigatório)
- Preencha nome e email do contato
- Selecione o **CRM** utilizado pelo cliente (obrigatório)

### Passo 2 — Pacote de horas
- Selecione as horas mensais ou use a **calculadora de consumo** (usuários × horas/dia × dias úteis)
- O sistema calcula automaticamente o preço conforme a tabela

### Passo 3 — Integração CRM
- Escolha entre **Plano específico** ou **Todos os planos**
- Se plano específico: selecione Básico, Intermediário ou Avançado
- O preço do setup varia conforme o CRM:
  - CRM nativo (HubSpot, Pipedrive, RD Station) → Básico gratuito
  - Outros CRMs → Básico R$ 1.200

### Passo 4 — WhatsApp (opcional)
- Ative se o cliente quer WhatsApp
- Informe o número de usuários — o preço por usuário é calculado automaticamente

### Passo 5 — Desconto (opcional)
- Selecione 0%, 5% ou 10%
- Descontos acima de 10% requerem aprovação

### Passo 6 — Gerar proposta
- Clique em **"Gerar Proposta"**
- Aguarde o processamento (até 60 segundos)
- O botão mostra o progresso: Enviando → Gerando apresentação → Exportando PDF → Quase lá
- Quando concluído, você receberá um **email** com:
  - PDF da proposta em anexo
  - Link para editar a apresentação no Google Slides
  - Modelo de email sugerido para enviar ao cliente

---

## Gerar Proposta de Upsell (Clientes de Base)

Funciona de forma similar, mas inclui:
- **Dados do consumo atual** do cliente (horas, usuários, valor pago)
- **Diagnóstico** com perguntas sobre CRM, VoIP, WhatsApp, etc.
- **Comparativo** Atual vs Proposta com delta de horas e valor
- Proposta gerada como "upsell_base" no histórico

---

## Histórico

- Veja todas as propostas geradas pela equipe
- **Filtros**: por tipo (Novo/Base), vendedor, e período (3/7/15/30/90 dias)
- **Busca**: por empresa ou vendedor
- **Seleção em massa**: marque propostas → exclua ou exporte CSV
- **Editar**: altere dados de uma proposta existente
- **Status**: Rascunho → Enviada → Ganha → Perdida

---

## Dicas

- O PDF e o link editável chegam no seu email corporativo
- Use o **modelo de email sugerido** (no final do email recebido) para enviar ao cliente
- O link do Google Slides é editável — você pode personalizar antes de enviar
- Propostas são salvas automaticamente no histórico compartilhado
- Se a automação estiver indisponível, o app mostra instruções para envio manual

---

## Suporte

Em caso de problemas, contate o administrador:
- João Morais — joao.morais@salesbud.com.br
- Rafael Weigand — rafael.weigand@salesbud.com.br
