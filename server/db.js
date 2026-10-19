import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nuvra.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Wrapper minimal reproduisant l'API better-sqlite3
let SQL;
let db;

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const methods = {
  prepare(sql) {
    const stmt = {
      run(...params) {
        const wrapped = params.map(p => p === undefined ? null : p);
        try { db.run(sql, wrapped); } catch(e) { throw e; }
        save();
        const lastIdR = db.exec('SELECT last_insert_rowid() as id');
        const lastId = lastIdR[0]?.values[0]?.[0];
        return { lastInsertRowid: lastId, changes: db.getRowsModified() };
      },
      get(...params) {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params.map(p => p === undefined ? null : p));
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.getAsObject();
            stmt.free();
            return vals;
          }
          stmt.free();
          return undefined;
        } catch(e) { return undefined; }
      },
      all(...params) {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params.map(p => p === undefined ? null : p));
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        } catch(e) { return []; }
      }
    };
    return stmt;
  },
  exec(sql) { db.exec(sql); save(); },
  pragma() {} // no-op, sql.js doesn't need pragmas for WAL/foreign keys in this mode
};

// Activation des foreign keys
export async function initDb() {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');

  // Schéma
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  brand_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  pro_active INTEGER NOT NULL DEFAULT 0,
  pro_expires_at DATETIME,
  academy_access INTEGER NOT NULL DEFAULT 0,
  reseller_authorized INTEGER NOT NULL DEFAULT 0,
  reseller_code TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  type TEXT NOT NULL DEFAULT 'download',
  status TEXT NOT NULL DEFAULT 'draft',
  file_path TEXT,
  is_nuvra_academy INTEGER NOT NULL DEFAULT 0,
  is_nuvra_pro INTEGER NOT NULL DEFAULT 0,
  commission_exempt INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS funnels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Mon tunnel',
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  data TEXT NOT NULL DEFAULT '{"steps":[]}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS link_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  theme TEXT NOT NULL DEFAULT '{"bg":"#07090d","accent":"#4d8bff","text":"#e8edf5"}',
  links TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  views INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS academy_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS academy_lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at DATETIME,
  last_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  buyer_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  stripe_payment_intent TEXT UNIQUE,
  stripe_checkout_session TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  referrer_reseller_id INTEGER REFERENCES users(id),
  refunded_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  rate_applied REAL NOT NULL,
  base_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  to_user_id INTEGER REFERENCES users(id),
  is_platform_fee INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, type)
);
CREATE TABLE IF NOT EXISTS clicks_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_page_id INTEGER REFERENCES link_pages(id) ON DELETE CASCADE,
  funnel_id INTEGER REFERENCES funnels(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  target_url TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

  // Paramètres par défaut
  const defaults = {
    platform_fee_rate: '0.05',
    academy_fee_rate: '0.10',
    pro_price_cents: '2900',
    academy_price_cents: '19700',
    reseller_commission_rate: '0.90'
  };
  for (const [k, v] of Object.entries(defaults)) {
    const exists = methods.prepare('SELECT key FROM app_settings WHERE key = ?').get(k);
    if (!exists) methods.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(k, v);
  }

  // Admin par défaut
  let adminId = 1;
  const userCount = methods.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const r = methods.prepare(`INSERT INTO users (email, password_hash, name, role, pro_active, academy_access, reseller_authorized)
      VALUES (?, ?, 'Administrateur Nuvra', 'admin', 1, 1, 1)`).run('admin@nuvra.app', hash);
    adminId = r.lastInsertRowid;
    console.log('✅ Compte admin créé : admin@nuvra.app / admin123');
  } else {
    const a = methods.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (a) adminId = a.id;
  }

  // Produits système
  const prodCount = methods.prepare('SELECT COUNT(*) as c FROM products WHERE is_nuvra_pro = 1 OR is_nuvra_academy = 1').get().c;
  if (prodCount === 0) {
    methods.prepare(`INSERT INTO products (user_id, name, description, price_cents, currency, type, status, is_nuvra_pro, commission_exempt)
      VALUES (?, 'Nuvra Pro', 'Abonnement mensuel Nuvra Pro', 2900, 'usd', 'subscription', 'published', 1, 1)`).run(adminId);
    methods.prepare(`INSERT INTO products (user_id, name, description, price_cents, currency, type, status, is_nuvra_academy, commission_exempt)
      VALUES (?, 'Nuvra Academy', 'Formation complète — accès à vie', 19700, 'usd', 'course', 'published', 1, 0)`).run(adminId);
  }

  // Modules Academy
  const modCount = methods.prepare('SELECT COUNT(*) as c FROM academy_modules').get().c;
  if (modCount === 0) {
    const modules = [
      'Les fondations du business digital',
      'Recherche de niche et marché',
      "Création d'une offre numérique",
      'Pages de liens et tunnels de vente',
      'Copywriting et conversion',
      'Création de contenu et marketing',
      'Acquisition de clients',
      "Automatisation avec l'IA",
      'Ventes, indicateurs et optimisation',
      'Développement et pérennisation'
    ];
    modules.forEach((title, i) => {
      const r = methods.prepare('INSERT INTO academy_modules (title, position) VALUES (?, ?)').run(title, i);
      methods.prepare('INSERT INTO academy_lessons (module_id, title, content, position) VALUES (?, ?, ?, ?)')
        .run(r.lastInsertRowid, 'Introduction', `<p>Module : <strong>${title}</strong></p><p>Contenu pédagogique provisoire.</p>`, 0);
      methods.prepare('INSERT INTO academy_lessons (module_id, title, content, position) VALUES (?, ?, ?, ?)')
        .run(r.lastInsertRowid, 'Leçon pratique', `<p>Appliquez les concepts à votre projet.</p>`, 1);
    });
    console.log('✅ 10 modules Academy créés');
  }

  save();
  console.log('✅ Base de données initialisée');
}

await initDb();
export default methods;
