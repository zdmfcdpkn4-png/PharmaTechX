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
Amendée le 23/09/2026 : un code d'administration valide aussi ses propres
questions, validation tracée (section « Validation d'une question par son
auteur administrateur »).

**Accès aux documents déposés** (question 13, choix b, 18/09/2026) : les
documents déposés — procédures internes, fiches réflexes, référentiels,
vidéos, fiches de synthèse conservés en base — ne sont servis qu'aux
sessions ouvertes par un code (poste, tutorat, administration) : la route
`/api/fichiers` répond 401 sans session, les pages n'en listent que le
nombre aux visiteurs, avec l'invitation à se connecter, et la synthèse
déposée n'est montrée en fin de test qu'avec une session. Un store Blob,
dont les adresses sont publiques, est incompatible avec cette règle : le
stockage en base est requis. **Puis choix c, confirmé le même jour : tout le
site derrière un code.** Dès qu'une base est configurée, un filtre
(`middleware.ts`, vérification de la signature du cookie de session avec
les API Web, sans Node) exige une session de rôle sur chaque page et chaque
route d'API, sauf la connexion, la page Données personnelles et la page de
santé ; une page demandée sans session renvoie à la connexion et y ramène
après le code. Les pages continuent de vérifier le rôle de leur côté. Sans
base, le site reste en mode ouvert, signalé sur la page de connexion. Motif :
un outil interne d'une unité de production de cytotoxiques, dont les modules
porteront des données locales, ne se lit pas sans contrôle sur l'internet ;
la consigne « ne pas indexer » n'est pas une protection.

**Quatre yeux et circuit des rapports** (question 14, choix a, 18/09/2026) :
la règle des quatre yeux n'est pas étendue à l'arbitrage ni aux visas. Le
site laisse donc un code d'administration, qui satisfait l'exigence
« tutorat », arbitrer, viser comme tuteur puis viser comme pharmacien un même
rapport ; chaque visa et l'arbitrage portent le profil et le libellé du code
qui les a posés, imprimés sur le rapport, ce qui rend le cumul visible à la
lecture et en audit. Deux personnes distinctes pour les deux visas relèvent
de la procédure interne (`docs/QUESTIONS-OUVERTES.md`, D.33), pas du code.

**Conservation des traces de progression** (question 15, choix a,
18/09/2026) : aucune purge automatique ; la progression rattachée d'un agent
est conservée jusqu'à purge manuelle par l'administrateur depuis Personnel,
à la demande de l'agent ou à son départ, et la clôture de l'identifiant ne
l'entraîne pas. Même logique que les rapports (question 5, choix d) ; fiche
RGPD et page d'information mises à jour, le DPO vérifiant que ce critère de
durée suffit au registre. Le point C.17 (statut à l'import) est clos par
conséquence de la question 12 : une question importée ne peut pas être
validée d'office, aucun second code n'étant intervenu.

**Session liée à son code** (question 16, choix b, 18/09/2026) : dès qu'une
base est configurée, une session ne vaut que si le code d'accès qui l'a
ouverte existe encore, est actif et n'a pas été révoqué depuis son ouverture
(`acces.ferme_le`, `debut` dans le cookie). Révoquer ou supprimer un code
ferme donc ses sessions à la requête suivante ; réactiver un code ne rouvre
pas les sessions d'avant. Le filtre d'entrée, sans base, garde la seule
vérification de signature et marque les chemins gardés d'un en-tête interne ;
le gabarit racine renvoie une session fermée à la connexion, avec le motif et
la page demandée ; actions et routes d'API refusent (redirection ou 401).
Une base injoignable n'est pas prise pour une session fermée. Au premier
déploiement de cette version, les sessions ouvertes avant elle, sans date
d'ouverture, sont fermées une fois. Durée de douze heures inchangée ; pas
d'interrupteur global (choix c écarté), changer `AUTH_SECRET` en tient lieu.

**Éliminatoire sur un schéma** (question 17, choix a, 18/09/2026) : sur une
question éliminatoire de type schéma, toute légende fausse ou vide fait
échouer la question, donc le critère, quel que soit le score. Règle fixe :
une exigence de sécurité ne varie pas d'une campagne à l'autre (choix c,
réglable, écarté) ; ne pas savoir nommer l'élément vaut le nommer faux
(choix b écarté). Le barème réglable ne décide du sort des légendes vides
que pour la note des questions non éliminatoires.

**Questions réservées à l'évaluation** (question 18, choix c, 18/09/2026) :
entraînement et évaluation puisaient dans la même banque, avec correction
immédiate en entraînement, si bien qu'un agent pouvait apprendre la banque
avant l'évaluation. Chaque question porte désormais un marquage « réservée à
l'évaluation » (`reservee`, dans le code comme en base, case de l'éditeur,
ligne « Réservée à l'évaluation : oui » à l'import) : jamais posée en
entraînement ni dans le tirage Découverte, tirée en priorité dans les tirages
Habilitation et Complet en mode évaluation, après les éliminatoires. Le
tirage reste fait dans le navigateur (`content/tirage.ts`), mais le serveur
vérifie sa conformité à la correction et refuse (400) un entraînement ou une
Découverte qui contiendrait une réservée, ou une Habilitation qui en
contiendrait moins que le tirage prioritaire n'en aurait pris. Le rejeu des
questions ratées, en entraînement, écarte les réservées. Le résultat scellé
porte le nombre de réservées posées et disponibles, repris sur le rapport
(étiquette par question, ligne d'en-tête) et dans le registre
(`nb_reservees`) ; la banque affiche le compte par module. Écartés : b
(entraînement réservé aux modules déjà évalués, ordre pédagogique inversé) et
a (même banque, acceptable seulement avec des banques larges).

**Retrait d'une question après la décision** (question 19, choix b,
18/09/2026) : les exclusions d'un rapport restent fixées au premier acte de
décision, pour que la décision reste reproductible sur les éléments connus à
cet instant. Une question du tirage retirée de la banque après cette
fixation ne change ni le score ni le verdict, mais elle est signalée : encart
sur la page du rapport, avant le visa du pharmacien, et note sur le rapport
imprimé, avec la date du retrait et le score qu'aurait donné l'exclusion, à
titre indicatif (`retraitsPosterieurs`, `decisionSiExclues`, calculés à la
lecture, sans changement de schéma). Le visa n'est pas bloqué (choix c
écarté) : le pharmacien vise ou annule en connaissance de cause.

