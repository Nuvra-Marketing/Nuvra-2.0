import './style.css';

// Configuration
const API = '/api';
let state = { user: null, route: window.location.pathname };

// Utilitaires
async function api(path, opts = {}) {
  const res = await fetch(API + path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}
function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtCents(c) { return '$' + ((c||0)/100).toFixed(2); }
function navigate(path) { window.history.pushState({}, '', path); state.route = path; render(); }

// ==================== NAVIGATION & ROUTER ====================
window.addEventListener('popstate', () => { state.route = window.location.pathname; render(); });
document.addEventListener('click', e => { const a = e.target.closest('a[href^="/"]'); if (a && !a.target && !a.download && !a.pathname.startsWith('/l/')) { e.preventDefault(); navigate(a.pathname + a.search); } });

// Auth state
async function loadUser() { try { const d = await api('/auth/me'); state.user = d.user; state.pro_active = d.pro_active; } catch { state.user = null; } }

// Composants UI partagés
function nav() {
  if (!state.user) return publicNav();
  return `<header class="app-header"><a class="brand" href="/dashboard"><span class="mark">N</span>nuvra<span class="brand-dot">®</span></a>
  <nav>
    <a href="/dashboard">Tableau de bord</a>
    <a href="/pages">Pages</a>
    <a href="/funnels">Tunnels</a>
    <a href="/products">Produits</a>
    ${state.user.academy_access ? '<a href="/academy">Academy</a>' : ''}
    <a href="/ai">✦ IA</a>
    ${state.user.role === 'admin' ? '<a href="/admin">Admin</a>' : ''}
  </nav>
  <div class="user-menu"><span class="user-name">${escapeHtml(state.user.name || state.user.email)}</span> ${state.pro_active ? '<span class="pro-badge">PRO</span>' : '<a class="nav-cta" href="/pricing">Pro</a>'} <button id="logout-btn" class="logout">Se déconnecter</button></div>
  </header>`;
}
function publicNav() {
  return `<header><a class="brand" href="/"><span class="mark">N</span>nuvra<span class="brand-dot">®</span></a>
  <nav>
    <a href="/#features">Le système</a>
    <a href="/academy-landing">Académie</a>
    <a href="/pricing">Tarifs</a>
  </nav>
  <a class="nav-cta" href="/login">Se connecter <span>→</span></a></header>`;
}
const footer = `<footer><a class="brand" href="/"><span class="mark">N</span>nuvra</a><span>Moins d’outils. Plus de possibilités.</span><small>© ${new Date().getFullYear()} Nuvra</small></footer>`;

// ==================== VUES PUBLIQUES ====================
function homePage() {
  return `${nav()}<main><section class="hero">
    <div class="eyebrow"><span></span> LE SYSTÈME D’EXPLOITATION DE VOTRE ACTIVITÉ DIGITALE</div>
    <h1>Créez. Vendez.<br><span>Enseignez.</span><i>✳</i></h1>
    <p class="lead">Vos idées méritent mieux que dix outils déconnectés.<br>Assemblez vos pages et vos tunnels, encaissez,<br>et suivez ce qui convertit. Tout commence ici.</p>
    <div class="hero-actions"><a class="button primary" href="/register">Commencer gratuitement <span>↗</span></a><a class="button secondary" href="/login">J'ai déjà un compte <span>→</span></a></div>
    <p class="micro">Gratuit pour commencer. Pro à ${fmtCents(2900)}/mois sans engagement.</p>
  </section>
  <div class="trust"><span>LANCEMENT RAPIDE</span><b>Pages de liens.</b><b>Tunnels de vente.</b><b>Paiements intégrés.</b><span>PAIEMENTS SÉCURISÉS</span></div>
  <section id="features" class="features section">
    <div><div class="eyebrow">MOINS DE BRUIT. PLUS D’IMPACT.</div><h2>Tout ce qu’il faut.<br><span>Rien de trop.</span></h2><p>Un système pensé pour celles et ceux qui créent.<br>Pas pour collectionner les abonnements.</p><a class="text-link" href="/register">Créer mon compte gratuit ↗</a></div>
    <div class="feature-list">${[
      'Pages de liens et mini-sites personnalisables en quelques minutes',
      'Tunnels de vente complets : capture, vente, checkout, confirmation',
      'Paiements sécurisés et calcul automatique des commissions',
      'Tableau de bord unifié pour toutes vos ventes',
      'Nuvra Academy : la méthode complète pour lancer votre business',
      'Assistant IA pour générer titres, textes et idées de contenu'
    ].map((x,i)=>`<div><span>0${i+1}</span><p>${x}</p><b>↗</b></div>`).join('')}</div>
  </section>
  <section class="quote"><div class="giant-n">N</div><blockquote>« Un seul endroit pour la page,<br>le tunnel et le paiement.<br><span>Le reste, c’est du bruit.</span> »<cite>LA RÈGLE NUVRA</cite></blockquote></section>
  <section class="section steps"><div class="eyebrow">SIMPLE PAR DESIGN</div><h2>Quatre étapes.<br><span>Votre business en ligne.</span></h2><div class="step-grid">${[
    ['Créez votre compte','Inscription gratuite en 30 secondes, aucune carte bancaire requise.'],
    ['Construisez votre offre','Page de liens, tunnel de vente, ou produit numérique.'],
    ['Commencez à vendre','Paiements, commissions et accès gérés automatiquement.'],
    ['Analysez et progressez','Tableau de bord, analytics et IA pour améliorer vos conversions.']
  ].map((x,i)=>`<article><span>0${i+1}</span><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join('')}</div></section>
  <section id="pricing" class="section pricing"><div class="eyebrow">INVESTISSEZ DANS LA SUITE</div><h2>Votre prochain chapitre.<br><span>À votre rythme.</span></h2><div class="price-grid">${priceCard(false)}${priceCard(true)}</div></section>
  <section class="final-cta"><div class="eyebrow">C’EST À VOUS DE JOUER</div><h2>Votre premier business<br>part <em>aujourd’hui.</em></h2><a class="button primary" href="/register">Créer mon compte gratuit ↗</a></section></main>${footer}`;
}
function priceCard(isAcademy){return `<article class="price-card ${isAcademy?'dark':''}"><div class="eyebrow">${isAcademy?'ACADÉMIE':'NUVRA FREE'}</div><h3>${isAcademy?'La méthode':'Le starter'}</h3><div class="price">${isAcademy?fmtCents(19700):'Gratuit'}<span>${isAcademy?'achat unique, accès à vie':'pour toujours'}</span></div><ul>${(isAcademy?[
  '10 modules, du positionnement au lancement',
  'Leçons et exercices pratiques',
  'Suivi de progression personnalisé',
  'Droits de revente inclus (90% de commission)',
  'Accès à vie, mises à jour gratuites'
]:[
  'Pages de liens illimitées',
  'Tunnels de vente',
  'Jusqu\'à 10 produits numériques',
  'Paiements sécurisés',
  'Commission plateforme 5% sur les ventes'
]).map(x=>`<li>✓ &nbsp; ${x}</li>`).join('')}</ul><a class="button ${isAcademy?'primary':'black'}" href="${isAcademy?'/register':'/register'}">${isAcademy?'Rejoindre l’Académie':'Commencer gratuitement'} ↗</a></article>`}

// ==================== AUTH ====================
function loginPage() {
  if (state.user) return navigate('/dashboard'), '';
  return `${nav()}<main class="auth-main"><div class="auth-card"><h2>Connexion</h2><p class="auth-sub">Accédez à votre espace Nuvra</p>
  <form id="login-form"><label>Email<input type="email" name="email" required placeholder="vous@example.com"></label><label>Mot de passe<input type="password" name="password" required placeholder="••••••••"></label><button class="button primary full" type="submit">Se connecter ↗</button></form>
  <p class="auth-alt">Pas de compte ? <a href="/register">Inscrivez-vous gratuitement</a></p></div></main>${footer}`;
}
function registerPage() {
  if (state.user) return navigate('/dashboard'), '';
  return `${nav()}<main class="auth-main"><div class="auth-card"><h2>Créer mon espace</h2><p class="auth-sub">Commencez gratuitement, aucune carte bancaire</p>
  <form id="register-form"><label>Votre nom<input name="name" required placeholder="Jean Dupont"></label><label>Email<input type="email" name="email" required placeholder="vous@example.com"></label><label>Mot de passe (min 6 caractères)<input type="password" name="password" required minlength="6" placeholder="••••••••"></label><button class="button primary full" type="submit">Créer mon compte ↗</button></form>
  <p class="auth-alt">Déjà un compte ? <a href="/login">Connectez-vous</a></p></div></main>${footer}`;
}

// ==================== DASHBOARD ====================
async function dashboardPage() {
  if (!state.user) return navigate('/login'), '';
  let data;
  try { data = await api('/dashboard'); } catch(e) { return `<p>Erreur : ${e.message}</p>`; }
  const s = data.counts;
  return `${nav()}<main class="app-main">
  <div class="page-head"><div><div class="eyebrow"><span></span> TABLEAU DE BORD</div><h2>Bienvenue, ${escapeHtml(state.user.name)}</h2><p>Voici l'aperçu de votre activité.</p></div>
  <div class="quick-actions"><a class="button primary" href="/pages/new">+ Nouvelle page</a><a class="button secondary" href="/funnels/new">+ Nouveau tunnel</a><a class="button secondary" href="/products/new">+ Nouveau produit</a></div></div>
  <div class="stats-grid">
    <div class="stat-card"><span class="stat-label">Chiffre d'affaires net</span><b class="stat-value">${fmtCents(data.revenue.net_cents)}</b><small>Brut ${fmtCents(data.revenue.gross_cents)} • Frais ${fmtCents(data.revenue.fees_cents)}</small></div>
    <div class="stat-card"><span class="stat-label">Ventes réalisées</span><b class="stat-value">${s.sales}</b><small>${s.pending} en attente</small></div>
    <div class="stat-card"><span class="stat-label">Ressources actives</span><b class="stat-value">${s.products + s.funnels + s.pages}</b><small>${s.products} produits • ${s.pages} pages • ${s.funnels} tunnels</small></div>
    <div class="stat-card"><span class="stat-label">Gains revente Academy</span><b class="stat-value">${fmtCents(data.reseller.earnings_cents)}</b><small>${data.reseller.sales} ventes attribuées</small></div>
  </div>
  ${!data.pro_active ? `<div class="pro-banner"><div><h3>Passez à Nuvra Pro</h3><p>Supprimez les frais de plateforme de 5%, accédez à l'IA avancée et aux templates premium.</p></div><button class="button primary" id="buy-pro">Devenir Pro — ${fmtCents(2900)}/mois</button></div>` : `<div class="pro-banner active"><span>✓</span><div><h3>Compte Pro actif</h3><p>Vous ne payez pas de frais de plateforme sur vos ventes.</p></div></div>`}
  <div class="dashboard-grid">
    <section class="card"><h3>Commandes récentes</h3>${data.recent_orders.length === 0 ? '<p class="empty">Aucune commande pour l\'instant. Commencez par créer un produit ou un tunnel.</p>' : `<table class="orders-table"><thead><tr><th>Date</th><th>Produit</th><th>Montant</th><th>Statut</th></tr></thead><tbody>${data.recent_orders.map(o => `<tr><td>${new Date(o.created_at).toLocaleDateString('fr-FR')}</td><td>${escapeHtml(o.product_name || '—')}</td><td>${fmtCents(o.amount_cents)}</td><td><span class="status status-${o.status}">${o.status}</span></td></tr>`).join('')}</tbody></table>`}</section>
    ${state.user.reseller_authorized ? `<section class="card"><h3>Votre lien de revente Academy</h3><p>Partagez ce lien pour revendre Nuvra Academy et toucher vos commissions.</p><div class="reseller-link"><code>${window.location.origin}/register?ref=${state.user.reseller_code}</code><button class="button secondary" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent);this.textContent='✓ Copié'">Copier</button></div></section>` : `<section class="card"><h3>Programme de revente</h3><p>Les acheteurs de Nuvra Academy peuvent revendre la formation et toucher 90% de commission.</p><button class="button primary" id="buy-academy">Accéder à l'Academy — ${fmtCents(19700)}</button></section>`}
  </div></main>`;
}

// ==================== PAGES DE LIENS ====================
async function linkPagesView() {
  if (!state.user) return navigate('/login'), '';
  const { pages } = await api('/link-pages');
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> PAGES DE LIENS</div><h2>Vos link-in-bio</h2><p>Créez des pages publiques pour partager tous vos liens au même endroit.</p></div><a class="button primary" href="/pages/new">+ Nouvelle page</a></div>
  <div class="grid">${pages.length === 0 ? '<p class="empty">Aucune page pour l\'instant. Créez votre première page.</p>' : pages.map(p => `<div class="resource-card"><h3>${escapeHtml(p.title)}</h3><p>/l/${escapeHtml(p.slug)} • ${p.views} vues • <span class="status status-${p.status}">${p.status}</span></p><div class="card-actions"><a href="/pages/${p.id}">Éditer →</a><a href="/l/${p.slug}" target="_blank">Voir ↗</a></div></div>`).join('')}</div></main>`;
}
async function linkPageEditor(id) {
  if (!state.user) return navigate('/login'), '';
  let page = { title: 'Ma page', slug: '', bio: '', links: [], theme: { bg:'#07090d', accent:'#4d8bff', text:'#e8edf5' } };
  if (id !== 'new') { const r = await api('/link-pages'); page = r.pages.find(p => p.id == id) || page; if (typeof page.links === 'string') page.links = JSON.parse(page.links); if (typeof page.theme === 'string') page.theme = JSON.parse(page.theme); }
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> ÉDITEUR DE PAGE</div><h2>${id==='new'?'Nouvelle page':'Édition'}</h2></div><button class="button primary" id="save-page">Enregistrer</button></div>
  <div class="editor-layout"><form id="page-form" class="card">
    <label>Titre de la page<input name="title" value="${escapeHtml(page.title)}"></label>
    <label>URL (slug)<input name="slug" value="${escapeHtml(page.slug)}" placeholder="ma-page"></label>
    <label>Biographie<textarea name="bio" rows="3">${escapeHtml(page.bio)}</textarea></label>
    <div class="row"><label>Fond<input type="color" name="bg" value="${page.theme.bg}"></label><label>Accent<input type="color" name="accent" value="${page.theme.accent}"></label><label>Texte<input type="color" name="text" value="${page.theme.text}"></label></div>
    <h4>Liens</h4><div id="links-list">${page.links.map((l,i)=>`<div class="link-row"><input placeholder="Libellé" name="link-label-${i}" value="${escapeHtml(l.label||'')}"><input placeholder="https://..." name="link-url-${i}" value="${escapeHtml(l.url||'')}"><button type="button" class="remove-link" data-i="${i}">×</button></div>`).join('')}</div>
    <button type="button" class="button secondary" id="add-link">+ Ajouter un lien</button>
    <label class="checkbox"><input type="checkbox" name="published" ${page.status==='published'?'checked':''}> Publier la page</label>
  </form><div class="preview-frame"><iframe id="page-preview" srcdoc="${escapeHtml(renderLinkPreview(page))}"></iframe></div></div></main>`;
}
function renderLinkPreview(page) {
  const links = Array.isArray(page.links) ? page.links : [];
  const theme = page.theme || {bg:'#07090d',accent:'#4d8bff',text:'#e8edf5'};
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:${theme.bg};color:${theme.text};min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 20px}h1{font-size:22px;margin-bottom:8px}p{color:#b3bdd1;text-align:center;margin-bottom:32px;max-width:400px}.links{width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px}.link{padding:14px;border:1px solid ${theme.accent}50;border-radius:8px;color:${theme.text};text-align:center;text-decoration:none;font-weight:600}.avatar{width:80px;height:80px;border-radius:50%;background:${theme.accent};margin-bottom:16px}</style></head><body><div class="avatar"></div><h1>${escapeHtml(page.title||'Votre nom')}</h1>${page.bio?`<p>${escapeHtml(page.bio)}</p>`:''}<div class="links">${links.map(l=>`<div class="link">${escapeHtml(l.label||'Lien')}</div>`).join('')}</div></body></html>`;
}

