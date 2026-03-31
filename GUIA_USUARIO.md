# SalesBud Propostas -- Guia do Usuario

## Acesso

1. Abra: **https://jgmorais-bit.github.io/salesbud-app**
2. Faca login com seu email @salesbud.com.br e a senha fornecida
3. Na primeira vez, troque sua senha: clique no seu avatar (canto inferior esquerdo) -> **Alterar senha**

## Esqueci minha senha

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Digite seu email e clique **"Enviar link de recuperacao"**
3. Verifique sua caixa de entrada (e spam) -- chegara um email do Supabase Auth
4. Clique no link do email -> defina uma nova senha

---

## Para AEs -- Gerar Proposta (Novos Clientes)

### Passo 1 -- Dados do cliente
- Preencha o **nome da empresa** (obrigatorio)
- Preencha nome e email do contato
- Selecione o **CRM** utilizado pelo cliente (obrigatorio)
  - CRM Nativo (HubSpot, Pipedrive, RD Station): setup gratuito
  - CRM Personalizado (qualquer outro): setup R$ 600

### Passo 2 -- Pacote de horas
- Informe as horas mensais desejadas (campo direto)
- Use a **Calculadora de Consumo** para estimar: Usuarios x Horas/dia x Dias uteis
- Clique "Usar esse valor" para aplicar a estimativa
- O sistema calcula automaticamente o preco conforme a tabela (50h a 1000h)

### Passo 3 -- Preenchimento Automatico de CRM
Configure os componentes de integracao conforme a necessidade do cliente. Passe o mouse no icone **?** de cada componente para ver o escopo e os precos:

- **Padrao / Personalizada**: Padrao (gratuito) ou Personalizada (setup R$ 900)
- **Pipelines adicionais**: quantidade de pipelines alem do primeiro incluso (setup R$ 400/cada)
- **Tarefas Automaticas**: criacao automatica de proximos passos (setup R$ 100 + R$ 50/mes)
- **Campos Personalizados**: preenchidos por IA, cobrados em blocos de 5 (setup + MRR R$ 100/bloco). Clientes RD Station: isentos.
- **VOIP**: selecione o VOIP do cliente. Listados sao inclusos. Nao-listados: consultar time de Servicos.

Dica: clique em **"Ver boas praticas"** para orientacoes sobre negociacao.

### Passo 4 -- WhatsApp
- Ative/desative o WhatsApp
- Informe a quantidade de usuarios
- Preco por usuario conforme faixa (tabela visivel no app)

### Passo 5 -- Adicionais
- Se o admin ativou adicionais (ex: Chat com Bud), eles aparecerao aqui
- Ative os que o cliente deseja -- o valor MRR e somado ao total

### Passo 6 -- Gerar
- Confira o **Breakdown** no painel direito: MRR total + Setup total com sub-itens detalhados
- Clique **"Gerar Proposta"**
- O sistema gera a apresentacao em Google Slides, exporta PDF e envia por email

---

## Para CS / Account Managers -- Proposta de Upsell (Clientes de Base)

### Passo 1 -- Dados do cliente
- Preencha empresa, CRM e contato

### Passo 2 -- Consumo Atual
Informe os dados atuais do cliente:
- **Horas contratadas**: pacote atual
- **Usuarios ativos**: quantidade de usuarios
- **Valor mensal pago**: mensalidade atual em R$
- **Usuarios WhatsApp contratados**: se o cliente ja usa WhatsApp

### Passo 3 -- Diagnostico
Preencha o diagnostico de adocao do cliente:
- **Integracao CRM ativa?** -> Se sim: CRM nativo? Campos personalizados?
- **Integracao VOIP?** -> Se sim: VOIP nativo? Campos no VOIP?
- **WhatsApp ativo?**

O painel direito mostra o **Score de Adocao** (/5) e as oportunidades de expansao.

### Passo 4 -- Novo Pacote de Horas
- Informe as **horas mensais adicionais** que o cliente precisa
- O sistema calcula: Atual + Adicional = Novo pacote total
- Use a Calculadora de Consumo: a estimativa desconta automaticamente as horas atuais
- Exemplo: Cliente tem 50h, calculadora estima 308h -> campo recebe 258h adicionais

### Passo 5 -- Integracao, WhatsApp e Adicionais
- Configure os mesmos componentes de Novos Clientes
- O diagnostico pode ajudar a pre-identificar oportunidades

### Passo 6 -- Conferir e Gerar
- Confira o **Comparativo Atual x Proposta** com o delta de valor
- Confira o **Breakdown** com todos os sub-itens
- Clique **"Gerar Proposta de Upsell"**

---

## Historico

- Todas as propostas geradas ficam no historico compartilhado
- Use os filtros para buscar por empresa, tipo, vendedor ou periodo
- Altere o status: Enviada -> Negociacao -> Aprovada ou Perdida (com motivo)
- Exporte para CSV ou edite detalhes (empresa, contato, observacao interna)

---

## Para Administradores

### Adicionar novos usuarios
1. Acesse o **Supabase Dashboard** (https://supabase.com/dashboard)
2. Va em **Authentication** -> **Add User**
3. Marque **"Auto Confirm User"**
4. O perfil e criado automaticamente pelo trigger

### Configuracoes (aba Configuracoes no app)

| Secao | O que configura |
|---|---|
| Supabase | URL e anon key (ja configurado) |
| Webhook | URL e token do Make |
| Template | URL e versao do template Google Slides |
| Tabela de precos (Novos) | Pacotes de horas e valores para Novos Clientes |
| Tabela de precos (Base) | Pacotes de horas e valores para Clientes de Base (editavel independentemente) |
| Faixas WhatsApp | Faixas de preco por quantidade de usuarios |
| CRMs disponiveis | Lista de CRMs (3 nativos protegidos + customizados) |
| VOIPs disponiveis | Lista de VOIPs inclusos |
| Precos de integracao | Setup e MRR de cada componente |
| Adicionais opcionais | Ativar/desativar e definir MRR de cada adicional |

**Importante:** apos alterar qualquer configuracao, clique **Salvar**. As mudancas sao sincronizadas com o Supabase e ficam disponiveis para todos os vendedores.

### Primeira vez apos deploy
Abra a aba Configuracoes e clique Salvar em cada secao para popular as chaves no Supabase. Isso garante que todos os vendedores vejam os mesmos valores.
