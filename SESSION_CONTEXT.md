# SESSION_CONTEXT.md — SalesBud Propostas
> Gerado em 2026-03-16. Use como "save game" para retomar o projeto.

---

## Projeto

- **Arquivo único:** `index.html` (~2230 linhas, sem build step)
- **Repositório:** https://github.com/jgmorais-bit/salesbud-app
- **Deploy:** GitHub Pages — branch `main`, root `/`
- **URL pública:** https://jgmorais-bit.github.io/salesbud-app/

---

## Git — estado atual

```
14833d3 refactor: generaliza menções de n8n para automação genérica
6571ea4 style: sob consulta último no escopo, cor padrão negrito
6db46f9 security: SHA-256 auth, XSS fix, loadConfig cache, error propagation
d84aabd feat: botões histórico com texto, controle de acesso por perfil, redesign Clientes de Base
3864209 feat: sessão persistente, dropdown perfil, card horas discreto, badge sem redundância
```

Branch `main` sincronizada com `origin/main`. Nenhuma alteração pendente.

---

## Decisões tomadas nesta sessão

### Segurança (commit 6db46f9)
- `_h`/`_c` migrado de base64 para **SHA-256 async** via `crypto.subtle.digest`
- `loadUsersLocal` valida hash com regex `/^[0-9a-f]{64}$/` — hashes base64 antigos são rejeitados silenciosamente → tela de setup reaparece automaticamente para reconfigurar senhas (**comportamento esperado**)
- Removida injeção de usuário via `id > 12` no localStorage
- `fazerLogin`, `concluirSetup`, `salvarUsuario` tornados `async` (cascade de `_h` async)
- `loadConfig` com `_cfgCache` (memoização) — evita `JSON.parse` a cada keystroke
- `saveConfig` com `catch` que exibe toast em vez de falhar silenciosamente
- `baixarPDF`: `esc()` aplicado em todas as variáveis de input do usuário (XSS fix)
- `gerarProposta`/`gerarPropostaBase`: catch do `JSON.parse` agora faz early return + toast

### Visual / UX (commits d84aabd, 3864209, 6571ea4)
- Card "Horas fora da tabela": fundo `var(--bg)`, borda `var(--border)`, layout em linha, sem verde
- Badge do plano CRM: sem redundância de nome
- Botões Editar/Excluir no histórico: com texto (não só ícone)
- Controle de acesso: vendedores não veem `#nav-usuarios` nem `#nav-config`; guard em `navTo()`
- Dropdown de perfil no avatar da sidebar (`#profile-menu`)
- Sessão persistente: `SESSION_TTL_SHORT` (8h) / `SESSION_TTL_LONG` (30 dias) + checkbox "Manter conectado" + pré-preenchimento de email
- Reorganização visual da aba Clientes de Base: left-col com formulário, right-col sticky com breakdown
- Escopo INTEG: "Sob consulta de viabilidade técnica" movido para **último item** em todos os planos, renderizado com `font-weight:700` e cor padrão (sem âmbar)

### Webhook (commit 14833d3)
- Todas as menções a "n8n" substituídas por linguagem genérica
- `CONFIG_DEFAULT.webhookUrl` = `'https://hook.make.com/seu-webhook'`
- Sentinels JS (5 ocorrências) trocados de `.includes('SEU-N8N')` → `=== CONFIG_DEFAULT.webhookUrl`

---

## Estado atual do código — trechos críticos

### Auth
```javascript
// Linha ~1794
async function _h(s){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function _c(plain,stored){return stored&&await _h(plain)===stored;}

// loadUsersLocal — só aceita SHA-256 de 64 hex chars
if(u&&s.senha&&/^[0-9a-f]{64}$/.test(s.senha))u.senha=s.senha;
```

### Config com cache
```javascript
// Linha ~2001
let _cfgCache=null;
function loadConfig(){if(_cfgCache)return _cfgCache;...}
function saveConfig(p){_cfgCache=null;...}
```

### Webhook sentinel
```javascript
// Verificação de "não configurado" — em gerarProposta, gerarPropostaBase, initConfig, testarWebhook, checkHubSpotPrefill
if(!wh||wh===CONFIG_DEFAULT.webhookUrl){...}
```

### INTEG scope (ordem final)
```javascript
// Todos os planos seguem esta ordem:
// 1. Itens específicos do plano
// 2. 'CRM Nativos SalesBud ou CRM com API aberta'
// 3. 'SLA: 3 a 6 semanas'
// 4. 'Sob consulta de viabilidade técnica'  <- último
```

---

## localStorage — chaves

| Chave | Conteúdo |
|-------|----------|
| `salesbud_users_v1` | `{users, nextId}` — hashes SHA-256 (64 hex) |
| `salesbud_config` | `CONFIG_DEFAULT` sobrescrito pelo usuário |
| `salesbud_tabela` | Tabela de horas customizada |
| `salesbud_hist_v1` | Array de propostas locais |
| `salesbud_session` | `{userId, email, ts, ttl}` |
| `salesbud_last_email` | Último email para pré-preenchimento |

---

## TODO / próximos passos (backlog)

- [ ] Campo de busca/filtro no histórico
- [ ] Preview da proposta antes de enviar ao webhook
- [ ] Modo escuro
- [ ] Separar JS em módulos (restrição: single-file por enquanto)
- [ ] Testes automatizados (hoje zero cobertura)