// ==================== TUNNELS ====================
async function funnelsView() {
  if (!state.user) return navigate('/login'), '';
  const { funnels } = await api('/funnels');
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> TUNNELS DE VENTE</div><h2>Vos funnels</h2><p>Construisez des tunnels de vente complets.</p></div><a class="button primary" href="/funnels/new">+ Nouveau tunnel</a></div>
  <div class="grid">${funnels.length === 0 ? '<p class="empty">Aucun tunnel pour l\'instant.</p>' : funnels.map(f => `<div class="resource-card"><h3>${escapeHtml(f.name)}</h3><p>${f.data?.steps?.length || 0} étape(s) • <span class="status status-${f.status}">${f.status}</span></p><div class="card-actions"><a href="/funnels/${f.id}">Éditer →</a></div></div>`).join('')}</div></main>`;
}
async function funnelEditor(id) {
  if (!state.user) return navigate('/login'), '';
  let funnel = { name: 'Mon tunnel', data: { steps: [{type:'sales', title:'Page de vente', content:{headline:'Votre titre ici', subtitle:'Description', buttonText:'Acheter'}}] }, status:'draft' };
  if (id !== 'new') { const r = await api('/funnels'); funnel = r.funnels.find(f => f.id == id) || funnel; }
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> ÉDITEUR DE TUNNEL</div><h2>${escapeHtml(funnel.name)}</h2></div><button class="button primary" id="save-funnel">Enregistrer</button></div>
  <div class="builder-layout">
  <div class="card"><label>Nom du tunnel<input name="name" value="${escapeHtml(funnel.name)}"></label><h4>Étapes</h4><div id="steps-list">${(funnel.data.steps||[]).map((s,i)=>`<div class="step-item"><b>Étape ${i+1}</b> — ${escapeHtml(s.title||s.type)}<a href="#" class="edit-step" data-i="${i}">Éditer</a></div>`).join('')}</div><button type="button" class="button secondary" id="add-step">+ Ajouter une étape</button><label class="checkbox"><input type="checkbox" name="published" ${funnel.status==='published'?'checked':''}> Publier le tunnel</label></div>
  <div class="card funnel-preview"><h3>Aperçu</h3><h1 style="font-size:42px;margin:20px 0">${escapeHtml(funnel.data.steps?.[0]?.content?.headline || 'Votre titre')}</h1><p style="color:var(--muted);margin-bottom:20px">${escapeHtml(funnel.data.steps?.[0]?.content?.subtitle || '')}</p><button class="button primary">${escapeHtml(funnel.data.steps?.[0]?.content?.buttonText || 'Acheter')}</button></div>
  </div></main>`;
}

