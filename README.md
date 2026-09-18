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

Hébergeur retenu le 18/09/2026 : **Render** pour le service, en ligne
<https://pharmatechx.onrender.com>, région Francfort ; **Supabase** pour la
base PostgreSQL depuis le 18/09/2026, jointe **en IPv4** par le pooler de
session de Supabase (l'hôte direct n'a qu'une adresse IPv6 ; le code impose
IPv4, `DATABASE_IP=4` par défaut). `docs/DEPLOIEMENT.md` détaille la création
du projet Supabase, l'API de données à couper, le branchement du service, la
reprise des données par `pg_dump`, le blueprint `render.yaml` pour recréer le
service, les sauvegardes et la **liste de mise en service** (DPO, DSI, plans,
variables, comptes, essai de restauration, procédure) ; Vercel y reste
documenté en repli. Au 18/09/2026, service et base sont sur les plans
gratuits : phase d'essai, `MISE_EN_SERVICE` absente. Le schéma de la base est
appliqué automatiquement au premier accès. Puis `/connexion` → **Créer
l'administrateur initial** : le code n'est affiché qu'une fois.

## 3. Les trois rôles

| Rôle | Peut faire |
|---|---|
| **admin** | Tout : codes de tous rôles, banque de questions, modules déposés (**publication, retrait**), documents, ordonnancement, signalements, journal, **barème et seuils**, visa « pharmacien responsable », annulation et purge des rapports, purge d'une progression, signature. Pas de rôle « pharmacien » distinct (décision du 18/09/2026, question 9) : les codes d'administration sont réservés au pharmacien responsable |
| **tuteur** | Banque de questions (créer, déposer, valider les questions d'un autre code, retirer), **modules déposés** (créer, modifier en brouillon), mises en situation, documents (par module ou par profil), ordonnancement, signalements, codes de poste, identifiants d'agents, code personnel d'un agent (réinitialisation), arbitrage et visa « tuteur » |
| **poste** | Suivre son programme, passer les évaluations et les entraînements, exporter ou émettre son rapport. Profil par défaut : aucun code requis |

Un code **ne désigne pas une personne** : il ouvre un profil. Les codes sont
stockés hachés (scrypt, sel par code). Cinq échecs de connexion bloquent
l'adresse un quart d'heure (adresse hachée, jamais stockée en clair). La
hiérarchie est appliquée côté serveur dans chaque action (`sessionRequise`),
jamais seulement par l'affichage.

## 4. Ce qui est stocké, et ce qui ne l'est pas

**Stocké** (configuration du site) : `acces` (codes hachés), `ordonnancement`,
`depots` (index des documents, avec leurs profils ; fichiers en Blob ou dans
`fichiers`), `questions` / `situations` / `images` / `depots_questions`
(banque déposée), `modules_deposes` (modules ajoutés depuis
l'administration), `reglages_modules` (seuil réglé d'un module du code),
`parametres` (barème réglé), `progression` et `en_cours` (progression
rattachée à un identifiant d'agent, décision du 18/09/2026, question 11 :
évaluations scellées, entraînements, lectures, évaluation interrompue),
`signalements` (sans identité), `journal` (rôle et libellé de profil),
`tentatives_connexion` (empreintes d'adresse). Chaque table porte la sécurité
au niveau des lignes sans politique et les rôles de l'API de données de
Supabase n'y ont aucun droit : la base n'est lisible que par le service.

**Jamais stocké sans décision de l'apprenant** : les réponses transmises
pour correction (identifiants de module et d'options seulement) et les
résultats vivent en mémoire de l'onglet, puis dans le rapport téléchargé.
**Sur rattachement** (« Ma progression », identifiant d'agent et code
personnel de 4 à 8 chiffres choisi par l'agent, conservé haché) : les
évaluations complètes, la fin des entraînements, les modules lus et
l'évaluation en cours sont conservés sous l'identifiant, relus à chaque
ouverture, et l'émission se fait sous cet identifiant. Un tuteur réinitialise
un code oublié ; l'administrateur purge une progression, journalisé.

**Sur décision seulement** (`CONSERVATION_RAPPORTS=pseudonyme`) : les
rapports que l'apprenant choisit d'**émettre** sont enregistrés sous son
identifiant d'agent (`agents`, `rapports`, `visas`). **Aucun nom n'entre en
base** : l'identifiant est généré par le site (`AG-001`…), la correspondance
avec la personne est tenue par le pharmacien hors du site, et le nom n'est
porté qu'à l'édition du rapport. Un identifiant reste une donnée pseudonymisée,
donc soumise au RGPD : fiche de registre et information des agents dans
`docs/RGPD.md` et sur `/donnees-personnelles`, à valider par le DPO.

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

| Format | Notation par défaut |
|---|---|
| **QCM** | Tout ou rien : l'ensemble coché doit être exactement l'ensemble attendu |
| **QIM** | 0 discordance → 1 pt ; 1 → 0,5 ; 2 → 0 ; au-delà → 0. Posée en Vrai/Faux par proposition ; une proposition sans réponse compte comme une discordance |
| **Schéma à compléter** | 1 pt au plus ; chaque légende vaut 1/n, fausse elle le retire, vide elle ne compte pas ; plancher 0. Légende à écrire (accents, casse, articles ignorés ; variantes admises) ou à choisir dans une liste mélangée |
| **Mise en situation** | Vignette + questions rattachées, tirées ensemble |

Une question **éliminatoire** invalide le critère quelle que soit la note, et
elle est toujours incluse dans le tirage.

**Barème réglable** (décision du 18/09/2026, question 10) : depuis
`/admin/bareme`, l'administrateur règle les points des QIM (1, 2 discordances
et au-delà), le mode du schéma (partiel ou tout ou rien, légende vide comptée
ou non), le seuil de réussite par défaut, le minimum de questions pour
conclure, la taille des tirages Découverte et Habilitation et la bande de
garde (poids d'une question, d'une demi-question ou largeur fixe). Le seuil
d'un module du code se règle module par module depuis `/admin/modules` ; un
module déposé porte le sien. Le barème en vigueur est annoncé sur l'accueil
et sous chaque question, **copié dans chaque résultat scellé** et porté sur
chaque rapport : une évaluation déjà passée se relit avec le barème de son
époque. Valeurs par défaut et règles dans `content/bareme.ts`.

Deux modes de passation : **évaluation** (correction à la fin, résultat porté
au rapport) et **entraînement** (une question à la fois, correction
immédiate avec justification et source, jamais enregistré ni comptabilisé).

**En fin de test** (transposé du Lecteur QIM · QCM, 18/09/2026) : le
**document de synthèse** du module s'affiche après la correction (fiche de
synthèse déposée par les tuteurs ; PDF et images en ligne, autres fichiers
par un lien), les **questions ratées se retravaillent** en entraînement sur
ces questions seulement, et le **module suivant du parcours** est proposé.
La page d'un module situe celui-ci dans sa liste (socle ou filière) avec le
précédent et le suivant ; un code de poste ouvre le programme sur sa filière
et son niveau.

## 7. Banque de questions, modules et documents déposés (profils tuteur et admin)

`/admin/questions` — création dans un formulaire (QCM, QIM, schéma avec
éditeur d'image : cliquer pour poser une légende, glisser pour déplacer,
caches réglables), **dépôt** d'un texte ou d'un fichier (`.txt`, `.md`,
`.docx`, `.json`) analysé sans IA avec aperçu avant ajout, chaque question
portant sa **justification** et ses sources, mises en situation,
signalements des apprenants.

`/admin/modules` — **modules déposés** (décision du 18/09/2026, question 10,
à la manière des dépôts du Lecteur QIM · QCM) : le texte des 58 critères
reste dans le code, mais un tuteur ou l'administrateur ajoute un module avec
titre, objectif, présentation courte, rattachement facultatif à un critère de
la fiche, **profils** (filières, niveaux, parcours) et seuil propre ; ses
questions se déposent depuis la banque, ses documents depuis Documents.
Cycle brouillon (visible des tuteurs et administrateurs) → publié (au
programme des profils choisis) → retiré. Publication, retrait, retour en
brouillon et modification d'un module publié : administration seulement
(question 12) ; suppression réservée à l'administrateur, refusée tant que
des questions ou des documents s'y rattachent.

`/admin/documents` — documents rattachés à un module (du code ou déposé) ou
généraux ; un document général se lie à un ou plusieurs profils (filières,
niveaux) et apparaît sur le programme de ces profils. La nature **fiche de
synthèse**, rattachée à un module, s'affiche en fin de test.

Cycle : `à vérifier` (hors tirage) → `validée` (posée) → `retirée`.
**Règle des quatre yeux** (décision du 18/09/2026, question 12) : une
question se valide par un autre code d'accès que celui qui l'a créée ou
modifiée en dernier ; une question modifiée repart « à vérifier ». Une
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

Avec `CONSERVATION_RAPPORTS=pseudonyme` : l'apprenant **émet** son rapport
sous l'identifiant d'agent que son tuteur lui a remis ; le serveur vérifie
que l'identifiant existe et qu'il est actif, vérifie le sceau posé à la
correction, attribue un numéro `RAP-AAAA-NNNN`, calcule l'empreinte SHA-256 et
enregistre le visa apprenant. Le tuteur puis le pharmacien responsable visent
depuis `/admin/rapports` ; chaque visa porte le profil de session, la date et
l'empreinte — jamais un nom saisi. Un rapport ne se modifie pas : il s'annule
avec motif. Tout est journalisé. `/admin/rapports/[id]/imprimer` rend le
rapport A4 pseudonyme (GET) ; le même chemin en POST, depuis le formulaire
« Éditer avec le nom », imprime le nom et la fonction saisis avec la mention
« hors sceau, non enregistré », sans rien conserver.

**Décision** (`lib/decision.ts`, modèle de la console métrologique) : verdict
brut acquis / non acquis / **indéterminé** (score dans la bande de garde, soit
le seuil à plus ou moins le poids d'une question) / **non concluant** (moins
de 10 questions : pas de rapport). Un verdict indéterminé est tranché par un
**arbitrage motivé du tuteur** avant son visa ; le verdict brut reste imprimé
à côté. Un signalement ouvert sur une question du tirage **verrouille** visas
et arbitrage ; une question retirée de la banque est exclue du calcul.

**Statut** (décision du 18/09/2026) : le rapport est un **document qualité,
preuve opposable de l'étape 2** en audit BPP 2023 / ISO 9001, jamais une
preuve d'habilitation. Chaque écran et chaque rapport portent la mention, la
référence de la procédure interne (`PROCEDURE_HABILITATION`, sinon
`[à compléter]`) et des dates à l'horloge du serveur ; `/api/sante` expose
cette horloge pour contrôler la source de temps de l'hébergeur. Tant que
`MISE_EN_SERVICE` (date) n'est pas posée, le site est en phase d'essai :
écrans et rapports portent « Phase d'essai — ne vaut pas preuve ».

**Signature** : le pharmacien dépose une image depuis `/admin/signature`
(réduite à 600 px par le navigateur, rattachée à son code admin) ; elle est
incrustée dans le rapport à son visa, qui clôt le rapport. **Archivage** : sur
un rapport clos, « Paquet d'archivage » livre un zip avec le HTML signé
autoportant, la ligne CSV du registre et le JSON complet, pseudonyme en GET
ou avec le nom porté à l'édition en POST (HTML et JSON seulement, hors
sceau) ; le registre cumulatif s'exporte depuis `/admin/rapports`, et
`/admin/personnel` tient les identifiants d'agents (création, clôture) et le
répertoire par identifiant et par critère (export CSV).

## 9. Où éditer quoi

| Besoin | Fichier |
|---|---|
| Blocs, critères, niveaux, filières, étapes, maintien | `content/habilitation.ts` |
| Un module rédigé (texte + banque versionnée) | `content/modules/*.ts` |
| Formats, notation | `content/types.ts`, `content/schema.ts` |
| Barème (valeurs par défaut, règles, libellés) | `content/bareme.ts` ; réglage `/admin/bareme`, lecture `lib/bareme-db.ts` |
| Banque déposée (requêtes) | `content/banque-db.ts` |
| Modules déposés | `content/modules-db.ts`, `app/admin/modules` ; fusion `content/store.ts` |
| Analyseur d'import | `lib/import-questions.ts` (+ `lib/docx.ts`) |
| Rapport A4 | `lib/rapport.ts` ; enregistrement, décision et visas `lib/rapports.ts` |
| Identifiants d'agents | `lib/identifiant.ts` (format, saisie), `lib/agents.ts` (base), `app/admin/personnel` |
| Cadrage RGPD | `docs/RGPD.md`, `app/donnees-personnelles` |
| Règle de décision (bande de garde, non concluant) | `lib/decision.ts` |
| Registre, répertoire, JSON d'archive, zip | `lib/registre.ts`, `lib/zip.ts` |
| Signature du pharmacien | `lib/signatures.ts`, `app/admin/signature` |
| Schéma de la base | `lib/schema.ts` (appliqué par `lib/db.ts`) |
| Stockage des documents | `lib/stockage.ts` ; images `lib/images.ts` |
| Rôles, codes, sessions, limiteur | `lib/auth.ts`, `lib/limiteur.ts` |
| Réglages d'exploitation | `lib/config.ts`, `.env.example` |
| Actions d'administration | `app/actions.ts`, `app/admin/**/actions.ts` |
| Couleurs et charte HdV | `app/globals.css` |

## 10. Tests

`npm test` — barème des trois formats, comparaison des légendes, analyseur
d'import (texte et JSON), décision (bande de garde, non concluant,
exclusions, arbitrage, bande de garde réglable), barème réglable
(normalisation, QIM et schéma paramétrés, libellés), état d'une évaluation
en cours (contrôle de forme), identifiants d'agents,
famille d'adresses et socket IPv4 vers la base, schéma (RLS sur chaque
table), voisins du parcours, constructeur de rapport (identifiant, nom hors
sceau, barème porté), registre CSV et JSON, archive zip.
`npm run verifier` enchaîne typecheck, lint et tests.

