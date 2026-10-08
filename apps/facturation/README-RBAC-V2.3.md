# KORINTEK Facturation — RBAC V2.3

## Corrections
- Erreurs API lisibles côté interface : les détails JSON ne s'affichent plus comme `[object Object]`.
- Les erreurs serveur sont journalisées dans les logs Render avec l'opération concernée.
- La création d'un document est confirmée dès que l'écriture dans `documents` réussit ; l'enregistrement client et l'audit sont non bloquants.
- Mise à jour d'un document : même logique, avec erreur serveur explicite.
- Ajout de `/api/diagnostics`, réservé au SUPER_ADMIN, pour vérifier la base réellement utilisée et le nombre de documents sans exposer `DATABASE_URL`.
- Aucun `DROP TABLE`, `TRUNCATE`, suppression de données historiques ou reset de base.
- Historique legacy : les anciens `status=NULL` sont toujours présentés comme `DRAFT` uniquement à l'affichage ; aucune réécriture automatique.

## Déploiement
Déployer le code sans modifier manuellement Neon. Conserver le déploiement précédent comme rollback.
