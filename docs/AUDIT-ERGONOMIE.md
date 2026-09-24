# Audit fonctionnel et ergonomique — 24/09/2026

Demandé le 24/09/2026. Le but est de trouver des axes d'optimisation concrets
sur trois plans : l'engagement des apprenants, la clarté des évaluations et la
gestion par les formateurs. Les propositions sont **itératives et greffées sur
l'existant**, sans refonte ni changement de logique. Elles s'inspirent des
outils d'e-learning du marché, avec une approche sobre, adaptée au personnel
de terrain.

L'audit n'a modifié aucune ligne du site. Chaque proposition indique où elle
se greffe, l'effort qu'elle demande et la décision qu'elle appelle. Elles se
trancheront une par une, comme les questions précédentes.

Échelle d'effort :
- **petit** : un composant, sans toucher la base ni une règle ;
- **moyen** : plusieurs écrans, ou une donnée de plus en base ;
- **grand** : un nouveau flux de données, avec mise à jour de la fiche RGPD
  ou de la procédure.

## Cadre

**Réponses aux questions de cadrage (24/09/2026).**

| | Réponse | Conséquence pour l'audit |
|---|---|---|
| 1 | a : aucun apprenant pour l'instant, le site n'est essayé que par le pharmacien et les tuteurs | Revue experte seulement, rien n'a été observé chez les agents. Un test avec des agents est proposé avant la mise en service (§ 5) |
| 2 | a + c : PC de l'unité, iPad en zone gants aux mains | Mesures faites sur PC 1366 × 768 et sur iPad 7ᵉ génération, en portrait et en paysage, mode zone actif. Le smartphone est hors champ. Le PC est partagé ; l'iPad de zone l'est probablement `[à vérifier]` |
| 3 | a : le temps des formateurs part dans l'écriture, le dépôt et la validation des questions | Côté formateur, ce parcours est examiné en premier (§ 2.1) |
| 4 | c : la procédure ne fixe ni nombre de tentatives, ni délai, ni durée | Les règles proposées (§ 2.2) sont à valider, puis à reporter dans la procédure |

**Tenu pour acquis.**
- **Sobriété du brief.** Ni classement entre agents, ni points, ni série de
  réussites, ni félicitations enthousiastes. Les badges d'acquisition restent.
- **Pas de relance hors du site.** Le site fonctionne en mode pseudonyme
  (question 6), et les notifications ont été écartées le 22/09.
- **Périmètre et règles déjà tranchés.**
  - Le site reste aux étapes 1 et 2 (question 47).
  - Il indique l'ancienneté, jamais l'échéance (question 49).
  - La règle des quatre yeux ne change pas (question 12).
  - Le choix « une réponse / plusieurs réponses » écarté à la question 68
    n'est pas reproposé.

**Méthode.** Revue experte de trois parcours :
- **apprenant** : module, entraînement, évaluation, résultat ;
- **tuteur** : évaluation passée en sa présence ;
- **formateur** : dépôt, puis validation.

Les parcours ont été suivis sur la base locale d'essai, avec le serveur bâti.
Les mesures sont prises dans la page : position de la correction et du bouton
« Commencer », hauteur des pages. Le code a été relu. Les références ont été
vérifiées sur PubMed le 24/09/2026.

**Limites.**
- **Pas d'utilisateur réel (réponse 1a).** Ce qui est dit difficile ici est
  une prédiction d'expert, pas une observation.
- **Chromium seulement.** L'iPad est émulé (taille, tactile), pas affiché par
  Safari. Les gants, la visière et les reflets ne se simulent pas.
- **Questions d'essai courtes.** La base d'essai contient des questions plus
  courtes que la plupart des vraies. Sur les vraies questions, la correction
  tombera plus bas encore que mesuré.
- **Sites des éditeurs inaccessibles.** Les pages de 360Learning et de
  PandaSuite ne sont pas consultables d'ici (bloquées par le proxy). Leurs
  fonctions sont relevées dans les résultats de recherche : `[à vérifier]`.

## L'essentiel

| # | Constat | Mesure | Proposition |
|---|---|---|---|
| 1 | Après « Vérifier », la correction peut rester hors de l'écran | QIM et schéma : 0 % de la correction visible, sur PC comme sur iPad | E1 |
| 2 | Les réponses des questions réservées sont montrées après l'évaluation | À l'écran et sur le rapport exporté | F1 |
| 3 | Sur un poste partagé, l'agent suivant peut hériter de l'identifiant du précédent | « Quitter » ne détache pas l'agent | Z1 |
| 4 | L'entrée dans le test est longue | Environ 450 mots ; « Commencer » à 1,6 à 2,1 écrans | E4 |
| 5 | Valider une question demande plusieurs allers-retours | L'écran de validation n'affiche ni aperçu, ni justification, ni alertes du dépôt | D1 à D3 |

## 1. Ergonomie

### 1.1 Voir la correction (entraînement)

**E1 — Amener la correction à l'écran et la reporter sur les propositions.**

