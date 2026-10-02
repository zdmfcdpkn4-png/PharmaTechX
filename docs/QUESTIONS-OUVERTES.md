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
    attribue. Modèle du fichier fourni le 28/09/2026 (question 83, choix a) :
    `docs/modeles/table-correspondance-agents.xlsx`.

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

91. **Accueil après connexion : quelle forme** — posée le 02/10/2026, sur
    « Il manque une page d'accueil qui s'affiche après la connexion qui
    pourrait être centrale en une organisation schématique et ludique du
    site utilisant des images sans trop de texte pour appeler les grandes
    fonctionnalités du site ? Fais-moi des propositions (ne remplace pas le
    bandeau menu et l'accès rapide) », avec quatre autres demandes : les
    arborescences toujours repliées, des introductions d'une ou deux
    phrases, les fonctions stratégiques reclassées dans les menus, des
    filtres et des listes déroulantes sur toutes les listes.

    Constat, sur la base de test locale, à 390 et 1 280 px :
    - l'administration et le tutorat arrivent sur « Accès » (tuiles, mode
      test, codes), soit 4,2 écrans de haut sur téléphone ;
    - l'agent arrive sur le programme, 9,2 écrans ;
    - aucun écran ne montre d'un coup d'œil les grandes fonctions.

    Proposition publiée sur claude.ai, privée : maquettes, menus avant et
    après, introductions réécrites. Dans les trois formes :
    - une page nouvelle après la connexion, pour tous les profils, chacun
      la sienne ;
    - bandeau, menu et accès rapide inchangés ; le programme garde son
      adresse ;
    - les chiffres sont ceux de « À faire » ;
    - les images sont les médaillons du site, légendées ;
    - « valider un module ne vaut pas habilitation » reste dit.

    Les trois formes :
    - **a (recommandé)** : le chemin. L'agent suit ses six étapes
      d'habilitation, les étapes 3 à 6 grisées. Le tutorat et
      l'administration suivent le circuit d'une question et d'un rapport
      (déposer, vérifier, publier, former, viser, suivre), avec ce qui
      attend à chaque arrêt. Contre : plus haut qu'une grille ; codes
      d'accès, Squelette, Réglages et Repères, qui ne sont pas des étapes,
      vont dans une rangée à part.
    - **b** : les tuiles. Une grille d'images légendées, une par grande
      fonction, et en tête ce qui attend. Contre : ni l'ordre des étapes ni
      le « 2 sur 6 » ne s'y voient ; elle redit en partie l'accès rapide.
    - **c** : la carte. Les grandes parties du menu en étoile autour d'un
      centre. Contre : la plus gourmande en place ; sur téléphone, elle
      redevient une grille sans ses traits.

    Dans les trois cas, les quatre autres points suivent la proposition,
    sauf avis contraire, en trois lots : arborescences et introductions,
    puis accueil et menus, puis filtres.
    - **Menus.**
      - « Accueil » en tête.
      - « Accès » devient « Codes d'accès » et rejoint un sous-menu
        « Équipe », avec « Personnel ».
      - « Journal » passe à Suivi.
      - « Tester en apprenant » passe à Modules, sur sa propre page.
      - « Dépôt documents » devient « Documents ».
      - Réglages garde Barème et Signature ; vide pour le tutorat, il
        quitte son menu.

      Ne changent pas : l'ordre des sous-menus, Squelette (question 81) et
      « Signalées » (question 89).
    - **Introductions.**
      - Une ou deux phrases en tête de 24 écrans, de 1 440 à 639 mots
        comptés sur le texte affiché.
      - Une règle utile au moment d'agir passe sous son bouton.
      - « Valider un module à l'écran ne vaut pas habilitation » reste sur
        le programme, l'évaluation et les Repères.
      - Le texte de formation des modules n'est pas touché.
    - **Arborescences.**
      - Repliées à l'arrivée, filtre actif compris : banque, couverture,
        Mes modules, programme d'une filière, programme à la carte,
        « aussi posée dans ».
      - Une branche ouverte le reste pendant la session.
      - Au retour d'un geste, la branche où l'on travaillait se rouvre.
      - Le menu n'est pas touché.
    - **Filtres.** La barre de la banque (recherche, listes déroulantes,
      « Plus de filtres », nombre retenu, « Tout effacer », filtres gardés
      dans l'adresse) sur ces écrans :
      - Codes d'accès, Rapports, Signalements, Modules, Documents ;
      - Personnel, Programmes à la carte, Mises en situation ;
      - Rattachement des modules, Filières et Niveaux ;
      - le programme complet des Repères ;
      - Pilotage et Statistiques.

    Pour écarter ou changer un point (une entrée de menu, une phrase),
    dites lequel.

    Tranchée le 02/10/2026 (choix a, réponse « À », valant « a »), mise en
    œuvre en trois lots. Lot 1, fait : les six arborescences s'ouvrent
    repliées, filtre compris, et une branche ouverte le reste le temps de
    la session ; les introductions de 22 écrans tiennent en une ou deux
    phrases, et ce qui servait au moment d'agir est passé sous le champ
    concerné. Lot 2, fait : après la connexion, chaque profil arrive sur
    son accueil — le chemin de l'agent (six étapes, les quatre hors du site
    grisées), le circuit du tutorat et de l'administration (six arrêts,
    comptés comme « À faire ») ; « Accueil » ouvre le menu, « Équipe »
    réunit codes d'accès et personnel, le journal passe à Suivi, « Tester
    en apprenant » à Modules sur sa propre page, « Dépôt documents »
    devient « Documents », Réglages quitte le menu du tutorat. Lot 3
    (filtres) à suivre. Détail dans `DECISIONS.md`.

90. **Lot 3 de la refonte de la banque : lesquels faire** — posée le
    02/10/2026, après la question 89 (choix a), qui laissait le lot 3 à un
    choix point par point. Six points, aucun commencé :
    1. pages d'erreur à la charte ;
    2. la même barre de filtres sur Pilotage et Statistiques ;
    3. en-têtes plus courts sur téléphone ;
    4. un filtre pour le journal ;
    5. un repli opaque quand le système demande moins de transparence ;
    6. une remise en ordre des jetons du CSS.

    Constaté depuis le lot 1 : un geste en lot écrit une ligne au journal
    par question, et l'écran du journal ne montre que les 300 dernières
    actions. Valider les 53 questions du pool en prend 53.
    - **a (recommandé)** : le filtre du journal seulement (point 4) : par
      action, par date, par question, au-delà des 300 dernières. Contre :
      les cinq autres restent en attente.
    - **b** : les points 2, 3 et 4, ceux qui se voient chaque semaine.
      Contre : trois chantiers d'un coup sur des écrans qui marchent ;
      Pilotage et Statistiques ont leurs propres filtres, à reprendre.
    - **c** : aucun pour l'instant. Contre : le journal se lira de plus en
      plus mal à mesure des gestes en lot.

    Pour un autre assortiment, donnez les numéros.

    Tranchée le 02/10/2026 (choix a, réponse « À », valant « a ») et mise
    en œuvre : le journal se filtre par action, par période en jours de
    Paris et par cible, et se lit page après page, 300 lignes par page,
    au-delà des 300 dernières. Une action ou une cible du tableau filtre
    sur elle ; chaque question de la banque mène à ses lignes, pour
    l'administration. Les points 1, 2, 3, 5 et 6 ne sont pas faits.
    Détail dans `DECISIONS.md`.