**Logos incorporés** (question 20, choix c, 18/09/2026) : un document
conservé comme preuve doit rester lisible pendant toute sa durée de
conservation sans dépendre du site. Les deux logos sont encodés en data URI
dans chaque rendu du rapport : lus une fois depuis `public/` côté serveur
(`lib/logos.ts`, impression et paquet d'archivage), récupérés depuis le site
au moment du téléchargement côté navigateur. Surcoût d'une trentaine de
kilo-octets par fichier ; à défaut de lecture, l'adresse du fichier sert,
comme avant. Écartés : a (logos par adresse) et b (deux chemins de rendu).

**Branche de production et étiquettes de version** (question 21, choix c,
18/09/2026) : un rapport opposable suppose de savoir quelle version du
dispositif l'a produit. Le dépôt porte désormais `production`, branche
déployée, distincte de la branche de travail ; chaque mise en service est une
fusion dans `production` et une étiquette `vN`, qui fixe dans le dépôt ce qui
était en service et depuis quand — indépendamment de l'historique des
déploiements de l'hébergeur. `/api/sante` donne le commit déployé,
`git tag --points-at` l'étiquette correspondante. Le réglage de la branche
déployée dans le tableau de bord de Render n'est fait qu'à la mise en
service : pendant la phase d'essai, le site en ligne doit continuer de suivre
chaque poussée. L'étiquette ne dit rien de la base, dont le schéma s'applique
de lui-même au premier accès : `[à préciser]` base d'essai distincte ou base
unique. Écartés : a (une seule branche déployée à chaque poussée, acceptable
en essai seulement) et b (déploiement manuel depuis le tableau de bord, qui
laisse la trace de la version en service chez le seul hébergeur).

**Étiquette d'instance de la base** (question 23, choix b, 18/09/2026) : la
branche de production garantit le code en service, pas les données. Le schéma
s'applique au premier accès et retire des colonnes ; une version d'essai
branchée par erreur sur la base en service la ferait évoluer et y écrirait ses
rapports d'essai. La base porte donc une étiquette (`parametres`, clé
`instance` : `service` ou `essai`) et l'environnement déclare celle qu'il
attend (`BASE_ATTENDUE`). La règle est dirigée par l'étiquette inscrite, non
par la présence de la variable — sans quoi le garde-fou manquerait justement
l'accident visé, un poste de développement branché sur la base en service.
Une base étiquetée n'est servie qu'à l'environnement qui la réclame : sinon
le schéma n'est pas appliqué, aucune requête n'aboutit, `/api/sante` répond
503 (`base: "refusee"`) et le journal porte le refus. Base sans étiquette et
environnement muet : rien n'est vérifié, le développement local ne change pas.
Le contrôle vit dans `garantirSchema()`, par où passe tout accès à la base ;
la règle est pure et testée (`lib/instance.ts`). Écartés : a (séparation par
l'usage seulement, qui n'interdit rien) et c (deux projets Supabase, qui
suppose un second service payant pour garder un site d'essai en ligne et
n'isole que des données fictives) — c reste possible plus tard, l'étiquette
le rendant sûr.

**Logo de l'unité** (question 24, choix b, 18/09/2026 — **remplacée le
19/09/2026 par la question 41, choix a** : le logo des rapports a changé en
phase d'essai, voir plus bas) : le logo
« Pharmacotechnie — unité de production des chimiothérapies » fourni ce jour
devient celui du dispositif. Son emblème circulaire, détouré carré et réduit
à 180 × 180 (`public/pharmaco-icone.png`), sert d'icône d'onglet
immédiatement : une icône ne vaut pas preuve. Sur les rapports, le changement
est reporté à la mise en service, en même temps que l'étiquette `v1` qui le
date : changer l'en-tête d'une pièce opposable en cours de route créerait
deux générations de rapports pour un même dispositif, sans rien qui explique
la différence. Le logo est déposé dès maintenant (`public/pharmaco-logo.jpg`)
et la liste de mise en service porte l'étape, avec ses deux contraintes : une
réduction, le logo étant incorporé en data URI dans chaque rapport, et une
reprise de la mise en page, ce logo étant en portrait quand l'ancien était
carré. Écartés : a (ne rien changer sur les rapports) et c (tout changer
maintenant, en pleine phase d'essai — recevable, mais le repère de version
manquerait).

**Signature du tuteur** (question 25, choix a, 18/09/2026) : une seule image
de signature, celle du pharmacien responsable, incrustée à la clôture du
rapport. Le visa du tuteur reste une mention en toutes lettres — profil,
libellé du code, horodatage. Ce qui fait la valeur probante du rapport est le
sceau du serveur, l'horodatage et l'identité du code, non un dessin
copiable ; l'image du pharmacien a été retenue parce que ce document sort de
l'unité et que l'usage attend la signature du responsable. L'étendre aux
tuteurs ajouterait une donnée personnelle par tuteur, à porter au registre,
sans rien ajouter à la preuve. Réserve assumée : un document où un visa est
signé et l'autre non peut surprendre un auditeur. Le mécanisme étant écrit,
le choix b reste ajoutable plus tard sans rien défaire ; c (aucune image,
pharmacien compris) est écarté, la signature du responsable étant attendue
sur la pièce qui clôt l'habilitation.

**Motif d'arbitrage** (question 26, choix a, 18/09/2026) : le motif reste un
**texte libre** obligatoire, de 10 à 1 000 caractères, saisi par le tuteur
quand le verdict est indéterminé, conservé dans `rapports.arbitrage` et au
journal, imprimé sur le rapport. Un arbitrage est un jugement : une liste
fermée seule (choix c) l'appauvrirait au point de le rendre difficile à
défendre, et une liste plus un commentaire (choix b) n'apporterait la
comparabilité qu'au prix d'une nomenclature à tenir. Réserve assumée, et
c'est le prix du choix : un champ libre sur un dispositif pseudonymisé peut
recevoir un nom, qui entrerait alors en base et s'imprimerait, alors que tout
le reste a été construit pour n'en porter aucun. Aucun contrôle technique ne
sait reconnaître un nom de façon fiable ; la garantie est donc procédurale :
`[à préciser]` la procédure interne doit interdire d'écrire un nom dans le
motif, et l'administrateur peut annuler un rapport dont le motif en porterait
un.

**Création des identifiants d'agents** (question 27, choix a, 18/09/2026) :
un tuteur ou l'administrateur crée et clôt les identifiants `AG-NNN`, comme
aujourd'hui. Réserver ces actes au pharmacien (choix b) aurait fait passer
chaque arrivée par lui sans rien protéger : le tuteur vise les rapports, où
l'agent n'apparaît que par son identifiant, et il doit donc déjà savoir de
qui il s'agit pour viser en connaissance de cause. Le partage (choix c)
ajoutait une asymétrie sans effet, un identifiant clos n'effaçant rien.
Conséquence à porter au registre, et c'est la contrepartie du choix : la
connaissance de la correspondance identifiant ↔ personne n'est pas confinée
au pharmacien responsable, les tuteurs connaissant de fait celle des agents
qu'ils créent et qu'ils suivent. Le support de la correspondance reste
`[à préciser]`.

**Correspondance identifiant ↔ personne** (question 28, choix a,
18/09/2026) : un fichier tenu par le pharmacien responsable sur le réseau de
l'établissement, dans un dossier à droits restreints, lisible par les tuteurs
qui visent ; chemin et droits `[à préciser]`. Le besoin qui décide est la
lecture inverse : l'administration liste les rapports par `AG-NNN` et le
registre exporté aussi, si bien que sans table, retrouver qui est `AG-017`
supposerait d'ouvrir les dossiers un à un — le choix b (aucune liste
centrale, identifiant porté sur le dossier d'habilitation) reste un bon
complément, pas un substitut. Le choix c (enregistrement du système qualité)
serait meilleur sur le papier, apportant ses règles d'accès et de
conservation, mais rien ne permet de vérifier d'ici qu'il restreint assez
l'accès à une liste nominative. Cette table est conservée aussi longtemps que
le dossier d'habilitation et détruite avec lui ; elle ne vit jamais sur le
site, dont c'est tout le principe.

**Fonction de l'agent sur le rapport** (question 29, choix a, 18/09/2026) :
la fonction reste portée à l'édition, à côté du nom, hors sceau et jamais
enregistrée — c'est déjà ce que fait le site, le formulaire d'édition d'un
rapport enregistré portant un champ « Fonction (facultatif) » repris dans la
ligne « Fonction et unité » du rapport et dans le JSON d'archive, marqué
`hors_sceau`. Le rapport téléchargé par l'apprenant, en conservation
pseudonyme, laisse les deux lignes à compléter à la main. La porter en base
sous forme de liste fermée (choix b) n'aurait ajouté qu'une chose : la
fonction sous le sceau, donc opposable — au prix d'une donnée personnelle de
plus dans une base hébergée hors de l'établissement, et d'un anonymat
rétréci, « interne » désignant une personne quand il n'y en a qu'une ou deux.
Le choix c (rien, même à l'édition) privait le rapport d'une mention que le
dossier d'habilitation attend. Si la procédure interne venait à exiger que la
qualité de l'évalué soit scellée, b reste ouvert et devra être porté au
registre.

**Qui peut signaler une question** (question 30, choix a, 18/09/2026) :
n'importe quelle session, y compris un code de poste. Le préparateur au poste
est celui qui repère une question ambiguë, périmée ou fautive ; réserver le
signalement au tutorat (choix b) reviendrait à demander aux auteurs des
questions de détecter seuls leurs propres défauts, ce que la règle des quatre
yeux cherche à éviter. Le contenu reste anonyme — motif dans une liste
fermée, note libre, aucun identifiant d'agent — et un signalement ouvert sur
une question du tirage continue de verrouiller les visas du rapport
concerné. Revers assumé : un apprenant peut signaler une question qu'il a
ratée et retarder le visa de son propre rapport. Le blocage est borné, le
tutorat tranchant et clôturant, et visible dans l'administration. Le choix c
— ouvert à tous, mais seul un signalement du tutorat verrouille — reste la
réponse mesurée si un tel usage se manifestait ; il n'est pas retenu faute de
problème constaté.

**Numérotation des rapports** (question 31, choix a, 19/09/2026) :
`RAP-AAAA-NNNN` conservé tel quel, `AAAA` étant l'année d'émission et `NNNN`
une séquence PostgreSQL globale (`rapports_numero_seq`), jamais remise à
zéro. Un numéro est un identifiant de pièce, non un compteur de production
annuelle : la séquence globale garantit qu'aucun numéro ne désigne deux
documents, y compris à cheval sur un changement d'année ou si l'horloge du
serveur se décale. Le prix est cosmétique et assumé — `RAP-2027-0123` peut
surprendre un lecteur qui attend un compteur annuel. La remise à zéro
annuelle (choix b) aurait suivi l'usage documentaire courant ; elle n'est pas
retenue, et si elle devait l'être, ce serait avant la mise en service : deux
conventions dans un même registre se défendraient mal.

**Sauvegarde** (question 32, 19/09/2026) : la pièce de référence est le
rapport visé, classé au dossier d'habilitation — pas la base. La base reste
l'outil de travail : registre, suivi par agent, banque de questions. La
sauvegarde protège donc la continuité du service et la traçabilité
d'ensemble, non la preuve, et le régime le plus léger des trois proposés
suffit : sauvegardes quotidiennes du plan Pro `[à vérifier]`, `pg_dump`
conservé dans l'établissement avant chaque mise en service, essai de
restauration annuel en plus de celui qui précède le premier rapport réel.
Écartés : un `pg_dump` hebdomadaire ou mensuel, qui borneraient la perte de
registre à une semaine ou un mois — protection sans objet dès lors que la
preuve est au dossier. Réserve consignée : le rapport imprimé porte son
numéro et son empreinte, mais recalculer l'empreinte suppose le résultat
scellé, en base ou dans le paquet d'archivage ; sans l'un ni l'autre, le
document classé vaut par ses visas et non par une vérification. Restent
`[à préciser]` le responsable du dépôt et le support de conservation.

**Ce qui se classe au dossier** (question 33, choix b, 19/09/2026) : le
rapport A4 **et** le paquet d'archivage — HTML autoportant, CSV, JSON scellé
— déposé en GED ou sur le réseau à côté du dossier d'habilitation. C'est la
suite logique de la question 32 : si la pièce de référence est le document
classé, le dossier doit être autonome, et le paquet est ce qui rend
l'empreinte vérifiable des années après, la base ou l'hébergeur
disparaîtraient-ils. Le coût est d'un clic à la clôture. Écartés : a (rapport
A4 seul, qui fait reposer la valeur du document sur les seuls visas) et c
(HTML seul, lisible mais invérifiable). Deux conséquences consignées : le
paquet produit depuis le formulaire d'édition porte le nom et la fonction
dans ses fichiers, marqués hors sceau, et un paquet classé hors du site est
un traitement de plus à déclarer, dont la conservation et l'accès suivent le
dossier d'habilitation.

**Barème harmonisé** (question 34, 19/09/2026) : un seul modèle pour les
trois formats, réglé au même endroit avec les mêmes champs. Les **éléments**
d'une question — propositions d'un QCM ou d'une QIM, légendes d'un schéma —
valent chacun une part de 1/n, et cette part compte pour `juste`, `faux` ou
`sansReponse` ; la note se range entre un **plancher** et un **plafond**, ce
dernier valant aussi poids de la question dans le total (`decider` somme les
plafonds au lieu de compter les questions). Une seule fonction applique la
règle, `noterElements`, et `/admin/bareme` affiche six champs identiques par
format. Ce qui disparaît : le barème QIM à la discordance (1 / 0,5 / 0 / 0),
qui n'avait d'équivalent nulle part ailleurs, et la case « légende vide »,
devenue la part « sans réponse » du schéma. Un barème de l'ancien modèle
scellé dans un résultat reste lisible : `libelleBaremeCourt` reconnaît sa
forme et imprime la règle qui a noté ce rapport, avec la mention « avant la
refonte du 19/09/2026 ». Aucun rapport de la phase d'essai ne vaut preuve,
c'est ce qui rend cette refonte possible ; après la mise en service, un
changement de modèle se traiterait comme une nouvelle version du dispositif.

**QIM : « je ne sais pas »** (question 35, 19/09/2026) : chaque proposition
se juge Vrai, Faux ou **Je ne sais pas**, et le barème par défaut est celui
des quiz de Flore — juste +1/n, faux −1/n, « je ne sais pas » 0, plancher 0.
Ce barème avait été écarté au portage (journal d'intégration) ; le pharmacien
responsable le rétablit, la pénalité de l'erreur étant ce qui décourage le
cochage au hasard, et le « je ne sais pas » ce qui rend la pénalité
acceptable. Le format d'échange ne change pas : une proposition « je ne sais
pas » est une proposition non jugée, comme une proposition laissée de côté.
Elle reste comptée en discordance — la question n'est pas juste, et une
question éliminatoire échoue — mais elle ne retire aucun point.

**Réglage des parcours** (question 36, choix a, 19/09/2026) : le rattachement
d'un critère — **filières**, **niveaux**, présence en **intégration** ou en
**maintien** — se règle depuis `/admin/modules`, comme pour un module déposé,
alors que son texte reste versionné avec le site. Le réglage vit dans
`reglages_modules` (colonnes JSONB, `NULL` = ce que dit la fiche) et
s'applique partout où un programme se compose : accueil, parcours, module
suivant, écrans d'administration. La règle est pure et testée
(`content/reglages.ts`) ; une filière hors socle fait passer le critère au
programme de poste, le socle seul le remet au tronc commun.

La fiche d'habilitation reste la source : un réglage est un **écart assumé**,
affiché comme tel sur la ligne du module (« écart à la fiche : parcours :
maintien »), journalisé, et retiré d'un clic par « Rétablir la fiche ». C'est
ce qui écarte le choix b comme règle générale : un parcours composé à la main
serait une seconde source, capable de contredire la fiche sans que rien ne le
signale, alors que le rapport se lit critère par critère en face d'elle.

**Reste à faire** : le **parcours dégradé** du choix b, demandé pour les cas
qui ne suivent pas la fiche — intérimaire, remplaçant. Il sera nommé, composé
à la main, marqué « dégradé » partout où il apparaît, et ne se confondra pas
avec les deux parcours de la fiche.

**Volet de navigation et accueil allégé** (question 37, choix c, 19/09/2026) :
le site n'avait ni barre latérale ni menu d'accès rapide — la navigation
tenait dans une barre de liens en en-tête, repliée sur deux lignes sous
1000 px, et l'administration répétait treize liens en tête de chaque écran.
Mesuré au navigateur avant la reprise : l'accueil faisait **10,6 écrans de
défilement sur poste (1280 × 800) et 19,5 sur téléphone (390 × 844)**, dont
38 % à 47 % pour la seule liste des critères et 38 % à 43 % pour les
explications.

Trois pièces, décidées ensemble :

1. **Un volet unique** (`components/Menu.tsx`, `components/Navigation.tsx`) :
   barre latérale permanente au-dessus de 62 rem, **tiroir ouvert par un
   bouton « Menu »** en deçà, fermé à Échap, au voile et au suivi d'un lien.
   Fermé, il est en `visibility: hidden` : ses liens sortent de l'ordre de
   tabulation. Il porte les sections de l'accueil, les repères, et — pour un
   profil de tutorat ou d'administration — les écrans d'administration, dans
   un repli ouvert de lui-même sur `/admin`. La barre `nav-admin` disparaît
   des écrans d'administration : elle y était la même treize fois.
2. **Les explications quittent l'accueil** pour `/reperes` : le dispositif en
   six étapes, les formats et leur barème, le programme complet des 58
   critères, les conditions des niveaux, les questions fréquentes. La page
   est en rendu dynamique — elle annonce le barème **en vigueur**, jamais
   celui figé à la construction. L'avertissement qui compte reste en tête
   d'accueil, hors défilement : « Valider un module à l'écran ne vaut pas
   habilitation ».
3. **Les critères se replient par grand module** (bloc de la fiche), un seul
   groupe ouvert à l'arrivée, avec « Tout déplier » / « Tout replier ». Le
   choix est gardé le temps de la session, sur le poste, dans le
   `sessionStorage` — rien de nominatif, rien de transmis.

Écart assumé par rapport à ce qui était annoncé : les groupes ne sont **pas**
un accordéon strict — plusieurs peuvent rester ouverts. Sur tablette, gants
aux mains, un repli refermé d'office à chaque ouverture coûte un appui de
plus à chaque fois.

Résultat mesuré, base vide, même méthode : accueil **4 032 px (5,0 écrans)
sur poste et 7 422 px (8,8 écrans) sur téléphone**, soit **−53 %** et
**−55 %**. Les écrans d'administration perdent leur barre de liens (−11 % à
−20 %). La page d'un module **s'allonge de 7 % sur poste** (5 462 → 5 833 px)
: le volet prend 232 px, la colonne de texte se resserre. Le sommaire d'un
module ne passe en colonne qu'au-delà de 75 rem — deux colonnes latérales ne
tiennent pas en deçà — et se replace au-dessus du texte en dessous.

Ce qui n'est pas fait : il n'existe **aucun tutoriel d'usage du site**. Les
repères portent le dispositif d'habilitation, pas le maniement de l'outil.
Destinataire et contenu restent `[à préciser]`.

**Dépôt de questions : prompt de mise en forme et illustrations** (19/09/2026,
demande du pharmacien responsable) : trois points, dont un qui n'était qu'un
défaut de visibilité.

1. **Le dépôt existait et ne se voyait pas.** Il est à
   `/admin/questions/import`, atteignable depuis la banque de questions et
   depuis chaque ligne de module, mais le volet l'appelait « Dépôt » dans un
   groupe « Administration » replié. Le groupe s'ouvre désormais de lui-même,
   et les entrées portent leur nom : « Banque de questions », « Déposer des
   questions », « Écrire une question ».
2. **Un prompt de mise en forme** (`content/prompt-depot.ts`), copiable depuis
   l'écran de dépôt, pour faire passer un texte brut au format attendu par
   l'assistant de son choix. Le site, lui, **n'appelle aucune IA** : aucun
   texte de l'unité ne sort par le serveur, et l'analyseur reste celui qui ne
   devine rien. Le prompt interdit explicitement d'inventer un corrigé, une
   justification ou une source — c'est le risque propre de l'exercice, une IA
   complétant volontiers ce qui manque — et impose `[à vérifier]` quand le
   texte source est muet. Deux garde-fous derrière : toute question déposée
   entre « à vérifier » et attend un autre code que son auteur (question 12) ;
   et `test/prompt-depot.test.ts` passe l'exemple du prompt dans l'analyseur
   réel, de sorte que le format décrit et le format lu ne puissent pas
   diverger en silence.
3. **Les illustrations** : jusqu'ici, seule une question de format schéma
   pouvait porter une image. N'importe quelle question peut désormais en
   porter une — photographie d'un sas, d'un plateau, d'une étiquette — dans
   l'éditeur comme au dépôt, avec sa description lue à la place de l'image.
   Au dépôt, l'illustration s'apparie **par son nom de fichier seulement** :
   l'appariement au rang ou à l'image unique reste réservé aux schémas, où
   l'image est la question ; l'étendre aux QCM collerait l'image d'un schéma
   voisin sur une question qui n'en demandait pas.

Ce qui n'est pas fait : le rendu d'une illustration sur le **rapport A4**. Le
rapport porte les verdicts, pas les énoncés ; y incruster les images
alourdirait un document qui se relit et s'archive.

**Deux formats de plus : séquence à ordonner et texte à trous** (19/09/2026,
demande du pharmacien responsable) : l'évaluation ne savait poser que des
QCM, des QIM et des schémas à compléter. S'y ajoutent :

- **la séquence à ordonner** (`ORD`) — des étapes reçues mélangées, auxquelles
  l'apprenant donne un rang. Un menu déroulant par étape, pas de
  glisser-déposer : l'usage se fait gants aux mains, sur tablette, et un menu
  natif s'ouvre en plein écran sur iPad comme sur téléphone. Un rang déjà pris
  est retiré à l'étape qui le portait — la réponse reste toujours une
  permutation lisible ;
- **le texte à trous** (`TAT`) — l'énoncé porte les marques `{1}`, `{2}`… et
  chaque trou se remplit avec une vignette prise dans une liste commune
  (attendues et leurres mêlés, mélangés par le serveur).

Les deux suivent **le barème harmonisé**, avec leurs six réglages propres dans
`/admin/bareme` : une étape à sa place ou un trou bien rempli vaut sa part,
une erreur la retire, une absence de réponse ne compte pas, plancher et
plafond bornent la note. Par défaut, le barème des quiz de Flore, comme les
autres formats.

Ce qui ne change pas : **la réponse ne quitte jamais le serveur**. L'ordre
juste et les vignettes attendues vivent dans `bonnesReponses`, retiré par
`sanitizeQuestion` ; pour ces deux formats, l'ordre de rangement des options
porterait la réponse à lui seul, il est donc mélangé avant l'envoi. La
correction d'un texte à trous compare le **mot** et non l'identifiant de la
vignette : deux vignettes peuvent porter le même mot, et l'apprenant ne
choisit que ce qu'il lit.

Dépôt et écriture : les deux formats s'écrivent dans l'éditeur et se déposent
en texte (« SÉQUENCE 1. » puis les étapes numérotées dans l'ordre juste ;
« TEXTE 1. » avec ses marques, ses vignettes attendues numérotées et une ligne
« Leurres : … | … »). Le prompt de mise en forme les décrit, et son exemple
est passé dans l'analyseur réel par `test/prompt-depot.test.ts`.

Deux points à connaître :

- la contrainte de format de la table `questions` a été refaite (`ORD` et
  `TAT` s'ajoutent à `QCM`, `QIM`, `SCH`) : une base déjà en service la reçoit
  au démarrage suivant, par les instructions idempotentes de `lib/schema.ts` ;
- un barème scellé **avant** cette date ne porte pas ces deux formats : son
  libellé ne les mentionne pas, et un rapport ancien se relit exactement comme
  il a été noté.

**Plus de porte d'amorçage publique** (19/09/2026, demandé par le pharmacien
responsable) : le bouton « Créer l'administrateur initial » de `/connexion` et
l'action serveur qui le servait sont supprimés, ainsi que l'encart qui
affichait le code sur l'écran d'administration.

Le motif est une faille, constatée en relisant le code au moment de brancher
la base de production. `/connexion` est une **page publique** — le filtre
d'entrée l'exclut de la garde, puisqu'il faut bien pouvoir entrer un code — et
le bouton s'y affichait dès qu'une base était configurée. Entre le branchement
de la base et la création du premier compte, **quiconque atteignait cette
adresse devenait administrateur en un clic**, avec session ouverte dans la
foulée. Sur un dispositif destiné à devenir opposable, cette fenêtre n'était
pas défendable, si étroite fût-elle.

L'amorçage passe donc là où seul l'exploitant entre : la variable
`ADMIN_INITIAL` du tableau de bord de l'hébergeur. Au premier accès à la base,
et **seulement s'il n'existe aucun administrateur actif**, le code est haché
(scrypt, sel par code) et inscrit sous le libellé « Administrateur initial » ;
l'opération est journalisée sous le rôle `systeme`. Elle se fait dans la
transaction du schéma, sous le verrou consultatif : deux instances qui
démarrent ensemble n'en créent qu'un. La marche à suivre — poser la variable,
entrer, créer ses codes, révoquer celui-ci, **supprimer la variable** — est
dans `docs/DEPLOIEMENT.md`, « Amorçage du premier administrateur ».

Deux conséquences assumées :

- une base neuve n'est plus installable depuis le seul site : il faut accéder
  au tableau de bord de l'hébergeur. C'est le prix de la fermeture, et c'est
  cohérent avec le fait que `DATABASE_URL` et `AUTH_SECRET` y vivent déjà ;
- si l'unique administrateur est désactivé alors que la variable est encore
  posée, un redémarrage en recrée un. D'où la consigne de la supprimer.

Au passage, la fabrication et le hachage des codes quittent `lib/auth.ts` pour
`lib/codes.ts`, module sans cookie ni base ni Next : `lib/db.ts` en a besoin
pour l'amorçage, et `lib/auth.ts` dépend déjà de `lib/db.ts`. Les appelants
continuent d'importer depuis `lib/auth.ts`, qui réexporte. Le parcours de bout
en bout vérifie désormais qu'**aucun bouton ni encart d'amorçage ne subsiste**
sur `/connexion`, puis entre avec le code d'`ADMIN_INITIAL`.

**Filières et niveaux ajoutables, référentiel scellé** (question 38, choix b,
19/09/2026) : l'unité peut créer ses propres filières et ses propres niveaux
depuis **Administration → Référentiel**, sans livraison de code. Une ligne
déposée qui reprend l'identifiant d'une filière de la fiche la **corrige**
(libellé, description, badge, blocs) ; un identifiant nouveau l'**ajoute**.
Un dépôt désactivé quitte les listes de rattachement sans rien effacer.

Le choix b a été préféré au choix a (filières seules) en connaissance de son
coût : la chaîne « niveau → prérequis → acquis → rapport » devient une donnée
modifiable après coup. **La contrepartie est le scellement.** Un résultat
d'évaluation recopie désormais, à côté du barème, le référentiel du module au
moment où il est passé — identifiants et libellés des filières et des niveaux,
avec la condition d'obtention (`ResultatEvaluation.referentiel`). Un rapport
se relit donc tel qu'il a été émis, même après un renommage, un retrait ou une
réorganisation. Le champ est facultatif : un rapport antérieur au 19/09/2026
s'affiche sans cette mention, il n'est pas réécrit.

Ce qui change dans le code :

- `content/referentiel-db.ts` sert les listes aux écrans (fiche versionnée
  corrigée et complétée par les dépôts actifs) ; sans base, ce sont les listes
  de la fiche, inchangées ;
- `NiveauHabilitation` n'est plus une union fermée : les codes de la fiche
  restent nommés — l'éditeur les propose toujours — et `string & {}` accepte
  les autres. `Niveau.filiere` s'ouvre de même ;
- `filtrerProfils` valide contre le référentiel **servi**, plus contre une
  liste figée : une filière déposée est acceptée au rattachement d'un module.
  À la **relecture** d'une ligne déjà enregistrée, en revanche, aucun filtrage
  n'est appliqué : une filière retirée depuis ne doit pas disparaître en
  silence du module qui la cite, elle doit rester visible pour être corrigée ;
- les écrans lisent le référentiel au lieu d'importer la constante.

**Banque de badges** (19/09/2026) : dix-sept pictogrammes dessinés dans
`components/Badge.tsx`, en SVG monochrome sur une grille de 24 — isolateur,
hotte, flacon, seringue, poche, gants, balance, sonde, filtre, déchets,
étiquette, contrôle, document, formation, sas, nettoyage, préparation,
stockage. Rien n'est téléchargé, aucune licence tierce n'entre dans le dépôt,
et le trait reste lisible en impression noir et blanc. Une filière porte le
sien ; le choix se fait sur une grille qui montre les pictogrammes, pas une
liste de noms.

**Arborescence de la banque de questions** (19/09/2026) : en tête de
**Banque de questions**, filière → niveau → module, avec le compte des
questions validées et à vérifier et une jauge par ligne. Elle ne remplace pas
la liste, elle la précède et sert à s'y rendre — un clic sur un module ouvre
la liste filtrée dessus. Sa valeur est autant dans ce qu'elle montre que dans
ce qu'elle laisse voir en creux : **un module sans question apparaît en grisé**,
et les trous de la banque sautent aux yeux.

Trois cas sont rendus fidèlement plutôt que masqués : un module rattaché à deux
niveaux figure sous chacun ; un module sans niveau est listé sous « tous
niveaux » ; une filière ou un niveau cité par un module mais absent du
référentiel apparaît sous une étiquette d'avertissement, au lieu de disparaître.
Le repli est en `<details>` : pas une ligne de script, et il fonctionne au
clavier comme le reste du site.

**Paquet A — navigation** (21/09/2026, demande « construis le paquet A
complet »). Six évolutions, livrées ensemble parce qu'elles règlent le même
défaut : les données existaient déjà en base, seul l'affichage manquait.

**A1. Accès rapide** (`components/AccesRapide.tsx`, spécifié par
`docs/ACCES-RAPIDE.md`). Le volet répond à « où puis-je aller ? » ; ce panneau
répond à « fais ce pour quoi je suis venu », et montre **avant** le clic s'il y
a quelque chose à y faire. Trois zones invariables — Reprendre, À faire, Aller
à — plus un champ de filtre. Déclenché par le hamburger, par `⌘K` / `Ctrl+K` et
par `/`.

Le hamburger change de rôle : il n'ouvre plus le volet — qui redevient une
barre latérale permanente, présente au-dessus de 62 rem et rien d'autre — mais
l'accès rapide, **une seule surface aux deux tailles** : tiroir à gauche sous
62 rem, panneau centré à 12 vh au-dessus. C'est la feuille de style qui décide ;
le balisage, les intitulés et l'ordre sont les mêmes.

Trois écarts assumés par rapport à la spécification du 19/09, tous mesurés ou
raisonnés sur pièce :

1. **« Identifiants d'agents » et « Codes d'accès » quittent la file.** Ce sont
   des écrans, pas des files d'attente : le nombre qu'on leur accolerait —
   l'effectif, le nombre de codes — n'appelle aucun acte, or c'est le compteur
   qui informe. Ils restent dans « Aller à ».
2. **« Verdicts à arbitrer » passe de l'administration au tutorat.** L'arbitrage
   est l'acte du tuteur (`peutArbitrer`, `app/admin/rapports/[id]/page.tsx`) ;
   l'administration l'exerce aussi. Les deux profils portent donc la même liste
   dans le même ordre ; seuls les compteurs diffèrent, le visa du pharmacien
   demandant un code d'administration.
3. **« Aller à » figure aussi dans le panneau de poste**, là où le § 5.2
   annonçait un panneau « qui ne répète pas la navigation ». Un lanceur dont la
   recherche n'atteint pas les écrans n'est pas un lanceur, et la main n'a pas
   à quitter le clavier pour rejoindre le volet.

Le § 9 de la spécification annonçait par ailleurs que le décompte « verdicts à
arbitrer » n'existait pas en base et serait à ajouter à `lib/pilotage-db.ts`.
**C'était faux** : `rapportsEnAttente()` renvoie déjà `verdict_brut` et
`arbitre` ; c'est un filtre, pas une requête.

**A2. Compteurs d'attente** (`lib/attente.ts`, `content/acces-rapide.ts`). Tous
viennent des fonctions qui alimentent déjà les écrans correspondants —
`compterSignalementsOuverts()`, `comptesParModule()`, `rapportsEnAttente()` :
c'est la seule façon qu'ils ne divergent pas, et le parcours de bout en bout
compare le chiffre du panneau à celui de l'écran de pilotage. **Un chiffre,
jamais une pastille de couleur seule**, et le compteur est dans le nom
accessible (« Signalements ouverts, 3 en attente »).

Distinction tenue entre les deux surfaces : **dans le panneau, un item à zéro
reste affiché** — on l'ouvre précisément pour savoir s'il y a quelque chose, et
« 0 » est le renseignement qui évite le déplacement ; **dans le volet, un
compte nul n'affiche rien** — le volet est la carte, pas la file, et un « 0 »
permanent sur chaque entrée serait du bruit. Le déclencheur, lui, ne porte
qu'une pastille de 6 px : de l'extérieur, la seule chose utile est qu'il y a
quelque chose.

**A3. « Reprendre ».** Deux sources, deux portées : l'évaluation laissée en plan
vient de la table `en_cours` (`dernierEnCours()`), donc seulement si la
progression est rattachée à un identifiant d'agent — sans rattachement, une
évaluation interrompue vit dans la page et meurt à la navigation, il n'y a rien
à reprendre et rien à annoncer ; le repère de lecture vient de `localStorage`,
local au poste. `LectureModule` écrit désormais un second repère
(`fp-lecture-dernier`) disant **quel** module a été lu en dernier : sans lui, il
faudrait balayer toutes les clés du stockage sans savoir laquelle est la plus
récente, aucune n'étant datée. La zone disparaît entièrement s'il n'y a rien à
reprendre : un cadre vide coûte une lecture pour un renseignement nul.

**A4. Fil d'habilitation** (`components/FilHabilitation.tsx`). Les six étapes de
`content/habilitation.ts`, les deux que le site couvre distinguées des quatre
qui se déroulent au poste et chez le pharmacien. Il n'est pas décoratif : il
corrige le malentendu « module validé = habilité ».

**Sur les écrans de module seulement.** L'accueil porte déjà la phrase deux
fois — en sur-titre (« étapes 1 et 2 sur 6 ») et dans l'encart « Valider un
module à l'écran ne vaut pas habilitation » ; une troisième occurrence n'aurait
rien ajouté qu'une bande de plus. C'est dans le module et dans l'évaluation que
rien ne le dit. Les pastilles ne sont pas cliquables : six cibles de 20 px
violeraient la règle de taille ; un seul lien, en fin de bande, mène aux repères.

**A5. Entrée de page** (`components/PageAnimee.tsx`). Un fondu de 160 ms à
chaque changement de chemin, coupé par `prefers-reduced-motion` comme le reste.

Ce n'est **pas** l'API *View Transitions*, qui fondrait l'ancienne page dans la
nouvelle : elle demanderait le drapeau `experimental.viewTransition` de Next —
un drapeau expérimental sur un site qui produit des documents opposables, pour
un fondu croisé au lieu d'un fondu simple. Le rapport n'y est pas.

**Deux écritures ont été retirées après mesure**, et la leçon vaut d'être
consignée : une animation d'entrée qui **déplace** le contenu est un défaut, pas
un détail.

1. La première posait `key={chemin}` sur `<main>` pour relancer l'animation.
   Jeter et reconstruire tout le sous-arbre à chaque navigation rendait le
   contenu momentanément absent : la chaîne de bout en bout est tombée trois
   fois, à trois endroits différents.
2. La seconde relançait l'animation depuis un effet, sans démontage, mais
   conservait la translation de 6 px. L'effet s'exécutant **après** la peinture,
   le contenu sautait de 6 px alors que la page était déjà cliquable — un clic
   parti pendant ces 160 ms pouvait manquer sa cible. La chaîne est retombée, à
   un quatrième endroit.

L'écriture retenue **ne joue que sur l'opacité** : la boîte ne bouge pas,
l'élément reste cliquable du premier au dernier millième, et la classe est
posée par un effet de mise en page (`useLayoutEffect`) donc avant la peinture,
sans clignotement. Deux passages complets de la chaîne, consécutifs, à
59 étapes et zéro erreur serveur.

**A6. Mode zone** (`components/ModeZone.tsx`). Interrupteur d'en-tête : cibles
portées de 44 à 52 px, corps de texte de 16 à 18 px. Ce n'est pas un réglage
d'accessibilité de plus, c'est le contexte d'usage réel de la tablette — zone
d'atmosphère contrôlée, double gantage, visière — sans pénaliser le poste de
bureau le reste du temps. Mémorisé dans `localStorage` sous une clé qui ne
désigne personne : c'est un réglage de poste, le site ne connaît pas
d'utilisateur.

S'y ajoute une correction générale, valable hors mode zone : sous
`@media (hover: none)`, les états de survol sont ramenés à leur aspect de repos.
Sans pointeur, le survol « colle » après un appui et désigne une cible que le
doigt a déjà quittée.

**Défaut de contraste trouvé en chemin, antérieur au paquet A.** Un bouton rendu
par un `<a>` héritait de `a:hover { color: var(--marque-fonce) }`, règle de
spécificité 0-1-1 qui l'emporte sur `.bouton { color: … }` (0-1-0). Sur la
variante pleine, dont le survol pose aussi `background: var(--marque-fonce)`, le
libellé passait donc à #003F65 sur un fond #003F65 : **contraste 1:1, texte
invisible au survol**. Mesuré le 21/09/2026 sur « Voir mes modules », corrigé
par `a.bouton:hover { color: var(--marque-contraste) }`, les variantes claires
gardant le bleu foncé, lisible sur `--marque-clair`.

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
- Conservation des rapports activée le 19/09/2026 après examen du DPO
  (`CONSERVATION_RAPPORTS=pseudonyme`) : les résultats des agents sont
  conservés sous le seul numéro d'anonymisation (`AG-NNN`), le fichier de
  rapprochement numéro ↔ personne étant tenu hors du site (question 28,
  choix a). Le code ne change pas — ce mode existait depuis le 18/09/2026 ;
  c'est la variable d'exploitation qui bascule, et elle se pose dans le
  tableau de bord de Render, le service ayant été créé hors blueprint. Ce que
  l'examen du DPO ne tranche pas reste marqué dans `docs/RGPD.md`.
- Tableau de bord de pilotage (19/09/2026), `/admin/pilotage`, ouvert aux
  tuteurs et à l'administration. Il répond dans l'ordre à : où en est-on,
  qu'est-ce qui attend quelqu'un, où ça coince — d'où le classement des
  critères par taux d'acquis **croissant**, le plus bas en tête. Cinq filtres
  communs à tous les blocs (filière, niveau, bloc de compétence, module,
  période) : un indicateur et son graphique portent toujours sur le même
  périmètre, rappelé en clair sous le formulaire. Aucun nom n'y paraît.
  Graphiques tracés en SVG **côté serveur** — aucune bibliothèque, aucun
  script au navigateur, la page s'imprime telle quelle ; chaque figure porte
  un `aria-label` et les chiffres qu'elle résume restent écrits à côté d'elle.
  Agrégation faite **dans la base** (`lib/pilotage-db.ts`) : un rapport porte
  son résultat scellé en JSONB, détail des questions compris, et les charger
  tous pour compter en mémoire coûterait des dizaines de méga-octets par
  affichage. Le verdict compté est celui de `verdictFinal` — l'arbitrage du
  tuteur l'emporte sur un verdict brut indéterminé — transcrit une seule fois
  en SQL et vérifié de bout en bout par le parcours e2e, qui arbitre un
  rapport puis lit le tableau de bord.
  Deux conventions de lecture, nommées comme telles et non comme des normes :
  une question n'est signalée « manquée » qu'au-delà de cinq passages et
  jusqu'à 60 % de réussite ; un critère sans rapport est mis à part, comme non
  couvert, jamais classé comme mauvais. Sans conservation des rapports
  (`CONSERVATION_RAPPORTS=aucune`), la page ne montre que l'état de la banque
  et le dit.
- Illustrations de domaine (19/09/2026, images fournies par le pharmacien
  responsable) : 20 aquarelles rondes découpées des cinq planches, détourées en
  WebP 256 px (484 Ko au total), versionnées dans `public/badges/` plutôt que
  déposées en base — elles suivent le déploiement, survivent à une remise à
  zéro et se servent sans session. Deux familles cohabitent et ne se
  confondent pas : les pictogrammes SVG restent pour ce qui se rend en
  pastille (filière, 24 px), les illustrations pour la vignette d'un module
  (72 à 96 px). Mesuré : en dessous de ~72 px le dessin ne se lit plus, et
  leurs légendes internes ne se lisent à aucune taille d'écran — ce sont des
  ornements, sans valeur normative, jamais repris sur un rapport (certaines
  portent des mentions décoratives sans signification, ce qui n'a pas sa place
  sur une pièce opposable).
  Un module porte son badge (`modules_deposes.badge`) ; pour ceux déjà en
  place, une illustration est **proposée d'après le titre et l'objectif**
  (`badgeSuggere`, `content/badges.ts`) et se remplace dans le formulaire.
  Trois états distincts, sans quoi retirer un badge le ferait revenir à la
  lecture suivante : vide = jamais renseigné (proposition), `aucun` = retiré à
  la main, sinon l'identifiant choisi. Rien n'est proposé quand aucun mot ne
  correspond : une illustration fausse coûte plus cher qu'une case vide.
  Seconde série le 19/09/2026 : treize illustrations de plus, **trente-trois au
  total** (732 Ko). Quatre d'entre elles viennent d'une planche au dessin
  différent — aplats colorés, anneau plus fin — et se distinguent des autres
  dans la grille. Presque aucun texte interne cette fois, contrairement à la
  première série. Deux illustrations sont volontairement sans mot-clé de
  proposition, « Hotte à flux laminaire » et « Résultats conformes » : elles
  recouvrent un domaine déjà tenu, et inventer une distinction que les titres
  ne portent pas produirait de mauvaises propositions. L'ordre des règles est
  vérifié par des tests appariés — « tri des déchets » avant « déchet »,
  « HEPA » avant « flux d'air », « combinaison » avant « tenue »,
  « classification SGH » avant « classification ».
- Logo d'unité remplacé le 19/09/2026 (question 41, choix a) par le mandala
  « pharmacotechnie — unité de production des chimiothérapies », **partout** :
  en-tête du site, en-tête du rapport A4 et icône d'onglet, servis par les
  mêmes fichiers — `pharmaco-web.png` (192 px) et `pharmaco-icone.png`
  (180 px), palette de 160 couleurs, 15 Ko chacun, soit le poids de l'ancien,
  donc aucune page ni aucun rapport alourdi (le fichier est incrusté en
  adresse `data:` dans chaque rapport). Hauteurs de rendu portées de 44 à
  56 px à l'écran et de 36 à 48 px sur le rapport : mesuré aux trois tailles,
  ce dessin au trait fin est une tache colorée en dessous, là où l'ancien
  « P » restait lisible à 44. Mesuré aussi, la mise en page du rapport étant
  validée : la hauteur du bandeau ne bouge pas — 132 px que le logo fasse 36,
  44 ou 48 px, c'est le bloc de titre sur quatre lignes qui la fixe.
  L'empreinte SHA-256 d'un rapport porte sur la forme canonique du résultat et
  **ne couvre pas les logos** (vérifié dans `lib/sceau.ts`) : aucun rapport
  émis n'est invalidé ; seule une réimpression porte le nouveau logo.
  Cette décision **revient sur la question 24, choix b du 18/09/2026**, qui
  reportait le changement des rapports à la mise en service pour ne pas laisser
  deux générations d'une pièce opposable sans rien qui les explique. C'est
  l'empreinte qui l'a levée : les deux générations ne se distinguent que par
  l'illustration, jamais par ce qui est scellé, et le repère de version reste
  l'étiquette `vN`. La liste de mise en service (point 5) et le point 26 des
  questions ouvertes ne portent donc plus d'étape de logo.
  **Second logo d'unité ajouté le 19/09/2026** à l'opposé du premier, sur les
  écrans comme sur le rapport : le mandala et le logo HdV tiennent la gauche,
  le monogramme « P » (`public/pharmaco-p.png`, 192 px, 5,1 Ko, blanc rendu
  transparent) ferme le bandeau à droite. Taille retenue **56 px à l'écran et
  56 px sur le rapport**, par mesure et non par goût : la hauteur du bandeau
  vaut 77 px pour un logo de 48 ou 56 px, 85 px à 64 et 93 px à 72 — c'est le
  mandala à 56 px qui fixe le plancher, donc 56 ne coûte rien. Or la signature
  « pharmacotechnie » de ce disque, qui porte une large marge interne, ne
  devient lisible qu'à 72 px (mesuré à 48, 56 et 72) : payer 8 px de bandeau
  sur chaque écran pour une signature qui resterait illisible n'achète rien,
  et 72 px allongerait le bandeau de 21 %. La signature est donc assumée
  décorative, le nom de l'unité étant déjà écrit en toutes lettres à côté.
  Son `alt` est vide : le premier logo porte déjà ce nom, le répéter ferait
  entendre deux fois la même chose à un lecteur d'écran. Même mesure sur le
  rapport : en-tête de 115 px à 48 comme à 56 px, 132 px à 64.
  Logos d'unité versés dans la même banque le 19/09/2026 (question 40,
  choix b) : Préparation, Bionettoyage, Validation pharmacotechnique et
  Pharmacotechnie, **trente-sept illustrations** au total (796 Ko). Ils
  portent leur nom dans l'image, donc `forme: "libre"` — le rognage circulaire
  des autres en couperait les extrémités —, et **aucune proposition
  automatique** : un logo désigne une unité, pas un domaine ; un module
  « Bionettoyage des ZAC » reçoit l'illustration du nettoyage, pas le logo, et
  un test le vérifie. Réserve exprimée puis levée par le pharmacien
  responsable : leurs sous-titres ne se lisent pas en vignette de 96 px.
  La cohérence des deux fichiers est tenue par le type — `PICTOGRAMMES` est un
  `Record<NomPictogramme, …>`, donc une entrée oubliée ou inventée est une
  erreur de compilation, vérifié.
- TLS vers la base, degré retenu le 19/09/2026 (choix a) : `DATABASE_SSL=require`
  **et** « Enforce SSL on incoming connections » activé côté Supabase, une fois
  `base_tls` constaté chiffré. L'interrupteur n'ajoute pas de chiffrement — la
  liaison l'est déjà — il interdit d'en ouvrir une en clair, donc protège d'un
  `DATABASE_SSL=disable` posé un jour pour dépanner. `verify` (authentification
  du serveur) est reporté à un créneau avant la mise en service : le certificat
  de l'autorité de Supabase couvre-t-il l'hôte du pooler, `[à vérifier]`, et
  sinon le service perd sa base au redéploiement.
