/* ════════════════════════════════════════
   config.js — Globais, constantes, defaults, Supabase init, sync functions
════════════════════════════════════════ */

/* ── Supabase ── */
let supabaseClient = null
function initSupabase() {
  if (supabaseClient) {
    updateDbStatus('connected')
    return true
  }
  const cfg = loadConfig()
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    updateDbStatus('disconnected')
    return false
  }
  try {
    supabaseClient = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)
    updateDbStatus('connected')
    return true
  } catch (e) {
    updateDbStatus('error')
    return false
  }
}
function updateDbStatus(state) {
  const dot = document.getElementById('db-status-dot'),
    lbl = document.getElementById('db-status-label')
  if (!dot) return
  dot.className = ''
  if (state === 'connected') {
    dot.classList.add('connected')
    if (lbl) lbl.textContent = 'Supabase conectado'
  } else if (state === 'error') {
    dot.classList.add('error')
    if (lbl) lbl.textContent = 'Erro no banco'
  } else {
    if (lbl) lbl.textContent = 'Apenas local'
  }
}
function isSupabaseAuthReady() {
  return !!(supabaseClient && supabaseClient.auth)
}
async function fetchPerfil(uid) {
  if (!supabaseClient) return null
  try {
    const { data, error } = await supabaseClient.from('perfis').select('*').eq('id', uid).single()
    if (error) throw error
    return data
  } catch (e) {
    console.warn('fetchPerfil:', e.message)
    return null
  }
}
async function fetchPerfilList() {
  if (!supabaseClient) return null
  try {
    const { data, error } = await supabaseClient.from('perfis').select('*').order('nome')
    if (error) throw error
    return data
  } catch (e) {
    console.warn('fetchPerfilList:', e.message)
    return null
  }
}

/* ── Config / localStorage ── */
const CONFIG_DEFAULT = {
  webhookUrl: 'https://hook.make.com/seu-webhook',
  webhookToken: '',
  templateUrl: '',
  templateVersao: '',
  supabaseUrl: 'https://nrmfjyjxppbbdpsfhcft.supabase.co',
  supabaseKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybWZqeWp4cHBiYmRwc2ZoY2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njk4NDksImV4cCI6MjA4OTM0NTg0OX0.v6i1MpJZbAnCEkQaAcildXeverlXZC5GaF-7tQK4CUY'
}
let _cfgCache = null
function loadConfig() {
  if (_cfgCache) return _cfgCache
  try {
    _cfgCache = { ...CONFIG_DEFAULT, ...JSON.parse(localStorage.getItem('salesbud_config') || '{}') }
    return _cfgCache
  } catch {
    return { ...CONFIG_DEFAULT }
  }
}
function saveConfig(p) {
  _cfgCache = null
  const m = { ...loadConfig(), ...p }
  try {
    localStorage.setItem('salesbud_config', JSON.stringify(m))
  } catch {
    showToast('Erro ao salvar configurações. Armazenamento cheio.', 'info')
  }
  saveConfigToSupabase(m).catch(() => {})
  return m
}
function getWebhookUrl() {
  return loadConfig().webhookUrl || CONFIG_DEFAULT.webhookUrl
}
function getWebhookHeaders() {
  const h = { 'Content-Type': 'application/json' }
  const t = loadConfig().webhookToken
  if (t) h['X-SalesBud-Token'] = t
  return h
}
async function syncConfigFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'app_config')
      .maybeSingle()
    if (error) throw error
    if (!data?.valor || typeof data.valor !== 'object') return
    _cfgCache = null
    const current = loadConfig()
    const { supabaseUrl, supabaseKey, ...remote } = data.valor
    const merged = { ...current, ...remote }
    try {
      localStorage.setItem('salesbud_config', JSON.stringify(merged))
    } catch {}
    _cfgCache = null
  } catch (e) {
    console.warn('syncConfigFromSupabase:', e.message)
  }
}
async function saveConfigToSupabase(configObj) {
  if (!supabaseClient) return
  try {
    const { supabaseUrl, supabaseKey, ...toSave } = configObj
    await supabaseClient.from('configuracoes').upsert({ chave: 'app_config', valor: toSave }, { onConflict: 'chave' })
  } catch (e) {
    console.warn('saveConfigToSupabase:', e.message)
  }
}

/* ── Users DB (fallback local) ── */
let DB = { users: [], nextId: 1 }
let currentUser = null,
  editingUserId = null
const USERS_KEY = 'salesbud_users_v1'
function loadUsersLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY))
    if (!saved) return
    if (saved.users && saved.users.length) {
      DB.users = saved.users
    }
    if (saved.nextId) DB.nextId = Math.max(DB.nextId, saved.nextId)
  } catch {}
}
function saveUsersLocal() {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify({ users: DB.users, nextId: DB.nextId }))
  } catch {}
}

/* ── Session ── */
const SESSION_KEY = 'salesbud_session'
const LAST_EMAIL_KEY = 'salesbud_last_email'
const SESSION_TTL_SHORT = 8 * 60 * 60 * 1000 /* 8 horas */
const SESSION_TTL_LONG = 30 * 24 * 60 * 60 * 1000 /* 30 dias */
function saveSession(user, ttl) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, email: user.email, ts: Date.now(), ttl }))
  } catch {}
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {}
}

