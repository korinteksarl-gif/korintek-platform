# KORINTEK BUSINESS PORTAL
### Module actif : KORINTEK QUEUE MANAGER

Gestion numérique de la file d'attente des candidats au centre d'examen KORINTEK
(Pearson VUE / PSI). Première brique du futur portail KORINTEK (Queue Manager →
Billing → CRM → Training).

---

## 1. Architecture

```
korintek-platform/
├── apps/
│   └── queue-manager/
│       ├── backend/    Node.js + Express + Prisma + PostgreSQL
│       └── frontend/   React + Vite + Tailwind CSS
├── packages/
│   ├── ui-components/  Design system partagé (à enrichir)
│   ├── authentication/ Vérification JWT KORINTEK ID partagée
│   ├── database/       Conventions Prisma communes
│   └── shared-utils/   Fonctions utilitaires communes
├── documentation/
└── deployment/
    └── render.yaml
```

Chaque `app` est déployée comme un service Render indépendant. Les `packages/` sont
partagés par import relatif et deviendront un vrai design system npm interne lorsque
le nombre de modules le justifiera.

## 2. Authentification — Microsoft Entra ID (Office 365 SSO)

Le Queue Manager utilise le même mécanisme que facturation.korintek.com : connexion
via le bouton "Se connecter avec Microsoft 365", pas de mot de passe local à gérer.

**App registration réutilisée** : "KORINTEK Facturation" dans le portail Azure
(Client ID `dca354c3-b920-41af-aa90-abf4a31969d4`, Tenant `9cdff590-bed7-4a7a-a6c4-6aadd7edf896`).

**Étape obligatoire côté Azure avant le premier test** : dans cette app registration →
**Authentication** → **Redirect URIs** → ajouter :
```
https://korintek-queue-api.onrender.com/api/v1/auth/microsoft/callback
```
(remplacer par l'URL réelle du backend si différente, ou par `https://api.queue.korintek.com/...`
si un domaine personnalisé est configuré plus tard).

**Client Secret** : si l'app registration n'a pas déjà un secret valide et non expiré,
en créer un nouveau (**Certificates & secrets** → **New client secret**) et le renseigner
dans `AZURE_CLIENT_SECRET` sur Render (jamais dans le repo Git).

**Attribution des rôles** : un compte Office 365 qui se connecte pour la première fois
est créé automatiquement avec le rôle `PENDING` (aucun accès). Un `SUPER_ADMIN` doit
ensuite lui attribuer un rôle réel via l'écran **"Utilisateurs"** (visible dans le
Dashboard, lien en haut à droite pour les SUPER_ADMIN). Voir section 2 "Rôles KORINTEK ID"
ci-dessous pour la liste des rôles disponibles.

Note : l'ancien login par email/mot de passe (`POST /api/v1/auth/login`) reste actif
côté backend pour compatibilité (utile par ex. pour un compte de secours local), mais
n'est plus exposé dans l'interface — celle-ci ne propose que le SSO Microsoft.

## 3. Rôles KORINTEK ID

| Rôle | Accès |
|---|---|
| PENDING | Aucun — compte créé automatiquement via SSO, en attente d'attribution par un SUPER_ADMIN |
| SUPER_ADMIN | Tout, y compris suppression, audit et gestion des utilisateurs |
| ADMIN | Gestion candidats, file, import, audit |
| RECEPTION | Ajout/modification candidats, import, appel de la file |
| EXAM_CENTER_AGENT | Mode agent d'accueil (appeler/terminer/absent) uniquement |
| FINANCE | Lecture dashboard (préparation module Billing) |
| TRAINER | Réservé aux futurs modules (Training) |

## 3. Installation locale

Prérequis : Node.js 20+, PostgreSQL 14+ (local ou distant), npm.

### Backend

