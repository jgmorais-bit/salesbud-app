/* ════════════════════════════════════════
   novos.js — State, toggles, update, payload, calc, reset (Novos Clientes)
════════════════════════════════════════ */

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
   UPDATE / CALCULOS (Novos Clientes)
════════════════════════════════════════ */
function enforceHorasMin() {
  const el = document.getElementById('horas-input')
  const v = parseInt(el.value) || 0
  if (v < 50) { el.value = 50; update() }
}
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
  const { setupCrm: _sCrm, setupRegras: _sRegras, setupPipelines: _sPipe, setupTarefas: _sTar, setupCampos: _sCamp, blocosC: _bC, mrrTarefas: _mTar, mrrCampos: _mCamp } = calcIntegModular(state)
  const setupDetailParts = []
  if (_sCrm > 0) setupDetailParts.push('CRM personalizado')
  if (_sRegras > 0) setupDetailParts.push('Personalização de regras')
  if (_sPipe > 0) setupDetailParts.push(state.integPipelines + (state.integPipelines === 1 ? ' pipeline adicional' : ' pipelines adicionais'))
  if (_sTar > 0) setupDetailParts.push('Tarefas automáticas')
  if (_sCamp > 0) setupDetailParts.push(state.integCampos + ' campos (' + _bC + (_bC === 1 ? ' bloco)' : ' blocos)'))
  const isEmpty = !state.crm || state.crm === ''
  const descSetup = isEmpty
    ? 'Sem integração de CRM'
    : setupDetailParts.length
      ? setupDetailParts.join(' + ')
      : 'CRM nativo — setup gratuito'
  const mrrDetailParts = []
  if (_mTar > 0) mrrDetailParts.push('Tarefas automáticas')
  if (_mCamp > 0) mrrDetailParts.push('Campos personalizados (' + state.integCampos + ')')
  const isSemCrm = isEmpty
  const mrrDetalhe = isSemCrm
    ? ''
    : mrrDetailParts.length
      ? mrrDetailParts.join(' + ')
      : 'Integração padrão incluída'
  const mensalidadeParts = ['Horas']
  if (_mTar > 0) mensalidadeParts.push('Tarefas automáticas')
  if (_mCamp > 0) mensalidadeParts.push('Campos personalizados (' + state.integCampos + ')')
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
    mensalidade_completa_somada: precoFinal ? fmt(precoFinal + mrrInteg) + '/mês' : 'Sob consulta',
    mensalidade_detalhamento: mensalidadeParts.join(' + '),
    fee_manutencao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : '',
    preco_whatsapp:
      state.whatsAtivo && state.whatsUsers > 0
        ? `${fmt(whatsTotal)}/mês para ${state.whatsUsers} usuários`
        : 'Não incluso',
    total_geral_mes: totalGeral != null ? fmt(totalGeral) + '/mês' : 'Sob consulta',
    vendedor_nome: currentUser.nome,
    vendedor_email: currentUser.email,
    vendedor_telefone: currentUser.telefone || '',
    vendedor_cidade: currentUser.cidade || '',
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
    mrr_integracao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : '',
    mrr_integracao_detalhamento: mrrDetalhe,
    // Adicionais
    adicionais_lista: adicAtivos.length ? adicAtivos.join('; ') : 'Nenhum',
    adicionais_total: adicTotal > 0 ? fmt(adicTotal) + '/mês' : 'Não incluso'
  }
  // Sanitiza payload — Make rejeita replaceText vazio
  Object.keys(data).forEach(key => {
    if (data[key] === '' || data[key] === null || data[key] === undefined) {
      data[key] = '\u2014'
    }
  })
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