- Chiffrement de la liaison avec la base exposé dans `/api/sante`
  (`base_tls`, 19/09/2026) : le protocole est constaté à l'ouverture de chaque
  connexion du pool, sur notre propre flux (`protocoleTls`, `lib/reseau.ts`),
  pas dans la vue `pg_stat_ssl` — qui décrirait la connexion du pooler de
  session vers PostgreSQL et non la nôtre vers le pooler. Mesuré à
  l'ouverture et mémorisé, donc lu sans ouvrir de connexion : la page de
  santé sert de contrôle de santé à Render, elle ne doit pas ralentir. Sert à
  constater que la liaison est déjà chiffrée **avant** d'exiger TLS côté
  Supabase, un interrupteur posé sur une liaison en clair coupant le service
  de sa base.
- En-têtes de sécurité posés par `next.config.ts` (19/09/2026), donc sur
  toutes les réponses — pages, routes d'API, fichiers statiques, et jusqu'aux
  redirections et aux 401 du middleware, mesurés : `poweredByHeader: false`
  retire `X-Powered-By: Next.js` (défaut de Next, `config-shared.js`), qui
  annonçait la pile technique ; `Content-Security-Policy: frame-ancestors
  'self'`, doublé de `X-Frame-Options: SAMEORIGIN` pour les navigateurs
  anciens, interdit à toute autre origine d'enfermer une page dans une iframe
  (détournement de clic). `'self'` et non `'none'` : les documents de synthèse
  PDF s'affichent dans une iframe de même origine (`/api/fichiers/<id>`,
  `components/Evaluation.tsx`). Ce n'est pas une politique de sécurité du
  contenu complète : sans `script-src`, elle ne protège pas de l'injection de
  script — non fait, à décider.

## Suppression d'un code d'accès : confirmée par le code de l'administrateur (21/09/2026)

Demandé le 21/09/2026 : *« Pour la suppression des utilisateurs ne l'autorise
que par administrateur »*, puis *« Suppression avec saisi mot de passe par
administrateur de l'utilisateur »*.

**État avant.** La suppression était déjà réservée au rôle `admin`
(`sessionRequise("admin")`, `app/actions.ts`), et le bouton n'était affiché
qu'à lui. La première moitié de la consigne était donc déjà tenue ; c'est la
seconde qui manquait : l'acte partait au premier clic.

**Ce qui est posé.** Le formulaire est replié derrière « Supprimer… » et
demande le **code qui a ouvert la session en cours**, comparé à son empreinte
(`confirmerCodeDeSession`, `lib/auth.ts`). Le site n'a pas de mots de passe :
le code d'accès en tient lieu, et c'est lui qu'on retape.

**Pourquoi le code de *cette* session et non n'importe quel code
d'administration.** Confirmer, c'est prouver qu'on est le porteur de la
session ouverte, pas qu'on connaît un code d'administration quelconque. Si
n'importe quel code admin valait confirmation, un second administrateur
passant devant un écran laissé ouvert pourrait supprimer sous l'identité du
premier — et le journal porterait le mauvais profil.

**Deux barrières, deux questions.** Le rôle dit ce que la session a le droit
de faire ; la confirmation dit qui est devant l'écran. Sur une tablette
laissée ouverte en zone, seule la seconde tient.

**Échecs comptés par le limiteur de connexion** (`lib/limiteur.ts`), et une
confirmation juste efface le compteur, exactement comme une connexion. Sans
cela, la même devinette serait comptée d'un côté et libre de l'autre.
Conséquence assumée : cinq saisies fausses bloquent l'adresse un quart
d'heure, y compris pour se reconnecter — c'est le comportement de la
connexion, appliqué au même secret.

**Une normalisation unique** (`normaliserCode`, `lib/codes.ts`), partagée par
la connexion et la confirmation : sans elle, un code accepté à l'entrée
pouvait être refusé à la confirmation selon les espaces et la casse.

**Refus journalisé** sous `suppression-code-refusee`, avec son motif
(`code-invalide`, `bloque`, `indisponible`) : une tentative qui échoue est
précisément ce qu'on veut relire après coup. Vérifié de bout en bout.

**Son propre code ne se supprime pas** (tranché le 21/09/2026, question 41) :
supprimer le code de sa propre session, c'est se fermer la porte, et si
c'était le dernier code `admin` actif, la remise en service passerait par
l'hébergeur (`ADMIN_INITIAL` reposé puis redéploiement, l'amorçage ne
s'ouvrant qu'en l'absence d'administrateur actif).

Le refus tombe **avant** la confirmation, et aucun champ de code n'est même
présenté : la question n'est pas de savoir qui est devant l'écran, elle ne se
pose plus. Le contrôle reste affiché, inactif, avec le motif écrit — un
bouton qu'on retire sans rien dire laisse chercher ; un bouton inactif qui
s'explique clôt la question. Le serveur refuse quand même, indépendamment de
ce que l'écran présente : le parcours réactive le bouton dans la page et
vérifie que l'action est rejetée.

Pour supprimer ce code-là : ouvrir une session avec un autre code
d'administration.

**Révocation de son propre code : même confirmation** (tranché le 21/09/2026,
question 42, choix a). Elle ferme la session aussi sûrement que la
suppression, et un code révoqué ne permet plus de se reconnecter pour le
réactiver : même verrouillage, donc même barrière. Elle reste **possible** —
on peut vouloir couper son propre accès — mais elle cesse de partir au clic.
Révoquer le code d'un **autre** reste d'un clic, sans confirmation : c'est le
geste d'urgence quand un code circule, et le brider coûterait des secondes au
pire moment.

**Défaut corrigé au passage : l'action de bascule ne revérifiait pas le rôle
de la cible.** `actionBasculerCode` exigeait `sessionRequise("tuteur")` mais
n'appelait pas `peutGererRole` ; l'écran n'affichait les boutons qu'à qui
pouvait les actionner, et c'était la seule protection. Une requête forgée
depuis une session de tutorat révoquait donc un code d'administration. Cela
contredisait la règle écrite en tête de `app/actions.ts` — « la protection ne
repose jamais sur le fait que l'écran soit affiché ou non ». Le défaut
**précède** les travaux du 21/09/2026 ; il a été trouvé en posant la
confirmation de révocation. Corrigé, et le parcours le mesure : une session de
tutorat modifie l'identifiant caché d'un formulaire qui lui est offert pour
viser un code d'administration, et l'action est refusée puis journalisée
(`bascule-code-refusee`).

**Hors périmètre, inchangé.** La *révocation* d'un code reste au tuteur et
sans confirmation : elle est réversible, et c'est le geste d'urgence quand un
code circule. La clôture d'un identifiant d'agent n'est pas une suppression.
Aucun agent ne se supprime : les rapports s'y rattachent.

## Récapitulatif avant la validation d'une évaluation (21/09/2026)

Retenu d'une liste de propositions d'ergonomie soumise le 21/09/2026 ; c'est
la seule des huit qui protégeait un acte plutôt qu'un confort.

**Ce qui n'allait pas.** « Valider l'évaluation » était actif dès **une
seule** question renseignée et corrigeait au premier clic. La barre de
passation disait *combien* de questions étaient renseignées, jamais
*lesquelles* manquaient. Avec des gants, sur une tablette, c'est le geste
qu'on fait sans le vouloir.

**Ce qui est posé.** Un panneau modal s'ouvre : le compte renseignées sur
total, les questions sans réponse **nommées** et cliquables — chacune ramène
à la question, qui prend le focus —, ce que la validation engage, puis deux
actions. Le second geste est à une autre place et sous un autre libellé que le
premier : « Valider définitivement » n'est pas « Valider l'évaluation ».

Échap et « Revenir aux questions » sortent toujours, la tabulation ne quitte
pas le panneau : ce n'est donc pas un piège au clavier (WCAG 2.1.2).

**Portée, sans l'exagérer.** Le résultat n'est pas le rapport : l'émission
reste un geste distinct. Ce n'est donc pas une pièce opposable qui partait au
clic, c'est le score qui y sera porté.

**Défaut corrigé au passage : les traces de progression n'avaient pas
d'ordre.** La sauvegarde automatique de la session en cours (700 ms) et son
effacement après correction étaient deux requêtes concurrentes. Quand plus de
700 ms séparaient la dernière réponse de la validation, la sauvegarde partait
pendant la correction et pouvait être traitée **après** l'effacement : la
session en cours ressuscitait, et l'apprenant se voyait proposer de
« reprendre » une évaluation qu'il venait de valider. Le récapitulatif, qui
ajoute précisément cette seconde, a rendu le défaut systématique — la chaîne
de bout en bout l'a fait tomber. Les envois d'une même session sont désormais
mis à la file : ils gardent leur ordre. Le défaut **précède** ce travail ; il
se déclenchait dès qu'un apprenant marquait une pause avant de valider.

## Le dépôt passe en privé avant d'accueillir le contenu des portfolios (22/09/2026)

Huit documents de l'unité ont été fournis le 22/09/2026 : les quatre fiches
d'habilitation (pharmacien/interne, préparateur, aide en pharmacie, agent
d'entretien), la version de travail de la fiche pharmacien, et trois
portfolios (préparateur, pool de remplacement, interne).

**Ce qu'ils portent, au-delà des compétences.** Quatre-vingt-cinq références
de documents qualité internes distinctes, des numéros de poste téléphonique,
deux boîtes aux lettres fonctionnelles du service, les initiales des
intervenants, l'itinéraire d'accès badgé à la zone de production, les
effectifs et les horaires.

**L'état du dépôt à ce moment-là.** `zdmfcdpkn4-png/PharmaTechX` était
**public** depuis sa création le 18/09/2026 : aucun fork, aucune étoile, cinq
références internes réelles déjà poussées. Intégrer les portfolios et pousser
les aurait publiés sur github.com, et l'historique Git les aurait conservés
après suppression.

**Tranché (question 43, choix a).** Le dépôt passe en privé ; le contenu est
ensuite intégré sans contrainte de forme.

Les deux autres voies ont été écartées. Garder le dépôt public en n'y mettant
que les libellés de compétence aurait fait de la rédaction des 56 modules un
exercice de contournement permanent — ces textes citeront des références
internes — et contredit la décision du 19/09 (question 10, choix a : les
textes vivent dans le code). Tout intégrer en restant public revenait à
publier des adresses fonctionnelles et la description des accès d'une zone de
production de cytotoxiques.

**Ce que la bascule ne fait pas.** Elle n'efface pas ce qui a déjà été
public. Avec cinq références, trois jours d'existence et aucun fork,
l'exposition passée est faible — elle n'est pas nulle.

**Le geste appartient au titulaire du dépôt.** Aucun outil de cette session
ne change la visibilité d'un dépôt : GitHub → Settings → General → Danger
Zone → Change repository visibility. `[à vérifier]` la connexion Render
survit-elle au changement sans réautorisation de l'accès GitHub.

## Un vivier unique de critères, porté métier par métier (22/09/2026)

Quatre fiches d'habilitation coexistent dans l'unité — pharmacien/interne,
préparateur, aide en pharmacie, agent d'entretien — chacune avec sa propre
échelle de niveaux. Le site n'en connaissait qu'une, celle du préparateur.

**Tranché (question 44, choix c).** Un vivier unique de critères. Chaque
critère porte les métiers auxquels il s'applique et, **par métier**, son
niveau, son caractère obligatoire et le libellé de sa fiche d'origine. Un
même texte de formation sert les quatre.

**Pourquoi pas quatre référentiels séparés (choix b).** Le recouvrement est
réel : hygiène et habillage, sens de circulation, conduite à tenir en cas
d'incident, fonctionnement général de l'unité, décontamination des plateaux
et des containers figurent sur au moins trois des quatre fiches. Quatre
textes pour la même compétence, ce sont quatre révisions à tenir et quatre
occasions de divergence sur une pièce opposable.

**Pourquoi pas le préparateur seul (choix a).** D'après le portfolio interne
fourni, l'unité compte 4 pharmaciens et des internes, 16 préparateurs
formés, 9 aides de pharmacie et 3 agents d'entretien. Le préparateur est la
moitié de l'effectif ; s'en tenir à lui laissait l'autre moitié sans site.
Le portfolio du pool de remplacement donne des ETP et non des personnes
(7,5 / 1,5 / 1) : les deux comptes ne se mélangent pas.

**Le coût assumé.** Les quatre fiches sont quatre documents qualité
distincts, avec leurs références et leurs lettres de version. Un vivier
commun brouille cette frontière : si une fiche est révisée seule, le vivier
doit porter une version par métier. C'est pris en compte, pas écarté.

**Le libellé reste celui de la fiche.** Une même compétence ne s'écrit pas
pareil d'une fiche à l'autre. C'est le libellé du métier concerné qui est
rendu à l'écran et sur le rapport : autrement, la pièce produite ne
correspondrait plus au document opposable qu'elle prétend servir.

## L'échelle du préparateur corrigée, le bloc 7 ramené à sa source (22/09/2026)

Les quatre fiches d'habilitation officielles, fournies le 22/09/2026, ont
contredit le code sur trois points. Le document transcrit à l'ouverture du
projet — « onze pages A4 paysage, sept blocs thématiques » — était une
**refonte**, pas le document qualité. L'en-tête de `content/habilitation.ts`
ne signalait comme adaptations que le marquage « O » et la correspondance
blocs ↔ niveaux : les codes de niveaux venaient donc vraisemblablement de
cette refonte. Je ne peux pas le vérifier, et je ne prétends pas le savoir.

**Ce qui est corrigé, sans arbitrage — le document officiel fait foi.**

| Ce que portait le code | Ce que dit la fiche |
|---|---|
| Niveaux `P1` / `P2` au préparatoire | **`N1b`**. Les onze critères du bloc 6 y passent. |
| Un « référent préparatoire » (`P2`) | Il n'existe **qu'un** niveau référent, `N3`. |
| `N2` = « `N1c` + bloc 5 en autonomie » | « Habilitation acquise si niveau 1a + 1b + 1c » : les trois branches réunies. |
| `N1c` seule branche sous `N1a` | Deux branches : « Niveau 1 : 1a+1b **ou** 1a+1c ». |
| `N3` = « critères obligatoires des niveaux détenus » | **100 %** des critères de 1a+1b+1c, obligatoires *et* non obligatoires — la fiche le précise. |

**Tranché (question 45, choix b) : le bloc 7 ne porte plus qu'un critère.**

Des six critères d'« Encadrement et référent », un seul a une source : la
participation à la formation d'au moins un préparateur. Les cinq autres —
évaluer et tracer les compétences d'un apprenant, rédiger et réviser des
procédures, animer des groupes de travail, CAPA, veille — ne figurent dans
**aucune** des quatre fiches ; celui des non-conformités faisait de surcroît
doublon avec `B3-09`.

Et une objection de nature, pas seulement de source : une ancienneté ou un
parrainage **ne s'évalue pas par QCM**. Le site couvre les étapes 1 et 2,
théorie et connaissances. Ce que la fiche exige encore du niveau référent —
100 % des critères inférieurs, plus d'une année d'expérience — est une
condition d'éligibilité, et elle est portée par `niveaux[].condition`, lue
par le pharmacien à l'étape 5.

