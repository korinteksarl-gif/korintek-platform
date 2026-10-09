# KORINTEK Facturation — RBAC V2.6

## Gestion des droits

V2.6 ajoute une interface **Administration → Utilisateurs & droits**, visible uniquement au `SUPER_ADMIN`.

### Rôles
- `SUPER_ADMIN` : tous les droits, y compris la gestion des utilisateurs/rôles.
- `ADMIN` : consultation globale, création, modification, export, audit et opérations de paiement ; pas de suppression/archive et pas de gestion des rôles.
- `OPERATOR` : création et modification de ses propres documents, historique/export propres selon les permissions existantes.
- `AUDITOR` : lecture globale, audit et export.

### Changer le rôle de Benoît
1. Se connecter avec le compte `SUPER_ADMIN`.
2. Ouvrir **Administration**.
3. Rechercher Benoît dans la liste.
4. Choisir `ADMIN`.
5. Cliquer **Enregistrer** et confirmer.
6. Benoît doit se déconnecter/reconnecter pour que sa session récupère son nouveau rôle.

Le changement est enregistré dans le journal d’audit.

### Sécurités
- Les droits sont contrôlés côté serveur, pas seulement dans l’interface.
- Impossible pour un SUPER_ADMIN de se retirer lui-même ce rôle.
- Impossible de rétrograder le dernier SUPER_ADMIN.
- Les utilisateurs inexistants sont refusés.
- Aucun reset/migration destructive de la base n’est utilisé par cette version.
