'use strict';

const state = {
  user: null,
  meta: null,
  page: 'dashboard',
  importsStatus: '',
  importsPage: 1,
  conflictsStatus: '',
  conflictsPage: 1,
  auditPage: 1,
  auditFilters: { action: '', actor: '', entity_type: '' },
  analyticsYear: '2026-27',
  studentSearch: '',
  studentPage: 1
};

const DEMO_ACCOUNTS = [
  { email: 'admin@aicte.demo', label: 'AICTE Admin', role: 'AICTE Administrator' },
  { email: 'registrar@sit.demo', label: 'Institution Admin', role: 'Sunrise Institute' },
  { email: 'submitter@sit.demo', label: 'Data Submitter', role: 'Sunrise Institute' },
  { email: 'verifier@aicte.demo', label: 'Verification Officer', role: 'AICTE' },
  { email: 'auditor@aicte.demo', label: 'Auditor', role: 'Read-only' },
  { email: 'operator@aicte.demo', label: 'System Operator', role: 'Read-only' }
];

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  institutions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>',
  programmes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h6"/></svg>',
  students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 8.5a3 3 0 0 1 0 5.8M18.5 20a5.8 5.8 0 0 0-2-4.4"/></svg>',
  imports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  identity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4.5 6v5c0 4.6 3.1 8.1 7.5 10 4.4-1.9 7.5-5.4 7.5-10V6z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/></svg>',
  conflicts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2.5 20h19z"/><path d="M12 9v4.5M12 17h.01"/></svg>',
  analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  audit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9c.25.62.86 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V5m0 0 4 4m-4-4L8 9M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5L20 7"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4.5 6v5c0 4.6 3.1 8.1 7.5 10 4.4-1.9 7.5-5.4 7.5-10V6z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2.5 20h19z"/><path d="M12 9v4.5M12 17h.01"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 8.5a3 3 0 0 1 0 5.8M18.5 20a5.8 5.8 0 0 0-2-4.4"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>'
};

const PAGE_META = {
  dashboard: { title: 'Dashboard', group: 'Overview', icon: 'dashboard' },
  institutions: { title: 'Institutions', group: 'Administration', icon: 'institutions' },
  programmes: { title: 'Programmes & intake', group: 'Administration', icon: 'programmes' },
  students: { title: 'Students', group: 'Operations', icon: 'students' },
  imports: { title: 'Data imports', group: 'Operations', icon: 'imports' },
  identity: { title: 'Identity verification', group: 'Operations', icon: 'identity' },
  conflicts: { title: 'Conflict review', group: 'Assurance', icon: 'conflicts' },
  analytics: { title: 'Intake analytics', group: 'Assurance', icon: 'analytics' },
  audit: { title: 'Audit trail', group: 'Assurance', icon: 'audit' },
  settings: { title: 'Settings & security', group: 'Administration', icon: 'settings' }
};

const NAV_GROUPS = [
  { label: 'Overview', pages: ['dashboard'] },
  { label: 'Operations', pages: ['students', 'imports', 'identity', 'conflicts'] },
  { label: 'Administration', pages: ['institutions', 'programmes', 'analytics', 'audit', 'settings'] }
];

function $(id) { return document.getElementById(id); }

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function can(capability) {
  return Boolean(state.user && Array.isArray(state.user.capabilities) && state.user.capabilities.includes(capability));
}

function pageAllowed(page) {
  if (page === 'dashboard' || page === 'settings') return true;
  if (page === 'institutions') return can('institution:manage') || can('audit:view');
  if (page === 'programmes') return can('programme:manage') || can('report:view');
  if (page === 'students') return can('student:view');
  if (page === 'imports') return can('import:submit') || can('audit:view');
  if (page === 'identity') return can('student:view');
  if (page === 'conflicts') return can('conflict:view');
  if (page === 'analytics') return can('report:view');
  if (page === 'audit') return can('audit:view');
  return false;
}

function statusTone(status) {
  const value = String(status || '').toUpperCase();
  if (['ACTIVE', 'VERIFIED', 'COMMITTED', 'APPROVED', 'RESOLVED', 'SUCCESS', 'FALSE_POSITIVE'].includes(value)) return 'green';
  if (['READY_FOR_REVIEW', 'ASSIGNED', 'VALID', 'REVIEW', 'PENDING'].includes(value)) return 'amber';
  if (['NEEDS_CORRECTION', 'REJECTED', 'INVALID', 'MISMATCH', 'ERROR', 'FAILED', 'CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(value)) return 'red';
  if (['UPLOADED', 'VALIDATING', 'OPEN', 'UNVERIFIED'].includes(value)) return 'blue';
  if (['ESCALATED', 'NEEDS_INFO', 'UNAVAILABLE'].includes(value)) return 'indigo';
  if (['SUPERSEDED', 'WITHDRAWN', 'TRANSFERRED', 'COMPLETED'].includes(value)) return 'gray';
  return 'gray';
}

function badge(status) {
  if (!status) return '<span class="badge badge-gray">Unknown</span>';
  const label = String(status).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `<span class="badge badge-${statusTone(status)}">${esc(label)}</span>`;
}

function fmtNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return Number(value).toLocaleString('en-IN');
}

function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function roleLabel(role) {
  const base = String(role || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return base || 'User';
}

function titleCase(value) {
  return String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function api(path, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (opts.body && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  opts.headers = headers;
  const response = await fetch(`/api/v1${path}`, opts);
  const type = response.headers.get('content-type') || '';
  if (!response.ok) {
    let payload = null;
    if (type.includes('application/json')) payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.message || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    error.details = payload?.error?.details || null;
    if (response.status === 401 && !path.startsWith('/auth/')) {
      state.user = null;
      renderLogin('Your session expired. Please sign in again.');
    }
    throw error;
  }
  if (response.status === 204) return null;
  if (type.includes('text/csv')) return response.text();
  return response.json();
}

async function downloadReport(path, fallbackName) {
  try {
    const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || 'The report could not be generated.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = match ? match[1] : fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    toast('Report exported. The export was recorded in the audit trail.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function toast(message, tone = 'success') {
  const host = $('toasts');
  const node = document.createElement('div');
  node.className = `toast ${tone}`;
  node.innerHTML = `<span class="toast-mark"></span><span>${esc(message)}</span>`;
  host.appendChild(node);
  setTimeout(() => node.remove(), 4600);
}

function pageHead(title, subtitle, actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${subtitle}</p></div><div class="page-actions">${actions}</div></div>`;
}

function envBanner() {
  return `<div class="env-banner">${ICONS.shield}<div><strong>Prototype environment.</strong> All records are synthetic. Identity checks are simulated by MOCK-AVIP; no live APAAR, ABC, DigiLocker or AICTE production data is used.</div></div>`;
}

function emptyState(titleText, text, icon = 'file') {
  return `<div class="empty-state"><div class="glyph">${ICONS[icon] || ICONS.file}</div><strong>${esc(titleText)}</strong><p>${esc(text)}</p></div>`;
}

function kpi(label, value, detail = '', tone = '') {
  return `<div class="card kpi ${tone}"><span class="accent"></span><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span><span class="detail">${detail}</span></div>`;
}

function loadingSkeleton() {
  return `<div class="stack"><div class="skeleton skeleton-card"></div><div class="grid grid-3">${'<div class="skeleton skeleton-card"></div>'.repeat(3)}</div><div class="card"><div class="card-body"><div class="skeleton skeleton-line" style="width:45%"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line" style="width:80%"></div></div></div></div>`;
}

function pagination(data, onPage, label = 'records') {
  if (!data || !data.total) return '';
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return `<div class="pagination"><span>Page ${data.page} of ${totalPages} · ${fmtNumber(data.total)} ${label}</span><div class="btns">
    <button class="btn btn-sm" data-page-action="prev" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
    <button class="btn btn-sm" data-page-action="next" ${data.page >= totalPages ? 'disabled' : ''}>Next</button>
  </div></div>`;
}

function bindPagination(root, data, onPage) {
  const prev = root.querySelector('[data-page-action="prev"]');
  const next = root.querySelector('[data-page-action="next"]');
  if (prev) prev.addEventListener('click', () => onPage(data.page - 1));
  if (next) next.addEventListener('click', () => onPage(data.page + 1));
}

function openModal({ title, subtitle = '', body, footer = '', wide = false }) {
  const root = $('modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><div class="grow"><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><button class="modal-close" data-modal-close aria-label="Close">${ICONS.close}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </div></div>`;
  document.body.classList.add('modal-open');
  root.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  root.querySelector('[data-modal-backdrop]').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
  const focusable = root.querySelector('input, select, textarea, button');
  if (focusable) focusable.focus();
  return root;
}

function closeModal() {
  $('modal-root').innerHTML = '';
  document.body.classList.remove('modal-open');
}

function setContent(html) {
  const content = $('content');
  if (content) content.innerHTML = html;
}

function formError(message) {
  return `<div class="form-error" role="alert">${esc(message)}</div>`;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.readAsText(file);
  });
}

function renderLogin(message = '') {
  state.user = null;
  state.meta = null;
  closeModal();
  $('app').innerHTML = `<div class="login-shell">
    <section class="login-brand">
      <div class="brand-lockup"><div class="brand-mark">A</div><div><div class="brand-name">AVIP</div><div class="brand-sub">APAAR Verify Intelligence Platform</div></div></div>
      <div class="login-hero">
        <h1>Trusted enrolment intelligence for <span>every institution.</span></h1>
        <p>Validate APAAR-linked admissions, surface cross-institution conflicts and protect approved intake — with an auditable control trail from upload to commit.</p>
        <ul class="login-points">
          <li><span class="dot"></span><span>Deterministic validation with rule and approval versioning</span></li>
          <li><span class="dot"></span><span>Privacy-preserving identity references and masked display</span></li>
          <li><span class="dot"></span><span>Immutable hash-chained audit evidence for every action</span></li>
        </ul>
      </div>
      <div class="login-foot"><span class="pill-dark">AICTE 26263</span><span class="pill-dark">SYNTHETIC DATA</span><span>Prototype · v1.0.0</span></div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <h2>Sign in to AVIP</h2>
        <p class="sub">Use a demo identity to explore role-based workflows.</p>
        <form class="login-form" id="login-form" novalidate>
          ${message ? `<div class="login-error" role="alert">${esc(message)}</div>` : ''}
          <div id="login-error"></div>
          <div class="field"><label for="login-email">Email address</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="name@institution.demo" required></div>
          <div class="field"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Demo@1234" required></div>
          <div class="field"><label for="login-mfa">MFA code <span class="muted small">(privileged accounts)</span></label><input id="login-mfa" name="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="246810"><div class="login-hint">AICTE administrators require the demo MFA code <strong>246810</strong>.</div></div>
          <button class="btn btn-primary btn-block" type="submit" id="login-submit">Sign in</button>
        </form>
        <div class="demo-box">
          <h3>Demo accounts</h3>
          <div class="demo-grid">${DEMO_ACCOUNTS.map((account) => `<button type="button" class="demo-account" data-demo-email="${esc(account.email)}"><strong>${esc(account.label)}</strong>${esc(account.role)}</button>`).join('')}</div>
          <p class="demo-note">All demo accounts use <code>Demo@1234</code>. Data resets whenever the local database is removed.</p>
        </div>
      </div>
    </section>
  </div>`;

  document.querySelectorAll('[data-demo-email]').forEach((button) => {
    button.addEventListener('click', () => {
      $('login-email').value = button.dataset.demoEmail;
      $('login-password').value = 'Demo@1234';
      $('login-mfa').value = button.dataset.demoEmail === 'admin@aicte.demo' ? '246810' : '';
      $('login-submit').focus();
    });
  });

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = $('login-submit');
    const errorBox = $('login-error');
    errorBox.innerHTML = '';
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    try {
      await api('/auth/login', {
        method: 'POST',
        body: {
          email: $('login-email').value.trim(),
          password: $('login-password').value,
          mfaCode: $('login-mfa').value.trim()
        }
      });
      await bootSession();
    } catch (error) {
      errorBox.innerHTML = formError(error.message);
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  });
}

async function bootSession() {
  const me = await api('/auth/me');
  state.user = me.user;
  const meta = await api('/meta');
  state.meta = meta;
  state.user = meta.user || state.user;
  if (!state.analyticsYear) state.analyticsYear = meta.current_year || '2026-27';
  renderShell();
  await applyRoute();
}

function currentPage() {
  const raw = String(location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
  return PAGE_META[raw] ? raw : 'dashboard';
}

function navigate(page) {
  if (!pageAllowed(page)) {
    toast('Your role does not have access to that area.', 'error');
    page = 'dashboard';
  }
  closeModal();
  const target = `#/${page}`;
  if (location.hash === target) applyRoute();
  else location.hash = target;
}

function renderShell() {
  const user = state.user;
  $('app').innerHTML = `<div class="shell">
    <div class="sidebar-backdrop" data-sidebar-close hidden></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand"><div class="brand-mark">A</div><div><div class="brand-name">AVIP</div><div class="brand-sub">Verify Intelligence</div></div></div>
      <div class="env-strip"><span class="pulse"></span><span>Prototype · synthetic data</span></div>
      <nav class="sidebar-nav" aria-label="Primary">
        ${NAV_GROUPS.map((group) => {
          const pages = group.pages.filter((page) => pageAllowed(page));
          if (!pages.length) return '';
          return `<div class="nav-group"><div class="nav-group-title">${esc(group.label)}</div>${pages.map((page) => `<a class="nav-item" href="#/${page}" data-nav-page="${page}">${ICONS[PAGE_META[page].icon]}<span>${esc(PAGE_META[page].title)}</span></a>`).join('')}</div>`;
        }).join('')}
      </nav>
      <div class="sidebar-user">
        <div class="avatar">${esc(initials(user.display_name))}</div>
        <div class="who"><strong>${esc(user.display_name)}</strong><span>${esc(user.institution_name || roleLabel(user.role))}</span></div>
        <button class="icon-btn" id="logout-button" aria-label="Sign out" title="Sign out">${ICONS.logout}</button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Open navigation">${ICONS.menu}</button>
        <div class="topbar-title"><strong id="topbar-title">Dashboard</strong><span id="topbar-subtitle">${esc(roleLabel(user.role))}</span></div>
        <div class="topbar-meta"><span class="pill pill-demo">SYNTHETIC DATA</span><span class="badge badge-teal hide-sm">${esc(roleLabel(user.role))}</span></div>
      </header>
      <div class="content" id="content" role="main"></div>
    </div>
  </div>`;

  $('logout-button').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* session may already be gone */ }
    location.hash = '';
    renderLogin();
  });
  $('menu-toggle').addEventListener('click', () => {
    const sidebar = $('sidebar');
    const open = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', open);
    const backdrop = document.querySelector('[data-sidebar-close]');
    if (backdrop) backdrop.hidden = !open;
  });
  const backdrop = document.querySelector('[data-sidebar-close]');
  if (backdrop) backdrop.addEventListener('click', () => {
    $('sidebar').classList.remove('open');
    backdrop.hidden = true;
  });
  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    link.addEventListener('click', () => {
      $('sidebar').classList.remove('open');
      const close = document.querySelector('[data-sidebar-close]');
      if (close) close.hidden = true;
    });
  });
}