`npm run e2e` — parcours de bout en bout dans Chromium (Playwright) contre un
serveur construit lancé sur une base vide avec `CONSERVATION_RAPPORTS=pseudonyme`
et `MISE_EN_SERVICE` posée :
page de santé (base jointe en IPv4), amorçage, codes, dépôt de la signature, création d'un identifiant d'agent,
création et import de dix questions avec image, éditeur de schéma, évaluation
à 80 % (verdict indéterminé), signalement qui verrouille les visas, émission
d'un rapport sous identifiant (identifiant inconnu refusé), arbitrage, visas
tuteur et pharmacien avec signature incrustée sans nom saisi, rapport A4
pseudonyme puis avec le nom porté à l'édition, paquet d'archivage, registre et
répertoire CSV sans nom, journal sans nom, purge, clôture de l'identifiant,
dépôt de document, module déposé (brouillon invisible, publié au programme
d'une filière et d'un niveau, questions importées, seuil propre), barème
réglé puis rétabli, document général par profil, fin de test (document de
synthèse, question ratée rejouée, module suivant), progression rattachée
(code personnel, évaluation conservée et relue, évaluation interrompue
reprise, traces vues du tutorat, purge, code réinitialisé), connexion
tuteur, mode entraînement, limiteur de connexion. Voir l'en-tête de
`e2e/parcours.e2e.js`.

