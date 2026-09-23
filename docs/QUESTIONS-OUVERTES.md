# Questions ouvertes — à trancher par le pharmacien responsable

L'inventaire complet des marqueurs, avec pour chacun où il s'affiche, ce qui
le porte et ce qu'il faut fournir pour le fermer : `docs/A-COMPLETER.md`.

Chaque point est marqué `[à préciser]` dans le code ou l'interface à l'endroit
exact où la donnée manque. Rien n'a été comblé par défaut : quand une valeur
a dû être posée pour que le squelette fonctionne, elle est nommée ici comme
telle. Ordre : ce qui change le déploiement en premier.

## A. Avant le déploiement effectif

1. **Référence « métrologie »** — tranché le 18/09/2026 : la console de
   vérification des enregistreurs (« Blocage série », `README_portage.md`).
   Décisions prises : signature = visas par clic + image du pharmacien
   incrustée (choix c) ; rapports = paquet d'archivage à la demande, registre
   CSV, écran Personnel (choix b) ; verrou et arbitrage = bande de garde,
   arbitrage motivé, non concluant, verrou signalement (choix c). Voir
   `docs/DECISIONS.md`. Restent les paramètres du point D.31.
2. **Conservation des rapports** (`CONSERVATION_RAPPORTS`) — mode
   `pseudonyme` requis en production par le choix c de la question 2 (circuit
   de visas enregistré). Durée — tranché le 18/09/2026 (question 5, choix d) :
   **aucune purge automatique**, conservation jusqu'à purge manuelle par
   l'administrateur (rapport par rapport, ou purge datée des rapports clos ou
   annulés, depuis `/admin/rapports`) ; `RAPPORTS_CONSERVATION_MOIS` reste
   facultatif pour annoncer une durée cible. RGPD — tranché le 18/09/2026
   (question 6, choix a) : **aucun nom en base**, identifiant d'agent généré
   par le site, correspondance tenue par le pharmacien hors du site, nom porté
   à l'édition seulement. Le traitement reste pseudonymisé, donc soumis au
   RGPD : fiche de registre et texte d'information rédigés (`docs/RGPD.md`,
   page `/donnees-personnelles`). **DPO : examiné le 19/09/2026**, principe
   validé — résultats conservés sous le seul numéro d'anonymisation, fichier
   de rapprochement tenu hors du site ; `CONSERVATION_RAPPORTS=pseudonyme`
   activé en conséquence. Restent `[à vérifier]` par le DPO : base légale,
   rattachement à la fiche « gestion du personnel », hébergeur et
   sous-traitance, analyse d'impact ; `[à compléter]` responsable de
   traitement, contact du DPO, trace écrite de l'avis, chemin et droits du
   fichier de rapprochement ; `[à préciser]` durée de référence de
   conservation. Ces points sont à clore avant la mise en service comme
   preuve, pas avant l'essai.
3. **Statut du dispositif** — tranché le 18/09/2026 (question 7, choix b) :
   **preuve opposable de l'étape 2** de l'habilitation en audit BPP 2023 /
   ISO 9001, jamais preuve d'habilitation. Le code porte la mention « document
   qualité » sur chaque écran et chaque rapport, la référence de la procédure
   interne (`PROCEDURE_HABILITATION`), des dates à l'horloge du serveur
   (ISO 8601 UTC dans les archives), l'empreinte, le registre et le journal.
   Reste hors du code : `[à compléter]` la référence de la procédure interne
   qui décrit le dispositif, le mode de signature par clic et le circuit de
   visas ; `[à vérifier]` la source de temps de l'hébergeur (comparer
   `horloge` de `/api/sante` à une référence de temps, avant la mise en
   service puis périodiquement) ; `[à préciser]` la durée de référence de
   conservation, alignée sur celle du dossier d'habilitation (point 2) ;
   `[à préciser]` sauvegardes (point 9) ; `[à préciser]` la codification du
   modèle de rapport dans le système documentaire (version du modèle).
