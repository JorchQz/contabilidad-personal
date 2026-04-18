// js/auth.js — Módulo de Autenticación
import { db } from './supabase.js';
import { renderLucideIcons } from './app.js';
import { renderApp, renderOnboarding } from './app.js';

export function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo">
        <div class="logo-mark">JM</div>
        <div class="logo-text">
          <span class="logo-jm">JM Finance</span>
          <span class="logo-finance">Control de tus finanzas</span>
        </div>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login">Iniciar sesión</button>
        <button class="auth-tab" id="tab-registro">Crear cuenta</button>
      </div>

      <div id="auth-error" class="auth-error" style="display:none;width:100%;max-width:360px"></div>

      <div id="auth-panel-login" class="auth-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="auth-email" type="email" placeholder="tu@email.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <div class="auth-password-wrap">
            <input class="form-input" id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password" />
            <button class="auth-eye-btn" type="button" id="eye-auth-password">
              <i data-lucide="eye" style="width:16px;height:16px"></i>
            </button>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-login">Entrar</button>
      </div>

      <div id="auth-panel-registro" class="auth-form" style="display:none">
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-input" id="reg-nombre" type="text" placeholder="Tu nombre" autocomplete="name" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="reg-email" type="email" placeholder="tu@email.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <div class="auth-password-wrap">
            <input class="form-input" id="reg-password" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
            <button class="auth-eye-btn" type="button" id="eye-reg-password">
              <i data-lucide="eye" style="width:16px;height:16px"></i>
            </button>
          </div>
          <div id="password-strength" class="password-strength" style="display:none">
            <div class="strength-bar"><div id="strength-fill" class="strength-fill"></div></div>
            <span id="strength-label" class="strength-label"></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar contraseña</label>
          <div class="auth-password-wrap">
            <input class="form-input" id="reg-password2" type="password" placeholder="Repite la contraseña" autocomplete="new-password" />
            <button class="auth-eye-btn" type="button" id="eye-reg-password2">
              <i data-lucide="eye" style="width:16px;height:16px"></i>
            </button>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-registro">Crear cuenta</button>
      </div>
    </div>
  `;
  renderLucideIcons();
}

export function initAuthEvents() {
  document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-registro').addEventListener('click', () => switchAuthTab('registro'));

  document.getElementById('btn-login').addEventListener('click', loginUsuario);
  document.getElementById('btn-registro').addEventListener('click', registrarUsuario);

  document.getElementById('eye-auth-password').addEventListener('click', function () {
    toggleAuthPassword('auth-password', this);
  });
  document.getElementById('eye-reg-password').addEventListener('click', function () {
    toggleAuthPassword('reg-password', this);
  });
  document.getElementById('eye-reg-password2').addEventListener('click', function () {
    toggleAuthPassword('reg-password2', this);
  });

  document.getElementById('reg-password').addEventListener('input', (e) => {
    updatePasswordStrength(e.target.value);
  });
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-registro').classList.toggle('active', !isLogin);
  document.getElementById('auth-panel-login').style.display = isLogin ? 'block' : 'none';
  document.getElementById('auth-panel-registro').style.display = isLogin ? 'none' : 'block';
  const err = document.getElementById('auth-error');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

function toggleAuthPassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.innerHTML = isPassword
    ? '<i data-lucide="eye-off" style="width:16px;height:16px"></i>'
    : '<i data-lucide="eye" style="width:16px;height:16px"></i>';
  renderLucideIcons();
}

function updatePasswordStrength(value) {
  const strengthEl = document.getElementById('password-strength');
  const fillEl = document.getElementById('strength-fill');
  const labelEl = document.getElementById('strength-label');
  if (!strengthEl) return;

  if (value.length === 0) { strengthEl.style.display = 'none'; return; }
  strengthEl.style.display = 'flex';

  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  let label, color, width;
  if (score <= 1) { label = 'Débil'; color = 'var(--red)'; width = '33%'; }
  else if (score <= 3) { label = 'Media'; color = 'var(--yellow)'; width = '66%'; }
  else { label = 'Fuerte'; color = 'var(--green)'; width = '100%'; }

  fillEl.style.width = width;
  fillEl.style.background = color;
  labelEl.textContent = label;
  labelEl.style.color = color;
}

function mostrarErrorAuth(msg) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

async function loginUsuario() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    mostrarErrorAuth('Completa todos los campos');
    return;
  }

  const btnLogin = document.getElementById('btn-login');
  btnLogin.textContent = 'Entrando...';
  btnLogin.disabled = true;

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    mostrarErrorAuth('Email o contraseña incorrectos');
    btnLogin.textContent = 'Entrar';
    btnLogin.disabled = false;
    return;
  }

  const userId = (await db.auth.getUser()).data.user.id;
  const { data: usuario } = await db.from('usuarios')
    .select('onboarding_completo')
    .eq('id', userId)
    .maybeSingle();

  if (usuario?.onboarding_completo) {
    renderApp();
  } else {
    renderOnboarding();
  }
}

async function registrarUsuario() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;

  if (!nombre || !email || !password || !password2) {
    mostrarErrorAuth('Completa todos los campos');
    return;
  }

  if (password !== password2) {
    mostrarErrorAuth('Las contraseñas no coinciden');
    return;
  }

  if (password.length < 6) {
    mostrarErrorAuth('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const btnReg = document.getElementById('btn-registro');
  btnReg.textContent = 'Creando cuenta...';
  btnReg.disabled = true;

  const { error } = await db.auth.signUp({ email, password });

  if (error) {
    mostrarErrorAuth('Error al crear cuenta: ' + error.message);
    btnReg.textContent = 'Crear cuenta';
    btnReg.disabled = false;
    return;
  }

  window._regNombre = nombre;
  renderOnboarding();
}

export async function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  await db.auth.signOut();
  localStorage.removeItem('jmf_usuario_id');
  location.reload();
}

// cerrarSesion se invoca desde onclick dinámico en loadAjustes
window.cerrarSesion = cerrarSesion;
