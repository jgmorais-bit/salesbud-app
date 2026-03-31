/* ════════════════════════════════════════
   admin.js — Supabase config, tabela editors, CRM/VOIP lists, integ precos, adicionais, WhatsApp config, import, usuarios CRUD
════════════════════════════════════════ */

/* ── Supabase config ── */
async function salvarSupabase() {
  const url = document.getElementById('cfg-supabase-url').value.trim(),
    key = document.getElementById('cfg-supabase-key').value.trim()
  if (!url || !key) {
    showToast('Preencha URL e Anon Key.', 'info')
    return
  }
  saveConfig({ supabaseUrl: url, supabaseKey: key })
  supabaseClient = null
  initSupabase()
  await testarSupabase()
}
async function testarSupabase() {
  const s = document.getElementById('cfg-supabase-status')
  if (!supabaseClient && !initSupabase()) {
    if (s) {
      s.textContent = 'Não configurado'
      s.style.background = '#FEF2F2'
      s.style.color = '#DC2626'
    }
    return
  }
  try {
    const { error } = await supabaseClient.from('propostas').select('id').limit(1)
    if (error) throw error
    if (s) {
      s.textContent = 'Conectado'
      s.style.background = '#F0FDF4'
      s.style.color = '#16A34A'
    }
    updateDbStatus('connected')
    showToast('Supabase conectado!', 'success')
  } catch (e) {
    if (s) {
      s.textContent = 'Erro: ' + (e.message || 'falha')
      s.style.background = '#FEF2F2'
      s.style.color = '#DC2626'
    }
    updateDbStatus('error')
    showToast('Erro: ' + (e.message || 'verifique URL/key'), 'info')
  }
}
function copySql() {
  navigator.clipboard
    .writeText(document.getElementById('supabase-sql')?.textContent || '')
    .then(() => showToast('SQL copiado!', 'success'))
}

/* ── Config init ── */
function initConfig() {
  renderCrmListConfig()
  renderVoipListConfig()
  renderIntegPrecosConfig()
  renderAdicionaisConfig()
  const cfg = loadConfig()
  document.getElementById('cfg-supabase-url').value = cfg.supabaseUrl || ''
  document.getElementById('cfg-supabase-key').value = cfg.supabaseKey || ''
  document.getElementById('cfg-webhook-url').value = cfg.webhookUrl || ''
  document.getElementById('cfg-webhook-token').value = cfg.webhookToken || ''
  document.getElementById('cfg-template-url').value = cfg.templateUrl || ''
  document.getElementById('cfg-template-versao').value = cfg.templateVersao || ''

  const wh = document.getElementById('cfg-webhook-status')
  if (wh) {
    if (!cfg.webhookUrl || cfg.webhookUrl === CONFIG_DEFAULT.webhookUrl) {
      wh.textContent = 'Não configurado'
      wh.style.background = '#FEF2F2'
      wh.style.color = '#DC2626'
    } else {
      wh.textContent = 'Configurado'
      wh.style.background = '#F0FDF4'
      wh.style.color = '#16A34A'
    }
  }
  const se = document.getElementById('cfg-supabase-status')
  if (se) {
    if (!cfg.supabaseUrl) {
      se.textContent = 'Não configurado'
      se.style.background = '#F6F8FC'
      se.style.color = 'var(--text3)'
    } else if (supabaseClient) {
      se.textContent = 'Configurado'
      se.style.background = '#F0FDF4'
      se.style.color = '#16A34A'
    }
  }
  renderTabelaConfig()
  renderTabelaBaseConfig()
  renderWhatsConfigTable()
}
function salvarConfig() {
  saveConfig({
    webhookUrl: document.getElementById('cfg-webhook-url').value.trim(),
    webhookToken: document.getElementById('cfg-webhook-token').value.trim()
  })
  showToast('Configurações salvas.', 'success')
  initConfig()
}
function testarWebhook() {
  const url = document.getElementById('cfg-webhook-url').value.trim()
  if (!url || url === CONFIG_DEFAULT.webhookUrl) {
    showToast('Configure a URL antes de testar.', 'info')
    return
  }
  const btn = event.target
  btn.textContent = 'Testando...'
  btn.disabled = true
  const ctrl = new AbortController(),
    to = setTimeout(() => ctrl.abort(), 8000)
  fetch(url, {
    method: 'POST',
    headers: getWebhookHeaders(),
    body: JSON.stringify({ _ping: true }),
    signal: ctrl.signal
  })
    .then((r) => {
      clearTimeout(to)
      showToast(r.ok ? 'Webhook ok.' : 'HTTP ' + r.status + '.', r.ok ? 'success' : 'info')
    })
    .catch((e) => {
      clearTimeout(to)
      showToast(e.name === 'AbortError' ? 'Timeout.' : 'Erro de conexão.', 'info')
    })
    .finally(() => {
      btn.textContent = 'Testar'
      btn.disabled = false
      initConfig()
    })
}

