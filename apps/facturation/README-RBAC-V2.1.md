# KORINTEK Facturation — RBAC V2.1

## Corrections V2.1
- Les comptes présents dans `ADMIN_EMAILS` sont toujours promus `SUPER_ADMIN` à la connexion. Une gestion manuelle du rôle ne peut pas rétrograder un compte bootstrap tant que son email reste dans `ADMIN_EMAILS`.
- Les documents historiques existants ne reçoivent plus automatiquement le statut `DRAFT` lors de l'ajout de la colonne `status`. Leur statut reste `NULL` tant qu'aucune action V2 ne leur en attribue un.
- Les transitions de statut sont contrôlées côté backend.
- `PARTIALLY_PAID` et `PAID` sont produits par l'enregistrement d'un paiement, et ne peuvent pas être forcés via l'endpoint générique de changement de statut.
- Aucun `DROP TABLE`, `TRUNCATE TABLE` ou `DELETE FROM` n'est présent dans le code applicatif.

## Rôles
- `SUPER_ADMIN`: accès complet.
- `ADMIN`: consultation globale, création/modification, validation, export, audit et paiements; pas de suppression/archivage.
- `OPERATOR`: création/modification de ses documents, consultation de son historique et paiements selon les permissions configurées.
- `AUDITOR`: lecture globale, audit et export; aucune modification.

## Déploiement
Cette version est conçue pour une migration non destructive. Conserver le projet/commit initial comme rollback applicatif.
