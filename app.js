/* ════════════════════════════════════════
   SUPABASE INIT
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   HISTÓRICO / PROPOSTAS
════════════════════════════════════════ */
let _histSelected = new Set(),
  _histAllData = []
const HIST_KEY = 'salesbud_historico'
function histLoadLocal() {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) || '[]')
  } catch {
    return []
  }
}
function histSaveLocal(d) {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(d.slice(0, 500)))
  } catch {
    showToast('Armazenamento local cheio.', 'info')
  }
}
function buildMetricsPayload(e) {
  return {
    ...e,
    _vendedor_id: currentUser?._supabaseUid ? null : currentUser?.id || null,
    _vendedor_uuid: currentUser?._supabaseUid || null,
    vendedor_nome: e.vendedor_nome || currentUser?.nome || '',
    _ts: new Date().toISOString(),
    _status_proposta: 'enviada',
    _motivo_perda: null
  }
}
function extractValorNum(s) {
  if (!s) return 0
  const m = String(s)
    .replace(/\./g, '')
    .replace(',', '.')
    .match(/[\d.]+/)
  return m ? parseFloat(m[0]) : 0
}
async function histAdd(entry) {
  const en = buildMetricsPayload(entry)
  const status = en.status_proposta || 'rascunho'
  if (supabaseClient) {
    try {
      const { data: rows, error } = await supabaseClient
        .from('propostas')
        .insert([
          {
            vendedor_id: en._vendedor_id,
            vendedor_uuid: currentUser?._supabaseUid || null,
            vendedor_nome: en.vendedor_nome,
            tipo_proposta: en.tipo_proposta || 'novo',
            nome_empresa: en.nome_empresa,
            crm_cliente: en.crm_cliente,
            contato_nome: en.contato_nome,
            contato_email: en.contato_email,
            pacote_horas: en.pacote_horas,
            preco_mensalidade: en.preco_mensalidade,
            preco_setup: en.preco_setup,
            desconto_pct: en.desconto_pct || 0,
            integ_tipo: en.descricao_setup,
            whatsapp_info: en.preco_whatsapp,
            status_proposta: status,
            data_proposta: en.data_proposta,
            validade_proposta: en.validade_proposta,
            payload_json: en
          }
        ])
        .select('id')
        .single()
      if (error) throw error
      return { id: rows.id, fonte: 'supabase' }
    } catch (e) {
      console.warn('Supabase insert falhou:', e.message)
      showToast('Aviso: falha ao salvar no Supabase. Registro salvo localmente.', 'info')
    }
  }
  const lid = Date.now()
  const data = histLoadLocal()
  data.unshift({ ...en, id: lid, ts: new Date().toISOString(), _status_proposta: status })
  histSaveLocal(data)
  return { id: lid, fonte: 'local' }
}
async function atualizarStatusProposta(id, novoStatus, fonte) {
  if (novoStatus === 'perdida') {
    openPerdaModal(id, fonte)
    return
  }
  await _salvarStatusProposta(id, novoStatus, null, fonte)
}
async function _salvarStatusProposta(id, novoStatus, motivo, fonte) {
  if (supabaseClient && fonte === 'supabase') {
    try {
      const p = { status_proposta: novoStatus }
      if (motivo) p.motivo_perda = motivo
      const { error } = await supabaseClient.from('propostas').update(p).eq('id', id)
      if (error) throw error
    } catch (e) {
      showToast('Erro ao atualizar: ' + e.message, 'info')
    }
  } else {
    const data = histLoadLocal(),
      idx = data.findIndex((d) => d.id === id)
    if (idx !== -1) {
      data[idx]._status_proposta = novoStatus
      if (motivo) data[idx]._motivo_perda = motivo
      histSaveLocal(data)
    }
  }
  const sel = document.querySelector(`select[data-prop-id="${id}"]`)
  if (sel) sel.className = `status-badge status-${novoStatus}`
  const labels = { enviada: 'Enviada', negociacao: 'Negociação', aprovada: 'Aprovada', perdida: 'Perdida' }
  showToast(`Status: ${labels[novoStatus] || novoStatus}`, 'success')
  renderHistorico()
}
async function renderHistorico() {
  const loadingEl = document.getElementById('hist-loading'),
    tbodyEl = document.getElementById('hist-tbody'),
    emptyEl = document.getElementById('hist-empty')
  if (loadingEl) loadingEl.style.display = 'block'
  if (tbodyEl) tbodyEl.innerHTML = ''
  let data = []
  if (supabaseClient) {
    try {
      const { data: rows, error } = await supabaseClient
        .from('propostas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      data = rows.map((r) => ({
        id: r.id,
        ts: r.created_at,
        tipo_proposta: r.tipo_proposta,
        nome_empresa: r.nome_empresa,
        crm_cliente: r.crm_cliente,
        contato_nome: r.contato_nome,
        contato_email: r.contato_email,
        vendedor_nome: r.vendedor_nome,
        pacote_horas: r.pacote_horas,
        preco_mensalidade: r.preco_mensalidade,
        preco_setup: r.preco_setup,
        desconto_pct: r.desconto_pct,
        _status_proposta: r.status_proposta,
        _motivo_perda: r.motivo_perda,
        data_proposta: r.data_proposta,
        detalhe_desconto: r.desconto_pct > 0 ? `Desconto ${r.desconto_pct}% aplicado` : '',
        _fonte: 'supabase'
      }))
    } catch (e) {
      showToast('Supabase indisponível — exibindo histórico local.', 'info')
      data = histLoadLocal()
    }
  } else data = histLoadLocal()
  if (loadingEl) loadingEl.style.display = 'none'
  const search = (document.getElementById('hist-search')?.value || '').toLowerCase(),
    tipo = document.getElementById('hist-tipo')?.value || '',
    vend = document.getElementById('hist-vendedor')?.value || ''
  const vs = document.getElementById('hist-vendedor')
  if (vs) {
    const vl = [...new Set(data.map((d) => d.vendedor_nome).filter(Boolean))],
      cur = vs.value
    vs.innerHTML =
      '<option value="">Todos os vendedores</option>' +
      vl.map((v) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(v)}</option>`).join('')
  }
  const periodo = document.getElementById('hist-periodo')?.value || ''
  const filtered = data.filter((d) => {
    const ms =
      !search ||
      (d.nome_empresa || '').toLowerCase().includes(search) ||
      (d.vendedor_nome || '').toLowerCase().includes(search)
    const mt = !tipo || d.tipo_proposta === tipo || (tipo === 'novo' && !d.tipo_proposta)
    const mv = !vend || d.vendedor_nome === vend
    const mp =
      !periodo ||
      (() => {
        const ds = d.data_proposta || (d.ts ? new Date(d.ts).toLocaleDateString('pt-BR') : '')
        if (!ds) return true
        const [dd, mm, yy] = ds.split('/')
        const dt = new Date(`${yy}-${mm}-${dd}T00:00:00`)
        if (isNaN(dt)) return true
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - parseInt(periodo))
        cutoff.setHours(0, 0, 0, 0)
        return dt >= cutoff
      })()
    return ms && mt && mv && mp
  })
  _histAllData = filtered
  const ki = document.getElementById('hist-kpis')
  if (ki) {
    const tot = filtered.length,
      n = filtered.filter((d) => !d.tipo_proposta || d.tipo_proposta === 'novo').length,
      u = filtered.filter((d) => d.tipo_proposta === 'upsell_base').length,
      tv = filtered.reduce((s, d) => s + extractValorNum(d.preco_mensalidade), 0)
    ki.innerHTML = [
      { label: 'Total de Propostas', val: tot },
      { label: 'Novos Clientes', val: n },
      { label: 'Upsell Base', val: u },
      { label: 'Volume Total/mês', val: tv > 0 ? fmt(tv) : '—' }
    ]
      .map(
        (k) =>
          `<div><div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:6px;text-transform:uppercase">${k.label}</div><div style="font-size:22px;font-weight:800;color:var(--navy);font-family:'Syne',sans-serif;letter-spacing:-0.5px">${k.val}</div></div>`
      )
      .join('')
  }
  if (!filtered.length) {
    if (emptyEl) emptyEl.style.display = 'block'
    return
  }
  if (emptyEl) emptyEl.style.display = 'none'
  if (tbodyEl) {
    tbodyEl.innerHTML = filtered
      .map((d) => {
        const df = d.data_proposta || (d.ts ? new Date(d.ts).toLocaleDateString('pt-BR') : '—'),
          tl = d.tipo_proposta === 'upsell_base' ? 'Base' : 'Novo',
          ts =
            d.tipo_proposta === 'upsell_base'
              ? 'background:rgba(251,36,145,.08);color:var(--pink);border:1.5px solid rgba(251,36,145,.2)'
              : 'background:#EFF6FF;color:#2563EB;border:1.5px solid #BFDBFE',
          st = d._status_proposta || 'enviada',
          pf = d._fonte || 'local'
        const _chk = _histSelected.has(d.id)
        return `<tr><td style="text-align:center;padding:0 8px"><input type="checkbox" class="hist-check" data-id="${d.id}" data-fonte="${pf}" ${_chk ? 'checked' : ''} onchange="onHistCheck(this)" style="cursor:pointer;width:14px;height:14px;accent-color:var(--pink)"></td><td style="font-size:12px;color:var(--text3)">${df}</td><td style="font-weight:600;color:var(--text)">${esc(d.nome_empresa || '—')}</td><td><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;${ts}">${tl}</span></td><td style="font-size:13px;color:var(--text2)">${esc(d.vendedor_nome || '—')}</td><td style="font-weight:600;color:var(--navy)">${esc(d.pacote_horas || '—')}h</td><td style="font-weight:700">${esc(d.preco_mensalidade || '—')}</td><td><select class="status-badge status-${st}" data-prop-id="${d.id}" data-fonte="${pf}" onchange="atualizarStatusProposta(${d.id},this.value,'${pf}')" style="border:none;outline:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;appearance:none;padding:3px 9px;border-radius:20px"><option value="enviada" ${st === 'enviada' ? 'selected' : ''}>Enviada</option><option value="negociacao" ${st === 'negociacao' ? 'selected' : ''}>Negociação</option><option value="aprovada" ${st === 'aprovada' ? 'selected' : ''}>Aprovada</option><option value="perdida" ${st === 'perdida' ? 'selected' : ''}>Perdida</option></select>${d._motivo_perda ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(d._motivo_perda)}</div>` : ''}</td><td><div style="display:flex;gap:6px">${pf === 'supabase' ? `<button data-resend-id="${d.id}" onclick="reenviarProposta(${d.id})" style="font-size:11px;padding:3px 10px;border:1.5px solid #BFDBFE;border-radius:4px;background:#EFF6FF;color:#2563EB;cursor:pointer;font-family:inherit;font-weight:600">Reenviar</button>` : ''}<button onclick="editarProposta(${d.id},'${pf}')" style="font-size:11px;padding:3px 10px;border:1.5px solid var(--border);border-radius:4px;background:white;color:var(--navy);cursor:pointer;font-family:inherit;font-weight:600">Editar</button><button onclick="excluirProposta(${d.id},'${pf}')" style="font-size:11px;padding:3px 10px;border:1.5px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer;font-family:inherit;font-weight:600">Excluir</button></div></td></tr>`
      })
      .join('')
  }
}
function exportHistorico() {
  ;(async () => {
    let data = []
    if (supabaseClient) {
      try {
        const { data: r, error } = await supabaseClient
          .from('propostas')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        data = r || []
      } catch {
        showToast('Supabase indisponível — exportando histórico local.', 'info')
        data = histLoadLocal()
      }
    } else data = histLoadLocal()
    if (!data.length) {
      showToast('Nenhuma proposta para exportar.', 'info')
      return
    }
    const headers = [
      'data',
      'tipo',
      'empresa',
      'vendedor',
      'horas',
      'valor_mes',
      'setup',
      'crm',
      'whatsapp',
      'status',
      'motivo_perda'
    ]
    const rows = data.map((d) =>
      [
        d.data_proposta || (d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : ''),
        d.tipo_proposta === 'upsell_base' ? 'Base' : 'Novo',
        d.nome_empresa || '',
        d.vendedor_nome || '',
        d.pacote_horas || '',
        d.preco_mensalidade || '',
        d.preco_setup || '',
        d.crm_cliente || '',
        d.whatsapp_info || d.preco_whatsapp || '',
        d.status_proposta || d._status_proposta || 'enviada',
        d.motivo_perda || d._motivo_perda || ''
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = '﻿' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = `salesbud_historico_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`${data.length} proposta(s) exportada(s).`, 'success')
  })()
}