/* ════════════════════════════════════════
   TABELA DE PRECOS — EDITOR (Novos)
════════════════════════════════════════ */
function renderTabelaConfig() {
  const tb = document.getElementById('cfg-price-tbody')
  if (!tb) return
  const tab = getTabelaAtiva()
  tb.innerHTML = tab
    .map(
      (row, i) =>
        `<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 10px"><input type="number" value="${row.horas}" min="1" onchange="atualizarLinhaTabelaConfig(${i},'horas',this.value)" style="width:90px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy)" /></td><td style="padding:6px 10px;text-align:right"><input type="number" value="${row.preco}" min="1" onchange="atualizarLinhaTabelaConfig(${i},'preco',this.value)" style="width:110px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy);text-align:right" /></td><td style="padding:6px 10px;text-align:right;font-size:12px;color:var(--text3);font-family:'DM Mono',monospace">R$ ${(row.preco / row.horas).toFixed(3).replace('.', ',')}</td><td style="padding:6px 10px;text-align:right"><button onclick="removerLinhaTabela(${i})" style="font-size:11px;padding:3px 8px;border:1px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer">rem</button></td></tr>`
    )
    .join('')
}
function atualizarLinhaTabelaConfig(idx, field, val) {
  const tab = getTabelaAtiva()
  tab[idx][field] = parseInt(val) || 0
  tab.sort((a, b) => a.horas - b.horas)
  tabelaEditavel = tab
  renderTabelaConfig()
}
function removerLinhaTabela(idx) {
  const tab = getTabelaAtiva()
  if (tab.length <= 2) {
    showToast('Mínimo 2 faixas.', 'info')
    return
  }
  tab.splice(idx, 1)
  tabelaEditavel = tab
  renderTabelaConfig()
}
function adicionarLinhaTabela() {
  const tab = getTabelaAtiva(),
    last = tab[tab.length - 1]
  tab.push({ horas: last.horas + 100, preco: Math.round(last.preco * 1.1) })
  tabelaEditavel = tab
  renderTabelaConfig()
}
async function salvarTabelaPrecos() {
  if (currentUser?.perfil !== 'admin') {
    showToast('Apenas administradores podem salvar a tabela.', 'info')
    return
  }
  const tab = getTabelaAtiva()
  tabelaEditavel = tab
  try { localStorage.setItem('salesbud_tabela', JSON.stringify(tab)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('configuracoes')
        .upsert({ chave: 'tabela_precos', valor: tab }, { onConflict: 'chave' })
      showToast('Tabela salva no Supabase.', 'success')
    } catch (e) {
      console.warn('salvarTabelaPrecos Supabase:', e.message)
      showToast('Tabela salva localmente. Falha ao sincronizar.', 'info')
    }
  } else {
    showToast('Tabela salva localmente (Supabase indisponível).', 'info')
  }
}
async function resetarTabela() {
  if (!confirm('Restaurar tabela original?')) return
  tabelaEditavel = TABELA_HORAS_DEFAULT.map((t) => ({ ...t }))
  try { localStorage.setItem('salesbud_tabela', JSON.stringify(tabelaEditavel)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('configuracoes')
        .upsert({ chave: 'tabela_precos', valor: tabelaEditavel }, { onConflict: 'chave' })
    } catch (e) {
      console.warn('resetarTabela Supabase:', e.message)
    }
  }
  renderTabelaConfig()
  showToast('Tabela restaurada.', 'success')
}

