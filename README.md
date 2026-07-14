# Gestion des locations de matériel

Petite app pour suivre le matériel de construction prêté/loué à des clients.

- **Backend / base de données**: [Supabase](https://supabase.com) (Postgres géré + API REST auto-générée + authentification). Free tier.
- **Frontend**: React (Vite), dans `frontend/`. Déployé gratuitement sur [Vercel](https://vercel.com).
- **Tables**: `items` (matériel, avec stock suivi automatiquement), `clients`, `suppliers` (fournisseurs), `achats` (entrées de stock), `commandes` + `commande_lignes` (commandes clients multi-articles).

### Fonctionnement du stock

Le stock (`items.stock_actuel`) est mis à jour automatiquement par des triggers dans la base — pas de code frontend à maintenir pour ça :
- Un **achat** enregistré ajoute la quantité au stock.
- La création d'une **ligne de commande** retire la quantité du stock, et **refuse la commande si le stock est insuffisant**.
- Cliquer **"Marquer retourné"** sur une ligne remet la quantité en stock.
- Le statut d'une commande (`en_cours` / `retourné`) se met à jour automatiquement selon l'état de ses lignes.
- Le tableau de bord signale les articles sous le seuil d'alerte et les commandes en retard (date de fin prévue dépassée sans retour).

Coût total pour un usage single-user: **0 €/mois** (tant que tu restes dans les limites gratuites de Supabase et Vercel, largement suffisantes ici).

---

## 1. Créer le projet Supabase (backend + base de données)

1. Va sur https://supabase.com et crée un compte gratuit (tu peux te connecter avec GitHub).
2. Clique **New project**. Choisis un nom, un mot de passe pour la base (garde-le de côté), et une région proche de toi.
3. Attends ~2 minutes que le projet soit prêt.
4. Dans le menu de gauche, va sur **SQL Editor** → **New query**.
5. Colle tout le contenu du fichier [`supabase/schema.sql`](supabase/schema.sql) de ce dossier et clique **Run**. Ça crée les tables de base et sécurise l'accès (seul un utilisateur connecté peut lire/écrire).
6. Nouvelle requête, colle cette fois tout le contenu de [`supabase/migration_002_stock_and_orders.sql`](supabase/migration_002_stock_and_orders.sql) et clique **Run**. Ça ajoute fournisseurs, achats, le suivi de stock automatique, et transforme les commandes en commandes multi-articles (si tu avais déjà des données dans `commandeclient`, elles sont migrées automatiquement et l'ancienne table est renommée `commandeclient_legacy` en backup, pas supprimée).
7. Va sur **Authentication** → **Users** → **Add user** → **Create new user**. Mets ton email et un mot de passe: ce sera ton compte de connexion à l'appli (il n'y a pas de page d'inscription publique, c'est volontaire pour une app à un seul utilisateur).
8. Va sur **Project Settings** (icône engrenage) → **API**. Note les deux valeurs suivantes, tu en auras besoin juste après:
   - **Project URL**
   - **anon public** key

---

## 2. Lancer le frontend en local

Prérequis: [Node.js](https://nodejs.org) installé (version 18+).

```powershell
cd frontend
copy .env.example .env
```

Ouvre `frontend/.env` et remplace les deux valeurs par celles notées à l'étape 1 (Project URL et anon key):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxx...
```

Puis installe les dépendances et lance l'appli:

```powershell
npm install
npm run dev
```

Ouvre l'URL affichée (en général http://localhost:5173), connecte-toi avec l'email/mot de passe créé à l'étape 1.7, et teste l'ajout de matériel, clients, fournisseurs, achats et commandes.

---

## 3. Déployer gratuitement (Vercel)

L'idée: le frontend est juste des fichiers statiques (HTML/JS/CSS) qui parlent directement à Supabase depuis le navigateur — pas besoin d'un serveur à faire tourner. Vercel héberge ça gratuitement.

1. Crée un dépôt Git pour ce projet et pousse-le sur GitHub (privé si tu préfères — Vercel gère les deux).
   ```powershell
   cd "C:\Users\AYMANE\Desktop\equipment-loan-app"
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Puis crée un repo vide sur https://github.com/new et suis les instructions `git remote add origin ...` / `git push`.
2. Va sur https://vercel.com, crée un compte gratuit (connecte-toi avec GitHub).
3. Clique **Add New** → **Project**, choisis ton repo.
4. Quand Vercel demande le **Root Directory**, mets `frontend`.
5. Dans **Environment Variables**, ajoute:
   - `VITE_SUPABASE_URL` = ton Project URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = ta anon key Supabase
6. Clique **Deploy**. Après ~1 minute, Vercel te donne une URL publique (ex: `equipment-loan-app.vercel.app`) que tu peux ouvrir depuis n'importe quel appareil.

Chaque `git push` sur la branche principale redéploiera automatiquement.

### Mettre à jour l'app déjà déployée (comme maintenant)

1. Exécute [`supabase/migration_002_stock_and_orders.sql`](supabase/migration_002_stock_and_orders.sql) dans le SQL Editor de ton projet Supabase (une seule fois).
2. Commit et push le code du dossier `frontend/` sur ton repo GitHub — Vercel redéploiera automatiquement en ~1 minute.

---

## Notes

- La clé "anon" Supabase est publique par design (elle finit dans le code JS envoyé au navigateur) — c'est pour ça que le schéma active la Row Level Security: seules les requêtes d'un utilisateur connecté (celui créé à l'étape 1.6) sont acceptées.
- Pour ajouter un deuxième utilisateur plus tard, répète l'étape 1.7 dans Supabase (Authentication → Users → Add user).
- Limites du plan gratuit Supabase: 500 Mo de base de données, projet mis en pause après 1 semaine d'inactivité (il suffit de le "réveiller" en te reconnectant sur le dashboard). Largement suffisant pour cet usage.
