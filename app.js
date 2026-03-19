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
      s.textContent = 'Conectado ✓'
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
          dc = d.desconto_pct ? d.desconto_pct + '%' : '—',
          st = d._status_proposta || 'enviada',
          pf = d._fonte || 'local'
        const _chk = _histSelected.has(d.id)
        return `<tr><td style="text-align:center;padding:0 8px"><input type="checkbox" class="hist-check" data-id="${d.id}" data-fonte="${pf}" ${_chk ? 'checked' : ''} onchange="onHistCheck(this)" style="cursor:pointer;width:14px;height:14px;accent-color:var(--pink)"></td><td style="font-size:12px;color:var(--text3)">${df}</td><td style="font-weight:600;color:var(--text)">${esc(d.nome_empresa || '—')}</td><td><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;${ts}">${tl}</span></td><td style="font-size:13px;color:var(--text2)">${esc(d.vendedor_nome || '—')}</td><td style="font-weight:600;color:var(--navy)">${esc(d.pacote_horas || '—')}h</td><td style="font-weight:700">${esc(d.preco_mensalidade || '—')}</td><td><select class="status-badge status-${st}" data-prop-id="${d.id}" data-fonte="${pf}" onchange="atualizarStatusProposta(${d.id},this.value,'${pf}')" style="border:none;outline:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;appearance:none;padding:3px 9px;border-radius:20px"><option value="enviada" ${st === 'enviada' ? 'selected' : ''}>Enviada</option><option value="negociacao" ${st === 'negociacao' ? 'selected' : ''}>Negociação</option><option value="aprovada" ${st === 'aprovada' ? 'selected' : ''}>Aprovada</option><option value="perdida" ${st === 'perdida' ? 'selected' : ''}>Perdida</option></select>${d._motivo_perda ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(d._motivo_perda)}</div>` : ''}</td><td style="font-size:12px;color:var(--text3)">${dc}</td><td><div style="display:flex;gap:6px"><button onclick="editarProposta(${d.id},'${pf}')" style="font-size:11px;padding:3px 10px;border:1.5px solid var(--border);border-radius:4px;background:white;color:var(--navy);cursor:pointer;font-family:inherit;font-weight:600">Editar</button><button onclick="excluirProposta(${d.id},'${pf}')" style="font-size:11px;padding:3px 10px;border:1.5px solid #FCA5A5;border-radius:4px;background:#FEF2F2;color:#DC2626;cursor:pointer;font-family:inherit;font-weight:600">Excluir</button></div></td></tr>`
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
      'desconto_pct',
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
        d.desconto_pct != null ? d.desconto_pct + '%' : '',
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
    'desconto_pct',
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
      d.desconto_pct != null ? d.desconto_pct + '%' : '',
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
      loader.innerHTML = `<span style="color:#16A34A;font-size:12px;font-weight:600">✓ Preenchido automaticamente</span>`
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
  checkTemplateBanner()
  populateCrmDropdowns()
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
function abrirModal(user = null) {
  editingUserId = user ? user.id : null
  document.getElementById('modal-title').textContent = user ? 'Editar usuário' : 'Novo usuário'
  ;['nome', 'cargo', 'email', 'telefone', 'cidade'].forEach((f) => {
    document.getElementById('m-' + f).value = user?.[f] || ''
  })
  document.getElementById('m-senha').value = ''
  document.getElementById('m-perfil').value = user?.perfil || 'vendedor'
  document.getElementById('m-status').value = user?.status || 'ativo'
  document.getElementById('modal-error').style.display = 'none'
  document.getElementById('m-senha').placeholder = user ? 'Deixe vazio para manter' : 'Mín. 6 caracteres'
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
  const isSupaUser = editingUserId && DB.users.find((u) => String(u.id) === String(editingUserId))?._supabase
  if (!editingUserId && !isSupaUser && !senha) {
    errEl.textContent = 'Defina uma senha.'
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
  if (editingUserId) {
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
  } else {
    DB.users.push({ id: DB.nextId++, nome, cargo, email, senha: await _h(senha), telefone, cidade, perfil, status })
    showToast('Usuário criado.', 'success')
  }
  saveUsersLocal()
  fecharModal()
  renderTabela()
}

/* ════════════════════════════════════════
   TABELA DE PREÇOS
════════════════════════════════════════ */
const TABELA_HORAS_DEFAULT = [
  { horas: 50, preco: 399 },
  { horas: 100, preco: 599 },
  { horas: 150, preco: 799 },
  { horas: 200, preco: 990 },
  { horas: 300, preco: 1490 },
  { horas: 400, preco: 1990 },
  { horas: 500, preco: 2490 },
  { horas: 750, preco: 2990 },
  { horas: 1000, preco: 3590 },
  { horas: 1250, preco: 5390 },
  { horas: 1500, preco: 6290 },
  { horas: 2000, preco: 7990 },
  { horas: 3000, preco: 12347 },
  { horas: 4000, preco: 13558 },
  { horas: 5000, preco: 16140 },
  { horas: 7500, preco: 24210 },
  { horas: 10000, preco: 32280 }
]
const TABELA_VERSION = 4
let tabelaEditavel = null
function getTabelaAtiva() {
  if (tabelaEditavel) return tabelaEditavel
  try {
    const s = JSON.parse(localStorage.getItem('salesbud_tabela') || 'null'),
      v = parseInt(localStorage.getItem('salesbud_tabela_ver') || '0')
    if (s && s.length > 0 && v >= TABELA_VERSION) {
      tabelaEditavel = s
      return s
    }
  } catch {}
  tabelaEditavel = TABELA_HORAS_DEFAULT.map((t) => ({ ...t }))
  return tabelaEditavel
}
function calcPrecoExato(horas) {
  const tab = getTabelaAtiva().map((t) => ({ ...t, precoHora: t.preco / t.horas }))
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
const WHATS_TIERS = [
  { min: 1, max: 5, preco: 100 },
  { min: 6, max: 10, preco: 90 },
  { min: 11, max: 20, preco: 80 },
  { min: 21, max: 30, preco: 70 },
  { min: 31, max: 50, preco: 60 },
  { min: 51, max: 999, preco: 50 }
]
const fmt = (v) => (v == null ? 'Sob consulta' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0 }))
function getWhatsPrice(u) {
  return (WHATS_TIERS.find((t) => u >= t.min && u <= t.max) || { preco: 50 }).preco
}
function getTotalWhats(u) {
  return getWhatsPrice(u) * u
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
  integKey: 'basico',
  whatsAtivo: true,
  whatsUsers: 5,
  desconto: 0,
  _aprovacaoDesconto: null
}
function _selectInteg(key, el, mod) {
  const s = getState(mod)
  s.integKey = key
  const selector = mod === 'novo' ? '.integ-card' : '#base-integ-btns .integ-btn'
  document.querySelectorAll(selector).forEach((c) => c.classList.remove('active'))
  el.classList.add('active')
  mod === 'novo' ? update() : updateBase()
}
function selectInteg(key, el) { _selectInteg(key, el, 'novo'); }
function selectBaseInteg(key, el) { _selectInteg(key, el, 'base'); }
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
function onDescontoSlider(sliderId, modulo) {
  const val = parseInt(document.getElementById(sliderId).value),
    lim = loadConfig().descontoMax ?? 10
  if (val > lim && currentUser?.perfil !== 'admin') {
    document.getElementById(sliderId).value = lim
    const lid = sliderId === 'desconto' ? 'desc-label' : 'base-desc-label'
    document.getElementById(lid).textContent = lim + '%'
    if (modulo === 'proposta') {
      state.desconto = lim
      update()
    } else {
      stateBase.desconto = lim
      updateBase()
    }
    showToast(`Máximo sem aprovação: ${lim}%`, 'info')
    return
  }
  const lid = sliderId === 'desconto' ? 'desc-label' : 'base-desc-label'
  document.getElementById(lid).textContent = val + '%'
  if (modulo === 'proposta') {
    state.desconto = val
    update()
  } else {
    stateBase.desconto = val
    updateBase()
  }
}
function setDisc(val, el, modulo) {
  const lim = loadConfig().descontoMax ?? 10
  if (val > lim && currentUser?.perfil !== 'admin') {
    pedirAprovacaoDesconto(val, modulo || 'proposta')
    return
  }
  if (!modulo || modulo === 'proposta') {
    state.desconto = val
    document.getElementById('desconto').value = Math.min(val, 30)
    document.getElementById('desc-label').textContent = val + '%'
    document.querySelectorAll('#disc-presets-novos .disc-preset').forEach((b) => b.classList.remove('active'))
  } else {
    stateBase.desconto = val
    document.getElementById('base-desconto').value = Math.min(val, 40)
    document.getElementById('base-desc-label').textContent = val + '%'
    document.querySelectorAll('#disc-presets-base .disc-preset').forEach((b) => b.classList.remove('active'))
  }
  el.classList.add('active')
  if (!modulo || modulo === 'proposta') update()
  else updateBase()
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
   UPDATE / CÁLCULOS (Novos Clientes)
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
  state.desconto = parseInt(document.getElementById('desconto').value) || 0
  document.getElementById('desc-label').textContent = state.desconto + '%'
  document
    .querySelectorAll('#disc-presets-novos .disc-preset')
    .forEach((b) => b.classList.toggle('active', parseInt(b.textContent) === state.desconto))
  const hd = parseInt(document.getElementById('horas-input').value) || 0,
    r = calcPrecoExato(hd)
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
  let integ,
    isPremium = false
  const isTodos = state.integKey === 'todos'
  if (isTodos) {
    integ = {
      nome: 'Todos os planos',
      tag: 'tag-basico',
      label: 'Cliente escolhe na proposta',
      setup: null,
      fee: 0,
      scope: [],
      descricao: ''
    }
  } else {
    integ = { ...(INTEG[state.integKey] || INTEG.basico) }
    if (state.integKey === 'basico' && state.crm && !isCrmNativo(state.crm)) {
      integ.setup = 1200
    }
    const _bs = document.querySelector('.integ-card:first-child .integ-card-sub')
    if (_bs)
      _bs.textContent =
        state.crm && !isCrmNativo(state.crm) ? 'R$ 1.200 setup · Somente notas' : 'Gratuito · Somente notas'
  }
  const precoBase = r.precoEfetivo,
    descVal = precoBase && state.desconto > 0 ? Math.round((precoBase * state.desconto) / 100) : 0
  const precoFinal = precoBase ? precoBase - descVal : null,
    feeMensal = integ.fee || 0
  const mensalSB = precoFinal != null ? precoFinal + feeMensal : null /* mensalidade SalesBud (sem whats) */
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
  document.getElementById('integ-badge-wrap').innerHTML =
    `<div class="integ-badge"><span class="tag ${integ.tag}">${integ.nome}</span>${esc(integ.label)}</div>`
  const badgeEl = document.getElementById('price-desconto-badge')
  if (state.desconto > 0 && precoBase && descVal > 0 && badgeEl) {
    badgeEl.style.display = 'flex'
    document.getElementById('price-desconto-pct').textContent = `−${state.desconto}% de desconto`
    document.getElementById('price-desconto-reais').textContent = `− ${fmt(descVal)}/mês`
    document.getElementById('price-desconto-original').textContent = `tabela: ${fmt(precoBase)}/mês`
    document.getElementById('price-desconto-anual').textContent = `economia de ${fmt(descVal * 12)}/ano`
  } else if (badgeEl) badgeEl.style.display = 'none'
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
  let html = ''
  if (precoBase)
    html += `<div class="price-row"><span class="price-row-label">Mensalidade</span><span class="price-row-val green">${fmt(precoBase)}/mês</span></div>`
  if (descVal > 0)
    html += `<div class="price-row"><span class="price-row-label">Desconto (${state.desconto}%) <span style="font-size:11px;color:var(--text3)">↳ economia ${fmt(descVal * 12)}/ano</span></span><span class="price-row-val red">− ${fmt(descVal)}/mês</span></div>`
  if (feeMensal > 0)
    html += `<div class="price-row"><span class="price-row-label">Manutenção CRM</span><span class="price-row-val amber">${fmt(feeMensal)}/mês</span></div>`
  if (mensalSB != null && (descVal > 0 || feeMensal > 0 || whatsTotal > 0))
    html += `<div class="price-row" style="border-top:1px solid var(--border2);margin-top:2px"><span class="price-row-label" style="color:var(--text3)">Subtotal</span><span class="price-row-val" style="color:var(--text2);font-size:13px">${fmt(mensalSB)}/mês</span></div>`
  if (whatsTotal > 0)
    html += `<div class="price-row"><span class="price-row-label">WhatsApp (${state.whatsUsers} users)</span><span class="price-row-val green">${fmt(whatsTotal)}/mês</span></div>`
  if (totalGeral != null) {
    const sepStyle = 'border-top:2px solid var(--navy);margin-top:4px'
    if (whatsTotal > 0) {
      html += `<div class="price-row total" style="${sepStyle}"><span class="price-row-total-label">Total s/ WA</span><span class="price-row-total-val" style="font-size:15px;color:var(--text2)">${fmt(mensalSB)}/mês</span></div>`
      html += `<div class="price-row total" style="padding-top:6px"><span class="price-row-total-label">Total c/ WA</span><span class="price-row-total-val">${fmt(totalGeral)}/mês</span></div>`
    } else {
      html += `<div class="price-row total" style="${sepStyle}"><span class="price-row-total-label">Total mensal</span><span class="price-row-total-val">${fmt(totalGeral)}/mês</span></div>`
    }
  }
  if (integ.setup != null && integ.setup > 0)
    html += `<div class="price-row" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)"><span class="price-row-label" style="color:var(--text3)">+ Setup <span style="font-size:11px;font-weight:400">(pontual · até 12×)</span></span><span class="price-row-val amber" style="font-size:13px">${fmt(integ.setup)}</span></div>`
  document.getElementById('price-rows').innerHTML = html
  document.getElementById('scope-section').style.display = 'block'
  document.getElementById('scope-items').innerHTML = isTodos
    ? '<div class="scope-item"><div class="scope-dot"></div><span>Plano de integração a definir com o cliente</span></div>'
    : integ.scope
        .map((s) => {
          const h = s.toLowerCase().includes('sob consulta')
          return `<div class="scope-item"><div class="scope-dot"></div><span style="${h ? 'font-weight:700' : ''}">${esc(s)}</span></div>`
        })
        .join('')
  document.getElementById('premium-alert').style.display = isPremium ? 'flex' : 'none'
  renderPayload(r.horasEfetivas, integ, precoFinal, mensalSB, totalGeral, descVal, whatsTotal, whatsPreco)
  const horasOk = hd > 0,
    emailOk = !state.contatoEmail || validarEmail(state.contatoEmail),
    canGen = state.empresa && !isPremium && precoFinal != null && horasOk && emailOk
  document.getElementById('btn-gen').disabled = !canGen
  const lim = loadConfig().descontoMax ?? 10,
    bEl = document.getElementById('btn-gen')
  if (bEl) {
    if (state.desconto > lim && state._aprovacaoDesconto?.status_aprovacao === 'pendente') {
      bEl.textContent = 'Gerar (aprovação pendente)'
      bEl.style.background = '#D97706'
    } else {
      bEl.textContent = 'Gerar Proposta'
      bEl.style.background = ''
    }
  }
  const tip = document.getElementById('btn-gen-tooltip')
  if (tip) {
    if (!state.empresa) tip.textContent = 'Preencha o nome da empresa'
    else if (!horasOk) tip.textContent = 'Informe o volume de horas'
    else if (!emailOk) tip.textContent = 'E-mail inválido'
    else if (isPremium) tip.textContent = 'Integração Premium é sob consulta'
    else tip.textContent = 'Pronto para gerar!'
  }
}