Écartés : garder les six en les marquant « hors fiche » (cinq taches durables
sur une pièce opposable, et cinq emplacements de module qui ne seraient
jamais écrits — « animer un groupe de travail » n'est pas un contenu de
formation) ; supprimer le bloc entier (cela effaçait le seul endroit où le
site nomme l'acte de tutorat).

**Le compte passe de 58 à 53 critères**, 40 obligatoires, 2 rédigés.

**Ce qui n'est pas corrigé, et pourquoi.** Le marquage « O ». La source
existe désormais — les quatre fiches le portent, 44 marques sur le
préparateur — mais les critères d'ici **agrègent** plusieurs lignes du
portfolio : le marquage ne se reporte pas ligne à ligne. `arbitrageEnAttente`
le dit maintenant en ces termes, au lieu de laisser croire qu'aucune source
n'existe.

**Les rattachements orphelins se signalent, ils ne s'effacent pas.**
`niveauxOrphelins()` (`content/referentiel-db.ts`) relit les modules déposés,
les réglages de modules, les documents déposés et les prérequis des niveaux
déposés, et liste ceux qui citent un code inconnu. `/admin/referentiel`
l'affiche en tête. Rien n'est supprimé sur ce constat : effacer en silence un
rattachement que quelqu'un a posé sciemment, sans qu'il l'apprenne, serait
pire que l'orphelin.

## Le site reste aux étapes 1 et 2 ; le portfolio reste papier (22/09/2026)

Les portfolios fournis le 22/09/2026 couvrent les **étapes 3 et 4** de la
chaîne d'habilitation — compagnonnage au poste et évaluation pratique — avec
trois états (Vu / En cours / Acquis), une double colonne « en doublon / en
autonomie », le formateur, la date, et une colonne « Documents supports »
portant 85 références de documents qualité internes.

**Tranché (question 47, choix a).** Le site ne les porte pas. Il reste aux
étapes 1 et 2 — formation théorique, évaluation des connaissances — et
continue de le dire sur chaque rapport. Ce qu'il produit, le rapport
numéroté, scellé et visé, alimente la colonne « Outils / Preuve de
compétence » ajoutée à la fiche pharmacien.

**Ce que cela ferme.** Porter le portfolio dans le site (choix b) aurait été
un module entier : une centaine de lignes, trois états, deux colonnes, par
agent. Cela aurait surtout changé la nature du site — il serait devenu le
dossier d'habilitation lui-même, et non la preuve d'une de ses étapes. La
frontière reste nette, et c'est elle qui rend le rapport lisible : il dit ce
qu'il prouve et ce qu'il ne prouve pas.

**Ce que cela coûte, et il faut le dire.** C'était l'argument contre ce
choix, et il tient : les 85 références n'entrent pas toutes dans le site.
Celles qui documentent un critère couvert par un module gardent leur place —
`/admin/documents` rattache un document à un module ou à un critère, et c'est
exactement l'étape 1. Celles qui ne documentent qu'une ligne de portfolio (un
geste, une mise en situation, une séquence de l'agenda) restent sur le
papier. La part exacte reste `[à préciser]` tant que le rattachement n'est
pas fait.

**Écarté aussi (choix c) :** afficher le portfolio sans l'enregistrer. Cela
donnait un emploi immédiat aux références, mais au prix de deux systèmes à
tenir — le programme à l'écran, la notation sur le papier — qui divergent à
la première révision du portfolio.

## Mention de preuve pour la fiche d'habilitation (22/09/2026)

Depuis la décision 47, la colonne « Outils / Preuve de compétence » de la
fiche est la **seule** interface entre le site et le dossier d'habilitation.
Elle se remplissait à la main, en recopiant depuis l'écran.

**Tranché (question 48, choix b).** Le site compose la mention et la donne à
copier :

    PharmaTechX — RAP-2026-0001 — 22/09/2026 — Comportement en ZAC — 92 % — acquis

Six segments : l'outil, le numéro, la date de passation, le module, le score,
le verdict. Un bouton « Copier la mention » sur la page du rapport et une
colonne dans la liste (`lib/mention.ts`, `components/CopierMention.tsx`).

**Deux règles font la valeur de la mention.**

*Seul un rapport clos en donne une.* Avant la clôture, l'arbitrage du tuteur
peut encore changer le verdict. Une cellule recopiée trop tôt dans un
document Word deviendrait fausse en silence, le Word ne se mettant pas à
jour. Un rapport annulé se refuse sur son propre motif.

*L'empreinte n'y figure pas.* Elle a sa place sur le rapport, pas sur le
renvoi : douze caractères hexadécimaux recopiés à la main sont une source
d'erreur de transcription, et une empreinte mal recopiée ferait passer un
rapport correct pour falsifié. Le chemin de vérification reste : retrouver le
rapport par son numéro, y lire l'empreinte. Un test l'impose — six segments,
aucune suite hexadécimale.

**Sans mise en service prononcée**, la mention est préfixée de « Phase
d'essai — ne vaut pas preuve » : elle ne peut pas dire le contraire du
rapport qu'elle cite.

Écarté : le numéro seul (`RAP-2026-0001` ne dit ni ce qui a été évalué, ni
quand, ni avec quel résultat, à qui n'a pas le site ouvert).

## La correction et la sauvegarde en cours, deuxième passe (22/09/2026)

Le 21/09/2026, la file `fileTraces` a été posée pour ordonner les écritures
de progression. **Elle ne suffisait pas**, et la chaîne de bout en bout l'a
montré : une passe sur quatre échouait encore sur « session en cours effacée
après correction ».

**Ce que la file ne couvrait pas.** Elle ordonne les écritures du client
entre elles. Or l'effacement réel n'est pas fait par le client :
`enregistrerEvaluation` (`lib/progression.ts`) supprime `en_cours` **côté
serveur**, dans la requête de correction, qui passe par une autre route et
n'entre donc pas dans la file. Une sauvegarde `en_cours` encore en attente ou
en vol arrivait après la correction et ressuscitait la ligne : l'apprenant se
voyait proposer de reprendre l'évaluation qu'il venait de valider.

**Corrigé** en annulant le minuteur de sauvegarde et en vidant la file avant
d'envoyer la correction.

**Une fausse piste, consignée parce qu'elle a coûté une passe.** J'ai d'abord
cru à une requête annulée par la navigation et posé `keepalive` sur
l'effacement. `keepalive` fait survivre une requête **déjà émise** au
déchargement de la page ; il ne fait rien pour une requête encore en file, qui
n'est jamais émise. La chaîne a continué d'échouer. L'option est conservée là
où elle sert vraiment — « Recommencer », seul chemin où le client est le seul
à effacer — avec un commentaire qui dit ce qu'elle ne couvre pas.

**Mesuré** : trois passes consécutives de la chaîne complète, 64 étapes
chacune, sans échec.

## Ancienneté des quiz validés, sans échéance prononcée (22/09/2026)

Les quatre fiches d'habilitation demandent une réévaluation tous les deux
ans, et la fiche pharmacien fait de « Validation ou réalisation des **quiz de
formation** » un critère **obligatoire** de son bloc Réhabilitation : c'est
la seule ligne des documents de l'unité qui désigne nommément ce que ce site
produit. Or le site affichait « revalidation 24 mois » sur la page d'un
module, et rien de plus : aucune échéance n'était calculée pour personne.

**Tranché (question 49, choix b).** Le site dit **l'ancienneté**, jamais
l'échéance. `/admin/pilotage#anciennete` liste, pour chaque agent et chaque
module, la date du dernier rapport **clos** et le temps écoulé depuis. Un
cinquième item entre dans la file d'attente du tutorat : « Quiz de plus de
24 mois ».

**Pourquoi pas l'échéance (choix c).** Les deux ans courent depuis
l'habilitation prononcée par le pharmacien — étape 5, hors du site. Une date
calculée à partir du dernier quiz serait un approchant, pas la date
réglementaire. L'afficher sur un outil adossé à un dossier qualité créerait
une assurance fausse, pire que pas de date du tout. La page le dit en toutes
lettres, et un test de bout en bout vérifie qu'aucune échéance n'y figure.

**Seuls les rapports clos comptent** : un rapport émis mais non visé n'est pas
une validation. L'âge se calcule avec `AGE()`, donc en mois de calendrier et
non en tranches de trente jours.

**L'item est ajouté en fin de file**, et c'est délibéré : les quatre
existants gardent leur rang, donc leur place sous la main. Réordonner
détruirait la mémoire spatiale qui fait tout le gain de vitesse (point 40 de
`QUESTIONS-OUVERTES.md`). Le plafond de cinq items est atteint.

## Prompt de génération de questions à partir d'un document (22/09/2026)

Demandé le 22/09/2026 : un prompt à copier, pour faire écrire à un assistant
dix questions QIM ou QCM à partir d'un document joint, sur un modèle fourni
par le pharmacien responsable — trois niveaux de difficulté, un extrait du
document recopié mot pour mot sous chaque proposition, les pièges déclarés.

**Ce qui est posé.** `promptGeneration("QIM" | "QCM")`
(`content/prompt-depot.ts`), copiable depuis l'écran de dépôt
(`components/PromptGeneration.tsx`), à côté du prompt de mise en forme qui
existait déjà. Deux variantes et non une : dans le modèle, chaque répartition
des propositions vraies totalise dix questions, donc un lot est d'un seul
type.

**Adapté au site sur quatre points que le code impose :**

1. **« (plusieurs réponses possibles) » sur tout QCM.** Le site affiche un QCM
   en boutons radio si son énoncé ne contient pas le mot « plusieurs »
   (`estUneSeule`, `components/Evaluation.tsx`). Avec la consigne du modèle,
   huit QCM sur dix auraient été impossibles à réussir, et les deux autres
   auraient révélé qu'ils n'avaient qu'une réponse.
2. **« Réponses : » liste les lettres à cocher**, « Réponses : aucune » le cas
   échéant. Pour un QCM « lesquelles sont fausses ? », ce sont donc les
   fausses.
3. **Ni « (V) » ni « (F) » en fin de proposition**, le corrigé étant sur sa
   ligne.
4. **Ni « Éliminatoire » ni « Réservée à l'évaluation »** : décisions du
   tuteur, pas d'une IA.

Adaptations de forme, réversibles : « sources jointes à cette conversation »
au lieu de « sources sélectionnées » ; exemples d'inversion pris en
pharmacotechnie (surpression/dépression, amont/aval, entrée/sortie,
propre/stérile) au lieu de la physiologie ; « éponyme » retiré ; « mauvaise
structure » devenu « mauvais équipement, local ou poste » ; une ligne
« Source » ajoutée, qui ne recopie que la référence portée par le document.
L'exemple de format n'utilise que des emplacements entre crochets : aucun
contenu pharmaceutique n'y est inventé.

**L'analyseur lit désormais trois lignes de plus.** « Extrait X », « Pièges »
et « Difficulté » sont versés dans la justification, affichée à l'apprenant
après la correction. Sans cela, un extrait placé sous sa proposition était
**collé au texte de la proposition** : l'apprenant aurait lu la phrase du
document qui donne la réponse. L'analyseur signale aussi un extrait sans
proposition, et une proposition sans extrait quand les autres en ont. « Réponses
vraies : aucune » est lu comme « Réponses : aucune ».

**Défaut préexistant corrigé au passage.** Le verdict en fin de proposition
était cherché sans exiger qu'il soit un mot séparé : la dernière lettre d'un
mot finissant par « f » ou « v » était prise pour un verdict. « Le test est
positif » devenait « Le test est positi », marqué Faux ; « curatif », « neuf »,
« actif », « négatif » de même — **sans aucun avertissement**, et quand une
ligne « Réponses » suivait, elle rétablissait le verdict mais pas la lettre
perdue. Le marqueur doit maintenant être un jeton séparé. Reste ambigu, et
lui seul : un « V » ou un « F » isolé qui ferait partie de la phrase
(« le facteur V »), d'où la règle 3 ci-dessus.

`[à vérifier]` : les questions déjà déposées dont une proposition finissait
par « f » ou « v » sans marqueur entre parenthèses ont pu être tronquées. Le
correctif ne les répare pas ; elles se retrouvent dans la banque, où la
règle des quatre yeux les a normalement fait relire.

## Trois niveaux de question, sous-menus de la barre (22/09/2026)

Demandé le 22/09/2026, avec deux autres points traités à part (schéma à caches
corrigé par le tuteur : question 52 ; format à remettre dans l'ordre : voir
plus bas).

**Niveau de question : initial, intermédiaire, avancé** — « pour toutes les
questions, en corrélation avec le prompt ». C'est la réponse à la question 51 :
le niveau devient un **champ** de la question, et non plus une mention dans la
justification.

- Colonne `questions.niveau_question`, contrainte aux trois valeurs ; `NULL`
  vaut « à préciser ». Nommé `niveauQuestion` dans le code, pour ne pas le
  confondre avec les niveaux d'habilitation N1a à N3.
- Éditeur : une liste « Niveau de la question », **sans valeur par défaut** —
  « À préciser » tant que personne n'a tranché.
- Banque : une étiquette par question (« Niveau à préciser » en orange quand il
  manque) et un filtre par niveau.
- Dépôt texte : ligne « Niveau : initial | intermédiaire | avancé », lue dans
  tous les formats (QCM, QIM, schéma, séquence, texte à trous). « Difficulté : »
  et « base » restent lus, pour les réponses produites avec le premier modèle.
  Dépôt JSON : champ `niveau` (ou `niveauQuestion`, ou `difficulte`).
- Les deux prompts emploient le même vocabulaire que le site. Celui de
  génération écrit « Niveau : initial » au lieu de « Difficulté : base » ;
  celui de mise en forme ne transcrit le niveau que si le texte source le
  donne.

Le niveau **ne change pas les tirages**. L'argument de la question 51 tient :
un tirage « Habilitation » qui écarterait les questions « avancé » retirerait
de l'évaluation opposable les questions de raisonnement, sur la foi d'une
étiquette. Le niveau sert à équilibrer la banque.

Les **14 questions des deux modules rédigés** (versionnées avec le code) n'ont
pas de niveau et restent « à préciser » : leur niveau est un jugement
pédagogique qui revient à leur auteur.

**Sous-menus de la barre principale** — « pour dédensifier la longueur de la
barre ». Les trois sous-parties de l'administration (Suivi, Contenu, Réglages)
existaient depuis le 19/09 mais ne se repliaient pas : groupe ouvert, les
seize liens s'affichaient d'un bloc. Elles deviennent des sous-menus
repliables, selon la règle des groupes : ouvert de lui-même s'il porte la page
courante, un choix fait à la main l'emporte ensuite. Replié, un sous-menu
montre la somme de ses comptes en attente — sans quoi « Rapports 3 »
disparaîtrait avec lui. La règle d'ouverture (`lib/rail.ts`) ne laisse pas la
page « Accès » (`/admin`) englober toute l'administration.

**Format « remettre dans l'ordre » : déjà en place.** La séquence à ordonner
existe depuis le 19/09/2026, avec un barème propre (`ordre`), identique à
celui des QIM par défaut et réglable séparément dans `/admin/bareme` : une
étape à sa place rapporte sa part, une étape mal placée la retire. Rien n'a
été reconstruit ; un test fixe désormais ces deux propriétés.

## Schéma à découvrir, jugé par le tuteur (22/09/2026)

Demandé le 22/09/2026 : « question type schéma avec des caches types Anki
posés par le créateur de la question, correction vrai ou faux à faire avec le
tuteur ». **Tranché (question 52, choix b)** : le tuteur, assis à côté de
l'apprenant, juge sur le même écran et confirme par son propre code ; le
résultat est scellé en une fois.

**Ce n'est pas un nouveau format, c'est un troisième mode du schéma.** Le
schéma à compléter avait déjà l'image, les caches posés par le créateur et le
mot sous chaque cache ; il se répondait en écrivant ou en choisissant. Le mode
« découvrir » (`modeReponse = 'decouvrir'`) garde tout cela et retire la
saisie : l'apprenant dit à voix haute ce que cache chaque numéro, lève le
cache — l'image apparaît dessous, le mot s'affiche — et la réponse est jugée
**juste** ou **fausse**, cache par cache. Même éditeur, même barème (`schema`),
même rapport. Le choix du mode se fait dans l'éditeur ; le dépôt texte crée,
comme avant, un schéma « à écrire ».

**Qui juge.**

- En **évaluation**, le tuteur. Il coche « Juste » ou « Faux » sous chaque
  cache levé, puis tape son code au récapitulatif qui précède la validation.
  Le serveur accepte n'importe quel code actif de **tutorat ou
  d'administration**, sauf celui qui a ouvert la session : il jugerait sa
  propre évaluation. Un code de poste ne juge pas. Les codes refusés passent
  par le limiteur de la connexion — sans quoi ce champ servirait à deviner
  les codes de tutorat sans limite. Le code est vérifié, jamais conservé,
  effacé de la page après chaque tentative ; refusé, il se retape sans que les
  réponses ni les jugements soient perdus.
- En **entraînement**, l'apprenant lui-même, à la manière d'Anki : « Je
  savais » / « Je ne savais pas ». Aucun code.

**Ce que le résultat scelle** : le jugement de chaque cache (juste, faux, non
jugé), et **qui a jugé** — « Tutorat · libellé du code », ou
« auto-évaluation » en entraînement. Le rapport imprimé, l'écran du rapport et
le résultat affiché portent la mention ; l'acte est journalisé
(`evaluation:jugement-tuteur`, nombre de caches et de questions).

**Un cache non jugé compte comme une légende vide** : la part « sans réponse »
du barème du schéma (0 par défaut). Conséquence voulue : se passer du tuteur
ne rapporte rien, mais ne bloque pas l'apprenant. S'il n'y a aucun cache
jugé, rien n'est à confirmer, et aucun code n'est demandé.

**Le mot part avec la question.** C'est la seule exception à la règle « les
réponses ne quittent pas le serveur avant la correction » : le cache doit se
lever sans aller-retour. Ce n'est pas un secret de plus livré au navigateur —
l'image servie porte déjà, sous chaque cache, le mot d'origine. Ce qui garde
l'épreuve, c'est la présence du tuteur.

**Un résultat d'entraînement ne s'émet plus en rapport** (règle ajoutée).
Elle valait dans les faits — l'entraînement corrige une question à la fois —
mais le serveur ne l'imposait pas : une requête forgée en mode entraînement
produisait un résultat scellé, et donc émissible, sans les questions
réservées. L'auto-évaluation l'aurait aggravé : un apprenant se serait jugé
lui-même, puis aurait porté ce jugement au rapport. Le mode est désormais
scellé dans chaque résultat, et l'émission refuse `entrainement`. Un résultat
scellé avant le 22/09/2026 n'a pas de mode : il reste émissible, comme avant.

**Limites, dites telles quelles.**

- Le code prouve qu'il a été tapé, pas que le tuteur a regardé chaque
  réponse. C'était l'argument contre le choix b ; il reste vrai.
- En évaluation, ce schéma ne se passe plus sans tuteur présent — sinon ses
  caches comptent sans réponse.
- Sans base (mode ouvert), aucun code n'est vérifiable : un cache jugé ne peut
  l'être qu'en entraînement, et le serveur le dit.

**Corrigé au passage, trois défauts préexistants** :

- « Nouveau tirage » et « Retravailler les questions ratées » ne remettaient
  pas à zéro les rangs des séquences ni les vignettes des textes à trous : une
  question retirée au tirage suivant revenait pré-remplie.
- Le rapport imprimé classait une séquence ou un texte à trous en « QCM
  multiple ».
- Le panneau de récapitulatif reprenait le focus à chaque rendu de la page ;
  sans conséquence tant que rien ne s'y tapait, bloquant pour le champ du code.

Et une attente fragile du parcours de bout en bout (suppression d'un code
refusée, étape 14c) : elle attendait une alerte déjà présente à l'écran, et
ouvrait parfois le journal avant que le refus y soit écrit. Elle attend
désormais la réponse de l'action.

## Programme à la carte : le parcours dégradé (22/09/2026)

**Tranché (question 50).** Réponse du pharmacien responsable : « pour un profil
dégradé, pouvoir faire un programme de modules à la carte validé par le tuteur
ou l'admin », puis « b » : le construire, comme décidé le 18/09/2026
(question 36, choix b — un parcours nommé, composé à la main, marqué
« dégradé » partout). Ma recommandation était de l'abandonner, la fiche
officielle portant déjà « Niveau 1 : 1a+1b ou 1a+1c » ; elle n'a pas été
retenue, et c'est consigné ici.

**Lecture retenue.** Un programme **nommé**, et non un programme par agent :
c'est ce que disait la décision du 18/09, et un profil, dans ce site, est un
code de poste. Le programme se rattache donc à un **code de poste** — le
« profil dégradé » — ou se choisit à l'accueil. Si « à la carte » voulait dire
un programme par identifiant d'agent, c'est une autre construction : à dire.

**Ce qui est construit.**

- `/admin/programmes` (tutorat et administration) : nom, destinataire, **motif
  de l'écart à la fiche**, et les modules cochés un à un, avec un rang pour
  l'ordre (sans rang : l'ordre de la fiche). Modules du code et modules
  déposés publiés.
- Un programme naît **brouillon**, invisible des postes. Il est **validé** par
  un code de tutorat ou d'administration, nommé sur le programme ; il faut un
  nom, un motif et un module. **Toute modification le renvoie en brouillon** :
  un programme validé ne change pas en silence. **Retiré**, il quitte les
  postes et reste lisible ; il ne se supprime pas.
- Accueil : chaque programme validé s'ajoute aux deux parcours de la fiche,
  étiqueté « dégradé ». Ouvert, il remplace la composition par filière et
  niveau par ses modules, **dans son ordre**, avec un bandeau : composé hors
  de la fiche, validé par qui et quand, « ne conduit pas, à lui seul, à un
  niveau de la fiche ».
- Un code de poste peut **s'ouvrir d'office** sur un programme validé (choix
  à la création du code). Si le programme n'est plus validé, le poste suit la
  fiche et l'écran le dit.
- Page de module et d'évaluation : entré par le programme, on enchaîne dans
  son ordre — « module suivant » est celui du programme, et chaque lien garde
  le programme.
- Rapport téléchargé : la ligne « Parcours » porte « Programme à la carte
  « … » — parcours dégradé, validé par … le … ». Le résultat scellé, lui, ne
  change pas : un critère évalué vaut ce qu'il vaut, quel que soit le chemin
  qui y mène. Le rapport enregistré n'imprime pas de parcours, comme avant.
- Journal : `programme:creation`, `programme:modification`,
  `programme:validation`, `programme:retrait` ; le code de poste créé sur un
  programme le porte dans ses détails.

**Non imposé, à dire si vous le voulez** : les quatre yeux. Le code qui
compose peut valider lui-même — « validé par le tuteur ou l'admin » ne
demandait pas deux codes. C'est une ligne à ajouter.

## Réinitialiser un code perdu ou corrompu (22/09/2026)

Demandé le 22/09/2026 : « la possibilité de réinitialiser les codes des
utilisateurs pour l'admin si perdu ou corrompu ».

Les codes sont hachés : perdu, un code ne se retrouve pas. Jusqu'ici, on en
créait un autre et on supprimait l'ancien — ce qui changeait de profil :
signature déposée du pharmacien, identité du code pour les quatre yeux,
programme à la carte d'un code de poste, tout était perdu avec lui.

**Construit** : « Réinitialiser… » sur chaque code, écran Accès,
**administration seule**. Même profil, nouvelle empreinte : l'ancien code
cesse de valoir à l'instant, les sessions ouvertes avec lui se ferment à la
requête suivante (comme une révocation), et le nouveau code s'affiche **une
fois**. L'état actif ou révoqué ne change pas.

**Deux barrières reprises de la suppression** :

- l'administrateur **retape son propre code** : l'acte ne part pas au clic,
  et les codes refusés comptent au limiteur de connexion ;
- **son propre code ne se réinitialise pas d'ici** : la session se fermerait
  avant d'afficher le nouveau code, et la porte avec elle. On passe par une
  session ouverte avec un autre code d'administration.

Journal : `reinitialisation-code`, ou `reinitialisation-code-refusee` avec
son motif.

Le **code personnel d'un agent** (rattachement de la progression, 4 à 8
chiffres) se réinitialisait déjà, depuis la fiche de l'agent, en tutorat et en
administration (question 11) : rien n'a changé de ce côté.

## Texte RGPD resserré (22/09/2026)

Demandé le 22/09/2026 : « simplifie tout le texte avec le RGPD pour le rendre
moins visible, synthétise drastiquement ».

**Ce qui a changé.**

- Pied de page : un paragraphe de neuf lignes devient une ligne et un lien
  (« Vos données »).
- Écran de connexion : l'encadré de trois puces devient une ligne ; la phrase
  d'introduction ne répète plus le titre.
- Accueil : la mention « Aucun compte nominatif · rapports enregistrés… » quitte
  le bandeau ; il ne reste que le nombre de critères évaluables.
- Rapport de session et progression : une phrase chacun, et un lien discret
  « Vos données » **là où l'identifiant se saisit** (émission, rattachement).
- Volet avant connexion et questions fréquentes : deux lignes au lieu de six.
- `/donnees-personnelles` : de cinq sections à une liste de six lignes.

**Ce qui n'a pas été retiré**, et pourquoi. La page d'information garde
chacun des éléments que l'article 13 du règlement (UE) 2016/679 impose de
fournir : responsable du traitement, contact du DPO, finalité, base légale,
destinataires, durée de conservation, droits, droit de réclamation auprès de
la CNIL — resserrés, pas supprimés, et toujours `[à compléter]` là où le DPO
n'a rien fourni. Le lien reste aux deux endroits où l'identifiant se saisit :
c'est l'information « en couches » que recommandent les lignes directrices
sur la transparence du groupe de l'article 29 (WP260 rév. 01, 11/04/2018,
reprises par le CEPD) — une première couche courte, la seconde à un clic.
Ces lignes directrices attendent de la première couche la finalité, le
responsable et l'existence des droits ; la ligne actuelle en dit moins : à
valider avec le DPO, comme la fiche de registre.

Corrigé au passage : la réponse « Les entraînements ne sont jamais
enregistrés » était fausse pour un agent rattaché (la fin d'un entraînement
est notée) ; la nouvelle réponse ne l'affirme plus.

## Barres de progression : badges du parcours, pastilles du test (22/09/2026)

Demandé le 22/09/2026 : « une signalétique de barre de progression dans le
parcours et dans le test », puis « pour la barre de progression du parcours,
utiliser les badges des modules validés ou grisés ».

**Parcours (accueil).** La barre fine — « n % des évaluations disponibles
passées » — est remplacée par une rangée de badges : un par module du
programme affiché (socle et filière choisie, ou programme à la carte), dans
son ordre, **en couleur quand le critère est acquis, grisé sinon**. Chaque
badge d'un module évaluable mène à ce module ; au-dessus, « x / N critères
acquis — M évaluables aujourd'hui ».

- « Acquis » : le verdict brut de la dernière évaluation du module dans la
  mémoire de session — l'onglet, ou l'historique d'un agent rattaché. Un
  verdict indéterminé en attente d'arbitrage reste grisé, et un arbitrage
  « acquis » porté au visa n'y paraît pas : le poste ne le connaît pas.
- Ce n'est pas un avancement d'habilitation, et la barre le dit.
- **Écart assumé à une règle du 19/09** : les illustrations ne se lisent pas
  sous ~72 px et ne devaient jamais servir de pastille (`content/badges.ts`).
  À 40 px, elles servent ici de repère de couleur ; le titre du module est
  dans l'infobulle et dans le nom lu par les lecteurs d'écran.

**Test.** Une pastille numérotée par question dans la barre de passation,
**grisée, puis en couleur une fois la question renseignée** — corrigée, en
entraînement, où la question en cours est cerclée. Au-delà de vingt
questions, les pastilles perdent leur numéro et rétrécissent, pour que la
barre garde sa hauteur sur une tablette. Les lecteurs d'écran lisent la
barre de progression et le décompte, pas les pastilles. C'est la consigne du
parcours étendue au test, que la demande ne précisait pas : à dire si vous
voulez autre chose.

## Tout le RGPD dans son onglet (22/09/2026)

Demandé le 22/09/2026 : « circonscrire tout le RGPD dans un onglet
spécifique ».

**L'onglet.** Une entrée « RGPD — Vos données et vos droits » ferme le volet,
après l'administration : un intitulé de groupe qui est un lien, sans repli.
Elle quitte le groupe « Repères ». Même entrée dans l'accès rapide (tablette,
téléphone, ⌘K) et, avant connexion, dans le volet d'accueil. La page
`/donnees-personnelles` est cet onglet ; son fil d'Ariane dit « RGPD ».

**Ce qui a quitté les autres écrans**, et où c'est repris :

- pied de page : la ligne « Aucun nom enregistré… » et son lien ;
- écran de connexion : la ligne « Aucun nom n'est enregistré » et son lien ;
- rapport de session et progression : les liens « Vos données », et la
  précision « le nom saisi ne quitte pas ce poste » (mode sans conservation),
  reprise dans l'onglet ;
- questions fréquentes (Repères) : « Mes résultats sont-ils enregistrés ? » et
  « Le site sait-il qui je suis ? » — leurs réponses sont les lignes
  « Enregistré » et l'introduction de l'onglet ;
- visite guidée : « il ne désigne personne et rien… ne portera votre nom »,
  « sans nom », « aucun nom n'entre en base », « jamais par nom » ;
- administration : « aucun nom en base » (Rapports), « rien de nominatif »
  (Signalements), « ni nom, ni fonction, ni champ libre » (Personnel), « sans
  nom » (état de la conservation, Accès).

**Ce qui reste hors de l'onglet**, parce que ce n'est pas de l'information des
agents : les libellés fonctionnels « rapport A4 sans nom » et « paquet
d'archivage sans nom » (ce qu'on ouvre), et, seulement quand la conservation
est coupée, le renvoi de l'administrateur à `docs/RGPD.md` avant de
l'activer (Rapports, Pilotage) — une précaution de mise en service, pas un
texte pour l'agent. À retirer aussi si vous le voulez.

**Réserve à valider avec le DPO.** La ligne du 22/09 qui restait « là où
l'identifiant se saisit » disparaît : l'information n'est plus au point de
collecte, mais à un geste de chaque écran. Les lignes directrices sur la
transparence (WP260 rév. 01, § 11) demandent que l'information soit
« facilement accessible » — un lien visible depuis chaque page, sous un
intitulé usuel ; l'onglet du volet y répond sur poste, l'accès rapide sur
tablette et téléphone (un geste de plus). L'information au moment de la
collecte (art. 13 § 1) repose alors sur la note de service à la remise de
l'identifiant, `[à compléter]` dans la fiche de registre.

## Audit d'affichage : PC, iPad, iPhone (22/09/2026)

Demandé le 22/09/2026 : « audit de fonctionnement du site et du design pour
optimisation ; regroupement en sous-menus pour réduire la barre latérale si
problème d'affichage ; amélioration des affichages PC, iPad et iPhone ».