async function applyRoute() {
  if (!state.user) return;
  closeModal();
  const page = currentPage();
  if (!pageAllowed(page)) { navigate('dashboard'); return; }
  state.page = page;
  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    link.classList.toggle('active', link.dataset.navPage === page);
    if (link.dataset.navPage === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = $('topbar-title');
  const subtitle = $('topbar-subtitle');
  if (title) title.textContent = PAGE_META[page].title;
  if (subtitle) subtitle.textContent = `${PAGE_META[page].group} · ${roleLabel(state.user.role)}`;
  setContent(loadingSkeleton());
  try {
    await renderPage(page);
  } catch (error) {
    if (error.status === 401) return;
    setContent(`<div class="card"><div class="card-body">${emptyState('Unable to load this page', error.message, 'alert')}</div></div>`);
    toast(error.message, 'error');
  }
}

async function renderPage(page) {
  switch (page) {
    case 'dashboard': return renderDashboard();
    case 'institutions': return renderInstitutions();
    case 'programmes': return renderProgrammes();
    case 'students': return renderStudents();
    case 'imports': return renderImports();
    case 'identity': return renderIdentity();
    case 'conflicts': return renderConflicts();
    case 'analytics': return renderAnalytics();
    case 'audit': return renderAudit();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

async function renderDashboard() {
  const data = await api('/dashboard');
  const counts = data.counts || {};
  const identity = data.identity_summary || {};
  const verified = identity.VERIFIED || 0;
  const totalIdentity = Object.values(identity).reduce((sum, value) => sum + Number(value || 0), 0);
  const verifiedPercent = totalIdentity ? Math.round((verified / totalIdentity) * 100) : 0;
  const alerts = data.intake_alerts || [];
  const batches = data.recent_batches || [];
  const conflicts = data.recent_conflicts || [];
  const audit = data.recent_audit || [];

  const html = `${pageHead('Operational dashboard', 'A single view of enrolment quality, identity assurance and intake risk across your scope.', can('import:submit') ? `<button class="btn btn-primary" id="quick-upload">${ICONS.upload}Upload data</button>` : '')}
  ${envBanner()}
  <div class="grid grid-kpi" style="margin-top:16px">
    ${kpi('Institutions', fmtNumber(counts.institutions), 'In scope')}
    ${kpi('Programmes', fmtNumber(counts.programmes), 'Active catalogue')}
    ${kpi('Students', fmtNumber(counts.students), 'Distinct learners', 'info')}
    ${kpi('Active enrolments', fmtNumber(counts.active_enrolments), 'Current records')}
    ${kpi('Open conflicts', fmtNumber(counts.conflicts_open), counts.conflicts_open ? 'Requires review' : 'No open cases', counts.conflicts_open ? 'bad' : '')}
    ${kpi('Ready for review', fmtNumber(counts.ready_for_review), `${fmtNumber(counts.needs_correction)} need correction`, counts.needs_correction ? 'warn' : '')}
  </div>

  <div class="grid grid-side" style="margin-top:16px">
    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h2>Recent import batches</h2><div class="sub">Upload → validate → review → commit</div></div><button class="btn btn-sm" data-go="imports">View all</button></div>
        <div class="table-wrap">${batches.length ? `<table><thead><tr><th>Batch</th><th>Programme</th><th>Academic year</th><th>Status</th><th>Rows</th><th></th></tr></thead><tbody>
          ${batches.map((batch) => `<tr>
            <td><div class="cell-title">${esc(batch.original_name)}</div><div class="cell-sub">${esc(batch.institution_name)}</div></td>
            <td><div class="cell-title">${esc(batch.programme_code)}</div><div class="cell-sub">${esc(batch.programme_name)}</div></td>
            <td class="nowrap">${esc(batch.academic_year)}</td>
            <td>${badge(batch.status)}</td>
            <td class="nowrap">${fmtNumber(batch.counts?.total || batch.counts?.committed || 0)}</td>
            <td><button class="btn btn-sm" data-open-batch="${esc(batch.id)}">Open</button></td>
          </tr>`).join('')}</tbody></table>` : emptyState('No import batches yet', 'Upload a CSV template to begin the controlled import workflow.', 'imports')}</div>
      </div>

      <div class="card">
        <div class="card-head"><div><h2>Intake utilisation alerts</h2><div class="sub">Approved intake versus regular active enrolments</div></div><button class="btn btn-sm" data-go="analytics">Analytics</button></div>
        <div class="table-wrap">${alerts.length ? `<table><thead><tr><th>Institution</th><th>Programme</th><th>Approved</th><th>Counted</th><th>Utilisation</th></tr></thead><tbody>
          ${alerts.slice(0, 8).map((row) => `<tr>
            <td><div class="cell-title">${esc(row.institution_name)}</div><div class="cell-sub">${esc(row.institution_code)}</div></td>
            <td><div class="cell-title">${esc(row.programme_code)}</div><div class="cell-sub">${esc(row.programme_name)}</div></td>
            <td>${row.approved_intake === null ? 'Not published' : fmtNumber(row.approved_intake)}</td>
            <td>${fmtNumber(row.counted_regular)}</td>
            <td>${utilizationCell(row)}</td>
          </tr>`).join('')}</tbody></table>` : emptyState('No intake alarms', 'All programmes are within their approved intake and category caps.', 'check')}</div>
      </div>
    </div>

    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h2>Identity assurance</h2><div class="sub">Student-level verification state</div></div></div>
        <div class="card-body">
          <div class="spread"><div><div class="value" style="font-size:32px;font-weight:700;letter-spacing:-.04em">${verifiedPercent}%</div><div class="muted small">verified students</div></div><div style="width:110px">${progressBar(verifiedPercent, verifiedPercent === 100 ? '' : 'warn')}</div></div>
          <div class="divider"></div>
          <div class="stack" style="gap:8px">${['VERIFIED', 'PENDING', 'MISMATCH', 'INVALID', 'UNVERIFIED', 'UNAVAILABLE', 'ERROR'].map((status) => `<div class="spread small"><span>${badge(status)}</span><strong>${fmtNumber(identity[status] || 0)}</strong></div>`).join('')}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h2>Conflict queue</h2><div class="sub">Cross-institution duplicates</div></div><button class="btn btn-sm" data-go="conflicts">View</button></div>
        <div class="list">${conflicts.length ? conflicts.map((item) => `<div class="list-item"><span class="marker ${item.status === 'OPEN' ? 'bad' : 'warn'}"></span><div class="body"><strong>${esc(item.case_code)}</strong><p>${esc(item.institutions || 'Institutions pending')}</p></div><span class="meta">${badge(item.status)}</span></div>`).join('') : emptyState('Queue is clear', 'No conflict cases have been recorded.', 'check')}</div>
      </div>

      <div class="card">
        <div class="card-head"><div><h2>Latest audit events</h2><div class="sub">Hash-chained activity</div></div><button class="btn btn-sm" data-go="audit">Audit trail</button></div>
        <div class="list">${audit.length ? audit.slice(0, 6).map((event) => `<div class="list-item"><span class="marker"></span><div class="body"><strong>${esc(titleCase(event.action))}</strong><p>${esc(event.actor_label || 'System')} · ${esc(event.entity_type)}</p></div><span class="meta">${esc(fmtDateTime(event.occurred_at))}</span></div>`).join('') : '<div class="table-empty">No audit events.</div>'}</div>
      </div>
    </div>
  </div>`;

  setContent(html);
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
  document.querySelectorAll('[data-open-batch]').forEach((button) => button.addEventListener('click', () => openImportDetail(button.dataset.openBatch)));
  const upload = $('quick-upload');
  if (upload) upload.addEventListener('click', openUploadModal);
}

function progressBar(percent, tone = '') {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="progress ${tone}"><span style="width:${value}%"></span></div>`;
}

function utilizationCell(row) {
  if (row.approved_intake === null || row.approved_intake === undefined) {
    return '<span class="badge badge-gray">No approval</span>';
  }
  const value = Number(row.utilization) || 0;
  const tone = value > 100 ? 'bad' : value > 90 ? 'warn' : '';
  return `<div class="util">${progressBar(Math.min(100, value), tone)}<span class="num">${fmtPercent(value)}</span></div>`;
}

async function renderInstitutions() {
  const data = await api('/institutions');
  const items = data.items || [];
  const html = `${pageHead('Institutions', 'Approved institutions and their operational footprint in AVIP.', can('institution:manage') ? `<button class="btn btn-primary" id="add-institution">${ICONS.plus}Add institution</button>` : '')}
  <div class="card">
    <div class="card-head"><div><h2>Institution directory</h2><div class="sub">${fmtNumber(items.length)} institution${items.length === 1 ? '' : 's'} in your scope</div></div></div>
    <div class="table-wrap">${items.length ? `<table><thead><tr><th>Institution</th><th>Code</th><th>State</th><th>Approval</th><th>Programmes</th><th>Users</th><th>Active enrolments</th><th></th></tr></thead><tbody>
      ${items.map((item) => `<tr>
        <td><div class="cell-title">${esc(item.legal_name)}</div><div class="cell-sub">${esc(item.approval_reference || 'No reference recorded')}</div></td>
        <td class="mono">${esc(item.institution_code || '—')}</td>
        <td>${esc(item.state_code || '—')}</td>
        <td>${badge(item.approval_status)}</td>
        <td>${fmtNumber(item.programmes_count)}</td>
        <td>${fmtNumber(item.users_count)}</td>
        <td>${fmtNumber(item.active_enrolments)}</td>
        <td class="nowrap">${can('institution:manage') ? `<button class="btn btn-sm" data-edit-institution="${esc(item.id)}">Update</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>` : emptyState('No institutions found', 'Add the first approved institution to begin.', 'institutions')}</div>
  </div>`;

  setContent(html);
  const add = $('add-institution');
  if (add) add.addEventListener('click', () => openInstitutionModal());
  document.querySelectorAll('[data-edit-institution]').forEach((button) => {
    const institution = items.find((item) => item.id === button.dataset.editInstitution);
    if (institution) button.addEventListener('click', () => openInstitutionModal(institution));
  });
}

function openInstitutionModal(institution = null) {
  const editing = Boolean(institution);
  const body = `<form id="institution-form" class="stack">
    <div id="institution-form-error"></div>
    ${editing ? `<div class="form-note"><strong>${esc(institution.legal_name)}</strong><br>Version ${esc(institution.version)} · Updating the approval state is audited and version-checked.</div>` : ''}
    <div class="form-grid">
      ${editing ? '' : `<div class="field"><label for="institution-code">Institution code</label><input id="institution-code" name="institution_code" maxlength="30" placeholder="SIT-004" required></div>
      <div class="field"><label for="institution-state">State code</label><input id="institution-state" name="state_code" maxlength="3" placeholder="KA" required></div>`}
      ${editing ? '' : `<div class="field span-2"><label for="institution-name">Legal name</label><input id="institution-name" name="legal_name" minlength="3" maxlength="200" placeholder="Full institution legal name" required></div>`}
      <div class="field"><label for="institution-status">Approval status</label><select id="institution-status" name="approval_status">${['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED'].map((status) => `<option value="${status}" ${((institution && institution.approval_status) || 'PENDING') === status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select></div>
      <div class="field"><label for="institution-reference">Approval reference</label><input id="institution-reference" name="approval_reference" maxlength="120" value="${esc(institution?.approval_reference || '')}" placeholder="AICTE/APPR/2026/…"></div>
      ${editing ? `<div class="field span-2"><label for="institution-reason">Reason code</label><input id="institution-reason" name="reason_code" minlength="3" maxlength="80" placeholder="e.g. APPROVAL_RENEWED" required><span class="hint">Recorded in the append-only audit trail.</span></div>` : ''}
    </div>
  </form>`;
  const footer = `<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" form="institution-form" type="submit" id="institution-submit">${editing ? 'Save changes' : 'Create institution'}</button>`;
  const root = openModal({
    title: editing ? 'Update institution approval' : 'Add institution',
    subtitle: editing ? 'Version-checked approval state change' : 'Create an institution in the controlled directory',
    body, footer
  });
  $('institution-submit').addEventListener('click', () => $('institution-form').requestSubmit());
  $('institution-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errorBox = $('institution-form-error');
    errorBox.innerHTML = '';
    try {
      if (editing) {
        await api(`/institutions/${institution.id}`, {
          method: 'PATCH',
          body: {
            approval_status: form.get('approval_status'),
            approval_reference: form.get('approval_reference') || null,
            reason_code: form.get('reason_code'),
            version: institution.version
          }
        });
        toast('Institution approval updated.', 'success');
      } else {
        await api('/institutions', {
          method: 'POST',
          body: {
            institution_code: form.get('institution_code'),
            legal_name: form.get('legal_name'),
            state_code: String(form.get('state_code') || '').toUpperCase(),
            approval_status: form.get('approval_status'),
            approval_reference: form.get('approval_reference') || null
          }
        });
        toast('Institution created.', 'success');
      }
      closeModal();
      applyRoute();
    } catch (error) {
      errorBox.innerHTML = formError(error.message);
    }
  });
}

async function renderProgrammes() {
  const [programmesData, institutionsData, intakeData] = await Promise.all([
    api('/programmes'),
    api('/institutions'),
    api(`/intake?academic_year=${encodeURIComponent(state.meta?.current_year || '2026-27')}`)
  ]);
  const programmes = programmesData.items || [];
  const institutions = institutionsData.items || [];
  const approvals = intakeData.items || [];
  const approvalByProgramme = new Map();
  for (const approval of approvals) {
    if (!approvalByProgramme.has(approval.programme_id)) approvalByProgramme.set(approval.programme_id, approval);
  }
  const year = state.meta?.current_year || '2026-27';
  const actions = `${can('intake:manage') ? `<button class="btn" id="publish-intake">${ICONS.plus}Publish intake</button>` : ''}${can('programme:manage') ? `<button class="btn btn-primary" id="add-programme">${ICONS.plus}Add programme</button>` : ''}`;
  const html = `${pageHead('Programmes & intake', `Approved intake controls for academic year ${year}. Category caps and rule versions are enforced at validation.`, actions)}
  <div class="card">
    <div class="card-head"><div><h2>Programme catalogue</h2><div class="sub">${fmtNumber(programmes.length)} programmes · ${fmtNumber(approvals.length)} active approvals for ${esc(year)}</div></div></div>
    <div class="table-wrap">${programmes.length ? `<table><thead><tr><th>Programme</th><th>Institution</th><th>Level</th><th>Approved intake</th><th>Rule version</th><th>Active enrolments</th><th>Approval reference</th></tr></thead><tbody>
      ${programmes.map((programme) => {
        const approval = approvalByProgramme.get(programme.id);
        return `<tr>
          <td><div class="cell-title">${esc(programme.programme_name)}</div><div class="cell-sub mono">${esc(programme.programme_code)}</div></td>
          <td>${esc(programme.institution_name)}</td>
          <td><span class="badge badge-blue">${esc(programme.programme_level || 'UG')}</span></td>
          <td>${approval ? fmtNumber(approval.approved_intake) : '<span class="badge badge-amber">Not published</span>'}</td>
          <td>${approval ? `<span class="mono">v${esc(approval.rule_version)}</span>` : '—'}</td>
          <td>${fmtNumber(programme.active_enrolments)}</td>
          <td class="small">${esc(approval?.approval_reference || '—')}</td>
        </tr>`;
      }).join('')}</tbody></table>` : emptyState('No programmes', 'Create a programme before publishing an intake approval.', 'programmes')}</div>
  </div>`;

  setContent(html);
  const add = $('add-programme');
  if (add) add.addEventListener('click', () => openProgrammeModal(institutions));
  const publish = $('publish-intake');
  if (publish) publish.addEventListener('click', () => openIntakeModal(programmes));
}

function openProgrammeModal(institutions) {
  const isAdmin = Boolean(state.user && !state.user.institution_id);
  const body = `<form id="programme-form" class="stack">
    <div id="programme-form-error"></div>
    <div class="form-grid">
      ${isAdmin ? `<div class="field span-2"><label for="programme-institution">Institution</label><select id="programme-institution" name="institution_id" required><option value="">Select institution</option>${institutions.map((item) => `<option value="${esc(item.id)}">${esc(item.legal_name)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="programme-code">Programme code</label><input id="programme-code" name="programme_code" maxlength="30" placeholder="CSE-UG" required></div>
      <div class="field"><label for="programme-level">Level</label><select id="programme-level" name="programme_level"><option value="UG">Undergraduate</option><option value="PG">Postgraduate</option><option value="DIPLOMA">Diploma</option><option value="OTHER">Other</option></select></div>
      <div class="field span-2"><label for="programme-name">Programme name</label><input id="programme-name" name="programme_name" maxlength="200" placeholder="B.Tech Computer Science and Engineering" required></div>
    </div>
  </form>`;
  const root = openModal({
    title: 'Add programme',
    subtitle: 'Programmes must have an active intake approval before imports can be committed',
    body,
    footer: `<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" type="submit" form="programme-form" id="programme-submit">Create programme</button>`
  });
  $('programme-submit').addEventListener('click', () => $('programme-form').requestSubmit());
  $('programme-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errorBox = $('programme-form-error');
    errorBox.innerHTML = '';
    try {
      await api('/programmes', {
        method: 'POST',
        body: {
          institution_id: form.get('institution_id') || null,
          programme_code: form.get('programme_code'),
          programme_name: form.get('programme_name'),
          programme_level: form.get('programme_level')
        }
      });
      toast('Programme created.', 'success');
      closeModal();
      applyRoute();
    } catch (error) {
      errorBox.innerHTML = formError(error.message);
    }
  });
}

function openIntakeModal(programmes) {
  const years = state.meta?.academic_years || ['2026-27'];
  const categories = state.meta?.categories || ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'];
  const body = `<form id="intake-form" class="stack">
    <div id="intake-form-error"></div>
    <div class="form-grid">
      <div class="field span-2"><label for="intake-programme">Programme</label><select id="intake-programme" name="programme_id" required><option value="">Select programme</option>${programmes.map((item) => `<option value="${esc(item.id)}">${esc(item.institution_name)} — ${esc(item.programme_code)} ${esc(item.programme_name)}</option>`).join('')}</select></div>
      <div class="field"><label for="intake-year">Academic year</label><select id="intake-year" name="academic_year">${years.map((year) => `<option value="${esc(year)}" ${year === (state.meta?.current_year || '2026-27') ? 'selected' : ''}>${esc(year)}</option>`).join('')}</select></div>
      <div class="field"><label for="intake-approved">Approved intake</label><input id="intake-approved" name="approved_intake" type="number" min="0" step="1" placeholder="120" required></div>
      <div class="field span-2"><label for="intake-reference">Approval reference</label><input id="intake-reference" name="approval_reference" maxlength="120" placeholder="AICTE/INTAKE/2026/…" required></div>
      <div class="field"><label for="intake-from">Effective from</label><input id="intake-from" name="effective_from" type="date"></div>
      <div class="field"><label for="intake-to">Effective to</label><input id="intake-to" name="effective_to" type="date"></div>
    </div>
    <div class="divider"></div>
    <div><div class="section-title">Category caps <span class="muted small">(optional)</span></div><p class="muted small" style="margin-top:3px">Counted against regular active enrolments. Leave blank for no cap.</p></div>
    <div class="form-grid">${categories.map((category) => `<div class="field"><label for="cap-${category}">${esc(category)}</label><input id="cap-${category}" data-category-cap="${esc(category)}" type="number" min="0" step="1" placeholder="No cap"></div>`).join('')}</div>
    <div class="form-note">Publishing a new approval supersedes the previous active approval for the same programme and year. This action is audited and emits an integration event.</div>
  </form>`;
  openModal({
    title: 'Publish intake approval',
    subtitle: 'AICTE-controlled capacity and rule versioning',
    body,
    wide: true,
    footer: `<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" type="submit" form="intake-form" id="intake-submit">Publish approval</button>`
  });
  $('intake-submit').addEventListener('click', () => $('intake-form').requestSubmit());
  $('intake-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const categoryRules = {};
    document.querySelectorAll('[data-category-cap]').forEach((input) => {
      if (input.value !== '') categoryRules[input.dataset.categoryCap] = Number(input.value);
    });
    const errorBox = $('intake-form-error');
    errorBox.innerHTML = '';
    try {
      await api('/intake', {
        method: 'POST',
        body: {
          programme_id: form.get('programme_id'),
          academic_year: form.get('academic_year'),
          approved_intake: Number(form.get('approved_intake')),
          approval_reference: form.get('approval_reference'),
          effective_from: form.get('effective_from') || null,
          effective_to: form.get('effective_to') || null,
          category_rules: categoryRules,
          supernumerary_rules: {}
        }
      });
      toast('Intake approval published.', 'success');
      closeModal();
      applyRoute();
    } catch (error) {
      errorBox.innerHTML = formError(error.message);
    }
  });
}

async function renderStudents() {
  const query = new URLSearchParams({ page: String(state.studentPage || 1), pageSize: '25' });
  if (state.studentSearch) query.set('search', state.studentSearch);
  const data = await api(`/students?${query.toString()}`);
  const items = data.items || [];
  const html = `${pageHead('Students', 'Search privacy-preserving student records and review enrolment history. Raw APAAR identifiers are never returned.', '')}
  <div class="card">
    <form class="toolbar" id="student-search-form">
      <div class="field big-search"><label for="student-search">Search</label><input id="student-search" name="search" value="${esc(state.studentSearch)}" placeholder="Name, roll number, year or 12-digit APAAR"></div>
      <button class="btn btn-primary" type="submit">${ICONS.search}Search</button>
      ${state.studentSearch ? '<button class="btn btn-ghost" type="button" id="clear-student-search">Clear</button>' : ''}
      <span class="spacer"></span>
      <span class="muted small">${fmtNumber(data.total)} matching student${data.total === 1 ? '' : 's'}</span>
    </form>
    <div class="table-wrap">${items.length ? `<table><thead><tr><th>Student</th><th>APAAR reference</th><th>Date of birth</th><th>Identity</th><th>Enrolments</th><th></th></tr></thead><tbody>
      ${items.map((student) => `<tr>
        <td><div class="cell-title">${esc(student.full_name)}</div><div class="cell-sub mono">${esc(student.id.slice(0, 8))}</div></td>
        <td><span class="masked">${esc(student.apaar_masked)}</span></td>
        <td>${fmtDate(student.date_of_birth)}</td>
        <td>${badge(student.identity_status)}</td>
        <td>${fmtNumber(student.enrolment_count)}</td>
        <td><button class="btn btn-sm" data-student="${esc(student.id)}">View</button></td>
      </tr>`).join('')}</tbody></table>` : emptyState('No students found', state.studentSearch ? 'Try a different name, roll number or APAAR reference.' : 'Committed import batches will populate students here.', 'students')}</div>
    ${pagination(data, () => {}, 'students')}
  </div>`;

  setContent(html);
  $('student-search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.studentSearch = $('student-search').value.trim();
    state.studentPage = 1;
    renderStudents().catch((error) => toast(error.message, 'error'));
  });
  const clear = $('clear-student-search');
  if (clear) clear.addEventListener('click', () => { state.studentSearch = ''; state.studentPage = 1; renderStudents().catch((error) => toast(error.message, 'error')); });
  const pager = document.querySelector('.pagination');
  if (pager && data.total > data.pageSize) {
    bindPagination(document, data, (page) => { state.studentPage = page; renderStudents().catch((error) => toast(error.message, 'error')); });
  }
  document.querySelectorAll('[data-student]').forEach((button) => button.addEventListener('click', () => openStudentDetail(button.dataset.student)));
}

async function openStudentDetail(studentId) {
  const data = await api(`/students/${studentId}`);
  const student = data.student;
  const enrolments = data.enrolments || [];
  const checks = data.identity_checks || [];
  const body = `<div class="stack">
    <div class="kv">
      <div><div class="k">Full name</div><div class="v">${esc(student.full_name)}</div></div>
      <div><div class="k">APAAR reference</div><div class="v masked">${esc(student.apaar_masked)}</div></div>
      <div><div class="k">Date of birth</div><div class="v">${fmtDate(student.date_of_birth)}</div></div>
      <div><div class="k">Identity status</div><div class="v">${badge(student.identity_status)}</div></div>
    </div>
    <div>
      <div class="section-title">Enrolments</div>
      <div class="table-wrap">${enrolments.length ? `<table><thead><tr><th>Institution / programme</th><th>Year</th><th>Roll no.</th><th>Status</th><th>Identity</th><th></th></tr></thead><tbody>
        ${enrolments.map((enrolment) => `<tr>
          <td><div class="cell-title">${esc(enrolment.institution_name)}</div><div class="cell-sub">${esc(enrolment.programme_code)} · ${esc(enrolment.programme_name)}</div></td>
          <td>${esc(enrolment.academic_year)}</td>
          <td class="mono">${esc(enrolment.roll_number || '—')}</td>
          <td>${badge(enrolment.enrolment_status)}</td>
          <td>${badge(enrolment.identity_status)}</td>
          <td class="nowrap">
            ${can('identity:verify') && ['PENDING', 'UNVERIFIED', 'UNAVAILABLE', 'ERROR', 'MISMATCH', 'INVALID'].includes(enrolment.identity_status) ? `<button class="btn btn-sm" data-verify-enrolment="${esc(enrolment.id)}">Verify</button>` : ''}
            ${can('enrolment:correct') ? `<button class="btn btn-sm" data-correct-enrolment="${esc(enrolment.id)}">Status</button>` : ''}
          </td>
        </tr>`).join('')}</tbody></table>` : emptyState('No enrolments', 'This student has no enrolment records.', 'students')}</div>
    </div>
    <div>
      <div class="section-title">Identity check history</div>
      <div class="timeline">${checks.length ? checks.map((check) => `<div class="timeline-item"><span class="dot"></span><div class="t-body"><strong>${badge(check.status)} ${esc(check.provider_code)}</strong><p>${esc(check.programme_code || 'Programme n/a')} · ${esc(check.roll_number || 'No roll')} · ${esc(check.reason_code || 'No exception reason')}</p></div><span class="t-time">${esc(fmtDateTime(check.checked_at))}</span></div>`).join('') : '<p class="muted small">No identity checks recorded.</p>'}</div>
    </div>
  </div>`;
  openModal({
    title: student.full_name,
    subtitle: 'Student record and controlled enrolment history',
    body,
    wide: true,
    footer: `<button class="btn" data-modal-close>Close</button>`
  });
  document.querySelectorAll('[data-correct-enrolment]').forEach((button) => {
    const enrolment = enrolments.find((item) => item.id === button.dataset.correctEnrolment);
    if (enrolment) button.addEventListener('click', () => openEnrolmentStatusModal(enrolment, studentId));
  });
  document.querySelectorAll('[data-verify-enrolment]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Checking…';
      try {
        const result = await api(`/identity-checks/${button.dataset.verifyEnrolment}/verify`, { method: 'POST', body: {} });
        toast(`Identity check complete: ${titleCase(result.student_identity_status)}.`, result.student_identity_status === 'VERIFIED' ? 'success' : 'error');
        closeModal();
        await applyRoute();
        await openStudentDetail(studentId);
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
        button.textContent = 'Verify';
      }
    });
  });
}

function openEnrolmentStatusModal(enrolment, studentId) {
  const statuses = state.meta?.enrolment_statuses || ['ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED', 'CANCELLED'];
  const body = `<form id="enrolment-form" class="stack">
    <div id="enrolment-form-error"></div>
    <div class="form-note"><strong>${esc(enrolment.programme_code)}</strong> · ${esc(enrolment.roll_number || 'No roll number')} · ${esc(enrolment.academic_year)}<br>Current status: ${badge(enrolment.enrolment_status)} · Version ${esc(enrolment.version)}</div>
    <div class="form-grid">
      <div class="field"><label for="enrolment-status">New status</label><select id="enrolment-status" name="enrolment_status">${statuses.map((status) => `<option value="${esc(status)}" ${status === enrolment.enrolment_status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select></div>
      <div class="field"><label for="enrolment-reason">Reason code</label><input id="enrolment-reason" name="reason_code" minlength="3" maxlength="80" placeholder="e.g. TRANSFER_APPROVED" required></div>
      <div class="field span-2"><label for="enrolment-notes">Notes</label><textarea id="enrolment-notes" name="notes" rows="3" maxlength="500" placeholder="Optional operational context"></textarea></div>
    </div>
  </form>`;
  openModal({
    title: 'Correct enrolment status',
    subtitle: 'Sensitive correction with optimistic concurrency and audit evidence',
    body,
    footer: `<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" type="submit" form="enrolment-form" id="enrolment-submit">Save correction</button>`
  });
  $('enrolment-submit').addEventListener('click', () => $('enrolment-form').requestSubmit());
  $('enrolment-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errorBox = $('enrolment-form-error');
    errorBox.innerHTML = '';
    try {
      await api(`/enrolments/${enrolment.id}`, {
        method: 'PATCH',
        body: {
          enrolment_status: form.get('enrolment_status'),
          reason_code: form.get('reason_code'),
          notes: form.get('notes') || null,
          version: enrolment.version
        }
      });
      toast('Enrolment status updated.', 'success');
      closeModal();
      await applyRoute();
      await openStudentDetail(studentId);
    } catch (error) {
      errorBox.innerHTML = formError(error.message);
    }
  });
}

