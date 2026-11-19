/* ------------------------------------------------------------------
   API layer. All backend calls live here so the UI never changes.
   - USE_MOCK = true  -> works fully in the browser (localStorage demo)
   - USE_MOCK = false -> calls the Express/FastAPI backend at API_BASE
   Expected endpoints (agree these with the backend teammate):
     POST  /auth/login          {email,password}            -> {token,user}
     POST  /auth/register       {name,email,password,room}  -> {token,user}
     GET   /complaints          (filtered by role on server) -> [complaint]
     POST  /complaints          {category,room,description,photo}
     PATCH /complaints/:id      {status?, assignedTo?}
     GET   /staff                                            -> [staff]
   user: {id,name,email,role: 'student'|'admin'|'staff', room?, category?}
------------------------------------------------------------------- */
const CONFIG = { USE_MOCK: false, API_BASE: 'http://localhost:5000/api' };

const Api = (() => {
  const KEY = 'hct_db', SESSION = 'hct_session';
  const wait = (ms = 150) => new Promise(r => setTimeout(r, ms));
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const now = () => new Date().toISOString();

  /* ---------- real backend ---------- */
  const token = () => (read(SESSION, null) || {}).token;
  async function http(path, method = 'GET', body) {
    const res = await fetch(CONFIG.API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.detail || 'Something went wrong. Try again.');
    return data;
  }

  /* ---------- mock backend ---------- */
  function db() {
    let d = read(KEY, null);
    if (d) return d;
    d = {
      users: [
        { id: 'u1', name: 'Demo Student', email: 'student@nie.ac.in', password: 'student123', role: 'student', room: 'B-214' },
        { id: 'u2', name: 'Warden Rao', email: 'admin@nie.ac.in', password: 'admin123', role: 'admin' },
        { id: 'u3', name: 'Ravi (Plumber)', email: 'ravi@nie.ac.in', password: 'staff123', role: 'staff', category: 'Water supply' },
        { id: 'u4', name: 'Suma (Electrician)', email: 'suma@nie.ac.in', password: 'staff123', role: 'staff', category: 'Electricity' }
      ],
      complaints: [
        { id: 'C-1001', category: 'Wi-Fi', room: 'B-214', description: 'Wi-Fi drops every evening after 8 PM on the second floor.',
          photo: null, status: 'In Progress', studentId: 'u1', studentName: 'Demo Student', assignedTo: 'u4',
          createdAt: '2026-11-10T09:00:00Z',
          history: [{ status: 'Open', at: '2026-11-10T09:00:00Z', note: 'Complaint submitted' }, { status: 'In Progress', at: '2026-11-11T11:30:00Z', note: 'Assigned and started' }] },
        { id: 'C-1002', category: 'Water supply', room: 'B-214', description: 'No water in the bathroom tap since morning.',
          photo: null, status: 'Open', studentId: 'u1', studentName: 'Demo Student', assignedTo: null,
          createdAt: '2026-11-15T07:45:00Z', history: [{ status: 'Open', at: '2026-11-15T07:45:00Z', note: 'Complaint submitted' }] }
      ]
    };
    write(KEY, d); return d;
  }
  const save = d => write(KEY, d);
  const safeUser = u => { const { password, ...rest } = u; return rest; };
  const me = () => (read(SESSION, null) || {}).user;

  const mock = {
    async login({ email, password }) {
      await wait();
      const u = db().users.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
      if (!u) throw new Error('Email or password is incorrect.');
      return { token: 'mock-' + u.id, user: safeUser(u) };
    },
    async register({ name, email, password, room }) {
      await wait(); const d = db();
      if (d.users.some(x => x.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists.');
      const u = { id: 'u' + Date.now(), name, email, password, role: 'student', room };
      d.users.push(u); save(d);
      return { token: 'mock-' + u.id, user: safeUser(u) };
    },
    async listComplaints() {
      await wait(); const u = me(); const all = db().complaints;
      const list = u.role === 'student' ? all.filter(c => c.studentId === u.id)
                 : u.role === 'staff' ? all.filter(c => c.assignedTo === u.id) : all;
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createComplaint({ category, room, description, photo }) {
      await wait(); const d = db(); const u = me();
      const c = { id: 'C-' + (1001 + d.complaints.length), category, room, description, photo: photo || null, status: 'Open',
        studentId: u.id, studentName: u.name, assignedTo: null, createdAt: now(),
        history: [{ status: 'Open', at: now(), note: 'Complaint submitted' }] };
      d.complaints.push(c); save(d); return c;
    },
    async updateComplaint(id, patch) {
      await wait(); const d = db(); const c = d.complaints.find(x => x.id === id);
      if (patch.assignedTo !== undefined) {
        c.assignedTo = patch.assignedTo || null;
        const s = d.users.find(x => x.id === c.assignedTo);
        c.history.push({ status: c.status, at: now(), note: s ? 'Assigned to ' + s.name : 'Assignment removed' });
      }
      if (patch.status && patch.status !== c.status) {
        c.status = patch.status;
        c.history.push({ status: c.status, at: now(), note: 'Status changed to ' + c.status });
      }
      save(d); return c;
    },
    async listStaff() { await wait(0); return db().users.filter(u => u.role === 'staff').map(safeUser); }
  };

  const real = {
    login: b => http('/auth/login', 'POST', b),
    register: b => http('/auth/register', 'POST', b),
    listComplaints: () => http('/complaints'),
    createComplaint: b => http('/complaints', 'POST', b),
    updateComplaint: (id, p) => http('/complaints/' + id, 'PATCH', p),
    listStaff: () => http('/staff')
  };

  const impl = CONFIG.USE_MOCK ? mock : real;
  return {
    ...impl,
    session: () => read(SESSION, null),
    setSession: s => write(SESSION, s),
    clearSession: () => { try { localStorage.removeItem(SESSION); } catch {} }
  };
})();
