# KORINTEK Facturation — RBAC V2.2

Correctifs de production :
- `/` utilise explicitement `Request`, évitant que FastAPI interprète `request` comme un paramètre de requête obligatoire.
- Un email présent dans `ADMIN_EMAILS` est toujours chargé comme `SUPER_ADMIN` à la connexion.
- Aucun changement destructif de données.
