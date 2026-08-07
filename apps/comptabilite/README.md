# KORINTEK COMPTABILITÉ

Comptabilité en partie double : plan comptable, écritures équilibrées (débit =
crédit obligatoire), et rapports calculés à la volée (grand livre, balance
générale, bilan).

## Contenu de cette livraison

```
apps/comptabilite/
├── backend/     Node.js + Express + Prisma + PostgreSQL
├── frontend/    React + Vite + Tailwind CSS
└── render.yaml  Configuration de déploiement (backend + frontend)
```

Testé avant livraison :
- Syntaxe de tous les fichiers backend validée (`node --check`, 17 fichiers)
- Build frontend complet réussi (`vite build`, 97 modules, aucune erreur)
- Structure calquée sur les modules Training et CRM déjà en production

Non testé ici (nécessite un environnement réseau complet, indisponible dans le
bac à sable de génération) : connexion réelle à une base PostgreSQL, flux complet
d'authentification Microsoft SSO de bout en bout. À vérifier au premier déploiement,
comme pour chaque module précédent.

## ⚠️ Avertissement important sur le plan comptable

Le plan comptable de départ (créé automatiquement au premier déploiement) est
**inspiré** du référentiel OHADA (norme comptable en vigueur en zone UEMOA,
dont le Togo), adapté à l'activité de KORINTEK (formations, certifications).//
Ce n'est **pas une garantie de conformité fiscale** — à faire valider et ajuster
par un expert-comptable avant tout usage pour vos déclarations officielles.

## Étapes de déploiement

### 1. Base de données
Créer un projet Neon.tech **dédié**, nommé par exemple `korintek-comptabilite`
— jamais partagé avec un autre module.

### 2. Assets graphiques manquants
```
apps/training/frontend/public/logo-korintek.png  → apps/comptabilite/frontend/public/logo-korintek.png
apps/training/frontend/public/favicon.png        → apps/comptabilite/frontend/public/favicon.png
```

### 3. Azure — Redirect URI
App registration **"KORINTEK Facturation"** → Authentication → Redirect URIs → ajouter :
```
https://korintek-compta-api.onrender.com/api/v1/auth/microsoft/callback
```

### 4. Déploiement Render
1. Pousser `apps/comptabilite/` sur la branche `main`.
2. Render : **New → Blueprint**, Blueprint Path : `apps/comptabilite/render.yaml`
3. Renseigner manuellement sur Render (jamais dans Git) :
   - `DATABASE_URL` (connection string Neon pooled)
   - `AZURE_CLIENT_SECRET` (même valeur que les autres modules)
   - `SEED_ADMIN_PASSWORD`

### 5. Vérification
- `https://korintek-compta-api.onrender.com/health` doit répondre `{"status":"ok",...}`
- SSO Microsoft → premier compte en `PENDING` → reconnexion via compte de secours
  (`admin@korintek.com`) → auto-attribution `SUPER_ADMIN` via écran Utilisateurs

### 6. Garder le backend éveillé
Ping `cron-job.org` vers `/health` toutes les 10 minutes, comme les autres modules.

## Rôles disponibles

| Rôle | Accès |
|---|---|
| `PENDING` | Aucun |
| `SUPER_ADMIN` | Tout, y compris suppression d'écritures et gestion utilisateurs |
| `ADMIN` | Gestion complète des comptes et écritures (pas de suppression) |
| `COMPTABLE` | Saisie d'écritures et consultation des rapports (pas de gestion du plan comptable) |

## Modèle de données — points clés

- `Account` : un compte du plan comptable (code, nom, type parmi `ACTIF`,
  `PASSIF`, `CAPITAUX_PROPRES`, `PRODUIT`, `CHARGE`)
- `JournalEntry` + `JournalLine` : une écriture comptable est un ensemble de
  lignes, chacune imputée en débit OU en crédit sur un compte. Le backend
  **refuse la création** de toute écriture où le total des débits ne serait pas
  exactement égal au total des crédits — impossible de créer une comptabilité
  incohérente via l'interface.
- Aucun rapport n'est stocké : grand livre, balance et bilan sont **recalculés
  à chaque consultation** à partir des écritures, garantissant qu'ils reflètent
  toujours l'état réel, sans risque de désynchronisation.

## Prochaines améliorations possibles (délibérément non incluses en V1)

Comme convenu, cette première version fonctionne en **saisie manuelle uniquement**
— aucun lien automatique avec Training, CRM ou Facturation pour l'instant, afin de
valider la fiabilité du module seul avant d'y brancher des flux automatiques
(risque identifié lors de l'incident du 30/07/2026 sur les bases partagées).

Pistes pour une V2, une fois la V1 éprouvée en usage réel :
- Génération automatique d'écritures depuis les paiements Training/CRM/Facturation
- Export PDF/Excel des rapports (bilan, balance)
- Écritures de contre-passation au lieu de la suppression directe
- Clôture d'exercice comptable (verrouillage des écritures passées)
- Rapprochement bancaire