89. **Reclasser plusieurs questions d'un coup : que devient une question
    validée** — posée le 01/10/2026, sur « Faire en sorte dans la gestion des
    questions de pouvoir sélectionner plusieurs questions de la banque pour
    les reclasser simultanément et pour pouvoir les sélectionner pour
    plusieurs module. Améliore le système de filtre et le menu […] », avec
    un prompt de refonte de tableau de bord, à « proposer avant d'agir ».

    **Reposée le 02/10/2026**, après la question 88 (choix a). Le
    reclassement en lot existe désormais (« Classer dans un module »), avec
    la règle actuelle : une validée reclassée repasse « à vérifier », et
    celui qui la classe devient son auteur courant. Les 22 questions du pool
    sont « à vérifier » : la réponse ne change rien pour elles. Elle décide
    de la règle des questions validées, pour le reclassement déjà fait et
    pour les gestes qui restent au lot 1 (poser aussi dans, niveau, statut).
    - **a (recommandé)** : la règle ne change pas. Contre :
      - deux temps à chaque reclassement d'une validée ;
      - elle sort des tirages jusqu'à sa revalidation ;
      - un tuteur ne revalide pas ce qu'il a lui-même reclassé.
    - **b** : les gestes en lot gardent le statut, le contenu ne changeant
      pas ; chaque changement est tracé au journal, avant et après. Contre :
      cela déroge à la question 74, et une question validée pour un module
      peut être posée à d'autres agents, ailleurs, sans second regard.
    - **c** : le niveau et « aussi posée dans » gardent le statut ; changer le
      module d'origine, c'est-à-dire reclasser, remet « à vérifier ». Contre :
      deux règles à retenir, et ajouter un module expose quand même la
      question à d'autres agents sans second regard.

    Sauf réserve de votre part, une réponse vaut accord pour la suite du lot
    1 et pour le lot 2. Le lot 3 attend un choix point par point.

    Tranchée le 02/10/2026 (choix a, réponse « 89 à », « à » valant « a »)
    et mise en œuvre : la règle ne change pas. Classer, poser aussi dans,
    retirer d'un module et changer le niveau en lot remettent une validée
    « à vérifier », celui qui agit devenant son auteur courant ; le statut
    en lot suit les boutons de chaque question, quatre yeux question par
    question. Sans réserve, la suite du lot 1 et le lot 2 sont faits ; la
    suppression en lot, proposée à part, ne l'est pas. Le lot 3 fait
    l'objet de la question 90. Détail dans `DECISIONS.md`.

    **Première version, du 01/10/2026**, avec le détail des lots. Proposé le
    même jour ; rien n'est modifié avant accord.
    - **Lot 1, actions en lot.** Une case par question, dans l'arborescence
      et dans la liste, et une par module. « Tout sélectionner » ne prend que
      ce que montrent les filtres. Une barre d'actions :
      - classer dans un module (le module d'origine) ;
      - poser aussi dans plusieurs modules, ou retirer d'un module ;
      - changer le niveau ;
      - changer le statut, la règle des quatre yeux jouant question par
        question.

      L'effet est chiffré avant d'appliquer, et chaque question garde sa
      ligne au journal. La suppression en lot, réservée à l'administration,
      est proposée à part : elle servirait la question 88 a. (Note du
      02/10/2026 : la question 88, reposée, ne demande plus d'effacer ; c'est
      le reclassement en lot qui la servirait.)
    - **Lot 2, filtres et menu.**
      - Recherche dans l'énoncé, les propositions, la justification et
        l'identifiant.
      - Trois filtres visibles, les autres repliés ; deux filtres nouveaux,
        par dépôt et par signalement ; les filtres actifs en puces ; un tri.
      - Présentation resserrée, et couverture de la vue Liste repliée.
      - « À vérifier » et « Signalées » au menu.
    - **Lot 3, au choix, point par point.**
      - Pages d'erreur à la charte.
      - La même barre de filtres sur Pilotage et Statistiques.
      - En-têtes plus courts sur téléphone.
      - Un filtre pour le journal.
      - Un repli opaque quand le système demande moins de transparence.
      - Une remise en ordre des jetons du CSS.
    - **Écarté du prompt**, le verre dépoli clair aux couleurs de la charte
      restant tel quel : le fond sombre bleu nuit et violet, Tailwind, une
      bibliothèque de graphiques, la translation au survol, les squelettes de
      chargement et les données inventées.

    Constaté dans le code : toute modification d'une question, rattachements
    et niveau compris, la remet « à vérifier » et fait de celui qui
    enregistre son auteur courant (questions 12 et 74). Une action en lot
    suit cette règle, ou en change. Relevé en passant, à corriger avec le
    lot 1 :
    - « Retirer l'illustration » ne retire rien d'une question existante ;
    - « Nouvelle question » annonce un statut « validée » que le serveur
      refuse depuis la question 12.

    Trois lectures :
    - **a (recommandé)** : la règle ne change pas. Reclassée, la question
      repart « à vérifier ». « Valider » en lot la revalide d'un geste :
      par un autre code, ou par l'administration, tracé « validée par son
      auteur ». Contre :
      - deux temps à chaque reclassement ;
      - les questions reclassées sortent des tirages jusqu'à leur
        revalidation ;
      - un tuteur ne revalide pas ce qu'il a reclassé.
    - **b** : le reclassement garde le statut, puisque le contenu (énoncé,
      propositions, corrigé, justification) ne change pas. Chaque changement
      est tracé au journal, avant et après. Contre : cela déroge à la
      question 74, et une question validée pour un module peut être posée à
      d'autres agents, ailleurs, sans second regard.
    - **c** : le niveau et « aussi posée dans » gardent le statut ; changer
      le module d'origine remet la question « à vérifier ». Contre : deux
      règles à retenir, et ajouter un module expose quand même la question à
      d'autres agents sans second regard.

    Sauf réserve de votre part, une réponse vaut accord pour les lots 1 et
    2. Le lot 3 attend un choix point par point.

88. **Banque du pool en ligne : 22 questions dans le mauvais module** —
    posée le 01/10/2026, reposée le 02/10/2026 sur « Repose les questions 88
    et 89 une par une ».

    **Reposée le 02/10/2026.** La première version, plus bas, est dépassée :
    le 01/10 à 23 h 44, le Word a été redéposé et les 37 anciennes questions
    effacées. Constaté le 02/10, en lecture seule, dans la base en ligne :
    - Le contenu est juste :
      - 53 questions, toutes « à vérifier », jamais modifiées ;
      - corrigés, niveaux et formats identiques au Word ;
      - une justification sous chacune des 265 propositions ;
      - les 6 illustrations (5 KIMO et le Duoperf) ;
      - aucune n'est aussi posée ailleurs, ni signalée.
    - 22 questions sont dans le mauvais module :
      - les 9 dernières du module 2 (questions 9 à 17 du Word, de « règles
        d'hygiène et de tenue en ZAC » à la QIM « bris de flacon sous
        isolateur ») sont dans le module 3 ;
      - les 13 du module 6 (questions 41 à 53, circuit de la préparation)
        sont dans le module 4, le module 6 n'existant pas en ligne.
    - Cause : le dépôt ne reconnaît aucun en-tête « Module N — … » du Word,
      aucun titre de module en ligne ne commençant ainsi (« Pool de
      manipulation - (Module N) »). Les 53 questions arrivent « à choisir »,
      et l'aperçu fait choisir le module de chacune. Les modules 2 et 3
      parlent tous deux d'hygiène.
    - Validées en l'état, les 22 seraient tirées dans l'évaluation du
      mauvais module. Les 31 autres sont à leur place.

    Préalable commun : créer le module 6 à l'écran (filière du pool, N2R).
    - **a (recommandé)** : les reclasser en deux gestes avec la sélection
      multiple (question 89, lot 1), une fois en ligne : les 9 vers le module
      2, les 13 vers le module 6. Elles sont « à vérifier » : la règle que
      tranche la question 89 ne change rien pour elles. Contre : attendre que
      le lot 1 soit fait et redéployé.
    - **b** : les déplacer maintenant, une à une, dans l'éditeur
      (« Modifier », module, « Enregistrer »), 22 fois. Contre : 22 gestes,
      avec le risque d'erreur qui a produit la situation actuelle.
    - **c** : je les déplace dans la base par un script, d'après la
      correspondance établie le 02/10 : le module seul, et une ligne au
      journal pour chacune. Contre : écriture directe en production, hors de
      l'écran ; exige « fais-le dans la base ».

    Hors question, sauf avis contraire : le dépôt reliera « Module 2 — … » au
    seul module dont le titre contient « Module 2 » ; si plusieurs modules
    répondent, la question reste à choisir. Cela ne touche que les dépôts à
    venir.

    Tranchée le 02/10/2026 (choix a, réponse « A pour la question 88 ») et
    mise en œuvre : sélection multiple dans la banque et « Classer dans un
    module » ; dépôt qui relie « Module N — … » ; module 6 créé en ligne par
    le pharmacien responsable le même jour. Les 22 questions se reclassent
    depuis la banque une fois le site redéployé. Détail dans `DECISIONS.md`.

    **Première version, du 01/10/2026, dépassée le soir même** (« Banque du
    pool déjà en ligne : la redéposer, ou la corriger sur place »), posée sur
    « Peux-tu vérifier que toutes les questions du niveau N2R ont bien chaque
    justification rattachée aux propositions de la question ? […] Est-ce que
    les illustrations des KIMO ont été réintégrées ? ». Constaté le même jour,
    en lecture seule, dans la base en ligne :
    - 37 questions N2R, dans les modules 1 à 4 du pool, toutes « à vérifier ».
      Elles ont été déposées en une fois, le 01/10 à 18:49, par la version
      du site d'alors.
    - Aucune ne porte de justification sous ses propositions, ni d'image. La
      question 85 laisse son texte unique à une question déjà déposée, et la
      question 84 n'agit qu'au dépôt.
    - Comparées au Word relu par le dépôt actuel :
      - 34 sont identiques (corrigé et niveau) ;
      - 3 sont fausses : la QIM sur l'attribution des rôles aux postes de PPH
        est sans corrigé, et deux QCM KIMO du module 4 portent le corrigé et
        le niveau d'une autre question ;
      - 16 sont absentes : les 13 du module 6, qui n'existe pas en ligne, et
        3 QCM KIMO du module 4, avalées par la question précédente.
    - D'ici là, aucune n'est tirée, faute d'être validée. Les trois fausses
      ne doivent pas être validées.

    Un nouveau dépôt du Word ne trouverait pas les modules : « Module 1 : … »
    ne répond qu'à un titre qui commence par « Module 1 », et les modules en
    ligne s'appellent « Pool de manipulation - (Module 1) ».

    Trois lectures :
    - **a (recommandé)** : redéposer le Word, et effacer les 37. Trois
      préalables :
      - le site est redéployé ;
      - le module 6 est créé (filière du pool, N2R) ;
      - le dépôt apprend à relier « Module 1 : … » au seul module dont le
        titre contient « Module 1 ».

      Les 37 s'effacent depuis la banque, une à une. Elles peuvent aussi
      s'effacer d'un coup dans la base, sur « fais-le dans la base ». Résultat :
      53 questions, la justification sous chaque proposition, 6 illustrations,
      et les corrigés et niveaux du Word. Contre : 37 questions effacées puis
      recréées, sous de nouveaux identifiants (rien ne les cite aujourd'hui).
      Les 3 tableaux des plages restent hors du site, une question ne portant
      qu'une image.
    - **b** : corriger sur place, question par question :
      - « Répartir » sur chacune des 37 ;
      - les trois corrigés repris à la main ;
      - les images des deux questions KIMO présentes, ajoutées à la main ;
      - les 16 manquantes déposées à part, depuis un extrait du Word : elles
        arrivent avec leur image.

      Contre : une quarantaine de gestes. Les deux questions qui en ont avalé
      d'autres gardent leurs lignes dans leur texte, à nettoyer à la main.
    - **c** : je corrige directement dans la base, par un script, en gardant
      les 37 identifiants, et j'ajoute les 16 manquantes. Contre : une
      écriture directe en production, hors de l'aperçu du dépôt, que vous
      n'auriez pas relu ; exige « fais-le dans la base ».

87. **Schémas du rattachement des questions : dans le site, ou seulement sur
    la page à part** — posée le 01/10/2026, sur « Je ne vois pas non plus
    apparaître les logigrammes sur Rattachement des questions : peux-tu le
    rendre plus accessible ? ». Sur iPhone, les deux schémas de la page
    « Rattachement des questions » étaient coupés à droite : dessinés pour un
    écran large, ils défilaient de côté dans leur cadre. Fait le jour même :
    ils se redessinent en colonne sous 720 px de large, la page est
    republiée au même lien (version 3), et ses constats suivent les
    questions 85 et 86. Cette page reste hors du site, sur claude.ai, privée.

    Trois lectures :
    - **a (recommandé)** : les deux schémas entrent aussi dans le site, sur une
      page « Rattachement des questions » du menu Squelette, à côté de
      « Rattachement des modules ». Un lien y mène depuis le dépôt des
      questions et depuis la banque. Même dessin, en colonne sur téléphone.
      Contre : un écran de plus à tenir à jour quand le modèle change ; les
      schémas sont fixes, ils ne lisent pas la base.
    - **b** : la page à part suffit, et le site n'y renvoie pas. Contre : elle
      est sur claude.ai, privée : un tuteur ne l'ouvre pas sans partage, et il
      faut garder le lien.
    - **c** : comme a, et le schéma se remplit des réglages réels d'un profil
      choisi (filière et niveau) : ses modules, avec leurs questions validées
      et à vérifier. Contre : beaucoup plus de travail ; la page d'une filière
      en donne déjà une partie (programme par niveau cible).

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : page
    « Rattachement des questions » du sous-menu Squelette
    (`/admin/rattachement-questions`), ouverte au tutorat et à
    l'administration, et liée depuis le dépôt et la banque. Elle porte les
    deux schémas, dessinés en colonne quand leur cadre fait moins de 920 px.
    Corrigé au passage, ici et sur la page à part : l'en-tête dit que c'est le
    module qui ouvre un niveau, les étiquettes de profil d'une question ne
    faisant que la restreindre ; les règles « sans filière » et « sans
    niveau » sont précisées « module déposé ». Détail dans `DECISIONS.md`.

86. **Module déposé sans niveau coché : proposé à tous les niveaux, ou à
    aucun** — posée le 01/10/2026, relevée en préparant les modules 1 à 9 du
    pool de manipulation (`DECISIONS.md`, « Relevé au passage, non traité »).
    Le formulaire d'un module dit « aucun coché : tous niveaux » ; la liste
    des modules et la page du module disent « tous niveaux » ; le tirage et la
    banque le lisent ainsi. Le programme d'un agent, filtré par son niveau,
    l'écarte pourtant : accueil (`app/page.tsx`), tableau de bord
    (`components/TableauDeBord.tsx`), ordre du parcours (`content/ordres.ts`).
    Un tel module n'est proposé à aucun agent qui a un niveau.

    Trois lectures :
    - **a (recommandé)** : le programme suit le formulaire. Sans niveau coché,
      le module est proposé à tous les niveaux de ses filières, comme au
      tirage et en banque. Contre : un module déjà déposé sans niveau entre,
      dès la mise en ligne, au programme des agents de tous les niveaux de
      ses filières. La liste des modules les montre (« tous niveaux ») : à
      regarder avant de déployer.
    - **b** : un module porte au moins un niveau. Le formulaire refuse
      l'enregistrement sans niveau, et la liste signale ceux qui n'en ont
      pas. Contre : un module pour tous les niveaux se coche niveau par
      niveau, et un niveau créé plus tard ne s'y ajoute pas.
    - **c** : le programme ne change pas. Les écrans disent « aucun niveau :
      proposé à aucun agent qui a un niveau », et le tirage et la banque s'y
      alignent. Contre : « aucun coché » ne sert plus à rien, et des
      questions tirées aujourd'hui ne le seraient plus.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : sans
    niveau coché, un module est proposé à tous les niveaux de ses filières —
    accueil, tableau de bord, ordre du parcours, programme d'une filière —,
    comme au tirage et en banque. La page d'une filière le lit « tous
    niveaux ». Les modules déjà déposés sans niveau sont à regarder dans la
    liste des modules avant la mise en ligne. Détail dans `DECISIONS.md`.

85. **Justification d'une question déposée : un seul texte, ou une par
    proposition comme chez Flore** — posée le 01/10/2026, sur « sur les 40
    questions déposées en cours de vérification, y a-t-il bien un
    rattachement entre la question et la justification de la réponse ? Sinon,
    prévoir toujours ce rattachement comme pour les quiz de Flore ».
    Aujourd'hui, le rattachement existe, mais à la question entière. Au
    dépôt, les lignes « Extrait A : … » à « Extrait E : … » et « Pièges : … »
    sont mises bout à bout en un seul texte. Ce texte s'affiche sous la
    correction, après « Votre réponse » et « Attendu ». La banque du pool
    porte un extrait pour chaque proposition de ses 53 questions ; 52 ont une
    ligne « Pièges », 41 une source. Chez Flore, chaque proposition porte sa
    justification et son extrait, affichés sous elle à la correction
    (`Prop.j` et `Prop.ref`, dépôt Quiz-Flore).

    Trois lectures :
    - **a (recommandé)** : comme chez Flore, la justification se range par
      proposition.
      - Au dépôt, « Extrait B : … » et le piège de B (« B mauvaise
        attribution ») vont à la proposition B. Une proposition sans extrait
        est signalée dans l'aperçu.
      - À la correction, chacun s'affiche sous sa proposition, marquée juste
        ou fausse. La justification libre de la question et sa source restent
        dessous, comme aujourd'hui.
      - Dans l'éditeur, un champ par proposition. Pour une question déjà en
        banque, un bouton « Répartir sous les propositions » remplit ces
        champs depuis son texte unique ; on vérifie, puis on enregistre.
      Contre : le modèle des questions, l'éditeur, la correction et l'écran
      de vérification changent. Ces justifications restent au serveur
      jusqu'à la réponse, comme le corrigé. Les 40 questions déposées
      demandent chacune ce clic et une relecture, au moment de leur
      vérification.
    - **b** : rien ne change en base. À l'affichage, le texte unique est
      découpé lettre par lettre (« A : … ; B : … »), et chaque morceau va
      sous sa proposition, y compris pour les 40 déjà déposées. Contre : le
      découpage devine les lettres dans un texte libre, que l'éditeur laisse
      réécrire. Un texte retouché à la main (« A et B : … ») serait mal
      coupé, sans que rien ne le signale, et personne ne relit la coupe :
      l'éditeur garde un seul texte.
    - **c** : le texte reste unique. Le dépôt signale, et l'écran de
      vérification marque, toute question sans justification, sans extrait
      pour l'une de ses propositions, ou sans source. Contre : l'agent lit
      toujours un bloc après la correction, pas l'explication sous chaque
      proposition.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : au
    dépôt, l'extrait, le piège et la justification écrite lettre par lettre
    vont à leur proposition ; ils s'affichent sous elle à la correction, au
    rapport, dans l'aperçu et en banque, et ne partent pas au navigateur
    avant la réponse. Dans l'éditeur, un champ par proposition, et « Répartir
    sous les propositions » pour une question au texte unique. Essayée sur
    les 53 questions de la banque du pool, la répartition redonne exactement
    le nouveau dépôt. Détail dans `DECISIONS.md`.

84. **Illustrations dès le dépôt : les images du fichier Word** — posée le
    01/10/2026, sur « Permettre l'ajout d'illustration d'image dès le
    dépôt ». Aujourd'hui, une image n'arrive avec un dépôt qu'à deux
    conditions : le fichier image est joint à part, dans le champ « Images »
    du dépôt, et une ligne « Image : nom-du-fichier.png » de la question le
    nomme. Les images collées dans un fichier Word sont ignorées. L'aperçu
    dit alors « l'image se choisit dans l'éditeur », c'est-à-dire après
    l'ajout, question par question. La banque du pool de manipulation compte
    six questions illustrées et neuf images collées. Trois questions en
    portent deux : la photographie d'un manomètre KIMO et le même tableau
    des plages de référence. Le site n'accepte qu'une image par question.

    Trois lectures :
    - **a (recommandé)** : le site reprend les images collées dans le fichier
      Word et rattache chacune à la question où elle se trouve, avec sa ligne
      « Description de l'image ». L'aperçu permet aussi d'ajouter, de changer
      ou de retirer l'image d'une question avant l'ajout à la banque. Une
      question à deux images garde la première, la photographie ; la seconde
      est signalée dans l'aperçu. Contre : le tableau des plages ne
      s'affiche pas avec les trois questions KIMO, sauf à le fondre à la main
      avec la photographie avant le dépôt ; leurs propositions citent déjà les
      plages utiles. Les images du Word ne sont pas réduites : au-delà de
      2 Mo, une image est refusée, et l'aperçu le dit.
    - **b** : a, et une question à deux images les reçoit toutes les deux,
      assemblées côte à côte en une seule image par le navigateur, à
      l'aperçu. Contre : plus de code et d'essais. Sur téléphone, deux images
      côte à côte deviennent petites ; l'agrandissement au toucher reste.
    - **c** : l'aperçu seulement. L'image de chaque question s'y ajoute avant
      l'ajout à la banque, sans lecture des images du Word. Contre : pour la
      banque du pool, six images à enregistrer depuis Word, puis à choisir
      une à une.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : les
    images collées dans un .docx arrivent sur leur question, avec leur
    description ; la première d'une question vaut, les suivantes sont
    signalées. Dans l'aperçu, hors schéma, une image s'ajoute, se change ou
    se retire avant l'ajout à la banque. Relue sur la banque du pool : six
    questions illustrées, les trois tableaux des plages signalés. Détail dans
    `DECISIONS.md`.

83. **Table de correspondance identifiant ↔ agent : le fichier seul, ou
    relié au site** — posée le 28/09/2026, sur « Crée une table de
    correspondance local pour la mise en relation du N° anonymat et des
    données nominatives de l'agent (conservation en local sur réseau
    sécurisé) ». Déjà tranché : la correspondance est un fichier tenu par le
    pharmacien responsable sur le réseau de l'établissement, dans un dossier
    à droits restreints, lisible par les tuteurs qui visent, jamais sur le
    site (question 28, choix a) ; le DPO en a validé le principe le
    19/09/2026. Aucun modèle n'existe encore : à la création d'un
    identifiant, le site dit seulement de noter la correspondance « dans la
    liste tenue hors du site », et le nom se saisit à la main à chaque
    édition de rapport.

    Trois lectures :
    - **a (recommandé)** : un classeur Excel vierge, que je fabrique et vous
      remets ; le site ne change pas. Une ligne par identifiant : identifiant
      (`AG-NNN`), nom, prénom, fonction, date de création de l'identifiant,
      créé par, remis à l'agent le, clos le. Rien d'autre, ni matricule ni
      date de naissance : le nom et le prénom suffisent à retrouver qui est
      `AG-017`. Une feuille « Mode d'emploi » dit où le classeur est rangé,
      qui y écrit, ce qu'on n'en fait jamais (l'envoyer par courriel, le
      déposer sur le site) et qu'il se détruit avec le dossier
      d'habilitation. Garde-fous : identifiant au format `AG-NNN`, doublon
      refusé. Contre : tout reste à la main. L'identifiant se recopie à sa
      création, un oubli ne se voit qu'en comparant avec l'écran Personnel,
      et le nom se ressaisit à chaque édition.
    - **b** : a, et le site lit le classeur dans le navigateur. Choisi dans
      le dossier réseau à chaque usage, jamais envoyé au serveur ni gardé
      par le navigateur, il affiche le nom à côté de l'identifiant dans
      l'administration et préremplit le nom à l'édition. Contre : le code du
      site manie alors les noms. Une version fautive ou compromise pourrait
      les transmettre : le principe validé par le DPO s'affaiblit et devrait
      lui être soumis à nouveau. Plus de code et d'essais.
    - **c** : a, mais le classeur se télécharge depuis l'écran Personnel,
      prérempli des identifiants existants (dates et état, aucun nom) ; les
      noms se complètent dans le dossier réseau. Contre : le site change, et
      chaque téléchargement fait une copie de plus. Deux versions peuvent
      coexister, et une copie complétée peut rester dans « Téléchargements »,
      hors du dossier protégé.

    Tranchée le même jour (choix a, réponse « a ») et mise en œuvre :
    `docs/modeles/table-correspondance-agents.xlsx`, fabriqué par
    `scripts/modele-correspondance.py`. Feuille « Correspondance » aux huit
    colonnes, identifiant contrôlé (format du site, doublon refusé, rouge si
    collé) ; feuille « Mode d'emploi ». Le site ne change pas ; un test
    garde le modèle vierge. Restent `[à compléter]` le chemin et les droits,
    `[à préciser]` si les tuteurs écrivent la ligne, `[à vérifier]` le
    comportement sous Excel. Détail dans `DECISIONS.md`.

82. **Introduction : ce que vise « ne quitte pas direct »** — posée le
    27/09/2026, sur la réponse « Mais ne quitte pas direct ». Aujourd'hui
    (commit 24a4ea6) :
    - un clic ou un toucher pendant la séquence ne ferme pas : il floute le
      pourtour et montre « Passer l'introduction ». Le bouton ferme, par un
      fondu de 0,4 s ;
    - dans les deux dernières secondes, pendant que le logo rejoint
      l'en-tête, le bouton est déjà sorti : un clic ferme directement ;
    - une touche, Échap ou la molette ferment directement, à tout moment.
      Sur la page de connexion, la touche frappée entre dans le champ du
      code.

    Trois lectures :
    - **a (recommandé)** : un clic ne ferme plus jamais, même dans les deux
      dernières secondes. Il n'y fait rien : l'introduction finit seule.
      Touches, Échap et molette ne changent pas. Contre : si la demande
      visait aussi la molette ou la sortie, elles restent telles quelles.
    - **b** : a, et la molette ne ferme plus : comme le clic, elle floute le
      pourtour et montre le bouton. Seules les touches ferment encore.
      Contre : un défilement au pavé tactile ne suffit plus ; il faut viser
      le bouton.
    - **c** : a, et passer ne coupe plus net. Le bouton ou une touche mènent
      à la fin de la séquence : le logo entier rejoint l'en-tête pendant que
      le papier se replie. La sortie dure 1,9 s au lieu d'un fondu de 0,4 s.
      Contre : passer prend 1,5 s de plus, et le saut vers le logo est une
      coupe.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : un
    clic ou un toucher ne ferme jamais l'introduction. Dans les deux
    dernières secondes, il ne fait rien, pas même montrer le flou ou le
    bouton : l'introduction finit seule. Bouton, touches, Échap et molette
    inchangés. Le parcours de bout en bout le vérifie. Détail dans
    `DECISIONS.md`.

81. **Squelette de la formation : un menu, et jusqu'où le rendre
    modifiable** — posée le 25/09/2026, sur la réponse à la question 80.
    Aujourd'hui :
    - se créent ou se règlent à l'écran : les filières et les niveaux
      (Réglages › Référentiel), le rattachement des modules du code
      (Modules › Modules), l'ordre (Modules › Ordre), les programmes à la
      carte, les paliers du tirage par niveau cible (Réglages › Barème) ;
    - sont écrits dans le code, sans écran : les quatre métiers, les sept
      blocs de compétence, les 53 critères, les trois niveaux des
      questions, les deux parcours et la périodicité de revalidation.

    Depuis la question 80 (choix a, même jour), chaque filière a sa page
    (Modules › Filières) : fiche, niveaux, programme. Elle prendrait place
    dans le sous-menu proposé ci-dessous.

    « Niveaux d'avancement » est lu comme les trois niveaux des questions —
    initial, intermédiaire, avancé — et leurs paliers par niveau cible : le
    seul autre jeu de niveaux du site `[à confirmer]`.

    Dans tous les cas : un sous-menu « Squelette de la formation » de
    l'Administration, une page par élément. Le Référentiel s'y scinde en
    Filières et Niveaux ; l'ordre, les programmes à la carte, le
    rattachement des modules et les paliers du tirage y passent. Les droits
    ne changent pas. Trois choix sur ce qui devient modifiable :
    - **a (recommandé)** : les blocs de compétence se créent et se
      modifient comme les filières — un dépôt corrige un bloc de la fiche
      ou en ajoute un —, et un module déposé reçoit un bloc. Les trois
      niveaux des questions se renomment ; leur nombre reste fixe, le
      tirage et le barème étant bâtis sur trois. Métiers, critères et
      parcours s'affichent en lecture. Contre : huit écrans lisent les blocs
      (accueil, repères, page d'un module, banque, programmes, statistiques,
      pilotage, référentiel) et passent sur la liste servie ; un bloc ajouté
      reste vide tant qu'aucun module ne s'y rattache.
    - **b** : rassembler seulement ; blocs, métiers, critères et niveaux
      des questions restent ceux du code, en lecture. Contre : les blocs ne
      se créent pas, contrairement à la demande.
    - **c** : a, et les critères et les métiers se créent et se modifient
      aussi (par métier : libellé, niveau, caractère obligatoire, bloc).
      Les fiches des trois autres métiers se saisiraient alors sur le site,
      sans attendre le passage du dépôt en privé. Contre : le plus gros
      changement depuis le début — les critères sont lus par presque tous
      les écrans, par les rapports et par les prompts —, la fiche transcrite
      cesse d'être la seule référence, et chaque critère ajouté ouvre un
      module à rédiger. Peut suivre a, dans un second temps.

    Tranchée le 26/09/2026 (choix a, réponse « 81 À ») et mise en œuvre :
    sous-menu Squelette ; Filières et Niveaux ; blocs créables et
    modifiables, un module déposé rangé dans un bloc ; niveaux des questions
    renommables, leurs noms copiés dans le résultat scellé, le tirage par
    niveau cible réglé sur leur page ; réglage des modules du code sur la
    page Rattachement des modules. La lecture de « niveaux d'avancement »
    n'a pas été corrigée par la réponse. Détail dans `DECISIONS.md`.

80. **Filières : les créer, les gérer, les modifier** — posée le
    25/09/2026, sur demande (« créer la possibilité de créer et gérer et
    modifier les filières »). Existant, Réglages › Référentiel,
    administration seule :
    - « Ajouter une filière » : libellé, identifiant (déduit du libellé),
      métier, description, pictogramme, rang, blocs de compétence ;
    - sur chaque filière, « Modifier » les mêmes champs, la désactiver
      (case « Proposée dans les listes de rattachement ») ou « Supprimer le
      dépôt » : une filière ajoutée disparaît, une filière de la fiche
      reprend son libellé d'origine.

    Ce qui ne se fait pas depuis la filière :
    - ses modules se cochent module par module, dans le réglage de chacun
      (Modules › Modules) ; son ordre se règle dans Modules › Ordre, ses
      niveaux dans la section Niveaux du Référentiel ;
    - avant de la désactiver ou de supprimer son dépôt, rien ne dit ce qui
      la cite : modules, documents, codes de poste, ordres, questions
      étiquetées ;
    - son identifiant ne change plus après la création ;
    - aucun lien des menus ne dit « Filières ».

    Trois choix :
    - **a (recommandé)** : une page par filière, ouverte depuis le
      Référentiel et depuis un lien « Filières » du menu Modules :
      - sa fiche : les champs actuels ;
      - ses niveaux, avec l'ajout d'un niveau déjà rattaché à elle ;
      - son programme : tous les modules, à cocher ou décocher ici, le
        tronc commun listé à part. Le rattachement reste enregistré dans le
        réglage du module, le même qu'à l'écran Modules ;
      - ce qui la cite, lu avant de la désactiver ou de la supprimer, et un
        lien vers son ordre.

      Contre : deux chemins mènent au même rattachement ; un module du
      code ainsi changé devient un écart à la fiche, signalé comme
      aujourd'hui ; un module ne peut pas y perdre sa dernière filière (il
      reviendrait à celles de la fiche, ou passerait au tronc commun) : la
      page le refuse et dit pourquoi.
    - **b** : rendre l'existant visible : le lien « Filières » ouvre la
      section du Référentiel, où chaque filière liste ses modules en
      lecture, avec un lien vers le réglage de chacun. Contre : composer
      une filière reste un aller-retour module par module.
    - **c** : a, et changer l'identifiant d'une filière, reporté dans tout
      ce qui le cite (réglages, modules et documents déposés, niveaux,
      ordres, codes de poste, questions). Contre : huit tables à reporter,
      des rapports émis qui gardent l'ancien, pour un identifiant que l'on
      ne lit guère — le libellé se modifie déjà. Le renommage d'un niveau
      (question 65) s'est fait à la main pour ces raisons.

    Réponse du même jour, qui élargit la demande : « Rassembler dans un
    même menu la création modification pour les filières, les niveaux, les
    blocs, les niveaux d'avancement… tout ce qui est en lien avec le
    squelette de la formation. » Suite : question 81.

    Puis tranchée (choix a, réponse « À question 80 ») et mise en œuvre :
    `/admin/filieres` et une page par filière — fiche, niveaux, programme,
    ce qui la cite —, le programme enregistré dans le réglage de chaque
    module, tout ou rien, sans jamais retirer la dernière filière d'un
    module. La question 81 reste ouverte. Détail dans `DECISIONS.md`.

