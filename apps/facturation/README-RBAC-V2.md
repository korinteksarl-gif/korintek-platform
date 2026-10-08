# KORINTEK Facturation — RBAC V2

Cette version ajoute un contrôle d'accès par rôles et un cycle de vie documentaire sans migration destructive.

## Rôles
- SUPER_ADMIN : accès complet, paramètres, utilisateurs, audit, archivage, annulation logique.
- ADMIN : création/modification, historique global, validation, paiements, export, audit.
- OPERATOR : création/modification de ses propres documents, paiements, export limité.
- AUDITOR : lecture seule globale, audit et export.

## Cycle documentaire
DRAFT → VALIDATED → ISSUED → SENT → PARTIALLY_PAID → PAID

Statuts spéciaux : CANCELLED, ARCHIVED.
Les documents archivés/annulés sont verrouillés.

## Audit
La table `audit_log` trace notamment connexion, consultation, création, modification, export, changement de rôle, paiements et changements de statut.

## Paiements
Table `payments` : montant, mode, date, référence, notes, créateur. Le statut du document passe automatiquement à PARTIALLY_PAID ou PAID après paiement.

## Sécurité
Les contrôles sont effectués côté backend. Masquer un bouton dans l'interface ne constitue pas une sécurité suffisante.

## Déploiement
Tester d'abord sur une base Neon de préproduction. Ne pas exécuter de reset Prisma ni de commande destructive. `init_db()` ne fait que créer/ajouter des structures manquantes.
