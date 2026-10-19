# Nuvra 2.0 — Plateforme tout-en-un pour créateurs

Nuvra est un SaaS qui permet de créer, lancer et développer son business en ligne :
pages de liens, tunnels de vente, produits numériques, paiements, formations,
IA assistant, gestion des commissions et programme de revente.

## Stack technique

- **Frontend** : Vanilla JS (SPA) + Vite, CSS thème sombre bleu premium
- **Backend** : Node.js + Express
- **Base de données** : SQLite (`better-sqlite3`) — zéro infrastructure requise
- **Paiements** : Stripe (optionnel, mode sandbox inclus pour tests sans clé)
- **Auth** : Sessions HTTPOnly, bcrypt pour les mots de passe
- **Uploads** : Multer pour les fichiers produits, accès protégé

## Installation

```sh
npm install
cp .env.example .env
# Éditez .env selon vos besoins (JWT_SECRET, clés Stripe...)
```

## Lancer en développement

Deux serveurs sont nécessaires :

1. **Backend API** sur le port 3001 : `node server.js`
2. **Frontend Vite** sur le port 5173 (avec proxy automatique vers l'API) : `npm run dev:client`

Pour la production :
```sh
npm run build
NODE_ENV=production node server.js
```

En mode développement, le frontend est accessible à l'adresse **http://localhost:5173**

## Compte par défaut

Au premier lancement, un compte administrateur est créé automatiquement :
- **Email** : `admin@nuvra.app`
- **Mot de passe** : `admin123`

Pensez à le supprimer ou changer le mot de passe avant toute mise en production.

## Fonctionnalités implémentées

### 🔐 Authentification & comptes
- Inscription, connexion, déconnexion
- Sessions HTTPOnly (sécurisées)
- Profil utilisateur (nom, marque, bio, avatar)
- Protection des routes privées (vérification serveur)
- Rôles `user` / `admin` avec permissions
- Séparation stricte des données entre utilisateurs

### 📊 Tableau de bord
- Chiffre d'affaires brut, net, frais et remboursements
- Compteurs de ventes, produits, tunnels, pages
- Revenus de revente Academy
- Liste des commandes récentes
- Lien de parrainage/revente pour les affiliés
- États vides utiles pour nouveaux utilisateurs
- Bannière Pro avec appel à l'action

### 🔗 Pages de liens (link-in-bio)
- Création d'URL publiques uniques (`/l/votre-slug`)
- Personnalisation complète (titre, bio, couleurs, liens)
- Ajout/suppression/modification des liens
- Prévisualisation en direct dans l'éditeur
- Publication/dépublication
- Compteur de vues
- Pages publiques rapides et optimisées mobile

### 📈 Tunnels de vente
- Création de tunnels personnalisés
- Étapes modifiables (page de vente, capture, checkout, confirmation)
- Sauvegarde persistée en base
- Publication / brouillon
- Association avec des produits

### 📦 Produits numériques
- Création de produits (PDF, téléchargements, formations, templates)
- Gestion du prix, description, statut
- Upload de fichiers (accès protégé aux acheteurs)
- Produits système Nuvra (Pro et Academy) intégrés

### 💳 Paiements & commandes
- Intégration Stripe (checkout sessions, webhooks vérifiés par signature)
- Mode sandbox sans clé Stripe : commandes automatiquement marquées payées pour les tests
- Historique complet des commandes
- Remboursements (annule les commissions associées et retire les accès)
- Vérification idempotente des paiements (unicité `stripe_checkout_session`)
- Protection contre les doubles facturations
- Livraison automatique des accès après paiement confirmé

### 💰 Commissions & modèle économique
Les règles de commission sont configurables depuis l'espace admin :

| Règle | Valeur par défaut |
|-------|-------------------|
| Frais plateforme (utilisateur gratuit) | 5% sur les ventes éligibles |
| Commission Nuvra sur Academy | 10% par vente |
| Commission revendeur Academy | 90% reversée au revendeur |
| Prix Nuvra Pro | $29 / mois |
| Prix Nuvra Academy | $197 achat unique |

- 0% de frais plateforme pour les utilisateurs Pro actifs
- Non double application des commissions
- Traçabilité complète (commande source, taux, base de calcul, statut)
- Annulation des commissions en cas de remboursement
- Vérification Pro active par date d'expiration

### ⭐ Nuvra Pro
- Souscription mensuelle
- Activation/désactivation automatique par webhook/paiement
- Annulation et expiration cohérentes
- Avantages implémentés : 0% frais de plateforme
- Prix configurable côté admin

### 🎓 Nuvra Academy
- Espace de formation réservé aux acheteurs
- 10 modules pré-chargés avec leçons de contenu provisoire
- Suivi de progression par utilisateur (leçons terminées)
- Dernier accès et reprise de la formation
- Accès vérifié côté serveur (impossible d'accéder sans achat)
- Droits de revente automatiquement activés pour les acheteurs

### 🤝 Programme de revente Academy
- Attribution des acheteurs via un code/lien unique par revendeur
- Traçabilité de chaque vente parrainée
- Calcul automatique des commissions revendeur
- Protection contre l'auto-parrainage
- Tableau de bord des gains
- Les taux sont configurables

### 🤖 Assistant IA Nuvra
- Interface conversationnelle dans l'app
- Historique des conversations par utilisateur
- Réponses contextualisées métier (offres, copywriting, tunnels, prix)
- Architecture prête pour brancher n'importe quel LLM (OpenAI, Anthropic...) en ajoutant simplement la clé API
- Note : les clés API IA ne sont pas incluses — à connecter dans les variables d'environnement pour la production

### 🔧 Espace administrateur
- Vue globale (utilisateurs, Pro, Academy, CA, frais de plateforme)
- Liste des utilisateurs avec rôles et statuts
- Configuration commerciale modifiable (taux de commission, prix)
- Toutes les routes admin sont protégées côté serveur

## Sécurité

- Mots de passe hashés avec bcrypt
- Sessions HTTPOnly, non exposées au JavaScript client
- Vérification systématique des droits côté serveur
- Séparation des données : un utilisateur ne peut jamais accéder aux ressources d'un autre
- Webhooks Stripe vérifiés par signature
- Pas de secrets ou clés commités dans le dépôt
- Validation des entrées
- Accès aux fichiers uploadés protégé (uniquement propriétaire et acheteurs)
- Protection CSRF basique par cookie sameSite

## Variables d'environnement

Copiez `.env.example` en `.env` :

```
PORT=3001                         # Port backend API
JWT_SECRET=...                    # Secret pour les sessions (CHANGEZ EN PROD)
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_...     # Optionnel, paiements
STRIPE_WEBHOOK_SECRET=whsec_...   # Optionnel, webhooks
APP_URL=http://localhost:5173     # URL publique
UPLOAD_DIR=./data/uploads
DB_PATH=./data/nuvra.db
```

## Limitations connues & éléments à configurer

1. **Paiements réels** : nécessite des clés Stripe valides. Le mode sandbox fonctionne sans clé pour tous les tests.
2. **IA générative** : les réponses sont actuellement des templates métier pré-définis. Pour connecter un LLM, ajoutez votre clé API OpenAI/Anthropic et modifiez la route `/api/ai/chat`.
3. **Email marketing / automatisations** : structure de données en place mais les envois nécessitent un provider (Sendgrid/Mailgun/Resend).
4. **Analytics avancées** : les événements de clic et de vue sont stockés, les tableaux de bord détaillés sont à compléter.
5. **Contenu Academy** : les 10 modules contiennent du contenu provisoire. Les vidéos et ressources définitives sont à uploader.
6. **E-mails transactionnels** : vérification d'email et réinitialisation de mot de passe nécessitent un provider email.

## Commandes utiles

```sh
npm run dev:client   # Lance le frontend Vite
node server.js       # Lance le backend API
npm run build        # Build production du frontend
npm test             # Lance les tests (vitest)
```

## Conformité juridique

- Les pages de mentions légales, CGV et politique de confidentialité sont à ajouter selon le pays d'exploitation.
- Les pourcentages de commission revendeur sont configurables mais doivent être validés contractuellement.
- La délivrance de reçus fiscaux n'est pas implémentée.
- RGDP : consentement cookies et gestion des données personnelles à compléter.

## Déploiement

L'application est compatible avec tout hébergeur Node.js (Railway, Render, Fly.io, VPS...). Le fichier SQLite peut être remplacé par PostgreSQL/MySQL avec peu de modifications grâce à l'abstraction `better-sqlite3` — nous recommandons PostgreSQL pour la production.

Ne jamais commituer le fichier `.env` ni la base de données de production.
