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

**Logo de l'unité** (question 24, choix b, 18/09/2026) : le logo
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