```bash
cd apps/queue-manager/backend
cp .env.example .env
# Renseigner DATABASE_URL, JWT_SECRET, SEED_ADMIN_* dans .env
npm install
npm run prisma:migrate:dev   # crée les tables
npm run prisma:seed          # crée le compte administrateur initial
npm run dev                  # démarre l'API sur http://localhost:4000
```

### Frontend

```bash
cd apps/queue-manager/frontend
cp .env.example .env
npm install
npm run dev                  # démarre l'interface sur http://localhost:5173
```

Interfaces disponibles en local :
- `http://localhost:5173/login` — connexion
- `http://localhost:5173/dashboard` — tableau de bord admin/réception
- `http://localhost:5173/agent` — mode agent d'accueil (tablette)
- `http://localhost:5173/display` — écran public salle d'attente (à ouvrir sur la TV)

## 4. Compte administrateur initial

Créé par `npm run prisma:seed` à partir des variables `SEED_ADMIN_EMAIL` et
`SEED_ADMIN_PASSWORD` du fichier `.env`. **Changer le mot de passe dès la première
connexion** (le changement de mot de passe self-service n'est pas encore implémenté
en V1 — le SUPER_ADMIN peut recréer un utilisateur via Prisma Studio en attendant).

## 5. API — endpoints principaux

```
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/candidates?date=YYYY-MM-DD&statut=&search=
GET    /api/v1/candidates/stats?date=YYYY-MM-DD
POST   /api/v1/candidates
PUT    /api/v1/candidates/:id
DELETE /api/v1/candidates/:id

GET    /api/v1/queue/current        (public, sans authentification — pour /display)
POST   /api/v1/queue/next
POST   /api/v1/queue/:id/complete
POST   /api/v1/queue/:id/absent

POST   /api/v1/import/candidates    (multipart/form-data, champs "file" + "datePassage")

GET    /api/v1/audit?limit=100      (ADMIN / SUPER_ADMIN uniquement)
```

## 6. Déploiement — 100% gratuit, sans date d'expiration

**Pourquoi Neon.tech pour la base de données et pas Render Postgres ?**
Render Postgres gratuit expire 30 jours après création (données supprimées 14 jours
après, sans grâce possible). Neon.tech offre un tier gratuit **permanent**, sans carte
bancaire — c'est déjà la solution utilisée pour `facturation.korintek.com`. On la
réutilise ici pour ne jamais perdre les données des candidats.

### 6.1 Créer la base sur Neon.tech