// ==================== PRODUITS ====================
async function productsView() {
  if (!state.user) return navigate('/login'), '';
  const { products } = await api('/products');
  const myProducts = products.filter(p => p.user_id === state.user.id && !p.is_nuvra_pro && !p.is_nuvra_academy);
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> PRODUITS NUMÉRIQUES</div><h2>Vos produits</h2><p>Vendez des PDF, formations, templates et ressources.</p></div><a class="button primary" href="/products/new">+ Nouveau produit</a></div>
  <div class="grid">${myProducts.length === 0 ? '<p class="empty">Aucun produit. Créez votre premier produit numérique.</p>' : myProducts.map(p => `<div class="resource-card"><h3>${escapeHtml(p.name)}</h3><p>${fmtCents(p.price_cents)} • <span class="status status-${p.status}">${p.status}</span></p><div class="card-actions"><a href="/products/${p.id}">Éditer →</a></div></div>`).join('')}</div></main>`;
}
function productEditor(id) {
  if (!state.user) return navigate('/login'), '';
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> PRODUIT</div><h2>${id==='new'?'Nouveau produit':'Édition'}</h2></div></div>
  <div class="card form-card"><form id="product-form"><label>Nom du produit<input name="name" required placeholder="Ex : Guide PDF pour lancer son business"></label><label>Description<textarea name="description" rows="4" placeholder="Décrivez ce que votre client obtient..."></textarea></label><label>Prix (en centimes, ex: 2900 = $29)<input type="number" name="price_cents" min="0" value="2900"></label><label>Type<select name="type"><option value="download">Fichier téléchargeable</option><option value="course">Formation</option><option value="template">Template</option></select></label><label>Fichier (PDF, zip, etc.)<input type="file" name="file" accept=".pdf,.zip,.mp4,.mp3"></label><button class="button primary" type="submit">Enregistrer le produit ↗</button></form></div></main>`;
}

