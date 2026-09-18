# Formation & habilitation — Unité de pharmacotechnie, CHD Vendée

Application de formation et d'évaluation de l'équipe de production.
Next.js 15 (App Router), TypeScript, Vercel Postgres + Blob.

---

## 1. Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
```

Sans base de données, l'application tourne en **mode ouvert** : tout le contenu
est consultable, le contrôle d'accès est inactif et les écrans
d'administration affichent la marche à suivre. C'est voulu — on peut déployer
avant d'avoir provisionné quoi que ce soit.

## 2. Déployer

```bash
npx vercel login
npx vercel --prod
```

Puis, sur vercel.com, projet `formation-pharmacotechnie` :

| Étape | Où | Quoi |
|---|---|---|
| 1 | Storage → Create Database | **Postgres** → Connect to project |
| 2 | Storage → Create | **Blob** → Connect to project |
| 3 | Settings → Environment Variables | `AUTH_SECRET` = chaîne aléatoire ≥ 32 caractères |
| 4 | Deployments | Redeploy |
| 5 | `/connexion` | « Créer l'administrateur initial » — **le code ne s'affiche qu'une fois** |

`POSTGRES_URL` et `BLOB_READ_WRITE_TOKEN` se branchent automatiquement aux
étapes 1 et 2. Générer un secret : `openssl rand -base64 32`.

## 3. Les trois rôles

| Rôle | Peut faire |
|---|---|
| **admin** | Tout : créer et révoquer tous les codes, déposer et supprimer des documents, ordonner les modules |
| **tuteur** | Déposer des documents, ordonner les modules, créer et révoquer les codes de poste — pas les codes admin ni tuteur |
| **poste** | Suivre son programme et passer les évaluations. Un code par profil, créé par un admin ou un tuteur |

Un code **ne désigne pas une personne** : il ouvre un profil. Les codes sont
stockés hachés (scrypt, sel par code) — la base ne permet pas de les relire.
Un code perdu se remplace, il ne se retrouve pas.

La hiérarchie est appliquée côté serveur dans chaque action (`app/actions.ts`,
fonction `exigerRole`), jamais seulement par l'affichage de l'écran.

## 4. Ce qui est stocké, et ce qui ne l'est pas

**Stocké** (configuration du site) :
- `acces` — codes hachés, rôle, libellé de profil, filière, niveau
- `ordonnancement` — rang des modules par parcours
- `depots` — index des documents ; les fichiers sont en Blob

**Jamais stocké** :
- aucun nom, matricule ou identifiant de personne
- aucun résultat d'évaluation — ils vivent en mémoire de l'onglet, puis dans
  le rapport HTML que l'apprenant télécharge sur son poste
- le serveur d'évaluation ne reçoit qu'un identifiant de module et des
  identifiants d'options cochées

**Invariant de confidentialité** : les bonnes réponses ne quittent jamais le
serveur avant soumission. Garanti mécaniquement par `import "server-only"`
dans `content/store.ts` — tout import du contenu depuis un composant client
fait échouer le build.

## 5. Données de la fiche d'habilitation

7 blocs, 58 critères (44 obligatoires), transcrits sans réécriture depuis la
fiche d'habilitation préparateur de l'unité.

- Socle transversal **N1a** : blocs 1 et 3 — prérequis aux deux parcours
- Parcours **Chimiothérapie** N1c → N2 : blocs 2, 4, 5
- Parcours **Préparatoire** P1 → P2 : bloc 6
- **Encadrement N3** : bloc 7
- Maintien : 6 jours de prise de poste par trimestre, réévaluation tous les 2 ans

### Deux points en attente d'arbitrage pharmacien

Déjà signalés lors de la rédaction de la fiche, jamais tranchés depuis. Ils
sont exposés dans `arbitrageEnAttente` (`content/habilitation.ts`) et affichés
comme tels sur le site :

1. le marquage « O » des critères obligatoires — proposition, sans base
   réglementaire item par item ;
2. la correspondance blocs ↔ niveaux — adaptation destinée à préserver la
   logique N1/N2/N3 malgré la restructuration thématique.

## 6. Formats d'évaluation

| Format | Notation |
|---|---|
| **QCM** | Tout ou rien : la réponse doit correspondre exactement à l'ensemble attendu |
| **QIM** | Barème à discordance : 0 → 1 pt, 1 → 0,5 pt, ≥ 2 → 0 |
| **Mise en situation** | Vignette + questions rattachées, tirées ensemble |

Une question **éliminatoire** invalide le critère quel que soit le score, et
elle est toujours incluse dans le tirage. Le barème QIM est dans
`BAREME_QIM` (`content/types.ts`) — **valeur à confirmer**.

## 7. Où éditer quoi

| Besoin | Fichier |
|---|---|
| Blocs, critères, niveaux, filières, étapes, maintien | `content/habilitation.ts` |
| Génération des emplacements de module | `content/parcours.ts` |
| Un module rédigé | `content/modules/*.ts` |
| Rôles, codes, sessions | `lib/auth.ts` |
| Schéma et requêtes | `lib/db.ts` |
| Actions d'administration | `app/actions.ts` |
| Couleurs et charte HdV | `app/globals.css` (bloc `:root`) |
| Logos | `public/hdv.png`, `public/pharmaco-web.png` |

### Charte graphique

Bleu `#005586`, rose `#E82A63` (primaires, majoritaires), turquoise `#46B4B3`
et jaune `#F4C137` (accents ponctuels). Barre rose verticale à gauche,
bandeau bleu en pied. Police Aptos, Inter en repli web.

## 8. Reste à faire

- Rédiger les 56 modules restants (2 sur 58 sont écrits).
- Rattacher les procédures internes du portfolio (CHD-FT1647, CHD-FT1645,
  CHD-FT482, PHAR-FT160, DSN-FT001…) via l'écran de dépôt.
- Trancher les deux points d'arbitrage du §5 et le barème QIM.
- Statuer sur le caractère opposable du dispositif en audit BPP 2023 / ISO 9001.
- Fournir l'axe « poste de travail » s'il doit exister : la fiche raisonne en
  filières et niveaux, pas en postes.

## 9. Limites connues

- L'ordonnancement se saisit comme une liste d'identifiants séparés par des
  virgules. Un glisser-déposer serait plus confortable.
- Aucune purge automatique des dépôts orphelins.
- Les sessions durent 12 h et ne sont pas révocables individuellement :
  révoquer un code empêche les connexions suivantes, pas les sessions ouvertes.
- Pas de journal d'audit des actions d'administration.
