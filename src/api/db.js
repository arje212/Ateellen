// -----------------------------------------------------------------------------
//  Supabase data layer
//
//  Exposes the same small API the pages were already using
//  (db.entities.Order.filter / list / create / update / delete / count /
//   aggregate / subscribe, db.auth.*, db.users.inviteUser) but backed by
//  Supabase (Postgres + Auth + Realtime) instead of the Base44 SDK.
//
//  Table/column definitions live in supabase/schema.sql — keep TABLES below in sync.
// -----------------------------------------------------------------------------
import { supabase } from '@/lib/supabase';

// column types: text | num (NOT NULL number) | numnull (nullable number) | bool | date | ts | json
const TABLES = {
  Category: {
    table: 'categories',
    cols: { name: 'text', slug: 'text', description: 'text', sort_order: 'num' },
  },
  Product: {
    table: 'products',
    cols: {
      name: 'text', category_id: 'text', category_name: 'text', description: 'text', price: 'numnull',
      variants: 'json', image_url: 'text', active: 'bool', sort_order: 'num', serves_with: 'text',
      sold_out: 'bool', recipe: 'json',
    },
  },
  AppSetting: {
    table: 'app_settings',
    cols: {
      restaurant_name: 'text', logo_url: 'text', address: 'text', phone: 'text', email: 'text',
      facebook_page: 'text', business_hours: 'text', currency: 'text', timezone: 'text',
      online_ordering_enabled: 'bool', auto_schedule: 'bool', open_time: 'text', close_time: 'text', closed_message: 'text',
      estimated_time: 'text', delivery_fee: 'num', free_delivery_over: 'num', min_order_amount: 'num', delivery_areas: 'text',
      gcash_number: 'text', gcash_name: 'text', gcash_qr_url: 'text', maya_number: 'text', maya_name: 'text',
    },
  },
  RestaurantTable: {
    table: 'restaurant_tables',
    cols: {
      table_number: 'text', seats: 'num', status: 'text', current_order_id: 'text',
      current_order_number: 'text', current_amount: 'num', time_occupied: 'ts', customers: 'num', location: 'text',
    },
  },
  Order: {
    table: 'orders',
    echo: true, // public visitors may INSERT but not SELECT orders, so don't ask for the row back
    cols: {
      order_number: 'text', order_type: 'text', status: 'text', table_number: 'text', customer_name: 'text',
      customer_phone: 'text', delivery_address: 'text', delivery_notes: 'text', notes: 'text', items: 'json',
      subtotal: 'num', discount_id: 'text', discount_name: 'text', discount_amount: 'num', total: 'num',
      payment_method: 'text', amount_paid: 'num', change: 'num', payment_status: 'text', cashier_id: 'text',
      cashier_name: 'text', source: 'text',
      delivery_fee: 'num', payment_reference: 'text', cancel_reason: 'text', privacy_consent: 'bool',
    },
  },
  Addon: {
    table: 'addons',
    cols: { name: 'text', price: 'num', active: 'bool', sort_order: 'num', category_ids: 'json' },
  },
  Customer: {
    table: 'customers',
    cols: {
      name: 'text', phone: 'text', email: 'text', address: 'text', notes: 'text',
      total_orders: 'num', total_spending: 'num',
    },
  },
  Discount: {
    table: 'discounts',
    cols: {
      name: 'text', type: 'text', value: 'num', start_date: 'date', end_date: 'date',
      minimum_purchase: 'num', maximum_discount: 'num', active: 'bool',
    },
  },
  Expense: {
    table: 'expenses',
    cols: {
      expense_date: 'date', category: 'text', amount: 'num', description: 'text',
      paid_by: 'text', receipt_url: 'text', notes: 'text',
    },
  },
  Supplier: {
    table: 'suppliers',
    cols: {
      name: 'text', contact_person: 'text', phone: 'text', email: 'text', address: 'text',
      products_supplied: 'text', notes: 'text',
    },
  },
  InventoryItem: {
    table: 'inventory_items',
    cols: {
      name: 'text', category: 'text', unit: 'text', current_stock: 'num', minimum_stock: 'num',
      cost_per_unit: 'num', supplier: 'text', expiration_date: 'date', status: 'text',
    },
  },
  InventoryTransaction: {
    table: 'inventory_transactions',
    cols: { item_id: 'text', item_name: 'text', type: 'text', quantity: 'num', unit: 'text', reason: 'text', user_name: 'text' },
  },
  CashierShift: {
    table: 'cashier_shifts',
    cols: {
      cashier_name: 'text', opening_cash: 'num', opened_at: 'ts', closed_at: 'ts', status: 'text',
      total_sales: 'num', total_orders: 'num', cash_sales: 'num', digital_sales: 'num',
      expected_cash: 'num', actual_cash: 'num', difference: 'num',
    },
  },
  AuditLog: {
    table: 'audit_logs',
    cols: { user_name: 'text', action: 'text', module: 'text', description: 'text', previous_value: 'text', new_value: 'text' },
  },
  AppNotification: {
    table: 'app_notifications',
    echo: true, // public order page inserts these too
    cols: { type: 'text', title: 'text', message: 'text', module: 'text', read: 'bool', related_id: 'text' },
  },
  User: {
    table: 'profiles',
    cols: { email: 'text', full_name: 'text', role: 'text' },
  },
};

