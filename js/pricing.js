/* ════════════════════════════════════════
   pricing.js — Tabelas de preco, calculos, WhatsApp, integracao, adicionais, CRM, VOIP
════════════════════════════════════════ */

/* ── Tabela de precos ── */
function getTabelaAtiva() {
  if (tabelaEditavel) return tabelaEditavel
  try {
    const s = JSON.parse(localStorage.getItem('salesbud_tabela') || 'null')
    if (s && s.length > 0) {
      tabelaEditavel = s
      return s
    }
  } catch {}
  tabelaEditavel = TABELA_HORAS_DEFAULT.map((t) => ({ ...t }))
  return tabelaEditavel
}
function getTabelaBaseAtiva() {
  if (tabelaBaseEditavel) return tabelaBaseEditavel
  try {
    const s = JSON.parse(localStorage.getItem('salesbud_tabela_base') || 'null')
    if (s && s.length > 0) {
      tabelaBaseEditavel = s
      return s
    }
  } catch {}
  tabelaBaseEditavel = TABELA_HORAS_BASE_DEFAULT.map((t) => ({ ...t }))
  return tabelaBaseEditavel
}
async function syncTabelaFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'tabela_precos')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && Array.isArray(data.valor) && data.valor.length > 0) {
      tabelaEditavel = data.valor
      try { localStorage.setItem('salesbud_tabela', JSON.stringify(data.valor)) } catch {}
      _tabelaSynced = true
      return
    }
  } catch (e) {
    console.warn('syncTabelaFromSupabase:', e.message)
  }
  _tabelaSynced = true
}
async function syncTabelaBaseFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'tabela_precos_base')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && Array.isArray(data.valor) && data.valor.length > 0) {
      tabelaBaseEditavel = data.valor
      try { localStorage.setItem('salesbud_tabela_base', JSON.stringify(data.valor)) } catch {}
      _tabelaBaseSynced = true
      return
    }
  } catch (e) {
    console.warn('syncTabelaBaseFromSupabase:', e.message)
  }
  _tabelaBaseSynced = true
}
function calcPrecoExato(horas, modulo) {
  const tabSrc = modulo === 'base' ? getTabelaBaseAtiva() : getTabelaAtiva()
  const tab = tabSrc.map((t) => ({ ...t, precoHora: t.preco / t.horas }))
  if (!horas || horas <= 0) return { precoEfetivo: 0, precoHora: 0, tierIdx: 0, horasEfetivas: 0, exato: false }
  const ul = tab[tab.length - 1],
    ie = tab.findIndex((t) => t.horas === horas)
  if (ie !== -1)
    return { precoEfetivo: tab[ie].preco, precoHora: tab[ie].precoHora, tierIdx: ie, horasEfetivas: horas, exato: true }
  if (horas > ul.horas)
    return {
      precoEfetivo: Math.round(horas * ul.precoHora),
      precoHora: ul.precoHora,
      tierIdx: tab.length - 1,
      horasEfetivas: horas,
      exato: false,
      acimaDaTabela: true
    }
  let tierRef = tab[0],
    tierIdx = 0
  for (let i = tab.length - 1; i >= 0; i--) {
    if (tab[i].horas < horas) {
      tierRef = tab[i]
      tierIdx = i
      break
    }
  }
  return {
    precoEfetivo: Math.round(horas * tierRef.precoHora),
    precoHora: tierRef.precoHora,
    tierIdx,
    horasEfetivas: horas,
    exato: false,
    interpolado: true
  }
}