async function renderImports() {
  const query = new URLSearchParams({ page: String(state.importsPage || 1), pageSize: '25' });
  if (state.importsStatus) query.set('status', state.importsStatus);
  const data = await api(`/imports?${query.toString()}`);
  const items = data.items || [];
  const statuses = state.meta?.batch_statuses || [];
  const actions = `<button class="btn" id="download-template">${ICONS.download}CSV template</button>${can('import:submit') ? `<button class="btn btn-primary" id="open-upload">${ICONS.upload}Upload CSV</button>` : ''}`;

  const html = `${pageHead('Data imports', 'Controlled CSV ingestion with deterministic validation, reviewer approval and idempotent commit.', actions)}
  <div class="card">
    <div class="toolbar">
      <div class="field"><label for="import-status-filter">Status</label><select id="import-status-filter"><option value="">All statuses</option>${statuses.map((status) => `<option value="${esc(status)}" ${state.importsStatus === status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select></div>
      <span class="spacer"></span>
      <span class="muted small">${fmtNumber(data.total)} batch${data.total === 1 ? '' : 'es'} in scope</span>
    </div>
    <div class="table-wrap">${items.length ? `<table><thead><tr><th>Batch</th><th>Institution / programme</th><th>Year</th><th>Status</th><th>Validation counts</th><th>Uploaded</th><th></th></tr></thead><tbody>
      ${items.map((batch) => `<tr>
        <td><div class="cell-title">${esc(batch.original_name)}</div><div class="cell-sub mono">${esc(batch.file_sha256 ? batch.file_sha256.slice(0, 16) : batch.id.slice(0, 8))}…</div></td>
        <td><div class="cell-title">${esc(batch.institution_name)}</div><div class="cell-sub">${esc(batch.programme_code)} · ${esc(batch.programme_name)}</div></td>
        <td class="nowrap">${esc(batch.academic_year)}</td>
        <td>${badge(batch.status)}</td>
        <td><div class="chips"><span class="chip"><strong>${fmtNumber(batch.counts?.total || 0)}</strong> rows</span><span class="chip"><strong>${fmtNumber(batch.counts?.valid || 0)}</strong> valid</span><span class="chip ${batch.counts?.error ? 'over' : ''}"><strong>${fmtNumber(batch.counts?.error || 0)}</strong> errors</span></div></td>
        <td class="nowrap small">${esc(fmtDateTime(batch.created_at))}<br><span class="muted">${esc(batch.created_by_name)}</span></td>
        <td><button class="btn btn-sm" data-open-import="${esc(batch.id)}">Review</button></td>
      </tr>`).join('')}</tbody></table>` : emptyState('No import batches', can('import:submit') ? 'Upload a CSV using the current template to begin.' : 'No batches are visible for your role.', 'imports')}</div>
    ${pagination(data, () => {}, 'batches')}
  </div>`;

  setContent(html);
  $('download-template').addEventListener('click', () => downloadReport('/imports/template', 'avip-student-enrolment-template.csv'));
  const upload = $('open-upload');
  if (upload) upload.addEventListener('click', openUploadModal);
  $('import-status-filter').addEventListener('change', (event) => {
    state.importsStatus = event.target.value;
    state.importsPage = 1;
    applyRoute();
  });
  bindPagination(document, data, (page) => { state.importsPage = page; applyRoute(); });
  document.querySelectorAll('[data-open-import]').forEach((button) => button.addEventListener('click', () => openImportDetail(button.dataset.openImport)));
}

async function openUploadModal() {
  const [programmesData, institutionsData] = await Promise.all([api('/programmes'), api('/institutions')]);
  const programmes = programmesData.items || [];
  const years = state.meta?.academic_years || ['2026-27'];
  const body = `<form id="upload-form" class="stack">
    <div id="upload-form-error"></div>
    <div class="form-grid">
      <div class="field span-2"><label for="upload-programme">Programme</label><select id="upload-programme" name="programme_id" required><option value="">Select programme</option>${programmes.map((item) => `<option value="${esc(item.id)}">${esc(item.institution_name)} — ${esc(item.programme_code)} ${esc(item.programme_name)}</option>`).join('')}</select></div>
      <div class="field"><label for="upload-year">Academic year</label><select id="upload-year" name="academic_year">${years.map((year) => `<option value="${esc(year)}" ${year === (state.meta?.current_year || '2026-27') ? 'selected' : ''}>${esc(year)}</option>`).join('')}</select></div>
      <div class="field"><label>Current template</label><button type="button" class="btn" id="upload-template">${ICONS.download}Download template</button></div>
    </div>
    <div class="upload-drop" id="upload-drop">
      ${ICONS.upload}
      <strong>Choose a CSV file</strong>
      <p>Maximum 5 MB · required headers are validated before staging</p>
      <input id="upload-file" name="file" type="file" accept=".csv,text/csv" required>
    </div>
    <div class="form-note">The upload is validated synchronously and staged as a new batch. An active intake approval must exist for the selected programme and year. Imports require a unique idempotency key (generated automatically).</div>
  </form>`;
  openModal({
    title: 'Upload enrolment data',
    subtitle: 'CSV validation and staging',
    body,
    footer: `<button class="btn" data-modal-close>Cancel</button><button class="btn btn-primary" type="submit" form="upload-form" id="upload-submit">Validate & upload</button>`
  });
  $('upload-template').addEventListener('click', () => downloadReport('/imports/template', 'avip-student-enrolment-template.csv'));
  $('upload-file').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const drop = $('upload-drop');
    drop.classList.toggle('has-file', Boolean(file));
    const label = drop.querySelector('strong');
    if (label) label.textContent = file ? file.name : 'Choose a CSV file';
  });
  $('upload-submit').addEventListener('click', () => $('upload-form').requestSubmit());
  $('upload-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = $('upload-file').files?.[0];
    const errorBox = $('upload-form-error');
    const submit = $('upload-submit');
    errorBox.innerHTML = '';
    if (!file) { errorBox.innerHTML = formError('Select a CSV file to upload.'); return; }
    if (!/\.csv$/i.test(file.name)) { errorBox.innerHTML = formError('Only CSV files are supported by this prototype.'); return; }
    submit.disabled = true;
    submit.textContent = 'Validating…';
    try {
      const content = await readFileText(file);
      const key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const result = await api('/imports', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: {
          programme_id: form.get('programme_id'),
          academic_year: form.get('academic_year'),
          filename: file.name,
          content
        }
      });
      toast(result.status === 'READY_FOR_REVIEW' ? 'File validated and ready for review.' : 'File staged with corrections required.', result.status === 'READY_FOR_REVIEW' ? 'success' : 'error');
      closeModal();
      state.importsPage = 1;
      applyRoute();
      await openImportDetail(result.batch.id);
    } catch (error) {
      errorBox.innerHTML = formError(error.message);
      submit.disabled = false;
      submit.textContent = 'Validate & upload';
    }
  });
}

async function openImportDetail(batchId, afterAction = false) {
  const data = await api(`/imports/${batchId}`);
  const batch = data.batch;
  const rows = batch.rows || [];
  const issues = batch.issues || [];
  const counts = batch.counts || {};
  const actionButtons = [];
  if (can('import:approve') && batch.status === 'READY_FOR_REVIEW') actionButtons.push('<button class="btn btn-primary" id="approve-batch">Approve batch</button>');
  if (can('import:commit') && batch.status === 'APPROVED') actionButtons.push('<button class="btn btn-primary" id="commit-batch">Commit enrolments</button>');
  if (can('import:approve') && ['READY_FOR_REVIEW', 'NEEDS_CORRECTION', 'APPROVED'].includes(batch.status)) actionButtons.push('<button class="btn btn-danger" id="reject-batch">Reject</button>');

  const body = `<div class="stack">
    <div class="kv">
      <div><div class="k">Batch</div><div class="v">${esc(batch.original_name)}</div></div>
      <div><div class="k">Programme</div><div class="v">${esc(batch.programme_code)} · ${esc(batch.academic_year)}</div></div>
      <div><div class="k">Status</div><div class="v">${badge(batch.status)}</div></div>
      <div><div class="k">Ruleset</div><div class="v mono">${esc(batch.ruleset)} v${esc(batch.rule_version)}</div></div>
      <div><div class="k">Institution</div><div class="v">${esc(batch.institution_name)}</div></div>
      <div><div class="k">Uploaded by</div><div class="v">${esc(batch.created_by_name)} · ${esc(fmtDateTime(batch.created_at))}</div></div>
      <div><div class="k">File digest</div><div class="v mono tiny">${esc(batch.file_sha256 || '—')}</div></div>
      <div><div class="k">Counts</div><div class="v small">${fmtNumber(counts.total)} rows · ${fmtNumber(counts.valid)} valid · ${fmtNumber(counts.review)} review · ${fmtNumber(counts.error)} errors</div></div>
    </div>
    ${counts.error ? `<div class="note bad"><strong>${fmtNumber(counts.error)} row${counts.error === 1 ? '' : 's'} need correction.</strong> Download the template, fix the reported issues and upload a new batch.</div>` : ''}
    ${batch.status === 'READY_FOR_REVIEW' ? '<div class="note"><strong>Ready for reviewer approval.</strong> Validation completed without blocking errors. Approval is required before commit.</div>' : ''}
    ${batch.status === 'APPROVED' ? '<div class="note warn"><strong>Approved and awaiting commit.</strong> Commit creates enrolments, records identity checks and opens cross-institution conflicts atomically.</div>' : ''}
    ${batch.status === 'COMMITTED' ? '<div class="note"><strong>Committed.</strong> Enrolments are live and the batch is immutable in this workflow.</div>' : ''}
    <div>
      <div class="section-title">Validation issues</div>
      <div class="table-wrap">${issues.length ? `<table><thead><tr><th>Row</th><th>Rule</th><th>Severity</th><th>Field</th><th>Message</th></tr></thead><tbody>
        ${issues.map((issue) => `<tr><td class="mono">${issue.source_row_number ? esc(issue.source_row_number) : 'File'}</td><td class="mono">${esc(issue.rule_code)}</td><td>${badge(issue.severity)}</td><td class="mono">${esc(issue.field_name || '—')}</td><td class="small">${esc(issue.message)}</td></tr>`).join('')}</tbody></table>` : '<div class="table-empty">No validation issues recorded.</div>'}</div>
    </div>
    <div>
      <div class="section-title">Staged rows</div>
      <div class="table-wrap">${rows.length ? `<table><thead><tr><th>Row</th><th>Student</th><th>APAAR</th><th>Roll number</th><th>Seat / category</th><th>Status</th></tr></thead><tbody>
        ${rows.map((row) => `<tr><td class="mono">${esc(row.source_row_number)}</td><td><div class="cell-title">${esc(row.full_name || '—')}</div><div class="cell-sub">${esc(row.programme_code || '')}</div></td><td class="masked">${esc(row.apaar_masked)}</td><td class="mono">${esc(row.roll_number || '—')}</td><td class="small">${esc(row.seat_type || '—')} · ${esc(row.admission_category || '—')}</td><td>${badge(row.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="table-empty">No staged rows.</div>'}</div>
    </div>
  </div>`;
  openModal({
    title: 'Import batch review',
    subtitle: `${batch.programme_code} · ${batch.academic_year}`,
    body,
    wide: true,
    footer: `<button class="btn" data-modal-close>Close</button>${actionButtons.join('')}`
  });

  const approve = $('approve-batch');
  if (approve) approve.addEventListener('click', async () => {
    approve.disabled = true;
    try {
      await api(`/imports/${batch.id}/approve`, { method: 'POST', body: { reason_code: 'REVIEWER_APPROVAL' } });
      toast('Batch approved. Commit is now available to an authorised administrator.', 'success');
      closeModal();
      applyRoute();
      await openImportDetail(batch.id);
    } catch (error) { toast(error.message, 'error'); approve.disabled = false; }
  });

  const commit = $('commit-batch');
  if (commit) commit.addEventListener('click', async () => {
    commit.disabled = true;
    commit.textContent = 'Committing…';
    try {
      const result = await api(`/imports/${batch.id}/commit`, { method: 'POST', body: {} });
      toast(`Committed ${result.created} enrolment${result.created === 1 ? '' : 's'}${result.conflict_cases ? ` and opened ${result.conflict_cases} conflict case(s)` : ''}.`, 'success');
      closeModal();
      applyRoute();
      await openImportDetail(batch.id);
    } catch (error) { toast(error.message, 'error'); commit.disabled = false; commit.textContent = 'Commit enrolments'; }
  });

  const reject = $('reject-batch');
  if (reject) reject.addEventListener('click', () => openRejectBatchModal(batch));
}

function openRejectBatchModal(batch) {
  const body = `<form id="reject-batch-form" class="stack">
    <div id="reject-batch-error"></div>
    <div class="form-note">Rejecting <strong>${esc(batch.original_name)}</strong>. Staged data remains available for audit but cannot be committed.</div>
    <div class="field"><label for="reject-reason">Reason code</label><input id="reject-reason" name="reason_code" minlength="3" maxlength="80" placeholder="e.g. SOURCE_DATA_INCORRECT" required></div>
    <div class="field"><label for="reject-notes">Notes</label><textarea id="reject-notes" name="notes" rows="3" maxlength="500" placeholder="Explain what the institution must correct."></textarea></div>
  </form>`;
  openModal({
    title: 'Reject import batch',
    subtitle: 'The rejection is recorded in the audit trail',
    body,
    footer: `<button class="btn" data-modal-close>Cancel</button><button class="btn btn-danger" type="submit" form="reject-batch-form" id="reject-submit">Reject batch</button>`
  });
  $('reject-submit').addEventListener('click', () => $('reject-batch-form').requestSubmit());
  $('reject-batch-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/imports/${batch.id}/reject`, {
        method: 'POST',
        body: { reason_code: form.get('reason_code'), notes: form.get('notes') || null }
      });
      toast('Batch rejected.', 'success');
      closeModal();
      applyRoute();
      await openImportDetail(batch.id);
    } catch (error) {
      $('reject-batch-error').innerHTML = formError(error.message);
    }
  });
}