**Méthode.** 28 pages (connexion, onglet RGPD, accueil, module, évaluation,
repères, 18 écrans d'administration), trois profils (poste, tuteur, admin),
six tailles : 1920 × 1080, 1366 × 768, iPad 7ᵉ génération en paysage
(1080 × 810) et en portrait (810 × 1080), iPhone 15 (393 × 659 utiles),
iPhone SE (375 × 667). Mesures prises dans la page : défilement horizontal,
cibles tactiles sous 24 et 44 px, champs écrits sous 16 px, hauteur de
l'en-tête, hauteur du volet replié et tout déplié. **Limite** : seul Chromium
est installé ici — l'iPhone et l'iPad sont émulés (taille, densité, tactile),
pas rendus par Safari ; le flou des surfaces de verre, la barre d'adresse
mobile et le clavier virtuel ne se vérifient que sur l'appareil.

**Fonctionnement.** Aucune erreur de console, aucune réponse en erreur, aucune
page en échec sur les 168 chargements ; la chaîne de bout en bout reste verte.

**Défauts relevés, et ce qui a été fait.**

| Défaut mesuré | Où | Correction |
|---|---|---|
| En-tête sur trois lignes : 193–197 px, **29 % de la hauteur** | iPhone | Une ligne : Menu en icône (libellé gardé pour les lecteurs d'écran), titre et monogramme P retirés de l'en-tête, « Quitter » seul ; sous 24 rem (iPhone SE), le mandala cède aussi sa place |
| En-tête sur deux lignes : 137 px | iPad portrait | Une ligne : monogramme P retiré, « Quitter » seul (le profil reste dans le nom accessible du bouton) |
| Liens du volet à 32 px, intitulés à 34 px : 210 + 52 cibles sous 44 px | iPad paysage | Sur écran tactile (`pointer: coarse`), quelle que soit la largeur, cibles de 44 px |
| Champ de seuil des modules écrit à 13,3 px : Safari iOS agrandit la page au focus | iPhone, iPad | Sur écran tactile, champs à 16 px au moins |
| Journal : tableau de 1 553 px, toute la page défile de côté | PC 1366, iPad | Les cellules se coupent n'importe où (JSON sans espace) |
| Repères, programme complet : lignes de critère coupées à droite (+112 px) | iPhone | Les étiquettes passent à la ligne |
| Programme à la carte : formulaire plus large que l'écran (+6 à +24 px) | iPhone | `fieldset` sans largeur minimale imposée |
| Fil d'habilitation sur quatre lignes au-dessus de chaque module | iPhone | Deux lignes : intitulé court et lien, puis les six pastilles |

**Barre latérale.** Mesurée repliée comme le veut la règle du 19/09 (seul le
groupe de la page ouvert), page par page : 564 px au plus pour
l'administration (pages de la banque, « Contenu » ouvert sur ses huit liens),
pour 637 px disponibles sur un écran 1366 × 768 — elle tenait, de peu. Elle ne
déborde que tout déplié à la main (1 192 px). Le plus long bloc ouvert était
« Contenu » : il est coupé en deux sous-menus, **Questions** (banque, dépôt,
écriture, mises en situation) et **Modules** (modules, documents, ordre,
programmes à la carte). L'administration compte désormais quatre
sous-menus : Suivi, Questions, Modules, Réglages ; le volet replié le plus
long passe à 544 px, onglet RGPD compris. Sur écran tactile, les lignes à
44 px le portaient à 692 px sur iPad en paysage, pour 679 disponibles (pages
des Réglages) : « Revoir la présentation » y quitte le volet pour le Menu,
comme sur iPad en portrait et sur téléphone — 658 px après. **Limite** : ces
hauteurs disponibles supposent la fenêtre entière ; les barres du navigateur
et du système en retirent sur un vrai poste ou un vrai iPad `[à vérifier sur
l'appareil]`. Au-delà, le volet défile en lui-même : rien n'est masqué.

**Mesures après corrections** (mêmes 28 pages, mêmes six tailles).

| Écran | En-tête | Pages qui débordent | Cibles < 24 px | Champs < 16 px | Erreurs |
|---|---|---|---|---|---|
| iPhone SE | 197 → 61 px (30 → 9 %) | 2 → 0 | 160 → 17 | 53 → 0 | 0 |
| iPhone 15 | 197 → 61 px (30 → 9 %) | 2 → 0 | 161 → 18 | 53 → 0 | 0 |
| iPad portrait | 137 → 77 px | 1 → 0 | 133 → 18 | 53 → 0 | 0 |
| iPad paysage | 77 px | 1 → 0 | 133 → 18 | 53 → 0 | 0 |
| PC 1366 × 768 | 77 px | 1 → 0 | sans objet | sans objet | 0 |
| PC 1920 × 1080 | 77 px | 0 | sans objet | sans objet | 0 |

Les cibles restées sous 24 px sont des liens isolés de 15 px de haut (fil
d'Ariane, « voir le module ») : exception d'espacement du critère WCAG 2.2
2.5.8. Les captures sont rendues ici en DejaVu Sans : ni Aptos ni Inter ne
sont disponibles dans l'environnement de mesure.

**Accessibilité automatique** (axe-core 4.13, règles WCAG 2.0 à 2.2, niveaux
A et AA ; dix pages clés, PC 1366 et iPhone SE). Trois défauts de contraste,
tous causés par une transparence posée sur du texte, corrigés par la couleur
à intention inchangée :

| Où | Mesuré | Correction |
|---|---|---|
| Accueil, barre de badges : numéros des modules non acquis | 2,15:1 | Numéro gris sur disque blanc cerclé, 6,15:1 |
| Accueil, cartes des modules à rédiger (transparence 0,66, héritée du projet importé) | 2,7 à 3,5:1 | Filet gris et cadre en tirets ; titre, objectif et étiquettes à pleine couleur (5,4:1 au moins) |
| Banque de questions : modules sans question (transparence 0,55) | 2,37 à 2,75:1 | Étiquette et titre en gris, 5,5:1 au moins |

Seuil de conformité AA pour ces textes : 4,5:1 (WCAG 2.2, critère 1.4.3).

**Non corrigé, signalé.** Textes de 11 px (étiquettes en capitales, pied de
page, en-têtes de tableau) : conformes à la charte, lisibles, aucune règle ne
fixe de minimum. Tableau des rapports vide sur téléphone : il défile de côté
sans rien qui prenne le focus, donc sans défilement au clavier (axe,
`scrollable-region-focusable`) — dès qu'une ligne existe, son lien le rend
atteignable. Champ de seuil des modules : 24 px de haut sur écran tactile,
conforme AA, sous les 44 px visés par le site. Vignette du titre d'un module
sur téléphone : 56 px depuis le 19/09, sous les 72 px fixés pour les
illustrations (`content/badges.ts`) — portée à 72 px le 23/09/2026 (choix b,
« Vignette du titre d'un module sur téléphone »).

## Tableau de bord de l'accueil : ce qui a été retenu du prompt de modernisation (22/09/2026)

Demandé le 22/09/2026 : « évalue la faisabilité de ces actions, si
pertinentes les mettre en place ; utilise les badges créés si besoin pour
améliorer les visuels », sur un prompt de modernisation générique (design,
accès aux modules, dynamisme, ergonomie, contraintes techniques).

**Ce qui existait déjà**, et n'a donc pas été refait : tableau de bord à
l'accueil (compteurs, barre de badges, grands modules repliables), accès
rapide avec recherche d'écrans (⌘K) et « Reprendre » dans le menu, compteurs
d'attente non intrusifs, fondu d'entrée de page, mouvement réduit respecté
partout, cibles tactiles, contrastes mesurés, mode zone.

**Ce qui a été mis en place.**

- **« Reprendre ma formation »** en tête de l'accueil, un seul bouton
  illustré du badge du module : l'évaluation laissée en plan (agent
  rattaché), sinon la lecture en cours sur ce poste si son module n'est pas
  acquis, sinon le premier module du programme, dans l'ordre de la fiche,
  qui se lit ou s'évalue et n'est pas acquis. Le programme de référence est
  celui qui s'affiche à l'arrivée (programme à la carte, ou socle et filière
  du code de poste). « Commencer ma formation » tant que rien n'est fait.
- **Modules consultés récemment** : trois au plus, sous le bouton. Trace
  locale au poste (`fp-consultes`), même statut que les repères de lecture :
  jamais transmise, effacée avec les données du navigateur.
- **État de chaque module** sur sa carte — Acquis, Arbitrage en attente, À
  revoir, Non concluant, Lecture en cours, À faire, À rédiger, Lecture seule
  (texte sans questions) — et filet de couleur : vert terminé, jaune en cours. « Acquis » est le verdict brut,
  comme sur la barre de badges.
- **Badges en vignette** de 72 px sur chaque carte et sur « Reprendre », sur
  tous les écrans, téléphone compris : la taille à partir de laquelle les
  illustrations se lisent (`content/badges.ts`). Sans illustration, le numéro
  du critère. Les modules consultés récemment n'ont que leur titre : une
  illustration ne se réduit pas en pastille.
- **Avancement par grand module** : « x / y acquis » et une jauge dans
  l'intitulé de chaque bloc.
- **Recherche et filtres** dans le programme affiché : texte (titre,
  objectif, critère, bloc, niveau ; sans accents ni casse, chaque mot
  exigé), bloc, avancement (en cours, à venir, terminés). Filière et niveau
  restaient dans « Composer le programme ». Les résultats remplacent les
  grands modules le temps de la recherche ; « Effacer la recherche » les
  rend.
- **Retours visuels** : une barre fine en haut de l'écran entre le clic sur
  un lien et l'arrivée de la page ; les boutons d'envoi des quatre
  formulaires les plus fréquents (connexion, génération d'un code, création
  d'un identifiant, rattachement) se désactivent et tournent pendant le
  traitement — un second appui n'envoie rien.
- Le bouton « Comment fonctionne l'habilitation » quitte l'accueil : le lien
  « le dispositif en détail » de l'avertissement, juste en dessous, mène au
  même endroit.

**Ce qui n'a pas été fait, et pourquoi.**

- **Filtre par durée** : deux modules sur cinquante et un portent une durée
  (40 et 35 minutes), les autres `[à préciser]`. Filtrer sur ces données
  reviendrait à en inventer. À fournir, module par module, pour l'ouvrir.
- **Refonte graphique d'ensemble** (typographie, palette) : la charte des
  Hôpitaux de Vendée et la passation de design sont en place ; une refonte
  demande une maquette validée, pas un prompt générique.
- **Animations supplémentaires** : aucune translation ajoutée — un
  déplacement sous le pointeur a déjà fait tomber la chaîne de bout en bout
  quatre fois (`components/PageAnimee.tsx`). Ombres et bordures seulement.
- **Notifications** : pas de notification poussée ; les compteurs d'attente
  et les messages de statut existants suffisent, et rien n'est à notifier
  hors session.
- **`loading.tsx`** (squelettes de page) : il validerait la navigation avant
  que la page soit prête ; la barre de navigation donne le retour sans
  changer le rendu.

## Police Inter servie par le site, plus par Google (23/09/2026, choix b)

**Constat** (audit du 22/09/2026). Chaque page, connexion comprise, chargeait
la police Inter depuis `fonts.googleapis.com` et `fonts.gstatic.com` : le
navigateur de chaque poste transmettait ainsi son adresse IP à Google, alors
que l'onglet RGPD et `docs/RGPD.md` annoncent « aucun tiers ». Une adresse IP
dynamique peut être une donnée à caractère personnel (CJUE, 19/10/2016,
*Breyer*, C-582/14, ECLI:EU:C:2016:779). Décision de référence sur ce cas
précis : LG München I, 20/01/2022, 3 O 17493/20 — l'intérêt légitime ne
couvre pas l'appel à Google puisque la police peut être hébergée localement ;
juridiction allemande de première instance, sans autorité en France.

**Options.** a) retirer Inter (Aptos puis polices du système) ; b) héberger
Inter sur le site ; c) garder Google Fonts et le déclarer comme destinataire.

**Tranché : b.** Aucun tiers, rendu identique partout.

- Fichiers : `public/polices/inter/`, tirés du paquet npm
  `@fontsource-variable/inter` 5.3.0 (police Inter, licence SIL OFL 1.1,
  texte joint en `OFL.txt`) ; axe de graisse seul ; trois sous-ensembles :
  latin (48 Ko), latin étendu (85 Ko), grec (19 Ko — ΔP, β, γ peuvent venir
  d'une question déposée). Empreintes SHA-256 :
  `3100e775…4c62` (latin), `34b9c504…c956` (latin étendu),
  `1be3448e…b6f6` (grec).
- Déclaration : `@font-face` en tête de `app/globals.css`, graisses bornées
  à 400–700 comme le lien d'avant, `font-display: swap`, sans préchargement :
  le navigateur ne télécharge un fichier que si la page emploie un caractère
  de son sous-ensemble, et aucun quand Aptos, en tête de pile, est présente.
- Servis sans session : le middleware laisse passer les `.woff2`, la page de
  connexion a donc sa police.
- Garde-fou : la chaîne de bout en bout relève toute requête hors de
  l'origine du site, dans chacun de ses contextes, et échoue s'il y en a une
  — seule exception, la page « pirate » que le test d'encadrement sert
  lui-même depuis une autre origine.
- Vérifié le 23/09/2026 : fichier latin servi sans session (200,
  `font/woff2`) ; police chargée et rendue sur la connexion et l'accueil
  (PC 1366, iPhone SE émulé), latin étendu et grec non téléchargés ; aucune
  requête hors du site ; audit d'affichage refait en Inter (six tailles) :
  aucune page qui déborde, en-têtes et volet inchangés.
- Mise à jour : remplacer les trois fichiers par ceux d'une version plus
  récente du paquet (`npm pack`), avec leurs empreintes ici.
- Hors périmètre : les maquettes `docs/maquettes/*.dc.html` appellent encore
  Google Fonts ; ce sont des documents de conception, que le site ne sert pas.

**Effet réel** : au déploiement par Render. Pendant l'essai, le site en
ligne suit la branche de travail (question 21, `docs/DEPLOIEMENT.md`) et
prend donc ce changement à la poussée — sauf si la branche déployée a déjà été
mise sur `production` dans le tableau de bord `[à vérifier]`. Contrôle :
`/api/sante` donne le commit en ligne, qui doit être celui de cette version
ou un suivant.

## Illustrations et photos dans les questions, tout type (23/09/2026)

Demandé le 23/09/2026 : « comme pour l'application quiz Flore, vérifie la
possibilité d'intégrer des illustrations ou photos dans les questions (tout
type). Intégrer au format du prompt à copier-coller. »

**Ce que fait le quiz de Flore** (`/home/user/quiz-flore`, lu le
23/09/2026) : une figure par question, de tout type, PNG ou JPEG de 2 Mo au
plus, en base, servie derrière le code ; ajoutée ou remplacée dans
l'éditeur, avec sa description ; préparée sur l'appareil avant l'envoi
(2 000 px de côté, ré-encodée sous 2 Mo) ; affichée entre l'énoncé et les
propositions, agrandie d'un toucher ; figures repérées automatiquement dans
le PDF d'un sujet déposé. Son prompt de génération ne prévoit pas d'image.

**Ce qui existait ici depuis le 19/09** : une illustration par question dans
l'éditeur et au dépôt (ligne « Image : » du prompt de transcription), le
module d'images de Flore (`lib/images.ts`), l'affichage sous l'énoncé, en
question comme en correction.

**Ce qui manquait, et qui est fait.**

1. Les séquences et les textes à trous, venus le 19/09 après les
   illustrations, ne lisaient pas la ligne « Image » : elle se collait à
   l'énoncé. Ils la lisent.
2. Une ligne « Description de l'image : … » pour tout type : ce que montre
   l'image, sans donner la réponse. Elle devient le texte lu à la place de
   l'image — jusqu'ici, au dépôt, c'était le nom du fichier. Le libellé
   entier est exigé : un « Description : » seul continue l'énoncé, comme
   avant.
3. Le prompt de transcription l'annonce pour tout type, avec un exemple sur
   une séquence ; le prompt de génération peut désormais fonder une question
   sur une figure ou une photographie du document : « Image :
   figure-p12-1.png » (page, rang), description, et chaque proposition reste
   tranchée par une phrase des sources. Le tuteur dépose la capture sous ce
   nom. `test/prompt-depot.test.ts` passe ces lignes dans l'analyseur réel.
4. Une photo de téléphone (3 à 5 Mo) était refusée au-delà de 2 Mo. Elle est
   désormais préparée sur l'appareil dès son choix, au dépôt comme dans
   l'éditeur (`components/preparerImage.ts`, sur le modèle de Flore) :
   2 000 px de côté, ré-encodée en JPEG sous 2 Mo ; un PNG qui tient dans les
   limites reste tel quel. Le ré-encodage retire aussi les métadonnées de la
   photo — lieu de la prise de vue, appareil, date. Une image que le
   navigateur ne sait pas décoder part telle quelle et le serveur la refuse,
   comme avant.
5. Mises en garde, au dépôt, dans l'éditeur et sous les deux prompts : aucune
   donnée de patient (étiquette nominative, ordonnance, écran de logiciel),
   aucune personne reconnaissable sans son accord ; l'assistant qui met en
   forme ou génère est un service extérieur.

**Non fait, et pourquoi.**

- Agrandissement d'un toucher (Flore) : l'illustration occupe 34 rem au plus
  et la page se zoome au pincement ; à ajouter si l'usage le demande.
- Figures repérées automatiquement dans un PDF (Flore) : rendu des pages et
  détection des figures, un chantier à part ; ici, le tuteur dépose la
  capture.
- Images dans les propositions : ni Flore ni ce site ne le font.
- Rendu sur le rapport A4 : écarté le 19/09 (le rapport porte les verdicts,
  pas les énoncés).
- Mises en situation : la vignette reste un texte ; chacune de ses questions
  peut porter sa photo.
- Photo HEIC d'iPhone : le sélecteur d'iOS remet un JPEG quand le champ
  n'accepte que PNG et JPEG `[à vérifier sur iPhone]`.

## Menu en accordéon (23/09/2026, choix b)

Constat sur une capture d'iPhone : dans « Aller à », l'intitulé de groupe
(« FORMATION ») était en capitales grises de 11 px, plus petit que les liens
de 14 px qu'il coiffe — le niveau supérieur paraissait le moins important.
Mesures de la liste sur iPhone 15 : 656 px pour un poste (10 liens), 1 584 px
pour l'administration (27 liens, près de six hauteurs d'écran).

Retenu (b) : **accordéon, intitulés accentués**. Chaque groupe devient un
bandeau (fond `--marque-clair`, filet rose, texte `--marque` à 6,9:1) qui se
replie ; ses liens se rangent en retrait sous un filet gris. Seul le groupe de
la page courante s'ouvre de lui-même — la règle de la barre latérale du
19/09, désormais écrite une fois dans `lib/rail.ts` (`groupePorteLaPage`) et
testée, pour que la barre et le Menu ouvrent le même groupe. Un groupe ouvert
ou fermé à la main le reste jusqu'au rechargement. Pendant une recherche, tous
les groupes qui ont un résultat sont ouverts et leurs intitulés ne se replient
plus. L'onglet RGPD reste une entrée directe. Les flèches et Entrée ne
parcourent que les liens affichés ; Entrée sur un intitulé le replie, sur un
lien l'ouvre (auparavant, Entrée partait toujours vers le lien présélectionné,
quel que soit l'élément qui avait le focus). Cible de 44 px au doigt, 52 px en
mode zone. Mesuré sur iPhone 15 après réalisation : pour un poste, la liste
« Aller à » fait 365 px et tient sans défiler (zone de 549 px) ; pour
l'administration, elle passe de 1 584 à 643 px — six bandeaux, le groupe de la
page ouvert.

Corrigés en même temps, annoncés avec la question : sur écran tactile, le
survol restait « collé » après un appui et teintait le lien en bleu foncé
(règle `a:hover` du site, que le bloc `hover: none` ne neutralisait pas pour
`.ar-item`) ; et la présélection prévue pour le clavier surlignait le premier
lien sans qu'aucun clavier ne serve. Elle ne s'affiche plus qu'avec un
pointeur fin, ou dès qu'on tape ou qu'on use des flèches. Dans les deux cas,
un lien semblait être la page en cours sans l'être.

Écartés : (a) hiérarchie accentuée seule, tout déplié — un seul appui pour
tout, mais la liste s'allongeait encore (1 761 px pour l'administration) ;
(c) second niveau (les groupes, puis les liens du groupe touché) — toujours
deux appuis, plus de vue d'ensemble, et la solution la plus lourde (retour,
focus, recherche).

## Utilisateur test (23/09/2026, choix a)

Demande : que l'administrateur et le tuteur puissent tester le parcours
jusqu'au rapport « au travers de la création d'un utilisateur test qui ne
laisse pas de trace dans la base ».

Retenu (a) : **jusqu'au rapport émis, aucune écriture**. L'utilisateur test
n'est pas créé en base — ni code d'accès, ni identifiant d'agent : il n'existe
que dans la session. « Démarrer un test », sur la page Accès de
l'administration (tutorat et administration), remplace la session par une vue
d'apprenant — rôle de poste, libellé « Utilisateur test », sans filière ni
niveau — et garde l'identité du testeur dans le cookie signé (`lib/essai.ts`,
`remplacerSession` dans `lib/auth.ts`). L'ouverture et l'échéance de la
session ne changent pas : la révocation du code du testeur ferme toujours la
session, et entrer en test ne prolonge rien. « Terminer le test » rétablit
l'identité et ramène à l'administration ; « Quitter » ferme la session comme
d'ordinaire, et c'est le testeur qui est journalisé.

Neutralisé là où l'écriture se fait :
- **rattachement** : `rattachement()` ne rend rien pendant un test. Un
  rattachement laissé sur le poste par un apprenant survit à la déconnexion ;
  sans cette règle, le test écrirait dans sa progression (lecture,
  entraînement, évaluation en cours, évaluation corrigée). Le formulaire de
  rattachement n'est pas proposé, et ses deux actions refusent ;
- **émission** : mêmes contrôles qu'en vrai (sceau, module, entraînement
  refusé, tirage non concluant), puis retour sans écriture — ni rapport, ni
  visa, ni journal. Le numéro `ESSAI-AAAAMMJJ-HHMMSS` (heure de Paris) ne
  consomme aucun numéro RAP : une séquence PostgreSQL ne rend jamais un numéro
  pris ;
- **signalement** : non transmis, et l'écran le dit — un signalement ouvert
  bloquerait les visas de tous les rapports réels dont le tirage contient la
  question ;
- **jugement d'un schéma à découvrir** : le code d'un autre tuteur reste exigé
  et vérifié, limiteur compris, pour que le test montre le vrai
  comportement ; seule l'entrée au journal est omise.

Le rapport de test porte sur chaque page imprimée le filigrane « ESSAI — sans
valeur de preuve », un bandeau « Mode test », la mention « sans
enregistrement : l'application n'en conserve rien » et, en pied de page, la
même mention à la place de « Document qualité — preuve de l'étape 2 » : il ne
se dit jamais document qualité, y compris après la mise en service, quand le
bandeau de phase d'essai aura disparu.

Pendant le test, un bandeau « Mode test : rien n'est enregistré », avec
« Terminer le test », ouvre l'en-tête de chaque page. Il suit l'en-tête —
masqué au défilement descendant, rétabli au montant, comme le bouton
« Quitter » : c'est l'écart avec le « bandeau permanent » annoncé dans la
question. Un bandeau fixé en bas aurait couvert la barre de passation de
l'évaluation, fixée en bas elle aussi.

Mesuré en haut de page, hauteur de l'en-tête sans puis avec le bandeau :
77 → 130 px sur PC (1 366 px) et sur iPad en portrait, texte sur une ligne ;
61 → 116 px sur iPhone 15, où le texte se réduit à « Mode test : rien n'est
enregistré. » sur deux lignes, bouton à côté ; 61 → 141 px à 320 px de large
(iPhone SE de première génération), où le bouton passe sous le texte — un
quart d'un écran de 568 px, le temps du test. Le bandeau ne crée aucun
débordement horizontal. À 320 px, l'accueil déborde déjà de 6 px sans lui
(grille de cartes) : défaut antérieur, hors de ce changement.

Reste écrit, comme pour toute session, ce qui concerne le testeur et non
l'utilisateur test : sa connexion au journal, la date d'usage de son code, et
le limiteur s'il se trompe de code — garde-fou gardé exprès.

Vérifié de bout en bout (étape 14d bis de `e2e/parcours.e2e.js`) : un
apprenant, AG-002, est rattaché sur le poste, et une écriture de lecture est
acceptée pour lui hors test (témoin). Pendant le test, les écritures de
progression sont refusées, l'administration est fermée, l'évaluation est
corrigée, le signalement retenu, le rapport émis sous ESSAI-… et téléchargé
avec son filigrane. À la fin du test, l'empreinte de toute la base — contenu
de chaque table, ordonné, et état de chaque séquence — est identique à celle
d'avant. Le tutorat démarre et termine un test de la même façon.

Limites :
- le test ne couvre ni le rattachement, ni « Ma progression » et
  « Reprendre », ni l'arbitrage, les visas et la clôture, ni le registre et le
  pilotage. L'écriture elle-même n'est pas exercée par le test ; la chaîne de
  bout en bout l'exerce ;
- l'administration reste fermée pendant le test : le site la réserve au
  tutorat, et y aller mène à la page de connexion, où le bandeau demeure.
  Se reconnecter avec son code termine aussi le test ;
- « aucune trace » vaut pour la base. Le navigateur garde, comme après toute
  visite, ses repères locaux : visite guidée du profil apprenant marquée vue,
  dernière lecture, consultations. Mieux vaut tester depuis son propre poste
  que depuis celui d'un apprenant.

Écartés : (b) rapport visé et clos, sans écriture — une maquette de l'écran de
visa, dont les règles recodées à côté des vraies pourraient s'en écarter sans
que rien le montre ; (c) rapport visé et clos par les vrais écrans, avec un
agent de test effacé à la fin — « aucune trace » non tenu (lignes présentes
pendant le test, puis dans les sauvegardes jusqu'à leur rotation), et une
vingtaine de requêtes (registre, pilotage, personnel, compteurs, exports) à
filtrer, plus toutes celles à venir.

## Erreur d'hydratation #418 : correctif amont reporté (23/09/2026, choix a)

**Constat.** La chaîne de bout en bout relevait par intermittence, en
production, « Minified React error #418 » (échec d'hydratation) sur des pages
chargées — `/admin/modules`, `/admin/questions`, `/admin/programmes/1` — sans
échec fonctionnel : React se rétablit seul en abandonnant l'hydratation et en
reconstruisant toute la page dans le navigateur. Pour l'utilisateur : saut
visuel possible, perte d'une saisie commencée avant la fin de l'hydratation,
travail du navigateur doublé.

**Cause** (établie le 23/09/2026) : un bogue de React, pas du site. Le React
embarqué par Next 15.5.25 (`19.2.0-canary-0bdb9206-20250818`) ne rembobine
pas le curseur d'hydratation quand il rejoue un élément qui a suspendu sur un
morceau de données RSC pas encore arrivé : il compare alors l'élément à son
propre premier enfant et conclut à une divergence. Bogue décrit dans
react/react#37584, corrigé par react/react#35494 (« [Fiber] Correctly handle
replaying when hydrating », fusionné le 13/01/2026). Intermittent parce qu'il
dépend de l'ordre d'arrivée des données : plus probable sur un serveur lent
ou froid et sur les grandes pages.

- Sonde insérée dans React (copie de diagnostic hors dépôt) : chaque capture
  montre un élément comparé à son propre premier enfant ; le HTML reçu est
  toujours bien formé.
- Versions lues dans les paquets npm : Next 15.5.26, dernière 15.x, embarque
  le même React ; Next 16.3.6 embarque `19.3.0-canary-cbb046ab-20260731`,
  corrigé.

**Options.** a) reporter le correctif officiel dans la version actuelle ;
b) passer à Next 16.3.6, version majeure, tout le site à revalider pour un
seul bogue ; c) documenter seulement.

**Tranché : a.**

- `scripts/correctif-react-35494.mjs`, lancé par `postinstall` (`npm
  install`, `npm ci`, donc au build de Render), insère les huit lignes du
  correctif dans la branche « élément hôte » de `replaySuspendedUnitOfWork`,
  dans les quatre fichiers client de
  `node_modules/next/dist/compiled/react-dom/cjs/` (production,
  développement, deux de profilage). Le canal « experimental » de React
  embarqué par Next n'est pas employé — aucune des options `ppr`, `taint`,
  `viewTransition`, `routerBFCache` — et n'est pas touché.
- Garde-fous : version de React exacte, branche trouvée une seule fois, état
  d'hydratation présent ; sinon l'installation échoue avec la marche à
  suivre, et un build Render échoué laisse la version précédente en ligne
  (Render, « How Render handles deploy failures »). Un fichier déjà corrigé
  porte une marque en commentaire et n'est pas retouché.
- Contrôlé : une fois corrigée, la fonction de rejeu de chacun des quatre
  fichiers est identique, octet pour octet, à celle de React 19.3 (Next
  16.3.6), hors la ligne de marque ; le reste de chaque fichier est inchangé.
  Minifiée par `next build`, elle a la même forme que le correctif d'origine,
  que Next compile à partir de `react-dom` 19.3.0 pour ses pages d'erreur par
  défaut (routeur « pages ») : seuls les noms raccourcis diffèrent.
- **Piège constaté** : le cache de webpack tient `node_modules` pour immuable
  tant que la version du paquet ne change pas (`snapshot.managedPaths`, posé
  par Next). Après correction de `node_modules`, un build sur cache chaud a
  rendu le fichier React d'avant, à l'octet près (même empreinte
  `f785427dddbba9fb`) : le correctif était installé mais pas servi. D'où deux
  parades : le script efface `.next/cache/webpack` quand il vient de poser le
  correctif, et `npm run build` se termine par un contrôle du code servi
  (`--build`) — la fonction de rejeu minifiée doit porter le correctif dans
  chaque fichier de `.next/static/chunks` qui la contient, sinon le build
  échoue. Que Render conserve ou non `.next/cache` d'un build à l'autre
  `[à vérifier]`, le code servi est ainsi contrôlé à chaque déploiement ; la
  conduite à tenir en cas d'échec est dans `docs/DEPLOIEMENT.md`.
- `test/correctif-react.test.ts` vérifie que les quatre fichiers installés
  portent le correctif et restent valides, éprouve le script (insertion
  unique, seconde passe sans effet, refus d'une autre version de React ou
  d'une branche absente ou en double) et le contrôle du code servi, sur les
  formes minifiées relevées : sans correctif, report, correctif d'origine.
- **À retirer au passage à Next 16** : le script, ses deux appels dans
  `package.json` (`postinstall`, `build`) et le test. Le script échoue de
  lui-même dès que la version de React change, ce qui oblige à y penser.

**Vérifié le 23/09/2026.**

- Reproduction déterministe sur le build du dépôt. Un mandataire suspend
  800 ms le flux RSC de `/admin/modules` à chacune des 90 positions
  possibles. Sans correctif (build du commit `8c64a59`) : erreur #418 à 5
  positions sur 90 (73, 81, 86, 89, 90). Avec le correctif : aucune. Même
  page, même base, même méthode.
- Parcours de Render rejoué : `npm ci` (correctif posé, cache de webpack
  effacé), puis `npm run build` (contrôle du code servi réussi).
- `npm run verifier` : 239 tests. Deux passes de bout en bout de 77 étapes,
  sans erreur de page ni erreur serveur. Le même jour, avant le correctif,
  deux passes sur cinq avaient relevé une erreur #418. Deux passes propres ne
  prouveraient rien, à elles seules, d'un défaut intermittent : la preuve est
  le balayage.

**Limites.**

- Du code tiers est modifié à l'installation : c'est ce qu'un audit peut
  interroger. La trace est ici, dans l'en-tête du script et, par la marque,
  dans le fichier installé.
- Le correctif voisin pour `<head>` (react/react#37630, élément
  `HostSingleton`) n'est pas repris : il n'était pas fusionné à la
  consultation du 23/09/2026, et le cas — une suspension dans `<head>` — ne
  s'est pas présenté ici.
- `npm ci --ignore-scripts` installerait React sans le correctif : le test le
  signale ; le build Render n'emploie pas cette option.

## Vignette du titre d'un module sur téléphone : 72 px (23/09/2026, choix b)

**Constat** (audit du 22/09/2026). Sous 34rem (544 px), l'illustration à côté
du titre d'un module passait de 96 à 56 px, sous le seuil d'environ 72 px en
dessous duquel une illustration ne se lit plus (`content/badges.ts`).

**Options**, mesurées sur iPhone SE avec le titre long de B1-06 (« Principe
d'une ZAC ; surveillance des températures… ») : a) la masquer — titre de
296 px de large, 6 lignes ; b) 72 px — 212 px, 11 lignes ; c) garder 56 px —
228 px, 9 lignes, dessin illisible.

**Tranché : b.** `.titre-vignette .badge--illustration` passe à 72 px sous
34rem (`app/globals.css`) : page d'un module (vignette de 96 px au-delà) et
liste des modules déposés (vignette de 72 px, que la règle ne réduit plus).

Mesuré le 23/09/2026 (Chromium, appareils émulés), titre long de B1-06 et
titre moyen du module « Protection de l'opérateur… » :

| Largeur | Vignette | Colonne du titre | Titre long | Titre moyen |
|---|---|---|---|---|
| 320 px | 72 px | 157 px | 13 lignes, un mot dépasse de 35 px | 6 lignes |
| iPhone SE (375 px) | 72 px | 212 px | 11 lignes | 4 lignes |
| iPhone 15 (393 px) | 72 px | 230 px | 9 lignes | 4 lignes |
| 544 px | 72 px | 381 px | 6 lignes | 3 lignes |
| 560 px | 96 px | 369 px | 6 lignes | 3 lignes |

