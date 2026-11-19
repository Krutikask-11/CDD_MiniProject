const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUSES = ['Open', 'In Progress', 'Resolved'];
const CATS = [
  { n: 'Water supply', e: '💧' }, { n: 'Wi-Fi', e: '📶' }, { n: 'Electricity', e: '💡' },
  { n: 'Mess', e: '🍽️' }, { n: 'Cleanliness', e: '🧹' }, { n: 'Other', e: '🛠️' }
];
const emoji = n => (CATS.find(c => c.n === n) || { e: '🛠️' }).e;
const MAX_PHOTO = 1.4 * 1024 * 1024;
const LOGO = '<div class="logo"><img src="assets/nie-logo.png" alt="NIE logo"></div>';

const svg = p => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  home: svg('<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>')
};

const state = { user: null, complaints: [], staff: [], tab: 'home', q: '', fStatus: '', fCat: '', newCat: 'Water supply', authTab: 'login' };

const fmt = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtD = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const tag = s => `<span class="tag ${s.replace(' ', '-')}">${esc(s)}</span>`;
const staffName = id => (state.staff.find(s => s.id === id) || {}).name || 'Not assigned';
const initial = n => esc((n || '?').trim()[0].toUpperCase());
const homeTab = r => (r === 'student' ? 'home' : r === 'admin' ? 'complaints' : 'assigned');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function steps(status) {
  const i = STATUSES.indexOf(status);
  return `<div class="steps" aria-label="Status: ${esc(status)}">` + STATUSES.map((s, n) =>
    `<span class="step ${n <= i ? 'on' : ''}"><i></i>${s}</span>` + (n < 2 ? `<span class="bar ${n < i ? 'on' : ''}"></span>` : '')).join('') + '</div>';
}
const matches = c => {
  const q = state.q.trim().toLowerCase();
  return !q || [c.id, c.category, c.description, c.room, c.studentName].join(' ').toLowerCase().includes(q);
};
const chip = (type, v, label, on) => `<button class="chip" data-chip="${type}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}</button>`;
const empty = (t, p, btn = '') => `<div class="empty"><h3>${t}</h3><p>${p}</p>${btn}</div>`;

/* ---------------- auth ---------------- */
function renderAuth() {
  const login = state.authTab === 'login';
  $('#root').innerHTML = `<div class="app">
    <header class="top auth-top">${LOGO}<h1>Hostel Complaint Tracker</h1><p>The National Institute of Engineering, Mysore</p></header>
    <main class="content">
      <div class="tabs" role="tablist">
        ${chip('auth', 'login', 'Log in', login)}${chip('auth', 'register', 'New student', !login)}
      </div>
      <form id="authForm" novalidate>
        ${login ? '' : `<label for="name">Full name</label><input id="name" autocomplete="name">
        <label for="room">Room number</label><input id="room" placeholder="e.g. B-214">`}
        <label for="email">Email</label><input id="email" type="email" autocomplete="email">
        <label for="password">Password</label><input id="password" type="password" autocomplete="${login ? 'current-password' : 'new-password'}">
        <div class="error" id="authErr" role="alert"></div>
        <button class="btn block" type="submit">${login ? 'Log in' : 'Create account'}</button>
      </form>
      ${CONFIG.USE_MOCK && login ? `<div class="demo"><b>Demo accounts</b> (data stays in this browser)<br>
        Student: <code>student@nie.ac.in</code> / <code>student123</code><br>
        Admin: <code>admin@nie.ac.in</code> / <code>admin123</code><br>
        Staff: <code>suma@nie.ac.in</code> / <code>staff123</code></div>` : ''}
    </main></div>`;
}

