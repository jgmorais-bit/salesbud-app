/* ════════════════════════════════════════
   ui.js — Navegacao de telas, toast, utilitarios de UI, breakdown
════════════════════════════════════════ */

function mostrarScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'))
  document.getElementById('screen-' + id).classList.add('active')
}

let toastTimer
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = `toast ${type} show`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500)
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

function validarEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

/* ── Breakdown compartilhado ── */
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

/* ── Fallback webhook ── */
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

/* ── Template banner ── */
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