/* ════════════════════════════════════════
   TABELA DE PRECOS — BASE (CS/Upsell)
════════════════════════════════════════ */
function renderTabelaBaseConfig() {
  const tb = document.getElementById('cfg-price-base-tbody')
  if (!tb) return
  const tab = getTabelaBaseAtiva()
  tb.innerHTML = tab
    .map(
      (row, i) =>
        `<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 10px"><input type="number" value="${row.horas}" min="1" onchange="atualizarLinhaTabelaBaseConfig(${i},'horas',this.value)" style="width:90px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy)" /></td><td style="padding:6px 10px;text-align:right"><input type="number" value="${row.preco}" min="1" onchange="atualizarLinhaTabelaBaseConfig(${i},'preco',this.value)" style="width:110px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy);text-align:right" /></td><td style="padding:6px 10px;text-align:right;font-size:12px;color:var(--text3);font-family:'DM Mono',monospace">R$ ${(row.preco / row.horas).toFixed(3).replace('.', ',')}</td><td style="padding:6px 10px;text-align:right"><button onclick="removerLinhaTabelaBase(${i})" style="font-size:11px;padding:3px 8px;border:1px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer">rem</button></td></tr>`
    )
    .join('')
}
function atualizarLinhaTabelaBaseConfig(idx, field, val) {
  const tab = getTabelaBaseAtiva()
  tab[idx][field] = parseInt(val) || 0
  tab.sort((a, b) => a.horas - b.horas)
  tabelaBaseEditavel = tab
  renderTabelaBaseConfig()
}
function removerLinhaTabelaBase(idx) {
  const tab = getTabelaBaseAtiva()
  if (tab.length <= 2) {
    showToast('Minimo 2 faixas.', 'info')
    return
  }
  tab.splice(idx, 1)
  tabelaBaseEditavel = tab
  renderTabelaBaseConfig()
}
function adicionarLinhaTabelaBase() {
  const tab = getTabelaBaseAtiva(),
    last = tab[tab.length - 1]
  tab.push({ horas: last.horas + 100, preco: Math.round(last.preco * 1.1) })
  tabelaBaseEditavel = tab
  renderTabelaBaseConfig()
}
async function salvarTabelaBasePrecos() {
  if (currentUser?.perfil !== 'admin') {
    showToast('Apenas administradores podem salvar a tabela.', 'info')
    return
  }
  const tab = getTabelaBaseAtiva()
  tabelaBaseEditavel = tab
  try { localStorage.setItem('salesbud_tabela_base', JSON.stringify(tab)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('configuracoes')
        .upsert({ chave: 'tabela_precos_base', valor: tab }, { onConflict: 'chave' })
      showToast('Tabela Base salva no Supabase.', 'success')
    } catch (e) {
      console.warn('salvarTabelaBasePrecos Supabase:', e.message)
      showToast('Tabela salva localmente. Falha ao sincronizar.', 'info')
    }
  } else {
    showToast('Tabela salva localmente (Supabase indisponivel).', 'info')
  }
}
async function resetarTabelaBase() {
  if (!confirm('Restaurar tabela de Base original?')) return
  tabelaBaseEditavel = TABELA_HORAS_BASE_DEFAULT.map((t) => ({ ...t }))
  try { localStorage.setItem('salesbud_tabela_base', JSON.stringify(tabelaBaseEditavel)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('configuracoes')
        .upsert({ chave: 'tabela_precos_base', valor: tabelaBaseEditavel }, { onConflict: 'chave' })
    } catch (e) {
      console.warn('resetarTabelaBase Supabase:', e.message)
    }
  }
  renderTabelaBaseConfig()
  showToast('Tabela Base restaurada.', 'success')
}