**Constat.** Après « Vérifier », la correction s'ajoute sous la question
(`components/Evaluation.tsx:783-797`, `:1305`). Mais rien ne se passe :
- la page ne défile pas ;
- le focus ne bouge pas ;
- rien n'est annoncé, car la correction n'a ni `role="status"` ni
  `aria-live`.

Pendant ce temps, le bouton devient « Question suivante ». On peut donc
passer à la suite sans avoir vu la correction.

Mesures faites avec la barre de passation déduite de la hauteur utile :

| Question | PC 1366 × 768 | iPad portrait, zone | iPad paysage, zone |
|---|---|---|---|
| QCM court | 72 % visible | 74 % visible | 68 % visible |
| QIM à 5 propositions | 0 % (haut à 679 px, 670 px utiles) | 0 % (1 061 px, 982 utiles) | non mesuré |
| Schéma | 0 % (801 px, 670 utiles) | 0 % (1 005 px, 982 utiles) | non mesuré |

Deux autres défauts aggravent la lecture :
- **Rien n'est marqué sur les propositions.** La correction dit « Votre
  réponse : … / Attendu : … » en texte, sous la question. L'apprenant doit
  faire lui-même le rapprochement.
- **L'énoncé et l'image sont répétés** dans la correction, juste sous la
  question qui les montre déjà.

**Proposition.**
- **Montrer la correction.** Après « Vérifier », la faire défiler jusqu'à
  l'écran (sans animation si le mouvement réduit est demandé) et y porter le
  focus. Poser `role="status"` sur son en-tête.
- **Marquer les propositions sur place.** Chaque proposition affiche
  « ✓ attendue » ou « ✗ votre choix », en texte, pas seulement en couleur.
  Pour une QIM, chaque ligne indique « Vous : Vrai · Attendu : Faux ».
- **Alléger la correction.** En entraînement, elle garde la justification et
  la source, sans répéter l'énoncé ni l'image.

**Pourquoi.**
- Une correction qu'on ne voit pas ne corrige rien.
- L'effet d'un retour dépend de l'information qu'il contient (Wisniewski
  2020).
- Mettre l'information là où l'on regarde et supprimer les redites réduit la
  charge cognitive inutile (van Merriënboer et Sweller 2010).
- Le moment du retour, lui, n'est pas en cause : un retour différé peut valoir
  autant ou plus qu'un retour immédiat (Butler 2007). Rien ne justifie donc de
  changer l'entraînement, seulement l'affichage.
