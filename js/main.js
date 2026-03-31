/* ════════════════════════════════════════
   main.js — DOMContentLoaded, iniciarApp, navTo, enviarWebhook, utils compartilhados
════════════════════════════════════════ */

/* ── Helpers compartilhados (Novos + Base) ── */
function getState(mod) { return mod === 'novo' ? state : stateBase; }
function getPrefix(mod) { return mod === 'novo' ? '' : 'base-'; }

/* ── HubSpot Prefill ── */
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

/* ── Arredondar horas ── */
function arredondarHoras() {
  const bArr = document.getElementById('btn-arredondar')
  const t = parseInt(bArr?.dataset.target) || 0
  if (!t) return
  document.getElementById('horas-input').value = t
  update()
  showToast('Arredondado para ' + t.toLocaleString('pt-BR') + 'h', 'success')
}

/* ── Nova Proposta (confirm) ── */
function novaPropostaConfirm() {
  const p = document.querySelector('.page.active')?.id,
    d = p === 'page-proposta' ? state.empresa || state.crm : stateBase.empresa || stateBase.crm || stateBase.valorAtual
  if (d && !confirm('Limpar o formulário e começar nova proposta?')) return
  if (p === 'page-base') resetStateBase()
  else resetState()
}

/* ── Enviar Webhook ── */
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

/* ── Profile menu ── */
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

/* ── Nav ── */
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

/* ── iniciarApp ── */
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

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('screen-loading')
  const hideLoading = () => { if (loading) loading.style.display = 'none' }
  const timeoutId = setTimeout(() => { hideLoading(); mostrarScreen('login') }, 5000)

  loadUsersLocal()
  initSupabase()
  const _hp = new URLSearchParams(window.location.hash.substring(1))
  if (_hp.get('type') === 'recovery' && _hp.get('access_token')) {
    clearTimeout(timeoutId)
    hideLoading()
    mostrarScreen('login')
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
  // Se "manter conectado" estava OFF e o sessionStorage foi limpo (browser fechado/reaberto) → logout automático
  if (localStorage.getItem('salesbud_no_persist') === 'true' && !sessionStorage.getItem('salesbud_session_temp')) {
    if (isSupabaseAuthReady()) {
      try { await supabaseClient.auth.signOut() } catch {}
    }
    clearTimeout(timeoutId)
    hideLoading()
    const lastEmail = localStorage.getItem(LAST_EMAIL_KEY)
    if (lastEmail) { const el = document.getElementById('login-email'); if (el) el.value = lastEmail }
    mostrarScreen('login')
    return
  }
  if (await restoreSession()) {
    clearTimeout(timeoutId)
    hideLoading()
    iniciarApp()
    return
  }
  clearTimeout(timeoutId)
  hideLoading()
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
  mostrarScreen('login')
})