/* ════════════════════════════════════════
   CRM LIST CONFIG
════════════════════════════════════════ */
function renderCrmListConfig() {
  const el = document.getElementById('cfg-crm-list')
  if (!el) return
  const list = getCrmList()
  el.innerHTML = list
    .map((c, i) => {
      const isDef = CRM_DEFAULT.includes(c)
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--navy)"><span>${esc(c)}</span>${isDef ? '<span style="font-size:11px;color:var(--text3);font-weight:500">padrão</span>' : `<button onclick="removerCrm(${i})" style="font-size:11px;padding:2px 8px;border:1px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer">rem</button>`}</div>`
    })
    .join('')
}
function adicionarCrm() {
  const inp = document.getElementById('cfg-crm-input')
  if (!inp) return
  const nome = inp.value.trim()
  if (!nome) {
    showToast('Digite o nome do CRM.', 'info')
    return
  }
  const list = getCrmList()
  if (list.some((c) => c.toLowerCase() === nome.toLowerCase())) {
    showToast('CRM já existe na lista.', 'info')
    return
  }
  list.push(nome)
  saveCrmList(list)
  inp.value = ''
  renderCrmListConfig()
  populateCrmDropdowns()
  showToast('CRM adicionado.', 'success')
}
function removerCrm(idx) {
  const list = getCrmList()
  if (CRM_DEFAULT.includes(list[idx])) {
    showToast('CRMs padrão não podem ser removidos.', 'info')
    return
  }
  list.splice(idx, 1)
  saveCrmList(list)
  renderCrmListConfig()
  populateCrmDropdowns()
  showToast('CRM removido.', 'success')
}

/* ════════════════════════════════════════
   VOIP LIST CONFIG
════════════════════════════════════════ */
function renderVoipListConfig() {
  const el = document.getElementById('cfg-voip-list')
  if (!el) return
  const list = getVoipList()
  el.innerHTML = list
    .map((v, i) => {
      const isDef = VOIP_DEFAULT.includes(v)
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--navy)"><span>${esc(v)}</span>${isDef ? '<span style="font-size:11px;color:var(--text3);font-weight:500">padrão</span>' : `<button onclick="removerVoip(${i})" style="font-size:11px;padding:2px 8px;border:1px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer">rem</button>`}</div>`
    })
    .join('')
}
function adicionarVoip() {
  const inp = document.getElementById('cfg-voip-input')
  if (!inp) return
  const nome = inp.value.trim()
  if (!nome) {
    showToast('Digite o nome do VOIP.', 'info')
    return
  }
  const list = getVoipList()
  if (list.some((v) => v.toLowerCase() === nome.toLowerCase())) {
    showToast('VOIP já existe na lista.', 'info')
    return
  }
  list.push(nome)
  saveVoipList(list)
  inp.value = ''
  renderVoipListConfig()
  showToast('VOIP adicionado.', 'success')
}
function removerVoip(idx) {
  const list = getVoipList()
  if (VOIP_DEFAULT.includes(list[idx])) {
    showToast('VOIPs padrão não podem ser removidos.', 'info')
    return
  }
  list.splice(idx, 1)
  saveVoipList(list)
  renderVoipListConfig()
  showToast('VOIP removido.', 'success')
}

/* ════════════════════════════════════════
   INTEGRACAO PRECOS CONFIG
════════════════════════════════════════ */
async function salvarIntegPrecos() {
  if (currentUser?.perfil !== 'admin') { showToast('Apenas administradores.', 'info'); return }
  const p = getIntegPrecos()
  const fields = ['crm_personalizado_setup', 'personalizacao_regras_setup', 'pipeline_adicional_setup', 'tarefas_auto_setup', 'tarefas_auto_mrr', 'campos_custom_bloco', 'campos_custom_setup_por_bloco', 'campos_custom_mrr_por_bloco']
  fields.forEach((f) => {
    const el = document.getElementById('cfg-ip-' + f)
    if (el) p[f] = parseInt(el.value) || 0
  })
  _integPrecos = p
  try { localStorage.setItem(INTEG_PRECOS_KEY, JSON.stringify(p)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient.from('configuracoes').upsert({ chave: 'integracao_precos', valor: p }, { onConflict: 'chave' })
      showToast('Preços de integração salvos.', 'success')
    } catch (e) {
      console.warn('salvarIntegPrecos:', e.message)
      showToast('Salvos localmente. Falha ao sincronizar.', 'info')
    }
  } else { showToast('Salvos localmente.', 'info') }
}
async function resetarIntegPrecos() {
  if (!confirm('Restaurar preços de integração padrão?')) return
  _integPrecos = { ...INTEG_PRECOS_DEFAULT }
  try { localStorage.setItem(INTEG_PRECOS_KEY, JSON.stringify(_integPrecos)) } catch {}
  if (supabaseClient) {
    try { await supabaseClient.from('configuracoes').upsert({ chave: 'integracao_precos', valor: _integPrecos }, { onConflict: 'chave' }) } catch (e) { console.warn('resetarIntegPrecos:', e.message) }
  }
  renderIntegPrecosConfig()
  showToast('Preços restaurados.', 'success')
}
function renderIntegPrecosConfig() {
  const p = getIntegPrecos()
  const labels = {
    crm_personalizado_setup: 'CRM Personalizado — Setup',
    personalizacao_regras_setup: 'Personalização Regras — Setup',
    pipeline_adicional_setup: 'Pipeline Adicional — Setup (cada)',
    tarefas_auto_setup: 'Tarefas Automáticas — Setup',
    tarefas_auto_mrr: 'Tarefas Automáticas — MRR/mês',
    campos_custom_bloco: 'Campos Personalizados — Bloco (qtd)',
    campos_custom_setup_por_bloco: 'Campos Personalizados — Setup/bloco',
    campos_custom_mrr_por_bloco: 'Campos Personalizados — MRR/bloco'
  }
  const el = document.getElementById('cfg-integ-precos-grid')
  if (!el) return
  el.innerHTML = Object.keys(labels).map((k) =>
    `<div><label class="field-label">${labels[k]}</label><input type="number" class="field-input" id="cfg-ip-${k}" value="${p[k]}" min="0" style="margin-top:4px" /></div>`
  ).join('')
}