- WCAG 2.2, critère 4.1.3 (messages d'état, niveau AA).

**Mise en œuvre.** Greffe sur `rendreCorrection` et `rendreQuestion`
(`Evaluation.tsx:1025-1184`). Effort : petit. Décision : aucune, car seul
l'affichage change.

**E2 — Le numéro et le format de la question passent sous l'en-tête.**

**Constat.** Sur PC 1366 × 768, en entraînement, chaque question s'ouvre avec
son cadre à 9 px du haut de la fenêtre, sous l'en-tête fixe de 81 px. Deux
éléments sont masqués :
- « Question n / N » ;
- l'étiquette de format « QCM — une seule réponse ».

Or c'est cette étiquette qui dit s'il faut cocher une ou plusieurs réponses
(question 68). Sur iPad en portrait, le cadre démarre plus bas (270 px) et le
défaut n'apparaît pas. L'iPad en paysage n'a pas été mesuré.

**Proposition.** Une marge de défilement égale à la hauteur de l'en-tête
(`scroll-padding-top`).

**Mise en œuvre.** Effort : petit. Décision : aucune.

### 1.2 Lire une question

**E3 — Ne dire qu'une fois ce qui ne sert pas à répondre.**

**Constat.**
- **Étiquettes destinées au tuteur.** Pendant la passation, l'apprenant voit
  « Réservée à l'évaluation » et « Obligatoire »
  (`Evaluation.tsx:1084-1088`). Ces étiquettes servent au tuteur et au
  rapport, pas à répondre.
- **Règle de la QIM répétée.** Sur chaque QIM, la ligne de barème (« juste
  +1, faux −1, « je ne sais pas » 0… ») est suivie d'un avertissement en rose
  et en gras qui redit la même règle (« « Je ne sais pas » ne rapporte ni ne
  retire rien… », `:1104`, `:1127-1130`).

**Proposition.**
- **Pendant la passation**, garder « Éliminatoire » et le format.
  « Éliminatoire » reste pour une raison de sécurité, que le brief impose.
- **« Réservée » et « Obligatoire »** ne s'affichent qu'à la correction et au
  rapport.
- **La règle de la QIM** se dit une fois, à la première QIM de la séance.
  Ensuite, un lien repliable « Comment répondre ? » la garde à portée.

**Pourquoi.** La redondance est une charge sans bénéfice (van Merriënboer et
Sweller 2010 ; Young 2014).

**Mise en œuvre.** Effort : petit. Décision : oui, sur l'affichage des deux
étiquettes à l'apprenant.

### 1.3 Du module au score

**E4 — Écran « Régler l'évaluation » : l'essentiel d'abord.**

**Constat.** Tout est déjà présélectionné : le niveau cible est prérempli, le
tirage vaut « Habilitation » si la banque suffit, le mode vaut « Évaluation ».
L'écran impose pourtant de lire avant d'agir :
- environ 450 mots ;
- trois réglages ;
- le seuil de réussite énoncé deux fois (en-tête et encart).

Le bouton « Commencer » arrive loin sous le haut de page :

| Écran | Position de « Commencer » |
|---|---|
| PC 1366 | 1,96 écran |
| iPad portrait, zone | 1,64 écran |
| iPad paysage, zone | 2,13 écrans |

**Proposition.**
- **En tête**, deux boutons : « M'entraîner » et « Passer l'évaluation ».
- **Sous ces boutons**, une ligne rappelle les réglages retenus, par exemple
  « Habilitation · 10 questions · niveau N1 — modifier ».
- **Les règles** (seuil, bande de garde, tirage non concluant, réservées,
  obligatoires) passent dans un bloc repliable « Règles de l'évaluation ».
  Rien n'est retiré : chaque règle reste à un appui.
- **Objectif :** que « Commencer » soit visible sans défiler, sur PC comme sur
  iPad.

**Mise en œuvre.** Greffe sur `Evaluation.tsx:876-1021`. Effort : moyen.
Décision : aucune règle ne change, la forme est à juger au test du § 5.

**E5 — Évaluation : une page de 4,5 écrans pour 5 questions.**

**Constat.**
- **Tout sur une page.** L'évaluation affiche toutes les questions sur une
  seule page (`Evaluation.tsx:1386-1396`). Avec 5 questions, cela fait
  4,5 écrans sur PC.
- **Navigation limitée.** Les pastilles ne sont pas cliquables. On ne peut
  revenir à une question que depuis le récapitulatif, et seulement si elle est
  restée sans réponse.
- **Risque à l'iPad.** Sur iPad, gants aux mains, faire défiler une page
  couverte de boutons radio peut provoquer des touches involontaires
  (`[hypothèse à vérifier sur l'appareil]`).

**Proposition (à tester avant de décider).**
- Passer aussi l'évaluation en « une question à la fois », comme
  l'entraînement.
- Ajouter « Précédente / Suivante » et des pastilles cliquables pour revenir
  en arrière.
- Le récapitulatif reste inchangé.

**Mise en œuvre.** Effort : moyen. Décision : après le test du § 5.

**E6 — Résultat : ce qu'il faut retravailler, en premier.**

**Constat.** Après la validation, la page revient en haut et le verdict
s'affiche à 518 px du haut, sous le fil d'habilitation et le titre. Ensuite
viennent toutes les corrections, dans l'ordre. Deux problèmes :
- **Le bouton utile est loin.** « Retravailler les N questions ratées » se
  trouve à 3,8 écrans pour 5 questions, sous toutes les corrections.
- **L'action principale est « Nouveau tirage »**, même après un non acquis.

**Proposition.**
- **Sous le verdict**, un bloc « À retravailler » liste les questions ratées
  et leur critère, avec le bouton « Retravailler les questions ratées ».
- **Les erreurs d'abord.** Les questions réussies sont repliées.
- **Après un non acquis**, l'action principale devient « Retravailler » et
  « Nouveau tirage » passe en secondaire (voir F2).

**Mise en œuvre.** Effort : petit à moyen. Décision : liée à F2.

## 2. Fonctionnel

### 2.1 Dépôt et validation des questions (réponse 3a)

**D1 — Valider depuis un seul écran, question après question.**

**Constat.** Valider une question demande aujourd'hui plusieurs
allers-retours :
- **La liste de validation est incomplète.** Elle ne montre que l'énoncé et
  les propositions (`app/admin/questions/question-banque.tsx:56-71`).
- **La fiche ne permet pas de valider.** Pour voir la justification, les
  sources ou l'image, il faut ouvrir « Modifier ». Mais la fiche ne propose
  que « Ajouter une proposition » et « Enregistrer les modifications » : pour
  valider, il faut revenir à la liste.
- **Aucun aperçu.** Une question « à vérifier » n'étant jamais tirée
  (`content/banque-db.ts:173`), personne ne la voit comme l'apprenant la verra
  avant de la valider.
- **Aucune revérification.** Le bouton « Valider » ne revérifie pas le contenu
  (`app/admin/questions/actions.ts:212-234`). Un QCM déposé sans corrigé se
  valide d'un clic.

**Proposition.** Une vue « Relire » par question, qui réunit :
- un aperçu apprenant, avec le composant de l'évaluation en lecture seule ;
- le corrigé, la justification, les sources, l'image et les alertes du dépôt
  (D2) ;
- trois boutons : « Valider et passer à la suivante », « Modifier » et
  « Retirer ».

Les questions se relisent dans l'ordre du dépôt (D3). Au clic sur « Valider »,
les contrôles du dépôt sont repassés. La règle des quatre yeux ne change pas :
un autre code que le dernier éditeur valide.

**Mise en œuvre.** Effort : moyen. Décision : aucune.

**D2 — Garder les alertes du dépôt jusqu'à la validation.**

**Constat.** Les alertes produites au dépôt ne vivent que dans l'aperçu :
- les six contrôles de `lib/import-format.ts` ;
- ceux de l'analyseur : corrigé absent, extraits orphelins, schéma sans
  image, etc.

Elles ne sont pas enregistrées avec la question
(`app/admin/questions/actions.ts:487-504`). Celui qui valide ne les voit donc
jamais.

**Proposition.** Les enregistrer avec la question jusqu'à sa validation, et
les afficher dans D1.

**Mise en œuvre.** Effort : petit à moyen (une colonne en base). Décision :
aucune.

**D3 — Relire un dépôt d'un bloc.**

**Constat.** Le numéro de dépôt est enregistré sur chaque question, et la
fonction `listerDepotsQuestions` existe (`content/banque-db.ts:362-367`), mais
rien ne l'appelle. Le lien « Vérifier ces questions » ouvre tout le module.

**Proposition.** Un filtre du type « Dépôt du 23/09 — 10 à vérifier », qui
alimente la suite de relecture de D1.

**Mise en œuvre.** Effort : petit. Décision : aucune.

**D4 — Signaler les défauts de rédaction au dépôt.**

**Constat.** Le dépôt vérifie la forme : format, corrigé, règle
« plusieurs ». Il ne repère aucun des défauts de rédaction classiques :
- énoncé négatif (« ne… pas », « sauf ») ;
- « toutes les réponses » ou « aucune des réponses » ;
- bonne réponse nettement plus longue que les autres ;
- termes absolus (« toujours », « jamais ») ;
- énoncé très long.

**Proposition.** Ajouter ces contrôles comme des avertissements, jamais
bloquants, conservés avec la question (D2). Il faut s'attendre à quelques
faux positifs.

**Pourquoi.** Ces défauts sont fréquents et faussent les résultats :
- dans quatre examens de médecine, 36 à 65 % des items étaient défectueux, et
  un item défectueux était jusqu'à 15 points plus difficile qu'un item correct
  sur le même contenu (Downing 2005) ;
- en soins infirmiers, 47 % des items étaient défectueux, et les meilleurs
  étudiants en étaient les plus pénalisés (Tarrant et Ware 2008).

**Mise en œuvre.** Effort : moyen. Décision : aucune.

### 2.2 Mécanique de test (réponse 4c)

**F1 — Les réponses des questions réservées sont montrées après
l'évaluation.**

**Constat.** La question 18 (choix c) a créé les questions réservées pour
empêcher un agent d'apprendre la banque avant l'évaluation. Or ces réponses
lui sont données après :
- **à l'écran de résultat**, qui montre pour chaque question, réservées
  comprises, la réponse attendue, la justification et la source
  (`app/api/evaluation/route.ts:395-399` ; `Evaluation.tsx:1045-1054`) ;
- **sur le rapport exporté** que l'agent remet (`lib/rapport.ts:288-289`).

Les réservées sont tirées en priorité à chaque évaluation Habilitation ou
Complet. Un agent qui échoue les retrouve donc au tirage suivant, avec leurs
réponses en main. Le même effet a déjà été relevé pour les obligatoires
(`DECISIONS.md`, « Obligatoires retenues »).

**Ce qu'en dit la littérature.** Elle ne tranche pas :
- revoir des questions ne donne pas d'avantage aux candidats qui repassent un
  examen (Wood 2009), mais sans correction montrée entre les deux passages ;
- l'effet d'entraînement est plus fort quand on repasse la même forme de test
  (Hausknecht 2007), mais pour des tests d'aptitude, pas de connaissances.

**Options.**
- **a** : ne plus montrer à l'apprenant la réponse attendue ni la
  justification des réservées, ni à l'écran ni sur le rapport exporté. Le
  tuteur et le pharmacien les gardent.
- **b** : les montrer, mais exclure du tirage suivant de l'agent les réservées
  qu'il a déjà vues, quand la banque le permet.
- **c** : les deux.

**Mise en œuvre.** Effort : moyen. Décision : oui, car la proposition touche
la question 18.

**F2 — Nouvelle tentative : une règle à écrire.**

**Constat.**
- **Aucune règle dans la procédure** (réponse 4c).
- **Rien n'empêche de repasser aussitôt.** Le code ne fixe aucune règle, et
  « Nouveau tirage » est l'action principale du résultat.
- **Aucune mémoire des tentatives.** Le tirage ignore les questions déjà
  posées à l'agent.

**Proposition, à valider puis à reporter dans la procédure.** Après un non
acquis :
1. l'agent passe d'abord par « Retravailler les questions ratées », qui
   existe déjà ;
2. le nouveau tirage écarte en priorité les questions de la tentative
   précédente, quand la banque le permet ;
3. le rapport indique le rang de la tentative sur ce critère.

Le site n'impose aucun délai. La procédure peut en fixer un.

**Pourquoi.**
- Se tester à nouveau après une correction aide à retenir. Dans un essai
  randomisé, les internes testés plusieurs fois, avec correction, ont obtenu
  13 points de plus à 6 mois que ceux qui avaient relu le cours, soit 39 %
  contre 26 %, d = 0,91 (Larsen 2009).
- L'effet d'entraînement est plus fort à forme identique (Hausknecht 2007).

**Mise en œuvre.** Effort : moyen. Décision : oui, puis mise à jour de la
procédure.

**F3 — Durée : pas de chronomètre.**

**Constat.** Aucune durée limite n'existe dans le code.

**Recommandation.** Ne pas en ajouter à l'évaluation d'habilitation, pour deux
raisons :
- elle mesure une connaissance, pas une vitesse ;
- en zone, les gants et la visière ralentissent la saisie sans rapport avec le
  savoir.

Je n'ai pas vérifié de littérature sur l'effet d'une limite de temps dans ce
type d'évaluation `[à vérifier]`. Si une limite est voulue, il faut l'écrire
d'abord dans la procédure. Une durée indicative peut s'afficher par module
quand elle est connue, mais deux modules sur cinquante et un en ont une
aujourd'hui.

**Décision.** Oui : confirmer l'absence de limite.

**F4 — Mélanger l'ordre des propositions.**

**Constat.** Les QCM et les QIM gardent l'ordre de rédaction ; seuls les
séquences et les textes à trous sont mélangés (`content/types.ts:459-464`).
Le prompt de génération demande de varier la place des bonnes réponses, mais
rien ne le vérifie.

**Proposition.**
- Mélanger les propositions à chaque tirage.
- Faire une exception pour les questions dont une proposition renvoie aux
  autres (« A et B », « aucune des réponses »). Ces questions seraient soit
  marquées « ordre fixe », soit repérées au dépôt (D4).

**Mise en œuvre.** Effort : petit. Décision : oui.

### 2.3 Tableaux de bord, relances, ancrage

Ce qui existe déjà :
- **accueil de l'apprenant** : « Reprendre », état de chaque module,
  avancement par grand module ;
- **pilotage** : scores par critère, questions les plus manquées, ancienneté ;
- **file d'attente du tutorat** : cinq éléments au plus, plafond atteint
  (question 49).

**S1 — Qualité de la banque, question par question (formateurs).**

**Constat.** Une seule statistique existe : les « questions les plus
manquées » du pilotage. Elle retient les questions posées au moins 5 fois et
réussies à 60 % ou moins, 12 au plus (`lib/pilotage.ts:51-63`). Ses limites :
- son lien ouvre la banque du module, pas la question ;
- rien ne s'affiche dans la banque ni sur la fiche d'une question ;
- aucun indice de discrimination n'est calculé.

**Proposition.**
- **Dans la banque et sur la fiche**, afficher le nombre de fois où la
  question a été posée et son taux de réussite.
- **Quand l'effectif suffit**, ajouter l'indice de discrimination (Tavakol et
  Dennick 2011). Une question réussie par les plus faibles et manquée par les
  meilleurs est alors signalée « à revoir ».
- **Depuis le pilotage**, un lien mène directement à la question.

360Learning fait remonter de la même façon les contenus que les apprenants
jugent mal, avec ses « Reactions » `[à vérifier]`. Cette proposition n'a de
sens qu'après la mise en service (réponse 1a).

**Mise en œuvre.** Effort : moyen. Décision : aucune, car les rapports
contiennent déjà les données.

**S2 — « À retravailler » pour l'apprenant rattaché (la relance dans le
site).**