4. **Hébergeur** — tranché le 18/09/2026 (question 8, choix a) : **Render**
   pour le service Node, région Francfort, plan payant exigé par le statut
   opposable (point 3) ; service créé à la main le 18/09/2026
   (<https://pharmatechx.onrender.com>), hors blueprint. **Base chez
   Supabase** depuis le 18/09/2026 (demande du pharmacien responsable),
   jointe en IPv4 par le pooler de session (`docs/DEPLOIEMENT.md`,
   « Supabase (base) »). Restent : `[à préciser]` la région du projet
   Supabase (Union européenne, Francfort recommandé) ; `[à vérifier]` dans
   les tableaux de bord que plans, variables (`DATABASE_URL` du pooler de
   session, `DATABASE_SSL=require`, `DATABASE_IP=4`) et contrôle de santé
   suivent `render.yaml` et `docs/DEPLOIEMENT.md` ; `[à vérifier]` API de
   données de Supabase coupée dans le tableau de bord (le schéma active RLS
   et retire les droits des rôles de l'API en plus) ; `[à vérifier]`
   identifiant du plan Render, pause du projet Supabase gratuit après
   inactivité, sauvegardes, certificat du pooler, restriction des adresses
   sortantes, les documentations n'étant pas joignables depuis
   l'environnement de travail ; `[à vérifier]` par le DPO : contrats de
   sous-traitance de Render et de Supabase, sous-traitants ultérieurs,
   transferts hors UE ; `[à préciser]` accord de la DSI (hébergement externe
   chez deux fournisseurs, nom de domaine, accès réseau, responsable des
   sauvegardes, titulaire du compte Supabase). Branche de production tranchée le
   18/09/2026 (question 21, choix c) : `production` porte la version en
   service, la branche de travail le reste, chaque mise en service étant une
   fusion et une étiquette `vN` ; `[à vérifier]` dans le tableau de bord, à
   la mise en service seulement, la branche déployée mise sur `production`
   (pendant l'essai, le site suit la branche de travail). Base d'essai et base en
   service tranchées le 18/09/2026 (question 23, choix b) : un seul projet
   Supabase, la base portant une étiquette d'instance que l'environnement doit
   réclamer (`BASE_ATTENDUE`) ; `[à vérifier]` à la mise en service que
   `/api/sante` donne `base_instance: "service"`. Vercel reste documenté en repli, non retenu ; l'hébergement
   interne est écarté. Constat du 18/09/2026 : service et base sur plans
   gratuits, donc phase d'essai (`MISE_EN_SERVICE` absente) ; `pg_dump`
   pendant l'essai, plans payants avant la mise en service.
5. **Rôle « pharmacien »** — tranché le 18/09/2026 (question 9, choix a) :
   pas de rôle distinct ; le visa du pharmacien responsable, la signature,
   l'annulation et la purge restent portés par tout code d'administration.
   `[à préciser]` la procédure interne réserve les codes d'administration au
   pharmacien responsable et à son suppléant ; un administrateur technique
   n'en détient pas.
6. **Règle des quatre yeux** — tranché le 18/09/2026 (question 12) : une
   question se valide par un autre code d'accès que son auteur courant
   (créateur ou dernier éditeur) ; la publication, le retrait et la
   modification d'un module publié sont réservés à l'administration. Réserve :
   deux codes distincts ne font pas deux personnes si des codes sont partagés,
   `[à préciser]` dans la procédure interne (un code par tuteur). Amendé le
   23/09/2026, à la demande : un code d'administration valide aussi les
   questions qu'il a écrites, validation tracée (`valide_par_auteur`,
   journal) ; le tutorat reste aux quatre yeux. `[à préciser]` la même
   exception pour un code de tutorat détenu par un pharmacien : le site
   connaît des rôles, pas des métiers.
7. **Accès au site et aux documents déposés** — tranché le 18/09/2026
   (question 13, choix b puis c) : tout le site est derrière un code de rôle
   dès qu'une base est configurée, les documents déposés compris ; seules la
   connexion, la page Données personnelles et la page de santé restent
   publiques. `[à préciser]` un store Blob, aux adresses publiques, est exclu
   tant que cette règle vaut ; `[à préciser]` un code de poste par agent ou
   par poste de travail (la procédure interne tranche).
8. **Hachage des adresses pour le limiteur de connexion** (5 échecs → 15 min,
   doublement) : `[à préciser]` seuils acceptés ?
9. **Sauvegarde** : sauvegardes de Supabase sur le plan Pro `[à vérifier]`
   (quotidiennes, rétention), aucune sur le plan gratuit `[à vérifier]` ;
   `pg_dump` par le pooler de session conservé dans l'établissement
   (`docs/DEPLOIEMENT.md`) ; tranché le 19/09/2026 (question 32) : la
   pièce de référence est le rapport visé classé au dossier d'habilitation,
   non la base ; la sauvegarde protège la continuité du service et la
   traçabilité d'ensemble. Régime : sauvegardes quotidiennes du plan Pro plus
   un `pg_dump` avant chaque mise en service, essai de restauration annuel en
   plus de celui qui précède le premier rapport réel. `[à préciser]`
   responsable du dépôt et support de conservation.

## B. Barèmes et règles d'évaluation

10. **Barème QIM** — tranché le 19/09/2026 (questions 34 et 35) : le barème
    des quiz de Flore, par défaut. Chaque proposition juste rapporte sa part
    (1/n), chaque proposition fausse la retire, **« je ne sais pas »** ne
    rapporte ni ne retire rien ; plancher 0, plafond 1. Une proposition
    laissée de côté vaut « je ne sais pas », mais reste une discordance : la
    question n'est pas juste, et une éliminatoire échoue. Réglable depuis
    `/admin/bareme`, avec les mêmes champs que les deux autres formats.
11. **Barème du schéma à compléter** — tranché le 19/09/2026 (question 34) :
    la même règle que les deux autres formats, légende par légende — juste
    +1/n, fausse −1/n, vide 0, plancher 0, plafond 1. Réglable avec les mêmes
    six champs ; le mode tout ou rien reste disponible.
12. **Éliminatoire sur un schéma** — tranché le 18/09/2026 (question 17,
    choix a) : toute légende fausse *ou vide* rend le critère non acquis ;
    règle fixe, non réglable (choix c écarté).
13. **Présentation des QIM** : Vrai/Faux par proposition (défaut) ou cases à
    cocher — à trancher avec les préparateurs (hérité).
14. **Mode entraînement** — tranché le 18/09/2026 (question 18, choix c) :
    conservé avant l'évaluation, mais les questions marquées **réservées à
    l'évaluation** n'y sont jamais posées, ni dans le tirage Découverte ; les
    tirages Habilitation et Complet les prennent en priorité, et le serveur
    refuse un tirage non conforme. `[à préciser]` par critère, le nombre de
    questions à réserver pour que le tirage en contienne une part utile
    (travail de rédaction).
15. **Tirages** : Découverte 5, Habilitation 10 (toutes éliminatoires
    incluses), Complet — tailles par défaut, **réglables** depuis
    `/admin/bareme`, le tirage d'habilitation ne descendant pas sous le
    minimum de questions ; `[à préciser]` tailles à retenir.
16. **Schéma, mode de réponse par défaut** : `[à préciser]` écrire (défaut) ou
    choisir dans la liste mélangée.

## C. Banque de questions et modules

17. **Statut à l'import** — clos par conséquence de la question 12
    (18/09/2026) : toute question importée entre « à vérifier », même avec
    corrigé complet, car la validation exige un second code d'accès et aucun
    n'est intervenu à l'import.
18. **Rédaction des modules** (les 56 textes restants) — tranché le
    18/09/2026 (question 10, choix a) : dans le code, par le pharmacien
    responsable ; aucun éditeur de texte en base. En complément, modules
    déposés depuis `/admin/modules` (présentation courte, profils, seuil,
    questions et documents rattachés). Publication, retrait et modification
    d'un module publié réservés à l'administration (question 12, point 6) ;
    `[à préciser]` un module déposé rattaché à un
    critère de la fiche s'ajoute à l'emplacement du critère sans le
    remplacer (choix posé).
19. **Marquage « O » des critères obligatoires** et **correspondance blocs ↔
    niveaux** — deux arbitrages hérités, toujours en attente.
20. **Axe « poste de travail »** : la fiche raisonne en filières et niveaux ;
    `[à préciser]` fournir des postes (isolateur A/B, préparatoire, réception…)
    ou rester en filières.
21. **Données locales des modules B1-01 et B1-04** : classes ISO local par
    local, composition des sas, fréquence de changement des gants, emplacement
    du kit de déversement, circuit de déclaration — `[à préciser]` (hérité).
22. **Procédures internes à rattacher** : CHD-FT1647, CHD-FT1645, CHD-FT482,
    PHAR-FT160, DSN-FT001… (hérité) — via l'écran Documents.
23. **Signalements anonymes** : depuis la question 13 (choix c), tout le
    site exige une session par code, un signalement provient donc toujours
    d'une session (au moins un code de poste) ; son contenu reste anonyme
    (motif fermé, note libre, aucun identifiant d'agent). Tranché le
    18/09/2026 (question 30, choix a) : **conservé ainsi**, tout code peut
    signaler — le poste est la principale source de retour sur la banque. Un
    signalement ouvert sur une question du tirage verrouille toujours les
    visas ; si un apprenant en usait pour retarder le visa de son propre
    rapport, le choix c (seul un signalement du tutorat verrouille) est la
    réponse mesurée, en réserve.

## D. Rapports enregistrés (si mode nominatif)

24. **Numérotation** `RAP-AAAA-NNNN` avec une séquence globale (non remise à
    zéro chaque année) — tranché le 19/09/2026 (question 31, choix a) :
    conservée. Un numéro identifie une pièce et n'en désigne jamais deux ; il
    ne compte pas la production de l'année, et `RAP-2027-0123` peut suivre
    `RAP-2026-0122`. Une remise à zéro annuelle ne se poserait qu'avant la
    mise en service.
25. **Purge** — tranché le 18/09/2026 (question 5, choix d) : manuelle par
    l'administrateur, jamais automatique ; seuls les rapports clos ou annulés
    sont purgeables, confirmation par recopie du numéro ou du mot PURGER,
    numéros consignés au journal.
26. **Logos** — tranché le 18/09/2026 (question 20, choix c) : incorporés en
    data URI dans chaque rendu du rapport, téléchargé par l'apprenant, imprimé
    depuis l'administration ou archivé dans le paquet ; le fichier reste
    lisible sans le site. À défaut de lecture, l'adresse du fichier sert.
    Logo de l'unité : **clos le 19/09/2026** (question 41, choix a), qui
    revient sur la question 24, choix b du 18/09/2026. L'emblème sert
    l'en-tête du site, l'en-tête du rapport A4 et l'icône d'onglet, tout de
    suite et non à la mise en service : l'empreinte SHA-256 ne couvre pas les
    logos, donc aucun rapport déjà émis n'est invalidé, et le repère de
    version est l'étiquette `vN` de la mise en service. Rien à reprendre sur
    la liste de mise en service, point 5.
27. **Sessions** — tranché le 18/09/2026 (question 16, choix b) : douze heures
    au plus, liées à leur code d'accès ; révoquer ou supprimer le code ferme
    ses sessions à la requête suivante, réactiver ne rouvre pas celles
    d'avant. Pas d'interrupteur global « fermer toutes les sessions » (choix c
    écarté) ; changer `AUTH_SECRET` en tient lieu.
31. **Paramètres de la décision** (`lib/decision.ts`) — **réglables** depuis
    `/admin/bareme` (question 10) : largeur de la bande de garde égale au
    poids d'une question du tirage (défaut ; 70 à 89 % pour un seuil de 80 %
    sur dix questions), ou une demi-question, ou une largeur fixe en points ;
    minimum de questions pour conclure (défaut 10) ; seuil de réussite par
    défaut (80 %) et seuil par module. `[à préciser]` les valeurs à retenir ;
    chaque résultat scellé garde le barème de son époque.
32. **Exclusions** — tranché le 18/09/2026 (question 19, choix b) : une
    question retirée de la banque après signalement est exclue du calcul, les
    exclusions étant fixées au premier acte de décision (arbitrage ou visa du
    tuteur) et jamais modifiées ensuite. Un retrait postérieur est signalé au
    pharmacien avant son visa et sur le rapport, avec la date et le score
    qu'aurait donné l'exclusion, à titre indicatif ; il ne bloque pas le visa
    (choix c écarté), le pharmacien vise ou annule en connaissance de cause.
33. **Arbitrage et visas** — tranché le 18/09/2026 (question 14, choix a) :
    la règle des quatre yeux du point 6 n'est pas étendue à l'arbitrage ni
    aux visas. Le site laisse un code d'administration, qui satisfait aussi
    l'exigence « tutorat », arbitrer, viser comme tuteur puis viser comme
    pharmacien le même rapport ; le rapport imprime le profil et le libellé
    du code de chaque acte. `[à préciser]` la procédure interne exige deux
    personnes pour les deux visas, le site ne le garantissant pas.
    Motif d'arbitrage tranché le 18/09/2026 (question 26, choix a) : **texte
    libre** obligatoire, de 10 à 1 000 caractères, ni liste fermée ni
    nomenclature. `[à préciser]` la procédure interne doit interdire d'y
    écrire un nom : le champ est libre, le dispositif est pseudonymisé, et
    aucun contrôle technique ne sait reconnaître un nom.
34. **Signature** : une image par code d'accès admin, réduite à 600 px de large
    par le navigateur (comme dans la console), conservée en base et non sur le
    poste ; donnée personnelle de plus à déclarer. Tranché le 18/09/2026
    (question 25, choix a) : **une seule image de signature**, celle du
    pharmacien responsable. Le visa du tuteur reste une mention en toutes
    lettres ; aucune image n'est collectée pour les tuteurs, une donnée
    personnelle de moins. Ajoutable plus tard sans rien défaire.
35. **Fichiers d'archivage** : CSV au séparateur « ; », UTF-8 avec marque
    d'ordre, dates lisibles en heure de Paris ; JSON complet ; zip sans
    compression. Destination tranchée le 19/09/2026 (question 33, choix b) :
    le paquet se classe au dossier d'habilitation, en GED ou sur le réseau,
    avec le rapport A4 — le dossier devient autonome et l'empreinte reste
    vérifiable sans la base. `[à préciser]` si la GED impose un format autre
    que le zip, ou refuse les fichiers non indexables.
36. **Identifiants d'agents** (question 6, choix a) : format `AG-NNN` généré
    par le site sur une séquence globale, jamais saisi ni réattribué ; clôture
    sans suppression ; créés et clos par un tuteur ou l'administrateur,
    tranché le 18/09/2026 (question 27, choix a) : réserver ces actes au
    pharmacien n'aurait rien protégé, le tuteur devant déjà savoir qui est
    l'agent pour viser son rapport ; la correspondance n'est donc pas connue
    du seul pharmacien. Fonction de l'agent tranchée le 18/09/2026
    (question 29, choix a) : portée à l'édition seulement, comme le nom, hors
    sceau et jamais enregistrée (champ « Fonction (facultatif) » du
    formulaire d'édition, ligne « Fonction et unité » du rapport). Une liste
    fermée en base (choix b) reste ouverte si la procédure exige que la
    qualité de l'évalué soit scellée : donnée personnelle de plus, anonymat
    rétréci dans une petite équipe, à porter au registre. Le nom porté à l'édition n'est pas couvert par le sceau : le
    lien identifiant ↔ personne repose sur la correspondance tenue hors du
    site, tranchée le 18/09/2026 (question 28, choix a) : un fichier du
    pharmacien responsable sur le réseau de l'établissement, dossier à droits
    restreints, lisible par les tuteurs qui visent, conservé et détruit avec
    le dossier d'habilitation. `[à préciser]` chemin, droits et qui les
    attribue.

## F. Parcours de formation (transposition du Lecteur QIM · QCM)

37. **Progression persistante** — tranché le 18/09/2026 (question 11,
    choix c) : conservée en base sous l'identifiant d'agent, sur rattachement
    de l'agent par son identifiant et un code personnel (4 à 8 chiffres,
    choisi par lui, haché ; réinitialisable par un tuteur : choix posé).
    Durée — tranché le 18/09/2026 (question 15, choix a) : aucune purge
    automatique ; purge manuelle par l'administrateur depuis Personnel, à la
    demande de l'agent ou à son départ, la clôture de l'identifiant ne
    l'entraînant pas ; `[à vérifier]` par le DPO que ce critère de durée
    suffit au registre. Restent : `[à vérifier]` par le DPO
    la nouvelle catégorie de données (`docs/RGPD.md`) et l'information des
    agents ; `[à préciser]` si un tuteur peut rattacher un agent à sa place
    (non : l'agent seul connaît son code) ; `[à préciser]` courbes
    d'évolution et historique par question (données présentes, affichage non
    fait).
38. **Évaluation transversale** (« session mixte » du site de Flore) : non
    transposée, un rapport couvrant un critère et un seul. `[à préciser]` si
    un tirage sur plusieurs critères est voulu pour l'entraînement seulement.

## E. Présentation

28. **Mode sombre** : décision antérieure « plus tard » (hérité).
29. **Imagerie des modules** (photo d'habillage au sas, schéma de cascade de
    pression) : à produire en interne (hérité).
30. **PandaSuite** : la page de référence n'était pas accessible depuis
    l'environnement ; les fonctions ont été relevées sur les pages indexées.
    `[à préciser]` fonctions attendues qui manqueraient : embranchements de
    scénario, vidéo interactive, export SCORM.

39. **Tutoriel d'usage du site** (soulevé le 19/09/2026 avec la question 37) :
    il n'en existe aucun. `/reperes` explique le **dispositif d'habilitation**,
    pas le maniement de l'outil. `[à préciser]` destinataire (poste, tutorat,
    les deux) et contenu attendu : première connexion, passation d'une
    évaluation, dépôt d'une question, visa d'un rapport. Tant que rien n'est
    précisé, aucune page « tuto » n'est écrite — un tutoriel inventé serait
    faux dès la première capture.

40. **Accès rapide — deux points laissés ouverts à la construction** (paquet A,
    21/09/2026 ; détail au § 9.3 de `docs/ACCES-RAPIDE.md`).
    `[à préciser]` le raccourci `⌘K` / `Ctrl+K` entre-t-il en conflit avec un
    usage établi des postes du CHD ? Le hamburger et la touche `/` ouvrent le
    même panneau : le raccourci n'est pas une condition d'usage, il se retire
    en une ligne s'il gêne.
    `[à préciser]` **fréquence réelle des tâches.** L'ordre des quatre items de
    la file d'attente est un classement raisonné, pas une mesure. Une semaine
    de `/admin/journal`, qui enregistre déjà les actions par rôle, le
    confirmerait ou le corrigerait. L'ordre reste **invariant** dans
    l'intervalle : le réordonner au fil de l'usage détruirait la mémoire
    spatiale qui fait tout le gain de vitesse (Mitchell & Shneiderman 1989).

41. **Suppression de son propre code d'administration** — tranché le
    21/09/2026 : le code de la session en cours ne se supprime pas. Refus
    côté serveur avant toute confirmation, contrôle affiché mais inactif avec
    son motif. Pour supprimer ce code-là, ouvrir une session avec un autre
    code d'administration. La variante « refuser seulement le dernier
    administrateur actif » a été écartée : elle laisse le verrouillage
    possible dès qu'un second code admin existe mais n'est plus détenu par
    personne.

42. **Révocation de son propre code** — tranché le 21/09/2026 (choix a) :
    soumise à la même confirmation par code que la suppression, sans être
    interdite. Révoquer le code d'un autre reste d'un clic. Corrigé au
    passage : l'action de bascule ne revérifiait pas le rôle de la cible.

43. **Visibilité du dépôt** — tranché le 22/09/2026 (choix a) : le dépôt passe
    en privé avant d'accueillir le contenu des portfolios de l'unité (85
    références de documents qualité, numéros de poste, boîtes aux lettres du
    service, itinéraire d'accès à la zone de production, effectifs, horaires).
    Le geste appartient au titulaire du dépôt ; aucun outil de la session ne
    change une visibilité. `[à vérifier]` la connexion Render survit-elle au
    changement sans réautorisation de l'accès GitHub.

44. **Axe métier** — tranché le 22/09/2026 (choix c) : un vivier unique de
    critères, chacun portant les métiers auxquels il s'applique et, par
    métier, son niveau, son caractère obligatoire et le libellé de sa fiche
    d'origine. Un même texte de formation sert les quatre métiers. Le
    détail et les contre-arguments sont dans `DECISIONS.md`.

45. **Bloc « Encadrement et référent »** — tranché le 22/09/2026 (choix b) :
    ramené au seul critère que les fiches portent, la participation à la
    formation d'au moins un préparateur. Les cinq autres ne figuraient dans
    aucune des quatre fiches officielles, et l'un faisait doublon avec B3-09.
    Le reste de ce qu'exige le niveau référent (100 % des critères
    inférieurs, ancienneté) est une condition d'éligibilité, pas un critère
    évaluable : une ancienneté ne se mesure pas par QCM. 58 critères → 53.

46. **Codes de niveaux qui se répètent d'un métier à l'autre** — ouvert le
    22/09/2026, conséquence du choix c en question 44 ; tranché le
    23/09/2026 (choix a) : préfixe sur les seuls nouveaux métiers — `PH-`
    pharmacien/interne, `AP-` aide en pharmacie, `AE-` agent d'entretien —,
    le préparateur gardant `N1a` à `N3`. Rien d'existant n'est renommé.
    Écartés : le préfixe partout, qui renommait les codes déjà cités
    (codes d'accès, modules, réglages, documents, prérequis) quand les
    rapports scellés garderaient l'ancien ; les mêmes codes dans chaque
    métier, qui obligeait chaque rattachement à porter aussi le métier.
    Détail dans `DECISIONS.md`.

62. **Tirage : niveau cible du profil et questions signalées** — demandé le
    23/09/2026 : « piocher dans les questions de la banque un nombre de
    questions à définir dans le barème, piochées au hasard, correspondant à
    la cible du niveau du profil et du module à valider ; exclure les
    questions de ce fait signalées ». Existant : le nombre est déjà réglé au
    barème (Tirages : Découverte 5, Habilitation 10 par défaut, jamais sous
    le minimum pour conclure ; Complet : toute la banque) ; le tirage se fait
    au hasard dans la banque du module à valider — celui que le niveau cible
    du profil met au programme —, les éliminatoires toujours posées, les
    réservées en priorité ; une question signalée n'en est pas écartée ; le
    niveau de la question (initial, intermédiaire, avancé) ne joue pas,
    décision du 22/09/2026 (question 51). Posée le 23/09/2026. Dans tous les
    cas : une question au signalement ouvert est écartée de tout tirage,
    évaluation et entraînement, jusqu'à la clôture du signalement, le
    serveur appliquant la même règle. En plus : plafond de niveau selon le
    niveau cible, réglé au barème, les questions « à préciser » tirées pour
    tous (a) ; répartition des niveaux selon le niveau cible, réglée au
    barème (b) ; aucun filtre de niveau, décision du 22/09 maintenue (c).

61. **Accès rapide : position et ouverture** — demandé le 23/09/2026 :
    « pour le menu d'accès rapide, revoit le positionnement et le mode
    d'ouverture pour qu'il limite la gêne de la lecture de la fenêtre en
    dessous ». Existant : sur poste (à partir de 62 rem de large), panneau
    de 34 rem centré en haut de l'écran, sur un voile qui assombrit toute la
    page (38 %), le panneau lui-même en verre flouté ; sur téléphone, tiroir
    à gauche. Dans les deux cas, la tabulation reste dans le panneau et
    Échap le ferme (`docs/ACCES-RAPIDE.md`). Posée le 23/09/2026 : tiroir à
    gauche partout, à la place du volet, sans voile sur la colonne de
    lecture (a) ; panneau déroulant sous le bouton Menu, sans voile, fermé
    au clic dehors (b) ; panneau centré gardé, sans voile ni flou (c).

60. **Signalement d'une fiche de synthèse défectueuse** — demandé le
    23/09/2026 : « idem pour les fiches de synthèse, pouvoir les signaler si
    défaut ». Existant : le signalement ne porte que sur une question — motif
    fermé, note libre, rien qui désigne la personne ; il se traite dans
    l'écran Signalements ; un signalement ouvert sur une question du tirage
    verrouille les visas du rapport, parce que la note peut en dépendre. Une
    fiche, elle, est montrée après la correction : elle ne pèse pas sur la
    note. Posée le 23/09/2026 : même circuit que les questions, sans effet
    sur les rapports — bouton sous chaque fiche, motifs propres, écran
    Signalements, mention sur la fiche (a) ; a, et un signalement ouvert
    verrouille les visas des rapports qui citent la fiche (b) ; a, et la
    fiche est retirée aux apprenants tant que le signalement est ouvert (c).
    Tranchée le même jour (choix a, réponse « À » lue comme a) et mise en
    œuvre : motifs propres, écran Signalements, signalements ouverts sur la
    fiche dans la banque, version corrigée repartie « à vérifier ». Détail
    dans `DECISIONS.md`.

59. **Fiche de synthèse et validation du module** — demandé le 23/09/2026 :
    « pouvoir intégrer à la validation du module une fiche de synthèse que
    l'on pourrait déposer dans la banque et relier à la validation du
    module ». Existant : une fiche de synthèse est un document de nature
    « Fiche de synthèse », déposé depuis Administration → Documents et
    rattaché à un module ; elle s'affiche en fin de test et en fin
    d'entraînement, dès son dépôt, sans validation par un autre code ; le
    rapport d'évaluation ne la cite pas ; la banque de questions n'offre pas
    de dépôt de fiche. Posée le 23/09/2026 — ce que « validation du module »
    désigne : la validation du contenu par le tutorat — fiche déposée depuis
    la banque du module, « à vérifier », montrée seulement une fois validée,
    citée par le rapport (a) ; la validation par l'apprenant — fiche montrée
    dès le dépôt, lecture attestée par l'apprenant, citée par le rapport avec
    l'attestation (b) ; les deux (c). Le signalement d'une fiche défectueuse
    viendra ensuite. Tranchée le même jour (choix a, réponse « À » lue
    comme a) ; mise en œuvre avec la question 60 : dépôt et validation aux
    quatre yeux depuis la banque, seules les fiches validées montrées, fiche
    citée par le résultat scellé et le rapport. `[à vérifier]` le nombre de
    fiches déjà déposées en production, restées montrées « validées
    d'office ». Détail dans `DECISIONS.md`.

58. **Dépôt de questions : QIM et QCM mêlés** — suite de la question 57,
    même demande (« attention, possibilité de mélange QIM / QCM »). Vérifié
    par un essai le 23/09/2026 :
    - un dépôt écrit au format — mot-clé « QCM n. » ou « QIM n. » devant
      chaque question, comme l'écrivent les deux prompts — est déjà lu
      question par question ;
    - sans mot-clé, toutes les questions prennent le format par défaut ; les
      intertitres « QCM » et « QIM » sont ignorés ;
    - un QCM « lesquelles sont fausses ? » déposé en QIM garde pour vraies
      ses lettres à cocher, qui sont les propositions fausses : son corrigé
      est lu à l'envers, sans avertissement ;
    - une QIM déposée en QCM est notée tout ou rien, et s'affiche en boutons
      radio si son énoncé ne dit pas « plusieurs » ; l'analyse n'avertit que
      si elle a plusieurs propositions vraies, ou aucune ;
    - un intertitre collé à la dernière proposition, sans ligne vide,
      s'ajoute au texte de cette proposition.
    Posée le 23/09/2026. Dans tous les cas : format de chaque question
    affiché et modifiable dans l'aperçu, mot-clé exigé sur chaque question
    par le prompt de mise en forme. En plus : intertitre reconnu et énoncé
    lu — format proposé d'après l'énoncé quand ni mot-clé ni intertitre ne
    le disent, contradiction signalée sinon (a) ; intertitre seulement (b) ;
    rien de plus (c). Tranchée le même jour (choix a) et mise en œuvre avec
    la question 57 : intertitres lus et plus jamais collés à une
    proposition, format proposé d'après la consigne, alertes recalculées à
    chaque changement de format dans l'aperçu — dont le corrigé à l'envers.
    Détail dans `DECISIONS.md`.

57. **Dépôt de questions : module de chaque question, plusieurs modules par
    dépôt** — demandé le 23/09/2026 : « détection de module lors du dépôt,
    possibilité d'avoir plusieurs modules concernés par le même dépôt
    (proposition) ; attention, possibilité de mélange QIM / QCM ». Existant :
    un dépôt se rattache à un seul module, choisi dans une liste ; une ligne
    « Module : … » dans le texte est ignorée sans avertissement ; le format
    vient du mot-clé « QCM n. » ou « QIM n. » de chaque question, sinon du
    format par défaut, appliqué à toutes — un intertitre « QIM » ne change
    rien. Sur les 53 modules du code, 2 sont rédigés ; les autres n'ont qu'un
    titre et un objectif générique. Posée le 23/09/2026 : comment le module
    de chaque question est reconnu — ligne « Module : » écrite dans le texte,
    puis proposition du site d'après les mots du titre, confirmée dans
    l'aperçu (a) ; ligne seulement, sinon module par défaut (b) ; proposition
    seulement (c). Le mélange QIM / QCM viendra ensuite. Tranchée le même
    jour (choix a) ; mise en œuvre avec la question 58. Lecture retenue,
    sans objection : une question reste rattachée à un seul module, un dépôt
    en sert plusieurs. La proposition est prudente : aucune erreur sur 55
    questions d'essai, mais 24 laissées « à choisir » tant que les modules
    n'ont qu'un titre. Détail dans `DECISIONS.md`.

56. **Ordre « à la carte pour un utilisateur »** — suite de la question 55,
    posée et tranchée le 23/09/2026 (choix a) : un ordre propre à un
    apprenant, attaché à son identifiant, sur les modules de son profil, sans
    mention « dégradé » ; il passe avant l'ordre du profil quand l'apprenant
    est rattaché, et se purge avec sa progression. Écartés : le programme à
    la carte ouvert sur un identifiant (b), un code de poste par personne
    (c). Détail dans `DECISIONS.md`.

55. **Ordonnancement par profil de poste et niveau cible** — demandé le
    23/09/2026 : « un ordonnancement par profil de poste et par niveau cible ;
    à la carte pour un utilisateur ; après sélection du profil et du type de
    parcours, choix limité aux modules accessibles, rangés en glissant ou par
    numérotation chronologique ». Existant : un seul ordre par parcours
    (Intégration, Maintien), saisi en liste d'identifiants ; à l'accueil, les
    modules sont regroupés par bloc de la fiche et l'ordre ne joue qu'à
    l'intérieur d'un bloc ; les programmes à la carte (question 50) sont
    affichés en liste numérotée. Posée et tranchée le 23/09/2026 (choix a) :
    un profil qui a son ordre voit à l'accueil une chronologie unique
    numérotée, socle et filière mêlés ; les autres gardent les blocs. Ordre
    fixé par filière, niveau cible et parcours, en glissant, aux flèches ou
    au numéro. Détail dans `DECISIONS.md`. L'ordre « pour un utilisateur » :
    question 56.

54. **Signalement des questions erronées ou à réviser** — demandé le
    23/09/2026 « s'il n'existe pas » ; vérifié : il existe (question 30).
    Tranché le même jour (choix a + b) : écran du tutorat corrigé (statut
    accentué, module nommé, énoncé des questions du code), motif « À mettre à
    jour (référence ou pratique périmée) », signalements ouverts marqués sur
    la liste et la fiche de la question. « Rejeter », qui enregistrait
    « traité », corrigé au passage. Détail dans `DECISIONS.md`.

53. **Source des échelles des trois autres métiers** — posée le 23/09/2026
    sous le libellé « 47 bis », tranchée le même jour (choix b, après un
    premier choix a retiré avant tout travail) : saisies au Référentiel. Le
    métier est porté par la filière déposée et hérité par ses niveaux, dont
    le code reçoit le préfixe du métier (question 46). Rien des fiches
    n'entre dans le dépôt. Détail dans `DECISIONS.md`.

47. **Périmètre du site dans la chaîne d'habilitation** — tranché le
    22/09/2026 (choix a) : le site reste aux étapes 1 et 2. Le portfolio —
    étapes 3 et 4, trois états Vu / En cours / Acquis, double colonne
    doublon / autonomie — reste sur le papier. Le rapport du site alimente la
    colonne « Outils / Preuve de compétence » de la fiche. Conséquence
    assumée : les références de documents qui ne servent qu'une ligne de
    portfolio n'entrent pas dans le site ; celles qui documentent un critère
    couvert par un module se rattachent depuis `/admin/documents`.
    `[à préciser]` la part des 85 références concernée, tant que le
    rattachement n'est pas fait.

48. **Mention de preuve pour la colonne « Outils / Preuve de compétence »** —
    tranché le 22/09/2026 (choix b) : mention composée de six segments
    (outil, numéro, date, module, score, verdict), bouton de copie sur la
    page du rapport et dans la liste. Seul un rapport clos en donne une ;
    l'empreinte n'y figure pas, elle se lit sur le rapport. Sans mise en
    service, la mention porte d'abord « Phase d'essai — ne vaut pas preuve ».

49. **Réévaluation à 24 mois** — tranché le 22/09/2026 (choix b) : le site
    affiche l'**ancienneté** du dernier quiz validé (rapport clos) par agent
    et par module, et une file « Quiz de plus de 24 mois » dans le volet du
    tutorat. Il ne prononce **aucune échéance** : les deux ans courent depuis
    l'habilitation du pharmacien, étape 5, hors du site.

50. **Parcours dégradé** — tranché le 22/09/2026 : le construire (choix b),
    sous la forme demandée — « pour un profil dégradé, un programme de modules
    à la carte validé par le tuteur ou l'admin ». Programmes nommés,
    composés module par module dans l'ordre voulu, avec un motif, validés par
    un code de tutorat ou d'administration, marqués « parcours dégradé »
    partout ; un code de poste peut s'ouvrir dessus. Modifié, un programme
    repasse en brouillon. Ma recommandation (abandonner, la fiche portant déjà
    « 1a+1b ou 1a+1c ») n'a pas été retenue. Détail dans `DECISIONS.md`.

51. **Niveau des questions** — tranché le 22/09/2026 : trois niveaux, initial,
    intermédiaire et avancé, pour toutes les questions, en champ de la banque
    (étiquette, filtre, éditeur, dépôt), dans le vocabulaire des prompts.
    Sans effet sur les tirages. Les questions sans niveau restent « à
    préciser », y compris les 14 des deux modules rédigés.

52. **Schéma à caches corrigé par le tuteur** — tranché le 22/09/2026 (choix
    b) : troisième mode du schéma, « découvrir ». En évaluation, le tuteur
    présent juge chaque cache et confirme par son propre code (tutorat ou
    administration, jamais le code de la session) ; le résultat est scellé en
    une fois avec la mention du code qui a jugé. En entraînement,
    l'apprenant se juge seul, sans code. Un cache non jugé compte sans
    réponse. Un résultat d'entraînement ne s'émet plus en rapport. Détail
    dans `DECISIONS.md`.
