/* ════════════════════════════════════════
   auth.js — Login, logout, sessao, loading, setup, esqueci senha, alterar senha
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
          const keepLogged = document.getElementById('keep-logged')?.checked ?? true
          if (!keepLogged) {
            localStorage.setItem('salesbud_no_persist', 'true')
            sessionStorage.setItem('salesbud_session_temp', 'true')
          } else {
            localStorage.removeItem('salesbud_no_persist')
            sessionStorage.removeItem('salesbud_session_temp')
          }
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
  localStorage.removeItem('salesbud_no_persist')
  sessionStorage.removeItem('salesbud_session_temp')
  currentUser = null
  clearSession()
  mostrarScreen('login')
  document.getElementById('login-email').value = ''
  document.getElementById('login-senha').value = ''
}

/* ── Setup inicial ── */
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

/* ── Esqueci senha / Reset ── */
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

/* ── Alterar senha (perfil) ── */
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