**Constat.** L'historique de chaque question est enregistré sous l'identifiant
rattaché. Mais son affichage attend une décision (question 11 : « les données
sont là ; le tracé attend une décision d'affichage »).

**Proposition.** Sur l'accueil de l'agent rattaché, un encart « À
retravailler » regroupe :
- les critères non acquis ;
- les questions ratées, hors questions réservées ;
- les évaluations interrompues ;
- les quiz passés depuis plus de 24 mois, présentés par leur ancienneté,
  jamais par une échéance.

**Mise en œuvre.** Effort : moyen. Décision : oui, car la proposition touche
la question 11.

**S3 — Rappels espacés (ancrage mémoriel).**

**Constat.** On peut rejouer les questions ratées une fois, juste après
l'évaluation. De l'entraînement, seul un total est conservé : ni les
questions posées, ni les résultats question par question
(`lib/progression.ts:117-122`).

**Proposition.** À sa connexion, l'agent rattaché se voit proposer un
entraînement court : 5 questions, moins de 15 minutes.
- **Contenu :** ses questions ratées, puis ses questions réussies, hors
  questions réservées.
- **Rythme :** à intervalles croissants. Une question sort de la liste après
  deux réussites de suite.
- **Modèle :** la mécanique de Kerfoot et Baker (2012), qui renvoyait une
  question après 12 jours si elle était ratée, après 24 si elle était
  réussie.

**Pourquoi.**
- Se tester à nouveau, avec correction, fait mieux retenir que relire
  (Larsen 2008 et 2009).
- Des questions envoyées à intervalles réguliers ont amélioré les résultats
  de fin d'année, avec une taille d'effet de 0,73 à 1,01 (Kerfoot 2007). Des
  intervalles adaptés au niveau de l'apprenant donnent les mêmes scores avec
  moins de questions, soit un gain d'efficacité de 38 % (Kerfoot 2010).
- Les formats courts ont un effet favorable sur les connaissances, mais ils
  n'ont pas été évalués au niveau des patients (De Gagne 2019, revue de
  17 études).
