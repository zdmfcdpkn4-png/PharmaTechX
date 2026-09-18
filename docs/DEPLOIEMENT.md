# Déploiement — Render (service) et Supabase (base), Vercel (repli)

Le site est un projet Next.js 15 (App Router) qui parle à une base PostgreSQL
standard par `pg`. Il tourne sans changement de code sur Render (processus
Node) et sur Vercel (fonctions Node), avec une base PostgreSQL chez n'importe
quel fournisseur. Le schéma de la base est appliqué automatiquement au premier
accès ; il n'y a aucune migration à lancer.

**Hébergeur du service retenu le 18/09/2026 (question 8, choix a) : Render**,
région Francfort. **Base retenue le 18/09/2026 : Supabase** (PostgreSQL
managé), à la demande du pharmacien responsable, jointe **en IPv4** par le
pooler de session de Supabase : voir « Supabase (base) » ci-dessous. Le
statut opposable du dispositif (question 7, choix b) écarte les plans
gratuits pour la mise en service. Vercel reste documenté comme solution de
repli, non retenue. L'accord de la DSI et l'avis du DPO restent à obtenir
avant la mise en service : voir « Mise en service » ci-dessous et
`docs/RGPD.md`.

Sans base, le site fonctionne en **mode ouvert** : contenu consultable,
contrôle d'accès inactif, écrans d'administration remplacés par la marche à
suivre. Cet état est signalé sur la page de connexion et doit être levé avant
tout usage du dispositif comme preuve.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui (hors mode ouvert) | chaîne PostgreSQL ; avec Supabase, la chaîne « Session pooler » (port 5432, utilisateur `postgres.<ref>`, hôte `*.pooler.supabase.com`) ; `POSTGRES_URL` (Vercel) est lue en repli |
| `DATABASE_IP` | non | famille d'adresses pour joindre la base : `4` (défaut), `6`, `auto` ; en `4`, l'hôte est résolu en IPv4 seulement, à chaque connexion, et un hôte sans adresse IPv4 échoue avec un message explicite |
| `AUTH_SECRET` | oui | signature des sessions et des sceaux de résultats, ≥ 32 caractères (`openssl rand -base64 32`) |
| `DATABASE_SSL` | non | `disable` (défaut sur hôte local), `require` (défaut ailleurs : chiffre sans vérifier l'autorité), `verify` (+ `DATABASE_SSL_CA` ou `DATABASE_SSL_CA_FILE`, certificat de l'autorité de Supabase) |
| `DATABASE_POOL_MAX` | non | connexions simultanées, 5 par défaut ; 3 avec le pooler de session |
| `BLOB_READ_WRITE_TOKEN` | non | Vercel Blob pour les documents ; sans lui, les fichiers vont en base (15 Mo max) |
| `CONSERVATION_RAPPORTS` | non | `aucune` (défaut) ou `pseudonyme` (rapports enregistrés sous identifiant d'agent, sans nom) — voir `docs/RGPD.md` avant d'activer |
| `RAPPORTS_CONSERVATION_MOIS` | non | durée annoncée sur les rapports enregistrés |
| `PROCEDURE_HABILITATION` | non | référence de la procédure interne portée sur les écrans et les rapports (preuve opposable de l'étape 2) ; vide = marqueur `[à compléter]` |
| `MISE_EN_SERVICE` | non | date (AAAA-MM-JJ) de mise en service comme preuve ; absente = phase d'essai, mention « Phase d'essai — ne vaut pas preuve » sur les écrans et les rapports |

Changer `AUTH_SECRET` déconnecte toutes les sessions et invalide les sceaux
des résultats non encore émis (ceux tenus en mémoire des onglets ouverts) ;
les rapports déjà enregistrés ne sont pas affectés (leur empreinte est un
SHA-256, pas un HMAC).

## Supabase (base)

**Pourquoi IPv4.** L'hôte de connexion directe d'un projet Supabase
(`db.<ref>.supabase.co`, port 5432) ne porte qu'une adresse IPv6, sauf
option payante « IPv4 address » `[à vérifier]`. Render ne sort pas en IPv6
`[à vérifier]` : depuis le service, cet hôte est injoignable (`ENETUNREACH`
sur une adresse IPv6). Le **pooler de session** de Supabase (Supavisor,
hôte `aws-<n>-<région>.pooler.supabase.com`, port 5432, utilisateur
`postgres.<ref>`) est joignable en IPv4, et une connexion y vaut une
connexion directe : c'est lui que `DATABASE_URL` désigne. Le code impose la
famille IPv4 (`DATABASE_IP=4` par défaut, `lib/reseau.ts`) : l'hôte est
résolu en IPv4 à chaque connexion, jamais figé, et un hôte sans adresse IPv4
échoue avec un message qui le dit. Le pooler de transaction (port 6543)
n'est pas retenu : conçu pour les fonctions éphémères, il ne conserve pas
l'état de session ; le service est un processus persistant.

**Créer le projet.**

1. Sur supabase.com : nouveau projet dans l'organisation de l'établissement,
   région **Union européenne** (Francfort, `eu-central-1`, comme le service ;
   `[à préciser]` la région si le projet existe déjà, à consigner au registre
   RGPD) ; mot de passe de base fort, conservé dans le coffre de la DSI.
2. Tableau de bord → **Connect** → **Session pooler** : copier l'URI et y
   remplacer `[YOUR-PASSWORD]` (caractères spéciaux encodés : `@` devient
   `%40`). `[à vérifier]` l'intitulé exact de l'onglet et le nom d'hôte, la
   documentation de Supabase n'étant pas joignable depuis l'environnement de
   travail.
3. **API de données à couper.** Supabase expose par défaut le schéma `public`
   par une API REST (PostgREST) avec une clé « anon » conçue pour être
   publique. Le site n'utilise ni l'une ni l'autre. Le schéma active la
   sécurité au niveau des lignes (RLS) sur chaque table, sans politique, et
   retire les droits des rôles de l'API (`anon`, `authenticated`) : les tables
   sont inaccessibles par l'API même si la clé circule. En plus, dans le
   tableau de bord, **Project Settings → Data API** : retirer `public` des
   schémas exposés, ou désactiver l'API (`[à vérifier]` l'intitulé). Le site
   se connecte avec le rôle `postgres` de l'URI, propriétaire des tables qu'il
   crée, qui n'est pas soumis à RLS ; un autre rôle ne verrait aucune ligne.
4. **TLS.** `DATABASE_SSL=require` (défaut pour un hôte non local) chiffre
   sans vérifier l'autorité. Pour `verify` : télécharger le certificat de
   l'autorité de Supabase (Project Settings → Database → SSL) et le poser
   dans `DATABASE_SSL_CA` ou `DATABASE_SSL_CA_FILE` ; `[à vérifier]` qu'il
   couvre le pooler. Activer « Enforce SSL on incoming connections »
   (`[à vérifier]` disponibilité selon le plan).

**Brancher le service.** Tableau de bord Render → service `pharmatechx` →
Environment :

- `DATABASE_URL` : URI du pooler de session ;
- `DATABASE_SSL` : `require`, ou supprimer la variable (défaut pour un hôte
  non local) ; `disable`, posé pour la base interne de Render, ne convient
  plus ;
- `DATABASE_IP` : `4` (défaut du code ; le poser rend le choix visible) ;
- `DATABASE_POOL_MAX` : `3`.

Enregistrer : Render redéploie. Puis `/api/sante` doit répondre
`base: "joignable"`, `base_ip: "4"`, `base_erreur: null`. En cas d'échec,
`base_erreur` donne le code : `ENOTFOUND` = hôte sans adresse IPv4 (URI de
connexion directe au lieu du pooler), `28P01` = mot de passe, `ECONNREFUSED`,
`ETIMEDOUT` ou `DELAI_CONNEXION` = projet en pause ou port faux, `3D000` = nom
de base, `SSL_NON_SUPPORTE` = le serveur refuse TLS (`[à vérifier]` le réglage
SSL du pooler ; ne pas passer `DATABASE_SSL` à `disable` sur l'internet public).

**Reprendre les données de la base Render** (facultatif : en phase d'essai,
repartir d'une base vide est possible, le schéma se recrée au premier accès
et l'administrateur initial depuis `/connexion`). Depuis un poste avec
`pg_dump` et `pg_restore` (version 16 ou plus, réseau IPv4) :

```bash
# 1. exporter depuis Render (chaîne externe de la base Render, TLS requis)
pg_dump "$RENDER_EXTERNE" --format=custom --no-owner --no-privileges --file=formation_render.dump
# 2. restaurer dans Supabase par le pooler de session (jamais le port 6543)
pg_restore --no-owner --no-privileges --schema=public --dbname="$SUPABASE_SESSION" formation_render.dump
```

`--no-owner` : le rôle change (`formation` chez Render, `postgres` chez
Supabase). Le schéma se réapplique au premier accès, RLS comprise. Vérifier
depuis l'administration (banque, `/admin/rapports`, journal) avant de
supprimer la base Render.

**Plan gratuit.** État au 18/09/2026 (phase d'essai). Connu au 18/09/2026 et
non vérifiable depuis l'environnement de travail, `[à vérifier]` sur
supabase.com/pricing : un projet gratuit est **mis en pause après une
semaine sans activité** et ne repart que par le tableau de bord (« Restore
project »), alors que le service Render se réveille seul ; à la reprise, le
site répond `base: "injoignable"` (503), affiche des erreurs et un
déploiement Render échoue tant que le projet n'est pas restauré ; **aucune
sauvegarde** automatique ; base limitée à 500 Mo ; deux projets gratuits par
organisation ; sort d'un projet longtemps en pause `[à vérifier]` (délai de
restauration, suppression). Un `pg_dump` dès que du contenu compte, et le
plan Pro (sauvegardes quotidiennes `[à vérifier]`) avant la mise en service.

**Supprimer la base Render** une fois la migration vérifiée : tableau de
bord Render → base → Delete. La base gratuite de Render est de toute façon à
durée limitée `[à vérifier]`.

## Render (service)

**Service en ligne : <https://pharmatechx.onrender.com>**, créé à la main le
18/09/2026 (hors blueprint). Le dépôt GitHub n'a qu'une branche
(`claude/relaxed-brahmagupta-hktyk5`) : c'est elle que Render déploie, et
chaque poussée reconstruit le site en ligne tant qu'une branche de production
distincte n'est pas créée `[à préciser]`.

À vérifier dans le tableau de bord Render, et à consigner :

1. **Plan du service** : payant avant la mise en service (voir « Plans »
   ci-dessous) ; région Francfort.
2. **Base** : `DATABASE_URL` = chaîne du pooler de session Supabase ;
   `DATABASE_SSL=require` ; `DATABASE_IP=4` ; `DATABASE_POOL_MAX` petit.
3. **Variables** : `AUTH_SECRET` (≥ 32 caractères), `NODE_ENV=production`,
   `CONSERVATION_RAPPORTS`, `PROCEDURE_HABILITATION` — voir « Mise en
   service ».
4. **Contrôle de santé** : `healthCheckPath` = `/api/sante` ; auto-déploiement
   sur la branche voulue. Le contrôle répond 503 quand la base est
   injoignable (projet Supabase en pause) : Render tient alors le service
   pour défaillant, `[à vérifier]` les conséquences (redémarrages,
   déploiement refusé).
5. `https://pharmatechx.onrender.com/api/sante` : `base: "joignable"`,
   `base_ip: "4"`, `secret: "defini"`, `conservation` attendue, `commit` =
   commit déployé.
6. `/connexion` → **Créer l'administrateur initial** : le code n'est affiché
   qu'une fois.

Pour recréer le service à partir du blueprint : **New → Blueprint** sur le
dépôt ; Render lit `render.yaml` (service `pharmatechx` seul, Francfort,
`AUTH_SECRET` généré, `DATABASE_URL` demandée à l'application du blueprint) ;
`[à vérifier]` le comportement de Render si un service du même nom existe
déjà (doublon ou refus).

**Plans.** Le blueprint demande le plus petit plan payant connu au
18/09/2026 (`starter`). La documentation de Render n'était pas joignable
depuis l'environnement de travail : `[à vérifier]` l'identifiant et le
contenu du plan (mise en veille absente) sur render.com au moment du
déploiement. Un identifiant inconnu est refusé par Render à « Apply ». Le
plan gratuit est exclu pour un dispositif qui sert de preuve : mise en
veille après inactivité.

**État au 18/09/2026.** Service Render et base Supabase sur les plans
gratuits : le site est en phase d'essai (`MISE_EN_SERVICE` absente), et
chaque écran et chaque rapport le dit. Exporter un `pg_dump` dès que du
contenu compte, et passer service et base sur plan payant avant la mise en
service.

**Réseau et TLS.** La base est hors du réseau de Render : TLS requis
(`DATABASE_SSL=require`, ou `verify` avec le certificat de Supabase), famille
IPv4 imposée (`DATABASE_IP=4`). Le service est servi en HTTPS par Render ;
un nom de domaine de l'établissement se déclare dans le tableau de bord
(enregistrement DNS à demander à la DSI). Restreindre l'accès à la base aux
adresses sortantes du service : Render publie les adresses sortantes d'un
service (« Outbound IPs ») et Supabase accepte une liste d'adresses
autorisées (« Network restrictions »), `[à vérifier]` l'un et l'autre, et la
disponibilité selon le plan.

**Source de temps.** Les dates des rapports sont celles de l'horloge du
serveur. `/api/sante` renvoie `horloge` (ISO 8601, UTC) : la comparer à une
horloge de référence de l'établissement avant la mise en service, puis
périodiquement, et consigner l'écart. La source de temps de l'infrastructure
de Render est `[à vérifier]`.

## Mise en service comme preuve

À dérouler dans l'ordre, et à consigner au dossier qualité avec la date et le
commit déployé (`commit` dans `/api/sante`, ou `git rev-parse HEAD`) :

1. **DPO** : fiche de registre et texte d'information validés (`docs/RGPD.md`),
   base légale arrêtée, contrats de sous-traitance de Render et de Supabase
   et mécanismes de transfert vérifiés.
2. **DSI** : accord sur l'hébergement externe (service chez Render, base chez
   Supabase), nom de domaine, accès depuis le réseau de l'établissement,
   restriction des adresses sortantes, responsable des sauvegardes.
3. **Service et base** sur plans payants, `/api/sante` joignable
   (`base_ip: "4"`), `commit` égal à la version validée, `horloge` comparée
   à une référence.
4. **Variables** : `CONSERVATION_RAPPORTS=pseudonyme`, `PROCEDURE_HABILITATION`
   renseignée (le marqueur `[à compléter]` disparaît des écrans et des
   rapports), `RAPPORTS_CONSERVATION_MOIS` si une durée est annoncée.
5. **Comptes** : administrateur initial créé puis remplacé par des codes
   nominaux de fonction (jamais des noms), codes tuteur, signature du
   pharmacien déposée, identifiants d'agents créés et correspondance tenue hors
   du site.
6. **Sauvegarde** : un `pg_dump` réalisé par le pooler de session et restauré
   sur une base locale avant le premier rapport réel (voir ci-dessous).
7. **Procédure interne** publiée, qui décrit le dispositif, le visa par clic,
   la signature incrustée, la correspondance des identifiants, la purge
   manuelle et la conservation.
8. **Mise en service prononcée** : poser `MISE_EN_SERVICE` à sa date
   (AAAA-MM-JJ). La mention « Phase d'essai — ne vaut pas preuve » disparaît
   des écrans et des rapports, remplacée par « en service depuis le … » ;
   `/api/sante` renvoie la date. Les rapports émis avant cette date restent
   marqués « phase d'essai » à l'impression : ils ne valent pas preuve.

## Vercel (repli, non retenu)

1. Importer le dépôt sur vercel.com (framework détecté : Next.js).
2. **Settings → Environment Variables** : `DATABASE_URL` vers la base Supabase
   (pooler de session) et `AUTH_SECRET`. Ou **Storage → Create Database →
   Postgres** (Neon) → *Connect to project* : `POSTGRES_URL` est posée
   automatiquement.
3. Facultatif : **Storage → Blob** → *Connect* pour les documents
   (`BLOB_READ_WRITE_TOKEN`). Sans Blob, les fichiers vont en base.
4. Redéployer, puis `/connexion` → **Créer l'administrateur initial**.

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

- **Sauvegardes de Supabase** sur le plan Pro : quotidiennes, rétention
  `[à vérifier]` ; aucune sur le plan gratuit `[à vérifier]` ; elles restent
  chez l'hébergeur.
- **`pg_dump` conservé dans l'établissement**, depuis un poste de la DSI,
  avec la chaîne du pooler de session (port 5432, jamais 6543 ; TLS) :

  ```bash
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="formation_$(date +%F).dump"
  # essai de restauration sur une base locale vide
  pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL_LOCALE" formation_2026-09-18.dump
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