async function renderIdentity() {
  const [pendingData, checksData] = await Promise.all([
    api('/identity/pending'),
    api('/identity-checks?page=1&pageSize=50')
  ]);
  const pending = pendingData.items || [];
  const checks = checksData.items || [];
  const html = `${pageHead('Identity verification', 'Provider checks are simulated by MOCK-AVIP. The APAAR reference remains encrypted and is never returned in clear text.', '')}
  <div class="grid grid-side">
    <div class="card">
      <div class="card-head"><div><h2>Pending verification queue</h2><div class="sub">${fmtNumber(pending.length)} active enrolments awaiting a provider result</div></div></div>
      <div class="table-wrap">${pending.length ? `<table><thead><tr><th>Student</th><th>Institution / programme</th><th>APAAR</th><th>Current state</th><th></th></tr></thead><tbody>
        ${pending.map((item) => `<tr>
          <td><div class="cell-title">${esc(item.full_name)}</div><div class="cell-sub mono">${esc(item.roll_number || 'No roll')} · ${esc(item.academic_year)}</div></td>
          <td><div class="cell-title">${esc(item.institution_name)}</div><div class="cell-sub">${esc(item.programme_code)}</div></td>
          <td class="masked">${esc(item.apaar_masked)}</td>
          <td>${badge(item.identity_status)}</td>
          <td class="nowrap">${can('identity:verify') ? `<button class="btn btn-sm btn-primary" data-verify-pending="${esc(item.enrolment_id)}">Verify</button>` : ''}</td>
        </tr>`).join('')}</tbody></table>` : emptyState('Verification queue is clear', 'There are no pending identity checks in your scope.', 'check')}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h2>Provider behaviour</h2><div class="sub">Deterministic demo adapter</div></div></div>
      <div class="card-body stack">
        <div class="settings-item"><div class="s-icon">${ICONS.shield}</div><div class="s-body"><strong>MOCK-AVIP</strong><p>Last digit 0 → INVALID · 7 → PENDING · 9 → MISMATCH · otherwise VERIFIED.</p></div></div>
        <div class="note">Switching to a production identity provider requires a new adapter implementation, credential management, timeout handling and formal privacy approval.</div>
        <button class="btn" id="refresh-identity">${ICONS.pulse}Refresh queue</button>
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><div><h2>Recent provider checks</h2><div class="sub">Latest ${fmtNumber(checks.length)} results</div></div></div>
    <div class="table-wrap">${checks.length ? `<table><thead><tr><th>Student</th><th>Programme</th><th>Provider result</th><th>Reference</th><th>Reason</th><th>Checked</th></tr></thead><tbody>
      ${checks.map((check) => `<tr>
        <td><div class="cell-title">${esc(check.full_name)}</div><div class="cell-sub mono">${esc(check.roll_number || '—')}</div></td>
        <td>${esc(check.programme_code || '—')}</td>
        <td>${badge(check.status)}</td>
        <td class="mono small">${esc(check.provider_reference || '—')}</td>
        <td class="small">${esc(check.reason_code || '—')}</td>
        <td class="nowrap small">${esc(fmtDateTime(check.checked_at))}</td>
      </tr>`).join('')}</tbody></table>` : emptyState('No identity checks', 'Run a verification from the pending queue or commit an import batch.', 'identity')}</div>
  </div>`;

  setContent(html);
  $('refresh-identity').addEventListener('click', () => applyRoute());
  document.querySelectorAll('[data-verify-pending]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Checking…';
    try {
      const result = await api(`/identity-checks/${button.dataset.verifyPending}/verify`, { method: 'POST', body: {} });
      toast(`Provider result: ${titleCase(result.student_identity_status)}.`, result.student_identity_status === 'VERIFIED' ? 'success' : 'error');
      applyRoute();
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
      button.textContent = 'Verify';
    }
  }));
}

