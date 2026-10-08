# KORINTEK Facturation — RBAC V2.5

Correctif production : les fonctions `get_current_user`, `require_user`, `login` et `logout` typent explicitement `request` en `fastapi.Request`.

Cela évite que FastAPI interprète `request` comme un paramètre de query et renvoie :
`{"detail":[{"type":"missing","loc":["query","request"],"msg":"Field required","input":null}]}`

Aucune modification destructive de base de données n'a été ajoutée.
