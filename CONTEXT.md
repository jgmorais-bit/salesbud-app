# CONTEXT.md — SalesBud Propostas

> Gerado em 2026-03-15. Documenta o estado do projeto após a sessão de refatoração.

---

## Projeto

**Nome:** SalesBud Propostas
**Repositório:** https://github.com/jgmorais-bit/salesbud-app
**Deploy:** GitHub Pages — branch `main`, root `/`
**URL pública:** https://jgmorais-bit.github.io/salesbud-app/
**Arquivo único:** `index.html` (~2170 linhas, ~196KB, sem build step)

---

## Arquitetura

- **SPA single-file**: todo CSS, JS e HTML inline em `index.html`
- **Persistência**: `localStorage` (sem backend próprio)
- **Auth**: localStorage + tela de setup no primeiro acesso (sem senha hardcoded)
- **Backend opcional**: Supabase JS SDK via CDN (histórico compartilhado)
- **Geração de proposta**: webhook n8n (POST JSON)
- **Export CSV**: SheetJS via CDN

### Telas (`screen`)
| ID | Função |
|----|--------|
| `#screen-setup` | Primeiro acesso — configuração de senhas |
| `#screen-login` | Login de usuários |
| `#screen-app` | Aplicação principal |

### Páginas dentro do app (`page`)
| ID | Função |
|----|--------|
| `#page-proposta` | Gerador de proposta (tab principal) |
| `#page-base` | Calculadora de preço base |
| `#page-historico` | Histórico de propostas |
| `#page-usuarios` | Gestão de usuários |
| `#page-config` | Configurações (webhook, Supabase, validade, desconto máximo) |

---

## O que foi feito nesta sessão

### Bugs corrigidos
1. **TypeError `#desconto`** — elemento não existia no HTML; adicionado `<input type="hidden" id="desconto" value="0">` e `<span id="desc-label">0%</span>`
2. **TypeError `#base-desconto`** — mesmo problema na aba Base; adicionado `<input type="hidden" id="base-desconto" value="0">`
3. **TypeError `#whats-card`** — `update()` referenciava elemento removido; bloco JS removido junto com o elemento
4. **ReferenceError `propFonte`** — variável local chamada `pf` mas usada como `propFonte` em template literals; corrigido para `${pf}`
5. **`resetStateBase()` não resetava desconto** — adicionado `['base-desconto','0']` ao loop de reset e reset explícito do label

### Segurança
- Removidas todas as senhas hardcoded do array `DB.users` (campo `senha: null` para todos)
- Implementada tela `#screen-setup` de primeiro acesso
- Auth via base64 (`_h()`) armazenado em localStorage — sem credenciais no código-fonte
- Erros Supabase agora exibem `showToast()` além de `console.warn`

### Funcionalidades / UX
- Validação em tempo real com `_dirty` flag (só exibe erro após blur no campo empresa)
- Validação de formato de e-mail em tempo real
- Tela de setup com validação: mínimo 1 admin com senha ≥ 6 caracteres

### Planos de Integração CRM (renomeados)
| Chave | Nome anterior | Nome atual |
|-------|--------------|------------|
| `basico` | Lite | Básico |
| `intermediario` | Premium | Intermediário |
| `avancado` | *(novo)* | Avançado |

### Visual
- Grid dos cards de integração: `1fr 1fr` → `repeat(3, 1fr)` (3 colunas)
- Removido card `#whats-card` do painel direito
- Redesign do breakdown: tipografia hierárquica, totais destacados
- Scope items com highlight âmbar para itens "Sob consulta"

### Deploy
- Repositório criado: `jgmorais-bit/salesbud-app`
- GitHub Pages ativado na branch `main`

---

## Estado atual

### Objetos de configuração

```javascript
const CONFIG_DEFAULT = {
  webhookUrl: 'https://SEU-N8N.com/webhook/gerar-proposta',
  templateUrl: '',
  templateVersao: '',
  validadeProposta: 15,
  descontoMax: 10,
  supabaseUrl: '',
  supabaseKey: ''
};
```

### Planos de integração CRM

