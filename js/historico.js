/* ════════════════════════════════════════
   historico.js — Historico, CRUD propostas, perda, edicao, export, PDF
════════════════════════════════════════ */

let _histSelected = new Set(),
  _histAllData = []
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
   SELECAO EM MASSA
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
   MOTIVO PERDA
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
   REENVIAR PROPOSTA
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