async function submitAuth(form) {
  const login = state.authTab === 'login';
  const v = id => (form.querySelector('#' + id) || {}).value?.trim();
  const body = login ? { email: v('email'), password: v('password') } : { name: v('name'), room: v('room'), email: v('email'), password: v('password') };
  const err = $('#authErr');
  if (Object.values(body).some(x => !x)) { err.textContent = 'Fill in every field.'; return; }
  if (!/^\S+@\S+\.\S+$/.test(body.email)) { err.textContent = 'Enter a valid email address.'; return; }
  if (body.password.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  const btn = form.querySelector('button[type=submit]'); btn.disabled = true; err.textContent = '';
  try {
    const res = await (login ? Api.login(body) : Api.register(body));
    Api.setSession(res); state.user = res.user; state.tab = homeTab(res.user.role); state.q = '';
    await loadData(); renderShell();
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
}

async function loadData() {
  const [c, s] = await Promise.all([Api.listComplaints(), Api.listStaff().catch(() => [])]);
  state.complaints = c; state.staff = s;
}

/* ---------------- shell ---------------- */
const TABS = {
  student: [['home', 'Home', 'home'], ['complaints', 'Complaints', 'list'], ['profile', 'Profile', 'user']],
  admin: [['complaints', 'Complaints', 'list'], ['profile', 'Profile', 'user']],
  staff: [['assigned', 'Assigned', 'list'], ['profile', 'Profile', 'user']]
};
const TITLE = { complaints: 'Complaints', assigned: 'Assigned to me', profile: 'Profile' };

function renderShell() {
  const u = state.user;
  $('#root').innerHTML = `<div class="app ${u.role === 'admin' ? 'wide' : ''}">
    <header class="top" id="top"></header><main class="content" id="body"></main>
    <nav class="nav" aria-label="Main">${TABS[u.role].map(([k, label, ic]) =>
      `<button data-nav="${k}" ${state.tab === k ? 'aria-current="page"' : ''}>${ICON[ic]}${label}</button>`).join('')}</nav></div>`;
  renderTop(); renderBody();
}

function renderTop() {
  const u = state.user, t = state.tab;
  const av = `<div class="avatar" aria-hidden="true">${initial(u.name)}</div>`;
  const row = t === 'home'
    ? `${LOGO}<div class="loc"><small>${u.room ? 'Your room' : 'NIE Mysore'}</small><b>${u.room ? 'Room ' + esc(u.room) : 'Hostel'}</b></div>${av}`
    : `${LOGO}<h2 class="top-title">${u.role === 'admin' && t === 'complaints' ? 'All complaints' : TITLE[t]}</h2>${av}`;
  $('#top').innerHTML = `<div class="top-row">${row}</div>` + (t === 'profile' ? '' :
    `<label class="search">${ICON.search}<input id="q" type="search" placeholder="Search complaints" aria-label="Search complaints" value="${esc(state.q)}"></label>`);
}

function renderBody() {
  const r = state.user.role, t = state.tab;
  $('#body').innerHTML = t === 'profile' ? profileView() : r === 'student' ? (t === 'home' ? studentHome() : studentList()) : r === 'admin' ? adminView() : staffView();
}

/* ---------------- cards ---------------- */
function card(c, extra = '') {
  const photo = c.photo && /^data:image\//.test(c.photo);
  return `<article class="card"><div class="card-row">
    <div class="thumb">${photo ? `<img src="${c.photo}" alt="">` : emoji(c.category)}</div>
    <div class="grow"><div class="card-top"><h3>${esc(c.category)}</h3>${tag(c.status)}</div>
      <div class="meta">${esc(c.id)} · Room ${esc(c.room)} · ${fmtD(c.createdAt)}</div>
      <p class="desc">${esc(c.description)}</p></div></div>${steps(c.status)}${extra}</article>`;
}
const viewBtn = (c, label = 'View history') => `<button class="link" data-act="view" data-id="${esc(c.id)}">${label}</button>`;

/* ---------------- student ---------------- */
function studentHome() {
  const list = state.complaints.filter(matches);
  const open = state.complaints.filter(c => c.status !== 'Resolved').length;
  return `<div class="sec-title">Report an issue</div>
    <div class="tiles">${CATS.map(c => `<button class="tile" data-act="new" data-cat="${esc(c.n)}"><div class="em">${c.e}</div>${esc(c.n)}</button>`).join('')}</div>
    <div class="sec-title">${state.q ? 'Search results' : 'Your recent complaints'}</div>
    ${list.length ? `<div class="list">${list.slice(0, state.q ? 50 : 3).map(c => card(c, `<div class="card-actions"><span class="meta">Assigned to: ${esc(staffName(c.assignedTo))}</span>${viewBtn(c)}</div>`)).join('')}</div>`
      : empty(state.q ? 'No matches' : 'No complaints yet', state.q ? 'Try a different word.' : 'Pick a category above to report your first issue.')}
    ${!state.q && open ? `<p class="meta" style="text-align:center;margin-top:14px">${open} complaint${open > 1 ? 's' : ''} still being handled</p>` : ''}`;
}

function studentList() {
  const list = state.complaints.filter(c => matches(c) && (!state.fStatus || c.status === state.fStatus));
  return `<div class="chips chip-row">${chip('status', '', 'All', !state.fStatus)}${STATUSES.map(s => chip('status', s, s, state.fStatus === s)).join('')}</div>
    <div class="sec-title">${state.fStatus || 'All'} complaints</div>
    ${list.length ? `<div class="list">${list.map(c => card(c, `<div class="card-actions"><span class="meta">Assigned to: ${esc(staffName(c.assignedTo))}</span>${viewBtn(c)}</div>`)).join('')}</div>`
      : empty('Nothing here', 'No complaints match this filter.', `<button class="btn small" data-act="new">New complaint</button>`)}`;
}

/* ---------------- admin ---------------- */
function adminView() {
  const all = state.complaints, n = s => all.filter(c => c.status === s).length;
  const list = all.filter(c => matches(c) && (!state.fCat || c.category === state.fCat) && (!state.fStatus || c.status === state.fStatus));
  return `<div class="stats"><div class="stat s1"><b>${n('Open')}</b>Open</div><div class="stat s2"><b>${n('In Progress')}</b>In progress</div><div class="stat s3"><b>${n('Resolved')}</b>Resolved</div></div>
    <div class="chips chip-row">${chip('status', '', 'All statuses', !state.fStatus)}${STATUSES.map(s => chip('status', s, s, state.fStatus === s)).join('')}</div>
    <div class="chips">${chip('cat', '', 'All categories', !state.fCat)}${CATS.map(c => chip('cat', c.n, c.e + ' ' + c.n, state.fCat === c.n)).join('')}</div>
    <div class="sec-title">${list.length} complaint${list.length === 1 ? '' : 's'}</div>
    ${list.length ? `<div class="list grid">${list.map(c => card(c, `
      <div class="meta" style="margin-top:8px">Raised by ${esc(c.studentName)}</div>
      <div class="pair">
        <div><label for="a-${esc(c.id)}">Assign to</label><select id="a-${esc(c.id)}" data-assign="${esc(c.id)}"><option value="">Not assigned</option>${state.staff.map(s => `<option value="${esc(s.id)}" ${c.assignedTo === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div><label for="s-${esc(c.id)}">Status</label><select id="s-${esc(c.id)}" data-status="${esc(c.id)}">${STATUSES.map(s => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div><div class="card-actions">${viewBtn(c, 'Details')}</div>`)).join('')}</div>`
      : empty('No complaints match', 'Clear a filter or search to see more.')}`;
}

/* ---------------- staff ---------------- */
function staffView() {
  const list = state.complaints.filter(matches);
  return `<div class="sec-title">Your work list</div>` + (list.length ? `<div class="list">${list.map(c => card(c, `
    <div class="card-actions"><span class="meta">${esc(c.studentName)}</span><span>
      ${c.status === 'Open' ? `<button class="btn small" data-act="set" data-id="${esc(c.id)}" data-s="In Progress">Start work</button>` : ''}
      ${c.status === 'In Progress' ? `<button class="btn small" data-act="set" data-id="${esc(c.id)}" data-s="Resolved">Mark resolved</button>` : ''}
      ${viewBtn(c, 'Details')}</span></div>`)).join('')}</div>`
    : empty('Nothing assigned', 'New assignments from the warden will show up here.'));
}

/* ---------------- profile ---------------- */
function profileView() {
  const u = state.user, role = { student: 'Student', admin: 'Administrator', staff: 'Staff' }[u.role];
  return `<div class="profile"><div class="avatar">${initial(u.name)}</div><h2>${esc(u.name)}</h2><p class="muted">${role}</p>
    <dl><div><dt>Email</dt><dd style="margin:0">${esc(u.email)}</dd></div>
    ${u.room ? `<div><dt>Room</dt><dd style="margin:0">${esc(u.room)}</dd></div>` : ''}
    ${u.category ? `<div><dt>Works on</dt><dd style="margin:0">${esc(u.category)}</dd></div>` : ''}
    <div><dt>College</dt><dd style="margin:0">NIE Mysore</dd></div></dl>
    <button class="btn ghost block" data-act="logout">Log out</button></div>`;
}

/* ---------------- new complaint (full page) ---------------- */
function renderNew() {
  $('#root').innerHTML = `<div class="app">
    <header class="top"><div class="top-row"><button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button><h2 class="top-title">New complaint</h2></div></header>
    <form id="complaintForm" class="content" novalidate>
      <div class="sec-title">What is it about?</div>
      <div class="chips wrap" id="catChips">${CATS.map(c => `<button type="button" class="chip" data-cat="${esc(c.n)}" aria-pressed="${c.n === state.newCat}">${c.e} ${esc(c.n)}</button>`).join('')}</div>
      <label for="croom">Room number</label><input id="croom" value="${esc(state.user.room || '')}">
      <label for="desc">What is the problem?</label><textarea id="desc" placeholder="Describe the issue and when it started"></textarea>
      <label for="photo">Photo (optional)</label><input id="photo" type="file" accept="image/*">
      <div class="error" id="cErr" role="alert"></div>
    </form>
    <div class="cta"><button class="cta-btn" type="submit" form="complaintForm" id="submitBtn"><span>Submit complaint</span><span>›</span></button></div></div>`;
}

function readPhoto(file) {
  return new Promise((res, rej) => {
    if (!file) return res(null);
    if (file.size > MAX_PHOTO) return rej(new Error('Photo must be smaller than 1.4 MB.'));
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the photo.')); r.readAsDataURL(file);
  });
}

async function submitComplaint(form) {
  const err = $('#cErr'); err.textContent = '';
  const body = { category: state.newCat, room: $('#croom', form).value.trim(), description: $('#desc', form).value.trim() };
  if (!body.room || !body.description) { err.textContent = 'Enter your room number and describe the problem.'; return; }
  const btn = $('#submitBtn'); btn.disabled = true;
  try {
    body.photo = await readPhoto($('#photo', form).files[0]);
    await Api.createComplaint(body); await loadData();
    state.tab = 'complaints'; state.fStatus = ''; state.q = ''; renderShell(); toast('Complaint submitted');
  } catch (e) { err.textContent = e.message; btn.disabled = false; }
}

/* ---------------- details dialog ---------------- */
function openDetails(id) {
  const c = state.complaints.find(x => x.id === id); if (!c) return;
  $('#dialog').innerHTML = `<div class="card-top"><div><h2>${emoji(c.category)} ${esc(c.category)}</h2><div class="meta">${esc(c.id)} · Room ${esc(c.room)} · ${esc(c.studentName)}</div></div>${tag(c.status)}</div>
    <p style="margin-top:10px">${esc(c.description)}</p>
    ${c.photo && /^data:image\//.test(c.photo) ? `<img src="${c.photo}" alt="Photo attached to complaint ${esc(c.id)}">` : ''}
    <p class="meta" style="margin-top:10px">Assigned to: ${esc(staffName(c.assignedTo))}</p>
    ${steps(c.status)}<h3 style="margin-top:14px;font-size:.9rem">History</h3>
    <ul class="timeline">${(c.history || []).map(h => `<li><b>${esc(h.note)}</b><div class="meta">${fmt(h.at)}</div></li>`).join('')}</ul>
    <button class="btn ghost block" data-act="close">Close</button>`;
  $('#dialog').showModal();
}

async function patch(id, p, msg) {
  try { await Api.updateComplaint(id, p); await loadData(); renderBody(); toast(msg); } catch (e) { toast(e.message); }
}

/* ---------------- events ---------------- */
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'authForm') submitAuth(e.target);
  if (e.target.id === 'complaintForm') submitComplaint(e.target);
});

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-nav],[data-chip],[data-cat]'); if (!t) return;
  const d = t.dataset;
  if (d.nav) { state.tab = d.nav; state.q = ''; state.fStatus = ''; state.fCat = ''; renderShell(); }
  else if (d.chip) {
    if (d.chip === 'auth') { state.authTab = d.v; renderAuth(); }
    else { state[d.chip === 'status' ? 'fStatus' : 'fCat'] = d.v; renderBody(); }
  }
  else if (d.act === 'new') { if (d.cat) state.newCat = d.cat; renderNew(); }
  else if (d.cat) { state.newCat = d.cat; document.querySelectorAll('#catChips .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === d.cat)); }
  else if (d.act === 'back') renderShell();
  else if (d.act === 'close') $('#dialog').close();
  else if (d.act === 'view') openDetails(d.id);
  else if (d.act === 'set') patch(d.id, { status: d.s }, 'Status updated to ' + d.s);
  else if (d.act === 'logout') { Api.clearSession(); state.user = null; state.authTab = 'login'; renderAuth(); }
});

document.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; renderBody(); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.assign !== undefined) patch(t.dataset.assign, { assignedTo: t.value }, t.value ? 'Complaint assigned' : 'Assignment removed');
  else if (t.dataset.status !== undefined) patch(t.dataset.status, { status: t.value }, 'Status updated to ' + t.value);
});

/* ---------------- boot ---------------- */
(async function init() {
  const s = Api.session();
  if (s && s.user) {
    state.user = s.user; state.tab = homeTab(s.user.role);
    try { await loadData(); renderShell(); return; } catch { Api.clearSession(); state.user = null; }
  }
  renderAuth();
})();