// ==================== ACADEMY ====================
async function academyView() {
  if (!state.user) return navigate('/login'), '';
  if (!state.user.academy_access) return `${nav()}<main class="app-main"><div class="card locked-card"><h2>🔒 Accès Academy requis</h2><p>La Nuvra Academy est une formation de 10 modules pour lancer et développer votre business digital.</p><button class="button primary" id="buy-academy">Acheter l'Academy — ${fmtCents(19700)}</button><p class="small">Accès à vie • Droits de revente inclus (90% de commission)</p></div></main>`;
  let data; try { data = await api('/academy/modules'); } catch(e) { return `<p>Erreur</p>`; }
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> NUVRA ACADEMY</div><h2>Votre formation</h2><p>Progression : ${data.progress.completed}/${data.progress.total} leçons (${data.progress.percent}%)</p></div></div>
  <div class="progress-bar"><div class="progress-fill" style="width:${data.progress.percent}%"></div></div>
  <div class="modules-list">${data.modules.map(m => `<section class="module-card"><h3><span>${String(m.position+1).padStart(2,'0')}</span> ${escapeHtml(m.title)}</h3><div class="lessons-list">${m.lessons.map(l=>`<div class="lesson-row"><span class="${l.completed?'done':''}">${l.completed?'✓':'○'}</span><span>${escapeHtml(l.title)}</span><button class="lesson-toggle" data-lesson="${l.id}" data-done="${l.completed?1:0}">${l.completed?'Marquer non lu':'Marquer terminé'}</button></div>`).join('')}</div></section>`).join('')}</div></main>`;
}

// ==================== IA ====================
function aiView() {
  if (!state.user) return navigate('/login'), '';
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> ASSISTANT IA NUVRA</div><h2>Votre conseiller business</h2><p>Idées, copywriting, tunnels, contenu marketing.</p></div></div>
  <div class="chat-card card"><div id="chat-messages"><div class="msg assistant">Bonjour ! Je peux vous aider à :<ul><li>Trouver des idées d'offre</li><li>Rédiger des titres et textes de vente</li><li>Structurer un tunnel</li><li>Planifier votre contenu réseaux sociaux</li><li>Analyser vos performances</li></ul>Quelle est votre question ?</div></div>
  <form id="chat-form"><input name="message" placeholder="Posez votre question..." required autocomplete="off"><button class="button primary" type="submit">Envoyer ↗</button></form></div></main>`;
}