/* ── WhatsApp ── */
function getWhatsFaixas() {
  if (_whatsFaixas) return _whatsFaixas
  try {
    const s = JSON.parse(localStorage.getItem(WA_CACHE_KEY) || 'null')
    if (s && s.length > 0) { _whatsFaixas = s; return s }
  } catch {}
  _whatsFaixas = WHATSAPP_FAIXAS_DEFAULT.map((f) => ({ ...f }))
  return _whatsFaixas
}
async function syncWhatsappFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'whatsapp_faixas')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && Array.isArray(data.valor) && data.valor.length > 0) {
      _whatsFaixas = data.valor
      try { localStorage.setItem(WA_CACHE_KEY, JSON.stringify(data.valor)) } catch {}
    }
  } catch (e) {
    console.warn('syncWhatsappFromSupabase:', e.message)
  }
}
function getWhatsPrice(u) {
  const faixas = getWhatsFaixas()
  const tier = faixas.find((t) => u >= t.min && (t.max == null || u <= t.max))
  return tier ? tier.preco : (faixas[faixas.length - 1]?.preco || 75)
}
function getTotalWhats(u) {
  return getWhatsPrice(u) * u
}

/* ── Integracao precos ── */
function getIntegPrecos() {
  if (_integPrecos) return _integPrecos
  try {
    const s = JSON.parse(localStorage.getItem(INTEG_PRECOS_KEY) || 'null')
    if (s && typeof s === 'object') { _integPrecos = { ...INTEG_PRECOS_DEFAULT, ...s }; return _integPrecos }
  } catch {}
  _integPrecos = { ...INTEG_PRECOS_DEFAULT }
  return _integPrecos
}
async function syncIntegPrecosFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'integracao_precos')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && typeof data.valor === 'object') {
      _integPrecos = { ...INTEG_PRECOS_DEFAULT, ...data.valor }
      try { localStorage.setItem(INTEG_PRECOS_KEY, JSON.stringify(_integPrecos)) } catch {}
    }
  } catch (e) {
    console.warn('syncIntegPrecosFromSupabase:', e.message)
  }
}

/* ── Calculo modular de integracao (compartilhado) ── */
function calcIntegModular(s) {
  const ip = getIntegPrecos()
  const isRd = (s.crm || '').toLowerCase() === 'rd station'
  const setupCrm = s.crm && !isCrmNativo(s.crm) ? ip.crm_personalizado_setup : 0
  const setupRegras = s.integRegras ? ip.personalizacao_regras_setup : 0
  const setupPipelines = (s.integPipelines || 0) * ip.pipeline_adicional_setup
  const setupTarefas = s.integTarefas ? ip.tarefas_auto_setup : 0
  const blocosC = ip.campos_custom_bloco > 0 ? Math.ceil((s.integCampos || 0) / ip.campos_custom_bloco) : 0
  let setupCampos = blocosC * ip.campos_custom_setup_por_bloco
  const mrrTarefas = s.integTarefas ? ip.tarefas_auto_mrr : 0
  let mrrCampos = blocosC * ip.campos_custom_mrr_por_bloco
  if (isRd && (s.integCampos || 0) > 0) { setupCampos = 0; mrrCampos = 0 }
  const setupTotal = setupCrm + setupRegras + setupPipelines + setupTarefas + setupCampos
  const mrrInteg = mrrTarefas + mrrCampos
  return { ip, isRd, setupCrm, setupRegras, setupPipelines, setupTarefas, setupCampos, blocosC, mrrTarefas, mrrCampos, setupTotal, mrrInteg }
}
function calcAdicionaisMrr(s) {
  const cfg = getAdicionaisConfig()
  let mrr = 0
  const ativos = []
  let total = 0
  for (const [k, v] of Object.entries(cfg)) {
    if (v.ativo && v.mrr > 0 && s.adicionais && s.adicionais[k]) {
      ativos.push(v.label + ' ' + fmt(v.mrr) + '/mês')
      total += v.mrr
    }
  }
  return { cfg, mrr: total, ativos, total }
}

