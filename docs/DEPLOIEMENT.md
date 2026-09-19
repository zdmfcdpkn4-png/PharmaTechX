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

Avec une base, tout le site exige un code de rôle (`middleware.ts`,
décision du 18/09/2026, question 13) : seules `/connexion`,
`/donnees-personnelles` et `/api/sante` restent publiques, ce qui laisse le
contrôle de santé de Render fonctionner. Sans base, le site fonctionne en
**mode ouvert** : contenu consultable, contrôle d'accès inactif, écrans
d'administration remplacés par la marche à suivre. Cet état est signalé sur
la page de connexion et doit être levé avant tout usage du dispositif comme
preuve.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui (hors mode ouvert) | chaîne PostgreSQL ; avec Supabase, la chaîne « Session pooler » (port 5432, utilisateur `postgres.<ref>`, hôte `*.pooler.supabase.com`) ; `POSTGRES_URL` (Vercel) est lue en repli |
| `DATABASE_IP` | non | famille d'adresses pour joindre la base : `4` (défaut), `6`, `auto` ; en `4`, l'hôte est résolu en IPv4 seulement, à chaque connexion, et un hôte sans adresse IPv4 échoue avec un message explicite |
| `AUTH_SECRET` | oui | signature des sessions et des sceaux de résultats, ≥ 32 caractères (`openssl rand -base64 32`) |
| `BASE_ATTENDUE` | non | `service` ou `essai` : étiquette d'instance attendue de la base (question 23). Absente et base sans étiquette : aucun contrôle. Une base étiquetée n'est servie qu'à l'environnement qui la réclame |
| `DATABASE_SSL` | non | `disable` (défaut sur hôte local), `require` (défaut ailleurs : chiffre sans vérifier l'autorité), `verify` (+ `DATABASE_SSL_CA` ou `DATABASE_SSL_CA_FILE`, certificat de l'autorité de Supabase) |
| `DATABASE_POOL_MAX` | non | connexions simultanées, 5 par défaut ; 3 avec le pooler de session |
| `BLOB_READ_WRITE_TOKEN` | non | Vercel Blob pour les documents ; sans lui, les fichiers vont en base (15 Mo max). Les adresses Blob sont publiques : incompatible avec la réserve des documents aux sessions (question 13), à laisser vide |
| `CONSERVATION_RAPPORTS` | non | `aucune` (défaut) ou `pseudonyme` (rapports enregistrés sous identifiant d'agent, sans nom) — voir `docs/RGPD.md` avant d'activer |
| `RAPPORTS_CONSERVATION_MOIS` | non | durée annoncée sur les rapports enregistrés |
| `PROCEDURE_HABILITATION` | non | référence de la procédure interne portée sur les écrans et les rapports (preuve opposable de l'étape 2) ; vide = marqueur `[à compléter]` |
| `MISE_EN_SERVICE` | non | date (AAAA-MM-JJ) de mise en service comme preuve ; absente = phase d'essai, mention « Phase d'essai — ne vaut pas preuve » sur les écrans et les rapports |

Changer `AUTH_SECRET` déconnecte toutes les sessions et invalide les sceaux
des résultats non encore émis (ceux tenus en mémoire des onglets ouverts) ;
les rapports déjà enregistrés ne sont pas affectés (leur empreinte est un
SHA-256, pas un HMAC). Depuis la décision du 18/09/2026 (question 16, choix b), une session est
aussi fermée dès que son code d'accès est révoqué ou supprimé ; le premier
déploiement de cette version ferme une fois les sessions ouvertes avant elle.

## Supabase (base)

**Pourquoi IPv4.** L'hôte de connexion directe d'un projet Supabase
(`db.<ref>.supabase.co`, port 5432) ne porte qu'une adresse IPv6, sauf
option payante « IPv4 address » `[à vérifier]`. Mesuré le 19/09/2026 sur le
projet de l'établissement : cet hôte ne publie **aucun enregistrement A**
(`ENODATA`) et un seul `AAAA` ; l'hôte d'API `<ref>.supabase.co`, lui, est
bien en IPv4, mais il ne sert que l'API REST, pas PostgreSQL. Render ne sort pas en IPv6
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
   région **Union européenne** (Francfort, `eu-central-1`, comme le service) ;
   mot de passe de base fort, conservé dans le coffre de la DSI. Le projet de
   l'établissement, ouvert avant cette note, est en `eu-west-1` (Irlande) :
   Union européenne, donc conforme au registre RGPD, mais pas la région du
   service. L'écart coûte un aller-retour réseau de plus à chaque requête
   `[à vérifier]` ; il est accepté — la région d'un projet Supabase ne se
   change pas après coup `[à vérifier]`, il faudrait recréer et migrer.
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
- `AUTH_SECRET` : 32 caractères au moins (`openssl rand -base64 32`, ou la
  valeur générée par Render). **Sans lui, aucune session ne s'ouvre** : le
  site répond, mais aucun code d'accès ne fonctionne ;
- `DATABASE_SSL` : `require`, ou supprimer la variable (défaut pour un hôte
  non local) ; `disable`, posé pour la base interne de Render, ne convient
  plus ;
- `DATABASE_IP` : `4` (défaut du code ; le poser rend le choix visible) ;
- `DATABASE_POOL_MAX` : `3` ;
- `CONSERVATION_RAPPORTS` : `aucune` ou `pseudonyme` — identifiants d'agents,
  rapports enregistrés et circuit de visas n'existent qu'en `pseudonyme`
  (question 6) ;
- `MISE_EN_SERVICE`, `PROCEDURE_HABILITATION`, `BASE_ATTENDUE` : vides en
  phase d'essai (voir « Mise en service »).

> **Un service créé à la main ne reçoit aucune variable du blueprint.**
> `render.yaml` ne s'applique qu'à un service créé ou mis à jour par
> « Apply » ; le service en ligne a été créé à la main le 18/09/2026. Sa
> signature dans `/api/sante` : `base: "non-configuree"` **et**
> `secret: "absent"` — constatée le 19/09/2026. Conséquences, à connaître :
> sans base, le filtre d'entrée **laisse tout le site ouvert** (il ne garde
> que si une base est configurée), aucun code d'accès n'existe, et les écrans
> d'administration affichent « Base de données non branchée ». Ce n'est pas
> une panne du site : ce sont les variables qui manquent.

Enregistrer : Render redéploie. Puis `/api/sante` doit répondre
`base: "joignable"`, `base_ip: "4"`, `base_erreur: null`. En cas d'échec,
`base_erreur` donne le code : `ENOTFOUND` = hôte sans adresse IPv4 (URI de
connexion directe au lieu du pooler), `28P01` = mot de passe, `ECONNREFUSED`,
`ETIMEDOUT` ou `DELAI_CONNEXION` = projet en pause ou port faux, `3D000` = nom
de base, `SSL_NON_SUPPORTE` = le serveur refuse TLS (`[à vérifier]` le réglage
SSL du pooler ; ne pas passer `DATABASE_SSL` à `disable` sur l'internet public).

**Le cas `28P01`.** Il ne survient qu'après une connexion établie : l'hôte, le
port, l'utilisateur et le nom de base sont donc justes, et seul le mot de passe
est en cause. Trois pièges, dans cet ordre de fréquence : un **caractère
spécial non encodé** — `#` et `?` tronquent la chaîne en silence, `@` et `/`
la coupent, `%` mal suivi fausse le décodage ; un **espace ou un saut de ligne**
collé au début ou à la fin de la valeur ; un mot de passe **antérieur à une
réinitialisation**. Le plus sûr est un mot de passe **alphanumérique** d'au
moins 24 caractères : aucun encodage n'est alors nécessaire, et l'entropie
dépasse encore 140 bits (62²⁴ ≈ 2¹⁴³).

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
18/09/2026 (hors blueprint). Le dépôt porte deux branches depuis le
18/09/2026 (question 21, choix c) : la branche de travail
(`claude/relaxed-brahmagupta-hktyk5`), où tout se développe et se vérifie, et
`production`, qui porte la version en service — voir « Branche de production
et version en service » ci-dessous.

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

**Branche de production et version en service** (question 21, choix c, du
18/09/2026). Render ne déploie qu'une branche. `production` porte la version
en service, la branche de travail porte tout le reste. Une mise en service se
fait en trois gestes, à consigner au dossier qualité :

```bash
git checkout production
git merge --no-ff claude/relaxed-brahmagupta-hktyk5 -m "Mise en service vN"
git tag -a vN -m "Mise en service du JJ/MM/AAAA"   # N = 1 à la première
git push -u origin production && git push origin vN
```

Créée le 18/09/2026 au commit de la branche de travail, `production` ne porte
encore aucune version en service : la première étiquette sera `v1`, à la
première mise en service.

L'étiquette fixe dans le dépôt ce qui était en service et depuis quand : un
rapport contesté se relit avec le code exact qui l'a produit (`git checkout
vN`), sans dépendre de l'historique des déploiements de l'hébergeur.
`/api/sante` renvoie le commit et la branche déployés (`RENDER_GIT_COMMIT`,
`RENDER_GIT_BRANCH`) ; `git tag --points-at <commit>` donne l'étiquette
correspondante. À consigner à chaque mise en service : date, étiquette,
commit.

**Le réglage de l'hébergeur reste à faire, et seulement à la mise en
service** : tableau de bord Render → service `pharmatechx` → Settings →
branche déployée = `production` (`[à vérifier]` le libellé exact du réglage,
la documentation de Render n'étant pas joignable depuis l'environnement de
travail). Tant qu'il n'est pas changé, c'est la branche de travail qui est en
ligne et le site suit chaque poussée : c'est ce qu'il faut pendant la phase
d'essai. Une fois changé, le site en ligne ne bouge plus qu'aux mises en
service, et la branche de travail ne se vérifie plus qu'en local — un second
service Render pour l'essai coûterait un second plan payant.

**L'étiquette de version ne dit rien de la base : celle-ci porte la sienne**
(question 23, choix b, du 18/09/2026). Le schéma s'applique de lui-même au
premier accès (`lib/schema.ts`) et il ne fait pas qu'ajouter : trois
instructions retirent des colonnes. Une version d'essai branchée sur la base
en service la ferait évoluer sans retour possible, et y écrirait ses rapports
d'essai, au milieu de ceux qui valent preuve.

La base porte donc une étiquette — table `parametres`, clé `instance`,
valeur `service` ou `essai` — et l'environnement déclare celle qu'il attend
(`BASE_ATTENDUE`). La règle est dirigée par l'étiquette inscrite, non par la
présence de la variable :

| Étiquette de la base | Environnement | Effet |
|---|---|---|
| aucune | ne déclare rien | rien n'est vérifié — développement local |
| aucune | `essai` ou `service` | l'étiquette s'inscrit au premier accès |
| `service` ou `essai` | la même | la base est servie |
| `service` ou `essai` | rien, ou une autre | **refus** |

Refus : le schéma n'est pas appliqué, aucune requête n'aboutit, le journal du
service porte `[base] refus d'instance : …`, et `/api/sante` répond 503 avec
`base: "refusee"`, `base_instance` et `base_refus`. Le contrôle de santé
échoue donc comme pour une base injoignable — `[à vérifier]` les conséquences
côté Render (point 4 plus haut). L'écran de connexion, lui, s'affiche encore :
il ne touche pas à la base ; toute action qui l'exige échoue.

**À la mise en service.** La base est aujourd'hui sans étiquette et le
service ne déclare rien : le contrôle est inactif, et il n'y a rien à
protéger. Poser `BASE_ATTENDUE=service` dans le tableau de bord au moment de
la mise en service suffit — l'étiquette s'inscrit au premier accès, et la
base n'est plus servie qu'à un environnement qui la réclame. Pour rétiqueter
une base déjà marquée (une base d'essai devenue base en service) :

```sql
UPDATE parametres SET valeur = to_jsonb('service'::text), modifie_par = 'mise en service'
 WHERE cle = 'instance';
```

Vérifier une fois : `/api/sante` doit donner `base_instance: "service"` et
`base_refus: null`.

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
   rapports), `RAPPORTS_CONSERVATION_MOIS` si une durée est annoncée,
   `BASE_ATTENDUE=service` (étiquette d'instance : `/api/sante` doit ensuite
   donner `base_instance: "service"`), et branche déployée mise sur
   `production`.
5. **Présentation** : porter sur les rapports le logo « Pharmacotechnie —
   unité de production des chimiothérapies » (`public/pharmaco-logo.jpg`,
   déposé le 18/09/2026 en attente de cette étape ; question 24, choix b). Le
   logo est incorporé en data URI dans chaque rapport : en produire une
   réduction — une cinquantaine de kilo-octets au plus — avant de remplacer
   `public/pharmaco-web.png`, et reprendre la hauteur de la classe
   `.pharmaco` dans `lib/rapport.ts`, ce logo étant en portrait et non carré.
   Ici et pas après : deux générations de rapports pour un même dispositif se
   justifient mal. L'icône d'onglet, elle, porte déjà l'emblème de ce logo
   (`public/pharmaco-icone.png`).
6. **Comptes** : administrateur initial créé puis remplacé par des codes
   nominaux de fonction (jamais des noms), codes tuteur, signature du
   pharmacien déposée, identifiants d'agents créés et correspondance tenue hors
   du site.
7. **Sauvegarde** : un `pg_dump` réalisé par le pooler de session et restauré
   sur une base locale avant le premier rapport réel, puis un essai annuel
   (question 32 ; voir ci-dessous).
8. **Procédure interne** publiée, qui décrit le dispositif, le visa par clic,
   la signature incrustée, la correspondance des identifiants, la purge
   manuelle, la conservation, et le classement au dossier d'habilitation du
   rapport A4 **avec son paquet d'archivage** (question 33, choix b).
9. **Mise en service prononcée** : poser `MISE_EN_SERVICE` à sa date
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
  conservation des rapports.

**Ce que la sauvegarde protège** (décision du 19/09/2026, question 32) : la
pièce de référence est **le rapport visé, classé au dossier d'habilitation**,
non la base. La base est l'outil de travail : le registre, le suivi par agent
et la banque de questions. La sauvegarde protège donc la continuité du
service et la traçabilité d'ensemble, pas la preuve elle-même, qui vit au
dossier.

Le régime retenu suit de là : les **sauvegardes quotidiennes du plan Pro**
`[à vérifier]`, plus un **`pg_dump` conservé dans l'établissement avant
chaque mise en service**, c'est-à-dire à chaque version étiquetée. Essai de
restauration **annuel**, en plus de celui qui précède le premier rapport
réel. Responsable du dépôt et support de conservation : `[à préciser]`.

Réserve à connaître : le rapport imprimé porte son numéro et son empreinte,
mais recalculer cette empreinte suppose le résultat scellé, qui vit en base
ou dans le paquet d'archivage (JSON). Sans l'un ni l'autre, le document
classé vaut par ses visas, non par une vérification cryptographique.

Avec Vercel Blob, les fichiers déposés seraient à sauvegarder à part.

## Mise à jour

Chaque push sur la branche déployée reconstruit le site. Le schéma est
idempotent : une nouvelle version ajoute ses tables au premier accès. Une
migration destructive (renommer, supprimer une colonne) n'est pas prévue et se
ferait par un script à part, documenté dans `lib/schema.ts`.