// ==================== ADMIN ====================
async function adminView() {
  if (!state.user) return navigate('/login'), '';
  if (state.user.role !== 'admin') return navigate('/dashboard'), '';
  const { stats } = await api('/admin/stats');
  const { users } = await api('/admin/users');
  const { settings } = await api('/admin/settings');
  return `${nav()}<main class="app-main"><div class="page-head"><div><div class="eyebrow"><span></span> ESPACE ADMINISTRATEUR</div><h2>Pilotage de la plateforme</h2></div></div>
  <div class="stats-grid">
    <div class="stat-card"><span class="stat-label">Utilisateurs totaux</span><b>${stats.users}</b><small>${stats.pro_users} Pro • ${stats.academy_users} Academy</small></div>
    <div class="stat-card"><span class="stat-label">Commandes</span><b>${stats.orders}</b></div>
    <div class="stat-card"><span class="stat-label">Revenu total</span><b>${fmtCents(stats.revenue_cents)}</b></div>
    <div class="stat-card"><span class="stat-label">Frais plateforme encaissés</span><b>${fmtCents(stats.platform_fees_cents)}</b></div>
  </div>
  <div class="card"><h3>Configuration commerciale</h3><form id="settings-form" class="settings-grid">
    <label>Frais plateforme (%)<input name="platform_fee_rate" type="number" step="0.01" value="${settings.platform_fee_rate}"></label>
    <label>Commission Academy Nuvra (%)<input name="academy_fee_rate" type="number" step="0.01" value="${settings.academy_fee_rate}"></label>
    <label>Prix Pro (cents)<input name="pro_price_cents" type="number" value="${settings.pro_price_cents}"></label>
    <label>Prix Academy (cents)<input name="academy_price_cents" type="number" value="${settings.academy_price_cents}"></label>
    <label>Commission revendeur (%)<input name="reseller_commission_rate" type="number" step="0.01" value="${settings.reseller_commission_rate}"></label>
    <button class="button primary" type="submit">Enregistrer la configuration</button>
  </form></div>
  <div class="card"><h3>Utilisateurs (${users.length})</h3><div class="users-list">${users.slice(0,50).map(u => `<div class="user-row"><span>${escapeHtml(u.email)}</span><span>${escapeHtml(u.name)}</span><span class="role role-${u.role}">${u.role}</span><span>${u.pro_active?'✓ Pro':''} ${u.academy_access?'✓ Academy':''}</span></div>`).join('')}</div></div></main>`;
}

