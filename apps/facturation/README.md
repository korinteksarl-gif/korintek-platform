# KORINTEK Facturation — Documentation consolidée

**Version : V2.11 — Corporate / RBAC / Pagination & Print**

Application web KORINTEK destinée à la gestion des **proformas et factures**, avec authentification Microsoft Entra ID, gestion des rôles, historique, audit, paiements, export et rendu documentaire corporate.

## 1. Positionnement commercial

KORINTEK Facturation est une application commerciale générique couvrant notamment :

- Fourniture / achat-vente de matériel
- Prestations de services
- Fourniture + prestation
- Installation / intégration
- Maintenance / support
- Formation
- Examen / certification
- Autre

Identité principale des documents :

> **KORINTEK SARL — IT • TECHNOLOGY • SERVICES • SOLUTIONS**

Pearson VUE / PSI / PTE n'est plus présenté comme l'identité permanente de la société ; il apparaît uniquement lorsque l'activité **Examen / Certification** est pertinente.

## 2. Documents et historique

La stratégie est **non destructive**.

- Les anciennes proformas et factures ne sont ni supprimées, ni renommées, ni recalculées.
- Les numéros, dates, clients, lignes, montants, TVA, retenues et statuts historiques sont conservés.
- `activity_type` peut rester `NULL` pour les anciens documents.
- Les anciens documents adoptent automatiquement le nouveau rendu corporate lorsqu'ils sont réouverts et imprimés.
- Aucun `DROP TABLE`, `TRUNCATE`, suppression massive ou reset de base n'est utilisé par l'application.
- Les extensions de schéma nécessaires utilisent des `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## 3. Rôles et sécurité RBAC

### SUPER_ADMIN
Accès complet : administration, utilisateurs/rôles, documents, audit, paiements, export et paramètres.

### ADMIN
Consultation globale, création/modification, validation, paiements, export et audit. Pas de gestion des rôles ni de suppression/archive selon les règles applicatives.

### OPERATOR
Création/modification de ses propres documents et accès à son historique/export selon les permissions configurées.

### AUDITOR
Lecture globale, audit et export ; aucune modification.

Les autorisations sont contrôlées **côté backend**. Masquer un bouton dans l'interface n'est pas considéré comme une mesure de sécurité suffisante.

Les comptes présents dans `ADMIN_EMAILS` sont automatiquement traités comme `SUPER_ADMIN` à la connexion. Un SUPER_ADMIN ne peut pas se retirer lui-même ce rôle et le dernier SUPER_ADMIN ne peut pas être rétrogradé.

## 4. Cycle documentaire et paiements

Cycle principal :

`DRAFT → VALIDATED → ISSUED → SENT → PARTIALLY_PAID → PAID`

Statuts spéciaux : `CANCELLED`, `ARCHIVED`.

Les documents annulés/archivés sont verrouillés selon les règles applicatives.

Les paiements enregistrent notamment : montant, mode, date, référence, notes et créateur. L'enregistrement d'un paiement peut faire évoluer automatiquement le document vers `PARTIALLY_PAID` ou `PAID`.

Les changements sensibles sont journalisés dans `audit_log` : connexion, consultation, création, modification, export, changement de rôle, paiement et changements de statut.

## 5. Rendu Corporate des proformas / factures

Le tableau commercial utilise une structure lisible :

- **Désignation : 58 %**
- **Qté : 8 %**
- **P.U. HT : 17 %**
- **Total HT : 17 %**

Les montants sont alignés à droite, les descriptions longues sont automatiquement renvoyées à la ligne et le filigrane KORINTEK reste discret afin de privilégier la lisibilité.

Le favicon et l'identité visuelle sont harmonisés entre l'application et les documents commerciaux.

## 6. Pagination PDF / impression multi-pages

Le moteur d'impression gère les documents contenant de nombreux articles ou des descriptions très longues.

- Format A4 multi-pages automatique.
- En-tête du tableau répété sur chaque page.
- Identité visuelle KORINTEK conservée sur les pages.
- Une ligne article est déplacée intégralement si elle ne tient pas sur la page courante.
- Les descriptions longues restent associées à leur article.
- Les pages intermédiaires indiquent la continuité du détail.
- `Page X / Y` est recalculé après pagination.
- Totaux, TVA, conditions, coordonnées bancaires et signatures restent regroupés sur la dernière page.
- La préparation des pages est effectuée avant `window.print()` afin que JavaScript puisse mesurer correctement les contenus, y compris lorsque le conteneur d'impression était initialement masqué.

Cette logique s'applique également aux anciennes proformas et factures lors de leur réimpression.

## 7. Authentification et infrastructure

Architecture de référence :

- **Frontend / application :** FastAPI + HTML/JavaScript
- **Authentification :** Microsoft Entra ID, tenant KORINTEK
- **Base de données :** PostgreSQL / Neon
- **Hébergement :** Render

Variables principales :

| Variable | Utilisation |
|---|---|
| `AZURE_CLIENT_ID` | ID application Entra ID |
| `AZURE_CLIENT_SECRET` | Secret application |
| `AZURE_TENANT_ID` | Tenant KORINTEK |
| `APP_BASE_URL` | URL publique de l'application |
| `SESSION_SECRET_KEY` | Signature des sessions |
| `ADMIN_EMAILS` | Comptes bootstrap SUPER_ADMIN |
| `DATABASE_URL` | Connexion PostgreSQL |

Le redirect URI Entra ID doit correspondre exactement à l'URL publique configurée.

## 8. Déploiement

### Render

Build :

```text
pip install -r requirements.txt
```

Start :

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Base de données

La base doit être persistante. Ne pas exécuter de reset ou de migration destructive sur la production.

Conserver le dernier déploiement fonctionnel comme possibilité de rollback applicatif.

## 9. Administration des utilisateurs

La rubrique **Administration → Utilisateurs & droits** est réservée au `SUPER_ADMIN`.

Pour modifier le rôle d'un utilisateur :

1. Se connecter en `SUPER_ADMIN`.
2. Ouvrir **Administration**.
3. Rechercher l'utilisateur.
4. Sélectionner le rôle.
5. Enregistrer et confirmer.
6. L'utilisateur doit se reconnecter pour récupérer son nouveau rôle.

L'opération est enregistrée dans l'audit.

## 10. Diagnostics et robustesse

Un endpoint de diagnostic réservé au `SUPER_ADMIN` permet notamment de vérifier la base réellement utilisée et le nombre de documents sans exposer `DATABASE_URL`.

Les erreurs API sont affichées de manière lisible dans l'interface et les erreurs serveur sont journalisées côté hébergement.

La création et la mise à jour d'un document sont considérées comme réussies dès que l'écriture principale du document est effectuée ; les opérations secondaires telles que certains éléments d'audit ou d'enregistrement client ne doivent pas empêcher inutilement la sauvegarde principale.

Les anciens statuts `NULL` peuvent être présentés comme `DRAFT` uniquement à l'affichage sans réécriture automatique de l'historique.

## 11. Règles de maintenance

- Ne pas modifier ou supprimer manuellement les données historiques pour appliquer le nouveau design.
- Les évolutions de présentation doivent rester séparées des données métier.
- Toute évolution de schéma doit privilégier une migration additive et non destructive.
- Tester les documents courts **et** les documents multi-pages avant déploiement.
- Tester en particulier les descriptions longues, les montants élevés, la TVA, les paiements et les anciennes factures/proformas.
- Conserver une version applicative précédente pour rollback.

## 12. Historique des évolutions intégrées

| Version | Évolution principale |
|---|---|
| V2 | RBAC, cycle documentaire, audit et paiements |
| V2.1 | Sécurité des rôles et protection de l'historique |
| V2.2 | Corrections FastAPI / Request et sécurité de connexion |
| V2.3 | Gestion des erreurs, diagnostics et compatibilité legacy |
| V2.5 | Correctif typage `Request` sur les fonctions d'authentification |
| V2.6 | Administration des utilisateurs et des rôles |
| V2.7 | Passage à l'identité commerciale Corporate KORINTEK |
| V2.8 | Amélioration de la lisibilité du tableau et des totaux |
| V2.9 | Favicon et identité visuelle de l'application |
| V2.10 | Pagination PDF multi-pages |
| V2.11 | Correction du moteur d'impression/pagination avant `window.print()` |

## 13. Principe directeur

> **Les données historiques restent la source de vérité. Le design, la présentation et le moteur d'impression peuvent évoluer sans réécrire l'historique.**
