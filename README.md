# Formation & habilitation — Unité de pharmacotechnie, CHD Vendée

Application de formation et d'évaluation de l'équipe de production :
modules de formation théorique (étape 1 sur 6 de la chaîne d'habilitation),
évaluations QCM · QIM · schéma à compléter (étape 2), banque de questions
déposée par les tuteurs, rapports d'évaluation avec circuit de visas.

Next.js 15 (App Router), TypeScript, PostgreSQL standard (`pg`). Déployable
sur Render ou Vercel sans changement de code — voir `docs/DEPLOIEMENT.md`.

**Un module validé à l'écran ne vaut pas habilitation.** Les étapes 3 à 6
(compagnonnage, évaluation pratique, validation par le pharmacien
responsable, maintien) se déroulent au poste et sur la fiche d'habilitation.

---

## 1. Démarrer

```bash
npm install
cp .env.example .env    # DATABASE_URL, AUTH_SECRET
npm run dev             # http://localhost:3000
npm run verifier        # typecheck + lint + tests unitaires
```

Sans base de données, l'application tourne en **mode ouvert** : tout le
contenu est consultable, le contrôle d'accès est inactif et les écrans
d'administration affichent la marche à suivre. Cet état est affiché sur la
page de connexion et doit être levé avant tout usage comme preuve.

## 2. Déployer

`docs/DEPLOIEMENT.md` détaille Render (blueprint `render.yaml` : service Node
+ base Postgres, rien à saisir) et Vercel (Postgres Neon + Blob facultatif).
Le schéma de la base est appliqué automatiquement au premier accès. Puis
`/connexion` → **Créer l'administrateur initial** : le code n'est affiché
qu'une fois.

## 3. Les trois rôles

| Rôle | Peut faire |
|---|---|
| **admin** | Tout : codes de tous rôles, banque de questions, documents, ordonnancement, signalements, journal, visa « pharmacien responsable », annulation des rapports |
| **tuteur** | Banque de questions (créer, déposer, valider, retirer), mises en situation, documents, ordonnancement, signalements, codes de poste, visa « tuteur » |
| **poste** | Suivre son programme, passer les évaluations et les entraînements, exporter ou émettre son rapport. Profil par défaut : aucun code requis |

Un code **ne désigne pas une personne** : il ouvre un profil. Les codes sont
stockés hachés (scrypt, sel par code). Cinq échecs de connexion bloquent
l'adresse un quart d'heure (adresse hachée, jamais stockée en clair). La
hiérarchie est appliquée côté serveur dans chaque action (`sessionRequise`),
jamais seulement par l'affichage.

## 4. Ce qui est stocké, et ce qui ne l'est pas

**Stocké** (configuration du site) : `acces` (codes hachés), `ordonnancement`,
`depots` (index des documents ; fichiers en Blob ou dans `fichiers`),
`questions` / `situations` / `images` / `depots_questions` (banque déposée),
`signalements` (sans identité), `journal` (rôle et libellé de profil),
`tentatives_connexion` (empreintes d'adresse).

**Jamais stocké** : les réponses transmises pour correction (identifiants de
module et d'options seulement), les résultats — ils vivent en mémoire de
l'onglet, puis dans le rapport que l'apprenant télécharge.

**Sur décision seulement** (`CONSERVATION_RAPPORTS=nominative`) : les
rapports que l'apprenant choisit d'**émettre** sont enregistrés avec le nom
qu'il saisit (`rapports`, `visas`). C'est le seul endroit où un nom entre en
base. Ce mode suppose un cadrage RGPD — voir `docs/QUESTIONS-OUVERTES.md`, A.2.

**Invariant de confidentialité** : les bonnes réponses ne quittent jamais le
serveur avant soumission. Garanti par `import "server-only"` dans
`content/store.ts` et `content/banque-db.ts`.

## 5. Données de la fiche d'habilitation

7 blocs, 58 critères (44 obligatoires), transcrits sans réécriture depuis la
fiche d'habilitation préparateur de l'unité (`content/habilitation.ts`).
Socle N1a (blocs 1 et 3) ; chimiothérapie N1c → N2 (blocs 2, 4, 5) ;
préparatoire P1 → P2 (bloc 6) ; encadrement N3 (bloc 7). Deux points
restent en attente d'arbitrage pharmacien (marquage « O », correspondance
blocs ↔ niveaux) et sont affichés comme tels.

## 6. Formats et barèmes

| Format | Notation |
|---|---|
| **QCM** | Tout ou rien : l'ensemble coché doit être exactement l'ensemble attendu |
| **QIM** | 0 discordance → 1 pt ; 1 → 0,5 ; ≥ 2 → 0. Posée en Vrai/Faux par proposition ; une proposition sans réponse compte comme une discordance |
| **Schéma à compléter** | 1 pt au plus ; chaque légende vaut 1/n, fausse elle le retire, vide elle ne compte pas ; plancher 0. Légende à écrire (accents, casse, articles ignorés ; variantes admises) ou à choisir dans une liste mélangée |
| **Mise en situation** | Vignette + questions rattachées, tirées ensemble |

Une question **éliminatoire** invalide le critère quelle que soit la note, et
elle est toujours incluse dans le tirage. Barèmes QIM et schéma : **à
confirmer** (`BAREME_QIM`, `BAREME_SCH` dans `content/types.ts`).

Deux modes de passation : **évaluation** (correction à la fin, résultat porté
au rapport) et **entraînement** (une question à la fois, correction
immédiate avec justification et source, jamais enregistré ni comptabilisé).

## 7. Banque de questions déposée (profils tuteur et admin)

`/admin/questions` — création dans un formulaire (QCM, QIM, schéma avec
éditeur d'image : cliquer pour poser une légende, glisser pour déplacer,
caches réglables), **dépôt** d'un texte ou d'un fichier (`.txt`, `.md`,
`.docx`, `.json`) analysé sans IA avec aperçu avant ajout, mises en situation,
signalements des apprenants.

Cycle : `à vérifier` (hors tirage) → `validée` (posée) → `retirée`. Une
question déposée se rattache à n'importe quel critère, rédigé ou non : un
module « à rédiger » devient évaluable dès qu'il a des questions validées. La
banque versionnée avec le code (`content/modules/*.ts`) reste en place et se
fusionne à la lecture.

Format du texte déposé (repris du Lecteur QIM · QCM) : voir l'aide en ligne de
`/admin/questions/import` et `lib/import-questions.ts`.

## 8. Rapports et visas

Sans conservation : le rapport A4 (verdict, identification à compléter,
synthèse par question, tableau de visas, détail sourcé) est construit sur le
poste de l'apprenant et téléchargé ; il se signe sur papier.

Avec `CONSERVATION_RAPPORTS=nominative` : l'apprenant **émet** son rapport
(nom requis) ; le serveur vérifie le sceau posé à la correction, attribue un
numéro `RAP-AAAA-NNNN`, calcule l'empreinte SHA-256 et enregistre le visa
apprenant. Le tuteur puis le pharmacien responsable visent depuis
`/admin/rapports` ; chaque visa porte nom, profil de session, date et
empreinte. Un rapport ne se modifie pas : il s'annule avec motif. Tout est
journalisé. `/admin/rapports/[id]/imprimer` rend le rapport A4 avec ses visas.

## 9. Où éditer quoi

| Besoin | Fichier |
|---|---|
| Blocs, critères, niveaux, filières, étapes, maintien | `content/habilitation.ts` |
| Un module rédigé (texte + banque versionnée) | `content/modules/*.ts` |
| Formats, barèmes, notation | `content/types.ts`, `content/schema.ts` |
| Banque déposée (requêtes) | `content/banque-db.ts` |
| Analyseur d'import | `lib/import-questions.ts` (+ `lib/docx.ts`) |
| Rapport A4 | `lib/rapport.ts` ; enregistrement et visas `lib/rapports.ts` |
| Schéma de la base | `lib/schema.ts` (appliqué par `lib/db.ts`) |
| Stockage des documents | `lib/stockage.ts` ; images `lib/images.ts` |
| Rôles, codes, sessions, limiteur | `lib/auth.ts`, `lib/limiteur.ts` |
| Réglages d'exploitation | `lib/config.ts`, `.env.example` |
| Actions d'administration | `app/actions.ts`, `app/admin/**/actions.ts` |
| Couleurs et charte HdV | `app/globals.css` |

## 10. Tests

`npm test` — barème des trois formats, comparaison des légendes, analyseur
d'import (texte et JSON), constructeur de rapport. `npm run verifier` enchaîne
typecheck, lint et tests.

`npm run e2e` — parcours de bout en bout dans Chromium (Playwright) contre un
serveur construit lancé sur une base vide avec `CONSERVATION_RAPPORTS=nominative` :
amorçage, codes, création et import de questions avec image, éditeur de
schéma, évaluation complète, signalement, émission d'un rapport, visas tuteur
et pharmacien, rapport A4, dépôt de document, connexion tuteur, mode
entraînement, limiteur de connexion. Voir l'en-tête de `e2e/parcours.e2e.js`.

## 11. Reste à faire et questions ouvertes

La liste complète, ordonnée par impact, est dans
`docs/QUESTIONS-OUVERTES.md` ; les choix d'intégration dans
`docs/DECISIONS.md`. En tête : la référence « métrologie » du circuit de
signature, la décision de conservation nominative (RGPD), le statut du
dispositif en audit, l'hébergeur, les barèmes à confirmer, les 56 modules à
rédiger.

## 12. Limites connues

- L'ordonnancement se saisit comme une liste d'identifiants.
- Pas de purge automatique des rapports à l'échéance de conservation.
- Les sessions durent 12 h et ne sont pas révocables individuellement.
- Le rapport téléchargé référence les logos par l'adresse du site.
- Une question de la banque versionnée signalée se corrige dans le code.
- Fichiers en base limités à 15 Mo ; les vidéos relèvent d'un store d'objets.