- Qstream, cofondé par Kerfoot, est l'application commerciale de ces
  travaux. Ses chiffres promotionnels ne sont pas repris ici.

**Limites.**
- **Pas d'intervalles standard.** La littérature n'en fixe aucun (Versteeg
  2020) : ils sont `[à préciser]`.
- **Pas d'envoi.** Dans les essais de Kerfoot, les questions arrivaient par
  courriel. Ici, rien ne sort du site (question 6). L'effet dépend donc du
  retour des agents : il faudra le mesurer.

**Mise en œuvre.** Effort : grand. Décision : oui, car il faut une donnée
d'entraînement par question, la mise à jour de la fiche RGPD et le choix des
intervalles.

**Ludification.** Rien à ajouter. Le brief l'exclut, et les preuves restent
faibles : la plupart des études n'ont pas de groupe témoin bien défini (van
Gaalen 2021). Les ressorts qui semblent agir sont l'évaluation et le défi, et
le site les a déjà : tests et corrections.

## 3. PC de l'unité et iPad en zone

**Z1 — Poste partagé : garder l'identité de l'agent visible.**

**Constat.**
- **« Quitter » ne détache pas.** Le bouton ferme la session de rôle
  (`lib/auth.ts:186-188`) mais pas le rattachement de l'agent
  (`lib/progression.ts:76-78`).
