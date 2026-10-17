# KORINTEK Facturation — Corporate V2.7

## Objectif
La facturation devient une application commerciale générique KORINTEK :
- Fourniture / achat-vente de matériel
- Prestations de services
- Fourniture + prestation
- Installation / intégration
- Maintenance / support
- Formation
- Examen / certification
- Autre

## Compatibilité historique
La migration est **non destructive**.

- Aucun document historique n'est renommé, supprimé ou recalculé.
- La colonne `activity_type` est ajoutée en nullable.
- Les anciens documents gardent `activity_type = NULL`.
- Lorsqu'un ancien document est consulté/édité, l'interface applique automatiquement le nouveau design corporate.
- Les numéros, dates, clients, lignes, montants, TVA, retenues et statuts existants ne sont pas réécrits par la migration.
- Les anciennes proformas et factures adoptent donc le nouveau rendu graphique sans modification de leur historique en base.

## Nouveau positionnement graphique
Identité principale des documents :
**KORINTEK SARL — IT • TECHNOLOGY • SERVICES • SOLUTIONS**

La mention Pearson VUE / PSI / PTE n'est plus affichée comme identité permanente de la société. Elle apparaît uniquement lorsque l'activité « Examen / Certification » est sélectionnée.

## Base de données
Au démarrage, `app/db.py` exécute uniquement des `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pour les extensions nécessaires. Aucun backfill des anciens documents n'est effectué.
