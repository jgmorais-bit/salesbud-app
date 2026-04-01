/* ════════════════════════════════════════
   base.js — State, toggles, update, payload, calc, reset, diag (Clientes de Base)
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

/* ════════════════════════════════════════
   CALCULADORA (Base)
════════════════════════════════════════ */
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
  const adicional = Math.max(0, t)
  document.getElementById('base-horas-input').value = adicional
  updateBase()
}

/* ════════════════════════════════════════
   DIAGNÓSTICO
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   UPDATE (Clientes de Base)
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   DIAG TAGS
════════════════════════════════════════ */
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

/* ════════════════════════════════════════
   PAYLOAD (Clientes de Base)
════════════════════════════════════════ */
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
  const isEmpty = !stateBase.crm || stateBase.crm === ''
  const isCrmNat = isCrmNativo(stateBase.crm)
  const descSetup = isEmpty
    ? 'Sem integração de CRM'
    : setupDetailParts.length
      ? setupDetailParts.join(' + ')
      : 'CRM nativo — setup gratuito'
  const mrrDetailParts = []
  if (_mTar > 0) mrrDetailParts.push('Tarefas automáticas ' + fmt(_mTar) + '/mês')
  if (_mCamp > 0) mrrDetailParts.push('Campos personalizados (' + stateBase.integCampos + ') ' + fmt(_mCamp) + '/mês')
  const isSemCrm = isEmpty
  const mrrDetalhe = isSemCrm
    ? ''
    : mrrDetailParts.length
      ? mrrDetailParts.join(' + ')
      : 'Integração padrão incluída'
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
    mensalidade_completa: mrrInteg > 0 ? fmt(precoFinal) + '/mês + ' + fmt(mrrInteg) + '/mês' : fmt(precoFinal) + '/mês',
    fee_manutencao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : '',
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
    mrr_integracao: mrrInteg > 0 ? fmt(mrrInteg) + '/mês' : '',
    mrr_integracao_detalhamento: mrrDetalhe,
    // Adicionais
    adicionais_lista: adicAtivos.length ? adicAtivos.join('; ') : 'Nenhum',
    adicionais_total: adicTotal > 0 ? fmt(adicTotal) + '/mês' : 'Não incluso',
    // Legado — backward compatibility
    preco_setup_basico: (isCrmNat || isEmpty) ? 'Gratuito' : fmt(ip.crm_personalizado_setup),
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
   RESET (Clientes de Base)
════════════════════════════════════════ */
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
