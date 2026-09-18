# Journal d'intégration — squelette avant déploiement (18/09/2026)

Ce document prolonge le « Journal d'intégration » de `docs/PASSATION-DESIGN.md`.
Il dit ce qui a été repris, d'où, et ce qui a été écarté et pourquoi.

## Repris du Lecteur QIM · QCM (dépôt `Quiz-Flore`)

| Fonction | Ce qui est repris | Où |
|---|---|---|
| Formats QIM / QCM / **schéma à compléter** | le format `SCH` : légendes à écrire de mémoire, repères et caches en % de l'image, barème 1 pt max · ±1/n · plancher 0 | `content/schema.ts`, `content/types.ts` |
| Comparaison des légendes | normalisation (accents, casse, tirets, articles), variantes après « \| » | `content/schema.ts` |
| Éditeur de schéma | clic pour poser, glisser pour déplacer, flèches au clavier, caches réglables, aperçu apprenant | `components/EditeurSchema.tsx` |
| Dépôt en deux temps | texte collé ou fichier (.txt, .md, .docx natif, .json), analyse sans IA, aperçu, ajout au statut « à vérifier » | `lib/import-questions.ts`, `lib/docx.ts`, `components/ImportQuestions.tsx` |
| Statuts | `a_verifier` (hors tirage) → `valide` → `retire` ; l'arbitre est un tuteur ou un administrateur | `content/banque-db.ts` |
| Images en base | PNG/JPEG, type réel lu dans les octets, dimensions lues dans l'entête, 2 Mo max, nettoyage des orphelines après 7 jours | `lib/images.ts` |
| Signalements | motif fermé + note libre, sans identité ; arbitrage depuis l'administration | `app/api/signalement/route.ts`, `app/admin/signalements` |
| Sécurité | limiteur d'échecs de connexion (en base, adresse hachée), cookie signé | `lib/limiteur.ts`, `lib/auth.ts` |
| Portabilité Render | `pg` + `DATABASE_URL` + `DATABASE_SSL`, `render.yaml`, page de santé | `lib/db.ts`, `render.yaml`, `app/api/sante` |

Non repris, à dessein : le barème PASS (+1/0/−1 par proposition), les badges,
poussins, confettis et courbes de progression (le brief exclut toute
gamification), la fusion multi-appareils d'un document d'état, la lecture de
PDF côté navigateur (pdf.js), la détection de figures dans les PDF.

## « Comme pour la métrologie »

La référence est la **console de vérification métrologique des enregistreurs
de température** (travail « Blocage série », dossier de portage
`README_portage.md` du 18/09/2026, fourni par le pharmacien). Ce qu'elle fait
pour la signature et les rapports, et ce qui en est transposé ici :