/* ════════════════════════════════════════
   HISTÓRICO UI (seleção em massa)
════════════════════════════════════════ */
function onHistCheck(cb) {
  const id = Number(cb.dataset.id)
  if (cb.checked) _histSelected.add(id)
  else _histSelected.delete(id)
  updateBulkBar()
}
function toggleAllHist(checked) {
  document.querySelectorAll('.hist-check').forEach((cb) => {
    cb.checked = checked
    const id = Number(cb.dataset.id)
    if (checked) _histSelected.add(id)
    else _histSelected.delete(id)
  })
  updateBulkBar()
}
function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar'),
    n = _histSelected.size,
    countEl = document.getElementById('bulk-count-num')
  if (countEl) countEl.textContent = n
  if (bar) bar.classList.toggle('show', n > 0)
  const allCbs = document.querySelectorAll('.hist-check'),
    masterCb = document.getElementById('hist-check-all')
  if (masterCb && allCbs.length > 0) {
    const allChecked = [...allCbs].every((c) => c.checked),
      someChecked = [...allCbs].some((c) => c.checked)
    masterCb.checked = allChecked
    masterCb.indeterminate = !allChecked && someChecked
  }
}
function limparSelecao() {
  _histSelected.clear()
  document.querySelectorAll('.hist-check').forEach((cb) => (cb.checked = false))
  const m = document.getElementById('hist-check-all')
  if (m) {
    m.checked = false
    m.indeterminate = false
  }
  updateBulkBar()
}
async function excluirSelecionadas() {
  if (!_histSelected.size) return
  if (!confirm(`Excluir ${_histSelected.size} proposta(s)? Esta ação não pode ser desfeita.`)) return
  const ids = [..._histSelected]
  for (const id of ids) {
    const d = _histAllData.find((d) => d.id === id),
      fonte = d?._fonte || 'local'
    if (supabaseClient && fonte === 'supabase') {
      try {
        await supabaseClient.from('propostas').delete().eq('id', id)
      } catch {}
    } else {
      const local = histLoadLocal().filter((d) => d.id !== id)
      histSaveLocal(local)
    }
  }
  _histSelected.clear()
  showToast(`${ids.length} proposta(s) excluída(s).`, 'success')
  renderHistorico()
}
function exportarSelecionadas() {
  const selected = _histAllData.filter((d) => _histSelected.has(d.id))
  if (!selected.length) {
    showToast('Nenhuma proposta selecionada.', 'info')
    return
  }
  const headers = [
    'data',
    'tipo',
    'empresa',
    'vendedor',
    'horas',
    'valor_mes',
    'setup',
    'crm',
    'whatsapp',
    'status',
    'motivo_perda'
  ]
  const rows = selected.map((d) =>
    [
      d.data_proposta || (d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : ''),
      d.tipo_proposta === 'upsell_base' ? 'Base' : 'Novo',
      d.nome_empresa || '',
      d.vendedor_nome || '',
      d.pacote_horas || '',
      d.preco_mensalidade || '',
      d.preco_setup || '',
      d.crm_cliente || '',
      d.whatsapp_info || d.preco_whatsapp || '',
      d.status_proposta || d._status_proposta || 'enviada',
      d.motivo_perda || d._motivo_perda || ''
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = '﻿' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = `salesbud_selecionadas_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`${selected.length} proposta(s) exportada(s).`, 'success')
}

/* ════════════════════════════════════════
   HISTÓRICO UI (motivo perda)
════════════════════════════════════════ */
let _perdaContext = null
function openPerdaModal(id, fonte) {
  _perdaContext = { id, fonte }
  document.getElementById('perda-obs').value = ''
  document.querySelectorAll('.perda-opt').forEach((b) => b.classList.remove('selected'))
  document.getElementById('perda-overlay').classList.add('show')
}
function selectPerdaOpt(el, val) {
  document.querySelectorAll('.perda-opt').forEach((b) => b.classList.remove('selected'))
  el.classList.add('selected')
  el.dataset.val = val
}
function closePerdaModal(motivo) {
  document.getElementById('perda-overlay').classList.remove('show')
  if (_perdaContext) _salvarStatusProposta(_perdaContext.id, 'perdida', motivo, _perdaContext.fonte)
  _perdaContext = null
}
function confirmPerda() {
  const s = document.querySelector('.perda-opt.selected'),
    obs = document.getElementById('perda-obs').value.trim()
  closePerdaModal([s?.dataset.val, obs].filter(Boolean).join(' — ') || null)
}

/* ════════════════════════════════════════
   FALLBACK WEBHOOK
════════════════════════════════════════ */
let _fallbackPayload = '',
  _fallbackRetryFn = null
function showFallback(payloadStr, retryFn) {
  _fallbackPayload = payloadStr
  _fallbackRetryFn = retryFn
  const p = document.getElementById('fallback-payload-preview')
  if (p) {
    try {
      const o = JSON.parse(payloadStr)
      p.textContent = `{ "nome_empresa": "${o.nome_empresa || '...'}", "pacote_horas": "${o.pacote_horas || '...'}", ... }`
    } catch {
      p.textContent = payloadStr.slice(0, 80) + '...'
    }
  }
  navigator.clipboard?.writeText(payloadStr).catch(() => {})
  document.getElementById('fallback-overlay').classList.add('show')
}
function closeFallback() {
  document.getElementById('fallback-overlay').classList.remove('show')
  _fallbackRetryFn = null
}
function copyFallbackPayload() {
  navigator.clipboard.writeText(_fallbackPayload).then(() => showToast('JSON copiado!', 'success'))
}
async function retryWebhook() {
  if (!_fallbackRetryFn) return
  const btn = document.querySelector('.btn-retry')
  if (btn) {
    btn.disabled = true
    btn.innerHTML = '<span class="spinner"></span> Tentando...'
  }
  await _fallbackRetryFn()
  if (btn) {
    btn.disabled = false
    btn.innerHTML = '<span class="spinner"></span> Tentar novamente'
  }
}

/* ════════════════════════════════════════
   TEMPLATE BANNER
════════════════════════════════════════ */
const BANNER_DISMISS_KEY = 'salesbud_banner_dismissed_ver'
function checkTemplateBanner() {
  const cfg = loadConfig(),
    dis = localStorage.getItem(BANNER_DISMISS_KEY) || '',
    cur = cfg.templateVersao || '',
    b = document.getElementById('template-update-banner')
  if (!b) return
  if (cur && cur !== dis) {
    const m = document.getElementById('banner-template-msg'),
      s = document.getElementById('banner-template-sub')
    if (m) m.textContent = `Template atualizado — ${cur}`
    if (s) s.textContent = 'Use sempre o link mais recente ao gerar propostas.'
    b.style.display = 'flex'
  } else b.style.display = 'none'
}
function dismissTemplateBanner() {
  localStorage.setItem(BANNER_DISMISS_KEY, loadConfig().templateVersao || '')
  const b = document.getElementById('template-update-banner')
  if (b) b.style.display = 'none'
}
function salvarTemplate() {
  const url = document.getElementById('cfg-template-url').value.trim(),
    versao = document.getElementById('cfg-template-versao').value.trim(),
    antes = loadConfig()
  if (versao && versao !== antes.templateVersao) localStorage.removeItem(BANNER_DISMISS_KEY)
  saveConfig({ templateUrl: url, templateVersao: versao })
  showToast('Template salvo.', 'success')
  checkTemplateBanner()
}

/* ════════════════════════════════════════
   HUBSPOT PREFILL
════════════════════════════════════════ */
async function checkHubSpotPrefill() {
  const params = new URLSearchParams(window.location.search),
    dealId = params.get('deal_id')
  if (!dealId) return
  const banner = document.getElementById('hubspot-prefill-banner'),
    title = document.getElementById('hs-banner-title'),
    loader = document.getElementById('hs-loading-indicator')
  if (banner) banner.style.display = 'flex'
  const wh = getWebhookUrl(),
    isConf = wh && wh !== CONFIG_DEFAULT.webhookUrl
  if (!isConf) {
    if (title) title.textContent = 'deal_id detectado — configure o webhook para ativar prefill'
    if (loader) loader.innerHTML = `<span style="color:#D97706;font-size:12px">deal_id: ${dealId}</span>`
    return
  }
  if (title) title.textContent = 'Carregando dados do HubSpot...'
  if (loader) loader.innerHTML = '<span class="hs-spinner"></span> Buscando...'
  const ctrl = new AbortController(),
    to = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(wh, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'hubspot_prefill', deal_id: dealId }),
      signal: ctrl.signal
    })
    clearTimeout(to)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const deal = await res.json()
    const fields = {
      empresa: deal.nome_empresa || deal.dealname || '',
      'contato-nome': deal.contato_nome || deal.contact_name || '',
      'contato-email': deal.contato_email || deal.contact_email || '',
      crm: deal.crm || ''
    }
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id)
      if (!el || !val) return
      if (el.tagName === 'SELECT') {
        const exists = [...el.options].some((o) => o.value === val)
        if (!exists) {
          const opt = document.createElement('option')
          opt.value = val
          opt.textContent = val
          el.appendChild(opt)
        }
      }
      el.value = val
    })
    update()
    if (title) title.textContent = `Dados carregados — ${deal.nome_empresa || deal.dealname || 'Deal ' + dealId}`
    if (loader)
      loader.innerHTML = `<span style="color:#16A34A;font-size:12px;font-weight:600">Preenchido automaticamente</span>`
  } catch (e) {
    clearTimeout(to)
    if (title) title.textContent = e.name === 'AbortError' ? 'Timeout — preencha manualmente' : 'Falha ao buscar deal'
    if (loader) loader.innerHTML = `<span style="color:#D97706;font-size:12px">deal_id: ${dealId}</span>`
  }
}

/* ════════════════════════════════════════
   AUTH (Supabase Auth + fallback local)
════════════════════════════════════════ */
async function _h(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
async function _c(plain, stored) {
  return stored && (await _h(plain)) === stored
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
function mostrarSetup() {
  mostrarScreen('setup')
  const list = document.getElementById('setup-users-list')
  if (!list) return
  list.innerHTML = DB.users
    .filter((u) => u.status === 'ativo')
    .map(
      (u) =>
        `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--bg)"><div style="width:34px;height:34px;background:${u.perfil === 'admin' ? 'var(--pink)' : 'var(--navy-mid)'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0">${initials(u.nome)}</div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px;color:var(--navy)">${esc(u.nome)}${u.perfil === 'admin' ? ' <span style="font-size:10px;font-weight:700;background:rgba(251,36,145,.1);color:var(--pink);padding:1px 7px;border-radius:20px">Admin</span>' : ''}</div><div style="font-size:11.5px;color:var(--text3)">${esc(u.email)}</div></div><input type="password" data-uid="${u.id}" placeholder="${u.perfil === 'admin' ? 'Senha obrigatória' : 'Senha (opcional)'}" style="width:170px;padding:8px 11px;border:1.5px solid var(--border);border-radius:var(--radius-xs);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border-color .15s" onfocus="this.style.borderColor='var(--pink)'" onblur="this.style.borderColor='var(--border)'" /></div>`
    )
    .join('')
}
async function concluirSetup() {
  const inputs = [...document.querySelectorAll('#setup-users-list input[data-uid]')],
    errEl = document.getElementById('setup-error')
  const adminOk = inputs.some((inp) => {
    const u = DB.users.find((u) => u.id === parseInt(inp.dataset.uid))
    return u?.perfil === 'admin' && inp.value.trim().length >= 6
  })
  if (!adminOk) {
    errEl.textContent = 'Defina a senha de pelo menos um administrador (mínimo 6 caracteres).'
    errEl.style.display = 'block'
    return
  }
  for (const inp of inputs) {
    const val = inp.value.trim()
    if (val.length >= 6) {
      const u = DB.users.find((u) => u.id === parseInt(inp.dataset.uid))
      if (u) u.senha = await _h(val)
    }
  }
  saveUsersLocal()
  errEl.style.display = 'none'
  mostrarScreen('login')
  showToast('Senhas configuradas! Faça login para continuar.', 'success')
}
let DB = { users: [], nextId: 1 }
let currentUser = null,
  editingUserId = null
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
async function restoreSession() {
  if (isSupabaseAuthReady()) {
    try {
      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      if (session?.user) {
        const perfil = await fetchPerfil(session.user.id)
        if (perfil && perfil.status === 'ativo') {
          currentUser = { ...perfil, _supabaseUid: session.user.id }
          return true
        }
      }
    } catch (e) {
      console.warn('restoreSession Supabase:', e.message)
    }
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const s = JSON.parse(raw)
    if (Date.now() - s.ts > s.ttl) {
      if (s.email) localStorage.setItem(LAST_EMAIL_KEY, s.email)
      clearSession()
      return false
    }
    const user = DB.users.find((u) => u.id === s.userId && u.status === 'ativo')
    if (!user) return false
    currentUser = user
    return true
  } catch {
    return false
  }
}
async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase(),
    senha = document.getElementById('login-senha').value,
    errEl = document.getElementById('login-error'),
    btnEl = document.getElementById('btn-login')
  if (btnEl) {
    btnEl.disabled = true
    btnEl.textContent = 'Entrando...'
  }
  if (isSupabaseAuthReady()) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha })
      if (!error && data.user) {
        const perfil = await fetchPerfil(data.user.id)
        if (perfil && perfil.status === 'ativo') {
          currentUser = { ...perfil, _supabaseUid: data.user.id }
          errEl.style.display = 'none'
          localStorage.removeItem(LAST_EMAIL_KEY)
          iniciarApp()
          if (btnEl) {
            btnEl.disabled = false
            btnEl.textContent = 'Entrar'
          }
          return
        }
      }
    } catch (e) {
      console.warn('fazerLogin Supabase:', e.message)
    }
  }
  let user = null
  for (const u of DB.users) {
    if (u.email.toLowerCase() === email && u.status === 'ativo' && (await _c(senha, u.senha))) {
      user = u
      break
    }
  }
  if (!user) {
    errEl.style.display = 'block'
    document.getElementById('login-senha').value = ''
    if (btnEl) {
      btnEl.disabled = false
      btnEl.textContent = 'Entrar'
    }
    return
  }
  errEl.style.display = 'none'
  currentUser = user
  const ttl = document.getElementById('keep-logged')?.checked ? SESSION_TTL_LONG : SESSION_TTL_SHORT
  saveSession(user, ttl)
  localStorage.removeItem(LAST_EMAIL_KEY)
  iniciarApp()
  if (btnEl) {
    btnEl.disabled = false
    btnEl.textContent = 'Entrar'
  }
}
async function fazerLogout() {
  if (isSupabaseAuthReady()) {
    try {
      await supabaseClient.auth.signOut()
    } catch (e) {
      console.warn('signOut:', e.message)
    }
  }
  currentUser = null
  clearSession()
  mostrarScreen('login')
  document.getElementById('login-email').value = ''
  document.getElementById('login-senha').value = ''
}
document.addEventListener('DOMContentLoaded', async () => {
  loadUsersLocal()
  initSupabase()
  const _hp = new URLSearchParams(window.location.hash.substring(1))
  if (_hp.get('type') === 'recovery' && _hp.get('access_token')) {
    document.getElementById('login-normal-content').style.display = 'none'
    document.getElementById('reset-password-wrapper').style.display = 'block'
    return
  }
  document.getElementById('login-senha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerLogin()
  })
  document.getElementById('login-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fazerLogin()
  })
  if (await restoreSession()) {
    iniciarApp()
    return
  }
  const hasAdminPwd = DB.users.some((u) => u.perfil === 'admin' && u.senha)
  if (!hasAdminPwd && !isSupabaseAuthReady()) {
    mostrarSetup()
    return
  }
  const lastEmail = localStorage.getItem(LAST_EMAIL_KEY)
  if (lastEmail) {
    const el = document.getElementById('login-email')
    if (el) el.value = lastEmail
  }
})

/* ════════════════════════════════════════
   APP INIT / NAVEGAÇÃO
════════════════════════════════════════ */
function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu')
  if (!menu) return
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
}
document.addEventListener('click', (e) => {
  const avatar = document.getElementById('nav-avatar'),
    menu = document.getElementById('profile-menu')
  if (menu && !avatar?.contains(e.target) && !menu.contains(e.target)) menu.style.display = 'none'
})

/* ════════════════════════════════════════
   ESQUECI SENHA / RESET
════════════════════════════════════════ */
function toggleEsqueciSenha() {
  const f = document.getElementById('forgot-form')
  if (!f) return
  const show = f.style.display === 'none'
  f.style.display = show ? 'block' : 'none'
  if (show) {
    const le = document.getElementById('login-email')?.value,
      fe = document.getElementById('forgot-email')
    if (fe && le) fe.value = le
    fe?.focus()
  }
  document.getElementById('forgot-msg').style.display = 'none'
}
async function enviarResetSenha() {
  const msg = document.getElementById('forgot-msg')
  if (!isSupabaseAuthReady()) {
    msg.textContent = 'Supabase Auth não configurado. Contate o admin para redefinir sua senha.'
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
    return
  }
  const email = document.getElementById('forgot-email').value.trim()
  if (!email) {
    msg.textContent = 'Digite seu email.'
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
    return
  }
  const btn = document.getElementById('btn-forgot-send')
  btn.disabled = true
  btn.textContent = 'Enviando...'
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    })
    if (error) {
      msg.textContent = 'Email não encontrado ou erro ao enviar.'
      msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
    } else {
      msg.textContent = 'Link de recuperação enviado! Verifique seu email.'
      msg.style.cssText = 'display:block;color:var(--green);background:var(--green-bg)'
    }
  } catch (e) {
    msg.textContent = 'Email não encontrado ou erro ao enviar.'
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
  } finally {
    btn.disabled = false
    btn.textContent = 'Enviar link de recuperação'
  }
}
async function confirmarNovaSenha() {
  const nova = document.getElementById('reset-nova-senha').value,
    conf = document.getElementById('reset-confirmar-senha').value,
    msg = document.getElementById('reset-msg')
  if (nova.length < 6) {
    msg.textContent = 'Senha deve ter no mínimo 6 caracteres.'
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
    return
  }
  if (nova !== conf) {
    msg.textContent = 'As senhas não coincidem.'
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
    return
  }
  if (!isSupabaseAuthReady()) {
    msg.textContent = 'Supabase Auth não disponível.'
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
    return
  }
  const btn = document.getElementById('btn-reset-confirm')
  btn.disabled = true
  btn.textContent = 'Alterando...'
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: nova })
    if (error) throw error
    msg.textContent = 'Senha alterada! Faça login.'
    msg.style.cssText = 'display:block;color:var(--green);background:var(--green-bg)'
    setTimeout(() => {
      window.location.hash = ''
      document.getElementById('reset-password-wrapper').style.display = 'none'
      document.getElementById('login-normal-content').style.display = 'block'
    }, 2000)
  } catch (e) {
    msg.textContent = 'Erro ao alterar senha: ' + (e.message || 'tente novamente.')
    msg.style.cssText = 'display:block;color:var(--red);background:var(--red-bg)'
  } finally {
    btn.disabled = false
    btn.textContent = 'Alterar senha'
  }
}

/* ════════════════════════════════════════
   ALTERAR SENHA (PERFIL)
════════════════════════════════════════ */
function abrirModalAlterarSenha() {
  document.getElementById('senha-nova').value = ''
  document.getElementById('senha-confirmar').value = ''
  document.getElementById('modal-senha-error').style.display = 'none'
  document.getElementById('modal-senha-overlay').classList.add('open')
  document.getElementById('profile-menu').style.display = 'none'
  setTimeout(() => document.getElementById('senha-nova').focus(), 100)
}
function fecharModalAlterarSenha() {
  document.getElementById('modal-senha-overlay').classList.remove('open')
}
function fecharModalSenhaSeClick(e) {
  if (e.target === document.getElementById('modal-senha-overlay')) fecharModalAlterarSenha()
}
async function salvarNovaSenha() {
  const nova = document.getElementById('senha-nova').value,
    conf = document.getElementById('senha-confirmar').value,
    errEl = document.getElementById('modal-senha-error')
  if (nova.length < 6) {
    errEl.textContent = 'Senha deve ter no mínimo 6 caracteres.'
    errEl.style.display = 'block'
    return
  }
  if (nova !== conf) {
    errEl.textContent = 'As senhas não coincidem.'
    errEl.style.display = 'block'
    return
  }
  errEl.style.display = 'none'
  const btn = document.querySelector('#modal-senha-overlay .btn-save')
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Alterando...'
  }
  try {
    if (isSupabaseAuthReady()) {
      const { error } = await supabaseClient.auth.updateUser({ password: nova })
      if (error) throw error
    } else {
      if (!currentUser) throw new Error('Usuário não identificado.')
      const user = DB.users.find((u) => String(u.id) === String(currentUser.id))
      if (!user) throw new Error('Usuário não encontrado.')
      user.senha = await _h(nova)
      saveUsersLocal()
    }
    fecharModalAlterarSenha()
    showToast('Senha alterada com sucesso!', 'success')
  } catch (e) {
    errEl.textContent = 'Erro: ' + (e.message || 'tente novamente.')
    errEl.style.display = 'block'
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Alterar senha'
    }
  }
}
function iniciarApp() {
  document.getElementById('nav-username').textContent = currentUser.nome.split(' ')[0]
  document.getElementById('nav-userrole').textContent = currentUser.perfil === 'admin' ? 'Administrador' : 'Vendedor'
  document.getElementById('nav-avatar').textContent = initials(currentUser.nome)
  document.getElementById('nav-admin-section').style.display = currentUser.perfil === 'admin' ? 'block' : 'none'
  const isAdmin = currentUser.perfil === 'admin'
  document.getElementById('nav-usuarios').style.display = isAdmin ? 'block' : 'none'
  document.getElementById('nav-config').style.display = isAdmin ? 'block' : 'none'
  document.getElementById('chip-avatar').textContent = initials(currentUser.nome)
  document.getElementById('chip-name').textContent = currentUser.nome
  document.getElementById('chip-sub').textContent = [currentUser.cargo, currentUser.telefone]
    .filter(Boolean)
    .join(' · ')
  const pmN = document.getElementById('pm-nome'),
    pmC = document.getElementById('pm-cargo')
  if (pmN) pmN.textContent = currentUser.nome
  if (pmC) pmC.textContent = currentUser.cargo || ''
  mostrarScreen('app')
  initSupabase()
  syncConfigFromSupabase().catch(() => {})
  syncTabelaFromSupabase().catch(() => {})
  syncTabelaBaseFromSupabase().catch(() => {})
  syncCrmFromSupabase().catch(() => {})
  syncWhatsappFromSupabase().catch(() => {})
  syncVoipFromSupabase().catch(() => {})
  syncIntegPrecosFromSupabase().catch(() => {})
  syncAdicionaisFromSupabase().catch(() => {})
  checkTemplateBanner()
  populateCrmDropdowns()
  populateVoipDropdown()
  renderWhatsFaixasDisplay()
  renderAdicionaisProposal()
  navTo('proposta')
  update()
  setTimeout(checkHubSpotPrefill, 100)
}
function mostrarScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'))
  document.getElementById('screen-' + id).classList.add('active')
}

/* ════════════════════════════════════════
   NAV
════════════════════════════════════════ */
const PAGE_META = {
  proposta: {
    title: 'Nova Proposta — Novos Clientes',
    subtitle: 'Para o time de vendas · Preencha os dados e configure o pacote'
  },
  base: {
    title: 'Nova Proposta — Clientes de Base',
    subtitle: 'Para gestores de conta · Diagnóstico e upsell de clientes ativos'
  },
  historico: { title: 'Histórico de Propostas', subtitle: 'Registro de todas as propostas geradas pela equipe' },
  usuarios: { title: 'Usuários', subtitle: 'Gerencie os membros da equipe de vendas' },
  config: { title: 'Configurações', subtitle: 'Supabase, webhook, template e tabela de preços' }
}
function navTo(page) {
  if ((page === 'usuarios' || page === 'config') && currentUser?.perfil !== 'admin') {
    navTo('proposta')
    showToast('Acesso restrito a administradores.', 'info')
    return
  }
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'))
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'))
  document.getElementById('nav-' + page)?.classList.add('active')
  document.getElementById('page-' + page)?.classList.add('active')
  const m = PAGE_META[page]
  if (m) {
    document.getElementById('page-title').textContent = m.title
    document.getElementById('page-subtitle').textContent = m.subtitle
  }
  if (page === 'usuarios') renderTabela()
  if (page === 'config') {
    initConfig()
    initImportArea()
  }
  if (page === 'base') initBase()
  if (page === 'historico') renderHistorico()
  const nb = document.getElementById('btn-nova-proposta')
  if (nb) nb.style.display = page === 'proposta' || page === 'base' ? 'block' : 'none'
}

/* ════════════════════════════════════════
   USUÁRIOS (CRUD)
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

/* ════════════════════════════════════════
   TABELA DE PREÇOS
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   CONSTANTES (INTEG, WHATS, UTILS)
════════════════════════════════════════ */
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
const WHATSAPP_FAIXAS_DEFAULT = [
  { min: 1, max: 10, preco: 100 },
  { min: 11, max: 25, preco: 90 },
  { min: 26, max: 40, preco: 85 },
  { min: 41, max: 60, preco: 80 },
  { min: 61, max: null, preco: 75 }
]
let _whatsFaixas = null
const WA_CACHE_KEY = 'salesbud_whatsapp_faixas'
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
const fmt = (v) => (v == null || isNaN(v) ? 'Sob consulta' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 }))
function getWhatsPrice(u) {
  const faixas = getWhatsFaixas()
  const tier = faixas.find((t) => u >= t.min && (t.max == null || u <= t.max))
  return tier ? tier.preco : (faixas[faixas.length - 1]?.preco || 75)
}
function getTotalWhats(u) {
  return getWhatsPrice(u) * u
}
function renderWhatsFaixasDisplay() {
  const el = document.getElementById('whats-faixas-display')
  if (!el) return
  const faixas = getWhatsFaixas()
  el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;background:var(--bg);border-bottom:1px solid var(--border)"><div style="padding:6px 10px;font-weight:700;color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.04em">Usuários</div><div style="padding:6px 10px;font-weight:700;color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-align:right">Preço/user</div></div>' +
    faixas.map((f, i) => {
      const label = f.max == null ? `${f.min}+` : `${f.min} – ${f.max}`
      const border = i < faixas.length - 1 ? 'border-bottom:1px solid var(--border)' : ''
      return `<div style="display:grid;grid-template-columns:1fr 1fr;${border}"><div style="padding:6px 10px;color:var(--text2)">${label} users</div><div style="padding:6px 10px;text-align:right;font-weight:600;color:var(--navy)">R$ ${f.preco}/user</div></div>`
    }).join('')
}
function initials(n) {
  return n
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function isCrmNativo(crm) {
  const nativos = ['hubspot', 'pipedrive', 'rd station']
  return nativos.includes((crm || '').toLowerCase())
}

/* ════════════════════════════════════════
   STATE (Novos Clientes)
════════════════════════════════════════ */
function getState(mod) { return mod === 'novo' ? state : stateBase; }
function getPrefix(mod) { return mod === 'novo' ? '' : 'base-'; }

let state = {
  empresa: '',
  crm: '',
  contatoNome: '',
  contatoEmail: '',
  integRegras: false,
  integPipelines: 0,
  integTarefas: false,
  integCampos: 0,
  integVoip: '',
  adicionais: {},
  whatsAtivo: true,
  whatsUsers: 1
}
function toggleIntegRegras(val) {
  state.integRegras = val
  document.getElementById('integ-regras-sim').classList.toggle('active', val)
  document.getElementById('integ-regras-nao').classList.toggle('active', !val)
  update()
}
function toggleIntegTarefas(val) {
  state.integTarefas = val
  document.getElementById('integ-tarefas-sim').classList.toggle('active', val)
  document.getElementById('integ-tarefas-nao').classList.toggle('active', !val)
  update()
}
function toggleAdicional(key, val) {
  state.adicionais[key] = val
  document.getElementById('adic-' + key + '-sim')?.classList.toggle('active', val)
  document.getElementById('adic-' + key + '-nao')?.classList.toggle('active', !val)
  update()
}
function renderAdicionaisProposal() {
  const cfg = getAdicionaisConfig()
  const ativos = Object.entries(cfg).filter(([k, v]) => v.ativo && v.mrr > 0)
  const card = document.getElementById('card-adicionais')
  const container = document.getElementById('adicionais-toggles')
  if (!card || !container) return
  if (!ativos.length) { card.style.display = 'none'; return }
  card.style.display = 'block'
  container.innerHTML = ativos.map(([k, v]) => {
    const isOn = state.adicionais[k] || false
    return `<div class="field-row" style="margin-bottom:8px"><label class="field-label">${esc(v.label)} <span style="font-size:12px;font-weight:600;color:var(--pink)">${fmt(v.mrr)}/mês</span></label><div class="toggle-row"><button class="toggle-btn ${isOn ? '' : 'active'}" id="adic-${k}-nao" onclick="toggleAdicional('${k}',false)">Não</button><button class="toggle-btn ${isOn ? 'active' : ''}" id="adic-${k}-sim" onclick="toggleAdicional('${k}',true)">Sim</button></div></div>`
  }).join('')
}
function populateVoipDropdown() {
  const list = getVoipList()
  const sel = document.getElementById('integ-voip')
  if (!sel) return
  const prev = sel.value
  sel.innerHTML = '<option value="">Sem VOIP</option>' +
    list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('') +
    '<option value="_outro">VOIP não-listado</option>'
  if (prev) sel.value = prev
}
function toggleWhats(val, mod = 'novo') {
  const p = getPrefix(mod)
  const s = getState(mod)
  s.whatsAtivo = val
  document.getElementById(p + 'whats-sim').classList.toggle('active', val)
  document.getElementById(p + 'whats-nao').classList.toggle('active', !val)
  document.getElementById(p + 'whats-' + (mod === 'novo' ? 'users-wrap' : 'wrap')).style.display = val ? 'flex' : 'none'
  mod === 'novo' ? update() : updateBase()
}
function toggleBaseWhats(val) { toggleWhats(val, 'base'); }
function toggleBaseIntegRegras(val) {
  stateBase.integRegras = val
  document.getElementById('base-integ-regras-sim').classList.toggle('active', val)
  document.getElementById('base-integ-regras-nao').classList.toggle('active', !val)
  updateBase()
}
function toggleBaseIntegTarefas(val) {
  stateBase.integTarefas = val
  document.getElementById('base-integ-tarefas-sim').classList.toggle('active', val)
  document.getElementById('base-integ-tarefas-nao').classList.toggle('active', !val)
  updateBase()
}
function toggleBaseAdicional(key, val) {
  stateBase.adicionais[key] = val
  document.getElementById('base-adic-' + key + '-sim')?.classList.toggle('active', val)
  document.getElementById('base-adic-' + key + '-nao')?.classList.toggle('active', !val)
  updateBase()
}
function renderBaseAdicionaisProposal() {
  const cfg = getAdicionaisConfig()
  const ativos = Object.entries(cfg).filter(([k, v]) => v.ativo && v.mrr > 0)
  const card = document.getElementById('base-card-adicionais')
  const container = document.getElementById('base-adicionais-toggles')
  if (!card || !container) return
  if (!ativos.length) { card.style.display = 'none'; return }
  card.style.display = 'block'
  container.innerHTML = ativos.map(([k, v]) => {
    const isOn = stateBase.adicionais[k] || false
    return `<div class="field-row" style="margin-bottom:8px"><label class="field-label">${esc(v.label)} <span style="font-size:12px;font-weight:600;color:var(--pink)">${fmt(v.mrr)}/mês</span></label><div class="toggle-row"><button class="toggle-btn ${isOn ? '' : 'active'}" id="base-adic-${k}-nao" onclick="toggleBaseAdicional('${k}',false)">Não</button><button class="toggle-btn ${isOn ? 'active' : ''}" id="base-adic-${k}-sim" onclick="toggleBaseAdicional('${k}',true)">Sim</button></div></div>`
  }).join('')
}
function populateBaseVoipDropdown() {
  const list = getVoipList()
  const sel = document.getElementById('base-integ-voip')
  if (!sel) return
  const prev = sel.value
  sel.innerHTML = '<option value="">Sem VOIP</option>' +
    list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('') +
    '<option value="_outro">VOIP não-listado</option>'
  if (prev) sel.value = prev
}
function renderBaseWhatsFaixasDisplay() {
  const el = document.getElementById('base-whats-faixas-display')
  if (!el) return
  const faixas = getWhatsFaixas()
  el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;background:var(--bg);border-bottom:1px solid var(--border)"><div style="padding:6px 10px;font-weight:700;color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.04em">Usuários</div><div style="padding:6px 10px;font-weight:700;color:var(--text3);font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-align:right">Preço/user</div></div>' +
    faixas.map((f, i) => {
      const label = f.max == null ? `${f.min}+` : `${f.min} – ${f.max}`
      const border = i < faixas.length - 1 ? 'border-bottom:1px solid var(--border)' : ''
      return `<div style="display:grid;grid-template-columns:1fr 1fr;${border}"><div style="padding:6px 10px;color:var(--text2)">${label} users</div><div style="padding:6px 10px;text-align:right;font-weight:600;color:var(--navy)">R$ ${f.preco}/user</div></div>`
    }).join('')
}

function validarEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}
function validarCampos() {
  let ok = true
  const emp = document.getElementById('empresa').value.trim(),
    eml = document.getElementById('contato-email').value.trim(),
    crm = document.getElementById('crm').value
  const eE = document.getElementById('err-empresa'),
    eM = document.getElementById('err-email'),
    eC = document.getElementById('err-crm'),
    elE = document.getElementById('empresa'),
    elM = document.getElementById('contato-email'),
    elC = document.getElementById('crm')
  if (!emp) {
    eE?.classList.add('show')
    elE?.classList.add('error')
    ok = false
  } else {
    eE?.classList.remove('show')
    elE?.classList.remove('error')
  }
  if (eml && !validarEmail(eml)) {
    eM?.classList.add('show')
    elM?.classList.add('error')
    ok = false
  } else {
    eM?.classList.remove('show')
    elM?.classList.remove('error')
  }
  if (!crm) {
    eC?.classList.add('show')
    elC?.classList.add('error')
    ok = false
  } else {
    eC?.classList.remove('show')
    elC?.classList.remove('error')
  }
  return ok
}

/* ════════════════════════════════════════
   CALCULO MODULAR DE INTEGRACAO (compartilhado)
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   BREAKDOWN COMPARTILHADO
════════════════════════════════════════ */
function renderBreakdown(containerId, dados) {
  const el = document.getElementById(containerId)
  if (!el) return
  const sub = (label, valor) =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0 3px 18px;font-size:13px;color:#64748B"><span style="display:flex;align-items:center;gap:5px"><span style="color:var(--text4);font-family:monospace;font-size:11px">|</span> ${esc(label)}</span><span style="font-weight:600">${fmt(valor)}/mês</span></div>`
  const subSetup = (label, valor) =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0 3px 18px;font-size:13px;color:#64748B"><span style="display:flex;align-items:center;gap:5px"><span style="color:var(--text4);font-family:monospace;font-size:11px">|</span> ${esc(label)}</span><span style="font-weight:600">${fmt(valor)}</span></div>`
  let h = ''
  if (dados.mensalidade)
    h += `<div class="price-row"><span class="price-row-label">Mensalidade</span><span class="price-row-val green">${fmt(dados.mensalidade)}/mês</span></div>`
  if (dados.integMrr > 0) {
    h += `<div class="price-row"><span class="price-row-label">Integração</span><span class="price-row-val amber">${fmt(dados.integMrr)}/mês</span></div>`
    if (dados.integDetalheMrr) {
      for (const item of dados.integDetalheMrr) {
        if (item.valor > 0) h += sub(item.label, item.valor)
      }
    }
  }
  if (dados.adicionaisMrr > 0) {
    h += `<div class="price-row"><span class="price-row-label">Adicionais</span><span class="price-row-val green">${fmt(dados.adicionaisMrr)}/mês</span></div>`
    if (dados.adicionaisDetalhe) {
      for (const item of dados.adicionaisDetalhe) {
        if (item.valor > 0) h += sub(item.label, item.valor)
      }
    }
  }
  const subtotal = dados.mensalidade + dados.integMrr + dados.adicionaisMrr
  const whatsVal = dados.whatsapp?.total || 0
  const whatsUsers = dados.whatsapp?.users || 0
  if (subtotal && (dados.integMrr > 0 || dados.adicionaisMrr > 0 || whatsVal > 0))
    h += `<div class="price-row" style="border-top:1px solid var(--border2);margin-top:2px"><span class="price-row-label" style="color:var(--text3)">Subtotal</span><span class="price-row-val" style="color:var(--text2);font-size:13px">${fmt(subtotal)}/mês</span></div>`
  if (whatsVal > 0)
    h += `<div class="price-row"><span class="price-row-label">WhatsApp (${whatsUsers} users)</span><span class="price-row-val green">${fmt(whatsVal)}/mês</span></div>`
  const totalComWA = dados.totalComWA || subtotal + whatsVal
  const totalSemWA = dados.totalSemWA || subtotal
  if (totalComWA) {
    const sep = 'border-top:2px solid var(--navy);margin-top:4px'
    if (whatsVal > 0) {
      h += `<div class="price-row total" style="${sep}"><span class="price-row-total-label">Total s/ WA</span><span class="price-row-total-val" style="font-size:15px;color:var(--text2)">${fmt(totalSemWA)}/mês</span></div>`
      h += `<div class="price-row total" style="padding-top:6px"><span class="price-row-total-label">Total c/ WA</span><span class="price-row-total-val">${fmt(totalComWA)}/mês</span></div>`
    } else {
      h += `<div class="price-row total" style="${sep}"><span class="price-row-total-label">Total mensal</span><span class="price-row-total-val">${fmt(totalComWA)}/mês</span></div>`
    }
  }
  if (dados.setupTotal > 0) {
    h += `<div class="price-row" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)"><span class="price-row-label" style="color:var(--text3)">+ Setup <span style="font-size:11px;font-weight:400">(implantação · pontual)</span></span><span class="price-row-val" style="font-size:14px;font-weight:700;color:var(--pink)">${fmt(dados.setupTotal)}</span></div>`
    if (dados.setupDetalhe) {
      for (const item of dados.setupDetalhe) {
        if (item.valor > 0) h += subSetup(item.label, item.valor)
      }
    }
  }
  if (dados.voip && dados.voip.label && dados.voip.label !== 'Sem VOIP') {
    const voipText = dados.voip.incluso ? `VOIP: ${esc(dados.voip.label)} (incluso)` : `VOIP: ${esc(dados.voip.label)} (consultar)`
    h += `<div style="margin-top:8px;font-size:13px;color:var(--text2);font-weight:600">${voipText}</div>`
  }
  el.innerHTML = h
}

/* ════════════════════════════════════════
   UPDATE / CALCULOS (Novos Clientes)
════════════════════════════════════════ */
function update() {
  state.empresa = document.getElementById('empresa').value.trim()
  state.crm = document.getElementById('crm').value
  const crmApiEl = document.getElementById('crm-api-aviso')
  if (crmApiEl) crmApiEl.style.display = state.crm === 'api-aberta' ? 'block' : 'none'
  state.contatoNome = document.getElementById('contato-nome')?.value.trim() || ''
  state.contatoEmail = document.getElementById('contato-email')?.value.trim() || ''
  /* ── Validação em tempo real ── */
  const _empEl = document.getElementById('empresa'),
    _emlEl = document.getElementById('contato-email')
  if (_empEl && !_empEl._blurListenerAdded) {
    _empEl.addEventListener('blur', () => {
      _empEl._dirty = true
      update()
    })
    _empEl._blurListenerAdded = true
  }
  if (_empEl?._dirty && !state.empresa) {
    document.getElementById('err-empresa')?.classList.add('show')
    _empEl.classList.add('error')
  } else if (state.empresa) {
    document.getElementById('err-empresa')?.classList.remove('show')
    _empEl?.classList.remove('error')
  }
  if (state.contatoEmail && !validarEmail(state.contatoEmail)) {
    document.getElementById('err-email')?.classList.add('show')
    _emlEl?.classList.add('error')
  } else {
    document.getElementById('err-email')?.classList.remove('show')
    _emlEl?.classList.remove('error')
  }
  if (state.crm) {
    document.getElementById('err-crm')?.classList.remove('show')
    document.getElementById('crm')?.classList.remove('error')
  }
  state.whatsUsers = parseInt(document.getElementById('whats-users')?.value) || 0

  let hd = parseInt(document.getElementById('horas-input').value) || 0
  if (hd > 0 && hd < 50) { hd = 50; document.getElementById('horas-input').value = 50 }
  const r = calcPrecoExato(hd)
  const aA = document.getElementById('horas-acima-aviso'),
    aI = document.getElementById('horas-interpolado-aviso')
  if (r.acimaDaTabela) {
    if (aA) {
      aA.style.display = 'flex'
      document.getElementById('horas-acima-calc').textContent =
        `${hd.toLocaleString('pt-BR')}h × R$ ${r.precoHora.toFixed(3)}/h = ${fmt(r.precoEfetivo)}/mês`
    }
    if (aI) aI.style.display = 'none'
  } else if (r.interpolado) {
    const tab2 = getTabelaAtiva(),
      proxFaixa = tab2.find((t) => t.horas > hd)
    if (aI) {
      aI.style.display = 'flex'
      document.getElementById('horas-interpolado-calc').textContent =
        `${hd.toLocaleString('pt-BR')}h × R$ ${r.precoHora.toFixed(3)}/h = ${fmt(r.precoEfetivo)}/mês`
      const pf = document.getElementById('horas-proxima-faixa')
      const bArr = document.getElementById('btn-arredondar')
      if (pf && proxFaixa) {
        pf.textContent = `Próxima faixa: ${proxFaixa.horas.toLocaleString('pt-BR')}h = ${fmt(proxFaixa.preco)}/mês`
        if (bArr) {
          bArr.textContent = `↑ ${proxFaixa.horas.toLocaleString('pt-BR')}h`
          bArr.dataset.target = proxFaixa.horas
        }
      } else if (pf) {
        pf.textContent = ''
      }
    }
    if (aA) aA.style.display = 'none'
  } else {
    if (aA) aA.style.display = 'none'
    if (aI) aI.style.display = 'none'
  }
  document.getElementById('horas-label').textContent = r.horasEfetivas.toLocaleString('pt-BR') + 'h'
  document.getElementById('pacote-preco-label').textContent = fmt(r.precoEfetivo)
  const tLen = getTabelaAtiva().length
  document.getElementById('pacote-idx-label').textContent = r.acimaDaTabela
    ? `R$ ${r.precoHora.toFixed(3)}/h (acima da tabela)`
    : r.interpolado
      ? `interpolado · R$ ${r.precoHora.toFixed(3)}/h`
      : `pacote ${r.tierIdx + 1} de ${tLen}`
  /* Integration — modular components */
  state.integRegras = document.getElementById('integ-regras-sim')?.classList.contains('active') || false
  state.integPipelines = parseInt(document.getElementById('integ-pipelines')?.value) || 0
  state.integTarefas = document.getElementById('integ-tarefas-sim')?.classList.contains('active') || false
  state.integCampos = parseInt(document.getElementById('integ-campos')?.value) || 0
  state.integVoip = document.getElementById('integ-voip')?.value || ''
  const { ip, isRd, setupCrm, setupRegras, setupPipelines, setupTarefas, setupCampos, blocosC, mrrTarefas, mrrCampos, setupTotal, mrrInteg } = calcIntegModular(state)
  /* RD Station: nota visual */
  const notaRd = document.getElementById('integ-nota-rd')
  if (isRd && state.integCampos > 0) {
    if (notaRd) notaRd.style.display = 'block'
  } else {
    if (notaRd) notaRd.style.display = 'none'
  }
  /* Adicionais */
  const adicCfg = getAdicionaisConfig()
  let mrrAdicionais = 0
  for (const [k, v] of Object.entries(adicCfg)) {
    if (v.ativo && v.mrr > 0 && state.adicionais[k]) mrrAdicionais += v.mrr
  }
  /* VOIP tag */
  const voipTag = document.getElementById('integ-voip-tag')
  if (voipTag) {
    if (state.integVoip === '_outro') {
      voipTag.style.display = 'inline-block'
      voipTag.textContent = 'Consultar'
      voipTag.style.background = '#FFF7ED'
      voipTag.style.color = '#92400E'
      voipTag.style.border = '1.5px solid #FED7AA'
    } else if (state.integVoip) {
      voipTag.style.display = 'inline-block'
      voipTag.textContent = 'Incluso'
      voipTag.style.background = '#F0FDF4'
      voipTag.style.color = '#166534'
      voipTag.style.border = '1.5px solid #BBF7D0'
    } else {
      voipTag.style.display = 'none'
    }
  }
  const precoBase = r.precoEfetivo,
    precoFinal = precoBase || null
  const mensalSB = precoFinal != null ? precoFinal + mrrInteg + mrrAdicionais : null
  const whatsTotal = state.whatsAtivo && state.whatsUsers > 0 ? getTotalWhats(state.whatsUsers) : 0
  const whatsPreco = state.whatsAtivo && state.whatsUsers > 0 ? getWhatsPrice(state.whatsUsers) : 0
  const totalGeral = mensalSB != null ? mensalSB + whatsTotal : null /* TOTAL GERAL */
  const compEl = document.getElementById('company-display')
  if (state.empresa) {
    compEl.textContent = state.empresa
    compEl.classList.remove('empty')
  } else {
    compEl.textContent = 'Nome da empresa'
    compEl.classList.add('empty')
  }
  const pills = document.getElementById('meta-pills')
  pills.innerHTML = ''
  if (state.crm) pills.innerHTML += `<div class="meta-pill">CRM <span>${esc(state.crm)}</span></div>`
  pills.innerHTML += `<div class="meta-pill">Horas <span>${r.horasEfetivas.toLocaleString('pt-BR')}h/mês</span></div>`
  if (state.whatsAtivo && state.whatsUsers > 0)
    pills.innerHTML += `<div class="meta-pill">WhatsApp <span>${state.whatsUsers} users</span></div>`

  /* topo do card: total geral */
  document.getElementById('price-main').textContent = totalGeral != null ? fmt(totalGeral) : '—'
  const pmSub = document.getElementById('price-main-sub')
  if (pmSub) {
    if (whatsTotal > 0 && mensalSB != null) {
      pmSub.style.display = 'block'
      pmSub.textContent = `s/ WhatsApp: ${fmt(mensalSB)}/mês`
    } else pmSub.style.display = 'none'
  }
  /* BREAKDOWN */
  {
    const integDetail = []
    if (mrrTarefas > 0) integDetail.push({ label: 'Tarefas automáticas', valor: mrrTarefas })
    if (mrrCampos > 0) integDetail.push({ label: 'Campos personalizados (' + state.integCampos + ')', valor: mrrCampos })
    const adicDetail = []
    for (const [k, v] of Object.entries(adicCfg)) {
      if (v.ativo && v.mrr > 0 && state.adicionais[k])
        adicDetail.push({ label: v.label, valor: v.mrr })
    }
    const setupDetail = []
    if (setupCrm > 0) setupDetail.push({ label: 'CRM personalizado', valor: setupCrm })
    if (setupRegras > 0) setupDetail.push({ label: 'Personalização de regras', valor: setupRegras })
    if (setupPipelines > 0) setupDetail.push({ label: 'Pipelines adicionais (' + state.integPipelines + ')', valor: setupPipelines })
    if (setupTarefas > 0) setupDetail.push({ label: 'Tarefas automáticas', valor: setupTarefas })
    if (setupCampos > 0) setupDetail.push({ label: 'Campos personalizados (' + state.integCampos + ')', valor: setupCampos })
    const voipVal = state.integVoip || ''
    renderBreakdown('price-rows', {
      mensalidade: precoBase,
      integMrr: mrrInteg,
      integDetalheMrr: integDetail,
      adicionaisMrr: mrrAdicionais,
      adicionaisDetalhe: adicDetail,
      whatsapp: { total: whatsTotal, users: state.whatsUsers },
      totalSemWA: mensalSB,
      totalComWA: totalGeral,
      setupTotal,
      setupDetalhe: setupDetail,
      voip: voipVal && voipVal !== '_outro'
        ? { label: voipVal, incluso: true }
        : voipVal === '_outro' ? { label: 'não-listado', incluso: false } : null
    })
  }
  document.getElementById('premium-alert').style.display = 'none'
  renderPayload(r.horasEfetivas, precoFinal, mensalSB, totalGeral, whatsTotal, whatsPreco, setupTotal, mrrInteg, mrrAdicionais)
  const horasOk = hd > 0,
    emailOk = !state.contatoEmail || validarEmail(state.contatoEmail),
    canGen = state.empresa && precoFinal != null && horasOk && emailOk
  document.getElementById('btn-gen').disabled = !canGen

  const tip = document.getElementById('btn-gen-tooltip')
  if (tip) {
    if (!state.empresa) tip.textContent = 'Preencha o nome da empresa'
    else if (!horasOk) tip.textContent = 'Informe o volume de horas'
    else if (!emailOk) tip.textContent = 'E-mail inválido'
    else tip.textContent = 'Pronto para gerar!'
  }
}

/* ════════════════════════════════════════
   PAYLOAD (Novos Clientes)
════════════════════════════════════════ */
function renderPayload(horasEfetivas, precoFinal, mensalSB, totalGeral, whatsTotal, whatsPreco, setupTotal, mrrInteg, mrrAdicionais) {
  if (!currentUser) return
  const cfg = loadConfig(),
    hoje = new Date(),
    val = new Date(hoje.getTime() + 15 * 86400000), // Validade fixa: 15 dias
    fmtD = (d) => d.toLocaleDateString('pt-BR')
  /* Build detalhamentos de integração */
  const { ip, isRd, setupCrm: _sCrm, setupRegras: _sRegras, setupPipelines: _sPipe, setupTarefas: _sTar, setupCampos: _sCamp, blocosC: _bC, mrrTarefas: _mTar, mrrCampos: _mCamp } = calcIntegModular(state)
  const setupDetailParts = []
  if (_sCrm > 0) setupDetailParts.push('CRM personalizado ' + fmt(_sCrm))
  if (_sRegras > 0) setupDetailParts.push('Personalização de regras ' + fmt(_sRegras))
  if (_sPipe > 0) setupDetailParts.push(state.integPipelines + (_sPipe / (ip.pipeline_adicional_setup || 400) === 1 ? ' pipeline adicional ' : ' pipelines adicionais ') + fmt(_sPipe))
  if (_sTar > 0) setupDetailParts.push('Tarefas automáticas ' + fmt(_sTar))
  if (_sCamp > 0) setupDetailParts.push(state.integCampos + ' campos (' + _bC + (_bC === 1 ? ' bloco) ' : ' blocos) ') + fmt(_sCamp))
  const isCrmNat = isCrmNativo(state.crm) || state.crm === ''
  const descSetup = setupDetailParts.length
    ? setupDetailParts.join(' + ')
    : (isCrmNat ? 'Setup gratuito (CRM nativo)' : 'Integração padrão')
  const mrrDetailParts = []
  if (_mTar > 0) mrrDetailParts.push('Tarefas automáticas ' + fmt(_mTar) + '/mês')
  if (_mCamp > 0) mrrDetailParts.push('Campos personalizados (' + state.integCampos + ') ' + fmt(_mCamp) + '/mês')
  const mrrDetalhe = mrrDetailParts.length ? mrrDetailParts.join(' + ') : 'Integração padrão (sem custo adicional)'
  /* Build adicionais list */
  const adicCfg = getAdicionaisConfig()
  const adicAtivos = []
  let adicTotal = 0
  for (const [k, v] of Object.entries(adicCfg)) {
    if (v.ativo && v.mrr > 0 && state.adicionais[k]) {
      adicAtivos.push(v.label + ' ' + fmt(v.mrr) + '/mês')
      adicTotal += v.mrr
    }
  }
  /* VOIP status */
  const voipVal = state.integVoip || ''
  const voipStatus = voipVal === '_outro' ? 'Consultar' : voipVal ? 'Incluso' : 'Não incluso'
  const voipLabel = voipVal === '_outro' ? 'VOIP não-listado' : voipVal || 'Sem VOIP'
  const data = {
    nome_empresa: state.empresa || '',
    crm_cliente: state.crm || '',
    contato_nome: state.contatoNome || '',
    contato_email: state.contatoEmail || '',
    titulo_proposta: `Salesbud - Apresentacao e Proposta - ${state.empresa || '(empresa)'}`,
    pacote_horas: String(horasEfetivas),
    preco_mensalidade: precoFinal ? fmt(precoFinal) + '/mês' : 'Sob consulta',
    fee_manutencao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : 'Não incluso',
    preco_whatsapp:
      state.whatsAtivo && state.whatsUsers > 0
        ? `${fmt(whatsTotal)}/mês para ${state.whatsUsers} usuários`
        : 'Não incluso',
    total_geral_mes: totalGeral != null ? fmt(totalGeral) + '/mês' : 'Sob consulta',
    detalhe_desconto: 'Preço padrão', // Valor fixo — desconto removido da UI
    preco_setup: setupTotal > 0 ? fmt(setupTotal) : 'Gratuito',
    descricao_setup: descSetup,
    vendedor_nome: currentUser.nome,
    vendedor_email: currentUser.email,
    vendedor_telefone: currentUser.telefone || '',
    vendedor_cidade: currentUser.cidade || '',
    desconto_pct: 0, // Valor fixo — desconto removido da UI
    template_url: cfg.templateUrl || '',
    template_versao: cfg.templateVersao || '',
    data_proposta: fmtD(hoje),
    validade_proposta: fmtD(val),
    tipo_proposta: 'novo',
    plano_integracao: 'modular',
    // Componentes de integração — detalhes
    personalizacao_regras: state.integRegras ? 'Sim' : 'Não',
    pipelines_adicionais: String(state.integPipelines),
    tarefas_automaticas: state.integTarefas ? 'Sim' : 'Não',
    campos_personalizados: String(state.integCampos),
    campos_blocos: String(_bC),
    voip_cliente: voipLabel,
    voip_status: voipStatus,
    // Totais de integração
    setup_total: setupTotal > 0 ? fmt(setupTotal) : 'Gratuito',
    setup_detalhamento: descSetup,
    mrr_integracao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : 'Não incluso',
    mrr_integracao_detalhamento: mrrDetalhe,
    // Adicionais
    adicionais_lista: adicAtivos.length ? adicAtivos.join('; ') : 'Nenhum',
    adicionais_total: adicTotal > 0 ? fmt(adicTotal) + '/mês' : 'Não incluso',
    // Legado — backward compatibility
    integ_regras: state.integRegras,
    integ_pipelines: state.integPipelines,
    integ_tarefas: state.integTarefas,
    integ_campos: state.integCampos,
    integ_voip: state.integVoip || 'Sem VOIP',
    mrr_adicionais: mrrAdicionais,
    adicionais_ativos: adicAtivos.length ? adicAtivos.join('; ') : 'Nenhum',
    preco_setup_basico: isCrmNat ? 'Gratuito' : fmt(ip.crm_personalizado_setup),
    total_avancado: totalGeral != null ? fmt(totalGeral) + '/mês' : 'Sob consulta'
  }
  const colored = JSON.stringify(data, null, 2)
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="json-str">"$1"</span>')
  document.getElementById('payload').innerHTML = colored
}
function copyPayload() {
  navigator.clipboard
    .writeText(document.getElementById('payload').textContent)
    .then(() => showToast('Payload copiado!', 'success'))
}

/* ════════════════════════════════════════
   GERAR PROPOSTA
════════════════════════════════════════ */
async function enviarWebhook(payloadText, btnEl, btnTextoOriginal, onSuccess) {
  const wh = getWebhookUrl()
  if (!wh || wh === CONFIG_DEFAULT.webhookUrl) {
    showFallback(payloadText, null)
    btnEl.innerHTML = btnTextoOriginal
    btnEl.disabled = false
    return
  }
  const makeReq = async () => {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 60000)
    const etapas = [
      { t: 0,     txt: 'Enviando proposta...' },
      { t: 5000,  txt: 'Gerando apresentação...' },
      { t: 15000, txt: 'Exportando PDF...' },
      { t: 25000, txt: 'Quase lá...' }
    ]
    const timers = etapas.map((e) => setTimeout(() => { btnEl.innerHTML = `<span class="spinner"></span> ${e.txt}`; }, e.t))
    const clearEtapas = () => timers.forEach(clearTimeout)
    try {
      const r = await fetch(wh, { method: 'POST', headers: getWebhookHeaders(), body: payloadText, signal: ctrl.signal })
      clearTimeout(to)
      clearEtapas()
      if (r.ok) {
        await onSuccess()
        btnEl.innerHTML = 'Proposta enviada!'
        btnEl.style.background = 'var(--green)'
        showToast('Proposta enviada! Verifique o Gmail.', 'success')
        setTimeout(() => { btnEl.innerHTML = btnTextoOriginal; btnEl.style.background = ''; btnEl.disabled = false; }, 4000)
      } else {
        throw new Error('HTTP ' + r.status)
      }
    } catch (e) {
      clearTimeout(to)
      clearEtapas()
      btnEl.innerHTML = btnTextoOriginal
      btnEl.style.background = ''
      btnEl.disabled = false
      showFallback(payloadText, makeReq)
    }
  }
  await makeReq()
}
async function gerarProposta() {
  if (!validarCampos()) { showToast('Corrija os campos em destaque.', 'info'); return; }
  const btn = document.getElementById('btn-gen')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Enviando...'
  const pr = document.getElementById('payload').textContent
  let po = {}
  try { po = JSON.parse(pr) } catch { showToast('Erro interno: payload inválido.', 'info'); btn.disabled = false; btn.innerHTML = 'Gerar Proposta'; return; }
  const reg = await histAdd({ ...po, tipo_proposta: po.tipo_proposta || 'novo', status_proposta: 'rascunho' })
  await enviarWebhook(pr, btn, 'Gerar Proposta', async () => {
    if (reg) await _salvarStatusProposta(reg.id, 'enviada', null, reg.fonte)
  })
}

/* ════════════════════════════════════════
   CALCULADORA DE HORAS
════════════════════════════════════════ */
function calcPreviewHoras() {
  const u = parseFloat(document.getElementById('calc-usuarios').value) || 0,
    h = parseFloat(document.getElementById('calc-hdia').value) || 0,
    d = parseFloat(document.getElementById('calc-dias').value) || 0,
    t = Math.round(u * h * d),
    el = document.getElementById('calc-resultado')
  el.textContent = '~' + t.toLocaleString('pt-BR') + 'h/mês'
  el.dataset.valor = t
  document.getElementById('calc-formula').textContent = `${u} usuário(s) × ${h}h × ${d} dias`
}
function aplicarCalcHoras() {
  const t = parseInt(document.getElementById('calc-resultado').dataset.valor) || 0
  if (!t) return
  document.getElementById('horas-input').value = Math.max(50, t)
  update()
}

/* ════════════════════════════════════════
   RESET (Novos Clientes)
════════════════════════════════════════ */
function resetState() {
  state = {
    empresa: '',
    crm: '',
    contatoNome: '',
    contatoEmail: '',
    integRegras: false,
    integPipelines: 0,
    integTarefas: false,
    integCampos: 0,
    integVoip: '',
    adicionais: {},
    whatsAtivo: true,
    whatsUsers: 1
  }
  ;['empresa', 'contato-nome', 'contato-email'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  document.getElementById('crm').value = ''
  document.getElementById('horas-input').value = '50'
  document.getElementById('whats-users').value = '1'
  /* Reset modular integration controls */
  document.getElementById('integ-regras-nao')?.classList.add('active')
  document.getElementById('integ-regras-sim')?.classList.remove('active')
  document.getElementById('integ-tarefas-nao')?.classList.add('active')
  document.getElementById('integ-tarefas-sim')?.classList.remove('active')
  const pipEl = document.getElementById('integ-pipelines')
  if (pipEl) pipEl.value = '0'
  const camposEl = document.getElementById('integ-campos')
  if (camposEl) camposEl.value = '0'
  const voipEl = document.getElementById('integ-voip')
  if (voipEl) voipEl.value = ''
  renderAdicionaisProposal()
  document.getElementById('whats-sim').classList.add('active')
  document.getElementById('whats-nao').classList.remove('active')
  document.getElementById('whats-users-wrap').style.display = 'flex'
  ;['err-empresa', 'err-email', 'err-crm'].forEach((id) => document.getElementById(id)?.classList.remove('show'))
  ;['empresa', 'contato-email', 'crm'].forEach((id) => document.getElementById(id)?.classList.remove('error'))
  const _eEl = document.getElementById('empresa')
  if (_eEl) _eEl._dirty = false
  update()
}
function novaPropostaConfirm() {
  const p = document.querySelector('.page.active')?.id,
    d = p === 'page-proposta' ? state.empresa || state.crm : stateBase.empresa || stateBase.crm || stateBase.valorAtual
  if (d && !confirm('Limpar o formulário e começar nova proposta?')) return
  if (p === 'page-base') resetStateBase()
  else resetState()
}

/* ════════════════════════════════════════
   STATE / UPDATE / PAYLOAD (Clientes de Base)
════════════════════════════════════════ */
const stateBase = {
  empresa: '',
  crm: '',
  contatoNome: '',
  contatoEmail: '',
  horasAtual: 0,
  valorAtual: 0,
  usuariosAtual: 5,
  integKey: 'basico',
  integRegras: false,
  integPipelines: 0,
  integTarefas: false,
  integCampos: 0,
  integVoip: '',
  adicionais: {},
  whatsAtivo: true,
  whatsUsers: 1,
  diag: {
    crm: false,
    crmNativo: false,
    campos: false,
    nCampos: 3,
    voip: false,
    voipNativo: false,
    voipCampos: false,
    whats: false,
    cs: false,
    extras: false
  }
}
function initBase() {
  const u = currentUser
  if (u) {
    document.getElementById('base-chip-avatar').textContent = initials(u.nome)
    document.getElementById('base-chip-name').textContent = u.nome
    document.getElementById('base-chip-sub').textContent = `${u.cargo} · ${u.cidade}`
  }
  populateBaseVoipDropdown()
  renderBaseWhatsFaixasDisplay()
  renderBaseAdicionaisProposal()
  updateBase()
}
function baseCalcPreview() {
  const u = parseFloat(document.getElementById('base-calc-usuarios')?.value) || 0,
    h = parseFloat(document.getElementById('base-calc-hdia')?.value) || 0,
    d = parseFloat(document.getElementById('base-calc-dias')?.value) || 0,
    t = Math.round(u * h * d),
    el = document.getElementById('base-calc-resultado')
  if (el) {
    el.textContent = '~' + t.toLocaleString('pt-BR') + 'h'
    el.dataset.valor = t
  }
  const f = document.getElementById('base-calc-formula')
  if (f) f.textContent = `${u} × ${h}h × ${d} dias`
}
function aplicarBaseCalc() {
  const t = parseInt(document.getElementById('base-calc-resultado')?.dataset.valor) || 0
  if (!t) return
  const horasAtuais = parseInt(document.getElementById('base-horas-atual')?.value) || 0
  const totalDesejado = Math.max(50, t)
  const adicional = Math.max(0, totalDesejado - horasAtuais)
  document.getElementById('base-horas-input').value = adicional
  updateBase()
}
const DIAG_ID = {
  crm: 'diag-crm',
  crmNativo: 'diag-crmnativo',
  campos: 'diag-campos',
  voip: 'diag-voip',
  voipNativo: 'diag-voipnativo',
  voipCampos: 'diag-voipcampos',
  whats: 'diag-whats',
  cs: 'diag-cs',
  extras: 'diag-extras'
}
function setDiag(key, val) {
  stateBase.diag[key] = val
  const base = DIAG_ID[key]
  if (base) {
    document.getElementById(base + '-sim')?.classList.toggle('active', val)
    document.getElementById(base + '-nao')?.classList.toggle('active', !val)
  }
  document.getElementById('diag-crm-sub')?.style.setProperty('display', stateBase.diag.crm ? 'block' : 'none')
  document.getElementById('diag-voip-sub')?.style.setProperty('display', stateBase.diag.voip ? 'block' : 'none')
  document.getElementById('diag-campos-sub')?.style.setProperty('display', stateBase.diag.campos ? 'block' : 'none')
  updateBase()
}
function updateBase() {
  stateBase.empresa = document.getElementById('base-empresa')?.value.trim() || ''
  stateBase.crm = document.getElementById('base-crm')?.value || ''
  stateBase.contatoNome = document.getElementById('base-contato-nome')?.value.trim() || ''
  stateBase.contatoEmail = document.getElementById('base-contato-email')?.value.trim() || ''
  stateBase.horasAtual = parseInt(document.getElementById('base-horas-atual')?.value) || 0
  stateBase.valorAtual = parseFloat(document.getElementById('base-valor-atual')?.value) || 0
  stateBase.usuariosAtual = parseInt(document.getElementById('base-usuarios-atual')?.value) || 0
  stateBase.whatsUsers = parseInt(document.getElementById('base-whats-users')?.value) || 1
  stateBase.whatsAtual = parseInt(document.getElementById('base-whats-atual')?.value) || 0
  stateBase.diag.nCampos = parseInt(document.getElementById('diag-ncampos')?.value) || 0
  /* Read modular integration fields from DOM */
  stateBase.integRegras = document.getElementById('base-integ-regras-sim')?.classList.contains('active') || false
  stateBase.integPipelines = parseInt(document.getElementById('base-integ-pipelines')?.value) || 0
  stateBase.integTarefas = document.getElementById('base-integ-tarefas-sim')?.classList.contains('active') || false
  stateBase.integCampos = parseInt(document.getElementById('base-integ-campos')?.value) || 0
  stateBase.integVoip = document.getElementById('base-integ-voip')?.value || ''
  const horasAdicionais = parseInt(document.getElementById('base-horas-input')?.value) || 0
  const totalHoras = stateBase.horasAtual + horasAdicionais
  const r = calcPrecoExato(totalHoras, 'base')
  const precoBase = r.precoEfetivo,
    precoFinal = precoBase
  /* Resumo horas: Atual Xh + Adicional Yh = Novo pacote Zh */
  const resumoEl = document.getElementById('base-horas-resumo')
  if (resumoEl) {
    if (totalHoras > 0 && totalHoras < 50) {
      resumoEl.style.display = 'block'
      resumoEl.innerHTML = `<span style="color:#D97706">Pacote total (${totalHoras}h) abaixo do minimo de 50h</span>`
    } else if (horasAdicionais > 0 && stateBase.horasAtual > 0) {
      resumoEl.style.display = 'block'
      resumoEl.textContent = `Atual: ${stateBase.horasAtual}h + Adicional: ${horasAdicionais}h = Novo pacote: ${totalHoras}h`
    } else { resumoEl.style.display = 'none' }
  }
  let setupTotal = 0, mrrInteg = 0, blocosC = 0, setupCrm = 0, setupRegras = 0, setupPipelines = 0, setupTarefas = 0, setupCampos = 0, mrrTarefas = 0, mrrCampos = 0
  {
    const calc = calcIntegModular(stateBase)
    setupTotal = calc.setupTotal; mrrInteg = calc.mrrInteg; blocosC = calc.blocosC
    setupCrm = calc.setupCrm; setupRegras = calc.setupRegras; setupPipelines = calc.setupPipelines
    setupTarefas = calc.setupTarefas; setupCampos = calc.setupCampos
    mrrTarefas = calc.mrrTarefas; mrrCampos = calc.mrrCampos
    const notaRd = document.getElementById('base-integ-nota-rd')
    if (notaRd) notaRd.style.display = calc.isRd && stateBase.integCampos > 0 ? 'block' : 'none'
  }
  // VOIP tag
  const voipTag = document.getElementById('base-integ-voip-tag')
  if (voipTag) {
    if (stateBase.integVoip === '_outro') {
      voipTag.style.display = 'inline-block'; voipTag.textContent = 'Consultar'
      voipTag.style.background = '#FFF7ED'; voipTag.style.color = '#92400E'; voipTag.style.border = '1.5px solid #FED7AA'
    } else if (stateBase.integVoip) {
      voipTag.style.display = 'inline-block'; voipTag.textContent = 'Incluso'
      voipTag.style.background = '#F0FDF4'; voipTag.style.color = '#166534'; voipTag.style.border = '1.5px solid #BBF7D0'
    } else { voipTag.style.display = 'none' }
  }
  // Adicionais
  const adicResult = calcAdicionaisMrr(stateBase)
  const mrrAdicionais = adicResult.total
  const whatsTotal = stateBase.whatsAtivo ? getTotalWhats(stateBase.whatsUsers) : 0,
    whatsPreco = stateBase.whatsAtivo ? getWhatsPrice(stateBase.whatsUsers) : 0
  const totalMensal = precoFinal + mrrInteg + mrrAdicionais + whatsTotal
  document.getElementById('base-horas-label').textContent = r.horasEfetivas.toLocaleString('pt-BR') + 'h'
  const tLen = getTabelaBaseAtiva().length
  document.getElementById('base-pacote-idx').textContent = r.acimaDaTabela
    ? `R$ ${r.precoHora.toFixed(3)}/h (acima da tabela)`
    : r.interpolado
      ? `interpolado · R$ ${r.precoHora.toFixed(3)}/h`
      : `pacote ${r.tierIdx + 1} de ${tLen}`
  document.getElementById('base-preco-label').textContent = fmt(precoFinal)

  const bTgh = document.getElementById('base-total-label-header'),
    bTgl = document.getElementById('base-total-geral-label')
  if (bTgh && bTgl) {
    if (whatsTotal > 0 || mrrInteg > 0 || mrrAdicionais > 0) {
      bTgh.style.display = 'block'
      bTgl.style.display = 'block'
      bTgl.textContent = fmt(totalMensal) + '/mês'
    } else {
      bTgh.style.display = 'none'
      bTgl.style.display = 'none'
    }
  }
  const dl = document.getElementById('base-delta-label')
  if (dl && stateBase.valorAtual > 0) {
    const dv = totalMensal - stateBase.valorAtual,
      p = Math.round((Math.abs(dv) / stateBase.valorAtual) * 100),
      s = dv > 0 ? '+' : dv < 0 ? '-' : ''
    dl.innerHTML =
      dv !== 0
        ? `<span style="color:${dv > 0 ? 'var(--pink)' : 'var(--green)'};font-weight:700">${s}${fmt(Math.abs(dv))}/mês</span> <span style="opacity:.5">(${s}${p}%)</span>`
        : `<span style="opacity:.6">Mesmo valor atual</span>`
  } else if (dl) dl.textContent = ''
  const cc = document.getElementById('base-comparativo')
  if (stateBase.horasAtual > 0 && cc) {
    cc.style.display = 'block'
    document.getElementById('base-comp-atual-horas').textContent =
      stateBase.horasAtual.toLocaleString('pt-BR') + 'h/mês'
    document.getElementById('base-comp-atual-preco').textContent =
      stateBase.valorAtual > 0 ? fmt(stateBase.valorAtual) + '/mês' : '—'
    document.getElementById('base-comp-novo-horas').textContent = r.horasEfetivas.toLocaleString('pt-BR') + 'h/mês'
    document.getElementById('base-comp-novo-preco').textContent = fmt(totalMensal) + '/mês'
    const dc = document.getElementById('base-delta-card')
    if (dc && stateBase.valorAtual > 0) {
      const dv = totalMensal - stateBase.valorAtual,
        p = Math.round((dv / stateBase.valorAtual) * 100),
        s = dv >= 0 ? '+' : ''
      dc.style.background = dv > 0 ? 'rgba(251,36,145,.08)' : 'rgba(0,196,140,.08)'
      dc.style.color = dv > 0 ? 'var(--pink)' : 'var(--green)'
      dc.innerHTML = `<span style="font-size:15px;font-weight:800">${s}${fmt(dv)}/mês</span><span style="font-size:11px;font-weight:600;opacity:.7;margin-left:8px">(${s}${p}% vs atual)</span>`
    }
  } else if (cc) cc.style.display = 'none'
  /* BREAKDOWN */
  {
    const mensalSB = precoFinal + mrrInteg + mrrAdicionais
    const integDetail = []
    if (mrrTarefas > 0) integDetail.push({ label: 'Tarefas automáticas', valor: mrrTarefas })
    if (mrrCampos > 0) integDetail.push({ label: 'Campos personalizados (' + stateBase.integCampos + ')', valor: mrrCampos })
    const adicDetail = []
    for (const [k, v] of Object.entries(adicResult.cfg)) {
      if (v.ativo && v.mrr > 0 && stateBase.adicionais[k])
        adicDetail.push({ label: v.label, valor: v.mrr })
    }
    const setupDetail = []
    if (setupCrm > 0) setupDetail.push({ label: 'CRM personalizado', valor: setupCrm })
    if (setupRegras > 0) setupDetail.push({ label: 'Personalização de regras', valor: setupRegras })
    if (setupPipelines > 0) setupDetail.push({ label: 'Pipelines adicionais (' + stateBase.integPipelines + ')', valor: setupPipelines })
    if (setupTarefas > 0) setupDetail.push({ label: 'Tarefas automáticas', valor: setupTarefas })
    if (setupCampos > 0) setupDetail.push({ label: 'Campos personalizados (' + stateBase.integCampos + ')', valor: setupCampos })
    const voipVal = stateBase.integVoip || ''
    renderBreakdown('base-price-rows', {
      mensalidade: precoBase,
      integMrr: mrrInteg,
      integDetalheMrr: integDetail,
      adicionaisMrr: mrrAdicionais,
      adicionaisDetalhe: adicDetail,
      whatsapp: { total: whatsTotal, users: stateBase.whatsUsers },
      totalSemWA: mensalSB,
      totalComWA: totalMensal,
      setupTotal,
      setupDetalhe: setupDetail,
      voip: voipVal && voipVal !== '_outro'
        ? { label: voipVal, incluso: true }
        : voipVal === '_outro' ? { label: 'não-listado', incluso: false } : null
    })
  }
  /* Proposta Para — right panel summary */
  {
    const cd = document.getElementById('base-company-display')
    if (cd) {
      cd.textContent = stateBase.empresa || 'Nome da empresa'
      cd.classList.toggle('empty', !stateBase.empresa)
    }
    const pills = document.getElementById('base-meta-pills')
    if (pills) {
      const parts = []
      parts.push(`Horas ${r.horasEfetivas.toLocaleString('pt-BR')}h/mês`)
      if (stateBase.whatsAtivo && stateBase.whatsUsers > 0)
        parts.push(`WhatsApp ${stateBase.whatsUsers} users`)
      pills.innerHTML = parts.map(p => `<span class="pill">${p}</span>`).join('')
    }
    const pm = document.getElementById('base-price-main')
    if (pm) pm.textContent = fmt(totalMensal) + '/mês'
    const plh = document.getElementById('base-price-label-header')
    if (plh) plh.textContent = stateBase.valorAtual > 0 ? 'Nova mensalidade' : 'Mensalidade total'
    const psub = document.getElementById('base-price-main-sub')
    if (psub && whatsTotal > 0) {
      psub.style.display = 'block'
      psub.textContent = 's/ WhatsApp: ' + fmt(totalMensal - whatsTotal) + '/mês'
    } else if (psub) { psub.style.display = 'none' }
  }
  renderDiagTags()
  renderBasePayload(r, precoFinal, totalMensal, whatsTotal, whatsPreco, setupTotal, mrrInteg, mrrAdicionais, blocosC, horasAdicionais)
  const horasOk = totalHoras >= 50,
    baseCanGen = !!stateBase.empresa && !!stateBase.crm && horasOk,
    bb = document.getElementById('base-btn-gen')
  if (bb) bb.disabled = !baseCanGen
  if (stateBase.crm) {
    document.getElementById('err-base-crm')?.classList.remove('show')
    document.getElementById('base-crm')?.classList.remove('error')
  }

  const bt = document.getElementById('base-btn-gen-tooltip')
  if (bt) {
    if (!stateBase.empresa) bt.textContent = 'Preencha o nome da empresa'
    else if (!stateBase.crm) bt.textContent = 'Selecione o CRM'
    else if (!horasOk) bt.textContent = 'Pacote total deve ser de pelo menos 50h'
    else bt.textContent = 'Pronto para gerar!'
  }
}

function renderDiagTags() {
  const d = stateBase.diag,
    el = document.getElementById('base-diag-tags')
  if (!el) return
  const touched = d.crm || d.voip || d.whats
  if (!touched) {
    el.innerHTML =
      '<span style="font-size:12px;color:var(--text4)">Preencha o diagnóstico ao lado para ver sugestões</span>'
    const h = document.getElementById('base-sugestao-hint')
    if (h) h.innerHTML = ''
    return
  }
  const ativos = []
  if (d.crm) ativos.push(d.crmNativo ? 'CRM Nativo' : 'CRM Externo')
  if (d.crm && d.campos) ativos.push(`${d.nCampos || '?'} campos CRM`)
  if (d.voip) ativos.push(d.voipNativo ? 'Voip Nativo' : 'Voip Externo')
  if (d.voip && d.voipCampos) ativos.push('Campos Voip')
  if (d.whats) ativos.push('WhatsApp')
  const opsAlta = [],
    opsMed = []
  if (!d.crm) opsAlta.push('Ativar CRM')
  if (!d.voip) opsAlta.push('Integrar Voip')
  if (!d.whats) opsAlta.push('Ativar WhatsApp')
  if (d.crm && !d.campos) opsMed.push('Campos personalizados')
  const score = ativos.length,
    sp = Math.round((score / 5) * 100),
    sc = score <= 1 ? '#D97706' : score <= 3 ? '#2563EB' : 'var(--green)',
    sl = score <= 1 ? 'Baixa adoção' : score <= 3 ? 'Adoção parcial' : 'Alta adoção'
  let html = `<div style="width:100%;display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;background:#F6F8FC;border-radius:8px;border:1.5px solid var(--border)"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Score de Adoção</div><div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden"><div style="height:100%;width:${sp}%;background:${sc};border-radius:99px"></div></div></div><div style="text-align:right;flex-shrink:0"><div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:${sc}">${score}/5</div><div style="font-size:10px;color:var(--text3);font-weight:600">${sl}</div></div></div>`
  if (ativos.length)
    html +=
      `<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;width:100%;margin-bottom:5px">Ativo agora</div>` +
      ativos.map((a) => `<span class="diag-tag on">${a}</span>`).join('')
  if (opsAlta.length)
    html +=
      `<div style="font-size:10px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:.05em;width:100%;margin-top:10px;margin-bottom:5px">Oportunidade prioritária</div>` +
      opsAlta
        .map(
          (o) =>
            `<span class="diag-tag" style="background:#FEF2F2;color:#DC2626;border:1.5px solid #FCA5A5">${o}</span>`
        )
        .join('')
  if (opsMed.length)
    html +=
      `<div style="font-size:10px;font-weight:700;color:#D97706;text-transform:uppercase;letter-spacing:.05em;width:100%;margin-top:10px;margin-bottom:5px">Expansão possível</div>` +
      opsMed
        .map(
          (o) =>
            `<span class="diag-tag" style="background:#FFFBEB;color:#D97706;border:1.5px solid #FDE68A">${o}</span>`
        )
        .join('')
  el.innerHTML = html
  const he = document.getElementById('base-sugestao-hint')
  if (he) he.innerHTML = ''
}

function renderBasePayload(r, precoFinal, totalMensal, whatsTotal, whatsPreco, setupTotal, mrrInteg, mrrAdicionais, blocosC, horasAdicionais) {
  const u = currentUser || {},
    cfg = loadConfig(),
    hoje = new Date(),
    val = new Date(hoje)
  val.setDate(hoje.getDate() + 15) // Validade fixa: 15 dias
  const fmtD = (d) => d.toLocaleDateString('pt-BR')
  /* Build detalhamentos de integração */
  const { ip, isRd, setupCrm: _sCrm, setupRegras: _sRegras, setupPipelines: _sPipe, setupTarefas: _sTar, setupCampos: _sCamp, blocosC: _bC, mrrTarefas: _mTar, mrrCampos: _mCamp } = calcIntegModular(stateBase)
  const setupDetailParts = []
  if (_sCrm > 0) setupDetailParts.push('CRM personalizado ' + fmt(_sCrm))
  if (_sRegras > 0) setupDetailParts.push('Personalização de regras ' + fmt(_sRegras))
  if (_sPipe > 0) setupDetailParts.push(stateBase.integPipelines + (_sPipe / (ip.pipeline_adicional_setup || 400) === 1 ? ' pipeline adicional ' : ' pipelines adicionais ') + fmt(_sPipe))
  if (_sTar > 0) setupDetailParts.push('Tarefas automáticas ' + fmt(_sTar))
  if (_sCamp > 0) setupDetailParts.push(stateBase.integCampos + ' campos (' + _bC + (_bC === 1 ? ' bloco) ' : ' blocos) ') + fmt(_sCamp))
  const isCrmNat = isCrmNativo(stateBase.crm) || stateBase.crm === ''
  const descSetup = setupDetailParts.length
    ? setupDetailParts.join(' + ')
    : (isCrmNat ? 'Setup gratuito (CRM nativo)' : 'Integração padrão')
  const mrrDetailParts = []
  if (_mTar > 0) mrrDetailParts.push('Tarefas automáticas ' + fmt(_mTar) + '/mês')
  if (_mCamp > 0) mrrDetailParts.push('Campos personalizados (' + stateBase.integCampos + ') ' + fmt(_mCamp) + '/mês')
  const mrrDetalhe = mrrDetailParts.length ? mrrDetailParts.join(' + ') : 'Integração padrão (sem custo adicional)'
  /* Build adicionais list */
  const adicCfg = getAdicionaisConfig()
  const adicAtivos = []
  let adicTotal = 0
  for (const [k, v] of Object.entries(adicCfg)) {
    if (v.ativo && v.mrr > 0 && stateBase.adicionais && stateBase.adicionais[k]) {
      adicAtivos.push(v.label + ' ' + fmt(v.mrr) + '/mês')
      adicTotal += v.mrr
    }
  }
  /* VOIP status */
  const voipVal = stateBase.integVoip || ''
  const voipStatus = voipVal === '_outro' ? 'Consultar' : voipVal ? 'Incluso' : 'Não incluso'
  const voipLabel = voipVal === '_outro' ? 'VOIP não-listado' : voipVal || 'Sem VOIP'
  const payload = {
    tipo_proposta: 'upsell_base',
    plano_integracao: 'modular',
    nome_empresa: stateBase.empresa,
    crm_cliente: stateBase.crm,
    contato_nome: stateBase.contatoNome || '',
    contato_email: stateBase.contatoEmail || '',
    num_usuarios: stateBase.usuariosAtual,
    horas_atual: String(stateBase.horasAtual || '—'),
    valor_atual: stateBase.valorAtual > 0 ? `R$ ${stateBase.valorAtual.toLocaleString('pt-BR')}/mês` : '—',
    horas_adicionais: String(horasAdicionais || 0),
    horas_proposto: String(r.horasEfetivas),
    valor_proposto: fmt(totalMensal) + '/mês',
    acrescimo_mensal: stateBase.valorAtual > 0 ? fmt(totalMensal - stateBase.valorAtual) + '/mês' : '—',
    diag_crm: stateBase.diag.crm ? 'Sim' : 'Não',
    diag_voip: stateBase.diag.voip ? 'Sim' : 'Não',
    diag_whatsapp: stateBase.diag.whats ? 'Sim' : 'Não',
    whatsapp_atual: String(stateBase.whatsAtual || 0),
    titulo_proposta: `Salesbud - Apresentacao e Proposta - ${stateBase.empresa || 'Cliente'}`,
    pacote_horas: String(r.horasEfetivas),
    preco_mensalidade: `${fmt(precoFinal)}/mês`,
    fee_manutencao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : 'Não incluso',
    preco_whatsapp: stateBase.whatsAtivo
      ? `${fmt(whatsTotal)}/mês para ${stateBase.whatsUsers} usuários`
      : 'Não incluso',
    total_geral_mes: fmt(totalMensal) + '/mês',
    detalhe_desconto: 'Preço padrão',
    preco_setup: setupTotal > 0 ? fmt(setupTotal) : 'Gratuito',
    descricao_setup: descSetup,
    vendedor_nome: u.nome || '',
    vendedor_email: u.email || '',
    vendedor_telefone: u.telefone || '',
    vendedor_cidade: u.cidade || '',
    desconto_pct: 0,
    template_url: cfg.templateUrl || '',
    template_versao: cfg.templateVersao || '',
    data_proposta: fmtD(hoje),
    validade_proposta: fmtD(val),
    // Componentes de integração — detalhes
    personalizacao_regras: stateBase.integRegras ? 'Sim' : 'Não',
    pipelines_adicionais: String(stateBase.integPipelines),
    tarefas_automaticas: stateBase.integTarefas ? 'Sim' : 'Não',
    campos_personalizados: String(stateBase.integCampos),
    campos_blocos: String(_bC),
    voip_cliente: voipLabel,
    voip_status: voipStatus,
    // Totais de integração
    setup_total: setupTotal > 0 ? fmt(setupTotal) : 'Gratuito',
    setup_detalhamento: descSetup,
    mrr_integracao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : 'Não incluso',
    mrr_integracao_detalhamento: mrrDetalhe,
    // Adicionais
    adicionais_lista: adicAtivos.length ? adicAtivos.join('; ') : 'Nenhum',
    adicionais_total: adicTotal > 0 ? fmt(adicTotal) + '/mês' : 'Não incluso',
    // Legado — backward compatibility
    preco_setup_basico: isCrmNat ? 'Gratuito' : fmt(ip.crm_personalizado_setup),
    total_avancado: fmt(totalMensal) + '/mês'
  }
  const colored = JSON.stringify(payload, null, 2)
    .replace(/"([^"]+)":/g, `<span style="color:#93C5FD">"$1"</span>:`)
    .replace(/: "([^"]*)"/g, `: <span style="color:#86EFAC">"$1"</span>`)
  document.getElementById('base-payload').innerHTML = colored
}
function copyBasePayload() {
  navigator.clipboard
    .writeText(document.getElementById('base-payload').textContent)
    .then(() => showToast('Payload copiado', 'success'))
}
async function gerarPropostaBase() {
  const btn = document.getElementById('base-btn-gen')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Enviando...'
  const raw = document.getElementById('base-payload').textContent
  let po = {}
  try { po = JSON.parse(raw) } catch { showToast('Erro interno: payload inválido.', 'info'); btn.disabled = false; btn.innerHTML = 'Gerar Proposta de Upsell'; return; }
  const reg = await histAdd({ ...po, status_proposta: 'rascunho' })
  await enviarWebhook(raw, btn, 'Gerar Proposta de Upsell', async () => {
    if (reg) await _salvarStatusProposta(reg.id, 'enviada', null, reg.fonte)
    showToast('Proposta gerada! Verifique o Gmail.', 'success')
  })
}

