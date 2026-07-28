# @korintek/ui-components

Design system partagé de KORINTEK BUSINESS PORTAL.

Ce dossier est prévu pour accueillir, au fur et à mesure de la construction des modules
Billing, CRM et Training, les composants React communs (Header, Sidebar, Cards, Tables,
Buttons, Forms, Modals, Notifications) actuellement implémentés localement dans
`apps/queue-manager/frontend/src/components`.

**Charte à respecter dans tout composant ajouté ici :**

- Couleurs : bleu clair professionnel (`#0EA5E9` / fond `#E0F2FE`), blanc, touches modernes.
- Police obligatoire : `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`.
- Style : premium, SaaS moderne, minimaliste, professionnel.

**Étape suivante recommandée** : extraire les composants génériques de Queue Manager
(cartes de statistiques, tableau, boutons) vers ce package dès le démarrage du module Billing,
pour éviter la duplication.