async function renderConflicts() {
  const query = new URLSearchParams({ page: String(state.conflictsPage || 1), pageSize: '25' });
  if (state.conflictsStatus) query.set('status', state.conflictsStatus);
  const data = await api(`/conflicts?${query.toString()}`);
  const items = data.items || [];
  const statuses = ['OPEN', 'ASSIGNED', 'NEEDS_INFO', 'ESCALATED', 'RESOLVED', 'FALSE_POSITIVE'];
  const html = `${pageHead('Conflict review', 'Cross-institution or period-overlap cases require human judgement. A conflict is a review signal, not a fraud finding.', '')}
  <div class="card">
    <div class="toolbar">
      <div class="field"><label for="conflict-status-filter">Case status</label><select id="conflict-status-filter"><option value="">All statuses</option>${statuses.map((status) => `<option value="${esc(status)}" ${state.conflictsStatus === status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select></div>
      <span class="spacer"></span>
      <span class="muted small">${fmtNumber(data.total)} case${data.total === 1 ? '' : 's'}</span>
    </div>
    <div class="table-wrap">${items.length ? `<table><thead><tr><th>Case</th><th>Institutions</th><th>Reason codes</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Opened</th><th></th></tr></thead><tbody>
      ${items.map((item) => `<tr>
        <td><div class="cell-title mono">${esc(item.case_code)}</div><div class="cell-sub">${esc(item.case_type)} · ${fmtNumber(item.candidate_count)} candidates</div></td>
        <td class="small">${esc(item.institutions || '—')}</td>
        <td><div class="chips">${(item.reason_codes || []).map((code) => `<span class="chip">${esc(code)}</span>`).join('')}</div></td>
        <td>${badge(item.priority)}</td>
        <td>${badge(item.status)}</td>
        <td class="small">${esc(item.assigned_name || 'Unassigned')}</td>
        <td class="nowrap small">${esc(fmtDate(item.created_at))}</td>
        <td><button class="btn btn-sm" data-open-conflict="${esc(item.id)}">Review</button></td>
      </tr>`).join('')}</tbody></table>` : emptyState('No conflict cases', 'Cross-institution matches detected at commit will appear here.', 'check')}</div>
    ${pagination(data, () => {}, 'cases')}
  </div>`;

  setContent(html);
  $('conflict-status-filter').addEventListener('change', (event) => {
    state.conflictsStatus = event.target.value;
    state.conflictsPage = 1;
    applyRoute();
  });
  bindPagination(document, data, (page) => { state.conflictsPage = page; applyRoute(); });
  document.querySelectorAll('[data-open-conflict]').forEach((button) => button.addEventListener('click', () => openConflictDetail(button.dataset.openConflict)));
}

async function openConflictDetail(caseId) {
  const [data, usersData] = await Promise.all([
    api(`/conflicts/${caseId}`),
    can('conflict:review') ? api('/users') : Promise.resolve({ items: [] })
  ]);
  const conflict = data.conflict;
  const items = data.items || [];
  const audit = data.audit || [];
  const users = (usersData.items || [])
    .filter((user) => ['VERIFIER', 'AICTE_ADMIN'].includes(user.role))
    .filter((user) => state.user.role !== 'VERIFIER' || user.id === state.user.id);
  const closed = ['RESOLVED', 'FALSE_POSITIVE', 'ESCALATED'].includes(conflict.status);

  const candidateCards = items.map((item) => `<div class="candidate ${item.relationship === 'PRIMARY' ? 'primary' : ''}">
    <div class="c-head"><div><strong>${esc(item.institution_name)}</strong><div class="cell-sub">${esc(item.programme_code)} · ${esc(item.programme_name)}</div></div><span class="badge badge-${item.relationship === 'PRIMARY' ? 'teal' : 'gray'}">${esc(titleCase(item.relationship))}</span></div>
    <div class="c-row"><span>Student</span><span>${esc(item.full_name)}</span></div>
    <div class="c-row"><span>APAAR</span><span class="masked">${esc(item.apaar_masked)}</span></div>
    <div class="c-row"><span>Academic year</span><span>${esc(item.academic_year)}</span></div>
    <div class="c-row"><span>Roll number</span><span class="mono">${esc(item.roll_number || '—')}</span></div>
    <div class="c-row"><span>Status</span><span>${badge(item.enrolment_status)}</span></div>
    <div class="c-row"><span>Identity</span><span>${badge(item.identity_status)}</span></div>
    <div class="c-row"><span>Seat / category</span><span>${esc(item.seat_type)} · ${esc(item.admission_category || '—')}</span></div>
  </div>`).join('');

  const body = `<div class="stack">
    <div class="kv">
      <div><div class="k">Case</div><div class="v mono">${esc(conflict.case_code)}</div></div>
      <div><div class="k">Status</div><div class="v">${badge(conflict.status)}</div></div>
      <div><div class="k">Priority</div><div class="v">${badge(conflict.priority)}</div></div>
      <div><div class="k">Assigned to</div><div class="v">${esc(conflict.assigned_name || 'Unassigned')}</div></div>
    </div>
    <div class="chips">${(conflict.reason_codes || []).map((code) => `<span class="chip">${esc(code)}</span>`).join('')}</div>
    <div class="compare">${candidateCards || '<p class="muted small">No candidate records.</p>'}</div>
    ${can('conflict:review') && !closed ? `<div class="grid grid-2">
      <form id="assign-form" class="card card-pad stack" style="gap:10px">
        <div class="section-title">Assign reviewer</div>
        <div id="assign-error"></div>
        <div class="field"><label for="assign-user">Reviewer</label><select id="assign-user" name="assigned_to"><option value="">Unassign</option>${users.map((user) => `<option value="${esc(user.id)}" ${conflict.assigned_to === user.id ? 'selected' : ''}>${esc(user.display_name)} · ${esc(roleLabel(user.role))}</option>`).join('')}</select></div>
        <button class="btn" type="submit" id="assign-submit">Save assignment</button>
      </form>
      <form id="resolve-form" class="card card-pad stack" style="gap:10px">
        <div class="section-title">Record resolution</div>
        <div id="resolve-error"></div>
        <div class="field"><label for="resolution-code">Resolution</label><select id="resolution-code" name="resolution_code">${(state.meta?.conflict_resolutions || []).map((code) => `<option value="${esc(code)}">${titleCase(code)}</option>`).join('')}</select></div>
        <div class="field"><label for="resolution-notes">Notes</label><textarea id="resolution-notes" name="notes" rows="3" minlength="5" maxlength="1000" placeholder="Evidence reviewed and decision rationale" required></textarea></div>
        <button class="btn btn-primary" type="submit" id="resolve-submit">Resolve case</button>
      </form>
    </div>` : ''}
    ${conflict.resolution_code ? `<div class="note"><strong>${esc(titleCase(conflict.resolution_code))}</strong><br>${esc(conflict.resolution_notes || 'No notes recorded.')}</div>` : ''}
    <div>
      <div class="section-title">Case audit trail</div>
      <div class="timeline">${audit.length ? audit.map((event) => `<div class="timeline-item"><span class="dot"></span><div class="t-body"><strong>${esc(titleCase(event.action))}</strong><p>${esc(event.actor_label || 'System')}${event.reason_code ? ` · ${esc(event.reason_code)}` : ''}</p></div><span class="t-time">${esc(fmtDateTime(event.occurred_at))}</span></div>`).join('') : '<p class="muted small">No case events.</p>'}</div>
    </div>
  </div>`;

  openModal({
    title: `Conflict ${conflict.case_code}`,
    subtitle: 'Cross-institution duplicate review',
    body,
    wide: true,
    footer: `<button class="btn" data-modal-close>Close</button>`
  });

  const assignForm = $('assign-form');
  if (assignForm) assignForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/conflicts/${conflict.id}/assign`, {
        method: 'POST',
        body: { assigned_to: $('assign-user').value || null }
      });
      toast('Case assignment updated.', 'success');
      closeModal();
      applyRoute();
      await openConflictDetail(conflict.id);
    } catch (error) {
      $('assign-error').innerHTML = formError(error.message);
    }
  });

  const resolveForm = $('resolve-form');
  if (resolveForm) resolveForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/conflicts/${conflict.id}/resolve`, {
        method: 'POST',
        body: { resolution_code: form.get('resolution_code'), notes: form.get('notes') }
      });
      toast('Conflict case resolution recorded.', 'success');
      closeModal();
      applyRoute();
      await openConflictDetail(conflict.id);
    } catch (error) {
      $('resolve-error').innerHTML = formError(error.message);
    }
  });
}

async function renderAnalytics() {
  const year = state.analyticsYear || state.meta?.current_year || '2026-27';
  const data = await api(`/analytics/intake?academic_year=${encodeURIComponent(year)}`);
  const rows = data.rows || [];
  const totals = data.totals || {};
  const years = state.meta?.academic_years || [year];
  const actions = `<div class="field" style="min-width:140px"><label for="analytics-year">Academic year</label><select id="analytics-year">${years.map((item) => `<option value="${esc(item)}" ${item === year ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></div>
    <button class="btn" id="export-intake">${ICONS.download}Intake CSV</button>
    <button class="btn" id="export-enrolments">${ICONS.download}Enrolments CSV</button>`;
  const html = `${pageHead('Intake analytics', 'Approved intake versus regular active enrolments, with category-level caps and actionable alerts.', actions)}
  <div class="grid grid-kpi">
    ${kpi('Approved intake', fmtNumber(totals.approved), 'Across programmes', 'info')}
    ${kpi('Regular counted', fmtNumber(totals.counted), 'Active regular enrolments')}
    ${kpi('Supernumerary', fmtNumber(totals.supernumerary), 'Active supernumerary')}
    ${kpi('Utilisation', fmtPercent(totals.utilization), 'Regular / approved')}
    ${kpi('Alerts', fmtNumber(totals.alerts), 'Programmes over intake', totals.alerts ? 'bad' : '')}
    ${kpi('Programmes', fmtNumber(rows.length), 'Active catalogue')}
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><div><h2>Programme-level utilisation · ${esc(year)}</h2><div class="sub">Category caps apply to regular active enrolments</div></div><span class="pill">${esc(state.meta?.ruleset || 'AVIP-RULES-1.0.0')}</span></div>
    <div class="table-wrap">${rows.length ? `<table><thead><tr><th>Institution / programme</th><th>Rule version</th><th>Approved</th><th>Regular</th><th>Supernumerary</th><th>Utilisation</th><th>Category caps</th><th>Alert</th></tr></thead><tbody>
      ${rows.map((row) => `<tr>
        <td><div class="cell-title">${esc(row.programme_name)}</div><div class="cell-sub">${esc(row.institution_name)} · ${esc(row.programme_code)}</div></td>
        <td>${row.rule_version ? `<span class="mono">v${esc(row.rule_version)}</span>` : '<span class="badge badge-amber">No approval</span>'}</td>
        <td>${row.approved_intake === null ? '—' : fmtNumber(row.approved_intake)}</td>
        <td>${fmtNumber(row.counted_regular)}</td>
        <td>${fmtNumber(row.supernumerary)}</td>
        <td>${utilizationCell(row)}</td>
        <td><div class="chips">${(row.categories || []).length ? row.categories.map((category) => `<span class="chip ${category.over ? 'over' : ''}"><strong>${esc(category.category)}</strong> ${fmtNumber(category.count)}/${fmtNumber(category.cap)}</span>`).join('') : '<span class="muted small">No category caps</span>'}</div></td>
        <td>${row.alert ? '<span class="badge badge-red">Over intake</span>' : row.approved_intake === null ? '<span class="badge badge-gray">No approval</span>' : '<span class="badge badge-green">Within limit</span>'}</td>
      </tr>`).join('')}</tbody></table>` : emptyState('No programme analytics', 'Publish intake approvals and commit enrolments to populate analytics.', 'analytics')}</div>
  </div>`;
  setContent(html);
  $('analytics-year').addEventListener('change', (event) => {
    state.analyticsYear = event.target.value;
    applyRoute();
  });
  $('export-intake').addEventListener('click', () => downloadReport(`/reports/intake.csv?academic_year=${encodeURIComponent(year)}`, 'avip-intake-utilization.csv'));
  $('export-enrolments').addEventListener('click', () => downloadReport('/reports/enrolments.csv', 'avip-enrolments.csv'));
}

async function renderAudit() {
  const query = new URLSearchParams({ page: String(state.auditPage || 1), pageSize: '25' });
  for (const [key, value] of Object.entries(state.auditFilters)) if (value) query.set(key, value);
  const data = await api(`/audit?${query.toString()}`);
  const items = data.items || [];
  const actions = can('audit:verify') ? `<button class="btn btn-primary" id="verify-audit">${ICONS.shield}Verify audit chain</button>` : '';
  const html = `${pageHead('Audit trail', 'Append-only events linked by SHA-256 hashes. Every privileged action, export and identity check is recorded.', actions)}
  <div id="audit-verify-result"></div>
  <div class="card">
    <form class="toolbar" id="audit-filter-form">
      <div class="field"><label for="audit-action">Action</label><input id="audit-action" name="action" value="${esc(state.auditFilters.action)}" placeholder="e.g. BATCH_COMMITTED"></div>
      <div class="field"><label for="audit-actor">Actor</label><input id="audit-actor" name="actor" value="${esc(state.auditFilters.actor)}" placeholder="Name or user ID"></div>
      <div class="field"><label for="audit-entity">Entity type</label><input id="audit-entity" name="entity_type" value="${esc(state.auditFilters.entity_type)}" placeholder="e.g. enrolment"></div>
      <button class="btn btn-primary" type="submit">${ICONS.search}Filter</button>
      <button class="btn btn-ghost" type="button" id="clear-audit-filters">Clear</button>
      <span class="spacer"></span>
      <span class="muted small">${fmtNumber(data.total)} event${data.total === 1 ? '' : 's'}</span>
    </form>
    <div class="table-wrap">${items.length ? `<table><thead><tr><th>Occurred</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th><th>Correlation</th><th></th></tr></thead><tbody>
      ${items.map((event) => `<tr>
        <td class="nowrap small">${esc(fmtDateTime(event.occurred_at))}</td>
        <td><div class="cell-title">${esc(event.actor_label || 'System')}</div><div class="cell-sub">${esc(titleCase(event.actor_type))}</div></td>
        <td><span class="badge badge-indigo">${esc(titleCase(event.action))}</span></td>
        <td><div class="cell-title">${esc(titleCase(event.entity_type))}</div><div class="cell-sub mono">${esc(String(event.entity_id || '').slice(0, 12))}</div></td>
        <td class="small">${esc(event.reason_code || '—')}</td>
        <td class="mono tiny">${esc(String(event.correlation_id || '—').slice(0, 16))}</td>
        <td><button class="btn btn-sm" data-audit-event="${esc(event.id)}">View</button></td>
      </tr>`).join('')}</tbody></table>` : emptyState('No audit events', 'Events appear here as users upload, verify, approve and commit records.', 'audit')}</div>
    ${pagination(data, () => {}, 'events')}
  </div>`;
  setContent(html);
  const form = $('audit-filter-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.auditFilters = {
      action: $('audit-action').value.trim(),
      actor: $('audit-actor').value.trim(),
      entity_type: $('audit-entity').value.trim()
    };
    state.auditPage = 1;
    applyRoute();
  });
  $('clear-audit-filters').addEventListener('click', () => {
    state.auditFilters = { action: '', actor: '', entity_type: '' };
    state.auditPage = 1;
    applyRoute();
  });
  bindPagination(document, data, (page) => { state.auditPage = page; applyRoute(); });
  document.querySelectorAll('[data-audit-event]').forEach((button) => button.addEventListener('click', () => openAuditEvent(button.dataset.auditEvent)));
  const verify = $('verify-audit');
  if (verify) verify.addEventListener('click', verifyAuditChain);
}