/* ════════════════════════════════════════
   REENVIAR PROPOSTA (Histórico)
════════════════════════════════════════ */
async function reenviarProposta(propostaId) {
  const btn = document.querySelector(`[data-resend-id="${propostaId}"]`)
  if (!btn || btn.disabled) return
  btn.disabled = true
  btn.textContent = 'Enviando...'
  btn.style.opacity = '0.5'
  if (!supabaseClient) {
    showToast('Supabase não conectado.', 'info')
    btn.disabled = false; btn.textContent = 'Reenviar'; btn.style.opacity = ''
    return
  }
  try {
    const { data, error } = await supabaseClient
      .from('propostas')
      .select('payload_json')
      .eq('id', propostaId)
      .single()
    if (error || !data?.payload_json) {
      showToast('Erro: payload não encontrado.', 'info')
      btn.disabled = false; btn.textContent = 'Reenviar'; btn.style.opacity = ''
      return
    }
    const wh = getWebhookUrl()
    if (!wh || wh === CONFIG_DEFAULT.webhookUrl) {
      showToast('Webhook não configurado.', 'info')
      btn.disabled = false; btn.textContent = 'Reenviar'; btn.style.opacity = ''
      return
    }
    // Fire-and-forget — não espera resposta do Make
    fetch(wh, {
      method: 'POST',
      headers: getWebhookHeaders(),
      body: typeof data.payload_json === 'string' ? data.payload_json : JSON.stringify(data.payload_json)
    }).catch(() => {})
    showToast('Proposta reenviada! Verifique o email em alguns segundos.', 'success')
    btn.textContent = 'Reenviado'
    btn.style.background = 'var(--green)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--green)'; btn.style.opacity = ''
    setTimeout(() => {
      btn.disabled = false; btn.textContent = 'Reenviar'
      btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''
    }, 30000)
  } catch (e) {
    showToast('Erro ao reenviar: ' + e.message, 'info')
    btn.disabled = false; btn.textContent = 'Reenviar'; btn.style.opacity = ''
  }
}

