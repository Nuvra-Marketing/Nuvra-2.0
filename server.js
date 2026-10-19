import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import crypto from 'crypto';

import db from './server/db.js';
import { createSession, destroySession, authRequired, adminRequired, generateResellerCode, hasActivePro } from './server/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Stripe optionnel
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const { default: Stripe } = await import('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('💳 Stripe initialisé');
  } catch (e) { console.warn('⚠️  Stripe non disponible :', e.message); }
}

// ==================== AUTH ====================
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email requis et mot de passe (min 6 caractères)' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare('INSERT INTO users (email, password_hash, name, brand_name) VALUES (?, ?, ?, ?)').run(email.toLowerCase(), hash, name || email.split('@')[0], name || email.split('@')[0]);
  const token = createSession(r.lastInsertRowid);
  res.cookie('nuvra_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  const user = db.prepare('SELECT id, email, name, role, pro_active, academy_access, reseller_authorized, reseller_code FROM users WHERE id = ?').get(r.lastInsertRowid);
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const token = createSession(user.id);
  res.cookie('nuvra_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, pro_active: user.pro_active, academy_access: user.academy_access, reseller_authorized: user.reseller_authorized } });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.cookies.nuvra_token);
  res.clearCookie('nuvra_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user, pro_active: hasActivePro(req.user) });
});

app.post('/api/auth/update-profile', authRequired, (req, res) => {
  const { name, brand_name, bio, avatar_url } = req.body;
  db.prepare('UPDATE users SET name = COALESCE(?, name), brand_name = COALESCE(?, brand_name), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, brand_name, bio, avatar_url, req.user.id);
  const user = db.prepare('SELECT id, email, name, brand_name, avatar_url, bio, role, pro_active, pro_expires_at, academy_access, reseller_authorized FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// ==================== DASHBOARD ====================
app.get('/api/dashboard', authRequired, (req, res) => {
  const userId = req.user.id;
  const isPro = hasActivePro(req.user);
  const gross = db.prepare("SELECT COALESCE(SUM(amount_cents),0) as total FROM orders WHERE user_id = ? AND status = 'paid'").get(userId).total;
  const refunded = db.prepare("SELECT COALESCE(SUM(amount_cents),0) as total FROM orders WHERE user_id = ? AND status = 'refunded'").get(userId).total;
  const fees = db.prepare("SELECT COALESCE(SUM(amount_cents),0) as total FROM commissions WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?) AND is_platform_fee = 1 AND status = 'paid'").get(userId).total;
  const net = gross - refunded - (isPro ? 0 : fees);
  const salesCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'paid'").get(userId).c;
  const pendingCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'pending'").get(userId).c;
  const productsCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE user_id = ?').get(userId).c;
  const funnelsCount = db.prepare('SELECT COUNT(*) as c FROM funnels WHERE user_id = ?').get(userId).c;
  const pagesCount = db.prepare('SELECT COUNT(*) as c FROM link_pages WHERE user_id = ?').get(userId).c;
  const recentOrders = db.prepare(`SELECT o.*, p.name as product_name FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 10`).all(userId);
  const resellerEarnings = db.prepare("SELECT COALESCE(SUM(amount_cents),0) as total FROM commissions WHERE to_user_id = ? AND type = 'reseller' AND status = 'paid'").get(userId).total;
  const resellerCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE referrer_reseller_id = ? AND status = 'paid'").get(userId).c;
  res.json({
    revenue: { gross_cents: gross, refunded_cents: refunded, fees_cents: fees, net_cents: net },
    counts: { sales: salesCount, pending: pendingCount, products: productsCount, funnels: funnelsCount, pages: pagesCount, reseller_sales: resellerCount },
    reseller: { earnings_cents: resellerEarnings, sales: resellerCount },
    pro_active: isPro, academy_access: !!req.user.academy_access,
    recent_orders: recentOrders
  });
});

// ==================== PRODUITS ====================
app.get('/api/products', authRequired, (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE user_id = ? OR is_nuvra_pro = 1 OR is_nuvra_academy = 1 ORDER BY created_at DESC').all(req.user.id);
  res.json({ products });
});

app.post('/api/products', authRequired, (req, res) => {
  const { name, description, price_cents, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const r = db.prepare(`INSERT INTO products (user_id, name, description, price_cents, type, status) VALUES (?, ?, ?, ?, ?, 'published')`).run(req.user.id, name, description || '', parseInt(price_cents || '0', 10), type || 'download');
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid) });
});

app.put('/api/products/:id', authRequired, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p || p.user_id !== req.user.id) return res.status(404).json({ error: 'Produit introuvable' });
  db.prepare('UPDATE products SET name = COALESCE(?, name), description = COALESCE(?, description), price_cents = COALESCE(?, price_cents), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.name, req.body.description, req.body.price_cents ? parseInt(req.body.price_cents,10) : null, req.body.status, req.params.id);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) });
});

app.delete('/api/products/:id', authRequired, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p || p.user_id !== req.user.id || p.is_nuvra_pro || p.is_nuvra_academy) return res.status(403);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ==================== PAGES DE LIENS ====================
function slugify(s) { return (s||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) + '-' + crypto.randomBytes(3).toString('hex'); }

app.get('/api/link-pages', authRequired, (req, res) => {
  const pages = db.prepare('SELECT * FROM link_pages WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  pages.forEach(p => { try { p.links = JSON.parse(p.links); } catch { p.links=[]; } try { p.theme = JSON.parse(p.theme); } catch { p.theme={}; } });
  res.json({ pages });
});

app.post('/api/link-pages', authRequired, (req, res) => {
  const { title, slug, bio, theme, links } = req.body;
  const finalSlug = slug && slug.length >= 3 ? slug : slugify(title || 'ma-page');
  if (db.prepare('SELECT id FROM link_pages WHERE slug = ?').get(finalSlug)) return res.status(409).json({ error: 'URL déjà prise' });
  const r = db.prepare(`INSERT INTO link_pages (user_id, slug, title, bio, theme, links, status) VALUES (?, ?, ?, ?, ?, ?, 'draft')`).run(req.user.id, finalSlug, title || 'Ma page', bio || '', JSON.stringify(theme || {bg:'#07090d',accent:'#4d8bff',text:'#e8edf5'}), JSON.stringify(links || []));
  res.json({ page: db.prepare('SELECT * FROM link_pages WHERE id = ?').get(r.lastInsertRowid) });
});

app.put('/api/link-pages/:id', authRequired, (req, res) => {
  const p = db.prepare('SELECT * FROM link_pages WHERE id = ?').get(req.params.id);
  if (!p || p.user_id !== req.user.id) return res.status(404);
  const { title, bio, theme, links, status } = req.body;
  db.prepare(`UPDATE link_pages SET title = COALESCE(?, title), bio = COALESCE(?, bio), theme = COALESCE(?, theme), links = COALESCE(?, links), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(title, bio, theme?JSON.stringify(theme):null, links?JSON.stringify(links):null, status, req.params.id);
  res.json({ page: db.prepare('SELECT * FROM link_pages WHERE id = ?').get(req.params.id) });
});

app.delete('/api/link-pages/:id', authRequired, (req, res) => {
  const p = db.prepare('SELECT * FROM link_pages WHERE id = ?').get(req.params.id);
  if (!p || p.user_id !== req.user.id) return res.status(404);
  db.prepare('DELETE FROM link_pages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Page link publique
app.get('/l/:slug', (req, res) => {
  const page = db.prepare('SELECT lp.*, u.name as author_name FROM link_pages lp JOIN users u ON u.id = lp.user_id WHERE lp.slug = ? AND lp.status = ?').get(req.params.slug, 'published');
  if (!page) return res.status(404).type('html').send('Page introuvable');
  db.prepare('UPDATE link_pages SET views = views + 1 WHERE id = ?').run(page.id);
  const links = JSON.parse(page.links);
  const theme = JSON.parse(page.theme);
  res.type('html').send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title||'Nuvra'}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:${theme.bg};color:${theme.text};min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 20px}h1{font-size:22px;margin-bottom:8px}p{color:#b3bdd1;text-align:center;margin-bottom:32px;max-width:400px}.links{width:100%;max-width:440px;display:flex;flex-direction:column;gap:12px}.link{display:block;padding:16px 20px;border:1px solid ${theme.accent}40;border-radius:8px;color:${theme.text};text-align:center;text-decoration:none;font-weight:600;transition:all .2s}.link:hover{background:${theme.accent};color:#0a1018;transform:translateY(-2px)}</style></head><body><h1>${page.author_name||page.title}</h1>${page.bio?`<p>${page.bio}</p>`:''}<div class="links">${links.map(l=>`<a class="link" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('')}</div><p style="margin-top:40px;font-size:12px;opacity:.6">Propulsé par <strong>Nuvra</strong></p></body></html>`);
});

// ==================== TUNNELS ====================
app.get('/api/funnels', authRequired, (req, res) => {
  const funnels = db.prepare('SELECT * FROM funnels WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  funnels.forEach(f => { try { f.data = JSON.parse(f.data); } catch { f.data={steps:[]}; } });
  res.json({ funnels });
});

app.post('/api/funnels', authRequired, (req, res) => {
  const data = { steps: [{type:'sales',title:'Page de vente',content:{headline:'Votre offre',subtitle:'Description',buttonText:'Acheter'}}] };
  const slug = slugify(req.body.name || 'mon-tunnel');
  const r = db.prepare('INSERT INTO funnels (user_id, name, slug, data) VALUES (?, ?, ?, ?)').run(req.user.id, req.body.name||'Mon tunnel', slug, JSON.stringify(data));
  res.json({ funnel: db.prepare('SELECT * FROM funnels WHERE id = ?').get(r.lastInsertRowid) });
});

app.put('/api/funnels/:id', authRequired, (req, res) => {
  const f = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!f || f.user_id !== req.user.id) return res.status(404);
  const { name, data, status } = req.body;
  db.prepare('UPDATE funnels SET name = COALESCE(?, name), data = COALESCE(?, data), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, data?JSON.stringify(data):null, status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/funnels/:id', authRequired, (req, res) => {
  const f = db.prepare('SELECT * FROM funnels WHERE id = ?').get(req.params.id);
  if (!f || f.user_id !== req.user.id) return res.status(404);
  db.prepare('DELETE FROM funnels WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ==================== PAIEMENTS & COMMANDES ====================
function processPaidOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.status !== 'pending') return;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(order.product_id);
  if (!product) return;
  const platformFeeRate = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key='platform_fee_rate'").get().value);
  const academyFeeRate = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key='academy_fee_rate'").get().value);
  const resellerCommissionRate = parseFloat(db.prepare("SELECT value FROM app_settings WHERE key='reseller_commission_rate'").get().value);
  const creator = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
  db.prepare("UPDATE orders SET status='paid', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(orderId);
  if (product.is_nuvra_pro) {
    const expires = new Date(Date.now()+31*24*3600*1000).toISOString();
    db.prepare('UPDATE users SET pro_active=1, pro_expires_at=? WHERE id=?').run(expires, order.buyer_id);
  }
  if (product.is_nuvra_academy) {
    db.prepare('UPDATE users SET academy_access=1 WHERE id=?').run(order.buyer_id);
    const buyer = db.prepare('SELECT * FROM users WHERE id=?').get(order.buyer_id);
    if (!buyer.reseller_code) {
      const code = generateResellerCode();
      db.prepare('UPDATE users SET reseller_authorized=1, reseller_code=? WHERE id=?').run(code, order.buyer_id);
    } else db.prepare('UPDATE users SET reseller_authorized=1 WHERE id=?').run(order.buyer_id);
  }
  const creatorPro = hasActivePro(creator);
  if (!product.commission_exempt && !creatorPro) {
    const fee = Math.round(order.amount_cents * platformFeeRate);
    db.prepare(`INSERT INTO commissions (order_id, type, rate_applied, base_cents, amount_cents, is_platform_fee, status) VALUES (?, 'platform', ?, ?, ?, 1, 'paid')`).run(orderId, platformFeeRate, order.amount_cents, fee);
  }
  if (product.is_nuvra_academy) {
    const fee = Math.round(order.amount_cents * academyFeeRate);
    db.prepare(`INSERT INTO commissions (order_id, type, rate_applied, base_cents, amount_cents, is_platform_fee, status) VALUES (?, 'academy', ?, ?, ?, 1, 'paid')`).run(orderId, academyFeeRate, order.amount_cents, fee);
    if (order.referrer_reseller_id) {
      const rc = Math.round(order.amount_cents * resellerCommissionRate);
      db.prepare(`INSERT INTO commissions (order_id, type, rate_applied, base_cents, amount_cents, to_user_id, status) VALUES (?, 'reseller', ?, ?, ?, ?, 'pending')`).run(orderId, resellerCommissionRate, order.amount_cents, rc, order.referrer_reseller_id);
    }
  }
}

app.post('/api/checkout', authRequired, async (req, res) => {
  const { product_id, reseller_code } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({error:'Produit introuvable'});
  let referrerId = null;
  if (reseller_code) {
    const ref = db.prepare('SELECT id FROM users WHERE reseller_code = ? AND reseller_authorized = 1').get(reseller_code);
    if (ref && ref.id !== req.user.id) referrerId = ref.id;
  }
  if (stripe) {
    try {
      const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: product.is_nuvra_pro ? 'subscription' : 'payment',
        line_items: [{ price_data: { currency:product.currency, product_data:{name:product.name}, unit_amount:product.price_cents }, quantity:1 }],
        success_url: APP_URL+'/dashboard?success=1',
        cancel_url: APP_URL+'/dashboard?cancel=1',
        metadata: { user_id:product.user_id, product_id:product.id, buyer_id:req.user.id, referrer_id:referrerId||'' }
      });
      const o = db.prepare(`INSERT INTO orders (user_id,buyer_id,product_id,amount_cents,currency,stripe_checkout_session,status,referrer_reseller_id) VALUES (?,?,?,?,?,?,?,?)`).run(product.user_id, req.user.id, product.id, product.price_cents, product.currency, session.id, 'pending', referrerId);
      return res.json({ url:session.url, order_id:o.lastInsertRowid });
    } catch(e) { return res.status(500).json({error:e.message}); }
  } else {
    const o = db.prepare(`INSERT INTO orders (user_id,buyer_id,product_id,amount_cents,currency,status,referrer_reseller_id) VALUES (?,?,?,?,?,?,?)`).run(product.user_id, req.user.id, product.id, product.price_cents, product.currency, 'pending', referrerId);
    processPaidOrder(o.lastInsertRowid);
    res.json({ url:'/dashboard?success=1&sandbox=1', order_id:o.lastInsertRowid });
  }
});

app.get('/api/orders', authRequired, (req, res) => {
  const orders = db.prepare(`SELECT o.*, p.name as product_name FROM orders o LEFT JOIN products p ON p.id=o.product_id WHERE o.user_id=? OR o.buyer_id=? ORDER BY o.created_at DESC`).all(req.user.id, req.user.id);
  res.json({ orders });
});

app.post('/api/orders/:id/refund', authRequired, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(403);
  if (order.status !== 'paid') return res.status(400).json({error:'Commande non éligible'});
  db.prepare("UPDATE orders SET status='refunded', refunded_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
  db.prepare("UPDATE commissions SET status='refunded' WHERE order_id=?").run(order.id);
  const prod = db.prepare('SELECT * FROM products WHERE id=?').get(order.product_id);
  if (prod?.is_nuvra_pro) db.prepare('UPDATE users SET pro_active=0 WHERE id=?').run(order.buyer_id);
  res.json({ok:true});
});

// ==================== ACADEMY ====================
app.get('/api/academy/modules', authRequired, (req, res) => {
  if (!req.user.academy_access) return res.status(403).json({error:'Accès Academy requis'});
  const modules = db.prepare('SELECT * FROM academy_modules ORDER BY position').all();
  for (const m of modules) {
    m.lessons = db.prepare('SELECT * FROM academy_lessons WHERE module_id=? ORDER BY position').all(m.id);
    for (const l of m.lessons) {
      const p = db.prepare('SELECT * FROM user_lesson_progress WHERE user_id=? AND lesson_id=?').get(req.user.id, l.id);
      l.completed = p?.completed === 1;
    }
  }
  const total = db.prepare('SELECT COUNT(*) c FROM academy_lessons').get().c;
  const completed = db.prepare('SELECT COUNT(*) c FROM user_lesson_progress WHERE user_id=? AND completed=1').get(req.user.id).c;
  res.json({ modules, progress: { total, completed, percent: total?Math.round(completed/total*100):0 } });
});

app.post('/api/academy/lessons/:id/complete', authRequired, (req, res) => {
  if (!req.user.academy_access) return res.status(403);
  const done = req.body.completed ? 1 : 0;
  const ex = db.prepare('SELECT 1 FROM user_lesson_progress WHERE user_id=? AND lesson_id=?').get(req.user.id, req.params.id);
  if (ex) db.prepare('UPDATE user_lesson_progress SET completed=?, completed_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END, last_viewed_at=CURRENT_TIMESTAMP WHERE user_id=? AND lesson_id=?').run(done,done,req.user.id,req.params.id);
  else db.prepare('INSERT INTO user_lesson_progress (user_id, lesson_id, completed, completed_at) VALUES (?,?,?,CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END)').run(req.user.id, req.params.id, done, done);
  res.json({ok:true});
});

// ==================== ADMIN ====================
app.get('/api/admin/stats', authRequired, adminRequired, (req, res) => {
  res.json({
    stats: {
      users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
      pro_users: db.prepare('SELECT COUNT(*) c FROM users WHERE pro_active=1').get().c,
      academy_users: db.prepare('SELECT COUNT(*) c FROM users WHERE academy_access=1').get().c,
      orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
      revenue_cents: db.prepare("SELECT COALESCE(SUM(amount_cents),0) c FROM orders WHERE status='paid'").get().c,
      platform_fees_cents: db.prepare("SELECT COALESCE(SUM(amount_cents),0) c FROM commissions WHERE is_platform_fee=1 AND status='paid'").get().c
    }
  });
});

app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  res.json({ users: db.prepare('SELECT id,email,name,role,pro_active,academy_access,reseller_authorized,created_at FROM users ORDER BY created_at DESC').all() });
});

app.post('/api/admin/settings', authRequired, adminRequired, (req, res) => {
  const ins = db.prepare('INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)');
  for (const [k,v] of Object.entries(req.body)) ins.run(k,String(v));
  res.json({ok:true});
});

app.get('/api/admin/settings', authRequired, adminRequired, (req, res) => {
  const s={}; db.prepare('SELECT key,value FROM app_settings').all().forEach(r=>s[r.key]=r.value);
  res.json({settings:s});
});

// ==================== IA ====================
app.post('/api/ai/chat', authRequired, (req, res) => {
  const { message, conversation_id } = req.body;
  if (!message) return res.status(400).json({error:'Message requis'});
  const responses = {
    'idée':"Commencez par identifier un problème précis que vous avez vous-même résolu. Votre première offre doit être simple, rapide à livrer, et répondre à un besoin urgent.",
    'titre':"Un bon titre nomme le problème, promet un résultat concret, et donne une preuve ou un délai. Évitez les formulations vagues.",
    'tunnel':"Structure classique : Capture (email) → Vente (offre) → Checkout → Merci/Livraison. Ne rajoutez pas d'étapes inutiles.",
    'réseau':"Publiez 3 fois par semaine : 1 retour d'expérience, 1 conseil actionnable, 1 opinion. La régularité bat la perfection.",
    'conversion':"Pour convertir plus : clarifiez votre proposition, ajoutez des preuves sociales, réduisez les frictions, ajoutez une garantie claire.",
    'prix':"Ne vendez pas votre temps. Vendez un résultat. Commencez à $49-$97 pour votre premier produit numérique."
  };
  let reply = "Je suis votre assistant Nuvra. Je peux vous aider sur vos idées d'offres, copywriting, tunnels, contenu et analyses. Posez-moi une question précise.";
  for (const [k,v] of Object.entries(responses)) if (message.toLowerCase().includes(k)) { reply=v; break; }
  let convId = conversation_id; let msgs=[];
  if (convId) { const c = db.prepare('SELECT * FROM ai_conversations WHERE id=? AND user_id=?').get(convId,req.user.id); if (c) msgs=JSON.parse(c.messages); }
  msgs.push({role:'user',content:message,at:new Date().toISOString()},{role:'assistant',content:reply,at:new Date().toISOString()});
  if (convId) db.prepare('UPDATE ai_conversations SET messages=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(msgs),convId);
  else { const r=db.prepare('INSERT INTO ai_conversations (user_id,messages) VALUES (?,?)').run(req.user.id,JSON.stringify(msgs)); convId=r.lastInsertRowid; }
  res.json({reply, conversation_id:convId, note: stripe ? 'IA connectée' : 'Mode réponses contextualisées — ajoutez une clé API pour les générations LLM'});
});

// ==================== SANTÉ ET FRONTEND ====================
app.get('/api/health', (req,res)=>res.json({ok:true, time:new Date().toISOString()}));

// ==================== SERVEUR FRONTEND VITE EN DEV, STATIC EN PROD ====================
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  app.get(/^\/(?!api|l|uploads).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  // En dev, Vite est middleware directement dans Express sur le même port
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { port: parseInt(PORT) + 100 } },
    appType: 'spa'
  });
  // Les routes /api, /l/ et /uploads sont gérées par Express AVANT Vite
  // Toutes les autres routes passent par Vite
  app.use(vite.middlewares);
  // Fallback SPA : toutes les routes GET non-API renvoient index.html via Vite transform
  app.use('*', async (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/l/') || req.path.startsWith('/uploads')) return next();
    try {
      const template = await vite.transformIndexHtml(req.originalUrl, fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8'));
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Nuvra démarré sur http://localhost:${PORT}`);
  console.log(stripe ? '💳 Stripe configuré' : '⚠️  Mode sandbox (paiements test sans Stripe).');
  console.log('👤 Compte admin : admin@nuvra.app / admin123');
});
