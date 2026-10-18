// Local Base44-compatible backend (Express + SQLite)
// Run: node server/index.js   (listens on port 3001)
import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

const PORT = process.env.PORT || 3001;
const db = new Database('data.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    data TEXT NOT NULL,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_records_entity ON records(entity);
`);

const LOCAL_USER = {
  id: 'local-user',
  email: 'admin@local.test',
  full_name: 'Local Admin',
  role: 'admin',
};

const app = express();
app.use(express.json({ limit: '10mb' }));

// ---------- helpers ----------
const toObj = (row) => ({
  ...JSON.parse(row.data),
  id: row.id,
  created_date: row.created_date,
  updated_date: row.updated_date,
  created_by: row.created_by,
});

function matchValue(actual, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, v]) => {
      switch (op) {
        case '$in': return Array.isArray(v) && v.includes(actual);
        case '$nin': return Array.isArray(v) && !v.includes(actual);
        case '$ne': return actual !== v;
        case '$gt': return actual > v;
        case '$gte': return actual >= v;
        case '$lt': return actual < v;
        case '$lte': return actual <= v;
        case '$regex': return new RegExp(v, 'i').test(String(actual ?? ''));
        default: return true;
      }
    });
  }
  if (Array.isArray(actual)) return actual.includes(cond);
  return actual === cond;
}

function matches(obj, q) {
  return Object.entries(q).every(([key, cond]) => {
    if (key === '$or') return cond.some((sub) => matches(obj, sub));
    if (key === '$and') return cond.every((sub) => matches(obj, sub));
    return matchValue(obj[key], cond);
  });
}

function listRecords(entity, query) {
  let items = db
    .prepare('SELECT * FROM records WHERE entity = ?')
    .all(entity)
    .map(toObj);

  if (query.q) {
    try {
      const q = JSON.parse(query.q);
      items = items.filter((o) => matches(o, q));
    } catch { /* ignore bad q */ }
  }

  const sort = query.sort || '-created_date';
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  items.sort((a, b) => {
    const x = a[field], y = b[field];
    if (x === y) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : 1) * (desc ? -1 : 1);
  });

  const skip = parseInt(query.skip || '0', 10);
  const limit = query.limit ? parseInt(query.limit, 10) : items.length;
  return items.slice(skip, skip + limit);
}

function insert(entity, body) {
  const now = new Date().toISOString();
  const { id: givenId, created_date, updated_date, created_by, ...data } = body;
  const id = givenId || randomUUID().replace(/-/g, '').slice(0, 24);
  db.prepare(
    'INSERT INTO records (id, entity, data, created_date, updated_date, created_by) VALUES (?,?,?,?,?,?)'
  ).run(id, entity, JSON.stringify(data), now, now, LOCAL_USER.email);
  return toObj(db.prepare('SELECT * FROM records WHERE id = ?').get(id));
}

// ---------- non-entity endpoints ----------
app.post('/api/apps/:appId/analytics/track/batch', (_req, res) => res.json({ ok: true }));

app.get('/api/apps/public/prod/public-settings/by-id/:id', (req, res) =>
  res.json({ id: req.params.id, name: 'Local App', public_settings: 'public_without_login' })
);

app.get('/api/apps/:appId/entities/User/me', (_req, res) => res.json(LOCAL_USER));
app.get('/api/apps/:appId/auth/me', (_req, res) => res.json(LOCAL_USER));
// Login: any email works, but the password must be ADMIN_PASSWORD.
// Change the password here (or set it to '' to accept any password).
const ADMIN_PASSWORD = 'ellen';
function loginHandler(req, res) {
  const { email, password } = req.body || {};
  if (ADMIN_PASSWORD && password !== ADMIN_PASSWORD) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }
  const user = { ...LOCAL_USER, email: email || LOCAL_USER.email };
  res.json({ access_token: 'local-dev-token', token_type: 'bearer', user });
}
app.post('/api/apps/:appId/auth/login', loginHandler);
app.post('/api/apps/:appId/auth/verify-otp', loginHandler);

// Other auth calls (register, reset password, logout, ...): harmless stub, but logged
app.post('/api/apps/:appId/auth/*splat', (req, res) => {
  console.log(`[auth stub] ${req.method} ${req.originalUrl}`);
  res.json({ ok: true });
});

// ---------- entity CRUD ----------
const base = '/api/apps/:appId/entities/:entity';

// list (v2 and legacy)
app.get(`${base}/v2/list`, (req, res) => {
  const { skip, limit, ...rest } = req.query;
  const total = listRecords(req.params.entity, rest).length;
  const items = listRecords(req.params.entity, req.query);
  res.json({
    items,
    total,
    skip: parseInt(skip || '0', 10),
    limit: limit ? parseInt(limit, 10) : items.length,
  });
});
app.get(base, (req, res) => res.json(listRecords(req.params.entity, req.query)));

// bulk create
app.post(`${base}/bulk`, (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  res.json(items.map((it) => insert(req.params.entity, it)));
});

// create
app.post(base, (req, res) => {
  if (Array.isArray(req.body)) {
    return res.json(req.body.map((it) => insert(req.params.entity, it)));
  }
  res.json(insert(req.params.entity, req.body));
});

// get one
app.get(`${base}/:id`, (req, res) => {
  const row = db
    .prepare('SELECT * FROM records WHERE id = ? AND entity = ?')
    .get(req.params.id, req.params.entity);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(toObj(row));
});

// update
app.put(`${base}/:id`, (req, res) => {
  const row = db
    .prepare('SELECT * FROM records WHERE id = ? AND entity = ?')
    .get(req.params.id, req.params.entity);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { id, created_date, updated_date, created_by, ...patch } = req.body;
  const merged = { ...JSON.parse(row.data), ...patch };
  db.prepare('UPDATE records SET data = ?, updated_date = ? WHERE id = ?').run(
    JSON.stringify(merged),
    new Date().toISOString(),
    row.id
  );
  res.json(toObj(db.prepare('SELECT * FROM records WHERE id = ?').get(row.id)));
});

// delete
app.delete(`${base}/:id`, (req, res) => {
  db.prepare('DELETE FROM records WHERE id = ? AND entity = ?').run(
    req.params.id,
    req.params.entity
  );
  res.json({ ok: true });
});

// anything else: log it so we know what's still missing
app.use('/api', (req, res) => {
  console.warn(`[unhandled] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not implemented in local backend' });
});

app.listen(PORT, '127.0.0.1', () =>
  console.log(`Local backend running on http://127.0.0.1:${PORT}`)
);