# KORINTEK — App de facturation (Proforma / Facture)

Application web sécurisée par compte Microsoft 365 (Entra ID) — tenant KORINTEK.
Chaque personne se connecte avec son compte @korintek.com. Toi (admin) vois
l'historique complet ; les employés ne voient que leurs propres documents.

**Hébergement : Render.com (app) + Neon.tech (base de données PostgreSQL)**
— 100% gratuit, aucune carte bancaire requise sur l'un ou l'autre.

---

## 1. Créer la base de données PostgreSQL sur Neon (2 min)

1. Va sur **neon.tech** → **Sign up** (avec ton email, pas de carte demandée)
2. Crée un nouveau projet, ex. nommé `korintek-facturation`
3. Une fois créé, va dans **Connection Details** (ou "Dashboard") et copie la
   **chaîne de connexion** complète — elle ressemble à :
   `postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
4. Garde cette valeur de côté → ce sera `DATABASE_URL`

---

## 2. Créer l'App Registration Entra ID (5 min)

1. Va sur **portal.azure.com**, connecte-toi avec ton compte admin du tenant KORINTEK
2. Cherche **"Inscriptions d'applications"** → **Nouvelle inscription**
3. Renseigne :
   - Nom : `KORINTEK Facturation`
   - Types de comptes : **Comptes dans cet annuaire organisationnel uniquement (KORINTEK)**
   - Redirect URI (type **Web**) : `https://korintek-facturation.onrender.com/auth/callback`
     *(ajuste le nom exact après l'étape 3 si Render te donne un nom différent)*
4. **Inscrire**
5. Sur la page **Vue d'ensemble**, note :
   - **ID d'application (client)** → `AZURE_CLIENT_ID`
   - **ID d'annuaire (locataire)** → `AZURE_TENANT_ID`
6. **Certificats & secrets** → **Nouveau secret client** → 24 mois → **Ajouter** →
   copie immédiatement la **valeur** (elle disparaît après) → `AZURE_CLIENT_SECRET`

*(Cette étape ne nécessite aucune carte bancaire — Entra ID est inclus dans vos
licences Kiosk existantes.)*

---

## 3. Déployer l'app sur Render (5 min)

1. Va sur **render.com** → **Sign up** (avec GitHub ou email, pas de carte demandée)
2. **New** → **Web Service**
3. Deux façons de fournir le code :
   - **Option A (recommandée)** : pousse le dossier `korintek-app` sur un dépôt GitHub
     (public ou privé), puis connecte ce dépôt à Render
   - **Option B** : Render permet aussi un déploy manuel via leur CLI si tu préfères
     ne pas utiliser GitHub — dis-le-moi si tu veux cette variante
4. Render détecte automatiquement `requirements.txt` (Python) grâce au fichier
   `render.yaml` inclus. Vérifie que :
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free
5. Render te donne une URL du type `https://korintek-facturation.onrender.com`
   → si elle diffère de celle utilisée à l'étape 2.3, retourne corriger le
   Redirect URI dans l'App Registration Entra ID pour qu'il corresponde exactement

---

## 4. Configurer les variables d'environnement sur Render

Dans le service Render → **Environment** → ajoute :

| Nom | Valeur |
|---|---|
| `AZURE_CLIENT_ID` | (étape 2.5) |
| `AZURE_CLIENT_SECRET` | (étape 2.6) |
| `AZURE_TENANT_ID` | (étape 2.5) |
| `APP_BASE_URL` | `https://korintek-facturation.onrender.com` (ton URL Render réelle) |
| `SESSION_SECRET_KEY` | générée automatiquement par `render.yaml`, ou génère la tienne avec `openssl rand -hex 32` |
| `ADMIN_EMAILS` | ton email @korintek.com |
| `DATABASE_URL` | la chaîne de connexion Neon (étape 1.3) |

Sauvegarde → Render redéploie automatiquement.

---

## 5. Premier lancement

1. Va sur ton URL Render
2. Tu es redirigé vers la connexion Microsoft → connecte-toi avec ton compte KORINTEK
3. Comme ton email est dans `ADMIN_EMAILS`, tu arrives avec le badge **Administrateur**
4. Va dans l'onglet **Société**, complète/vérifie les informations, **Enregistrer**
5. Donne l'URL à tes employés — ils se connectent avec leur propre compte @korintek.com
   (licence Kiosk incluse) et arrivent automatiquement avec le rôle **Employé**

---

## À savoir sur le plan gratuit Render

- L'app **s'endort après 15 minutes d'inactivité** et met 30-50 secondes à se
  "réveiller" au prochain accès — normal, pas un bug. Sans impact pour un usage
  ponctuel (générer une facture de temps en temps)
- La base de données Neon, elle, reste **persistante en permanence** — aucune
  perte de données liée à la mise en veille de Render
- Si un jour le volume d'usage augmente et que la mise en veille devient gênante,
  Render propose un plan payant (~7$/mois) qui supprime cette limite — à réévaluer
  plus tard, pas nécessaire maintenant

## Notes de sécurité

- Seuls les comptes du tenant KORINTEK peuvent se connecter (mono-tenant configuré à l'étape 2)
- Pour révoquer l'accès à quelqu'un qui quitte l'entreprise : désactive son compte M365,
  il ne pourra plus se reconnecter
- Pour changer qui est admin : modifie `ADMIN_EMAILS` dans Render (Environment) → redéploiement auto
- Le secret client Entra ID expire (24 mois max) — penser à le renouveler avant échéance