- **L'agent suivant entretient le rattachement.** Son activité sur le même
  poste maintient celui du précédent (`app/api/activite/route.ts:38-39`). Le
  rattachement ne tombe qu'après 4 h sans activité, 12 h au plus.
- **L'identifiant n'est affiché nulle part pendant l'évaluation.** L'écran de
  l'évaluation ne reçoit qu'un booléen (`app/module/[id]/evaluation/page.tsx:93`),
  et le récapitulatif ne montre pas non plus l'identifiant.
- **« Se détacher » est difficile à trouver.** Le bouton est en bas de « Ma
  progression ».

Avec un PC d'unité et un iPad de zone partagés (réponse 2a + c), un agent
peut donc passer une évaluation, et émettre un rapport, sous l'identifiant de
celui qui l'a précédé.

**Proposition.**
- **« Quitter » détache aussi l'agent.**
- **L'identifiant reste visible.** L'en-tête affiche « AG-012 · Se détacher »,
  et le récapitulatif précise « Résultat enregistré sous AG-012 ».
- **Option en mode zone :** un délai d'inactivité plus court pour le
  rattachement `[à préciser]`.

**Mise en œuvre.** Effort : petit. Décision : oui, car la proposition change
le comportement de « Quitter » (question 11, tâche 70).

**Z2 — Schéma : le zoom est bloqué au toucher.**

**Constat.** Le cadre de l'image porte `touch-action: none`
(`app/globals.css:1802`). Cette règle vaut pour l'apprenant comme pour
l'éditeur : un pincement qui commence sur l'image ne zoome pas. Aucun bouton
ne permet non plus d'agrandir l'image.

**Proposition.**
- Réserver `touch-action: none` à l'éditeur, qui en a besoin pour placer les
  repères.
- Côté apprenant, ajouter un bouton « Agrandir » qui ouvre l'image seule.

**Mise en œuvre.** Effort : petit. Décision : aucune.

**Z3 — Saisie au gant.**

**Constat.**
- **Sans frappe.** Les séquences, les textes à trous et les schémas en mode
  « choisir » se remplissent par menus. Aucune question apprenant ne demande
  de glisser, conformément au critère WCAG 2.5.7.
- **Avec frappe.** Le schéma en mode « écrire », mode par défaut des
  questions déposées, demande de taper au clavier virtuel.
- **La touche « suivant » envoie le formulaire.** Le clavier affiche
  « suivant » (`enterKeyHint="next"`, `components/SchemaQuestion.tsx:199`),
  mais en évaluation cette touche envoie le formulaire et ouvre le
  récapitulatif `[à vérifier sur l'iPad]`.
- **Ce que change le mode zone.** Il agrandit les cibles (52 px) et le texte
  courant (18 px). Il ne change ni la mise en page ni le délai d'inactivité.

**Proposition.** Faire passer la touche « suivant » au champ suivant.