1. Va sur [neon.tech](https://neon.tech) → connecte-toi (ou crée un compte gratuit).
2. **New Project** → nomme-le `korintek-queue` → choisis une région proche (Europe).
3. Neon affiche une **connection string** du type
   `postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/korintek_queue?sslmode=require`
   → copie-la, tu en auras besoin à l'étape 6.3.

### 6.2 Déployer sur Render

1. Pousse ce repository sur GitHub (voir section upload plus haut si pas de Git local).
2. Sur Render : **New → Blueprint**, sélectionne le repository. Render lit
   `deployment/render.yaml` et propose de créer automatiquement :
   - le service backend `korintek-queue-api` (build + migrations Prisma automatiques),
   - le service frontend statique `korintek-queue-frontend`.
3. Clique **Apply** / **Create**.

### 6.3 Renseigner les variables manquantes

Sur le service `korintek-queue-api` → onglet **Environment** :
- `DATABASE_URL` → colle la connection string Neon copiée à l'étape 6.1.
- `SEED_ADMIN_PASSWORD` → renseigne un mot de passe fort pour le compte administrateur.
→ **Save Changes** (redéploiement automatique).

### 6.4 Créer le compte administrateur

Service `korintek-queue-api` → onglet **Shell** → tape :
```bash
npm run prisma:seed
```

### 6.5 Connecter le frontend au backend

Copie l'URL réelle du service `korintek-queue-api` (visible en haut de sa page), puis
sur le service `korintek-queue-frontend` → **Environment** → renseigne `VITE_API_URL`
avec `https://<url-du-backend>/api/v1` → **Save Changes**.

### 6.6 Garder le backend éveillé (gratuit, optionnel mais recommandé)

Le plan gratuit Render met le backend en veille après 15 min sans requête. Sans rien
faire, le premier candidat de la matinée subit un délai de 30-60 secondes le temps
que l'API se réveille. Pour l'éviter, sans dépenser un centime :

1. Va sur [cron-job.org](https://cron-job.org) → crée un compte gratuit.
2. **Create cronjob** → URL : `https://<url-du-backend>/health` → intervalle : toutes
   les 10 minutes → limite si possible la plage horaire aux heures d'ouverture du
   centre d'examen (ex: 7h-18h) pour rester large et ne pas gaspiller les 750h/mois
   offertes par Render.
3. Le endpoint `/health` existe déjà dans le backend, aucune modification de code requise.

### 6.7 Limites à connaître sur le long terme (gratuit)

| Composant | Limite du plan gratuit |
|---|---|
| Neon.tech (base) | 0.5 GB de stockage — largement suffisant pour un centre d'examen, pas de date d'expiration |
| Render backend | 750h/mois offertes (un seul service tourne largement dans cette limite), veille après 15 min sans ping |
| Render frontend (statique) | Aucune limite significative, pas de veille |

Aucune carte bancaire n'est requise pour aucun des trois. Si le volume de candidats
grandit fortement (plusieurs centres, gros trafic), il sera temps d'évaluer un
upgrade payant à ce moment-là — pas avant.

### Configuration DNS recommandée

| Enregistrement | Cible |
|---|---|
| `queue.korintek.com` | CNAME vers le service frontend Render |
| `api.queue.korintek.com` | CNAME vers le service backend Render |

(Alternative sans sous-domaine dédié : servir le frontend sur `korintek.com/queue`
via un reverse proxy — à valider selon l'hébergement actuel de korintek.com.)

## 7. Gestion de la base de données

- **Migrations** : `npx prisma migrate dev` (local) / `npx prisma migrate deploy` (prod, automatique au build Render).
- **Inspection visuelle** : `npx prisma studio`.
- **Sauvegarde** : Render fournit des sauvegardes automatiques quotidiennes sur les plans
  payants PostgreSQL ; sur le plan gratuit, prévoir un export manuel (`pg_dump`) avant
  toute opération sensible.

## 8. Commandes Git recommandées

```bash
git init
git add .
git commit -m "Initial project structure"
git commit -m "Database setup"
git commit -m "Authentication"
git commit -m "Queue Manager features"
git commit -m "UI implementation"
git commit -m "Deployment ready"
git remote add origin <url-du-repo>
git push -u origin main
```

## 9. Points d'attention avant mise en production

- Le compte agent d'accueil (`EXAM_CENTER_AGENT`) doit être créé manuellement via
  Prisma Studio en V1 (pas encore d'écran "Gestion des utilisateurs" — à prévoir en V1.1).
- L'écran `/display` est intentionnellement public (pas de JWT requis) car il tourne sur
  une TV en salle d'attente : ne jamais y exposer d'informations autres que numéro/nom/examen.
- Le son de notification embarqué est un signal minimal ; le remplacer par un fichier audio
  de qualité (`public/notification.mp3`) avant mise en salle.
- Prévoir la rotation de `JWT_SECRET` uniquement lors d'une fenêtre de maintenance
  (invalide toutes les sessions actives).

## 10. Préparation des futurs modules

| Module | URL prévue | Statut |
|---|---|---|
| Billing | `billing.korintek.com` | Non démarré — voir `packages/database/README.md` pour la décision base partagée/séparée |
| CRM | `crm.korintek.com` | Non démarré |
| Training | `training.korintek.com` | Non démarré |
| Portail principal | `app.korintek.com` | Non démarré — agrégera les modules une fois 2+ modules en production |

Le modèle `User` / KORINTEK ID et le middleware `authenticate` sont déjà conçus pour être
réutilisés tels quels (voir `packages/authentication/verifyToken.js`).
