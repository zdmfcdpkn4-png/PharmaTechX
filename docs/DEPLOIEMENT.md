# Déploiement — Render ou Vercel

Le site est un projet Next.js 15 (App Router) qui parle à une base PostgreSQL
standard par `pg`. Il tourne sans changement de code sur Render (processus
Node) et sur Vercel (fonctions Node). Le schéma de la base est appliqué
automatiquement au premier accès ; il n'y a aucune migration à lancer.

Sans base, le site fonctionne en **mode ouvert** : contenu consultable,
contrôle d'accès inactif, écrans d'administration remplacés par la marche à
suivre. Cet état est signalé sur la page de connexion et doit être levé avant
tout usage du dispositif comme preuve.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui (hors mode ouvert) | chaîne PostgreSQL ; `POSTGRES_URL` (Vercel) est lue en repli |
| `AUTH_SECRET` | oui | signature des sessions et des sceaux de résultats, ≥ 32 caractères (`openssl rand -base64 32`) |
| `DATABASE_SSL` | non | `disable` (défaut sur hôte local ou réseau interne Render), `require` (défaut ailleurs), `verify` (+ `DATABASE_SSL_CA` ou `DATABASE_SSL_CA_FILE`) |
| `DATABASE_POOL_MAX` | non | connexions simultanées, 5 par défaut ; 2 ou 3 sur un plan gratuit |
| `BLOB_READ_WRITE_TOKEN` | non | Vercel Blob pour les documents ; sans lui, les fichiers vont en base (15 Mo max) |
| `CONSERVATION_RAPPORTS` | non | `aucune` (défaut) ou `pseudonyme` (rapports enregistrés sous identifiant d'agent, sans nom) — voir `docs/RGPD.md` avant d'activer |
| `RAPPORTS_CONSERVATION_MOIS` | non | durée annoncée sur les rapports enregistrés |

Changer `AUTH_SECRET` déconnecte toutes les sessions et invalide les sceaux
des résultats non encore émis (ceux tenus en mémoire des onglets ouverts) ;
les rapports déjà enregistrés ne sont pas affectés (leur empreinte est un
SHA-256, pas un HMAC).

## Render

1. Pousser le dépôt sur GitHub.
2. Sur render.com : **New → Blueprint**, choisir le dépôt. Render lit
   `render.yaml` : un service web Node (Frankfurt, plan gratuit) et une base
   PostgreSQL gratuite, `DATABASE_URL` branchée, `AUTH_SECRET` généré.
3. **Apply**. Le premier déploiement construit le site (`npm ci && npm run build`).
4. Ouvrir `https://<service>.onrender.com/api/sante` : `base: "joignable"`.
5. Ouvrir `/connexion` → **Créer l'administrateur initial** : le code n'est
   affiché qu'une fois.

Limites du plan gratuit, à vérifier au moment du déploiement : mise en veille
après inactivité (première ouverture lente), base gratuite à durée limitée
`[à vérifier]`. Un plan payant lève ces deux limites. La base Render est sur le
réseau interne : `DATABASE_SSL=disable` convient ; pour une base externe
(Supabase, Neon), passer à `require`.

## Vercel

1. Importer le dépôt sur vercel.com (framework détecté : Next.js).
2. **Storage → Create Database → Postgres** (Neon) → *Connect to project* :
   `POSTGRES_URL` est posée automatiquement. Ou saisir `DATABASE_URL` vers une
   base externe.
3. Facultatif : **Storage → Blob** → *Connect* pour les documents
   (`BLOB_READ_WRITE_TOKEN`). Sans Blob, les fichiers vont en base.
4. **Settings → Environment Variables** : `AUTH_SECRET`.
5. Redéployer, puis `/connexion` → **Créer l'administrateur initial**.

Le fichier `render.yaml` est ignoré par Vercel. Aucun `vercel.json` n'est
nécessaire.

## En local

```bash
cp .env.example .env         # renseigner DATABASE_URL et AUTH_SECRET
npm install
npm run dev                  # http://localhost:3000
npm run verifier             # typecheck + lint + tests unitaires
```

Une base locale : `docker run -e POSTGRES_USER=formation -e POSTGRES_PASSWORD=formation -e POSTGRES_DB=formation -p 5432:5432 postgres:16`
puis `DATABASE_URL=postgres://formation:formation@localhost:5432/formation`.

## Sauvegarde et restauration

Tout l'état du site est dans la base (codes hachés, banque de questions,
images, documents si stockés en base, rapports et visas, journal). Une
sauvegarde `pg_dump` régulière suffit ; avec Vercel Blob, les fichiers
déposés sont à sauvegarder à part. Fréquence et responsable : `[à préciser]`.

## Mise à jour

Chaque push sur la branche déployée reconstruit le site. Le schéma est
idempotent : une nouvelle version ajoute ses tables au premier accès. Une
migration destructive (renommer, supprimer une colonne) n'est pas prévue et se
ferait par un script à part, documenté dans `lib/schema.ts`.