/* ════════════════════════════════════════
   ADICIONAIS CONFIG
════════════════════════════════════════ */
async function salvarAdicionais() {
  if (currentUser?.perfil !== 'admin') { showToast('Apenas administradores.', 'info'); return }
  const cfg = getAdicionaisConfig()
  for (const k of Object.keys(cfg)) {
    const mrrEl = document.getElementById('cfg-adic-mrr-' + k)
    const ativoEl = document.getElementById('cfg-adic-ativo-' + k)
    if (mrrEl) cfg[k].mrr = parseInt(mrrEl.value) || 0
    if (ativoEl) cfg[k].ativo = ativoEl.checked
  }
  _adicionaisConfig = cfg
  try { localStorage.setItem(ADICIONAIS_KEY, JSON.stringify(cfg)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient.from('configuracoes').upsert({ chave: 'adicionais_config', valor: cfg }, { onConflict: 'chave' })
      showToast('Adicionais salvos.', 'success')
    } catch (e) {
      console.warn('salvarAdicionais:', e.message)
      showToast('Salvos localmente. Falha ao sincronizar.', 'info')
    }
  } else { showToast('Salvos localmente.', 'info') }
}
async function resetarAdicionais() {
  if (!confirm('Restaurar adicionais padrão?')) return
  _adicionaisConfig = JSON.parse(JSON.stringify(ADICIONAIS_DEFAULT))
  try { localStorage.setItem(ADICIONAIS_KEY, JSON.stringify(_adicionaisConfig)) } catch {}
  if (supabaseClient) {
    try { await supabaseClient.from('configuracoes').upsert({ chave: 'adicionais_config', valor: _adicionaisConfig }, { onConflict: 'chave' }) } catch (e) { console.warn('resetarAdicionais:', e.message) }
  }
  renderAdicionaisConfig()
  showToast('Adicionais restaurados.', 'success')
}
function renderAdicionaisConfig() {
  const el = document.getElementById('cfg-adicionais-grid')
  if (!el) return
  const cfg = getAdicionaisConfig()
  el.innerHTML = Object.entries(cfg).map(([k, v]) =>
    `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--bg)">` +
    `<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="cfg-adic-ativo-${k}" ${v.ativo ? 'checked' : ''} style="accent-color:var(--pink);width:16px;height:16px" /><span style="font-size:13px;font-weight:600;color:var(--navy)">${esc(v.label)}</span></label>` +
    `<div style="margin-left:auto;display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--text3)">MRR</span><input type="number" id="cfg-adic-mrr-${k}" value="${v.mrr}" min="0" style="width:90px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy);text-align:right" /><span style="font-size:11px;color:var(--text3)">/mês</span></div>` +
    `</div>`
  ).join('')
}

