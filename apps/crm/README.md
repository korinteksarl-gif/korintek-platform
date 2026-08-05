# KORINTEK CRM

Suivi des prospects (formations/certifications) et des contacts B2B/partenaires,
du premier contact jusqu'à la conversion, avec journal d'interactions et pipeline
commercial en vue Kanban.

## Contenu de cette livraison

```
apps/crm/
├── backend/     Node.js + Express + Prisma + PostgreSQL
├── frontend/    React + Vite + Tailwind CSS
└── render.yaml  Configuration de déploiement (backend + frontend)
```

Testé avant livraison :
- Syntaxe de tous les fichiers backend validée (`node --check`)
- Build frontend complet réussi (`vite build`, 95 modules, aucune erreur)
- Structure calquée sur le module Training déjà en production (mêmes conventions
  de rôles, d'authentification SSO, de style visuel)

Non testé ici (nécessite un environnement réseau complet, indisponible dans le
bac à sable de génération) : connexion réelle à une base PostgreSQL, flux complet
d'authentification Microsoft SSO de bout en bout. À vérifier au premier déploiement.

## Étapes de déploiement

### 1. Base de données
Créer un projet Neon.tech **dédié**, nommé par exemple `korintek-crm` — jamais
partagé avec Queue Manager ou Training (voir l'incident du 30/07/2026 documenté
dans le README principal du repo).

### 2. Assets graphiques manquants
Ce livrable ne contient **pas** les fichiers image officiels KORINTEK (logo,
favicon) — à copier depuis un module existant, jamais à régénérer par IA :

```
apps/training/frontend/public/logo-korintek.png  → apps/crm/frontend/public/logo-korintek.png
apps/training/frontend/public/favicon.png        → apps/crm/frontend/public/favicon.png
```

### 3. Azure — Redirect URI
Dans le portail Azure, app registration **"KORINTEK Facturation"** (réutilisée,
même Client ID que les autres modules) → Authentication → Redirect URIs → ajouter :
```
https://korintek-crm-api.onrender.com/api/v1/auth/microsoft/callback
```

### 4. Déploiement Render
1. Pousser ce dossier `apps/crm/` sur la branche `main` du repo `korintek-platform`.
2. Sur Render : **New → Blueprint**, pointer vers `apps/crm/render.yaml`.
   *(Ou créer les 2 services manuellement — backend `korintek-crm-api` et frontend
   statique `korintek-crm-frontend` — en copiant la configuration de `render.yaml`.)*
3. Renseigner manuellement dans le Dashboard Render (jamais dans Git) :
   - `DATABASE_URL` (connection string Neon pooled)
   - `AZURE_CLIENT_SECRET` (même valeur que Queue Manager/Training)
   - `SEED_ADMIN_PASSWORD` (mot de passe fort pour le compte de secours)

### 5. Vérification
- `https://korintek-crm-api.onrender.com/health` doit répondre `{"status":"ok",...}`
- Se connecter via SSO Microsoft → premier compte créé automatiquement en rôle
  `PENDING` → se reconnecter avec le compte de secours (`admin@korintek.com`) pour
  s'auto-attribuer `SUPER_ADMIN` via l'écran Utilisateurs (même procédure que pour
  Queue Manager et Training).

### 6. Garder le backend éveillé (optionnel, recommandé)
Configurer un ping `cron-job.org` vers `/health` toutes les 10 minutes, comme pour
les autres modules.

## Rôles disponibles

| Rôle | Accès |
|---|---|
| `PENDING` | Aucun — en attente d'attribution |
| `SUPER_ADMIN` | Tout, y compris gestion des utilisateurs |
| `ADMIN` | Gestion complète des contacts et interactions |
| `SALES` | Gestion des contacts et interactions (pas de gestion utilisateurs) |

## Modèle de données — points clés

- `Contact` : prospect formation ou partenaire B2B, avec étape de pipeline
  (`NOUVEAU → CONTACTE → PROPOSITION_ENVOYEE → NEGOCIATION → GAGNE/PERDU`)
- `Interaction` : journal des échanges (appel, email, réunion, note) par contact
- `trainingEnrollmentId` sur `Contact` : lien **léger** (texte libre, pas de vraie
  clé étrangère) vers une inscription du module Training une fois le prospect
  converti — les deux modules ayant des bases séparées, aucune vraie relation
  inter-base n'est possible ni souhaitable.

## Prochaines améliorations possibles (non incluses dans cette première livraison)

- Export Excel du pipeline
- Rappels automatiques de relance (email) pour les contacts sans activité récente
- Lien bidirectionnel réel avec Training (webhook à la conversion)
- Glisser-déposer entre colonnes du pipeline (actuellement : sélecteur d'étape)