Aucune page ne défile de côté.

**Écrans étroits (23/09/2026, choix a).** Sous 360 px de large — vieux
téléphones, mais aussi écran de PC zoomé à 400 %, 320 px étant la largeur de
référence du critère WCAG 2.2 1.4.10 (*Reflow*) —, la colonne du titre à côté
de la vignette (largeur de l'écran moins 163 px) devenait plus étroite que
certains mots en 28 px : à 320 px, « réfrigérateurs, » (199 px) dépassait du
bloc de 35 px, contre 19 px à 56 px. Le défaut existait, le choix b
l'accentuait. Options : a) vignette au-dessus du titre sous 360 px
seulement ; b) au-dessus sur tous les téléphones (titre long de 11 à 6
lignes sur iPhone SE, mais la vignette ne flanque plus le titre) ; c) laisser
tel quel. Essayés sans les retenir : couper les mots trop longs
(`overflow-wrap`), qui les casse sans trait d'union (« surveillanc / e ») ;
la césure automatique (`hyphens: auto`), inopérante dans le Chromium de
test, faute de dictionnaire — sur iOS et Android `[à vérifier]`.

**Tranché : a.** Sous 22.49rem (moins de 360 px), `.titre-vignette` passe en
colonne (`app/globals.css`). Mesuré le 23/09/2026, titre long de B1-06 :

| Largeur | Disposition | Colonne du titre | Titre long | Titre moyen |
|---|---|---|---|---|
| 320 px | vignette au-dessus | 241 px | 9 lignes | 4 lignes |
| 344 px | vignette au-dessus | 265 px | 8 lignes | 3 lignes |
| 359 px | vignette au-dessus | 280 px | 6 lignes | 3 lignes |
| 360 px | vignette à côté | 197 px | 12 lignes | 4 lignes |
| iPhone SE (375 px) | vignette à côté | 212 px | 11 lignes | 4 lignes |

Plus aucun mot ne sort du bloc, à aucune de ces largeurs, et aucune page ne
défile de côté ; vignette à 72 px partout.

## Écrans reliés au référentiel déposé (23/09/2026)

**Demande.** « L'ajout de niveau doit corriger les écrans reliés. Vérifier
les correspondances entre les différents menus et fenêtres. » Point de
départ : N2RESTREINT, niveau déposé au Référentiel, manquait aux
« Conditions d'obtention des niveaux ».

**Contrôle** (base d'essai locale, 23/09/2026). Un niveau `ZT1` et une
filière « Filière témoin » déposés au Référentiel, puis chaque écran qui
liste niveaux ou filières ouvert, et chaque lien du menu suivi.

| Écran | Avant | Après |
|---|---|---|
| Référentiel : liste des niveaux, prérequis | présents | inchangé |
| Accueil, « Composer le programme » : filière, niveau visé | présents | inchangé |
| Accès, « Créer un code » : filière, niveau | présents | inchangé |
| Modules : dépôt d'un module | présents | inchangé |
| Documents : profil | présents | inchangé |
| Pilotage : filtres | présents | inchangé |
| Modules : réglage d'un module de la fiche | **proposés, puis écartés en silence** : validés contre la fiche seule, à l'enregistrement comme à la relecture | gardés |
| Repères : « Conditions d'obtention des niveaux » | **fiche seule** | référentiel servi ; « Ajouté par l'unité » ou « Modifié par l'unité » quand le libellé ou la condition ne sont plus ceux de la fiche |
| Banque : arborescence | N1a donné **« niveau absent du référentiel »** sous Chimiothérapie — B5-09, critère de chimiothérapie de niveau N1a : chaque filière ne recevait que ses propres niveaux | plus de faux « absent » |

Les identifiants reconnus d'un rattachement sont désormais ceux de la fiche
et de tous les dépôts, actifs ou non (`identifiantsConnus`,
`content/referentiel-db.ts`) : un dépôt désactivé quitte les listes, pas les
rattachements déjà posés, comme pour `niveauxOrphelins`. Le formulaire de
réglage affiche les filières par leur libellé, comme les autres écrans, et
non plus par leur identifiant (`chimiotherapie`). L'arborescence de la banque
ne montre que les filières et les niveaux qui portent des modules : c'est
voulu, elle mesure la couverture.

**Menu.** Les 27 liens — barre latérale et accès rapide, qui reçoivent la
même définition (`app/layout.tsx`) — mènent tous à une page existante, et
chaque ancre existe. Trois libellés courts diffèrent du titre de leur page,
sans ambiguïté : « Accès » → « Administration », « Ordre » →
« Ordonnancement des modules », « Écrire une question » → « Nouvelle
question ». Laissés tels quels.

**Ce qui reste, et n'est pas un défaut de report.**
- Les trois autres métiers — pharmacien/interne, aide en pharmacie, agent
  d'entretien — n'ont ni niveau ni filière dans le site. Leur échelle
  attendait la question 46, les codes qui se répètent d'un métier à l'autre,
  tranchée le même jour (ci-dessous) ; l'axe métier est défini dans
  `content/habilitation.ts`, mais aucun écran ne le lit.
- L'ordre des niveaux ne se règle pas : la fiche d'abord, les dépôts ensuite.
  Réglé le même jour (« Ordre des niveaux et renommage à la main », plus bas).
- Un code de niveau ne se renomme pas (N2RESTREINT → N2R, question posée le
  23/09/2026). Tranché le même jour : à la main, même section.
- « Programme complet », dans les Repères, reste la fiche — critères et
  niveau de la fiche, sans les réglages ni les modules déposés — et le dit.

**Vérifié le 23/09/2026.** `npm run verifier` (239 tests), `npm run build`,
deux passes de bout en bout de 78 étapes, sans erreur de page ni erreur
serveur. L'étape ajoutée — réglage d'un module de la fiche avec le niveau et
la filière déposés, niveau déposé lu et signalé dans les Repères, aucun
niveau du référentiel donné absent dans l'arborescence — reprend les trois
défauts constatés au contrôle ci-dessus.

## Codes de niveaux par métier : préfixe des seuls nouveaux métiers (23/09/2026, question 46, choix a)

**Constat.** Les quatre fiches d'habilitation fournies le 22/09/2026
réemploient les mêmes codes avec un autre sens, alors qu'un code de niveau
est un identifiant unique dans le site : `niveaux_deposes.code` est une clé
primaire, et modules, réglages, documents, codes d'accès et prérequis ne
citent que le code.

| Métier | Niveaux de la fiche |
|---|---|
| Préparateur | N1a général, N1b préparatoire, N1c chimiothérapie, N2 routine, N3 tuteur des nouveaux préparateurs |
| Pharmacien / interne | N1 base, N2 routine, N3 référent ; la version de travail ajoute N1a « CHIMIO 3 seulement », sous-catégorie du N1, et N1b (N1 = N1a + N1b) |
| Aide en pharmacie | N1 routine, N2 référent |
| Agent d'entretien | N1 routine, N2 référent |

N2 vaut « routine » chez le préparateur et le pharmacien, « référent » chez
l'aide et l'agent d'entretien ; N1a et N1b n'ont pas le même sens chez le
préparateur et dans la version de travail de la fiche pharmacien.

**Options.** a) préfixe sur les seuls nouveaux métiers, le préparateur
gardant ses codes ; b) préfixe sur tous, préparateur compris ; c) mêmes
codes dans chaque métier, le métier affiché à côté.

**Tranché : a.** Les niveaux des trois autres métiers portent un préfixe :
`PH-` pharmacien/interne, `AP-` aide en pharmacie, `AE-` agent d'entretien —
`PH-N1`, `AP-N2`… Le préparateur garde `N1a` à `N3`. Rien d'existant n'est
renommé : codes d'accès, modules, réglages, documents, prérequis et rapports
scellés restent valides. Le format tient dans celui des codes : majuscules,
chiffres et tirets, douze caractères au plus (`normaliserCode`).

**Coût assumé.** L'asymétrie — le préparateur, premier transcrit, est le seul
métier sans préfixe — et des codes un peu plus longs à l'écran.

**Écartés.** b) renommait partout les codes déjà cités — codes d'accès,
modules, réglages, documents, prérequis —, et les rapports déjà émis,
scellés, garderaient « N1a » : deux écritures du même niveau selon la date
du rapport. c) était le plus fidèle aux fiches, mais un code ne désignerait
plus un niveau à lui seul : chaque rattachement devrait porter le métier en
plus, la refonte la plus lourde, et une pièce opposable citant « N2 » seul
serait ambiguë.

**Reste à trancher, une question à la fois.** D'où viennent les échelles des
trois métiers — reprises des fiches ou saisies au Référentiel ; quelle
version de la fiche pharmacien fait foi ; les profils de poste (filières) de
chaque métier ; l'axe métier dans les écrans, qui ne le lisent pas encore.

## Échelles des autres métiers : saisies au Référentiel (23/09/2026, question 53, choix b)

**Question** (posée sous le libellé « 47 bis »). D'où viennent les niveaux du
pharmacien/interne, de l'aide en pharmacie et de l'agent d'entretien ? a)
repris des fiches, dans le code, comme ceux du préparateur ; b) saisis au
Référentiel, avec un champ « Métier ».

**Tranché : b**, après un premier choix a retiré le même jour, avant tout
travail. Rien des fiches n'entre dans le dépôt, toujours public (question
43), et l'unité garde la main sur le texte. Coût assumé : sept à neuf niveaux
et leurs conditions à saisir, une saisie tracée au journal seulement, et des
niveaux que les Repères disent « Ajouté par l'unité ». La version de la fiche
pharmacien qui fait foi se tranche à la saisie, par l'unité.

**Ce qui est fait.**
- Le métier est porté par la **filière** (`filieres_deposees.metier_id`,
  préparateur par défaut) ; un niveau prend celui de sa filière. Un seul
  champ, et non deux qui pourraient se contredire. Les quatre filières de la
  fiche restent au préparateur.
- Le code d'un niveau reçoit le préfixe du métier de sa filière s'il ne l'a
  pas : `n1` sous une filière de l'aide devient `AP-N1`. Le préfixe d'un
  autre métier est refusé. « Modifier » ne change pas un niveau de métier :
  sa liste de filières se limite au sien, et garde la sienne même inactive.
- Une filière qui porte des niveaux déposés garde son métier : le changer
  est refusé, leurs codes ayant le préfixe de l'ancien. Désactivée, elle
  laisse à ses niveaux leur métier.
- Référentiel : filières et niveaux rangés par métier ; un métier sans
  filière ou sans niveau le dit ; le champ « Code » rappelle les préfixes.
- Repères, « Conditions d'obtention des niveaux » : un intitulé par métier
  dès qu'un autre que le préparateur a des niveaux, leurs codes ne se
  comparant pas.
- Accueil : l'invite « Choisir une filière… » cite les filières du
  référentiel, et non plus trois noms écrits en dur.

**Défaut corrigé au passage** (constaté le 23/09/2026 sur la base d'essai).
Le Référentiel met les codes en capitales, et ceux de la fiche ont des
minuscules : « Modifier » N1a enregistrait un second niveau, « N1A », N1a
restant inchangé ; un prérequis N1a coché s'enregistrait « N1A », inconnu.
Le code retrouve désormais la casse du code connu (`codeConnu`,
`content/habilitation.ts`). Une base qui aurait déjà reçu de tels
enregistrements les garde : un niveau « N1A » s'y voit au Référentiel, à
supprimer ; un prérequis « N1A » figure dans l'encart des rattachements
orphelins, à recocher.

**Second défaut corrigé au passage** (relevé à la relecture, antérieur à
cette question). Une filière de la fiche désactivée ne sortait des listes
que si un autre dépôt de filière restait actif : seule déposée, elle restait
proposée. Le référentiel lit désormais tous les dépôts de filières en une
fois (`getReferentiel`, `content/referentiel-db.ts`). Contrôlé le 23/09/2026
sur une base neuve : « Parcours Préparatoire » désactivée, seul dépôt, ne
figure plus dans la liste des filières de l'accueil.

**Ce qui n'est pas fait.** Les listes des autres écrans — accueil, accès,
modules, documents, pilotage — restent à plat : les codes préfixés s'y
distinguent. Un agent d'un autre métier ne voit, à son niveau, que les
modules rattachés à ce niveau ; le réglage d'un module de la fiche accepte
désormais les niveaux déposés, mais les critères propres à chaque métier
restent à trancher.

**Vérifié le 23/09/2026.** `npm run verifier` (244 tests), `npm run build`,
deux passes de bout en bout de 79 étapes, sans erreur de page ni erreur
serveur. L'étape ajoutée dépose une filière de l'aide, y ajoute « n1 »
enregistré `AP-N1`, voit refuser `PH-N9`, modifie N1a sans créer « N1A »,
coche le prérequis N1a enregistré N1a sans rattachement orphelin, lit
l'intitulé du métier dans les Repères et la filière dans l'invite de
l'accueil, voit refuser le changement de métier de la filière, la
désactive, modifie AP-N1 sous son code et le retrouve sous l'intitulé de
l'aide dans les Repères, puis rend la base à son état d'avant.

## Signalement des questions : l'existant complété (23/09/2026, question 54, choix a + b)

**Demande.** « Créer un système de signalement comme pour le quiz si non
existant, pour signaler les questions erronées ou nécessitant une révision —
vérifier avant d'agir. » **Vérifié : il existe**, repris du Lecteur QIM · QCM
le 18/09/2026 (tableau en tête de ce journal ; qui peut signaler : question
30). Depuis la correction de chaque question, en entraînement comme en
évaluation, tout code signale — motif fermé, précision libre, rien de
nominatif ; le tutorat clôt ou rejette depuis Administration → Suivi →
Signalements ; un signalement ouvert sur une question tirée bloque l'arbitrage
et les visas des rapports en cours. En mode test, il n'est pas transmis.

**Tranché : a + b** — corriger l'écran du tutorat (a) et rendre le
signalement visible là où la question se révise (b).

**Ce qui est fait.**
- Motif « À mettre à jour (référence ou pratique périmée) » : la révision a
  le sien, à côté de l'erreur. « Ambigu » reste proposé d'abord, « Autre » en
  dernier. Aucune migration : la base ne contraint pas le motif.
- Écran Signalements : statut accentué (Ouvert, Traité, Rejeté, au lieu des
  valeurs brutes de la base) ; module désigné par son critère et son titre ;
  question de la banque versionnée lue dans le code, avec son énoncé et la
  mention qu'elle s'y corrige ; question disparue dite introuvable, et non
  plus « de la banque versionnée ».
- Banque de questions : étiquette « n signalement(s) ouvert(s) » sur la
  question signalée ; sur sa fiche, un encart détaille motif, précision et
  date, rappelle le blocage des rapports en cours et renvoie à l'écran
  Signalements. Une question de la banque versionnée n'a pas de fiche : son
  signalement se lit sur l'écran Signalements seulement.

**Défaut corrigé au passage** (révélé par l'étape de bout en bout ajoutée).
« Rejeter » enregistrait « traité », depuis toujours : la valeur du bouton
cliqué (`statut=rejete`) ne parvenait pas à l'action du formulaire — le
navigateur la connaît au moment de l'envoi, mais les champs transmis sont
`id` et `reponse` seulement ; la cause dans React n'est pas élucidée.
« Rejeter » porte désormais sa propre action (`formAction`,
`actionRejeterSignalement`). Les rejets antérieurs figurent donc « traité »,
au journal aussi (`signalement:traite`) ; seule une réponse saisie à la
clôture peut les distinguer, `[à vérifier]` sur la base réelle. Le seul autre
bouton qui transmet sa valeur, « Rétablir la fiche » du réglage des modules,
a été contrôlé : sa valeur part bien (`mode=defaut`).

**Vérifié le 23/09/2026.** `npm run verifier` (246 tests), `npm run build`,
deux passes de bout en bout de 80 étapes, sans erreur de page ni erreur
serveur. L'étape ajoutée lit le motif de révision proposé à l'apprenant, le
statut « Ouvert » puis « Traité », le module nommé, l'étiquette de la liste et
l'encart de la fiche ; elle dépose ensuite, par l'API, un signalement « À
mettre à jour » sur une question du code, en lit l'énoncé et le rejette.

## Déconnexion après quatre heures sans activité (23/09/2026)

**Demande.** « Prévoit une déconnexion auto de l'utilisateur avec resaisie de
mot de passe au bout de 4 h d'inactivité. » Sans question : le délai est dit,
et le mot de passe est ici le code — code d'accès pour la session, code
personnel pour l'apprenant rattaché.

**Ce qui est fait.**
- Quatre heures sans activité ferment la session de rôle **et** le
  rattachement de l'apprenant : il faut retaper son code d'accès, et
  l'apprenant son identifiant et son code personnel. Fermer la seule session
  laisserait au suivant l'identifiant de l'apprenant, puisque le rattachement
  survit à la déconnexion (section « Utilisateur test »). La limite de douze
  heures demeure.
- Activité : un clic, une touche, la molette, un toucher, l'ouverture d'une
  page. Le navigateur la signale au serveur au plus une fois par minute
  (`components/VeilleInactivite.tsx`, `/api/activite`). Le défilement seul
  n'est pas écouté : le site en produit lui-même.
- Le serveur tient l'activité dans un cookie signé à part, `fp_activite`, lié
  par un identifiant aléatoire (`sid`) à la session et au rattachement qu'il
  entretient (`lib/inactivite.ts`). Il ne réécrit jamais la session ni le
  rattachement : sa réponse, arrivée après celle d'un « quitter » ou d'un
  « Se détacher », les rétablirait. Une activité notée pour un autre jeton ne
  compte pas.
- Contrôle : le filtre d'entrée (`middleware.ts`) refuse une session
  inactive — page renvoyée à `/connexion?erreur=inactivite` avec la page
  demandée, API en 401 motivé — et efface les trois cookies. Pages, actions
  et API le revérifient (`etatSession`, `rattachement`).
- Onglet laissé ouvert : sans geste depuis quatre heures, il demande au
  serveur où en est la session ; fermée, il se remet de lui-même à la
  connexion, avec la page où il était — l'écran d'un poste abandonné ne reste
  pas affiché. Entretenue par un autre onglet, il reste.
- Le code retapé ramène à la page demandée. L'évaluation en cours d'un
  apprenant rattaché est sauvegardée au fil des réponses : elle se reprend
  une fois rattaché de nouveau. Sans rattachement, elle vivait dans la page
  et elle est perdue.
- Mode test : l'activité du testeur n'entretient pas le rattachement laissé
  sur le poste.

**Limites.**
- La fermeture pour inactivité n'est pas journalisée : le filtre d'entrée n'a
  pas la base. La reconnexion, elle, l'est.
- Au déploiement de cette version, les sessions et les rattachements ouverts
  avant elle, sans identifiant d'activité, tombent quatre heures après leur
  ouverture, même utilisés — une fois.
- Un geste que la mise en veille de l'ordinateur empêche d'envoyer, dans la
  minute et demie qui le suit, est signalé au réveil comme une activité
  présente.
- « Quitter » ferme la session sans lever le rattachement : comportement
  antérieur, inchangé ici.

**Vérifié le 23/09/2026.** `npm run verifier` (251 tests), `npm run build`,
deux passes de bout en bout de 81 étapes, sans erreur de page ni erreur
serveur. Quatre heures ne s'attendent pas : l'étape ajoutée signe, avec le
secret du serveur de test, des jetons datés d'avant — session et
rattachement portent leur identifiant et leur activité ; le cookie
d'activité se lie aux deux ; un rattachement inactif tombe seul, la session
restant ouverte ; une session ouverte il y a cinq heures et entretenue vaut ;
une activité notée pour une autre session ne compte pas — renvoi à la
connexion avec le motif et la page demandée, trois cookies effacés, retour à
la page après le code, apprenant à rattacher de nouveau ; refus motivé en
API. Dans un second navigateur, l'horloge avancée de quatre heures : l'onglet
dont la session est entretenue ailleurs reste, celui dont la session est
inactive se remet seul à la connexion.

## Ordonnancement par profil de poste et niveau cible (23/09/2026, question 55, choix a)

**Demande.** « Prévoir un ordonnancement par profil de poste et par niveau
cible. Possibilité de réaliser un ordonnancement à la carte pour un
utilisateur. Après sélection du profil et du type de parcours, choix limité
de modules accessibles pour ordonnancement, soit en glissant de haut en bas,
soit par numérotation chronologique. » Existant : un seul ordre par parcours
(Intégration, Maintien), pour toutes les filières et tous les niveaux, saisi
comme une liste d'identifiants séparés par des virgules ; à l'accueil, les
modules sont regroupés par bloc et l'ordre ne joue qu'à l'intérieur d'un
bloc.

**Tranché : a** — pour un profil qui a son ordre, l'accueil affiche une
chronologie unique numérotée, socle et filière mêlés, comme un programme à
la carte ; les profils sans ordre propre gardent le regroupement par bloc.
Écartés : les blocs conservés, l'ordre ne jouant qu'à l'intérieur de chacun
(b) ; les blocs numérotés, dont les numéros sautent d'un bloc à l'autre (c).
Accepté en contrepartie : plus de défilement sur téléphone pour ces profils
(le regroupement par bloc avait été choisi pour cela, question 37).

**Ce qui est fait.**
- Un ordre par filière, niveau cible et parcours (table `ordres_profil`). Il
  porte sur les seuls modules du profil : socle et filière, au niveau cible,
  exactement ceux que l'accueil montre pour ce choix.
- Écran Ordre (`/admin/ordonnancement`) : parcours, profil de poste, puis
  niveau cible, dont la liste suit la filière choisie ; tutorat et
  administration. Les modules se rangent en glissant la poignée (souris ou
  doigt : le glisser-déposer natif ne marche pas au doigt sur iPad), avec les
  flèches ↑ ↓ ou les touches fléchées, ou en tapant leur numéro
  (`components/ListeOrdonnable.tsx`). Chaque déplacement est annoncé aux
  lecteurs d'écran ; près d'un bord, la page défile sans animation, pour ne
  pas traîner derrière le doigt. « Revenir à l'ordre général » retire l'ordre propre. Les
  profils qui ont leur ordre sont listés, avec qui l'a fixé et quand.
- L'ordre général du parcours se range de la même façon : la saisie
  d'identifiants a disparu. Il vaut pour les profils sans ordre propre et
  sert de point de départ à l'ordre d'un profil.
- Accueil : le profil choisi qui a son ordre voit « Modules du profil »,
  numérotés dans cet ordre ; la barre de badges et « Reprendre » le suivent.
  L'adresse d'un module garde le profil (`?parcours=…&filiere=…&niveau=…`,
  comme `?programme=` pour un programme à la carte) : la page du module et la
  fin de test enchaînent sur le module suivant de la chronologie, et
  « Retour au programme » rouvre le même profil.
- Un ordre ne se périme pas en silence : un module entré depuis dans le
  profil se range après les autres, marqué « nouveau, à ranger » à l'écran ;
  un module qui en est sorti n'y paraît plus.
- Journal : `ordonnancement:profil`, `ordonnancement:profil-retire`.

**Suite.** L'ordre « à la carte pour un utilisateur » : question 56,
section suivante.

**Vérifié le 23/09/2026.** `npm run verifier` (257 tests), `npm run build`,
deux passes de bout en bout de 82 étapes, sans erreur de page ni erreur
serveur. L'étape ajoutée range l'ordre général au numéro, le relit, puis le
rétablit ; choisit Chimiothérapie, dont seuls les niveaux N1c et N2 sont
proposés ; range le profil N1c au numéro, à la flèche et au glisser, l'enregistre
et le relit ; retrouve à l'accueil les modules numérotés dans cet ordre, en
même nombre ; suit le module suivant et revient au profil ; trouve les blocs
pour N2, sans ordre ; retire l'ordre et lit le journal. Le glisser s'y joue
en mouvement réduit : le site défile en douceur, et un défilement encore en
cours après la mesure faisait saisir au robot la ligne voisine.

## Ordre propre à un apprenant (23/09/2026, question 56, choix a)

**Question.** Ce que veut dire « un ordonnancement à la carte pour un
utilisateur » (demande de la question 55).

**Tranché : a** — un ordre propre à un apprenant, attaché à son identifiant
(AG-…), sur les modules de son profil : même contenu, rangé autrement pour
lui ; pas de mention « dégradé ». Écartés : le programme à la carte de la
question 50 ouvert sur un identifiant (b), qui ferait d'un simple changement
d'ordre un parcours dégradé validé et motivé ; un code de poste par personne
(c), qui contredit « un code par profil de poste ».

**Ce qui est fait.**
- Table `ordres_agent` : un ordre par apprenant, filière, niveau cible et
  parcours.
- Écran Ordre : un champ « Apprenant » facultatif, à côté du profil ;
  identifiant inconnu ou clos refusé. La liste part de l'ordre de
  l'apprenant s'il en a un, sinon de celui du profil, sinon de l'ordre
  général. « Revenir à l'ordre du profil » retire l'ordre propre. Les
  apprenants qui ont le leur sont listés.
- Priorité (`ordreApplicable`, `content/ordres.ts`) : l'ordre de l'apprenant
  rattaché passe avant celui du profil, qui passe avant l'ordre général.
  Il ne vaut que rattaché — sur n'importe quel poste — et pas en mode test.
  À l'accueil, « dans votre ordre, fixé par le tutorat » ; le module suivant
  et « Reprendre » le suivent. L'adresse d'un module ne porte pas
  l'identifiant : la page le lit dans le rattachement.
- Personnel : la fiche de l'apprenant montre ses ordres propres ; la purge
  de sa progression les emporte (`purgerProgression`), et le bouton le dit.
- RGPD : l'ordre propre entre dans les données de la progression rattachée
  (`docs/RGPD.md`, page « Vos données »), purgé avec elle. Il peut exister
  sans que l'apprenant se soit jamais rattaché : c'est le tutorat qui le
  fixe.
- Journal : `ordonnancement:apprenant`, `ordonnancement:apprenant-retire`.

**Limite.** Détaché, ou sur un autre profil que celui de son ordre,
l'apprenant retrouve l'ordre du profil : l'ordre propre porte sur un profil,
pas sur la personne en général.

**Vérifié le 23/09/2026.** `npm run verifier` (258 tests), `npm run build`,
deux passes de bout en bout de 83 étapes, sans erreur de page ni erreur
serveur. L'étape ajoutée refuse un identifiant inconnu et un identifiant
clos, fixe l'ordre de AG-002 sur Chimiothérapie · N1c et le relit ;
rattaché, l'apprenant voit « dans votre ordre » et ses modules dans cet
ordre, et le module suivant le suit ; détaché, les blocs reviennent ; la
purge de sa progression emporte l'ordre ; le journal le trace.

## Validation d'une question par son auteur administrateur (23/09/2026)

**Demande.** « Permettre au même admin ou pharmacien de valider les
questions » : la banque refusait à un code d'administration de valider une
question qu'il avait écrite (« à valider par un autre code que admin ·
PHARMACIEN »).

**Lecture retenue.** Le code d'administration vaut pharmacien responsable
(question 9) : c'est lui qui valide désormais aussi ses propres questions.
Le tutorat reste aux quatre yeux : un code de tutorat ne valide toujours pas
ce qu'il a écrit ou modifié en dernier. `[à préciser]` la même exception pour
un code de tutorat détenu par un pharmacien : le site connaît des rôles, pas
des métiers.

**Ce qui est fait.**
- Règle (`content/quatre-yeux.ts`) : `peutValider` admet l'administration
  même quand elle est l'auteur courant ; `validationParAuteur` reconnaît ce
  cas. Testé.
- Trace : colonne `questions.valide_par_auteur`, posée à la validation,
  remise à faux par toute modification (la question repart « à vérifier »).
  Journal : `statut-question:valide-par-auteur` au lieu de
  `statut-question:valide`.
- Banque : « Valider » s'affiche à l'auteur administrateur, avec « vous en
  êtes l'auteur : validation tracée comme telle » ; une question ainsi
  validée porte l'étiquette « Validée par son auteur », et sa ligne comme sa
  fiche « validée par … (son auteur) ».
- Textes d'aide corrigés (éditeur, prompt de dépôt, refus à
  l'enregistrement) : ils disaient qu'un autre code validerait toujours.

**Ce que cela retire.** Pour les questions écrites par l'administration, le
contrôle par un second code disparaît ; reste la trace. Une question validée
ainsi entre dans les tirages, évaluations comprises, sans relecture par un
autre code. La réserve de la question 12 vaut toujours : un code désigne un
profil, pas une personne.

**Vérifié le 23/09/2026.** `npm run verifier` (259 tests), `npm run build`,
deux passes de bout en bout de 83 étapes, sans erreur de page ni erreur
serveur. L'étape de la banque montre à l'administrateur « Valider » et la
mention avant le geste ; il valide sa propre question, qui porte « Validée
par son auteur » et « (son auteur) », le journal
`statut-question:valide-par-auteur` ; la question repart ensuite « à
vérifier ». Le tutorat reste refusé sur la question qu'il a modifiée (étape
inchangée). Une passe antérieure avait échoué sur une étape sans lien : le
clic du tutorat sur « Terminer le test », dans l'en-tête masqué au
défilement ; le test remonte désormais en haut de page avant ce clic, comme
il le faisait déjà pour l'administrateur.