/* ════════════════════════════════════════
   WHATSAPP CONFIG
════════════════════════════════════════ */
async function salvarWhatsFaixas() {
  if (currentUser?.perfil !== 'admin') {
    showToast('Apenas administradores podem salvar.', 'info')
    return
  }
  const faixas = getWhatsFaixas()
  _whatsFaixas = faixas
  try { localStorage.setItem(WA_CACHE_KEY, JSON.stringify(faixas)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('configuracoes')
        .upsert({ chave: 'whatsapp_faixas', valor: faixas }, { onConflict: 'chave' })
      showToast('Faixas WhatsApp salvas no Supabase.', 'success')
    } catch (e) {
      console.warn('salvarWhatsFaixas Supabase:', e.message)
      showToast('Faixas salvas localmente. Falha ao sincronizar.', 'info')
    }
  } else {
    showToast('Faixas salvas localmente (Supabase indisponível).', 'info')
  }
  renderWhatsConfigTable()
}
async function resetarWhatsFaixas() {
  if (!confirm('Restaurar faixas padrão do WhatsApp?')) return
  _whatsFaixas = WHATSAPP_FAIXAS_DEFAULT.map((f) => ({ ...f }))
  try { localStorage.setItem(WA_CACHE_KEY, JSON.stringify(_whatsFaixas)) } catch {}
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('configuracoes')
        .upsert({ chave: 'whatsapp_faixas', valor: _whatsFaixas }, { onConflict: 'chave' })
    } catch (e) { console.warn('resetarWhatsFaixas Supabase:', e.message) }
  }
  renderWhatsConfigTable()
  showToast('Faixas restauradas.', 'success')
}
function atualizarWhatsLinha(idx, field, val) {
  const faixas = getWhatsFaixas()
  faixas[idx][field] = field === 'max' && val === '' ? null : parseInt(val) || 0
  _whatsFaixas = faixas
  renderWhatsConfigTable()
}
function removerWhatsFaixa(idx) {
  const faixas = getWhatsFaixas()
  if (faixas.length <= 1) { showToast('Mínimo 1 faixa.', 'info'); return }
  faixas.splice(idx, 1)
  _whatsFaixas = faixas
  renderWhatsConfigTable()
}
function adicionarWhatsFaixa() {
  const faixas = getWhatsFaixas()
  const last = faixas[faixas.length - 1]
  faixas.push({ min: (last.max || last.min) + 1, max: null, preco: last.preco })
  _whatsFaixas = faixas
  renderWhatsConfigTable()
}
function renderWhatsConfigTable() {
  const tb = document.getElementById('cfg-whats-tbody')
  if (!tb) return
  const faixas = getWhatsFaixas()
  tb.innerHTML = faixas.map((f, i) =>
    `<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 10px"><input type="number" value="${f.min}" min="1" onchange="atualizarWhatsLinha(${i},'min',this.value)" style="width:70px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy)" /></td><td style="padding:6px 10px"><input type="number" value="${f.max ?? ''}" min="0" placeholder="∞" onchange="atualizarWhatsLinha(${i},'max',this.value)" style="width:70px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy)" /></td><td style="padding:6px 10px;text-align:right"><input type="number" value="${f.preco}" min="1" onchange="atualizarWhatsLinha(${i},'preco',this.value)" style="width:90px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;color:var(--navy);text-align:right" /></td><td style="padding:6px 10px;text-align:right"><button onclick="removerWhatsFaixa(${i})" style="font-size:11px;padding:3px 8px;border:1px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer">rem</button></td></tr>`
  ).join('')
}

