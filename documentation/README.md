KORINTEK BUSINESS PORTAL
Modules actifs : KORINTEK QUEUE MANAGER + KORINTEK TRAINING
Portail numérique KORINTEK regroupant la gestion de file d'attente du centre d'examen (Pearson VUE / PSI) et le module de formation (inscriptions, sessions, formateurs, attestations). Feuille de route du portail complet : Queue Manager → Training → Billing → CRM.

1. Architecture
korintek-platform/
├── apps/
│   ├── queue-manager/
│   │   ├── backend/    Node.js + Express + Prisma + PostgreSQL
│   │   └── frontend/   React + Vite + Tailwind CSS
│   └── training/
│       ├── backend/    Node.js + Express + Prisma + PostgreSQL
│       └── frontend/   React + Vite + Tailwind CSS
├── packages/
│   ├── ui-components/  Design system partagé (non utilisé pour l'instant)
│   ├── authentication/ Vérification JWT KORINTEK ID — PAS ENCORE MUTUALISÉE (voir note ci-dessous)
│   ├── database/       Conventions Prisma communes
│   └── shared-utils/   Fonctions utilitaires communes
├── documentation/
└── deployment/
    └── render.yaml

Chaque app est déployée comme des services Render indépendants (backend + frontend séparés par module). Chaque module (queue-manager, training) dispose de sa propre base Neon.tech dédiée — voir incident du 30/07/2026 documenté dans documentation/, qui a motivé cette séparation stricte.

⚠️ Note sur packages/ : ce dossier est un objectif de mutualisation, pas encore une réalité. À ce jour, les trois projets KORINTEK (Queue Manager, Training, et facturation.korintek.com) maintiennent chacun leur propre code d'authentification dupliqué (middleware/auth.js indépendant dans chaque backend). Aucun n'importe depuis packages/authentication/. Une factorisation réelle vers packages/ reste à faire — ne pas supposer que modifier packages/authentication/ affecte les modules en production tant que cette migration n'a pas été effectuée explicitement.

2. Authentification — Microsoft Entra ID (Office 365 SSO)
Les trois projets (Queue Manager, Training, Facturation) utilisent le même mécanisme : connexion via le bouton "Se connecter avec Microsoft 365", pas de mot de passe local à gérer au quotidien — mais chacun via sa propre implémentation dupliquée du middleware d'authentification (voir note ci-dessus).

App registration réutilisée : "KORINTEK Facturation" dans le portail Azure (Client ID dca354c3-b920-41af-aa90-abf4a31969d4, Tenant 9cdff590-bed7-4a7a-a6c4-6aadd7edf896) — partagée par les trois projets.

Étape obligatoire côté Azure avant le premier test d'un nouveau module : dans cette app registration → Authentication → Redirect URIs → ajouter l'URL de callback du backend concerné, par exemple :

https://korintek-queue-api.onrender.com/api/v1/auth/microsoft/callback
https://korintek-training-api.onrender.com/api/v1/auth/microsoft/callback

Client Secret : partagé entre les trois projets, renseigné dans AZURE_CLIENT_SECRET sur Render pour chaque service séparément (jamais dans le repo Git).

Attribution des rôles : un compte Office 365 qui se connecte pour la première fois est créé automatiquement avec le rôle PENDING (aucun accès), dans le module concerné. Un SUPER_ADMIN de ce module doit ensuite lui attribuer un rôle réel via l'écran "Utilisateurs". Les rôles sont indépendants d'un module à l'autre (un compte peut être SUPER_ADMIN sur Training et PENDING sur Queue Manager, par exemple) — chaque module a sa propre table de rôles, sans partage.

Compte de secours local : chaque module conserve un compte administrateur local (email/mot de passe, hors SSO), créé au premier déploiement via le script de seed — utile en cas de panne SSO.

3. Rôles KORINTEK ID

Queue Manager
Rôle	Accès
PENDING	Aucun — en attente d'attribution par un SUPER_ADMIN
SUPER_ADMIN	Tout, y compris suppression, audit et gestion des utilisateurs
ADMIN	Gestion candidats, file, import, audit
RECEPTION	Ajout/modification candidats, import, appel de la file
EXAM_CENTER_AGENT	Mode agent d'accueil (appeler/terminer/absent) uniquement
FINANCE	Lecture dashboard
TRAINER	Réservé (non utilisé sur ce module)

Training
Rôle	Accès
PENDING	Aucun — en attente d'attribution par un SUPER_ADMIN
SUPER_ADMIN	Tout, y compris gestion des utilisateurs, modification des montants payés, formateurs
ADMIN	Gestion formations, sessions, inscriptions, délivrance d'attestations
TRAINER	Accès en lecture aux inscriptions (dashboard)
FINANCE	Lecture inscriptions, gestion des paiements formateurs

4. Installation locale
Prérequis : Node.js 20+, PostgreSQL 14+ (local ou distant), npm.

Backend (exemple pour un module, remplacer <module> par queue-manager ou training)
cd apps/<module>/backend
cp .env.example .env
# Renseigner DATABASE_URL, JWT_SECRET, SEED_ADMIN_* dans .env
npm install
npm run prisma:migrate:dev   # crée les tables
npm run prisma:seed          # crée le compte administrateur initial
npm run dev                  # démarre l'API en local

Frontend
cd apps/<module>/frontend
cp .env.example .env
npm install
npm run dev                  # démarre l'interface en local

5. Comptes administrateurs initiaux
Créés par npm run prisma:seed à partir des variables SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD, propres à chaque module. Changer le mot de passe dès la première connexion (le changement self-service n'est pas encore implémenté — recréer l'utilisateur via SQL Editor Neon ou Prisma Studio en attendant).

6. Déploiement — 100% gratuit, sans date d'expiration
Chaque module (queue-manager, training) est déployé avec sa propre base Neon.tech dédiée — ne jamais partager une base entre deux modules (voir incident du 30/07/2026 : un déploiement Training avait accidentellement supprimé les tables de Queue Manager via une base partagée et un flag --accept-data-loss ; les deux causes ont été corrigées définitivement).

6.1 Garder chaque backend éveillé (gratuit, recommandé)
Le plan gratuit Render met chaque backend en veille après 15 min sans requête. Pour chacun (queue-manager-api, training-api), configurer un ping via cron-job.org vers son endpoint /health, toutes les 10 minutes, limité aux heures d'ouverture.

6.2 Limites à connaître sur le long terme (gratuit)
Composant	Limite du plan gratuit
Neon.tech (par base)	0.5 GB de stockage par projet, pas de date d'expiration
Render backend (par service)	750h/mois offertes, veille après 15 min sans ping
Render frontend statique	Aucune limite significative, pas de veille
Render domaines personnalisés	2 domaines inclus par workspace (voir section 9 — impact sur le nommage des modules)

7. Gestion de la base de données
Migrations : npx prisma migrate dev (local) / npx prisma db push (prod, automatique au build Render, sans --accept-data-loss).
Inspection visuelle : npx prisma studio (local) ou SQL Editor Neon (prod).
Sauvegarde : export manuel (pg_dump) recommandé avant toute opération sensible sur le plan gratuit.

8. Points d'attention avant mise en production
L'écran /display du Queue Manager est intentionnellement public (pas de JWT requis) : ne jamais y exposer d'informations autres que numéro/nom/examen.
Prévoir la rotation de JWT_SECRET uniquement lors d'une fenêtre de maintenance (invalide toutes les sessions actives du module concerné, indépendamment des autres).
Le logo et les assets graphiques (certificats, sceaux) doivent toujours être les fichiers officiels KORINTEK — jamais de reconstitution par génération d'image IA sur les documents officiels.
La mutualisation via packages/ (authentification, design system) reste un chantier futur — actuellement, toute correction de sécurité ou de bug d'authentification doit être répliquée manuellement dans chacun des trois projets.

9. État des modules et stratégie de nommage DNS

Module	URL actuelle	Statut
Queue Manager	queue.korintek.com	En production (domaine personnalisé Render)
Training	korintek-training-frontend.onrender.com	En production — DNS training.korintek.com volontairement différé (voir note ci-dessous)
Facturation	facturation.korintek.com	En production (domaine personnalisé Render, stack séparée FastAPI/Python, hors de ce monorepo apps/)
CRM	crm.korintek.com	Non démarré
Portail principal	app.korintek.com	Non démarré

⚠️ Contrainte identifiée (04/08/2026) : le plan Render Hobby (gratuit) inclut seulement 2 domaines personnalisés par workspace. Queue Manager et Facturation utilisent déjà ces 2 slots. Ajouter un 3e domaine personnalisé (ex: training.korintek.com) coûte 0,25 $/mois — montant négligeable, mais volontairement évité pour l'instant en attendant la décision d'architecture ci-dessous.

Décision d'architecture retenue pour le portail unifié (app.korintek.com) :
Plutôt que d'attribuer un sous-domaine personnalisé Render à chaque module (ce qui consommerait un slot gratuit par module et redeviendrait limitant dès le 3e module), la cible est de faire de app.korintek.com le seul domaine personnalisé nécessaire à terme, avec les modules exposés en interne via des chemins plutôt que des sous-domaines séparés, par exemple :

app.korintek.com/queue        → reverse proxy vers korintek-queue-frontend.onrender.com
app.korintek.com/training     → reverse proxy vers korintek-training-frontend.onrender.com
app.korintek.com/facturation  → reverse proxy vers le service facturation

Dans ce scénario, queue.korintek.com et facturation.korintek.com pourraient être conservés comme redirections simples vers app.korintek.com/..., libérant ainsi la logique de domaines dédiés par module. Un seul domaine personnalisé (app.korintek.com) suffirait alors pour l'ensemble du portail, restant confortablement dans les 2 slots gratuits de Render.

Prérequis technique avant d'attaquer ce chantier : mise en place d'une couche de routage/reverse proxy (Nginx, Caddy, ou équivalent Render) devant les services actuels. À traiter en parallèle de la mutualisation de packages/authentication/ (section 1), les deux chantiers étant liés architecturalement (un portail unifié bénéficie naturellement d'une authentification mutualisée).

En attendant cette consolidation : Training reste sur son URL .onrender.com par défaut, sans coût, sans perte de fonctionnalité.

10. Chantiers identifiés (non priorisés)
- Mutualisation réelle de packages/authentication/ entre les 3 projets
- Enrichissement de packages/ui-components/ (design system partagé)
- Reverse proxy / gateway pour app.korintek.com (voir section 9)
- Sauvegarde automatisée des bases Neon (actuellement manuelle)
- Training : capacité/places restantes sur les sessions, édition de session existante, édition de formation après création, recherche/filtre sur les inscriptions, export Excel, tableau de bord (revenus, taux de remplissage, attestations/mois), rappels automatiques par email avant le début d'une session