## 11. Reste à faire et questions ouvertes

La liste complète, ordonnée par impact, est dans
`docs/QUESTIONS-OUVERTES.md` ; les choix d'intégration dans
`docs/DECISIONS.md`. En tête : la validation RGPD du mode pseudonyme par le
DPO (`docs/RGPD.md`), la procédure interne et la source de temps qu'exige le
statut opposable, l'accord DSI/DPO sur l'hébergement (Render pour le service,
Supabase pour la base), l'API de données de Supabase à couper et la
vérification des plans, les valeurs du barème à arrêter (réglables depuis
`/admin/bareme`, valeurs par défaut posées), les 56 modules à rédiger dans le
code (décision du 18/09/2026, question 10).

## 12. Limites connues

- L'ordonnancement se saisit comme une liste d'identifiants.
- Pas de purge automatique des rapports (décision) : purge manuelle par
  l'administrateur, rapport par rapport ou par date, sur les rapports clos ou
  annulés seulement.
- Les sessions durent 12 h et ne sont pas révocables individuellement.
- Sans rattachement à un identifiant d'agent, la progression vit dans
  l'onglet : ni reprise ni historique. Rattachée, elle se conserve en base ;
  courbes d'évolution non faites.
- Le rapport téléchargé référence les logos par l'adresse du site.
- Une question de la banque versionnée signalée se corrige dans le code.
- Fichiers en base limités à 15 Mo ; les vidéos relèvent d'un store d'objets.