/* ════════════════════════════════════════
   IMPORT XLSX/CSV
════════════════════════════════════════ */
function initImportArea() {
  const drop = document.getElementById('import-drop-area')
  if (!drop || drop.dataset.init === '1') return
  drop.dataset.init = '1'
  drop.addEventListener('click', () => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = '.xlsx,.xls,.csv'
    i.onchange = (e) => processImportFile(e.target.files[0])
    i.click()
  })
  drop.addEventListener('dragover', (e) => {
    e.preventDefault()
    drop.classList.add('drag-over')
  })
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    drop.classList.remove('drag-over')
    if (e.dataTransfer.files[0]) processImportFile(e.dataTransfer.files[0])
  })
}
function processImportFile(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      let data = []
      if (file.name.endsWith('.csv')) {
        const lines = e.target.result.split('\n').filter((l) => l.trim()),
          headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase()),
          hi = headers.findIndex((h) => h.includes('hora') || h.includes('hour')),
          pi = headers.findIndex((h) => h.includes('prec') || h.includes('valor') || h.includes('price'))
        if (hi === -1 || pi === -1) {
          showToast('Colunas não encontradas. Use: Horas, Valor Final', 'info')
          return
        }
        data = lines
          .slice(1)
          .map((l) => {
            const cols = l.split(/[;,]/)
            return {
              horas: parseInt(cols[hi]) || 0,
              preco: parseFloat((cols[pi] || '0').replace(/[R$\s.]/g, '').replace(',', '.')) || 0
            }
          })
          .filter((r) => r.horas > 0 && r.preco > 0)
      } else {
        const wb = XLSX.read(e.target.result, { type: 'array' }),
          ws = wb.Sheets[wb.SheetNames[0]],
          rows = XLSX.utils.sheet_to_json(ws)
        data = rows
          .map((r) => {
            const h = r['Horas'] || r['horas'] || r['HORAS'],
              p = r['Valor Final'] || r['valor_final'] || r['Preco'] || r['preco'] || r['Valor']
            return h && p
              ? {
                  horas: parseInt(h),
                  preco: parseFloat(
                    String(p)
                      .replace(/[R$\s.]/g, '')
                      .replace(',', '.')
                  )
                }
              : null
          })
          .filter(Boolean)
      }
      if (!data.length) {
        showToast('Nenhuma linha válida encontrada.', 'info')
        return
      }
      data.sort((a, b) => a.horas - b.horas)
      tabelaEditavel = data
      const area = document.getElementById('import-preview-area')
      area.style.display = 'block'
      area.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:8px">${data.length} faixas importadas</div><div class="import-preview"><table><thead><tr><th>Horas</th><th>Preço</th><th>R$/h</th></tr></thead><tbody>${data.map((r) => `<tr><td>${r.horas.toLocaleString('pt-BR')}h</td><td>${fmt(r.preco)}</td><td>R$ ${(r.preco / r.horas).toFixed(3)}</td></tr>`).join('')}</tbody></table></div><button onclick="salvarTabelaPrecos()" style="margin-top:10px;padding:8px 16px;background:var(--pink);color:white;border:none;border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">Salvar esta tabela</button>`
      renderTabelaConfig()
    } catch (err) {
      showToast('Erro ao processar arquivo: ' + err.message, 'info')
    }
  }
  if (file.name.endsWith('.csv')) reader.readAsText(file, 'UTF-8')
  else reader.readAsArrayBuffer(file)
}

