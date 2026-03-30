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

## Gerar Proposta (Novos Clientes)

### Passo 1 -- Dados do cliente
- Preencha o **nome da empresa** (obrigatorio)
- Preencha nome e email do contato
- Selecione o **CRM** utilizado pelo cliente (obrigatorio)
  - CRM Nativo (HubSpot, Pipedrive, RD Station): setup gratuito
  - CRM Personalizado (qualquer outro): setup R$ 600

### Passo 2 -- Pacote de horas
- Informe as horas mensais desejadas
- O sistema calcula automaticamente o preco conforme a tabela (50h a 1000h)
- Faixas intermediarias sao calculadas por interpolacao

### Passo 3 -- Integracao CRM
Configure os componentes de integracao conforme a necessidade do cliente:

- **Personalizacao de Regras**: Padrao (gratuito) ou Personalizada (setup R$ 900). Passe o mouse no icone ? para ver o escopo de cada opcao.
- **Pipelines adicionais**: quantidade de pipelines alem do primeiro incluso (setup R$ 400/cada)
- **Tarefas Automaticas**: criacao automatica de proximos passos (setup R$ 100 + R$ 50/mes)
- **Campos Personalizados**: preenchidos por IA, cobrados em blocos de 5 (setup + MRR R$ 100/bloco). Clientes RD Station: isentos.
- **VOIP**: selecione o VOIP do cliente. Listados sao inclusos. Nao-listados: consultar time de Servicos.

### Passo 4 -- WhatsApp
- Ative/desative o WhatsApp
- Informe a quantidade de usuarios
- Preco por usuario conforme faixa (tabela visivel no app)

### Passo 5 -- Adicionais
- Se o admin ativou adicionais (ex: Contas-Enriquecimento, Chat com Bud), eles aparecerao aqui
- Ative os que o cliente deseja -- o valor MRR e somado ao total

### Passo 6 -- Gerar
- Confira o resumo no painel direito: MRR total + Setup total
- Clique **"Gerar Proposta"**
- O sistema gera a apresentacao em Google Slides, exporta PDF e envia por email

---

## Gerar Proposta (Clientes de Base)

### Passo 1 -- Dados do cliente + Diagnostico
- Preencha empresa, CRM, contato
- Informe horas e valor atuais do cliente
- Preencha o diagnostico: CRM, VOIP, WhatsApp, CS

### Passo 2 -- Configurar proposta
- Selecione o pacote de horas proposto
- Selecione o plano de integracao (Basico, Intermediario ou Avancado)
- Configure WhatsApp

### Passo 3 -- Gerar
- Confira o comparativo Atual x Proposta
- Clique **"Gerar Proposta de Upsell"**

---

## Historico

- Todas as propostas geradas ficam no historico compartilhado
- Use os filtros para buscar por empresa, tipo, vendedor ou periodo
- Altere o status: Enviada -> Negociacao -> Aprovada ou Perdida
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
| Tabela de precos | Pacotes de horas e valores (50h-1000h) |
| Faixas WhatsApp | Faixas de preco por quantidade de usuarios |
| CRMs disponiveis | Lista de CRMs (3 nativos + customizados) |
| VOIPs disponiveis | Lista de VOIPs inclusos (12 padrao + customizados) |
| Precos de integracao | Setup e MRR de cada componente |
| Adicionais opcionais | Ativar/desativar e definir MRR de cada adicional |

**Importante:** apos alterar qualquer configuracao, clique **Salvar**. As mudancas sao sincronizadas com o Supabase e ficam disponiveis para todos os vendedores.

### Primeira vez apos deploy
Abra a aba Configuracoes e clique Salvar em cada secao para popular as chaves no Supabase. Isso garante que todos os vendedores vejam os mesmos valores.