/* ── Tabela de precos defaults ── */
const TABELA_HORAS_DEFAULT = [
  { horas: 50, preco: 449 },
  { horas: 70, preco: 499 },
  { horas: 100, preco: 599 },
  { horas: 150, preco: 799 },
  { horas: 200, preco: 990 },
  { horas: 250, preco: 1240 },
  { horas: 300, preco: 1490 },
  { horas: 350, preco: 1740 },
  { horas: 400, preco: 1990 },
  { horas: 450, preco: 2240 },
  { horas: 500, preco: 2490 },
  { horas: 550, preco: 2590 },
  { horas: 600, preco: 2690 },
  { horas: 650, preco: 2790 },
  { horas: 700, preco: 2890 },
  { horas: 750, preco: 2990 },
  { horas: 800, preco: 3190 },
  { horas: 850, preco: 3390 },
  { horas: 900, preco: 3590 },
  { horas: 950, preco: 3590 },
  { horas: 1000, preco: 3590 }
]
const TABELA_HORAS_BASE_DEFAULT = [
  { horas: 50, preco: 449 },
  { horas: 70, preco: 499 },
  { horas: 100, preco: 599 },
  { horas: 150, preco: 799 },
  { horas: 200, preco: 990 },
  { horas: 250, preco: 1240 },
  { horas: 300, preco: 1490 },
  { horas: 350, preco: 1740 },
  { horas: 400, preco: 1990 },
  { horas: 450, preco: 2240 },
  { horas: 500, preco: 2490 },
  { horas: 550, preco: 2590 },
  { horas: 600, preco: 2690 },
  { horas: 650, preco: 2790 },
  { horas: 700, preco: 2890 },
  { horas: 750, preco: 2990 },
  { horas: 800, preco: 3190 },
  { horas: 850, preco: 3390 },
  { horas: 900, preco: 3590 },
  { horas: 950, preco: 3590 },
  { horas: 1000, preco: 3590 }
]
let tabelaEditavel = null
let _tabelaSynced = false
let tabelaBaseEditavel = null
let _tabelaBaseSynced = false

/* ── Integracao legado (referencia) ── */
const INTEG = {
  basico: {
    nome: 'Básico',
    setup: 0,
    fee: 0,
    tag: 'tag-basico',
    label: 'Somente notas e observações',
    descricao: 'CRM Nativos SalesBud ou CRM com API aberta',
    scope: [
      'Preenchimento de notas e observações no CRM',
      'CRM Nativos SalesBud ou CRM com API aberta',
      'SLA: 3 a 6 semanas',
      'Sob consulta de viabilidade técnica'
    ]
  },
  intermediario: {
    nome: 'Intermediário',
    setup: 1200,
    fee: 0,
    tag: 'tag-intermediario',
    label: 'Até 5 campos personalizados',
    descricao: 'CRM Nativos SalesBud ou CRM com API aberta',
    scope: [
      'Tudo do Básico',
      'Preenchimento de até 5 campos personalizados',
      'CRM Nativos SalesBud ou CRM com API aberta',
      'SLA: 3 a 6 semanas',
      'Sob consulta de viabilidade técnica'
    ]
  },
  avancado: {
    nome: 'Avançado',
    setup: 3000,
    fee: 499,
    tag: 'tag-intermediario',
    label: '10 campos + tarefas + 2 pipelines',
    descricao: 'CRM Nativos SalesBud ou CRM com API aberta',
    scope: [
      'Tudo do Intermediário',
      'Preenchimento de até 10 campos personalizados',
      'Criação de tarefas no CRM',
      'Integração com até 2 pipelines',
      'SLA: 3 a 6 semanas',
      'Sob consulta de viabilidade técnica'
    ]
  }
}

/* ── WhatsApp faixas defaults ── */
const WHATSAPP_FAIXAS_DEFAULT = [
  { min: 1, max: 10, preco: 100 },
  { min: 11, max: 25, preco: 90 },
  { min: 26, max: 40, preco: 85 },
  { min: 41, max: 60, preco: 80 },
  { min: 61, max: null, preco: 75 }
]
let _whatsFaixas = null
const WA_CACHE_KEY = 'salesbud_whatsapp_faixas'

/* ── Integracao precos defaults ── */
const INTEG_PRECOS_DEFAULT = {
  crm_personalizado_setup: 600,
  personalizacao_regras_setup: 900,
  pipeline_adicional_setup: 400,
  tarefas_auto_setup: 100,
  tarefas_auto_mrr: 50,
  campos_custom_bloco: 5,
  campos_custom_setup_por_bloco: 100,
  campos_custom_mrr_por_bloco: 100
}
let _integPrecos = null
const INTEG_PRECOS_KEY = 'salesbud_integ_precos'

/* ── Adicionais defaults ── */
const ADICIONAIS_DEFAULT = {
  contas_enriquecimento: { label: 'Contas - Enriquecimento', mrr: 0, ativo: false },
  chat_com_bud: { label: 'Chat com Bud', mrr: 0, ativo: false }
}
let _adicionaisConfig = null
const ADICIONAIS_KEY = 'salesbud_adicionais'

/* ── CRM defaults ── */
const CRM_DEFAULT = [
  'HubSpot',
  'Pipedrive',
  'RD Station',
  'Salesforce',
  'Moskit',
  'Ploomes',
  'Notion',
  'Zoho CRM',
  'CRM com API aberta',
  'Outro',
  'Sem CRM'
]
const CRM_LIST_KEY = 'salesbud_crm_list'

/* ── VOIP defaults ── */
const VOIP_DEFAULT = [
  'Api4com',
  'HubSpot (calls API)',
  'Zenvia Voice',
  'Meetime',
  'Gravador VMC / Webex (Addiante)',
  'GoTo Connect',
  'Vono',
  'Zadarma',
  'UsCall',
  'Nvoip',
  'MBM PABX',
  'Simples IP'
]
const VOIP_LIST_KEY = 'salesbud_voip_list'

/* ── Template banner ── */
const BANNER_DISMISS_KEY = 'salesbud_banner_dismissed_ver'

/* ── Historico ── */
const HIST_KEY = 'salesbud_historico'
