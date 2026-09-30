# Mise à jour — paramètres manuels des attestations

La génération d'une attestation permet désormais de définir manuellement, pour chaque apprenant :

1. **Période de formation**
   - Date de début
   - Date de fin
2. **Nombre d'heures de formation**
3. **Date d'obtention**

Les valeurs sont enregistrées dans `Certificate` et deviennent les valeurs de référence du PDF et de la vérification publique.

## Base de données

Le modèle Prisma `Certificate` contient maintenant :

- `trainingStartDate`
- `trainingEndDate`
- `durationHoursSnapshot`
- `completionDate`

Le projet utilise `prisma db push` au déploiement Render. En local, exécuter depuis `backend/` :

```bash
npm install
npx prisma generate
npm run prisma:push
```

## Compatibilité

Les anciennes attestations restent compatibles : si elles ne possèdent pas `trainingEndDate`, leur ancien calcul de période et leur ancien schéma de hash sont conservés.

Les nouvelles attestations utilisent un hash SHA-256 incluant : numéro, identité, formation, durée, date de début, date de fin et date d'obtention.