79. **Tableurs du registre et du répertoire : l'injection de formule** —
    posée le 25/09/2026, sur un constat fait en vérifiant les tableurs des
    statistiques (question 78).
    - Le registre des rapports (`/admin/rapports`, et la ligne CSV du
      paquet d'archivage) et le répertoire du personnel reprennent des
      saisies libres : motifs d'arbitrage et d'annulation, titres de
      modules déposés, libellés des codes (profils des visas).
    - Un texte qui commence par `=`, `+`, `-` ou `@` y est écrit tel quel.
      Ouvert dans Excel ou LibreOffice, il serait exécuté comme une formule
      (page « CSV Injection » de l'OWASP).
    - Ces textes ne sont saisis que sous un code de tutorat ou
      d'administration.
    - Le sceau des rapports n'est pas en cause : le CSV est recomposé à
      chaque téléchargement, hors empreinte.

    Trois choix :
    - **a (recommandé)** : la parade des tableurs de statistiques, dans
      `csv` lui-même, pour toute cellule de texte de tous les tableurs. Une
      tabulation invisible précède les seuls textes qui commencent par ces
      signes, et la cellule est mise entre guillemets. Les colonnes produites
      par le site (numéros, dates, verdicts, empreintes) ne commencent
      jamais par l'un d'eux : seules les saisies concernées changent, et une
      colonne ajoutée plus tard est protégée d'office.
    - **b** : la même parade, sur les seules colonnes de saisie libre du
      registre et du répertoire (motifs, titres, profils), colonne par
      colonne.
    - **c** : ne rien changer, et consigner le risque comme accepté : textes
      saisis par des personnes habilitées, tableurs lus par elles.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : la
    parade est dans `csv` (`lib/registre.ts`), pour toute cellule de texte de
    tous les tableurs ; les nombres restent des nombres. Le parcours de bout
    en bout le vérifie sur le registre, avec un motif d'arbitrage qui commence
    par un tiret. Détail dans `DECISIONS.md`. Contrôlé sous Excel par
    l'utilisateur le 26/09/2026 (« 79 Excel ») ; LibreOffice non essayé.

78. **Statistiques de réussite : sur quelles données** — posée le
    25/09/2026, sur demande (« ajouter un module de statistiques pour
    identifier les modules les mieux et les moins bien répondus ; imaginer
    le meilleur système pour analyser la réussite des apprenants et ajuster
    les formations relatives aux modules ; l'intégrer au mieux au reste du
    site »). Existant : le Pilotage agrège les **rapports émis** (verdicts
    par critère, score moyen, questions les plus manquées). Or un agent
    émet d'ordinaire l'essai qui réussit : les rapports ne disent ni la
    réussite au premier essai, ni le nombre d'essais. Toutes les
    évaluations des agents rattachés sont, elles, conservées dans leur
    progression, avec le détail scellé de chaque réponse. Système proposé,
    écran « Statistiques » (Administration › Suivi) : classement des
    modules (réussite au premier essai, réussite finale, essais jusqu'à
    l'acquis, score médian, intervalle de confiance à 95 %) ; fiche par
    module (évolution, profils, questions avec difficulté, discrimination et
    « je ne sais pas », propositions, réponses, légendes, étapes et trous
    manqués, distracteurs jamais choisis, erreurs par source du support) ;
    actions d'amélioration datées et comparaison avant/après ; liens depuis
    le Pilotage, la banque et la page du module ; export tableur. Aucune
    donnée individuelle, aucun taux sous cinq agents. Trois choix :
    - **a (recommandé)** : toutes les évaluations conservées des agents
      rattachés, premiers essais compris, sans double compte avec les
      rapports émis. Finalité ajoutée à `docs/RGPD.md` et à la page RGPD :
      statistiques agrégées pour améliorer les formations, sans décision sur
      une personne `[à valider avec le DPO]`.
    - **b** : les rapports émis seulement, comme le Pilotage : aucun nouvel
      usage de la progression, mais une réussite surestimée et ni premier
      essai ni nombre d'essais.
    - **c** : a, et les identifiants d'agents visibles dans les
      statistiques, pour cibler un accompagnement individuel.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre :
    - l'écran « Statistiques » (Suivi) et une fiche par module ;
    - des repères dans la banque et sur la page du module (tutorat et
      administration), des renvois depuis le Pilotage ;
    - des tableurs, et des actions d'amélioration datées.

    Ce qui compte comme essai :
    - les évaluations conservées des agents rattachés ;
    - les rapports émis sans évaluation conservée ;
    - une évaluation émise ne compte qu'une fois ;
    - un essai dont le seul rapport est annulé est écarté.

    Aucun taux sous cinq agents distincts, même pour une question, une
    réponse ou une source. Les « profils » de la proposition se lisent par
    les filtres filière, niveau et bloc du classement, et, sur la fiche, par
    niveau visé à l'évaluation. Détail dans `DECISIONS.md` ; finalité RGPD
    `[à valider avec le DPO]`.

77. **Menu : un pictogramme par thème** — posée le 25/09/2026, sur demande
    (« prévoir des icônes différentes pour chaque tête de menu, en lien
    avec le thème du menu »). Depuis la question 76, les quatre sous-menus
    d'administration portent le même écusson ; Formation, Repères et RGPD
    n'en portent aucun. Jeu proposé, dessiné sur la grille des pictogrammes
    du site (monochrome, couleur du bandeau) : toque (Formation), boussole
    (Repères), courbe (Suivi), bulle « ? » (Questions), couches (Modules),
    curseurs (Réglages), cadenas (RGPD) ; l'écusson ne resterait que sur le
    groupe « Administration » du volet de poste, seul endroit où ce groupe
    a un intitulé. Chaque pictogramme reste remplaçable. Trois choix :
    - **a (recommandé)** : les pictogrammes sur chaque tête de menu, dans le
      tiroir et dans le volet de poste, le même pour un même thème.
    - **b** : dans le tiroir seulement ; le volet de poste garde ses
      intitulés sans pictogramme.
    - **c** : dans le tiroir, et dans le volet sur les seuls groupes de
      premier niveau (Formation, Repères, Administration, RGPD), sans
      pictogramme sur les sous-menus.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : le jeu
    proposé, tel que sur les maquettes.
    - Chaque bandeau d'« Aller à » porte le pictogramme de son thème, et
      l'entrée RGPD un cadenas.
    - Dans le volet de poste : les groupes, les sous-menus d'administration
      et l'onglet RGPD, y compris avant connexion.
    - L'écusson ne reste que sur le groupe « Administration » du volet.

    Pictogrammes décoratifs, cachés au lecteur d'écran. Hauteurs inchangées,
    sauf l'onglet RGPD du volet (+1 px). Détail dans `DECISIONS.md`.

76. **Menu : les quatre intitulés « Administration · … »** — posée le
    25/09/2026, second point de la demande de la question 75 (« trouver un
    synonyme pour les groupes de fonctions qui commencent tous par
    administrer, ou supprimer administrer et le remplacer par une vignette
    ou une icône »). Dans « Aller à », quatre bandeaux commencent par le
    même mot — « Administration · Suivi », « · Questions », « · Modules »,
    « · Réglages » — et le mot qui les distingue vient en dernier. Sur
    poste, trois d'entre eux passent sur deux lignes. Le volet de poste range
    ces quatre sous-menus dans un seul groupe « Administration ». Maquettes
    mesurées (hauteur d'« Aller à », groupes repliés) : 414 px sur iPhone 15
    et 389 px sur poste aujourd'hui. Trois choix :
    - **a (recommandé)** : « Administration · » retiré des quatre bandeaux
      et remplacé par un pictogramme d'écusson, dessiné comme ceux du site
      (monochrome, couleur du bandeau). Le lecteur d'écran et la recherche
      gardent « Administration » ; le volet de poste ne change pas. Une
      ligne par bandeau sur poste : 325 px.
    - **b** : un synonyme plus court, « Gestion · Suivi », « Gestion ·
      Questions »…, et « Gestion » pour le groupe du volet de poste, pour
      que les deux surfaces gardent les mêmes mots. Une ligne sur poste
      aussi : 325 px. Le titre des pages et le nom du rôle restent
      « Administration ».
    - **c** : « Administration » écrit une seule fois, en sous-titre
      au-dessus des quatre bandeaux, comme « À faire » et « Aller à » ;
      l'onglet RGPD remonte au-dessus de ce sous-titre pour ne pas passer
      pour un écran d'administration. 352 px sur poste, 443 px sur
      iPhone 15 (une ligne de plus).

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre : les
    bandeaux s'intitulent « Suivi », « Questions », « Modules » et
    « Réglages », précédés de l'écusson ; le lecteur d'écran entend toujours
    « Administration · Suivi », et la recherche « administration » trouve
    leurs écrans. Sur poste, chaque bandeau tient sur une ligne : « Aller
    à » passe de 389 à 324 px. Le volet de poste ne change pas. Détail dans
    `DECISIONS.md`.

75. **Menu sur téléphone : la place laissée à « Aller à »** — posée le
    25/09/2026, sur demande (« sur bandeau de menu la zone de défilement est
    trop limitée : pouvoir replier la partie À faire ou réduire l'espacement
    pour garder un espace confortable pour le reste du menu »). Mesuré sur
    gabarit, en administration, banque de questions ouverte : l'en-tête, la
    recherche, « Reprendre » et « À faire » ne défilent pas et prennent
    497 px ; il reste à « Aller à » 161 px sur un iPhone 15 dans Safari
    (gabarit 393 × 659), 55 px sur un iPhone SE (375 × 553), 16 px sur ce
    dernier en mode zone. Le titre repris s'étale sur quatre lignes, sa
    mention « lecture, section 1 sur 5 » occupant la moitié droite : dans
    les trois choix, elle passe sous le titre, qui tient en deux lignes
    (21 px de gagnés). Trois choix :
    - **a (recommandé)** : « À faire » repliable. Son intitulé devient un
      bouton ; replié, il porte le total en attente ; l'état est gardé sur
      l'appareil. « Aller à » disposerait de 391 px sur iPhone 15, de
      285 px sur iPhone SE, de 278 px en mode zone. Cibles inchangées
      (44 px, 52 px en mode zone).
    - **b** : espacement resserré : lignes de « À faire » de 32 px au lieu
      de 44, hors mode zone, qui garde ses 52 px pour les gants. « Aller
      à » : 244 px sur iPhone 15, 138 px sur iPhone SE, 41 px en mode zone.
    - **c** : un seul défilement sur téléphone : sous la recherche, tout le
      tiroir défile d'un tenant, sans rien replier ni resserrer. Zone qui
      défile : 551 px sur iPhone 15, 445 px sur iPhone SE, 437 px en mode
      zone ; à l'ouverture, « Aller à » commence au même endroit
      qu'aujourd'hui.

    Second point du même message, posé ensuite en question 76 : les quatre
    intitulés « Administration · … » d'« Aller à » (synonyme, ou mot
    remplacé par une vignette ou une icône).

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre :
    l'intitulé « À faire » est un bouton qui replie la zone ; replié, il
    porte le total de la file ; l'état est gardé sur le poste ; une
    recherche montre quand même ses résultats. Mesuré après : « Aller à »
    passe de 155 à 395 px sur iPhone 15, de 49 à 289 px sur iPhone SE, de
    16 à 274 px sur ce dernier en mode zone. Détail dans `DECISIONS.md`.

74. **Une question dans plusieurs blocs et plusieurs profils** — posée le
    24/09/2026, sur demande (« pouvoir positionner une question dans
    plusieurs blocs de compétences et plusieurs profils »). Aujourd'hui, une
    question appartient à un seul module (`questions.module_id`). Son bloc
    est celui du critère de ce module ; ses profils sont les filières et
    niveaux cochés dans le réglage du module, qui peut déjà en porter
    plusieurs (question 36, choix a). Trois choix :
    - **a (recommandé)** : rattacher une question à plusieurs modules. Elle
      garde son module d'origine, où elle se modifie et se valide, et peut
      être « aussi posée dans » d'autres modules, choisis dans l'éditeur.
      Bloc et profils suivent les modules : rattachée à un module du bloc 1
      et à un du bloc 3, elle est dans les deux blocs, et dans les profils
      de chacun. Elle entre dans le tirage de chaque module et figure sous
      chacun dans l'arborescence. Une seule validation, un seul
      signalement : corrigée une fois, elle l'est partout.
    - **b** : des étiquettes propres à la question — blocs (1 à 7) et
      profils (filière × niveau) — à côté de son module unique. Elles
      filtrent la banque et limitent le tirage aux profils cochés ; la
      question n'entre dans l'évaluation d'aucun autre module.
    - **c** : a et b.

    Tranchée le même jour (choix c, réponse « C ») et mise en œuvre : une
    question garde son module d'origine et peut être aussi posée dans
    d'autres modules ; ses blocs sont ceux de ses modules et de ses
    étiquettes ; ses filières et niveaux cochés limitent son tirage, une
    liste vide ne limitant rien. Profils saisis en deux listes (filières,
    niveaux), comme au réglage d'un module. Détail et limites dans
    `DECISIONS.md`.

73. **Après le lot 1 de l'audit : la suite** — posée le 24/09/2026. Le lot 1
    est fait : correction à l'écran (E1), question dégagée de l'en-tête
    (E2), identifiant rappelé (Z1), pincement des schémas (Z2), réservées
    déjà vues (F1, question 71). L'audit place ensuite le test avec des
    agents (lot 2, § 5), puis le temps des formateurs (lot 3). Trois choix :
    - **a (recommandé)** : le lot 3 maintenant — relire et valider une
      question depuis un seul écran (D1), alertes du dépôt conservées (D2),
      relecture dépôt par dépôt (D3), contrôles de rédaction (D4) —, avec
      les trois défauts relevés en passant (§ 4), qui touchent les mêmes
      écrans. Le test avec trois à cinq agents s'organise en parallèle : le
      lot 3 ne change pas les écrans des apprenants.
    - **b** : l'ordre de l'audit : rien de plus avant le test avec les
      agents.
    - **c** : les trois défauts relevés en passant seuls, puis le test.

    Tranchée le même jour (réponse « ne rien faire ») : ni le lot 3, ni les
    trois défauts relevés en passant ; le test avec des agents reste à
    organiser. Deux demandes du même message — tester en apprenant à un
    niveau choisi, banque en arborescence repliée par défaut — sont
    consignées à part dans `DECISIONS.md`.

72. **Champs d'une filière sans effet** — posée le 24/09/2026, après l'aide
    ajoutée au Référentiel le même jour. « Blocs de compétence » est
    enregistré, mais aucun écran ni aucun calcul ne le lit : le programme
    d'une filière vient des modules qui la cochent dans leur réglage
    (question 36, choix a). « Rang » ne fait rien sur une filière de la
    fiche, qui garde sa place. Trois choix :
    - **a (recommandé)** : retirer ces deux champs des formulaires —
      « Blocs de compétence » partout, « Rang » sur une filière de la fiche.
      Les valeurs déjà enregistrées restent en base, sans usage.
    - **b** : rendre les blocs agissants : le programme d'une filière
      comprendrait aussi, par défaut, les modules de ses blocs, sauf réglage
      contraire du module.
    - **c** : laisser tel quel ; l'aide dit que ces champs ne servent pas.

    Tranchée le même jour (choix c, réponse « C ») : rien n'est modifié.
    Détail dans `DECISIONS.md`.

71. **Réponses des questions réservées montrées après l'évaluation** — posée
    le 24/09/2026 (audit, F1).

    La question 18 (choix c) a créé les questions réservées pour qu'un agent
    ne puisse pas apprendre la banque avant l'évaluation. Or ces réponses lui
    sont données après :
    - le résultat affiche, pour chacune, la réponse attendue, la
      justification et la source (`app/api/evaluation/route.ts`,
      `components/Evaluation.tsx`) ;
    - le rapport que l'apprenant télécharge depuis l'accueil les reprend
      (`lib/rapport.ts`).

    Tirées en priorité, ces questions reviennent à la tentative suivante.
    Trois choix :
    - **a (recommandé)** : l'apprenant ne voit plus, pour une réservée, ni la
      réponse attendue ni la justification. Cela vaut à l'écran et sur le
      rapport téléchargé ; il garde « juste » ou « faux ». Le rapport émis,
      que le pharmacien vise et imprime depuis l'administration, reste
      complet.
    - **b** : les réponses restent visibles, mais le tirage suivant de
      l'agent rattaché écarte les réservées qu'il a déjà vues, quand la banque
      en compte assez.
    - **c** : a et b.

    Tranchée le même jour (choix b, « b pour que l'apprenant puisse voir la
    correction ») et mise en œuvre : la correction reste montrée ; au tirage
    suivant d'un agent rattaché, les réservées déjà vues corrigées passent
    après les questions ordinaires. Détail dans `DECISIONS.md`.

70. **Poste partagé : « Quitter » détache-t-il aussi l'agent ?** — posée le
    24/09/2026 (audit, Z1). « Quitter » ferme la session du code de profil,
    mais pas le rattachement de l'agent (`lib/auth.ts`, `lib/progression.ts`).
    L'activité de la personne suivante, sur le même poste, entretient ce
    rattachement, jusqu'à 4 h sans activité et 12 h au plus. Depuis la
    question 69, l'identifiant est rappelé au réglage, dans la barre de
    passation et au récapitulatif. Trois choix :
    - **a (recommandé)** : « Quitter » détache aussi l'agent.
    - **b** : comme a, plus « Se détacher » en permanence dans l'en-tête tant
      qu'un agent est rattaché.
    - **c** : laisser tel quel ; les rappels de la question 69 suffisent.

    Tranchée le même jour (choix a, réponse « À ») et mise en œuvre :
    « Quitter » lève le rattachement après la session. Détail dans
    `DECISIONS.md`.

69. **Audit ergonomique : par quoi commencer** — posée le 24/09/2026,
    après l'audit du même jour (`docs/AUDIT-ERGONOMIE.md`). Trois choix :
    - **a (recommandé)** : le lot 1 d'abord. Il amène la correction
      d'entraînement à l'écran, dégage de l'en-tête le numéro et le format
      de la question, garde l'identité de l'agent visible sur un poste
      partagé, rend le zoom aux schémas, puis règle le sort des réponses des
      questions réservées.
    - **b** : le temps des formateurs d'abord. Les questions se relisent et
      se valident depuis un seul écran, les alertes du dépôt sont conservées,
      la relecture se fait dépôt par dépôt et des contrôles de rédaction
      sont ajoutés.
    - **c** : un test avec trois à cinq agents d'abord, sur la version
      actuelle.

    Tranchée le même jour (choix a, réponse « À »).
    - **Faits** : la correction amenée à l'écran et reportée sur les
      propositions (E1), la question dégagée de l'en-tête (E2), l'identifiant
      rappelé au réglage, dans la barre et au récapitulatif (Z1, affichage),
      et le pincement rendu aux schémas (Z2).
    - **Posés à part** : « Quitter » qui détacherait l'agent, et les réponses
      des questions réservées (F1).

    Détail dans `DECISIONS.md`.

68. **QCM : « Plusieurs » avec une majuscule** — constaté le 23/09/2026,
    non corrigé. Un QCM ne s'affiche en cases à cocher que si son énoncé
    contient « plusieurs » en minuscules (`estUneSeule`,
    `components/Evaluation.tsx` ; même test pour le libellé du format,
    `content/types.ts`). Le contrôle du dépôt, lui, ignore la casse
    (`lib/import-format.ts`). Un QCM à plusieurs réponses vraies dont
    l'énoncé commence par « Plusieurs » passe donc le dépôt sans alerte,
    puis s'affiche en boutons radio : une seule réponse cochable, la question
    ne peut pas être réussie. Posée le 24/09/2026 : une seule règle, sans
    tenir compte de la casse, à l'affichage comme au libellé (a,
    recommandé) ; remplacer le mot par un choix explicite « une réponse /
    plusieurs réponses » sur chaque QCM (b) ; laisser tel quel, la consigne
    d'écrire « plusieurs » en minuscules étant rappelée à l'éditeur et au
    prompt (c). Tranchée le même jour (choix a, réponse « À ») et mise en
    œuvre : une seule règle, `annoncePlusieurs` (`content/types.ts`), pour
    l'affichage, le libellé du format et le contrôle du dépôt. Détail dans
    `DECISIONS.md`.

67. **Trois écarts relevés en marge des questions 61 et 66** — constatés le
    23/09/2026, non corrigés. (1) Pilotage, « Par critère » : le lien d'un
    critère porte son code (`?module=B1-01`), que le filtre, qui n'accepte
    qu'un identifiant de module, écarte sans rien dire ; la page se recharge
    sans filtre. (2) Sur iPad en paysage, les lignes du tiroir d'accès
    rapide restent à 32 px au doigt, quand celles du volet passent à 44 px
    depuis le 22/09. (3) La spécification de l'accès rapide annonce, sous
    mouvement réduit, « opacité seule, 90 ms » ; le site supprime toute
    transition. Posée le 24/09/2026 : corriger les trois — filtre par
    critère au pilotage, lignes du tiroir à 44 px au doigt, spécification
    alignée sur le site (a, recommandé) ; le pilotage seul (b) ; aucun pour
    l'instant (c). Tranchée le même jour (choix c, réponse « C ») : aucun
    n'est corrigé ; les trois restent consignés dans `DECISIONS.md`.

66. **Liens vers les modules : périmètre** — demandé le 23/09/2026 :
    « Ajoute des liens entre les sections, pouvoir cliquer sur un module
    pour l'ouvrir. » Existant : une douzaine d'endroits ouvraient déjà un
    module (cartes et badges de l'accueil, « Reprendre », module suivant,
    banque) ; environ vingt-quatre le nommaient sans lien. La question du
    périmètre n'avait pas été posée. Tranchée par délégation le même jour
    (« Pour les 3 prends les recommandations ») : partout où un écran nomme
    un module, son nom l'ouvre, sauf là où un clic ferait déjà autre chose,
    perdrait un travail non enregistré ou mènerait à une page vide.
    Détail dans `DECISIONS.md`.

65. **Niveaux : renommer un code, régler l'ordre** — demandé le 23/09/2026 :
    « Revoir pour l'apparence des prérequis replace N2Restreint par N2R
    (dépôt) — pouvoir organiser l'ordre des niveaux. » Existant : un code de
    niveau sert d'identifiant et ne se renomme pas ; les cinq niveaux de la
    fiche passaient toujours en tête, les niveaux ajoutés après, par leur
    rang entre eux. Posée le 23/09/2026 pour le renommage, sans numéro :
    à la main — ajouter N2R, supprimer le dépôt N2RESTREINT, reprendre ce
    que liste l'encart « niveau inconnu » (a, recommandé si le niveau est
    récent et peu cité) ; une fonction « Renommer le code », reportée
    partout, codes d'accès compris (b). La question de l'ordre n'avait pas
    été posée. Tranchée par délégation le même jour (« Pour les 3 prends
    les recommandations ») : renommage à la main (a), l'encart couvrant
    désormais les codes d'accès actifs et les plafonds du barème ; ordre
    par le rang, fiche comprise (10, 20…), métier par métier. Détail et
    procédure dans `DECISIONS.md`. Renommage N2RESTREINT → N2R fait par
    l'utilisateur, en base, le 26/09/2026.

64. **Banque en arborescence** — demandé le 23/09/2026 : « dans la
    présentation de la banque de questions, proposer l'alternative d'une
    présentation en arbre dépliable comme le quiz de Flore — Arborescence ».
    Existant, mesuré sur la base d'essai (57 modules) : en tête de la
    banque, l'arbre « Couverture » range les modules par filière puis par
    niveau d'habilitation ; il est toujours déplié — seul l'étage filière se
    replie, jamais celui du niveau — et occupe environ 4 200 px sur poste
    (près de cinq écrans) et 8 800 px sur téléphone ; un module rattaché à
    deux niveaux y figure deux fois (5 sur 57). Il mène à la liste, où
    chaque question est une carte de 190 à 300 px (énoncé, propositions,
    boutons), groupée par module. Chez Flore, l'arborescence de l'écran
    « à la carte » suit le contenu — UE, matière, chapitre —, chaque rangée
    avec son chevron et son décompte, et une bascule « Arborescence |
    Diagramme ». Posée le 23/09/2026. Dans tous les cas : chevrons, décompte
    à chaque rangée, « Tout déplier / Tout replier », mêmes filtres (statut,
    niveau, obligatoires), branche rouverte après un geste (Valider,
    Retirer). Vue « Arborescence » à côté de la vue « Liste », par le
    contenu : grand module de la fiche (blocs 1 à 7, modules déposés à
    part), module, question — chaque question une fois, dépliée pour ses
    propositions et ses boutons, la répartition par niveau de question à la
    rangée du module ; la couverture par filière et niveau reste dans la vue
    Liste (a) ; même bascule, par le profil : filière, niveau
    d'habilitation, module, question — un module rattaché à deux niveaux, et
    ses questions, sous chacun (b) ; pas de seconde vue : la couverture
    actuelle devient dépliable à chaque étage, repliée par défaut, la liste
    inchangée (c). Tranchée le même jour (choix b, réponse « B ») et mise en
    œuvre : bascule « Liste | Arborescence », la liste restant la vue par
    défaut ; arbre filière, niveau, module, question, filières ouvertes et
    le reste replié par défaut ; un module rattaché à deux niveaux dit sous
    quelles autres branches il figure ; sous un filtre, l'arbre ne garde que
    les branches qui portent des questions retenues ; après chaque geste,
    la branche est rouverte, et la page y revient. Détail dans
    `DECISIONS.md`.

63. **Tirage : questions obligatoires, part aléatoire et répétitions** — suite
    de la question 62. Réponse du 23/09/2026 : « À mais définir un minimum
    pour la validité du test avec des questions taggées obligatoires pour la
    partie initiale et une part aléatoire pour permettre de répéter le test ;
    pour les répétitions le classement par niveau vaut pour équivalence. Ces
    tests sont un complément à la formation pratique et à l'évaluation du
    tuteur ». Existant :
    - le minimum pour conclure est au barème, 10 questions par défaut ; en
      dessous, le résultat ne peut pas être porté à un rapport ;
    - deux étiquettes seulement : éliminatoire (toujours posée, une erreur
      invalide le module) et réservée (jamais en entraînement ni en
      Découverte, tirée en priorité) ; aucune ne rend une question
      obligatoire sans effet sur la note ;
    - l'application ne sait qu'une évaluation est une répétition que pour un
      apprenant rattaché par son identifiant d'agent (mode pseudonyme) ;
    - les questions versionnées avec le code n'ont pas de niveau : tant qu'il
      n'est pas renseigné, une composition par niveau n'a rien à composer.
    Posée le 23/09/2026. Dans tous les cas : étiquette « obligatoire » dans
    l'éditeur, la banque et le dépôt, sans effet sur la note ; les
    obligatoires sont posées dans les tirages qui peuvent conclure, sous le
    plafond de niveau ; elles comptent dans le minimum du barème, et une
    évaluation qui ne l'atteint pas reste non concluante ; une obligatoire au
    signalement ouvert est remplacée par une question du même niveau, et le
    rapport le dit. Socle d'obligatoires à chaque évaluation, part aléatoire
    de même composition par niveau à chaque passation, réglée au barème selon
    le niveau cible (a) ; socle à la première évaluation seulement, chaque
    obligatoire remplacée aux répétitions par une question du même niveau
    tirée au hasard, même composition par niveau (b) ; socle à chaque
    évaluation, part aléatoire sous le seul plafond, sans composition par
    niveau (c). Tranchée le même jour (choix a, réponse « À » lue comme a)
    et mise en œuvre avec la question 62 : étiquette « obligatoire »,
    plafond et répartition au barème, niveau cible choisi à l'écran de
    réglage, questions signalées écartées, contrôle du serveur, tirage cité
    par le rapport. `[à vérifier]` les plafonds par défaut (N1a, N1b, N1c :
    initiales ; N2 : jusqu'aux intermédiaires ; N3 : tous niveaux). Détail
    dans `DECISIONS.md`.

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
    Tranchée le même jour (choix a, réponse « À » lue comme a), ce qui revient
    sur la décision du 22/09/2026 (question 51), avec des compléments —
    minimum de validité, questions obligatoires, part aléatoire, équivalence
    des répétitions par niveau — qui font l'objet de la question 63. Mise en
    œuvre avec elle, le même jour.

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
    Tranchée le même jour (choix a, réponse « question 61 : a ») et mise en
    œuvre : sur poste, le tiroir couvre la colonne du volet sur toute la
    hauteur et s'arrête 8 px avant la colonne de lecture ; le voile ne voile
    plus rien, à aucune taille ; un clic sur la page ferme le tiroir sans
    suivre le lien qu'il touche ; Tab et Échap inchangés. Détail dans
    `DECISIONS.md`.

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