/* ════════════════════════════════════════
   USUARIOS (CRUD)
════════════════════════════════════════ */
async function renderTabela() {
  if (isSupabaseAuthReady()) {
    const perfis = await fetchPerfilList()
    if (perfis && perfis.length) {
      DB.users = perfis.map((p) => ({
        id: p.id,
        nome: p.nome || '',
        cargo: p.cargo || '',
        email: p.email || '',
        telefone: p.telefone || '',
        cidade: p.cidade || '',
        perfil: p.perfil || 'vendedor',
        status: p.status || 'ativo',
        _supabase: true
      }))
    }
  }
  const q = (document.getElementById('user-search')?.value || '').toLowerCase(),
    filtered = DB.users.filter(
      (u) => (u.nome || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    ),
    tbody = document.getElementById('users-tbody'),
    empty = document.getElementById('users-empty')
  if (!filtered.length) {
    tbody.innerHTML = ''
    empty.style.display = 'block'
    return
  }
  empty.style.display = 'none'
  tbody.innerHTML = filtered
    .map(
      (u) =>
        `<tr><td><div class="td-name"><div class="td-avatar">${initials(u.nome)}</div>${esc(u.nome)}</div></td><td>${esc(u.cargo || '—')}</td><td>${esc(u.email)}</td><td>${esc(u.telefone || '—')}</td><td><span class="badge ${u.perfil === 'admin' ? 'badge-admin' : 'badge-seller'}">${u.perfil === 'admin' ? 'Admin' : 'Vendedor'}</span></td><td><span class="badge ${u.status === 'ativo' ? 'badge-active' : 'badge-inactive'}">${u.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td><td><div class="row-actions"><button class="btn-icon" onclick="editarUsuario('${u.id}')">Editar</button>${String(u.id) !== String(currentUser.id) ? `<button class="btn-icon danger" onclick="toggleStatus('${u.id}')">${u.status === 'ativo' ? 'Desativar' : 'Ativar'}</button>` : ''}</div></td></tr>`
    )
    .join('')
}
async function toggleStatus(id) {
  const u = DB.users.find((u) => String(u.id) === String(id))
  if (!u) return
  const novoStatus = u.status === 'ativo' ? 'inativo' : 'ativo'
  u.status = novoStatus
  if (u._supabase && supabaseClient) {
    try {
      await supabaseClient.from('perfis').update({ status: novoStatus }).eq('id', u.id)
    } catch (e) {
      console.warn('toggleStatus Supabase:', e.message)
    }
  }
  saveUsersLocal()
  renderTabela()
  showToast(novoStatus === 'ativo' ? 'Reativado' : 'Desativado', novoStatus === 'ativo' ? 'success' : 'info')
}
function abrirModal(user) {
  if (!user) return
  editingUserId = user.id
  document.getElementById('modal-title').textContent = 'Editar usuário'
  ;['nome', 'cargo', 'email', 'telefone', 'cidade'].forEach((f) => {
    document.getElementById('m-' + f).value = user[f] || ''
  })
  document.getElementById('m-senha').value = ''
  document.getElementById('m-perfil').value = user.perfil || 'vendedor'
  document.getElementById('m-status').value = user.status || 'ativo'
  document.getElementById('modal-error').style.display = 'none'
  document.getElementById('m-senha').placeholder = 'Deixe vazio para manter'
  document.getElementById('modal-overlay').classList.add('open')
  setTimeout(() => document.getElementById('m-nome').focus(), 100)
}
function editarUsuario(id) {
  const u = DB.users.find((u) => String(u.id) === String(id))
  if (u) abrirModal(u)
}
function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open')
  editingUserId = null
}
function fecharModalSeSide(e) {
  if (e.target === document.getElementById('modal-overlay')) fecharModal()
}
async function salvarUsuario() {
  if (!editingUserId) return
  const nome = document.getElementById('m-nome').value.trim(),
    cargo = document.getElementById('m-cargo').value.trim(),
    email = document.getElementById('m-email').value.trim().toLowerCase(),
    senha = document.getElementById('m-senha').value,
    telefone = document.getElementById('m-telefone').value.trim(),
    cidade = document.getElementById('m-cidade').value.trim(),
    perfil = document.getElementById('m-perfil').value,
    status = document.getElementById('m-status').value,
    errEl = document.getElementById('modal-error')
  if (!nome || !email) {
    errEl.textContent = 'Nome e email são obrigatórios.'
    errEl.style.display = 'block'
    return
  }
  if (senha && senha.length < 6) {
    errEl.textContent = 'Senha: mín. 6 caracteres.'
    errEl.style.display = 'block'
    return
  }
  if (DB.users.find((u) => u.email === email && String(u.id) !== String(editingUserId))) {
    errEl.textContent = 'Email já cadastrado.'
    errEl.style.display = 'block'
    return
  }
  errEl.style.display = 'none'
  const u = DB.users.find((u) => String(u.id) === String(editingUserId))
  Object.assign(u, { nome, cargo, email, telefone, cidade, perfil, status })
  if (senha && !u._supabase) u.senha = await _h(senha)
  if (u._supabase && supabaseClient) {
    try {
      await supabaseClient
        .from('perfis')
        .update({ nome, cargo, email, telefone, cidade, perfil, status })
        .eq('id', u.id)
    } catch (e) {
      console.warn('salvarUsuario Supabase:', e.message)
      showToast('Aviso: perfil salvo localmente, falha no Supabase.', 'info')
    }
  }
  if (String(currentUser.id) === String(editingUserId)) {
    currentUser = { ...currentUser, ...u }
    document.getElementById('nav-username').textContent = u.nome.split(' ')[0]
    document.getElementById('nav-avatar').textContent = initials(u.nome)
  }
  showToast('Usuário atualizado.', 'success')
  saveUsersLocal()
  fecharModal()
  renderTabela()
}