function resetStateBase() {
  Object.assign(stateBase, {
    empresa: '',
    crm: '',
    contatoNome: '',
    contatoEmail: '',
    horasAtual: 0,
    valorAtual: 0,
    usuariosAtual: 5,
    integKey: 'basico',
    integRegras: false,
    integPipelines: 0,
    integTarefas: false,
    integCampos: 0,
    integVoip: '',
    adicionais: {},
    whatsAtivo: true,
    whatsUsers: 1,
    diag: {
      crm: false,
      crmNativo: false,
      campos: false,
      nCampos: 3,
      voip: false,
      voipNativo: false,
      voipCampos: false,
      whats: false,
      cs: false,
      extras: false
    }
  })
  ;['base-empresa', 'base-contato-nome', 'base-contato-email'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  ;[
    ['base-crm', ''],
    ['base-horas-atual', ''],
    ['base-usuarios-atual', '5'],
    ['base-valor-atual', ''],
    ['base-horas-input', '0'],
    ['base-whats-users', '1'],
    ['base-integ-pipelines', '0'],
    ['base-integ-campos', '0']
  ].forEach(([id, v]) => {
    const el = document.getElementById(id)
    if (el) el.value = v
  })
  document.getElementById('base-comparativo').style.display = 'none'
  document.getElementById('base-integ-regras-nao')?.classList.add('active')
  document.getElementById('base-integ-regras-sim')?.classList.remove('active')
  document.getElementById('base-integ-tarefas-nao')?.classList.add('active')
  document.getElementById('base-integ-tarefas-sim')?.classList.remove('active')
  const voipSel = document.getElementById('base-integ-voip')
  if (voipSel) voipSel.value = ''
  const voipTag = document.getElementById('base-integ-voip-tag')
  if (voipTag) voipTag.style.display = 'none'
  updateBase()
}


/* ════════════════════════════════════════
   CONFIG
════════════════════════════════════════ */
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
   TABELA DE PREÇOS — EDITOR
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
   TABELA DE PREÇOS — BASE (CS/Upsell)
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
   CRM LIST
════════════════════════════════════════ */
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
   VOIP LIST
════════════════════════════════════════ */
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
   INTEGRACAO PRECOS
════════════════════════════════════════ */
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
   ADICIONAIS OPCIONAIS
════════════════════════════════════════ */
const ADICIONAIS_DEFAULT = {
  contas_enriquecimento: { label: 'Contas - Enriquecimento', mrr: 0, ativo: false },
  chat_com_bud: { label: 'Chat com Bud', mrr: 0, ativo: false }
}
let _adicionaisConfig = null
const ADICIONAIS_KEY = 'salesbud_adicionais'
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
   ARREDONDAR HORAS
════════════════════════════════════════ */
function arredondarHoras() {
  const bArr = document.getElementById('btn-arredondar')
  const t = parseInt(bArr?.dataset.target) || 0
  if (!t) return
  document.getElementById('horas-input').value = t
  update()
  showToast('Arredondado para ' + t.toLocaleString('pt-BR') + 'h', 'success')
}

/* ════════════════════════════════════════
   SALVAR PROPOSTA
════════════════════════════════════════ */
function salvarProposta(modulo) {
  const payloadEl = document.getElementById(modulo === 'base' ? 'base-payload' : 'payload')
  if (!payloadEl) {
    showToast('Nenhum dado para salvar.', 'info')
    return
  }
  let obj = {}
  try {
    obj = JSON.parse(payloadEl.textContent)
  } catch {}
  if (!obj.nome_empresa) {
    showToast('Preencha ao menos o nome da empresa.', 'info')
    return
  }
  histAdd({ ...obj, tipo_proposta: modulo === 'base' ? 'upsell_base' : 'novo' })
  showToast('Proposta salva no histórico!', 'success')
}

/* ════════════════════════════════════════
   BAIXAR PDF
════════════════════════════════════════ */
function baixarPDF(modulo) {
  const payloadEl = document.getElementById(modulo === 'base' ? 'base-payload' : 'payload')
  if (!payloadEl) return
  let obj = {}
  try {
    obj = JSON.parse(payloadEl.textContent)
  } catch {}
  if (!obj.nome_empresa) {
    showToast('Preencha ao menos o nome da empresa.', 'info')
    return
  }

  const empresa = esc(obj.nome_empresa || 'Proposta')
  const data = esc(obj.data_proposta || new Date().toLocaleDateString('pt-BR'))
  const validade = esc(obj.validade_proposta || '')
  const vendedor = esc(obj.vendedor_nome || '')
  const horas = esc(obj.pacote_horas || '—')
  const mensalidade = esc(obj.preco_mensalidade || '—')
  const totalGeral = esc(obj.total_geral_mes || obj.preco_mensalidade || '—')
  const setup = obj.preco_setup && obj.preco_setup !== 'Gratuito' ? esc(obj.preco_setup) : null
  const whats = obj.preco_whatsapp && obj.preco_whatsapp !== 'Não incluso' ? esc(obj.preco_whatsapp) : null

  const integ = esc(obj.descricao_setup || '')
  const scope = obj.descricao_setup || ''
  const crm = esc(obj.crm_cliente || '')
  const contatoNome = esc(obj.contato_nome || '')
  const contatoEmail = esc(obj.contato_email || '')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Syne:wght@700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'DM Sans',sans-serif; color:#1E2A3B; background:white; padding:48px; max-width:720px; margin:0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; padding-bottom:24px; border-bottom:2px solid #E8ECF2; }
  .logo { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:#1E2A3B; }
  .logo span { color:#FB2491; }
  .meta { text-align:right; font-size:12px; color:#6B7A99; }
  h1 { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:#1E2A3B; margin-bottom:4px; }
  .sub { font-size:14px; color:#6B7A99; margin-bottom:32px; }
  .section { margin-bottom:24px; }
  .section-title { font-size:11px; font-weight:700; color:#6B7A99; text-transform:uppercase; letter-spacing:.08em; margin-bottom:10px; }
  .row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #E8ECF2; font-size:14px; }
  .row:last-child { border-bottom:none; }
  .row .label { color:#6B7A99; }
  .row .val { font-weight:700; color:#1E2A3B; }
  .row .val.green { color:#00C48C; }
  .row .val.pink { color:#FB2491; }
  .total-box { background:#1E2A3B; border-radius:12px; padding:20px 24px; margin:24px 0; display:flex; justify-content:space-between; align-items:center; }
  .total-box .label { font-size:13px; color:rgba(255,255,255,.5); font-weight:600; }
  .total-box .val { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:white; }
  .setup-box { background:#FFF7ED; border:1.5px solid #FED7AA; border-radius:8px; padding:12px 16px; margin-top:12px; font-size:13px; color:#92400E; }
  .footer { margin-top:40px; padding-top:20px; border-top:1px solid #E8ECF2; font-size:11px; color:#6B7A99; text-align:center; line-height:1.6; }
  .validity { background:#F0FDF4; border:1.5px solid #BBF7D0; border-radius:8px; padding:10px 14px; font-size:12px; color:#166534; font-weight:600; text-align:center; margin-top:20px; }
</style>
</head><body>
  <div class="header">
    <div class="logo">Sales<span>Bud</span></div>
    <div class="meta">Emitida em ${data}<br>Vendedor: ${vendedor}</div>
  </div>

  <h1>Proposta Comercial</h1>
  <div class="sub">${empresa}${crm ? ' · ' + crm : ''}</div>

  ${contatoNome || contatoEmail ? `<div class="section"><div class="section-title">Contato</div>${contatoNome ? `<div class="row"><span class="label">Nome</span><span class="val">${contatoNome}</span></div>` : ''}${contatoEmail ? `<div class="row"><span class="label">E-mail</span><span class="val">${contatoEmail}</span></div>` : ''}</div>` : ''}

  <div class="section">
    <div class="section-title">Pacote</div>
    <div class="row"><span class="label">Volume de horas</span><span class="val">${horas}h/mês</span></div>
    <div class="row"><span class="label">Mensalidade SalesBud</span><span class="val">${mensalidade}</span></div>

    ${obj.fee_manutencao && obj.fee_manutencao !== 'Não incluso' ? `<div class="row"><span class="label">Manutenção integração</span><span class="val">${obj.fee_manutencao}</span></div>` : ''}
    ${whats ? `<div class="row"><span class="label">WhatsApp</span><span class="val">${whats}</span></div>` : ''}
  </div>

  <div class="total-box">
    <span class="label">Total mensal${whats ? ' (c/ WhatsApp)' : ''}</span>
    <span class="val">${totalGeral}</span>
  </div>

  ${setup ? `<div class="setup-box">+ Setup de integração: <strong>${setup}</strong> — pagamento pontual, parcelável em até 12x</div>` : ''}

  ${integ ? `<div class="section" style="margin-top:24px"><div class="section-title">Integração CRM</div><div class="row"><span class="label">Plano</span><span class="val">${integ}</span></div></div>` : ''}

  <div class="validity">Proposta valida ate ${validade}</div>

  <div class="footer">
    SalesBud · Proposta gerada em ${data} por ${vendedor}<br>
    Proposta válida dentro do mês de emissão.
  </div>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (w) {
    w.onload = () => {
      w.print()
    }
    showToast('PDF aberto — use "Salvar como PDF" ao imprimir.', 'success')
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = `Proposta_${empresa.replace(/\s+/g, '_')}_${data.replace(/\//g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Arquivo baixado!', 'success')
  }
}

/* ════════════════════════════════════════
   EXCLUIR PROPOSTA
════════════════════════════════════════ */
async function excluirProposta(id, fonte) {
  if (!confirm('Excluir esta proposta? Esta ação não pode ser desfeita.')) return
  if (supabaseClient && fonte === 'supabase') {
    try {
      const { error } = await supabaseClient.from('propostas').delete().eq('id', id)
      if (error) throw error
    } catch (e) {
      showToast('Erro ao excluir: ' + e.message, 'info')
      return
    }
  } else {
    const data = histLoadLocal().filter((d) => d.id !== id)
    histSaveLocal(data)
  }
  showToast('Proposta excluída.', 'success')
  renderHistorico()
}

/* ════════════════════════════════════════
   EDITAR PROPOSTA
════════════════════════════════════════ */
let _editModal = null
async function editarProposta(id, fonte) {
  let entry = null
  if (supabaseClient && fonte === 'supabase') {
    try {
      const { data, error } = await supabaseClient.from('propostas').select('*').eq('id', id).single()
      if (error) throw error
      entry = data
    } catch (e) {
      showToast('Erro ao carregar: ' + e.message, 'info')
      return
    }
  } else {
    entry = histLoadLocal().find((d) => d.id === id)
  }
  if (!entry) {
    showToast('Proposta não encontrada.', 'info')
    return
  }
  _editModal = { id, fonte, entry }

  // Build modal
  const overlay = document.createElement('div')
  overlay.id = 'edit-overlay'
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px'
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#1E2A3B">Editar Proposta</h3>
        <button onclick="fecharEditModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6B7A99">X</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><label style="font-size:12px;font-weight:700;color:#6B7A99;display:block;margin-bottom:4px">Empresa</label>
          <input id="edit-empresa" value="${esc(entry.nome_empresa || entry.empresa || '')}" style="width:100%;padding:8px 12px;border:1.5px solid #E8ECF2;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px" /></div>
        <div><label style="font-size:12px;font-weight:700;color:#6B7A99;display:block;margin-bottom:4px">Contato</label>
          <input id="edit-contato" value="${esc(entry.contato_nome || '')}" style="width:100%;padding:8px 12px;border:1.5px solid #E8ECF2;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px" /></div>
        <div><label style="font-size:12px;font-weight:700;color:#6B7A99;display:block;margin-bottom:4px">E-mail</label>
          <input id="edit-email" value="${esc(entry.contato_email || '')}" style="width:100%;padding:8px 12px;border:1.5px solid #E8ECF2;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px" /></div>
        <div><label style="font-size:12px;font-weight:700;color:#6B7A99;display:block;margin-bottom:4px">Observação interna</label>
          <textarea id="edit-obs" rows="3" style="width:100%;padding:8px 12px;border:1.5px solid #E8ECF2;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;resize:vertical">${esc(entry.obs_interna || entry._obs || '')}</textarea></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <button onclick="fecharEditModal()" style="flex:1;padding:10px;background:none;border:2px solid #E8ECF2;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#6B7A99">Cancelar</button>
        <button onclick="confirmarEdicao()" style="flex:1;padding:10px;background:#1E2A3B;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:white">Salvar alterações</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
}

function fecharEditModal() {
  document.getElementById('edit-overlay')?.remove()
  _editModal = null
}

async function confirmarEdicao() {
  if (!_editModal) return
  const { id, fonte, entry } = _editModal
  const patch = {
    nome_empresa: document.getElementById('edit-empresa').value.trim(),
    contato_nome: document.getElementById('edit-contato').value.trim(),
    contato_email: document.getElementById('edit-email').value.trim(),
    obs_interna: document.getElementById('edit-obs').value.trim()
  }
  if (supabaseClient && fonte === 'supabase') {
    try {
      const { error } = await supabaseClient.from('propostas').update(patch).eq('id', id)
      if (error) throw error
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'info')
      return
    }
  } else {
    const data = histLoadLocal()
    const idx = data.findIndex((d) => d.id === id)
    if (idx !== -1) {
      Object.assign(data[idx], patch, { empresa: patch.nome_empresa })
      histSaveLocal(data)
    }
  }
  fecharEditModal()
  showToast('Proposta atualizada!', 'success')
  renderHistorico()
}

/* ════════════════════════════════════════
   UTILS
════════════════════════════════════════ */
let toastTimer
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = `toast ${type} show`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500)
}
