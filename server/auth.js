import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SESSION_DAYS = 30;

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

export function getUserFromToken(token) {
  if (!token) return null;
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(token);
    if (!session) return null;
    if (new Date(session.expires_at) <= new Date()) return null;
    const user = db.prepare('SELECT id, email, name, brand_name, avatar_url, bio, role, pro_active, pro_expires_at, academy_access, reseller_authorized, reseller_code FROM users WHERE id = ?').get(session.user_id);
    return user;
  } catch (e) { console.error('getUserFromToken error:', e); return null; }
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

export function authRequired(req, res, next) {
  const token = req.cookies?.nuvra_token || req.headers.authorization?.replace('Bearer ', '');
  req.user = getUserFromToken(token);
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  next();
}

export function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis' });
  next();
}

export function signJwt(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJwt(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// Génération d'un code revendeur unique
export function generateResellerCode() {
  return 'RESEL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Vérifie si un utilisateur a Pro actif
export function hasActivePro(user) {
  if (!user.pro_active) return false;
  if (!user.pro_expires_at) return true;
  return new Date(user.pro_expires_at) > new Date();
}