async function verifyAuditChain() {
  const button = $('verify-audit');
  const target = $('audit-verify-result');
  if (button) { button.disabled = true; button.textContent = 'Verifying…'; }
  try {
    const response = await fetch('/api/v1/audit/verify', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const result = await response.json();
    const valid = response.ok && result.valid !== false;
    const message = valid
      ? `Audit chain verified: ${fmtNumber(result.checked)} events checked. All hash links are intact.`
      : `Audit chain integrity failure at event ${result.brokenAt || 'unknown'}. Escalate immediately.`;
    if (target) target.innerHTML = `<div class="verify-banner ${valid ? 'ok' : 'bad'}" style="margin-bottom:16px">${valid ? ICONS.check : ICONS.alert}<div><strong>${valid ? 'Integrity verified' : 'Integrity failure'}</strong><br>${esc(message)} <span class="muted">Checked ${esc(fmtDateTime(result.checked_at))}</span></div></div>`;
    toast(message, valid ? 'success' : 'error');
  } catch (error) {
    toast(error.message, 'error');
    if (target) target.innerHTML = `<div class="verify-banner bad" style="margin-bottom:16px">${ICONS.alert}<div><strong>Verification failed</strong><br>${esc(error.message)}</div></div>`;
  } finally {
    if (button) { button.disabled = false; button.innerHTML = `${ICONS.shield}Verify audit chain`; }
  }
}

async function openAuditEvent(eventId) {
  const data = await api(`/audit/${eventId}`);
  const event = data.event;
  const body = `<div class="stack">
    <div class="kv">
      <div><div class="k">Action</div><div class="v">${esc(titleCase(event.action))}</div></div>
      <div><div class="k">Occurred</div><div class="v">${esc(fmtDateTime(event.occurred_at))}</div></div>
      <div><div class="k">Actor</div><div class="v">${esc(event.actor_label || 'System')}</div></div>
      <div><div class="k">Actor type</div><div class="v">${esc(titleCase(event.actor_type))}</div></div>
      <div><div class="k">Entity</div><div class="v">${esc(titleCase(event.entity_type))} · <span class="mono">${esc(event.entity_id || '—')}</span></div></div>
      <div><div class="k">Institution</div><div class="v mono">${esc(event.institution_id || '—')}</div></div>
      <div><div class="k">Reason code</div><div class="v">${esc(event.reason_code || '—')}</div></div>
      <div><div class="k">Correlation ID</div><div class="v mono">${esc(event.correlation_id || '—')}</div></div>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><div class="k">Previous hash</div><div class="v hash">${esc(event.previous_event_hash || 'genesis')}</div></div>
      <div class="detail-item"><div class="k">Event hash</div><div class="v hash">${esc(event.event_hash)}</div></div>
      <div class="detail-item"><div class="k">Before digest</div><div class="v hash">${esc(event.before_digest || '—')}</div></div>
      <div class="detail-item"><div class="k">After digest</div><div class="v hash">${esc(event.after_digest || '—')}</div></div>
    </div>
    <div><div class="section-title">Metadata</div><pre class="json">${esc(JSON.stringify(event.metadata || {}, null, 2))}</pre></div>
  </div>`;
  openModal({
    title: 'Audit event detail',
    subtitle: event.action,
    body,
    wide: true,
    footer: '<button class="btn" data-modal-close>Close</button>'
  });
}

async function renderSettings() {
  let settings = null;
  let health = null;
  try { settings = await api('/settings'); } catch (error) { settings = null; }
  try { health = await api('/health'); } catch (error) { health = null; }
  const user = state.user;
  const roles = state.meta?.roles || [];
  const integrations = settings?.integrations || [];
  const html = `${pageHead('Settings & security', 'Prototype integrations, privacy controls and role capability matrix.', '')}
  <div class="grid grid-2">
    <div class="card">
      <div class="card-head"><div><h2>Current session</h2><div class="sub">Authenticated identity and scope</div></div></div>
      <div class="card-body stack">
        <div class="detail-grid">
          <div class="detail-item"><div class="k">Name</div><div class="v">${esc(user.display_name)}</div></div>
          <div class="detail-item"><div class="k">Email</div><div class="v">${esc(user.email)}</div></div>
          <div class="detail-item"><div class="k">Role</div><div class="v">${esc(roleLabel(user.role))}</div></div>
          <div class="detail-item"><div class="k">Institution</div><div class="v">${esc(user.institution_name || 'AICTE (national scope)')}</div></div>
        </div>
        <div class="divider"></div>
        <div class="info-strip"><span class="item"><span class="swatch" style="background:var(--teal)"></span>Session: HttpOnly cookie · SameSite=Strict</span><span class="item"><span class="swatch" style="background:var(--indigo)"></span>MFA required for AICTE administrators</span></div>
        <div class="note"><strong>Demo credentials.</strong> All prototype accounts use password <span class="mono">Demo@1234</span>. AICTE administrator MFA code: <span class="mono">246810</span>. Never use these credentials in production.</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><h2>System health</h2><div class="sub">Runtime and ruleset status</div></div></div>
      <div class="card-body stack">
        <div class="spread"><span class="muted small">API status</span><strong>${health?.status === 'ok' ? '<span class="badge badge-green">Operational</span>' : '<span class="badge badge-red">Degraded</span>'}</strong></div>
        <div class="spread"><span class="muted small">Service</span><span class="mono small">${esc(health?.service || 'AVIP API')}</span></div>
        <div class="spread"><span class="muted small">Version</span><span class="mono small">${esc(health?.version || '1.0.0')}</span></div>
        <div class="spread"><span class="muted small">Ruleset</span><span class="mono small">${esc(health?.ruleset || state.meta?.ruleset || 'AVIP-RULES-1.0.0')}</span></div>
        <div class="spread"><span class="muted small">Identity provider</span><span class="badge badge-indigo">${esc(health?.identity_provider || 'MOCK-AVIP')}</span></div>
        <div class="spread"><span class="muted small">Server time</span><span class="small">${esc(fmtDateTime(health?.time || new Date().toISOString()))}</span></div>
      </div>
    </div>
  </div>
  <div class="settings-grid" style="margin-top:16px">
    <div class="card">
      <div class="card-head"><div><h2>Integrations</h2><div class="sub">Replaceable adapters, prototype status</div></div></div>
      <div class="card-body">${integrations.map((item) => `<div class="settings-item"><div class="s-icon">${ICONS.pulse}</div><div class="s-body"><strong>${esc(item.name)} · ${esc(item.provider)}</strong><p>${esc(item.detail)}</p></div><span class="badge badge-teal">${esc(item.status)}</span></div>`).join('') || '<p class="muted small">Integration details unavailable.</p>'}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h2>Security & retention</h2><div class="sub">Prototype controls</div></div></div>
      <div class="card-body">${Object.entries(settings?.security || {}).map(([key, value]) => `<div class="settings-item"><div class="s-icon">${ICONS.shield}</div><div class="s-body"><strong>${esc(titleCase(key))}</strong><p>${esc(value)}</p></div></div>`).join('')}
      <div class="divider"></div>
      ${Object.entries(settings?.retention || {}).map(([key, value]) => `<div class="spread small" style="padding:5px 0"><span class="muted">${esc(titleCase(key))}</span><span>${esc(value)}</span></div>`).join('')}</div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><div><h2>Role capability matrix</h2><div class="sub">Capabilities are enforced server-side on every request</div></div></div>
    <div class="table-wrap"><table class="role-matrix"><thead><tr><th>Role</th><th>Capabilities</th></tr></thead><tbody>${roles.map((role) => `<tr><td><div class="cell-title">${esc(role.label)}</div><div class="cell-sub mono">${esc(role.role)}</div></td><td>${role.capabilities.map((cap) => `<span class="cap">${esc(cap)}</span>`).join('')}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><div><h2>Demo accounts</h2><div class="sub">Role-specific exploration paths</div></div></div>
    <div class="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Scope</th><th>MFA</th></tr></thead><tbody>
      ${DEMO_ACCOUNTS.map((account) => `<tr><td class="mono">${esc(account.email)}</td><td>${esc(account.role)}</td><td>${esc(account.label)}</td><td>${account.email === 'admin@aicte.demo' ? '<span class="badge badge-amber">Required · 246810</span>' : '<span class="badge badge-gray">Not required</span>'}</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
  setContent(html);
}

window.addEventListener('hashchange', () => { if (state.user) applyRoute(); });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await bootSession();
  } catch (error) {
    if (error.status && error.status !== 401 && error.status !== 403) {
      renderLogin(error.message);
    } else {
      renderLogin();
    }
  }
});