/* ── Adicionais ── */
function getAdicionaisConfig() {
  if (_adicionaisConfig) return _adicionaisConfig
  try {
    const s = JSON.parse(localStorage.getItem(ADICIONAIS_KEY) || 'null')
    if (s && typeof s === 'object') {
      const merged = {}
      for (const k of Object.keys(ADICIONAIS_DEFAULT)) {
        merged[k] = s[k] ? { ...ADICIONAIS_DEFAULT[k], ...s[k] } : { ...ADICIONAIS_DEFAULT[k] }
      }
      for (const k of Object.keys(s)) {
        if (!merged[k]) merged[k] = s[k]
      }
      _adicionaisConfig = merged
      return merged
    }
  } catch {}
  _adicionaisConfig = JSON.parse(JSON.stringify(ADICIONAIS_DEFAULT))
  return _adicionaisConfig
}
async function syncAdicionaisFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'adicionais_config')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && typeof data.valor === 'object') {
      _adicionaisConfig = null
      try { localStorage.setItem(ADICIONAIS_KEY, JSON.stringify(data.valor)) } catch {}
      _adicionaisConfig = null
      getAdicionaisConfig()
    }
  } catch (e) {
    console.warn('syncAdicionaisFromSupabase:', e.message)
  }
}

/* ── CRM list ── */
function getCrmList() {
  try {
    const raw = localStorage.getItem(CRM_LIST_KEY)
    return raw ? JSON.parse(raw) : [...CRM_DEFAULT]
  } catch {
    return [...CRM_DEFAULT]
  }
}
function saveCrmList(list) {
  try { localStorage.setItem(CRM_LIST_KEY, JSON.stringify(list)) } catch {}
  if (supabaseClient) {
    supabaseClient
      .from('configuracoes')
      .upsert({ chave: 'crm_list', valor: list }, { onConflict: 'chave' })
      .then(({ error }) => { if (error) console.warn('saveCrmList Supabase:', error.message) })
      .catch((e) => console.warn('saveCrmList Supabase:', e.message))
  }
}
async function syncCrmFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'crm_list')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && Array.isArray(data.valor) && data.valor.length > 0) {
      try { localStorage.setItem(CRM_LIST_KEY, JSON.stringify(data.valor)) } catch {}
      populateCrmDropdowns()
    }
  } catch (e) {
    console.warn('syncCrmFromSupabase:', e.message)
  }
}
function populateCrmDropdowns() {
  const list = getCrmList()
  ;['crm', 'base-crm'].forEach((id) => {
    const sel = document.getElementById(id)
    if (!sel) return
    const prev = sel.value
    sel.innerHTML =
      '<option value="">Selecione o CRM</option>' +
      list
        .map((c) =>
          c === 'CRM com API aberta'
            ? '<option value="api-aberta">CRM com API aberta</option>'
            : `<option>${c}</option>`
        )
        .join('')
    if (prev) sel.value = prev
  })
}

/* ── VOIP list ── */
function getVoipList() {
  try {
    const raw = localStorage.getItem(VOIP_LIST_KEY)
    return raw ? JSON.parse(raw) : [...VOIP_DEFAULT]
  } catch {
    return [...VOIP_DEFAULT]
  }
}
function saveVoipList(list) {
  try { localStorage.setItem(VOIP_LIST_KEY, JSON.stringify(list)) } catch {}
  if (supabaseClient) {
    supabaseClient
      .from('configuracoes')
      .upsert({ chave: 'voip_list', valor: list }, { onConflict: 'chave' })
      .then(({ error }) => { if (error) console.warn('saveVoipList Supabase:', error.message) })
      .catch((e) => console.warn('saveVoipList Supabase:', e.message))
  }
}
async function syncVoipFromSupabase() {
  if (!supabaseClient) return
  try {
    const { data, error } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'voip_list')
      .maybeSingle()
    if (error) throw error
    if (data?.valor && Array.isArray(data.valor) && data.valor.length > 0) {
      try { localStorage.setItem(VOIP_LIST_KEY, JSON.stringify(data.valor)) } catch {}
    }
  } catch (e) {
    console.warn('syncVoipFromSupabase:', e.message)
  }
}

/* ── Formatacao ── */
const fmt = (v) => (v == null || isNaN(v) ? 'Sob consulta' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 }))