const SYSTEM_COLS = ['id', 'created_date', 'updated_date', 'created_by'];
const MAX_ROWS_PER_REQUEST = 1000; // Supabase default max-rows

// ---------------------------------------------------------------- errors ----
function wrapError(error, fallback = 'Request failed') {
  const err = new Error(error?.message || fallback);
  err.status = error?.status || (error?.code === '42501' ? 403 : undefined);
  err.code = error?.code;
  err.details = error?.details;
  if (error?.code === '42501') {
    err.message = 'Permission denied. Your account may not be approved yet — ask an admin to set your role.';
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    err.message = 'Database table not found. Did you run supabase/schema.sql in the Supabase SQL editor?';
  }
  return err;
}

// ------------------------------------------------------- write coercion ----
function coerce(type, v, mode) {
  switch (type) {
    case 'num': {
      if (v === '' || v === null || v === undefined) return mode === 'insert' ? undefined : 0;
      const n = Number(v);
      return Number.isNaN(n) ? (mode === 'insert' ? undefined : 0) : n;
    }
    case 'numnull': {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    }
    case 'bool': return v === undefined ? undefined : Boolean(v);
    case 'date':
    case 'ts': return v === '' || v === undefined ? null : v;
    default: return v;
  }
}

function prepare(cfg, data, mode) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (SYSTEM_COLS.includes(k)) continue;
    const type = cfg.cols[k];
    if (!type) {
      if (import.meta.env.DEV) console.warn(`[db] "${k}" is not a column of ${cfg.table}; ignored.`);
      continue;
    }
    const val = coerce(type, v, mode);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

// ------------------------------------------------------------ filtering ----
const isOps = (c) => c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).some((k) => k.startsWith('$'));

const likePattern = (regex) => {
  let s = String(regex);
  const starts = s.startsWith('^');
  const ends = s.endsWith('$');
  if (starts) s = s.slice(1);
  if (ends) s = s.slice(0, -1);
  s = s.replace(/\\(.)/g, '$1').replace(/[\\%_]/g, '\\$&');
  return `${starts ? '' : '%'}${s}${ends ? '' : '%'}`;
};

const quote = (v) => (typeof v === 'string' ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : String(v));

// Apply one field condition to a query builder
function applyCond(q, field, cond) {
  if (!isOps(cond)) return cond === null ? q.is(field, null) : q.eq(field, cond);
  for (const [op, v] of Object.entries(cond)) {
    switch (op) {
      case '$eq': q = v === null ? q.is(field, null) : q.eq(field, v); break;
      case '$ne': q = v === null ? q.not(field, 'is', null) : q.neq(field, v); break;
      case '$gt': q = q.gt(field, v); break;
      case '$gte': q = q.gte(field, v); break;
      case '$lt': q = q.lt(field, v); break;
      case '$lte': q = q.lte(field, v); break;
      case '$in': q = q.in(field, v); break;
      case '$nin': q = q.not(field, 'in', `(${v.map(quote).join(',')})`); break;
      case '$regex': q = q.ilike(field, likePattern(v)); break;
      default: break;
    }
  }
  return q;
}