| Console métrologique | Site de formation |
|---|---|
| Une image de signature du pharmacien, déposée une fois (600 px), conservée sur le poste, incrustée dans chaque rapport HTML autoportant | Image déposée depuis `/admin/signature`, réduite à 600 px par le navigateur, **rattachée au code d'accès admin** et conservée en base ; incrustée au visa du pharmacien, qui clôt le rapport ; le visa référence l'image de l'instant (`visas.signature_id`) |
| « Enregistrer le rapport » (HTML, sans inscription au répertoire) puis « Valider et archiver » (datation, trois fichiers : CSV d'une ligne par appareil, JSON de la campagne, HTML du rapport) | Émission par l'apprenant (numéro, empreinte, visa apprenant), visa du tuteur, clôture par le pharmacien ; sur un rapport clos, **« Paquet d'archivage »** produit à la demande un zip avec le HTML signé, la ligne CSV du registre et le JSON complet (`/admin/rapports/[id]/paquet`). Rien n'est téléchargé automatiquement : le serveur tient le registre |
| Répertoire de traçabilité « Parc & historique », construit depuis les campagnes validées, export CSV | **« Personnel & historique »** (`/admin/personnel`) : une ligne par agent (identifiant `AG-NNN`) et par critère, dernier rapport non annulé, verdict, rapports clos ; gestion des identifiants ; export `repertoire_personnel_<date>.csv` ; registre cumulatif `registre_rapports_<date>.csv` (une ligne par rapport, tous statuts) |
| Verdict par bande de garde (\|b\| + U ≤ EMT conforme ; \|b\| − U > EMT non conforme ; sinon indéterminé), arbitrage pharmacien explicite et motivé, verdict brut conservé (`r.vMetro`) à côté du verdict arbitré | `lib/decision.ts` : la mesure est le score, la limite le seuil, l'incertitude le **poids d'une question** (100 / n). Acquis si score − bande ≥ seuil, non acquis si score + bande < seuil, sinon **indéterminé** : arbitrage motivé du **tuteur** avant son visa, verdict brut conservé et imprimé. Échec éliminatoire = non acquis sans arbitrage |
| « Non concluant » sous un taux d'appariement minimal : l'outil refuse de conclure | **Non concluant** sous 10 questions (taille du tirage d'habilitation) : aucun rapport ne peut être émis ; si la banque du critère n'atteint pas 10 questions validées, seul le tirage Découverte reste ouvert |
| Étape Rapport verrouillée tant qu'une décision pharmacien est en attente | Visas et arbitrage **verrouillés** tant qu'un signalement est ouvert sur une question du tirage ; une question retirée de la banque est **exclue du calcul**, les exclusions étant fixées au premier acte de décision (arbitrage ou visa du tuteur) et jamais modifiées ensuite |
| Rapport A4 au registre document, palette officielle, imprimé par le navigateur | Rapport A4 de la maquette, décision complète (verdict final, verdict brut, bande, arbitrage, exclusions), visas et signature incrustée, autoportant |

Décisions prises avec le pharmacien le 18/09/2026 : signature (question 2,
choix c : visas par clic conservés + image du pharmacien incrustée), gestion
des rapports (question 3, choix b : paquet à la demande, registre exportable,
écran Personnel), verrou et arbitrage (question 4, choix c : bande de garde,
arbitrage motivé, non concluant, verrou signalement). Paramètres posés et
marqués `[à préciser]` : largeur de la bande (une question), minimum de 10
questions, séparateur CSV « ; ».

Inchangé : un rapport **émis** reçoit un numéro (`RAP-AAAA-NNNN`) et une
empreinte SHA-256 de son contenu scellé ; il ne se modifie plus. Les **visas**
portent rôle et libellé de session, date et empreinte.
**Annulation motivée** au lieu de correction. **Journal** de chaque action
(dont `arbitrage-rapport`, `signature:depot`, `export:paquet`,
`export:registre`, `export:repertoire`). Le résultat est **scellé par le
serveur** à la correction (HMAC) et vérifié à l'émission.

Ni l'image incrustée ni le visa par clic ne valent signature électronique au
sens eIDAS, pas plus que dans la console : la valeur de preuve vient du
registre, de l'empreinte et du journal.

Tout cela n'existe que si `CONSERVATION_RAPPORTS=pseudonyme` — le choix c de
la question 2 le suppose, puisque les visas s'enregistrent. Par défaut, le
site reste dans l'état livré : rien d'enregistré, rapport téléchargé et signé
sur papier. Voir `docs/QUESTIONS-OUVERTES.md`.

**Conservation** (question 5, choix d, 18/09/2026) : aucune purge automatique.
Les rapports sont conservés jusqu'à purge manuelle par l'administrateur —
rapport par rapport (recopie du numéro) ou purge datée des rapports clos ou
annulés (recopie du mot PURGER), jamais un rapport en circuit ; les numéros
supprimés restent au journal. `RAPPORTS_CONSERVATION_MOIS`, facultatif,
annonce une durée cible sur les rapports sans rien déclencher.

**Pseudonymisation** (question 6, choix a, 18/09/2026) : plus aucun nom en
base. Un tuteur ou l'administrateur crée un identifiant d'agent généré par le
site (`AG-001`…, écran Personnel) ; la correspondance avec la personne est
tenue par le pharmacien hors du site. L'apprenant saisit cet identifiant pour
émettre ; le serveur vérifie qu'il existe et qu'il est actif. Visas et
arbitrage portent le rôle et le libellé du code de session, jamais un nom
saisi. Le nom et la fonction ne sont portés qu'à l'édition du rapport
(impression ou paquet d'archivage, formulaire POST, mention « hors sceau, non
enregistré ») et ne sont ni conservés, ni journalisés, ni transmis dans une
adresse. Conséquence assumée : le sceau ne couvre pas le nom ; le lien
identifiant ↔ personne repose sur la correspondance hors du site. Un
identifiant se clôt au départ de l'agent, ne se réattribue pas et survit à la
purge de ses rapports. Le mode `nominative` est retiré du code (l'historique
git le conserve) ; `CONSERVATION_RAPPORTS=pseudonyme` le remplace. Le
traitement reste pseudonymisé, donc soumis au RGPD : fiche de registre et
texte d'information dans `docs/RGPD.md` et sur la page `/donnees-personnelles`,
à valider par le DPO avant activation.

**Statut du dispositif** (question 7, choix b, 18/09/2026) : le rapport est une
**preuve opposable de l'étape 2** de l'habilitation en audit BPP 2023 /
ISO 9001 — jamais une preuve d'habilitation, qui se prononce hors du site. Le
marqueur `[à préciser]` du pied de page et des rapports est remplacé par la
mention « Document qualité — preuve de l'étape 2 », la référence de la
procédure interne (`PROCEDURE_HABILITATION`, marqueur `[à compléter]` tant
qu'elle n'est pas renseignée) et la mention des dates à l'horloge du serveur ;
la date de passation porte son horodatage ISO 8601 UTC, et `/api/sante` expose
l'horloge du serveur pour contrôler la source de temps. Sans conservation, la
preuve repose sur les signatures manuscrites du rapport téléchargé. Ce que le
code ne garantit pas reste consigné dans `docs/QUESTIONS-OUVERTES.md`, A.3 :
source de temps de l'hébergeur, durée de référence, sauvegardes, procédure.
Tant que `MISE_EN_SERVICE` (date) n'est pas posée, écrans et rapports portent
« Phase d'essai — ne vaut pas preuve » ; constat du 18/09/2026 : plans
gratuits, phase d'essai.

**Hébergeur** (question 8, choix a, 18/09/2026) : **Render** pour le service,
en ligne sur `pharmatechx.onrender.com`, créé à la main le 18/09/2026, région
Francfort, plan payant exigé par le statut opposable. **Base déplacée chez
Supabase** le 18/09/2026 à la demande du pharmacien responsable, **jointe en
IPv4** : l'hôte direct d'un projet Supabase n'a qu'une adresse IPv6, que
Render ne joint pas `[à vérifier]` ; `DATABASE_URL` désigne le pooler de
session de Supabase (port 5432, IPv4) et le code impose la famille IPv4
(`DATABASE_IP=4` par défaut, résolution à chaque connexion, message explicite
si l'hôte n'a pas d'adresse IPv4). Le schéma active la sécurité au niveau des
lignes sur chaque table et retire les droits des rôles de l'API de données de
Supabase, exposée par défaut avec une clé publique. Le blueprint `render.yaml`
ne décrit plus que le service ; la page de santé expose le commit, la branche,
la famille d'adresses et le code de la dernière erreur de connexion. Les
documentations de Render et de Supabase n'étaient pas joignables depuis
l'environnement de travail : plans, pause du projet gratuit, sauvegardes et
certificat du pooler marqués `[à vérifier]` dans `docs/DEPLOIEMENT.md`, qui
porte la création du projet, l'API de données à couper, la migration
`pg_dump` / `pg_restore` par le pooler de session, la liste de mise en
service (DPO, DSI, plans, variables, comptes, essai de restauration,
procédure) et la sauvegarde conservée dans l'établissement. Le cadrage RGPD
(`docs/RGPD.md`) nomme Render et Supabase comme sous-traitants, transferts
hors UE à vérifier par le DPO. Le dépôt n'a qu'une branche, déployée à chaque
poussée : une branche de production distincte est à décider. Vercel non
retenu, documentation conservée en repli ; hébergement interne écarté.

**Rôle du pharmacien responsable** (question 9, choix a, 18/09/2026) : pas
de rôle distinct. Le visa « pharmacien responsable », la signature,
l'annulation et la purge restent portés par tout code d'administration.
Conséquence à porter dans la procédure interne : les codes d'administration
sont réservés au pharmacien responsable et à son suppléant `[à préciser]` ;
un administrateur technique n'en détient pas, sans quoi son visa vaudrait
visa du pharmacien. Le journal et les visas portent le libellé du code, pas
la personne.

**Rédaction des modules et dépôt** (question 10, choix a complété,
18/09/2026) : le texte des 58 critères reste versionné avec le code, rédigé
par le pharmacien responsable ; aucun éditeur de texte en base. En
complément, à la manière des dépôts du Lecteur QIM · QCM : **modules
déposés** depuis l'administration (titre, objectif, présentation courte,
critère facultatif, profils par filières, niveaux et parcours, seuil propre,
cycle brouillon → publié → retiré), **documents** liés à un module ou à un ou
plusieurs profils et proposés sur le programme, **questions** QCM, QIM ou
schéma déposées avec leurs justifications sur tout module, du code ou
déposé. **Barème réglable** depuis `/admin/bareme` (QIM, schéma, seuil par
défaut, minimum de questions, tirages, bande de garde) et seuil par module ;
le barème en vigueur est copié dans chaque résultat scellé et porté sur
chaque rapport, les valeurs par défaut restant celles reprises du Lecteur
QIM · QCM. Les valeurs à retenir restent à arrêter (`docs/QUESTIONS-OUVERTES.md`,
B). L'ordonnancement enregistré est désormais appliqué au programme : il
était enregistré sans être lu.

## Transposé du Lecteur QIM · QCM pour le parcours de formation (18/09/2026)

Demande du pharmacien responsable : s'inspirer du site de Flore pour la
modularité et les fonctions, transposées à un e-learning à modules et
parcours, avec un document de synthèse en fin de test.

**Repris.**

- Le support de révision cité par le corrigé devient le **document de
  synthèse** du module : un document de nature « fiche de synthèse »
  (déposé, ou ressource du code), affiché en fin d'évaluation et
  d'entraînement, après la correction ; PDF et images en ligne
  (`lib/synthese.ts`, composant `Synthese`).
- « Rejouer les ratées » devient **retravailler les questions ratées** en
  entraînement, sur ces questions seulement, sans enregistrement
  (`sousEnsemble` dans `components/Evaluation.tsx`).
- L'enchaînement des sessions devient le **module suivant du parcours** :
  place du module dans sa liste (socle, puis chaque filière), précédent et
  suivant sur la page du module et en fin de test
  (`positionDansParcours`, `voisins`).
- Le profil de l'utilisateur devient la **filière et le niveau du code de
  poste**, présélectionnés sur le programme.
- Déjà repris avant : formats, schéma à compléter, dépôt en deux temps,
  statuts, signalements, limiteur, portabilité (voir plus haut).

**Non repris, et pourquoi.**

- Badges, poussins, confettis, série de réussites, salutation, avatar : le
  brief exclut toute gamification.
- Sessions passées, courbes d'évolution, historique par question, difficulté
  calculée, reprise d'une session interrompue, réglages mémorisés :
  demandent une **progression persistante** hors de l'onglet ; sur le poste,
  elle serait partagée entre les agents d'un même ordinateur ; en base, elle
  serait rattachée à l'identifiant d'agent et changerait la fiche RGPD.
  Décision à prendre : `docs/QUESTIONS-OUVERTES.md`, F.37.
- Session mixte : un rapport couvre un critère et un seul (décision
  d'origine) ; une évaluation transversale n'a pas de ligne dans la fiche.
- Ouverture du PDF à la page citée, lecture de PDF dans la page, détection
  de figures : la banque cite des références, pas des pages ; les documents
  s'ouvrent dans un onglet.
- Khôlles et examens blancs au format des sujets déposés : sans objet.

**Progression persistante** (question 11, choix c, 18/09/2026) : la
progression de l'apprenant est conservée en base sous son identifiant
d'agent, comme le mode serveur du site de Flore. L'agent se **rattache**
depuis « Ma progression » avec son identifiant et un code personnel de 4 à
8 chiffres qu'il choisit à la première fois (haché par scrypt, comme les
codes d'accès ; cinq échecs bloquent l'adresse un quart d'heure ; un tuteur
le réinitialise sans le lire) ; le rattachement est un cookie signé de douze
heures, distinct de la session de rôle. Rattaché : chaque évaluation complète
est conservée avec son résultat scellé (`progression`), la fin d'un
entraînement et la lecture d'un module sont notées, l'évaluation en cours
est sauvegardée pour la reprise (`en_cours`, questions par identifiant et
réponses, effacée à la correction ou à l'abandon), la mémoire de session du
navigateur repart des évaluations conservées à chaque ouverture, et
l'émission d'un rapport se fait sous l'identifiant rattaché sans le
ressaisir. Sans rattachement, rien ne change : l'onglet seul. Le tutorat lit
la progression d'un agent depuis Personnel ; l'administrateur la purge,
journalisé, sans toucher aux rapports émis. Fiche RGPD et page
d'information mises à jour (`docs/RGPD.md`) : nouvelle catégorie de données
pseudonymisées, durée `[à préciser]`. Non fait : courbes d'évolution et
historique par question (les données sont là ; le tracé attend une décision
d'affichage).

**Règle des quatre yeux** (question 12, 18/09/2026 ; choix c pour les
modules, b pour les questions) : un module déposé se publie, se retire ou
repasse en brouillon en administration seulement, et un module publié ne se
modifie qu'en administration ; une question se valide par un autre code
d'accès que son auteur courant, c'est-à-dire le dernier code qui l'a créée ou
modifiée (`cree_par_acces`, `edite_par`, `edite_par_acces`). Conséquences :
l'éditeur n'offre plus « validée », une question créée ou modifiée repart
« à vérifier », la liste n'affiche « Valider » qu'à un autre code et le
serveur refuse sinon, journalisé. Réserve rappelée : un code désigne un
profil, pas une personne ; deux codes distincts sont garantis par le site,
deux personnes par la procédure interne. L'arbitrage et les visas ne sont
pas couverts par cette question (`docs/QUESTIONS-OUVERTES.md`, D.33).

## Inspiration PandaSuite (interactivité)

La page pandasuite.com/fr/logiciel-elearning n'était pas accessible depuis
l'environnement de travail ; les fonctions ont été relevées sur les pages
indexées (quiz, glisser-déposer, zones cliquables, vidéo, scénario, scores,
SCORM). Transposé dans les limites du brief :

| PandaSuite | Ici |
|---|---|
| quiz, scores | QCM / QIM / schéma avec barème annoncé |
| zones cliquables, glisser-déposer | schéma à compléter : repères numérotés sur l'image, légendes à écrire ou à attribuer ; éditeur au doigt et à la souris |
| retour immédiat | **mode entraînement** : correction après chaque question, justification et source, jamais enregistré |
| scénario | mises en situation (vignette + questions rattachées), désormais déposables en base |
| suivi de progression | avancement de session seulement — jamais un avancement d'habilitation |
| vidéo | ressources de nature « vidéo » rattachées aux modules |
| SCORM, gamification, embranchements | non retenus (pas de LMS ; brief ; à discuter) |

## Choix techniques

- `@vercel/postgres` (déprécié par Vercel) remplacé par `pg`. Le gabarit
  `sql\`…\`` paramètre toujours ; `requete()` sert aux listes de colonnes
  constantes.
- Stockage des documents : adaptateur `lib/stockage.ts` — Vercel Blob si un
  jeton est présent, sinon la table `fichiers`. Aucun service supplémentaire à
  provisionner sur Render.
- Schéma appliqué au premier accès sous verrou consultatif : pas d'étape de
  migration à oublier.
- Base jointe par un socket `pg` personnalisé (`lib/reseau.ts`) qui impose la
  famille d'adresses (`DATABASE_IP`, IPv4 par défaut) et complète les erreurs
  de résolution ; écouteur d'erreur sur le pool pour survivre à la coupure
  d'une connexion inactive (pause ou maintenance d'une base managée).
- Barème réglable (`content/bareme.ts`, pur) : valeurs par défaut, bornes,
  normalisation ; la notation (`noterQuestion`) et la décision (`decider`)
  reçoivent le barème en paramètre, et le résultat scellé le conserve
  (`ResultatEvaluation.bareme`) pour que rapports et registre se relisent
  avec le barème de l'époque.
- Modules déposés (`content/modules-db.ts`) lus comme des modules du modèle
  (`origine: "base"`) et fusionnés dans `content/store.ts` ; le seuil
  effectif d'un module du code est résolu à la lecture (réglage, sinon
  barème).
- Les modules restent versionnés avec le code ; la banque déposée s'y fusionne
  à la lecture (`getModuleComplet`). Un module « à rédiger » devient évaluable
  dès qu'il a des questions validées.
- Tests unitaires (`node --test` via `tsx`) sur le barème, la comparaison des
  légendes, l'analyseur d'import et le constructeur de rapport.

## Non fait

- Éditeur du texte des modules en base : écarté (question 10, choix a) ; un
  module déposé porte une présentation courte seulement.
- Purge automatique des rapports à l'échéance de conservation.
- Glisser-déposer pour l'ordonnancement des modules.
- Mode sombre (décision antérieure : plus tard).
- Test de bout en bout navigateur (Playwright) : à ajouter après la première
  mise en service, sur les parcours apprenant et tuteur.