function pricingPage() {
  return `${nav()}<main class="section pricing">${nav() && ''}<div class="eyebrow" style="margin-top:60px"><span></span> TARIFS</div><h1 style="font-size:56px">Choisissez votre formule.</h1><div class="price-grid" style="margin-top:40px">${priceCard(false)}<article class="price-card"><div class="eyebrow">NUVRA PRO</div><h3>Toutes les fonctionnalités</h3><div class="price">${fmtCents(2900)}<span>par mois, sans engagement</span></div><ul>${[
    'Tout ce qui est inclus dans Free',
    '0% de frais de plateforme sur vos ventes',
    'IA avancée illimitée',
    'Templates premium',
    'Analyses avancées et conversions',
    'Support prioritaire'
  ].map(x=>`<li>✓ &nbsp; ${x}</li>`).join('')}</ul><button class="button primary full" id="buy-pro">Devenir Pro ↗</button></article>${priceCard(true)}</div></main>${footer}`;
}

// ==================== RENDER PRINCIPAL ====================
async function render() {
  const app = document.getElementById('app');
  const route = state.route;
  let html;
  try {
    if (route === '/login') html = loginPage();
    else if (route === '/register') html = registerPage();
    else if (route === '/pricing') html = pricingPage();
    else if (route === '/academy-landing') html = homePage().replace(/Accueil/g,'Academy'); // page publique academy simplifiée
    else if (route === '/dashboard') html = await dashboardPage();
    else if (route === '/pages') html = await linkPagesView();
    else if (route === '/pages/new' || route.match(/^\/pages\/\d+$/)) html = await linkPageEditor(route.split('/').pop());
    else if (route === '/funnels') html = await funnelsView();
    else if (route === '/funnels/new' || route.match(/^\/funnels\/\d+$/)) html = await funnelEditor(route.split('/').pop());
    else if (route === '/products') html = await productsView();
    else if (route === '/products/new' || route.match(/^\/products\/\d+$/)) html = productEditor(route.split('/').pop());
    else if (route === '/academy') html = await academyView();
    else if (route === '/ai') html = aiView();
    else if (route === '/admin') html = await adminView();
    else html = homePage();
  } catch(e) { html = `<main class="app-main"><div class="card"><h2>Erreur</h2><p>${escapeHtml(e.message)}</p><a class="button secondary" href="/">Retour à l'accueil</a></div></main>`; }
  app.innerHTML = html;
  attachEvents();
}