// Same thing, but as PostgREST filter strings (used inside $or / $and)
function condStrings(field, cond) {
  if (!isOps(cond)) return [cond === null ? `${field}.is.null` : `${field}.eq.${quote(cond)}`];
  const out = [];
  for (const [op, v] of Object.entries(cond)) {
    switch (op) {
      case '$eq': out.push(v === null ? `${field}.is.null` : `${field}.eq.${quote(v)}`); break;
      case '$ne': out.push(v === null ? `${field}.not.is.null` : `${field}.neq.${quote(v)}`); break;
      case '$gt': out.push(`${field}.gt.${quote(v)}`); break;
      case '$gte': out.push(`${field}.gte.${quote(v)}`); break;
      case '$lt': out.push(`${field}.lt.${quote(v)}`); break;
      case '$lte': out.push(`${field}.lte.${quote(v)}`); break;
      case '$in': out.push(`${field}.in.(${v.map(quote).join(',')})`); break;
      case '$nin': out.push(`${field}.not.in.(${v.map(quote).join(',')})`); break;
      case '$regex': out.push(`${field}.ilike.${likePattern(v).replace(/%/g, '*')}`); break;
      default: break;
    }
  }
  return out;
}

function queryStrings(query) {
  const parts = [];
  for (const [key, cond] of Object.entries(query || {})) {
    if (key === '$or') parts.push(`or(${cond.map((s) => `and(${queryStrings(s).join(',')})`).join(',')})`);
    else if (key === '$and') cond.forEach((s) => parts.push(...queryStrings(s)));
    else parts.push(...condStrings(key, cond));
  }
  return parts;
}

function applyQuery(q, query) {
  for (const [key, cond] of Object.entries(query || {})) {
    if (key === '$or') q = q.or(cond.map((s) => `and(${queryStrings(s).join(',')})`).join(','));
    else if (key === '$and') cond.forEach((s) => { q = applyQuery(q, s); });
    else q = applyCond(q, key, cond);
  }
  return q;
}

function applySort(q, sort) {
  const s = sort || '-created_date';
  const desc = s.startsWith('-');
  return q.order(desc ? s.slice(1) : s, { ascending: !desc, nullsFirst: false });
}

// list(sort, limit, skip)  OR  list({ sort, limit, skip })
const normOpts = (a, b, c) =>
  a && typeof a === 'object' ? a : { sort: a, limit: b, skip: c };

// ----------------------------------------------------------- repository ----
function makeRepo(entity, cfg) {
  const t = cfg.table;

  async function select(query, opts = {}) {
    const limit = Math.min(opts.limit ?? MAX_ROWS_PER_REQUEST, MAX_ROWS_PER_REQUEST);
    const skip = opts.skip ?? 0;
    let q = supabase.from(t).select('*', { count: 'exact' });
    q = applyQuery(q, query);
    q = applySort(q, opts.sort);
    const { data, count, error } = await q.range(skip, skip + limit - 1);
    if (error) throw wrapError(error);
    return { items: data || [], total: count ?? (data || []).length, skip, limit };
  }

  // Pulls every matching row (paged), used for aggregates
  async function selectAll(query, max = 10000) {
    const all = [];
    for (let from = 0; from < max; from += MAX_ROWS_PER_REQUEST) {
      let q = supabase.from(t).select('*');
      q = applyQuery(q, query);
      q = applySort(q, '-created_date');
      const { data, error } = await q.range(from, from + MAX_ROWS_PER_REQUEST - 1);
      if (error) throw wrapError(error);
      all.push(...data);
      if (data.length < MAX_ROWS_PER_REQUEST) break;
    }
    return all;
  }

  const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(16).slice(2)}`);

  async function createOne(data) {
    const row = { ...prepare(cfg, data, 'insert'), id: data?.id || newId() };
    if (cfg.echo) {
      const { error } = await supabase.from(t).insert(row);
      if (error) throw wrapError(error);
      const now = new Date().toISOString();
      return { ...row, created_date: now, updated_date: now };
    }
    const { data: created, error } = await supabase.from(t).insert(row).select().single();
    if (error) throw wrapError(error);
    return created;
  }

  return {
    list: (a, b, c) => select({}, normOpts(a, b, c)),
    filter: (query, a, b, c) => select(query, normOpts(a, b, c)),

    async get(id) {
      const { data, error } = await supabase.from(t).select('*').eq('id', id).maybeSingle();
      if (error) throw wrapError(error);
      if (!data) { const e = new Error('Not found'); e.status = 404; throw e; }
      return data;
    },

    async count(query = {}) {
      let q = supabase.from(t).select('*', { count: 'exact', head: true });
      q = applyQuery(q, query);
      const { count, error } = await q;
      if (error) throw wrapError(error);
      return count ?? 0;
    },

    async create(data) {
      if (Array.isArray(data)) return Promise.all(data.map(createOne));
      return createOne(data);
    },
    bulkCreate: (rows) => Promise.all((rows || []).map(createOne)),

    async update(id, patch) {
      const { data, error } = await supabase.from(t).update(prepare(cfg, patch, 'update')).eq('id', id).select().maybeSingle();
      if (error) throw wrapError(error);
      if (!data) throw new Error('Update failed: record not found or you do not have permission.');
      return data;
    },

    async delete(id) {
      const { data, error } = await supabase.from(t).delete().eq('id', id).select('id');
      if (error) throw wrapError(error);
      if (!data || data.length === 0) throw new Error('Delete failed: record not found or you do not have permission.');
      return { ok: true };
    },

    // Group + sum in the browser. Returns { rows: [{ _id, sum_<field>, count }] }
    async aggregate({ query = {}, groupBy, sum, dateBucket } = {}) {
      const rows = await selectAll(query);
      const groups = new Map();
      const keyOf = (r) => {
        if (dateBucket) {
          const d = new Date(r[dateBucket.field]);
          if (dateBucket.unit === 'hour') d.setMinutes(0, 0, 0);
          else if (dateBucket.unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
          else d.setHours(0, 0, 0, 0);
          return d.toISOString();
        }
        return groupBy ? (r[groupBy] ?? '') : 'all';
      };
      for (const r of rows) {
        const k = keyOf(r);
        const g = groups.get(k) || { _id: k, count: 0, ...(sum ? { [`sum_${sum}`]: 0 } : {}) };
        g.count += 1;
        if (sum) g[`sum_${sum}`] += Number(r[sum]) || 0;
        groups.set(k, g);
      }
      const out = [...groups.values()];
      if (dateBucket) out.sort((a, b) => (a._id < b._id ? -1 : 1));
      return { rows: out };
    },

    // Realtime: returns an unsubscribe function
    subscribe(callback) {
      const channel = supabase
        .channel(`rt-${t}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload) =>
          callback({ type: String(payload.eventType || '').toLowerCase(), id: payload.new?.id || payload.old?.id, data: payload.new })
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    },
  };
}

