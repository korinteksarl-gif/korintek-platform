# @korintek/database

Ce dossier documente les conventions Prisma communes à tous les modules KORINTEK.

Le schéma actif se trouve dans `apps/queue-manager/backend/prisma/schema.prisma`
(modèles `User`, `Candidate`, `AuditLog`).

**Convention KORINTEK ID** : le modèle `User` (id, nom, prenom, email, passwordHash, role,
active, created_at) est l'identité pivot du portail. Quand le module Billing sera développé,
deux options :
1. Réutiliser la même base PostgreSQL avec un schéma Prisma partagé (recommandé si le volume
   reste modeste, simplifie les jointures identité <-> facturation).
2. Base séparée par module avec synchronisation d'identité via JWT uniquement (recommandé si
   les modules doivent pouvoir être opérés/scalés indépendamment).

Décision à prendre avant de démarrer le module Billing.