## Dépôt de questions : plusieurs modules, QCM et QIM mêlés (23/09/2026, questions 57 et 58, choix a)

**Demande.** « Ajout détection de module lors du dépôt, possibilité d'avoir
plusieurs modules concernés par le même dépôt (proposition) ; attention,
possibilité de mélange QIM / QCM. »

**Constaté avant le travail**, par un essai de l'analyseur :
- un dépôt se rattachait à un seul module, choisi dans une liste ; une ligne
  « Module : … » du texte était ignorée, sans avertissement ;
- sans mot-clé « QCM n. » ou « QIM n. », toutes les questions prenaient le
  format par défaut ; un intertitre « QCM » ou « QIM » était ignoré, ou
  collé au texte de la dernière proposition quand aucune ligne vide ne le
  précédait ;
- un QCM « lesquelles sont fausses ? » enregistré en QIM gardait pour vraies
  ses lettres à cocher, qui sont les propositions fausses : corrigé lu à
  l'envers, sans avertissement.

**Tranché.**
- Question 57, **a** : la ligne « Module : » d'abord, puis la proposition du
  site d'après les mots, confirmée dans l'aperçu ; « à choisir » sans
  proposition nette ; rien n'entre en base sans module. Écartés : la ligne
  seule, sinon un module par défaut (b) ; la proposition seule (c). Lecture
  retenue, sans objection : une question reste rattachée à un seul module,
  un dépôt en sert plusieurs.
- Question 58, **a** : dans tous les cas, le format de chaque question
  affiché et modifiable dans l'aperçu, et le mot-clé exigé par le prompt de
  mise en forme ; en plus, intertitre reconnu et énoncé lu — format proposé
  d'après la consigne quand ni mot-clé ni intertitre ne le disent,
  contradiction signalée sinon. Écartés : l'intertitre seul (b) ; rien de
  plus (c).

**Ce qui est fait.**
- Analyseur (`lib/import-questions.ts`). Le format d'un QCM ou d'une QIM
  vient, dans l'ordre, du mot-clé, du dernier intertitre (« QCM », « QIM »,
  « Questions à choix multiples »… seul sur sa ligne, numéroté ou non), de
  la consigne de l'énoncé, puis du format par défaut ; l'origine est gardée.
  Une ligne « Module : » vaut pour les questions qui la suivent ; écrite
  dans une question, sans ligne vide avant elle, elle vaut aussi pour cette
  question. Un JSON peut porter `module`. Un intertitre ne se colle plus à
  une proposition.
- Consigne (`lib/import-format.ts`). QIM : « vraies ou fausses »,
  « chaque proposition », « indépendamment », « indiquer la ou les
  propositions exactes » — la consigne des QIM des modules rédigés. QCM :
  « lesquelles », « laquelle », « plusieurs réponses », « cochez »… ; plus
  faiblement, un énoncé qui pose une question. Les 18 énoncés des deux
  modules rédigés sont lus dans leur format (test).
- Alertes recalculées à chaque changement de format dans l'aperçu : QCM à
  rebours enregistré en QIM (« corrigé à l'envers ») ; consigne qui
  contredit le format écrit ; QCM sans proposition vraie ; plusieurs vraies
  sans « plusieurs » dans l'énoncé. **Ajout hors de la lettre du choix a**,
  même danger : un QCM à rebours corrigé par (V) / (F) — le site fait
  cocher les (V), alors qu'un « (F) » posé par un humain dit en général
  « fausse ».
- Module (`lib/import-module.ts`). La ligne se résout par l'identifiant, qui
  décide seul, puis par le code du critère ou le titre exact, puis par un
  début de titre qui ne désigne qu'un module ; un nom inconnu ou porté par
  deux modules laisse « à choisir », raison affichée. La proposition compare
  la question — énoncé, propositions, légendes, justification — au titre,
  à l'objectif et aux questions validées de chaque module (code et base) :
  un mot pèse d'autant plus qu'il est rare parmi les modules, un mot du titre
  compte double. Elle n'est faite que nette : deux mots partagés au moins,
  un poids de 6 au moins, et le double au moins du module suivant. Les
  modules déposés retirés ne sont ni désignés ni proposés.
- Formulaire : la liste « Module » reste, devenue facultative. Choisie, elle
  vaut pour les questions sans ligne « Module : » — c'est le chemin d'avant,
  depuis la page d'un module ; laissée vide, le site propose.
- Aperçu : pour chaque question, un choix de module et, pour un QCM ou une
  QIM, un choix de format, avec ce qui les a décidés (ligne lue, mots
  partagés, hésitation, mot-clé, intertitre, consigne). Répartition par
  module ; « Appliquer aux questions à choisir » pour les questions sans
  module. L'ajout est refusé tant qu'une question retenue n'a pas de module,
  sur la page et par le serveur ; le format ne passe que de QCM à QIM ou
  l'inverse. Après l'ajout, un lien par module servi. Le formulaire de
  l'aperçu s'envoie sans la réinitialisation automatique de React : après
  un refus du serveur, l'écran garde les choix faits.
- Base : `depots_questions.module_id` accepte NULL — le module du dépôt s'il
  n'en sert qu'un ; chaque question porte le sien. Journal
  `import-questions` : la liste des modules servis.
- Prompt de mise en forme (`content/prompt-depot.ts`) : mot-clé exigé
  devant chaque question, « Q n. » quand rien ne dit le format ; ligne
  « Module : » avant chaque groupe, d'après la liste des modules du site
  (code du critère — titre, triée ; identifiant quand un code est porté par
  deux modules) ; exemple à deux modules. Le prompt de génération n'est pas
  modifié : il n'écrit pas de ligne « Module : ».

**Étalonnage de la proposition** (23/09/2026, avec les modules du code
seuls) :
- les 18 questions des deux modules rédigés, chacune retirée de son module
  avant l'essai : 12 bien rattachées, 6 à choisir, aucune erreur ;
- 22 questions d'essai visant chacune un module, qui reprennent des mots de
  son titre : 15 bien rattachées, 7 à choisir, aucune erreur ;
- 15 questions d'essai écrites pour piéger (vocabulaire absent des titres,
  cas ambigus) : 4 bien rattachées, 11 à choisir, aucune erreur. Avant la
  règle des deux mots, l'une d'elles partait à tort : « température »
  envoyait une question de stabilité vers la surveillance des
  températures.
Ces questions d'essai ont été rédigées pour l'étalonnage, pas tirées de
dépôts réels : elles montrent que la règle est prudente, pas ce qu'elle
rendra sur les textes de l'unité.

**Limites.**
- Tant que les modules n'ont qu'un titre, la proposition manque souvent :
  près d'une question d'essai sur deux (24 sur 55) est restée « à choisir ».
  Elle s'améliore à mesure que des questions sont validées.
- La consigne ne reconnaît que les tournures du site et leurs variantes
  proches : « Cochez la bonne réponse » est lu, « Vrai ou faux : » aussi,
  mais une consigne inhabituelle laisse le format par défaut — la colonne
  du format de l'aperçu est à lire.
- Une ligne « Module : » collée à la question suivante, sans ligne vide, est
  lue comme appartenant aussi à la question qui la précède ; le prompt
  demande la ligne vide.
- Une question n'appartient qu'à un module.

**Vérifié le 23/09/2026.** `npm run verifier` (284 tests, 25 de plus),
`npm run build`, deux passes de bout en bout de 84 étapes, sans erreur de
page ni erreur serveur. L'étape ajoutée dépose un texte sans mot-clé qui
sert trois modules : le module de la première question est proposé
(B1-05, mots partagés affichés), un intertitre « QIM » fixe le format de la
suivante, dont le corrigé à l'envers est signalé puis disparaît quand elle
passe en QCM ; une ligne « Module : B6-10 » est lue, une ligne
« Module : Z9-99 » laisse « à choisir » ; l'ajout est bloqué, et refusé par
le serveur quand on force l'envoi, l'écran gardant les choix faits ; après
« Appliquer aux questions à choisir », les quatre questions entrent dans
trois modules, chacune dans le format choisi. Aperçu vu à 1 280 et 360 px
de large, sans défilement horizontal.

## Fiche de synthèse validée, citée et signalable (23/09/2026, questions 59 et 60, choix a)

**Demandes.** « Pouvoir intégrer à la validation du module une fiche de
synthèse que l'on pourrait déposer dans la banque et relier à la validation
du module. » Puis : « idem pour les fiches de synthèse, pouvoir les signaler
si défaut. »

**Constaté avant le travail.**
- Une fiche de synthèse se déposait depuis Administration → Documents et
  s'affichait en fin de test dès son dépôt, sans relecture par un autre code.
- Le rapport d'évaluation ne la citait pas, et la banque n'offrait pas de
  dépôt de fiche.
- Le signalement ne portait que sur les questions.

**Tranché.**
- Question 59, **a** (réponse « À » lue comme a) : « validation du module »
  désigne la validation du contenu par le tutorat. Écartés : la lecture
  attestée par l'apprenant (b), parce qu'une case cochée atteste une
  déclaration, pas une lecture ; les deux (c).
- Question 60, **a** : le même circuit que les questions, sans effet sur les
  rapports. Écartés : le verrou des visas des rapports qui citent la fiche
  (b), disproportionné pour un document qui ne pèse pas sur la note ; le
  retrait de la fiche tant que le signalement est ouvert (c), qui laisserait
  un signalement infondé retirer à tous une fiche validée par deux codes.

**Ce qui est fait.**
- **Base.**
  - `depots.statut` : `a_verifier`, `valide` ou `retire`.
  - Auteur enregistré par son code (`depose_par` = rôle · libellé,
    `depose_par_acces`) ; dernier correcteur (`edite_*`) ; validation
    (`valide_*`, `valide_par_auteur`).
  - Les documents déjà déposés, et ceux des autres natures, sont « valide »
    d'office.
  - `signalements.question_id` accepte NULL ; `depot_id` désigne la fiche.
- **Banque** (`/admin/questions`, `app/admin/questions/fiches.tsx`).
  - Sur un module, une section « Fiches de synthèse » : statut, signalements
    ouverts, « Valider la fiche » aux quatre yeux (l'exception de
    l'administration tracée), « Retirer » ou « Remettre à vérifier »,
    « Déposer une version corrigée », dépôt d'une nouvelle fiche.
  - Sous le filtre « à vérifier », les fiches en attente de tous les modules.
- **Documents.** Une fiche exige un module et entre « à vérifier » ; son
  statut s'affiche, avec un lien vers la banque du module.
- **Apprenant.** Seules les fiches validées sont montrées : fin de test et
  d'entraînement, page du module, documents généraux. En fin d'évaluation, la
  fiche montrée est celle que le résultat scelle.
- **Rapport.**
  - Le résultat scelle les fiches montrées : titre, adresse, validation.
  - Le rapport imprimé et l'écran du rapport les citent : « Fiche de synthèse
    remise en fin de test : … (validée le … par …) ». Pour une fiche déposée
    avant la règle : « validée d'office : déposée le …, avant la règle du
    23/09/2026 ».
  - Un rapport antérieur ne porte aucune mention.
- **Signalement** (`/api/signalement`).
  - Un bouton sous chaque fiche déposée, avec des motifs propres : erreur de
    contenu, à mettre à jour, fichier illisible ou qui ne s'ouvre pas,
    autre ; note libre.
  - Seule une fiche validée du module peut être signalée ; en mode test, rien
    n'est écrit.
  - L'écran Signalements nomme la fiche et renvoie vers la banque ; la banque
    montre ses signalements ouverts.
  - Aucun verrou : les requêtes des verrous ne lisent que `question_id`.
- **File d'attente.**
  - « Questions à vérifier » devient « Questions et fiches à vérifier » ; même
    compteur sur la pastille de la banque.
  - Un signalement de fiche compte parmi les signalements ouverts.
- **Journal** : `depot-fiche`, `statut-fiche:valide`,
  `statut-fiche:valide-par-auteur`, `statut-fiche:retire`,
  `statut-fiche:a_verifier`, `fiche-corrigee`.
- **Version corrigée.** Le nouveau fichier remplace l'adresse de la fiche,
  qui repart « à vérifier ». L'ancien fichier est gardé : un rapport émis
  avant pointe encore sur lui.

**Conséquences et limites.**
- Les fiches déjà déposées restent montrées, « validées d'office » ; leur
  nombre en production est `[à vérifier]`.
- Tout document déposé enregistre désormais son auteur par son code, et plus
  par son rôle seul : la règle des quatre yeux compare des codes.
- Supprimer une fiche reste possible à l'écran Documents. Un rapport qui la
  citait garde la citation, mais son lien ne mène plus au fichier.
- Une fiche fausse reste montrée jusqu'à ce que le tutorat la retire ou la
  corrige : c'est le choix a de la question 60.

**Vérifié le 23/09/2026.** `npm run verifier` (289 tests, 5 de plus),
`npm run build`, deux passes de bout en bout de 85 étapes, sans erreur de
page ni erreur serveur.
- **Étape 12f, reprise.** La fiche déposée par l'administration est
  « à vérifier » et absente de la page du module. Validée par son auteur,
  elle s'affiche en fin de test. Elle s'y signale avec ses motifs propres.
- **Étape 12f bis, nouvelle.**
  - La fiche du tutorat n'offre pas « Valider » à son auteur ; elle attend
    sous le filtre « à vérifier ».
  - L'administration la valide, et le résultat scellé cite les deux fiches
    avec leur validation. Un motif de question est refusé pour une fiche.
  - L'écran Signalements nomme la fiche signalée ; la banque montre
    « 1 signalement ouvert ».
  - La version corrigée repart « à vérifier » et n'est plus citée, puis le
    signalement est clos.
- **Rendu.** Section vue à 1 280 et 360 px de large, sans défilement
  horizontal.

## Tirage selon le niveau cible, questions obligatoires et signalées (23/09/2026, questions 62 et 63, choix a)

**Demandes.** « Piocher dans les questions de la banque un nombre de questions
à définir dans le barème, piochées au hasard, correspondant à la cible du
niveau du profil et du module à valider ; exclure les questions de ce fait
signalées. » Puis, en réponse à la question 62 : « À mais définir un minimum
pour la validité du test avec des questions taggées obligatoires pour la
partie initiale et une part aléatoire pour permettre de répéter le test ;
pour les répétitions le classement par niveau vaut pour équivalence. Ces
tests sont un complément à la formation pratique et à l'évaluation du
tuteur. »

**Constaté avant le travail.**
- Le nombre de questions était déjà au barème : Découverte 5, Habilitation
  10, dix au moins pour conclure. Le tirage se faisait au hasard dans la
  banque du module ; les éliminatoires y étaient toujours posées, les
  réservées tirées en priorité.
- Le niveau de la question ne jouait pas (question 51, 22/09/2026). Une
  question signalée restait tirée.
- L'évaluation ne connaissait le niveau cible que si le profil avait son
  ordre propre (question 55).
- Le serveur ne contrôlait que la règle des réservées ; un tirage qui
  omettait une éliminatoire passait.

**Tranché.**
- Question 62, **a** (réponse « À » lue comme a) : un plafond de niveau de
  question selon le niveau cible, réglé au barème. Cela revient sur la
  question 51. Écartés : une répartition sans plafond (b) ; aucun filtre (c).
- Question 63, **a** (réponse « À ») : des questions obligatoires posées à
  chaque évaluation, et une part aléatoire de même composition par niveau
  d'une passation à l'autre. Écartés :
  - (b), les obligatoires à la première évaluation seulement : il fallait
    connaître l'historique de la personne, ce qui n'est sûr que pour un
    apprenant rattaché ; et la question de remplacement ne vérifie plus le
    point de l'obligatoire ;
  - (c), le plafond seul : deux passations pouvaient différer beaucoup en
    difficulté.

**Ce qui est fait.**
- **Tirage** (`content/tirage.ts`), dans cet ordre.
  1. Écarter les questions au signalement ouvert, celles au-dessus du
     plafond, et les réservées hors des tirages qui peuvent conclure. Une
     question sans niveau (« à préciser ») n'est écartée par aucun plafond.
  2. Imposer les éliminatoires, et les obligatoires en Habilitation et
     Complet.
  3. Remplacer une question toujours posée qu'un signalement écarte par une
     question du même niveau, si la banque admise en offre une.
  4. Répartir : chaque niveau est complété jusqu'à sa part du tirage, les
     réservées d'abord. Les places qu'un niveau ne peut pas remplir vont aux
     questions sans niveau, puis aux autres niveaux admis.
  - Complet : toute la banque admise.
  - Des questions imposées au-delà de la part de leur niveau sont toutes
    posées : le tirage s'allonge plutôt que d'en retirer une.
- **Barème** (`/admin/bareme`, section « Tirage selon le niveau cible »).
  - Un plafond par niveau d'habilitation : questions initiales seulement,
    initiales et intermédiaires, ou tous niveaux.
  - Une répartition par plafond, en parts relatives.
  - Valeurs par défaut :
    - N1a, N1b, N1c : initiales seulement ;
    - N2 : initiales et intermédiaires ;
    - N3, et tout autre niveau : tous niveaux ;
    - répartitions 100 % ; 43 / 57 % ; 30 / 40 / 30 %.
  - Les répartitions par défaut reprennent le « environ 3, 4 et 3 » du prompt
    de génération.
  - Un barème enregistré avant prend ces valeurs.
- **Étiquette « obligatoire »**, sans effet sur la note.
  - Colonne `questions.obligatoire`, case de l'éditeur, étiquette et filtre
    « Obligatoires seulement » dans la banque.
  - Au dépôt : ligne « Obligatoire : oui » en texte, champ `obligatoire` en
    JSON.
  - Le prompt de mise en forme la transcrit si le texte source le dit ; le
    prompt de génération ne l'écrit jamais.
- **Évaluation** (`components/Evaluation.tsx`).
  - Liste « Niveau cible » à l'écran de réglage. Elle est préremplie par le
    profil de la page, sinon par le niveau du code de session.
  - Le profil suit désormais dans l'adresse des modules, même sans ordre
    propre.
  - L'écran annonce :
    - les questions admises et celles au-dessus du plafond ;
    - celles écartées par un signalement ;
    - les obligatoires et leurs remplacements ;
    - la taille exacte de chaque tirage.
  - Une évaluation interrompue garde son niveau cible à la reprise.
  - Le rejeu des ratées écarte une question signalée depuis.
- **Serveur** (`/api/evaluation`).
  - Même règle que le navigateur.
  - Contrôle étendu : aucune question au-dessus du plafond ; toutes les
    éliminatoires et obligatoires admises posées ; réservées en priorité,
    niveau par niveau ; chaque niveau à sa part, ou à ce que la banque admise
    en offre.
  - Un signalement clos depuis moins de sept jours compte encore comme
    signalé au contrôle, pas au tirage : une clôture survenue pendant
    l'épreuve, ou avant une reprise, ne fait pas refuser le tirage.
  - Sans liste de questions, la correction porte sur la banque admise.
- **Résultat scellé et rapport** (`content/cible.ts`).
  - Ils portent :
    - le niveau cible et le plafond ;
    - les questions posées par niveau et les obligatoires ;
    - les questions toujours posées qu'un signalement a écartées, remplacées
      ou non ;
    - la mention « obligatoire » sur chaque question concernée.
  - Un rapport antérieur n'en porte rien.

**Conséquences et limites.**
- **Banques minces sous un plafond.** Avec la répartition du prompt, un
  module de dix questions renseignées n'en offre qu'environ trois au
  niveau 1. Sans questions « à préciser » pour compléter, le tirage
  Habilitation d'un N1 y reste fermé tant que dix questions ne sont pas
  admises ; l'écran de réglage le dit. Le plafond se règle au barème, jusqu'à
  « tous niveaux ».
- **Équivalence approchée.** « Même niveau » n'est pas « même difficulté » :
  le niveau est le jugement de l'auteur de la question, pas une difficulté
  mesurée. Fixer la part de chaque niveau revient à un plan de test, qui fixe
  le poids de chaque domaine d'un test (Raymond et Grande 2019 ; Coderre et
  al. 2009) ; aucune de ces sources ne traite d'un tirage par niveau dans la
  banque d'un établissement.
- **Obligatoires retenues.** Elles reviennent à chaque passation et leur
  correction est montrée : elles se retiennent. Wood (2009) ne trouve pas
  d'avantage aux candidats qui revoient des questions, mais dans un examen
  sans correction détaillée entre deux passations : pas transposable ici.
- **Questions versionnées sans niveau.** Tant que leur niveau n'est pas
  renseigné, la répartition ne compose rien dans ces modules : obligatoires
  et signalements mis à part, leur tirage reste celui d'avant.
- **Reprise refusée.** Le serveur refuse désormais un tirage qui omet une
  éliminatoire. Une évaluation reprise après l'ajout d'une éliminatoire ou
  d'une obligatoire au module est donc refusée (« Recommencez
  l'évaluation ») ; c'est rare.
- **Exemple corrigé.** L'exemple de la question 62 mettait N1b et N1c à des
  paliers différents ; ce sont les deux branches du même niveau 1, et les
  valeurs par défaut les alignent. `[à vérifier]` par le pharmacien
  responsable, au barème.
- **Même mot, deux objets.** L'étiquette « obligatoire » d'une question n'est
  pas le marquage « O » des critères obligatoires de la fiche d'habilitation.

**Références.**
1. Raymond MR, Grande JP. A practical guide to test blueprinting. Med Teach.
   2019;41(8):854-61. doi:10.1080/0142159X.2019.1595556
2. Coderre S, Woloschuk W, McLaughlin K. Twelve tips for blueprinting. Med
   Teach. 2009;31(4):322-4. doi:10.1080/01421590802225770
3. Wood TJ. The effect of reused questions on repeat examinees. Adv Health
   Sci Educ Theory Pract. 2009;14(4):465-73. doi:10.1007/s10459-008-9129-z

**Vérifié le 23/09/2026.** `npm run verifier` (308 tests, 19 de plus),
`npm run build`, deux passes de bout en bout de 86 étapes, sans erreur de
page ni erreur serveur.
- **Tirage** (`test/tirage.test.ts`) : 300 banques et réglages tirés au
  hasard, chaque tirage accepté par le contrôle du serveur ; même
  composition par niveau sur 200 passations ; remplacement d'une obligatoire
  signalée ; tirage faussé refusé.
- **Étape 14a bis, nouvelle.**
  - Une obligatoire de niveau avancé, créée par le tuteur et validée par
    l'administration, a son étiquette et son filtre dans la banque.
  - Le barème montre les plafonds par défaut.
  - À l'évaluation, N3 tire 11 questions et N2 en tire 10, l'avancée étant
    au-dessus du niveau cible. En Habilitation, l'obligatoire est posée et
    étiquetée ; le résultat dit « Niveau cible N3 … Posées : 1 avancée, 9 sans
    niveau ; 1 obligatoire ».
  - Le serveur refuse (400) une obligatoire omise et une question au-dessus
    du niveau cible.
  - Signalée, l'obligatoire n'est plus tirée, et l'écran comme le résultat
    scellé disent qu'elle reste sans remplaçante.
  - Fin de l'étape : le signalement est clos et la question retirée.
- **Rendu.** Réglage de l'évaluation, barème et filtres de la banque vus à
  1 280 et 360 px de large, sans défilement horizontal ; le niveau cible est
  prérempli par le profil de l'adresse. Les libellés des plafonds, tronqués
  dans les listes du barème à trois colonnes, ont été raccourcis.

## Banque en arborescence par profil (23/09/2026, question 64, choix b)

**Demande.** « Dans la présentation de la banque de questions, proposer
l'alternative d'une présentation en arbre dépliable comme le quiz de Flore —
Arborescence. »