/* ════════════════════════════════════════
   PAYLOAD (Novos Clientes)
════════════════════════════════════════ */
function renderPayload(horasEfetivas, integ, precoFinal, mensalSB, totalGeral, descVal, whatsTotal, whatsPreco) {
  if (!currentUser) return
  const cfg = loadConfig(),
    hoje = new Date(),
    val = new Date(hoje.getTime() + (cfg.validadeProposta || 15) * 86400000),
    fmtD = (d) => d.toLocaleDateString('pt-BR')
  const data = {
    nome_empresa: state.empresa || '',
    crm_cliente: state.crm || '',
    contato_nome: state.contatoNome || '',
    contato_email: state.contatoEmail || '',
    titulo_proposta: `Salesbud - Apresentacao e Proposta - ${state.empresa || '(empresa)'}`,
    pacote_horas: String(horasEfetivas),
    preco_mensalidade: precoFinal ? fmt(precoFinal) + '/mês' : 'Sob consulta',
    fee_manutencao:
      state.integKey === 'todos' ? 'Ver proposta' : integ.fee > 0 ? fmt(integ.fee) + '/mês' : 'Não incluso',
    preco_whatsapp:
      state.whatsAtivo && state.whatsUsers > 0
        ? `${fmt(whatsTotal)}/mês para ${state.whatsUsers} usuários`
        : 'Não incluso',
    total_geral_mes: precoFinal != null ? fmt(precoFinal + whatsTotal + (integ.fee || 0)) + '/mês' : 'Sob consulta',
    detalhe_desconto: descVal > 0 ? `Desconto de ${state.desconto}% aplicado` : 'Preço padrão',
    preco_setup:
      state.integKey === 'todos'
        ? 'Ver proposta'
        : integ.setup != null
          ? integ.setup === 0
            ? 'Gratuito'
            : fmt(integ.setup)
          : 'Sob consulta',
    descricao_setup: integ.descricao,
    vendedor_nome: currentUser.nome,
    vendedor_email: currentUser.email,
    vendedor_telefone: currentUser.telefone || '',
    vendedor_cidade: currentUser.cidade || '',
    desconto_pct: state.desconto,
    aprovacao_desconto: state.desconto > 10 ? state._aprovacaoDesconto || null : null,
    template_url: cfg.templateUrl || '',
    template_versao: cfg.templateVersao || '',
    data_proposta: fmtD(hoje),
    validade_proposta: fmtD(val),
    tipo_proposta: 'novo',
    plano_integracao: state.integKey,
    preco_setup_basico: isCrmNativo(state.crm) || state.crm === '' ? 'Gratuito' : 'R$ 1.200',
    total_avancado: precoFinal != null ? fmt(precoFinal + 499 + whatsTotal) + '/mês' : 'Sob consulta'
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
        btnEl.innerHTML = '✓ Proposta enviada!'
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
  document.getElementById('horas-input').value = t
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
    integKey: 'basico',
    whatsAtivo: true,
    whatsUsers: 5,
    desconto: 0,
    _aprovacaoDesconto: null
  }
  ;['empresa', 'contato-nome', 'contato-email'].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  document.getElementById('crm').value = ''
  document.getElementById('horas-input').value = '300'
  document.getElementById('whats-users').value = '5'
  document.getElementById('desconto').value = '0'
  document.getElementById('desc-label').textContent = '0%'
  document.querySelectorAll('.integ-card').forEach((c, i) => c.classList.toggle('active', i === 0))
  document.getElementById('integ-modo-esp')?.classList.add('active')
  document.getElementById('integ-modo-todos')?.classList.remove('active')
  document.getElementById('integ-cards-wrap')?.style.setProperty('display', '')
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
  whatsAtivo: true,
  whatsUsers: 5,
  desconto: 0,
  _aprovacaoDesconto: null,
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
  document.getElementById('base-horas-input').value = t
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
function setIntegModo(modo, mod = 'novo') {
  const isTodos = modo === 'todos'
  const p = getPrefix(mod)
  const s = getState(mod)
  const espId = p + 'integ-modo-esp'
  const todosId = p + 'integ-modo-todos'
  const wrapId = mod === 'novo' ? 'integ-cards-wrap' : 'base-integ-btns'
  document.getElementById(espId).classList.toggle('active', !isTodos)
  document.getElementById(todosId).classList.toggle('active', isTodos)
  const wrapEl = document.getElementById(wrapId)
  if (wrapEl) wrapEl.style.display = isTodos ? 'none' : ''
  if (isTodos) {
    if (s.integKey !== 'todos') s._prevIntegKey = s.integKey
    s.integKey = 'todos'
  } else {
    s.integKey = s._prevIntegKey || 'basico'
    const selector = mod === 'novo' ? '.integ-card' : '#base-integ-btns .integ-btn'
    document.querySelectorAll(selector).forEach((c) => {
      const k = c.getAttribute('onclick')?.match(/'(\w+)'/)?.[1]
      c.classList.toggle('active', k === s.integKey)
    })
  }
  mod === 'novo' ? update() : updateBase()
}
function setBaseIntegModo(modo) { setIntegModo(modo, 'base'); }

function updateBase() {
  stateBase.empresa = document.getElementById('base-empresa')?.value.trim() || ''
  stateBase.crm = document.getElementById('base-crm')?.value || ''
  stateBase.contatoNome = document.getElementById('base-contato-nome')?.value.trim() || ''
  stateBase.contatoEmail = document.getElementById('base-contato-email')?.value.trim() || ''
  stateBase.horasAtual = parseInt(document.getElementById('base-horas-atual')?.value) || 0
  stateBase.valorAtual = parseFloat(document.getElementById('base-valor-atual')?.value) || 0
  stateBase.usuariosAtual = parseInt(document.getElementById('base-usuarios-atual')?.value) || 0
  stateBase.whatsUsers = parseInt(document.getElementById('base-whats-users')?.value) || 1
  stateBase.desconto = parseInt(document.getElementById('base-desconto')?.value) || 0
  stateBase.diag.nCampos = parseInt(document.getElementById('diag-ncampos')?.value) || 0
  document.getElementById('base-desc-label').textContent = stateBase.desconto + '%'
  const hd = parseInt(document.getElementById('base-horas-input')?.value) || 0,
    r = calcPrecoExato(hd)
  const precoBase = r.precoEfetivo,
    descVal = Math.round(precoBase * (stateBase.desconto / 100)),
    precoFinal = precoBase - descVal
  let integ,
    feeInteg = 0
  const isTodosBase = stateBase.integKey === 'todos'
  if (isTodosBase) {
    integ = {
      nome: 'Todos os planos',
      tag: 'tag-basico',
      label: 'Cliente escolhe na proposta',
      setup: null,
      fee: 0,
      scope: [],
      descricao: ''
    }
  } else {
    integ = { ...(INTEG[stateBase.integKey] || INTEG.basico) }
    feeInteg = integ.fee || 0
    if (stateBase.integKey === 'basico' && stateBase.crm && !isCrmNativo(stateBase.crm)) {
      integ.setup = 1200
    }
    const _bbs = document.querySelector('#base-integ-btns .integ-btn:first-child span')
    if (_bbs) _bbs.textContent = stateBase.crm && !isCrmNativo(stateBase.crm) ? 'R$ 1.200' : 'Grátis'
  }
  const whatsTotal = stateBase.whatsAtivo ? getTotalWhats(stateBase.whatsUsers) : 0,
    whatsPreco = stateBase.whatsAtivo ? getWhatsPrice(stateBase.whatsUsers) : 0
  const totalMensal = precoFinal + feeInteg + whatsTotal
  document.getElementById('base-horas-label').textContent = r.horasEfetivas.toLocaleString('pt-BR') + 'h'
  const tLen = getTabelaAtiva().length
  document.getElementById('base-pacote-idx').textContent = r.acimaDaTabela
    ? `R$ ${r.precoHora.toFixed(3)}/h (acima da tabela)`
    : r.interpolado
      ? `interpolado · R$ ${r.precoHora.toFixed(3)}/h`
      : `pacote ${r.tierIdx + 1} de ${tLen}`
  document.getElementById('base-preco-label').textContent = fmt(precoFinal)
  {
    const dEl = document.getElementById('base-desconto-info')
    if (dEl) {
      if (descVal > 0) {
        dEl.innerHTML = `<span style='color:#F87171;font-weight:700'>−${fmt(descVal)}/mês</span> &nbsp;<span style='color:rgba(255,255,255,.4);font-size:10px'>economia ${fmt(descVal * 12)}/ano</span>`
        dEl.style.display = 'block'
      } else dEl.style.display = 'none'
    }
  }
  const bTgh = document.getElementById('base-total-label-header'),
    bTgl = document.getElementById('base-total-geral-label')
  if (bTgh && bTgl) {
    if (whatsTotal > 0) {
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
      s = dv >= 0 ? '+' : ''
    dl.innerHTML =
      dv !== 0
        ? `<span style="color:${dv > 0 ? 'var(--pink)' : 'var(--green)'};font-weight:700">${s}${fmt(dv)}/mês</span> <span style="opacity:.5">(${s}${p}%)</span>`
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
  renderDiagTags()
  document.getElementById('base-premium-alert').style.display = 'none'
  renderBasePayload(r, integ, precoFinal, totalMensal, stateBase.desconto / 100, whatsTotal, whatsPreco)
  const horasOk = hd > 0,
    baseCanGen = !!stateBase.empresa && !!stateBase.crm && horasOk,
    bb = document.getElementById('base-btn-gen')
  if (bb) bb.disabled = !baseCanGen
  if (stateBase.crm) {
    document.getElementById('err-base-crm')?.classList.remove('show')
    document.getElementById('base-crm')?.classList.remove('error')
  }
  const ld = loadConfig().descontoMax ?? 10
  if (bb) {
    if (stateBase.desconto > ld && stateBase._aprovacaoDesconto?.status_aprovacao === 'pendente') {
      bb.textContent = 'Gerar (aprovação pendente)'
      bb.style.background = '#D97706'
    } else {
      bb.textContent = 'Gerar Proposta de Upsell'
      bb.style.background = ''
    }
  }
  const bt = document.getElementById('base-btn-gen-tooltip')
  if (bt) {
    if (!stateBase.empresa) bt.textContent = 'Preencha o nome da empresa'
    else if (!stateBase.crm) bt.textContent = 'Selecione o CRM'
    else if (!horasOk) bt.textContent = 'Informe o volume de horas'
    else bt.textContent = 'Pronto para gerar!'
  }
}

function renderDiagTags() {
  const d = stateBase.diag,
    el = document.getElementById('base-diag-tags')
  if (!el) return
  const touched = d.crm || d.voip || d.whats || d.cs || d.extras
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
  if (d.cs) ativos.push('Customer Success')
  if (d.extras) ativos.push('Dev Custom')
  const opsAlta = [],
    opsMed = []
  if (!d.crm) opsAlta.push('Ativar CRM')
  if (!d.voip) opsAlta.push('Integrar Voip')
  if (!d.whats) opsAlta.push('Ativar WhatsApp')
  if (d.crm && !d.campos) opsMed.push('Campos personalizados')
  if (!d.cs) opsMed.push('Customer Success')
  if (!d.extras) opsMed.push('Dev / Automação')
  const score = ativos.length,
    sp = Math.round((score / 7) * 100),
    sc = score <= 2 ? '#D97706' : score <= 4 ? '#2563EB' : 'var(--green)',
    sl = score <= 2 ? 'Baixa adoção' : score <= 4 ? 'Adoção parcial' : 'Alta adoção'
  let html = `<div style="width:100%;display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;background:#F6F8FC;border-radius:8px;border:1.5px solid var(--border)"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Score de Adoção</div><div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden"><div style="height:100%;width:${sp}%;background:${sc};border-radius:99px"></div></div></div><div style="text-align:right;flex-shrink:0"><div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:${sc}">${score}/7</div><div style="font-size:10px;color:var(--text3);font-weight:600">${sl}</div></div></div>`
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
  const hints = []
  if (!d.crm && !d.voip && !d.whats) hints.push('Nenhum canal ativo — potencial amplo de expansão.')
  if (d.crm && d.campos && (d.nCampos || 0) >= 5)
    hints.push('Muitos campos — pacote Intermediário ou Premium recomendado.')
  if (!d.whats && !d.voip) hints.push('Sem canal de comunicação ativo — abertura para proposta multi-canal.')
  const he = document.getElementById('base-sugestao-hint')
  if (he)
    he.innerHTML = hints
      .map(
        (h) =>
          `<div style="margin-bottom:5px;padding:6px 10px;background:#FFFBEB;border-left:3px solid #FDE68A;border-radius:0 6px 6px 0;font-size:12px;color:var(--text2)">${h}</div>`
      )
      .join('')
}

function renderBasePayload(r, integ, precoFinal, totalMensal, descFrac, whatsTotal, whatsPreco) {
  const u = currentUser || {},
    cfg = loadConfig(),
    hoje = new Date(),
    val = new Date(hoje)
  val.setDate(hoje.getDate() + (cfg.validadeProposta || 15))
  const fmtD = (d) => d.toLocaleDateString('pt-BR')
  const payload = {
    tipo_proposta: 'upsell_base',
    plano_integracao: stateBase.integKey,
    nome_empresa: stateBase.empresa,
    crm_cliente: stateBase.crm,
    contato_nome: stateBase.contatoNome || '',
    contato_email: stateBase.contatoEmail || '',
    num_usuarios: stateBase.usuariosAtual,
    horas_atual: String(stateBase.horasAtual || '—'),
    valor_atual: stateBase.valorAtual > 0 ? `R$ ${stateBase.valorAtual.toLocaleString('pt-BR')}/mês` : '—',
    diag_crm: stateBase.diag.crm ? 'Sim' : 'Não',
    diag_voip: stateBase.diag.voip ? 'Sim' : 'Não',
    diag_whatsapp: stateBase.diag.whats ? 'Sim' : 'Não',
    diag_cs: stateBase.diag.cs ? 'Sim' : 'Não',
    titulo_proposta: `Salesbud - Apresentacao e Proposta - ${stateBase.empresa || 'Cliente'}`,
    pacote_horas: String(r.horasEfetivas),
    preco_mensalidade: `${fmt(precoFinal)}/mês`,
    fee_manutencao:
      stateBase.integKey === 'todos' ? 'Ver proposta' : integ.fee > 0 ? fmt(integ.fee) + '/mês' : 'Não incluso',
    preco_whatsapp: stateBase.whatsAtivo
      ? `${fmt(whatsTotal)}/mês para ${stateBase.whatsUsers} usuários`
      : 'Não incluso',
    total_geral_mes: `${fmt(precoFinal + whatsTotal + (integ.fee || 0))}/mês`,
    detalhe_desconto: stateBase.desconto > 0 ? `Desconto ${stateBase.desconto}% aplicado` : 'Preço padrão',
    preco_setup: stateBase.integKey === 'todos' ? 'Ver proposta' : integ.setup > 0 ? fmt(integ.setup) : 'Gratuito',
    descricao_setup: integ.descricao,
    vendedor_nome: u.nome || '',
    vendedor_email: u.email || '',
    vendedor_telefone: u.telefone || '',
    vendedor_cidade: u.cidade || '',
    desconto_pct: stateBase.desconto,
    template_url: cfg.templateUrl || '',
    template_versao: cfg.templateVersao || '',
    data_proposta: fmtD(hoje),
    validade_proposta: fmtD(val),
    preco_setup_basico: isCrmNativo(stateBase.crm) || stateBase.crm === '' ? 'Gratuito' : 'R$ 1.200',
    total_avancado: fmt(precoFinal + 499 + whatsTotal) + '/mês'
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
    whatsAtivo: true,
    whatsUsers: 5,
    desconto: 0,
    _aprovacaoDesconto: null,
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
    ['base-horas-input', '300'],
    ['base-whats-users', '5'],
    ['base-desconto', '0']
  ].forEach(([id, v]) => {
    const el = document.getElementById(id)
    if (el) el.value = v
  })
  const _bdl = document.getElementById('base-desc-label')
  if (_bdl) _bdl.textContent = '0%'
  document.getElementById('base-comparativo').style.display = 'none'
  document.getElementById('base-integ-modo-esp')?.classList.add('active')
  document.getElementById('base-integ-modo-todos')?.classList.remove('active')
  document.getElementById('base-integ-btns')?.style.setProperty('display', '')
  updateBase()
}

/* ════════════════════════════════════════
   APROVAÇÃO DESCONTO
════════════════════════════════════════ */
let _aprovacaoModulo = 'proposta'
function pedirAprovacaoDesconto(val, modulo) {
  _aprovacaoModulo = modulo
  const lim = loadConfig().descontoMax ?? 10
  document.getElementById('aprv-limite-pct').textContent = lim + '%'
  const empresa = modulo === 'proposta' ? state.empresa : stateBase.empresa
  document.getElementById('aprv-context').textContent = empresa || '—'
  document.getElementById('aprv-pct').textContent = val + '%'
  document.getElementById('aprv-justificativa').value = ''
  document.getElementById('approval-overlay').classList.add('show')
}
function cancelarAprovacao() {
  document.getElementById('approval-overlay').classList.remove('show')
  if (_aprovacaoModulo === 'proposta') {
    state.desconto = 0
    document.getElementById('desconto').value = 0
    document.getElementById('desc-label').textContent = '0%'
    document
      .querySelectorAll('#disc-presets-novos .disc-preset')
      .forEach((b) => b.classList.toggle('active', b.textContent === '0%'))
    update()
  } else {
    stateBase.desconto = 0
    document.getElementById('base-desconto').value = 0
    document.getElementById('base-desc-label').textContent = '0%'
    document
      .querySelectorAll('#disc-presets-base .disc-preset')
      .forEach((b) => b.classList.toggle('active', b.textContent === '0%'))
    updateBase()
  }
}
function confirmarAprovacao() {
  const just = document.getElementById('aprv-justificativa').value.trim()
  if (!just) {
    showToast('Preencha a justificativa.', 'info')
    return
  }
  const pct = parseInt(document.getElementById('aprv-pct').textContent),
    vl = document.getElementById('aprv-validade').value,
    av = {
      status_aprovacao: 'pendente',
      justificativa: just,
      desconto_solicitado: pct,
      solicitante: currentUser?.nome,
      validade: vl,
      ts: new Date().toISOString()
    }
  document.getElementById('approval-overlay').classList.remove('show')
  if (_aprovacaoModulo === 'proposta') {
    state.desconto = pct
    state._aprovacaoDesconto = av
    document.getElementById('desconto').value = Math.min(pct, 30)
    document.getElementById('desc-label').textContent = pct + '%'
    document
      .querySelectorAll('#disc-presets-novos .disc-preset')
      .forEach((b) => b.classList.toggle('active', parseInt(b.textContent) === pct))
    update()
  } else {
    stateBase.desconto = pct
    stateBase._aprovacaoDesconto = av
    document.getElementById('base-desconto').value = Math.min(pct, 40)
    document.getElementById('base-desc-label').textContent = pct + '%'
    document
      .querySelectorAll('#disc-presets-base .disc-preset')
      .forEach((b) => b.classList.toggle('active', parseInt(b.textContent) === pct))
    updateBase()
  }
  showToast(`Desconto ${pct}% registrado como pendente.`, 'info')
}

/* ════════════════════════════════════════
   CONFIG
════════════════════════════════════════ */
const CONFIG_DEFAULT = {
  webhookUrl: 'https://hook.make.com/seu-webhook',
  webhookToken: '',
  templateUrl: '',
  templateVersao: '',
  validadeProposta: 15,
  descontoMax: 10,
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
  const cfg = loadConfig()
  document.getElementById('cfg-supabase-url').value = cfg.supabaseUrl || ''
  document.getElementById('cfg-supabase-key').value = cfg.supabaseKey || ''
  document.getElementById('cfg-webhook-url').value = cfg.webhookUrl || ''
  document.getElementById('cfg-webhook-token').value = cfg.webhookToken || ''
  document.getElementById('cfg-template-url').value = cfg.templateUrl || ''
  document.getElementById('cfg-template-versao').value = cfg.templateVersao || ''
  document.getElementById('cfg-validade').value = cfg.validadeProposta || 15
  document.getElementById('cfg-desconto-max').value = cfg.descontoMax || 10
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
}
function salvarConfig() {
  saveConfig({
    webhookUrl: document.getElementById('cfg-webhook-url').value.trim(),
    webhookToken: document.getElementById('cfg-webhook-token').value.trim(),
    validadeProposta: parseInt(document.getElementById('cfg-validade').value) || 15,
    descontoMax: parseInt(document.getElementById('cfg-desconto-max').value) || 10
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
function salvarTabelaPrecos() {
  const tab = getTabelaAtiva()
  localStorage.setItem('salesbud_tabela', JSON.stringify(tab))
  localStorage.setItem('salesbud_tabela_ver', String(TABELA_VERSION))
  tabelaEditavel = tab
  showToast('Tabela salva.', 'success')
}
function resetarTabela() {
  if (!confirm('Restaurar tabela original?')) return
  tabelaEditavel = TABELA_HORAS_DEFAULT.map((t) => ({ ...t }))
  localStorage.removeItem('salesbud_tabela')
  localStorage.removeItem('salesbud_tabela_ver')
  renderTabelaConfig()
  showToast('Tabela restaurada.', 'success')
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
  localStorage.setItem(CRM_LIST_KEY, JSON.stringify(list))
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
      area.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:8px">${data.length} faixas importadas ✓</div><div class="import-preview"><table><thead><tr><th>Horas</th><th>Preço</th><th>R$/h</th></tr></thead><tbody>${data.map((r) => `<tr><td>${r.horas.toLocaleString('pt-BR')}h</td><td>${fmt(r.preco)}</td><td>R$ ${(r.preco / r.horas).toFixed(3)}</td></tr>`).join('')}</tbody></table></div><button onclick="salvarTabelaPrecos()" style="margin-top:10px;padding:8px 16px;background:var(--pink);color:white;border:none;border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">Salvar esta tabela</button>`
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
  const desconto = obj.detalhe_desconto && obj.detalhe_desconto !== 'Preço padrão' ? esc(obj.detalhe_desconto) : null
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
    ${desconto ? `<div class="row"><span class="label">Desconto</span><span class="val pink">${desconto}</span></div>` : ''}
    ${obj.fee_manutencao && obj.fee_manutencao !== 'Não incluso' ? `<div class="row"><span class="label">Manutenção integração</span><span class="val">${obj.fee_manutencao}</span></div>` : ''}
    ${whats ? `<div class="row"><span class="label">WhatsApp</span><span class="val">${whats}</span></div>` : ''}
  </div>

  <div class="total-box">
    <span class="label">Total mensal${whats ? ' (c/ WhatsApp)' : ''}</span>
    <span class="val">${totalGeral}</span>
  </div>

  ${setup ? `<div class="setup-box">+ Setup de integração: <strong>${setup}</strong> — pagamento pontual, parcelável em até 12x</div>` : ''}

  ${integ ? `<div class="section" style="margin-top:24px"><div class="section-title">Integração CRM</div><div class="row"><span class="label">Plano</span><span class="val">${integ}</span></div></div>` : ''}

  <div class="validity">✓ Proposta válida até ${validade}</div>

  <div class="footer">
    SalesBud · Proposta gerada em ${data} por ${vendedor}<br>
    Desconto válido somente para primeiras assinaturas contratuais realizadas dentro do mês de validade.
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
        <button onclick="fecharEditModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6B7A99">✕</button>
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