**Mise en garde.** Il ne faut pas basculer « écrire » vers « choisir » selon
l'appareil en évaluation. Se rappeler une réponse et la reconnaître dans une
liste ne mesurent pas la même chose : le rappel fait mieux retenir (Larsen
2008). Le choix reste à l'auteur, question par question.

**Mise en œuvre.** Effort : petit. Décision : aucune.

**Z4 — Accessibilité.**

**Constat.**
- **La correction n'est pas annoncée** (voir E1).
- **Les boutons Vrai, Faux et Je ne sais pas d'une QIM ne sont pas groupés
  avec leur proposition** (`Evaluation.tsx:1131-1166`). Un lecteur d'écran
  annonce « Vrai » cinq fois, sans dire de quelle proposition il s'agit.
- **L'état du bouton « Mode zone » ne se voit qu'à sa couleur.** Il porte
  `aria-pressed`, mais son libellé ne change pas.

**Proposition.**
- Pour chaque proposition de QIM, `role="radiogroup"` nommé par le texte de
  la proposition.
- Le libellé « Mode zone : activé » quand le mode est actif.

**Cadre réglementaire.** L'établissement est public. Le décret 2019-768
soumet ses sites, intranets, extranets et progiciels au RGAA. Ce champ a été
relevé par recherche web, sans consulter le texte `[à vérifier]`.

**Mise en œuvre.** Effort : petit. Décision : aucune.

## 4. Défauts relevés en passant

Ces défauts sont signalés, pas corrigés, et chacun est à trancher :
1. **Banque.** Les étapes des séquences et les vignettes des textes à trous
   s'affichent avec « (vrai) » ou « (faux) »
   (`app/admin/questions/question-banque.tsx:63-69`).
2. **« Nouvelle question ».** Le texte d'aide annonce qu'une question
   « validée » est posée immédiatement, alors que l'éditeur ne propose que
   « À vérifier » ou « Retirée » (`app/admin/questions/nouvelle/page.tsx:27-28` ;
   `components/EditeurQuestion.tsx:523-525`).
3. **Compteur « à vérifier ».** Il compte aussi les questions que l'on ne peut
   pas valider soi-même (`lib/attente.ts:54`).

## 5. Ce que cette revue ne peut pas trouver : un test avec des agents

Aucune méthode d'évaluation de l'utilisabilité ne s'est montrée suffisante
seule, qu'il s'agisse de la revue experte ou de l'observation d'utilisateurs
qui pensent à voix haute. Les combiner est recommandé (Jaspers 2009).

**Proposition.** Un test avec 3 à 5 agents, avant la mise en service et après
le lot 1. Au moins l'un d'eux est un préparateur qui travaille en zone. Trois
tâches :
1. **Entraînement sur l'iPad de zone**, gants et visière, sur un module.
2. **Évaluation « Découverte » sur le PC de l'unité**, jusqu'au rapport.
3. **Pour un tuteur :** relire et valider un dépôt de 10 questions. Le temps
   de cette tâche est mesuré avant et après D1 à D3.

Déroulé : observer sans aider, noter les hésitations et les erreurs.

## 6. Ordre proposé

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 1. Avant la mise en service | E1, E2, Z1, Z2, F1 | Ces défauts faussent l'apprentissage, la preuve ou l'identité de l'agent. Tous sont petits sauf F1, qui demande une décision |
| 2. Test avec des agents | § 5 | Sur la version corrigée : sinon le test bute sur des défauts déjà connus |
| 3. Le temps des formateurs | D1 à D4 | Réponse 3a ; aucune règle touchée |
| 4. Mécanique de test | F2, F3, F4 | Réponse 4c : décision, puis procédure |
| 5. Parcours de l'apprenant | E3 à E6, Z3, Z4 | Le test dira ce qui gêne vraiment |
| 6. Après la mise en service | S1, S2, S3 | Ces propositions demandent des données d'usage ; S2 et S3 touchent la fiche RGPD |

## Références

Articles vérifiés sur PubMed le 24/09/2026 :