const entities = Object.fromEntries(Object.entries(TABLES).map(([name, cfg]) => [name, makeRepo(name, cfg)]));

// ------------------------------------------------------------------ auth ----
const authError = (message, status = 401) => Object.assign(new Error(message), { status });
const origin = () => window.location.origin;

async function loadProfile(user) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw wrapError(error);
  if (!data) {
    // Profile row is created by a DB trigger on signup. If it is missing the schema hasn't been installed.
    throw authError('No profile found for this account. Run supabase/schema.sql in the Supabase SQL editor.', 404);
  }
  return {
    id: data.id,
    email: data.email || user.email,
    full_name: data.full_name || (user.email || '').split('@')[0],
    role: data.role,
    created_date: data.created_date,
  };
}

const auth = {
  async me() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw authError('Not authenticated');
    return loadProfile(session.user);
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  loginWithProvider(provider, returnTo = '/') {
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: origin() + returnTo } });
  },

  async register({ email, password }) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: origin() } });
    if (error) throw error;
    // Supabase hides "already registered" by returning a user with no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('This email is already registered. Please log in instead.');
    }
    return { session: data.session, user: data.user };
  },

  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) throw error;
    return { access_token: data.session?.access_token, user: data.user };
  },

  setToken() { /* supabase-js already stores the session */ },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` });
    if (error) throw error;
  },

  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async logout(redirectTo) {
    await supabase.auth.signOut();
    if (redirectTo) window.location.href = '/login';
  },

  redirectToLogin() { window.location.href = '/login'; },
};

// ----------------------------------------------------------------- users ----
const users = {
  // Supabase can't send invite emails from the browser (needs the service key).
  // Instead we pre-approve the email: when that person signs up at /register
  // the database trigger gives them this role automatically.
  async inviteUser(email, role = 'user') {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) throw new Error('Email required');
    const { error } = await supabase.from('user_invites').upsert({ email: clean, role }, { onConflict: 'email' });
    if (error) throw wrapError(error);
    // already signed up? approve them right away
    await supabase.from('profiles').update({ role }).eq('email', clean);
    return { ok: true };
  },
};

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw wrapError(error);
  return data;
}

export const db = { entities, auth, users, rpc, supabase };