// ==================== GESTIONNAIRES D'ÉVÉNEMENTS ====================
function attachEvents() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.onclick = async () => { await api('/auth/logout', { method: 'POST' }); state.user = null; navigate('/'); };

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(loginForm); try { const d = await api('/auth/login', { method: 'POST', body: Object.fromEntries(fd) }); state.user = d.user; state.pro_active = d.user.pro_active; navigate('/dashboard'); } catch(e) { alert(e.message); } };

  const regForm = document.getElementById('register-form');
  if (regForm) regForm.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(regForm); try { const d = await api('/auth/register', { method: 'POST', body: Object.fromEntries(fd) }); state.user = d.user; state.pro_active = false; navigate('/dashboard'); } catch(e) { alert(e.message); } };

  const buyPro = document.getElementById('buy-pro');
  if (buyPro) buyPro.onclick = async () => { const pro = await (await fetch(API+'/products')).json().then(r=>r.products.find(p=>p.is_nuvra_pro)); const res = await api('/checkout', { method:'POST', body: { product_id: pro.id } }); window.location.href = res.url; };
  const buyAca = document.getElementById('buy-academy');
  if (buyAca) buyAca.onclick = async () => { const aca = await (await fetch(API+'/products')).json().then(r=>r.products.find(p=>p.is_nuvra_academy)); const res = await api('/checkout', { method:'POST', body: { product_id: aca.id } }); window.location.href = res.url; };

  // Page editor
  const pageForm = document.getElementById('page-form');
  if (pageForm) {
    const updatePreview = () => {
      const fd = new FormData(pageForm);
      const links = [];
      document.querySelectorAll('.link-row').forEach(row => {
        const label = row.querySelector('input[name^="link-label"]').value;
        const url = row.querySelector('input[name^="link-url"]').value;
        if (label || url) links.push({ label, url });
      });
      const page = { title: fd.get('title'), bio: fd.get('bio'), links, theme: { bg: fd.get('bg'), accent: fd.get('accent'), text: fd.get('text') } };
      document.getElementById('page-preview').srcdoc = renderLinkPreview(page);
    };
    pageForm.addEventListener('input', updatePreview);
    document.getElementById('add-link')?.addEventListener('click', () => {
      const list = document.getElementById('links-list');
      const i = list.children.length;
      const div = document.createElement('div'); div.className='link-row'; div.innerHTML = `<input placeholder="Libellé" name="link-label-${i}"><input placeholder="https://..." name="link-url-${i}"><button type="button" class="remove-link">×</button>`; list.appendChild(div); div.querySelector('.remove-link').onclick = () => { div.remove(); updatePreview(); }; pageForm.addEventListener('input', updatePreview, {once:true});
    });
    document.querySelectorAll('.remove-link').forEach(b => b.onclick = () => { b.parentElement.remove(); updatePreview(); });
    document.getElementById('save-page').onclick = async (e) => {
      e.preventDefault();
      const fd = new FormData(pageForm);
      const links = [];
      document.querySelectorAll('.link-row').forEach(row => { links.push({ label: row.querySelector('input[name^="link-label"]').value, url: row.querySelector('input[name^="link-url"]').value }); });
      const body = { title: fd.get('title'), slug: fd.get('slug'), bio: fd.get('bio'), theme: { bg: fd.get('bg'), accent: fd.get('accent'), text: fd.get('text') }, links, status: fd.get('published') ? 'published' : 'draft' };
      const id = state.route.split('/').pop();
      try { if (id === 'new') await api('/link-pages', { method: 'POST', body }); else await api(`/link-pages/${id}`, { method: 'PUT', body }); alert('Page enregistrée !'); navigate('/pages'); } catch(e) { alert(e.message); }
    };
  }

  // Funnel editor
  const saveFunnel = document.getElementById('save-funnel');
  if (saveFunnel) saveFunnel.onclick = async (e) => {
    e.preventDefault();
    const name = document.querySelector('input[name="name"]').value;
    const published = document.querySelector('input[name="published"]').checked;
    const id = state.route.split('/').pop();
    const data = { steps: [{type:'sales', title:'Page de vente', content:{headline:'Aperçu',subtitle:'',buttonText:'Acheter'}}] };
    try { if (id === 'new') await api('/funnels', { method: 'POST', body: { name } }); else await api(`/funnels/${id}`, { method: 'PUT', body: { name, data, status: published?'published':'draft' } }); alert('Tunnel enregistré !'); navigate('/funnels'); } catch(e) { alert(e.message); }
  };
  if (document.getElementById('add-step')) document.getElementById('add-step').onclick = () => alert('Édition détaillée des étapes à venir — la sauvegarde fonctionne déjà.');

  // Product form
  const productForm = document.getElementById('product-form');
  if (productForm) productForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(productForm);
    const body = Object.fromEntries(fd);
    try { await api('/products', { method: 'POST', body }); alert('Produit créé !'); navigate('/products'); } catch(err) { alert(err.message); }
  };

  // Academy lessons
  document.querySelectorAll('.lesson-toggle').forEach(btn => btn.onclick = async () => {
    const lid = btn.dataset.lesson;
    const done = btn.dataset.done === '1' ? 0 : 1;
    await api(`/academy/lessons/${lid}/complete`, { method: 'POST', body: { completed: done } });
    render();
  });

  // Chat IA
  const chatForm = document.getElementById('chat-form');
  if (chatForm) chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const msg = chatForm.elements.message.value;
    const convId = chatForm.dataset.conv;
    const msgDiv = document.createElement('div'); msgDiv.className='msg user'; msgDiv.textContent=msg; document.getElementById('chat-messages').appendChild(msgDiv);
    chatForm.elements.message.value='';
    const loading = document.createElement('div'); loading.className='msg assistant'; loading.textContent='...'; document.getElementById('chat-messages').appendChild(loading);
    try { const res = await api('/ai/chat', { method: 'POST', body: { message: msg, conversation_id: convId ? parseInt(convId) : undefined } }); loading.remove(); chatForm.dataset.conv = res.conversation_id; const rep = document.createElement('div'); rep.className='msg assistant'; rep.textContent = res.reply; document.getElementById('chat-messages').appendChild(rep); rep.scrollIntoView({behavior:'smooth'}); } catch(err) { loading.textContent = 'Erreur: ' + err.message; }
  };

  // Settings admin
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) settingsForm.onsubmit = async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(settingsForm)); await api('/admin/settings', { method: 'POST', body: fd }); alert('Configuration sauvegardée !'); };
}

// Démarrage
loadUser().then(render);
