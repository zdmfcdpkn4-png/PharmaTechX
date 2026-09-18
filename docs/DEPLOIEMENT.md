# Déploiement — Render (retenu), Vercel (repli)

Le site est un projet Next.js 15 (App Router) qui parle à une base PostgreSQL
standard par `pg`. Il tourne sans changement de code sur Render (processus
Node) et sur Vercel (fonctions Node). Le schéma de la base est appliqué
automatiquement au premier accès ; il n'y a aucune migration à lancer.

**Hébergeur retenu le 18/09/2026 (question 8, choix a) : Render**, service et
base en région Francfort, plans payants. Le statut opposable du dispositif
(question 7, choix b) écarte les plans gratuits. Vercel reste documenté comme
solution de repli, non retenue. L'accord de la DSI et l'avis du DPO restent à
obtenir avant la mise en service : voir « Mise en service » ci-dessous et
`docs/RGPD.md`.

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
| `PROCEDURE_HABILITATION` | non | référence de la procédure interne portée sur les écrans et les rapports (preuve opposable de l'étape 2) ; vide = marqueur `[à compléter]` |

Changer `AUTH_SECRET` déconnecte toutes les sessions et invalide les sceaux
des résultats non encore émis (ceux tenus en mémoire des onglets ouverts) ;
les rapports déjà enregistrés ne sont pas affectés (leur empreinte est un
SHA-256, pas un HMAC).

## Render

1. Pousser le dépôt sur GitHub.
2. Sur render.com : **New → Blueprint**, choisir le dépôt. Render lit
   `render.yaml` : un service web Node et une base PostgreSQL managée, tous
   deux en région Francfort, `DATABASE_URL` branchée, `AUTH_SECRET` généré.
3. **Apply**. Le premier déploiement construit le site (`npm ci && npm run build`).
4. Ouvrir `https://<service>.onrender.com/api/sante` : `base: "joignable"`.
5. Ouvrir `/connexion` → **Créer l'administrateur initial** : le code n'est
   affiché qu'une fois.

**Plans.** Le blueprint demande les plus petits plans payants connus au
18/09/2026 (`starter` pour le service, `basic-256mb` pour la base). La
documentation de Render n'était pas joignable depuis l'environnement de
travail : `[à vérifier]` les identifiants et le contenu des plans (mise en
veille absente, sauvegardes incluses, rétention, nombre de connexions) sur
render.com au moment du déploiement. Un identifiant inconnu est refusé par
Render à « Apply ». Les plans gratuits sont exclus pour un dispositif qui
sert de preuve : mise en veille après inactivité, base gratuite à durée
limitée, aucune sauvegarde garantie.

**Réseau et TLS.** La base est jointe par le réseau interne de Render :
`DATABASE_SSL=disable` convient. Le service est servi en HTTPS par Render ;
un nom de domaine de l'établissement se déclare dans le tableau de bord
(enregistrement DNS à demander à la DSI). Pour une base externe (Supabase,
Neon), passer `DATABASE_SSL` à `require`.

**Source de temps.** Les dates des rapports sont celles de l'horloge du
serveur. `/api/sante` renvoie `horloge` (ISO 8601, UTC) : la comparer à une
horloge de référence de l'établissement avant la mise en service, puis
périodiquement, et consigner l'écart. La source de temps de l'infrastructure
de Render est `[à vérifier]`.

## Mise en service comme preuve

À dérouler dans l'ordre, et à consigner au dossier qualité avec la date et le
commit déployé (`git rev-parse HEAD`) :

1. **DPO** : fiche de registre et texte d'information validés (`docs/RGPD.md`),
   base légale arrêtée, contrat de sous-traitance de Render et mécanisme de
   transfert vérifiés.
2. **DSI** : accord sur l'hébergement externe, nom de domaine, accès depuis le
   réseau de l'établissement, responsable des sauvegardes.
3. **Blueprint** appliqué sur plans payants, `/api/sante` joignable, `horloge`
   comparée à une référence.
4. **Variables** : `CONSERVATION_RAPPORTS=pseudonyme`, `PROCEDURE_HABILITATION`
   renseignée (le marqueur `[à compléter]` disparaît des écrans et des
   rapports), `RAPPORTS_CONSERVATION_MOIS` si une durée est annoncée.
5. **Comptes** : administrateur initial créé puis remplacé par des codes
   nominaux de fonction (jamais des noms), codes tuteur, signature du
   pharmacien déposée, identifiants d'agents créés et correspondance tenue hors
   du site.
6. **Sauvegarde** : un `pg_dump` réalisé et restauré sur une base locale avant
   le premier rapport réel (voir ci-dessous).
7. **Procédure interne** publiée, qui décrit le dispositif, le visa par clic,
   la signature incrustée, la correspondance des identifiants, la purge
   manuelle et la conservation.

## Vercel (repli, non retenu)

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
images, documents si stockés en base, rapports et visas, journal). Deux
niveaux :

- **Sauvegardes de Render** sur le plan payant de la base : contenu et
  rétention `[à vérifier]` sur render.com ; elles restent chez l'hébergeur.
- **`pg_dump` conservé dans l'établissement**, depuis un poste de la DSI, avec
  la chaîne de connexion externe de la base (tableau de bord Render, TLS
  requis) :

  ```bash
  pg_dump "$DATABASE_URL_EXTERNE" --format=custom --file="formation_$(date +%F).dump"
  # essai de restauration sur une base locale vide
  pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL_LOCALE" formation_2026-09-18.dump
  ```

  Le fichier contient des données pseudonymisées d'agents : il se conserve
  sur un support de l'établissement, à accès restreint, pour la durée de
  conservation des rapports. Fréquence (hebdomadaire proposée) et
  responsable : `[à préciser]`. Un essai de restauration précède le premier
  rapport réel et se renouvelle `[à préciser]`.

Avec Vercel Blob, les fichiers déposés seraient à sauvegarder à part.

## Mise à jour

Chaque push sur la branche déployée reconstruit le site. Le schéma est
idempotent : une nouvelle version ajoute ses tables au premier accès. Une
migration destructive (renommer, supprimer une colonne) n'est pas prévue et se
ferait par un script à part, documenté dans `lib/schema.ts`.
