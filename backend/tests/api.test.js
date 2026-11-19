// Needs a MongoDB to talk to. Locally: docker run -p 27017:27017 mongo:7
// or set MONGODB_URI_TEST to a throwaway database (it gets wiped!).
process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:8080';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');

const DB = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/hostel_test';
const api = () => request(app);
const authed = (token) => ({ Authorization: `Bearer ${token}` });

const login = async (email, password) =>
  (await api().post('/api/auth/login').send({ email, password })).body;

let admin, ravi, suma, s1, s2, raviId;

beforeAll(async () => {
  await mongoose.connect(DB);
  await mongoose.connection.dropDatabase();
  const mk = (name, email, role, extra = {}) =>
    User.create({ name, email, role, passwordHash: bcrypt.hashSync('pass123', 4), ...extra });
  await mk('Warden Rao', 'admin@test.in', 'admin');
  const r = await mk('Ravi (Plumber)', 'ravi@test.in', 'staff', { category: 'Water supply' });
  raviId = String(r._id);
  await mk('Suma (Electrician)', 'suma@test.in', 'staff', { category: 'Electricity' });

  admin = (await login('admin@test.in', 'pass123')).token;
  ravi = (await login('ravi@test.in', 'pass123')).token;
  suma = (await login('suma@test.in', 'pass123')).token;
  for (const n of [1, 2]) {
    await api().post('/api/auth/register').send({ name: `Student ${n}`, email: `s${n}@test.in`, password: 'secret1', room: `A-10${n}` });
  }
  s1 = await login('s1@test.in', 'secret1');
  s2 = await login('s2@test.in', 'secret1');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const newComplaint = (token, extra = {}) =>
  api().post('/api/complaints').set(authed(token)).send({ category: 'Water supply', room: 'A-101', description: 'No water', ...extra });

describe('auth', () => {
  test('register returns token and user, login works, duplicate gives 409', async () => {
    const reg = await api().post('/api/auth/register').send({ name: 'New', email: 'new@test.in', password: 'abcdef', room: 'C-1' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();
    expect(reg.body.user).toEqual({ id: expect.any(String), name: 'New', email: 'new@test.in', role: 'student', room: 'C-1' });
    const dup = await api().post('/api/auth/register').send({ name: 'New', email: 'NEW@test.in', password: 'abcdef', room: 'C-1' });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe('An account with this email already exists.');
    expect((await login('new@test.in', 'abcdef')).token).toBeDefined();
  });

  test('wrong email or password gives the same 401 message', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'nobody@test.in', password: 'x123456' });
    const b = await api().post('/api/auth/login').send({ email: 's1@test.in', password: 'wrongpass' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe('Email or password is incorrect.');
    expect(b.body.message).toBe(a.body.message);
  });

  test('invalid registration input gives 400', async () => {
    const r = await api().post('/api/auth/register').send({ name: 'X', email: 'bad', password: '123', room: '1' });
    expect(r.status).toBe(400);
  });
});

describe('no token', () => {
  test('protected routes return 401', async () => {
    expect((await api().get('/api/complaints')).status).toBe(401);
    expect((await api().post('/api/complaints').send({})).status).toBe(401);
    expect((await api().get('/api/staff')).status).toBe(401);
    expect((await api().patch('/api/complaints/C-1001').send({ status: 'Resolved' })).status).toBe(401);
  });
  test('health is public', async () => {
    expect((await api().get('/api/health')).body).toEqual({ status: 'ok' });
  });
});

describe('students', () => {
  let c1, c2;
  test('create complaint: server sets student, status and first history entry', async () => {
    const res = await newComplaint(s1.token, { studentId: s2.user.id, studentName: 'Hacker', status: 'Resolved' });
    expect(res.status).toBe(201);
    c1 = res.body;
    expect(c1.id).toMatch(/^C-\d{4}$/);
    expect(c1._id).toBeUndefined();
    expect(c1.__v).toBeUndefined();
    expect(c1.studentId).toBe(s1.user.id);
    expect(c1.studentName).toBe('Student 1');
    expect(c1.status).toBe('Open');
    expect(c1.photo).toBeNull();
    expect(c1.assignedTo).toBeNull();
    expect(c1.history).toHaveLength(1);
    expect(c1.history[0]).toMatchObject({ status: 'Open', note: 'Complaint submitted' });
    c2 = (await newComplaint(s2.token)).body;
  });

  test('student sees only their own complaints', async () => {
    const res = await api().get('/api/complaints').set(authed(s1.token));
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual([c1.id]);
  });

  test('validation: bad category, missing fields, bad photo', async () => {
    expect((await newComplaint(s1.token, { category: 'Gym' })).status).toBe(400);
    expect((await newComplaint(s1.token, { room: '' })).status).toBe(400);
    expect((await newComplaint(s1.token, { photo: 'http://evil.com/x.png' })).status).toBe(400);
    expect((await newComplaint(s1.token, { photo: 'data:image/png;base64,AAAA' })).status).toBe(201);
  });

  test('student cannot PATCH', async () => {
    const res = await api().patch(`/api/complaints/${c1.id}`).set(authed(s1.token)).send({ status: 'Resolved' });
    expect(res.status).toBe(403);
  });

  test('admin and staff cannot create complaints', async () => {
    expect((await newComplaint(admin)).status).toBe(403);
    expect((await newComplaint(ravi)).status).toBe(403);
  });
});

describe('admin', () => {
  test('sees all, assigns to staff, changes status to any value', async () => {
    const c = (await newComplaint(s1.token)).body;
    const all = await api().get('/api/complaints').set(authed(admin));
    expect(all.body.length).toBeGreaterThanOrEqual(2);

    const staff = await api().get('/api/staff').set(authed(s1.token)); // any logged-in user
    expect(staff.status).toBe(200);
    expect(staff.body.find((s) => s.email === 'ravi@test.in').id).toBe(raviId);
    expect(staff.body[0].passwordHash).toBeUndefined();

    const assigned = await api().patch(`/api/complaints/${c.id}`).set(authed(admin)).send({ assignedTo: raviId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assignedTo).toBe(raviId);
    expect(assigned.body.history.at(-1).note).toBe('Assigned to Ravi (Plumber)');

    const jump = await api().patch(`/api/complaints/${c.id}`).set(authed(admin)).send({ status: 'Resolved' });
    expect(jump.body.status).toBe('Resolved');
    expect(jump.body.history.at(-1).note).toBe('Status changed to Resolved');

    const removed = await api().patch(`/api/complaints/${c.id}`).set(authed(admin)).send({ assignedTo: '' });
    expect(removed.body.assignedTo).toBeNull();
    expect(removed.body.history.at(-1).note).toBe('Assignment removed');
  });

  test('errors: unknown id 404, bad status 400, unknown staff 400', async () => {
    expect((await api().patch('/api/complaints/C-9999').set(authed(admin)).send({ status: 'Open' })).status).toBe(404);
    const c = (await newComplaint(s1.token)).body;
    expect((await api().patch(`/api/complaints/${c.id}`).set(authed(admin)).send({ status: 'Done' })).status).toBe(400);
    expect((await api().patch(`/api/complaints/${c.id}`).set(authed(admin)).send({ assignedTo: s1.user.id })).status).toBe(400);
  });
});

describe('staff', () => {
  test('sees only assigned, moves forward one step, cannot assign or go backward', async () => {
    const mine = (await newComplaint(s1.token)).body;
    const other = (await newComplaint(s2.token)).body;
    await api().patch(`/api/complaints/${mine.id}`).set(authed(admin)).send({ assignedTo: raviId });

    const list = await api().get('/api/complaints').set(authed(ravi));
    expect(list.body.map((c) => c.id)).toEqual([mine.id]);
    expect((await api().get('/api/complaints').set(authed(suma))).body).toHaveLength(0);

    const patch = (token, id, body) => api().patch(`/api/complaints/${id}`).set(authed(token)).send(body);
    expect((await patch(ravi, mine.id, { status: 'Resolved' })).status).toBe(403); // skipping a step
    expect((await patch(ravi, mine.id, { status: 'In Progress' })).status).toBe(200);
    expect((await patch(ravi, mine.id, { status: 'Open' })).status).toBe(403);      // backward
    expect((await patch(ravi, mine.id, { assignedTo: raviId })).status).toBe(403);  // cannot assign
    expect((await patch(suma, mine.id, { status: 'Resolved' })).status).toBe(403);  // not theirs
    expect((await patch(ravi, other.id, { status: 'In Progress' })).status).toBe(403); // unassigned
    const done = await patch(ravi, mine.id, { status: 'Resolved' });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('Resolved');
  });
});
