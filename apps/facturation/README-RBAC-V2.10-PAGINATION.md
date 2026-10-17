# KORINTEK Facturation — V2.10 Pagination PDF

## Objectif
Amélioration du rendu d'impression / export PDF pour les proformas et factures contenant un grand nombre de lignes ou des désignations longues.

## Fonctionnement
- Génération de pages A4 dédiées à l'impression.
- Répétition de l'en-tête du tableau sur chaque page.
- Répétition de l'identité visuelle KORINTEK sur chaque page.
- Une ligne d'article n'est jamais volontairement coupée entre deux pages.
- Les descriptions longues sont conservées avec leur ligne.
- Les totaux, conditions, coordonnées bancaires et signatures sont regroupés sur la dernière page.
- Numérotation automatique `Page X / Y`.
- Les pages intermédiaires affichent `Suite — détail de la prestation / fourniture`.
- Le nouveau moteur concerne uniquement l'impression/PDF : les données et l'historique ne sont pas modifiés.

## Compatibilité historique
Aucune migration de données n'est effectuée. Les anciennes factures et proformas utilisent le même nouveau moteur de présentation lorsqu'elles sont réouvertes puis imprimées.

## Version
V2.10 — Pagination PDF / impression multi-pages.