1. Butler AC, Karpicke JD, Roediger HL. The effect of type and timing of
   feedback on learning from multiple-choice tests. J Exp Psychol Appl.
   2007;13(4):273-81. [doi:10.1037/1076-898X.13.4.273](https://doi.org/10.1037/1076-898X.13.4.273)
2. De Gagne JC, Park HK, Hall K, et al. Microlearning in health professions
   education: scoping review. JMIR Med Educ. 2019;5(2):e13997.
   [doi:10.2196/13997](https://doi.org/10.2196/13997)
3. Downing SM. The effects of violating standard item writing principles on
   tests and students. Adv Health Sci Educ Theory Pract. 2005;10(2):133-43.
   [doi:10.1007/s10459-004-4019-5](https://doi.org/10.1007/s10459-004-4019-5)
4. Hausknecht JP, Halpert JA, Di Paolo NT, Moriarty Gerrard MO. Retesting in
   selection: a meta-analysis of coaching and practice effects for tests of
   cognitive ability. J Appl Psychol. 2007;92(2):373-85.
   [doi:10.1037/0021-9010.92.2.373](https://doi.org/10.1037/0021-9010.92.2.373)
5. Jaspers MW. A comparison of usability methods for testing interactive
   health technologies. Int J Med Inform. 2009;78(5):340-53.
   [doi:10.1016/j.ijmedinf.2008.10.002](https://doi.org/10.1016/j.ijmedinf.2008.10.002)
6. Kerfoot BP, DeWolf WC, Masser BA, et al. Spaced education improves the
   retention of clinical knowledge by medical students: a randomised
   controlled trial. Med Educ. 2007;41(1):23-31.
   [doi:10.1111/j.1365-2929.2006.02644.x](https://doi.org/10.1111/j.1365-2929.2006.02644.x)
7. Kerfoot BP. Adaptive spaced education improves learning efficiency: a
   randomized controlled trial. J Urol. 2010;183(2):678-81.
   [doi:10.1016/j.juro.2009.10.005](https://doi.org/10.1016/j.juro.2009.10.005)
8. Kerfoot BP, Baker H. An online spaced-education game for global continuing
   medical education: a randomized trial. Ann Surg. 2012;256(1):33-8.
   [doi:10.1097/SLA.0b013e31825b3912](https://doi.org/10.1097/SLA.0b013e31825b3912)
9. Larsen DP, Butler AC, Roediger HL. Test-enhanced learning in medical
   education. Med Educ. 2008;42(10):959-66.
   [doi:10.1111/j.1365-2923.2008.03124.x](https://doi.org/10.1111/j.1365-2923.2008.03124.x)
10. Larsen DP, Butler AC, Roediger HL. Repeated testing improves long-term
    retention relative to repeated study: a randomised controlled trial. Med
    Educ. 2009;43(12):1174-81.
    [doi:10.1111/j.1365-2923.2009.03518.x](https://doi.org/10.1111/j.1365-2923.2009.03518.x)
11. Tarrant M, Ware J. Impact of item-writing flaws in multiple-choice
    questions on student achievement in high-stakes nursing assessments. Med
    Educ. 2008;42(2):198-206.
    [doi:10.1111/j.1365-2923.2007.02957.x](https://doi.org/10.1111/j.1365-2923.2007.02957.x)
12. Tavakol M, Dennick R. Post-examination analysis of objective tests. Med
    Teach. 2011;33(6):447-58.
    [doi:10.3109/0142159X.2011.564682](https://doi.org/10.3109/0142159X.2011.564682)
13. van Gaalen AEJ, Brouwer J, Schönrock-Adema J, et al. Gamification of
    health professions education: a systematic review. Adv Health Sci Educ
    Theory Pract. 2021;26(2):683-711.
    [doi:10.1007/s10459-020-10000-3](https://doi.org/10.1007/s10459-020-10000-3)
14. van Merriënboer JJG, Sweller J. Cognitive load theory in health
    professional education: design principles and strategies. Med Educ.
    2010;44(1):85-93.
    [doi:10.1111/j.1365-2923.2009.03498.x](https://doi.org/10.1111/j.1365-2923.2009.03498.x)
15. Versteeg M, Hendriks RA, Thomas A, et al. Conceptualising spaced learning
    in health professions education: a scoping review. Med Educ.
    2020;54(3):205-16. [doi:10.1111/medu.14025](https://doi.org/10.1111/medu.14025)
16. Wisniewski B, Zierer K, Hattie J. The power of feedback revisited: a
    meta-analysis of educational feedback research. Front Psychol.
    2020;10:3087. [doi:10.3389/fpsyg.2019.03087](https://doi.org/10.3389/fpsyg.2019.03087)
17. Wood TJ. The effect of reused questions on repeat examinees. Adv Health
    Sci Educ Theory Pract. 2009;14(4):465-73.
    [doi:10.1007/s10459-008-9129-z](https://doi.org/10.1007/s10459-008-9129-z)
18. Young JQ, Van Merrienboer J, Durning S, Ten Cate O. Cognitive load
    theory: implications for medical education: AMEE Guide No. 86. Med Teach.
    2014;36(5):371-84.
    [doi:10.3109/0142159X.2014.889290](https://doi.org/10.3109/0142159X.2014.889290)

Autres sources :
- W3C. Web Content Accessibility Guidelines (WCAG) 2.2, 2023, critères 2.5.7
  et 4.1.3. <https://www.w3.org/TR/WCAG22/>
- Décret n° 2019-768 du 24 juillet 2019 relatif à l'accessibilité aux
  personnes handicapées des services de communication au public en ligne.
  <https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000038811937/>. Texte non
  consulté d'ici `[à vérifier]`.
- 360Learning, « Reactions ». <https://360learning.com/blog/reactions/>. Page
  bloquée par le proxy, fonction relevée par recherche web `[à vérifier]`.
- Qstream, « The Science ». <https://qstream.com/science/>. Relevé par
  recherche web : cofondé par B. P. Kerfoot.
