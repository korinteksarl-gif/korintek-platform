# KORINTEK Facturation — V2.9 Print / Documents

## Objectif
Refonte du rendu imprimable sans modification des données historiques.

### Documents
- Devis
- Proforma
- Facture
- Le titre imprimé suit automatiquement le type sélectionné.
- Les données existantes ne sont ni recalculées ni réécrites par cette amélioration.

### Impression A4
- A4 portrait.
- Véritable pagination du moteur d'impression Chromium.
- En-tête du tableau répété automatiquement.
- Une ligne commerciale ne se coupe pas (`break-inside: avoid`).
- Le tableau peut s'étendre sur plusieurs pages.
- Totaux, conditions, coordonnées bancaires et signatures restent après le tableau et se placent sur la dernière page.
- Bande latérale KORINTEK, filigrane et footer sont en position fixe pour être répétés à l'impression.
- Print Preview / PDF navigateur est la référence de rendu.

### Compatibilité historique
Aucune commande destructive et aucun recalcul des documents existants n'ont été ajoutés.