```javascript
const INTEG = {
  basico: {
    nome: 'Básico', setup: 0, fee: 0,
    tag: 'tag-basico', label: 'Somente notas e observações',
    scope: [
      'Preenchimento de notas e observações no CRM',
      'CRM Nativos SalesBud ou CRM com API aberta',
      'Sob consulta de viabilidade técnica',
      'SLA: 3 a 6 semanas'
    ]
  },
  intermediario: {
    nome: 'Intermediário', setup: 1200, fee: 0,
    tag: 'tag-intermediario', label: 'Até 5 campos personalizados',
    scope: [
      'Tudo do Básico',
      'Preenchimento de até 5 campos personalizados',
      // ...
    ]
  },
  avancado: {
    nome: 'Avançado', setup: 3000, fee: 499,
    tag: 'tag-intermediario', label: '10 campos + tarefas + 2 pipelines',
    scope: [
      'Tudo do Intermediário',
      'Preenchimento de até 10 campos personalizados',
      'Criação de tarefas no CRM',
      'Integração com até 2 pipelines',
      // ...
    ]
  }
};
```

### WhatsApp tiers

```javascript
const WHATS_TIERS = [
  { min: 1,  max: 5,   preco: 100 },
  { min: 6,  max: 10,  preco: 90  },
  { min: 11, max: 20,  preco: 80  },
  { min: 21, max: 30,  preco: 70  },
  { min: 31, max: 50,  preco: 60  },
  { min: 51, max: 999, preco: 50  }
];
```

### Tabela de horas

- `TABELA_VERSION = 4`
- `TABELA_HORAS_DEFAULT` — array de tiers `{ horas, preco }` usados por `calcPrecoExato(horas)`
- Editável pelo usuário em `#page-base`; salvo em `localStorage` sob a chave `salesbud_tabela_v1`

### Usuários (DB.users)

12 usuários pré-cadastrados, todos com `senha: null`. Senhas configuradas na primeira vez que o app é aberto via `#screen-setup`. Admins: Rafael Weigand, João Guilherme Morais (e outros conforme `perfil:'admin'`).

---

## Variáveis de ambiente / configs (localStorage)

| Chave | Conteúdo |
|-------|----------|
| `salesbud_users_v1` | JSON com array `users` (inclui hashes de senha) e `nextId` |
| `salesbud_config_v1` | JSON com `CONFIG_DEFAULT` sobrescrito pelo usuário |
| `salesbud_tabela_v1` | JSON com tabela de horas customizada |
| `salesbud_hist_v1` | Array de propostas salvas localmente |
| `salesbud_session` | `{userId, nome, perfil}` do usuário logado |

---

## Funções críticas

| Função | Descrição |
|--------|-----------|
| `_h(s)` | `btoa(unescape(encodeURIComponent(s)))` — "hash" base64 para senhas |
| `_c(plain, stored)` | Compara senha digitada com hash armazenado |
| `loadUsersLocal()` | Mescla hashes do localStorage nos objetos `DB.users` |
| `saveUsersLocal()` | Persiste `DB.users` (com hashes) no localStorage |
| `mostrarSetup()` | Renderiza tela de primeiro acesso com inputs de senha |
| `concluirSetup()` | Valida e salva senhas; redireciona para login |
| `navTo(page)` | Navegação SPA — toggle `.page.active` |
| `update()` | Recalcula e re-renderiza o painel direito completo |
| `updateBase()` | Recalcula e re-renderiza o painel de preço base |
| `calcPrecoExato(horas)` | Interpola preço entre tiers por hora do tier inferior |
| `getTabelaAtiva()` | Retorna tabela customizada do localStorage ou `TABELA_HORAS_DEFAULT` |
| `checkHubSpotPrefill()` | Lê `?deal_id=` na URL e chama webhook com `_action:'hubspot_prefill'` |
| `histAdd(prop)` | Salva proposta no histórico local e opcionalmente no Supabase |
| `renderHistorico()` | Renderiza tabela de histórico (local + Supabase) |
| `exportHistorico()` | Exporta histórico como CSV via SheetJS |

---

## TODO / melhorias futuras

- [ ] Substituir base64 por hashing real (bcrypt/argon2) se o backend for adicionado
- [ ] Separar JS em módulos (hoje tudo inline por restrição de single-file)
- [ ] Adicionar campo de busca/filtro no histórico
- [ ] Preview da proposta antes de enviar ao webhook
- [ ] Modo escuro
- [ ] Testes automatizados (hoje zero cobertura)
- [ ] Internacionalização (hoje hardcoded em PT-BR)