**Constaté avant le travail** (base d'essai, 57 modules).
- En tête de la banque, l'arbre « Couverture » du 19/09/2026 rangeait les
  modules par filière, puis par niveau d'habilitation. Il était toujours
  déplié : seul l'étage filière se repliait. Il occupait environ 4 200 px
  sur poste et 8 800 px sur téléphone avant la première question ; la page
  entière faisait 11 855 px sur poste.
- Sous l'arbre, chaque question était une carte de 190 à 300 px de haut.
- Chez Flore, l'arborescence de l'écran « à la carte » suit le contenu :
  UE, matière, chapitre. Chaque rangée a son chevron et son décompte, et une
  bascule passe d'« Arborescence » à « Diagramme ».

**Tranché.** Question 64, **b** (réponse « B ») : une vue « Arborescence »
à côté de la vue « Liste », rangée par profil — filière, niveau
d'habilitation, module, question. Un module rattaché à deux niveaux figure
sous chacun, avec ses questions. Écartés : l'arbre par contenu, bloc de la
fiche puis module puis question (a), que je recommandais ; la seule
couverture rendue dépliable, sans seconde vue (c).

**Ce qui est fait.**
- **Bascule « Liste | Arborescence »** en tête de la banque. La liste reste
  la vue par défaut, inchangée. La vue tient dans l'adresse (`vue=arbre`) :
  un favori la rouvre.
- **Arborescence** (`content/arbre-banque.ts`, pur ;
  `app/admin/questions/arborescence.tsx`).
  - Ordre : tronc commun, puis les filières dans l'ordre du référentiel,
    puis celles qu'un module cite encore sans qu'elles y soient. Dans
    chacune : « Tous niveaux », puis les niveaux du référentiel, puis les
    niveaux absents. Ce sont les rattachements de la couverture de la
    liste : les deux vues ne se contredisent pas.
  - Chaque rangée a son chevron, à gauche, et le décompte de la banque
    entière : modules, validées, à vérifier, réservées, jauge. Un module sans
    question est grisé.
  - Une question repliée montre son format, son statut, ses étiquettes et
    deux lignes d'énoncé. Dépliée, elle montre ses propositions, sa trace et
    les mêmes boutons que dans la liste : l'affichage d'une question est
    désormais partagé par les deux vues (`question-banque.tsx`).
  - Un module qui figure sous plusieurs branches le dit (« figure aussi sous
    Parcours Chimiothérapie › N2 ») ; sur la base d'essai, B5-04 à B5-08,
    sous N1c et sous N2.
  - Chaque module offre « Voir le module » et « Nouvelle question ici ».
- **Repli.**
  - Par défaut, les filières sont ouvertes et le reste replié, comme les UE
    chez Flore.
  - « Tout déplier » ouvre jusqu'aux modules, jamais les questions ; « Tout
    replier » replie tout.
  - Sous un filtre (statut, niveau, obligatoires, module), l'arbre ne garde
    que les branches qui portent des questions retenues, ouvertes jusqu'aux
    modules. Chaque rangée dit combien de questions elle montre ; son
    décompte reste celui de la banque entière.
  - Aucun script : des `<details>`, repliables au clavier.
- **Retour à la branche après un geste.**
  - Valider, remettre à vérifier, retirer, supprimer, et l'enregistrement
    après « Modifier » ou « Nouvelle question ici » rouvrent la branche du
    geste, ancêtres compris (`ouvrir`).
  - La redirection d'une action serveur perd l'ancre de l'adresse, et la
    page restait là où le formulaire l'avait laissée : un petit composant
    (`components/RetourBranche.tsx`) y ramène la page et place le focus sur
    le titre de la branche. Sans script, la branche est rouverte quand même ;
    seul le défilement manque.
- **Adresse de retour contrôlée** (`retourBanque`). Les actions de la banque
  ne redirigent plus que vers la banque. En pratique, les formulaires ne leur
  en envoyaient pas d'autre, mais rien ne le vérifiait. L'erreur « quatre
  yeux » s'insère avant l'ancre, là où le serveur la lit.
- **Corrigé au passage.** Après un geste dans la liste, les filtres
  « Niveau » et « Obligatoires » se perdaient, faute d'être dans l'adresse
  de retour ; ils y sont, comme le module et le statut.

**Mesures** (même base, 57 modules). Hauteur de la page en vue
Arborescence :

| | Par défaut | Tout replié | Tout déplié |
|---|---|---|---|
| Poste, 1 280 px | 1 789 px | 1 390 px | 11 458 px |
| Téléphone, 360 px | 2 940 px | 2 231 px | 19 775 px |

En vue Liste, la page fait 11 855 px sur poste. Aucun défilement horizontal
à 360 px, question dépliée comprise.

**Conséquences et limites.**
- **Doublons voulus.** Une question d'un module rattaché à deux niveaux
  apparaît deux fois ; validée sous une branche, elle l'est sous l'autre. La
  mention « figure aussi sous » le rappelle.
- **Le rattachement, pas le contenu.** L'arbre suit les filières et niveaux
  des modules, pas les blocs de la fiche. Pour retrouver un critère par son
  bloc, restent la recherche de l'accueil et le filtre « Module ».
- **Questions en base seulement.** Comme la liste, l'arbre ne montre pas la
  banque versionnée avec le site.
- **Rien n'est retenu d'une visite à l'autre.** Le repli tient dans
  l'adresse : revenir à la banque par le menu la rouvre en vue Liste.
- **Sans JavaScript**, la branche du geste est rouverte, mais la page n'y
  défile pas.
- **Boutons du haut de la page.** « Nouvelle question » et « Déposer un
  texte ou un fichier » ramènent à la liste après l'enregistrement ; depuis
  l'arbre, « Nouvelle question ici » ramène à la branche du module.

**Vérifié le 23/09/2026.** `npm run verifier` (318 tests, 10 de plus),
`npm run build`, deux passes de bout en bout de 87 étapes, sans erreur de
page ni erreur serveur.
- **Arbre pur** (`test/arbre-banque.test.ts`) : ordre des branches ; la
  filière « socle » n'est jamais une branche ; niveaux et filières absents du
  référentiel visibles ; doublons et « aussi sous » ; chemins encodés ;
  élagage sans toucher l'arbre d'origine ; états de repli ; seule la branche
  du geste est rouverte ; adresse de retour refusée hors de la banque, erreur
  placée avant l'ancre ; ancres injectives.
- **Étape 14a ter, nouvelle.**
  - La liste reste la vue par défaut ; la bascule ouvre l'arborescence, sans
    la couverture.
  - Par défaut, filières ouvertes et niveaux repliés ; « Tout déplier »
    ouvre jusqu'aux modules, pas les questions ; « Tout replier » replie
    tout. Un module rattaché à deux niveaux le dit.
  - Une question déposée par « Nouvelle question ici », puis validée,
    modifiée, retirée et supprimée depuis l'arbre : à chaque geste, la
    branche est rouverte, en vue, avec le focus sur son titre. Le fil
    d'Ariane de l'éditeur ramène à l'arbre.
  - Un filtre garde la vue et ne laisse que les questions retenues, avec leur
    décompte.
  - À 360 px, arbre déplié et question ouverte, aucun défilement horizontal.
- **Relu entre deux passes.** Un geste sur une fiche de synthèse, depuis
  l'arbre, ramenait à la liste, comme le lien « fiches à vérifier » ; corrigé,
  puis la chaîne entière relancée. Ce retour est contrôlé sur la page
  (adresse de retour portant `vue=arbre`), pas par un geste de bout en bout.
- **Rendu.** Captures à 1 280 et 360 px : vue par défaut, tout déplié,
  question ouverte, branche après un geste. La branche du geste s'affiche à
  97 px du haut sur poste et à 81 px sur téléphone, l'en-tête s'étant
  effacé au défilement.

## Accès rapide en tiroir, à toutes les tailles (23/09/2026, question 61, choix a)

**Demande.** « Pour le menu d'accès rapide, revoit le positionnement et le
mode d'ouverture pour qu'il limite la gêne de la lecture de la fenêtre en
dessous. »

**Constaté avant le travail.**
- Sur poste (62 rem et plus), l'accès rapide s'ouvrait en panneau de
  `min(34rem, 92vw)`, centré à 12 vh du haut, sur un voile
  `rgba(16, 24, 32, 0.38)` qui assombrissait toute la page ; le panneau, en
  verre flouté, masquait le milieu de la colonne de lecture.
- Sous 62 rem, c'était déjà un tiroir à gauche de `min(19rem, 86vw)`, sur le
  même voile.

**Tranché.** Question 61, **a** (réponse « question 61 : a ») : un tiroir à
gauche partout ; sur poste, à la place de la barre latérale, sur toute la
hauteur ; la page de lecture découverte, ni assombrie ni floutée ; un clic sur
la page ferme ; Tab et Échap comme avant. Écartés : un panneau déroulant sous
le bouton Menu (b) ; le panneau centré gardé, sans voile ni flou (c).

**Ce qui est fait** (`app/globals.css` ; le balisage et le script de
`components/AccesRapide.tsx` sont inchangés, seuls leurs commentaires suivent).
- **Un seul tiroir.** Les règles du tiroir de téléphone deviennent celles de
  toutes les tailles : pleine hauteur, entrée par la gauche en 260 ms.
- **Sur poste, la place du volet.** Le tiroir part du bord de l'écran et
  s'arrête dans la gouttière, 12 px après le volet et 8 px avant la colonne
  de lecture ; son contenu s'aligne sur la colonne du volet. Sa largeur se
  calcule sur celles du cadre, du volet et de la barre rose : 273 px jusqu'à
  1 377 px de large, davantage au-delà, où il couvre aussi la marge gauche.
  Qu'une de ces largeurs change sans ce calcul, et le parcours e2e échoue.
- **Plus de voile visible, à aucune taille.** Le calque demeure, transparent :
  il reçoit le clic qui ferme, et ce clic ne suit pas le lien qui se trouvait
  dessous. Le bord du tiroir porte seul la séparation d'avec la page : un
  filet gris et une ombre courte, qui ne s'étend pas sur le texte.
- **Sur poste, la page défile sous le tiroir ouvert.** Le défilement du corps
  n'y a jamais été verrouillé ; il le reste sous 62 rem.
- **Inchangés** : tabulation enfermée ; Échap, puis focus rendu au bouton
  Menu ; focus posé sur le champ au pointeur, sur le tiroir au doigt ; zones
  et ordre des items.
- **Ajusté au passage.** Dans une colonne de 228 px, la réserve laissée au
  rappel « ⌘K » tronquait l'invite du champ (« Rechercher un écra ») : elle
  passe de 3,5 à 1,625 rem sur poste, et à 0,75 rem en mode zone, où le
  rappel est masqué. En mode zone, sur poste, l'invite en 18 px perd encore
  ses points de suspension : Chrome garde la place du bouton d'effacement du
  champ, même vide. Le bouton est conservé ; seule l'invite est rognée.
- **Spécification** (`docs/ACCES-RAPIDE.md`) révisée : § 4.1, 4.3, 5.2 et 7,
  critère 10 ajouté au § 8.

**Mesures** (un module ouvert, code d'administration) :

| Écran | Tiroir | Volet | Colonne de lecture | Page, tiroir ouvert |
|---|---|---|---|---|
| Poste 1 920 × 1 080 | 0 → 545 px | 301 → 533 px | dès 553 px | défile |
| Poste 1 280 × 900 | 0 → 273 px | 29 → 261 px | dès 281 px | défile |
| Poste 992 × 800 | 0 → 273 px | 29 → 261 px | dès 281 px | défile |
| iPad paysage 1 080 × 810 | 0 → 273 px | 29 → 261 px | dès 281 px | défile |
| iPad portrait 768 × 1 024 | 0 → 304 px | masqué | recouverte à gauche | figée |
| iPhone 390 × 664 | 0 → 304 px | masqué | recouverte à gauche | figée |

Partout, le calque est transparent et sans flou ; un clic, ou un appui, hors
du tiroir le ferme sans changer d'adresse, et le focus revient au bouton Menu.
Aucun défilement horizontal.

**Conséquences et limites.**
- **Sous 62 rem, le tiroir recouvre toujours la page** : il n'y a pas de
  colonne de volet à prendre. Sa largeur est celle d'avant ; seule la page
  visible à côté n'est plus assombrie — lecture littérale de « partout » et de
  « sans voile ». L'assombrissement se rétablirait en une ligne, sous 62 rem
  seulement, si l'usage le réclame.
- **Le calque est invisible mais présent** : tant que le tiroir est ouvert, un
  clic sur la page ne fait que le fermer.
- **Sur très grand écran**, le tiroir couvre aussi la marge gauche, vide ; le
  contenu reste dans la colonne du volet.
- **Le tiroir recouvre la gauche de l'en-tête**, bouton Menu compris, comme
  sur téléphone : on le ferme par ×, Échap ou un clic sur la page.

**Constaté, hors périmètre, non corrigé.**
- Sur iPad en paysage (pointeur tactile au-delà de 62 rem), les lignes du
  tiroir restent à 32 px, quand celles du volet passent à 44 px depuis le
  22/09 ; le panneau centré avait la même limite. 32 px satisfont le minimum
  AA de 24 px (WCAG 2.2, critère 2.5.8), pas la cible de 44 px retenue pour
  le tactile.
- Le § 4.1 de la spécification annonce, sous `prefers-reduced-motion`,
  « opacité seule, 90 ms » ; la règle générale du site ramène toute
  transition à 0,001 ms : le tiroir apparaît sans transition.

**Vérifié le 23/09/2026.** `npm run verifier` (318 tests), `npm run build`,
deux passes de bout en bout de 88 étapes, sans erreur de page ni erreur
serveur.
- **Critère 10, nouveau** (étape 12h bis, à 1 280 px) : tiroir collé au bord
  gauche sur toute la hauteur ; il recouvre le volet et s'arrête avant la
  colonne de lecture ; calque transparent, sans flou ; un clic sur un lien de
  la page ferme le tiroir, l'adresse ne change pas, le focus revient au
  bouton Menu.
- **À 390 px** (étape 12h) : calque transparent aussi.
- **Critères 5 et 6 inchangés** : Échap ferme et rend le focus au bouton
  Menu ; vingt-cinq tabulations restent dans le tiroir.
- **Mesures et captures** hors parcours, aux six tailles du tableau et à
  360 px : les bords ci-dessus, le défilement de la page tiroir ouvert sur
  poste, la fermeture au clic ou à l'appui. Sans processeur graphique, la
  transition démarre en retard sur grand écran (le flou se peint
  lentement) : les mesures attendent la fin de l'animation, pas un délai
  fixe.

## Contraste au survol des boutons clairs (23/09/2026)

**Constaté** (en marge de la question 64). Au survol, les boutons
secondaires et discrets prenaient le fond bleu foncé de la variante pleine :
sa règle, `.bouton:hover:not(:disabled)`, est plus spécifique (0-3-0) que les
leurs (0-2-0). Contraste mesuré : 1,00:1 sur un lien (« Déposer un texte ou un
fichier »), 1,39:1 sur un bouton (« Filtrer », « Supprimer ») ; le minimum
pour du texte est de 4,5:1 (WCAG 2.1, critère 1.4.3). Le défaut datait de
l'import du 18/09. J'avais écrit qu'il épargnait les écrans tactiles : c'est
faux dès que l'état de survol reste accroché après un appui, comme sur iPad.
En forçant cet état, on retrouve 1,00:1 et 1,39:1.

**Tranché.** La correction proposée, retenue par délégation (« Pour les 3
prends les recommandations »).

**Ce qui est fait** (`app/globals.css`). Les survols des variantes claires,
et leur neutralisation sur écran tactile, prennent `:not(:disabled)` : de même
spécificité que celui de la variante pleine, et écrits après lui, ils
l'emportent. Un bouton clair désactivé ne change plus d'aspect au survol, comme
la variante pleine.

**Mesures après correction** : au survol sur poste, 9,56:1 sur un lien et
6,86:1 sur un bouton ; sur tactile, l'état accroché garde l'aspect de repos,
10,83:1 et 7,78:1.

**Vérifié le 23/09/2026.** `npm run verifier` (318 tests), `npm run build`,
deux passes de bout en bout de 89 étapes, sans erreur de page ni erreur
serveur. Étape nouvelle, dans la banque : au survol, le lien et le bouton
secondaires gardent un texte à 4,5:1 au moins. Mesures hors parcours, survol
forcé par le protocole de Chrome, sur poste et en contexte tactile : liens et
boutons secondaires de la banque, lien discret de la liste des rapports.

## Ordre des niveaux et renommage à la main (23/09/2026, tâche 66, recommandations retenues)

**Demande.** « Revoir pour l'apparence des prérequis replace N2Restreint par
N2R (dépôt) — pouvoir organiser l'ordre des niveaux. » La capture montrait la
liste « Prérequis » du Référentiel, N2RESTREINT après N3.

**Constaté.**
- Un code de niveau est son identifiant. Modules, réglages, documents,
  prérequis, codes d'accès, ordres de profil et d'apprenant, plafonds du
  barème le citent tel quel. Le site ne sait pas le renommer, et la base en
  ligne n'est pas joignable d'ici.
- Les cinq niveaux de la fiche passaient toujours en tête, les niveaux
  ajoutés après, rangés entre eux : rien ne plaçait N2RESTREINT entre N2 et
  N3. Le champ « Rang » d'un niveau de la fiche était sans effet.
- L'encart « … citent un niveau inconnu » ne voyait ni les codes d'accès ni
  les plafonds du barème. Or un niveau cible sans plafond tombe sur
  « avancé » : renommé à la main, N2R aurait tiré des questions de tout
  niveau sans que rien ne le signale.
- L'ordre des niveaux ne joue aucun rôle dans le tirage : le plafond se lit
  au barème, code par code.

**Tranché** par délégation (« Pour les 3 prends les recommandations ») :
- renommage **à la main**, choix a de la question posée le 23/09 ; écarté,
  une fonction « Renommer le code » (b) ;
- ordre **par le rang, fiche comprise**. La question n'avait pas été posée :
  c'est la recommandation que je retiens ici. Écartés, des flèches ou un
  glisser-déposer, qui déplacent un niveau à la fois pour le même résultat.

**Ce qui est fait.**
- **Ordre** (`content/ordre-niveaux.ts`, pur, appliqué par `getReferentiel`).
  - Chaque métier range ses niveaux par rang croissant ; les métiers se
    suivent dans l'ordre de `metiers` (préparateur, pharmacien, aide, agent
    d'entretien), leurs rangs ne se mêlent pas.
  - Les niveaux de la fiche valent 10, 20, 30, 40 et 50 ; un rang déposé
    positif l'emporte, pour eux aussi.
  - Au rang 0, un niveau ajouté vient après ceux qui ont un rang : c'est la
    place qu'avaient tous les niveaux ajoutés, l'ordre existant ne bouge pas.
  - Tous les écrans qui lisent le référentiel suivent : prérequis, Repères,
    filtres, réglage des modules, codes d'accès, barème, ordonnancement,
    arborescence de la banque.
- **Référentiel.** Chaque niveau affiche son rang (« rang 40 », « sans
  rang ») ; le formulaire est prérempli du rang effectif, si bien que
  corriger un niveau de la fiche ne le déplace plus ; un paragraphe donne la
  clé de lecture (N1a 10 … N3 50, « 45 place un niveau entre N2 et N3 »).
- **Encart « niveau inconnu ».** Il couvre aussi les codes d'accès actifs et
  les plafonds du barème, et dit comment reprendre chaque ligne. Les ordres
  de profil et d'apprenant n'y figurent pas : l'écran d'ordonnancement les
  marque déjà « profil retiré du référentiel » et ne permet pas de les
  supprimer ; une ligne qu'on ne peut pas reprendre n'y serait qu'une alarme
  permanente.

**Renommer N2RESTREINT en N2R** — sur le site en ligne, avec un code
d'administration :
1. Référentiel, niveau N2RESTREINT, « Modifier » : noter le libellé, la
   filière, la condition d'obtention et les prérequis.
2. « Ajouter un niveau » : code N2R, mêmes champs, rang 45 pour le placer
   entre N2 et N3.
3. Revenir à N2RESTREINT : « Modifier », puis « Supprimer le dépôt ».
4. L'encart « … citent un niveau inconnu », en haut du Référentiel, liste
   tout ce qui citait N2RESTREINT. Reprendre chaque ligne :
   - module déposé, réglage de module, document, prérequis d'un niveau :
     cocher N2R à la place ;
   - barème : régler le plafond de N2R, puis « Enregistrer le barème » ;
     l'ancien code en sort ;
   - code d'accès : un code ne change pas de niveau. En créer un au niveau
     N2R, le remettre à la personne, révoquer l'ancien.
5. Ordonnancement : un ordre fixé pour N2RESTREINT y figure « profil retiré
   du référentiel » ; le refaire sous N2R.
6. L'encart disparaît quand plus rien ne cite N2RESTREINT. Les rapports déjà
   émis gardent N2RESTREINT : ils sont scellés.

**Limites.**
- Le renommage reste un geste manuel en plusieurs endroits ; le journal
  montrera un ajout puis une suppression, pas un renommage.
- Un code d'accès se remplace : la personne qui l'utilisait reçoit un
  nouveau code.
- Les ordres fixés sous l'ancien code restent en base, inertes.
- L'ordre des filières ne change pas : la fiche d'abord, les dépôts par rang.

**Vérifié le 23/09/2026.** `npm run verifier` (326 tests, 8 de plus :
`test/ordre-niveaux.test.ts`), `npm run build`, deux passes de bout en bout
de 90 étapes, sans erreur de page ni erreur serveur.
- **Tests purs** : rangs de la fiche, rang déposé ou nul, ordre existant
  inchangé sans rang, 45 entre N2 et N3, niveau de la fiche déplacé, métiers
  qui ne se mêlent pas, ordre d'arrivée à rang égal.
- **Étape 12k, prolongée** : N2 lu au rang 40, S1 sans rang ; S1 au rang 45
  s'affiche entre N2 et N3 dans les prérequis et dans les Repères. Un niveau
  témoin T9, cité par un code d'accès et par un plafond du barème, puis
  supprimé : l'encart signale les deux ; barème rétabli et code révoqué, il
  s'éteint. S1 revient ensuite sans rang.
- **Contrôle à l'écran** (1 280 px) : rangs affichés, rang prérempli à 40
  pour N2, paragraphe de lecture des rangs.

## Liens vers les modules (23/09/2026, tâche 69, recommandation retenue)

**Demande.** « Ajoute des liens entre les sections, pouvoir cliquer sur un
module pour l'ouvrir. »

**Constaté** (inventaire des écrans, 23/09/2026). Une douzaine d'endroits
ouvraient déjà un module : cartes et badges de l'accueil, « Reprendre »,
module suivant, « voir le module » de la banque, « Voir » d'un module déposé.
Environ vingt-quatre le nommaient sans lien : signalements, documents,
situations, fiches à vérifier, rapports, personnel, programmes, réglage des
modules, pilotage, Repères, résultats et progression de l'apprenant.

**Tranché** par délégation (« Pour les 3 prends les recommandations ») :
partout où un écran nomme un module, son nom l'ouvre, avec les exceptions
ci-dessous. La question du périmètre n'avait pas été posée : c'est la
recommandation que je retiens ici.

**Ce qui est fait.** Un composant, `components/LienModule.tsx` : le nom,
cliquable quand le module s'ouvre ; l'écran appelant décide s'il s'ouvre.
- **Tutorat et administration** — le module s'ouvre s'il existe encore,
  quel que soit son statut :
  - Signalements, Documents, Situations, fiches « à vérifier » de la banque ;
  - liste des rapports et titre d'un rapport (le titre scellé, le module
    actuel) ;
  - Personnel et progression d'un agent ;
  - modules d'un programme, avec le programme s'il est validé, pour que
    « Module suivant » suive son ordre ;
  - réglage des modules du code ;
  - Pilotage : rapports en attente — la requête lit désormais l'identifiant
    du module —, ancienneté des quiz, module du périmètre filtré.
- **Apprenant** — le module s'ouvre s'il lui est lisible, du code ou déposé
  et publié :
  - résultats de la session, à l'accueil, avec le programme ou le profil,
    comme les cartes ;
  - « Ma progression » ;
  - Repères, programme complet : un critère rédigé ouvre son module ;
  - barre de badges : un badge s'ouvre dès que son module est rédigé, comme
    sa carte ; il lui fallait jusqu'ici des questions.

**Laissés sans lien, et pourquoi.**
- Listes de choix, cases à cocher, titres repliables de l'arborescence,
  textes à copier (mention de preuve, prompt de dépôt) : un clic y fait déjà
  autre chose.
- La barre d'une évaluation en cours : le lien ferait abandonner la
  passation.
- La liste à ranger de l'ordonnancement et l'aperçu d'un dépôt : un clic
  perdrait ce qui n'est pas enregistré.
- Le rapport scellé et le journal : document archivé, trace d'audit.
- La couverture de la banque et la confirmation d'un dépôt : leurs lignes
  mènent déjà à la banque filtrée sur le module.
- Le bilan par critère du pilotage : il ne connaît que le code du critère,
  pas le module (défaut ci-dessous).
- Un module inconnu, retiré ou non publié pour l'apprenant, un critère « À
  rédiger » : le lien mènerait à une page vide ou introuvable.

**Constaté, hors périmètre, non corrigé.** Pilotage, « Par critère » : le
lien d'un critère porte son code (`/admin/pilotage?module=B1-01`), mais le
filtre n'accepte qu'un identifiant de module et l'écarte sans rien dire ; la
page se recharge sans filtre. Deux corrections possibles : résoudre le
critère en son module, ou ajouter un filtre par critère.

**Vérifié le 23/09/2026.** `npm run verifier` (326 tests), `npm run build`,
deux passes de bout en bout de 91 étapes, sans erreur de page ni erreur
serveur.
- **Étape 10f, prolongée** : la liste des rapports et le titre du rapport
  clos ouvrent le module évalué ; l'ancienneté des quiz du pilotage aussi.
  Vérifié là parce que le seul rapport du parcours est supprimé ensuite.
- **Étape 14d quinquies, nouvelle** : les signalements ouvrent le module de
  la question ; dans les Repères, un critère rédigé ouvre son module, et un
  clic y mène ; aucun critère « À rédiger » ne porte de lien.
- **Premier essai en échec, corrigé** : l'étape cliquait un critère resté
  dans un grand module replié des Repères ; elle le déplie d'abord. Défaut du
  test, pas du site.
- **Contrôle à l'écran**, sur la base laissée par la chaîne : liens présents
  dans les signalements, les documents, les fiches à vérifier, le réglage des
  modules et les Repères (51 critères « À rédiger », aucun lien).

## Non fait

- Éditeur du texte des modules en base : écarté (question 10, choix a) ; un
  module déposé porte une présentation courte seulement.
- Purge automatique des rapports à l'échéance de conservation.
- ~~Glisser-déposer pour l'ordonnancement des modules~~ — fait le
  23/09/2026 (question 55), au doigt comme à la souris.
- Mode sombre (décision antérieure : plus tard).
- ~~Test de bout en bout navigateur (Playwright)~~ — fait depuis :
  `e2e/parcours.e2e.js` couvre les parcours apprenant, tutorat et
  administration contre un serveur bâti et une base réelle. Cette ligne est
  restée périmée jusqu'au 21/09/2026.
