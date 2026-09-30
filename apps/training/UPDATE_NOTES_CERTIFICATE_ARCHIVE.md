# KORINTEK Training — Archivage et suppression des attestations

Cette mise à jour ajoute un contrôle administratif pour les attestations comportant une erreur.

## Fonctionnement

### 1. Archivage
- Disponible pour `ADMIN` et `SUPER_ADMIN`.
- Un motif d'archivage est obligatoire.
- L'attestation reçoit `archivedAt`, `archivedBy` et `archiveReason`.
- Une attestation archivée n'est plus considérée comme valide par la vérification publique.
- Son PDF n'est plus téléchargeable publiquement.
- L'action est enregistrée dans `training_audit_logs` sous `CERTIFICATE_ARCHIVED`.

### 2. Réédition
- Une attestation archivée peut être rééditée depuis la même inscription.
- Le système génère un nouveau numéro d'attestation et remplace les données de l'attestation archivée.
- L'ancien numéro reste traçable dans l'audit via `previousCertificateNumber`.
- L'attestation rééditée redevient active.

### 3. Suppression définitive
- Réservée au `SUPER_ADMIN`.
- Une attestation doit obligatoirement être archivée avant suppression.
- La suppression est enregistrée dans l'audit sous `CERTIFICATE_DELETED` avant suppression.

## Base de données

Le modèle `Certificate` contient désormais :

- `archivedAt DateTime?`
- `archivedBy String?`
- `archiveReason String?`

Render utilise déjà `prisma db push --accept-data-loss` au déploiement, donc les nouveaux champs seront ajoutés automatiquement.

## Routes API

- `POST /api/v1/certificates/:numero/archive`
- `DELETE /api/v1/certificates/:numero`

## Sécurité

Le proxy Render est également déclaré avec `app.set('trust proxy', 1)` afin de corriger l'avertissement `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` observé dans les logs.
