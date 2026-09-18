# Questions ouvertes — à trancher par le pharmacien responsable

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
   page `/donnees-personnelles`), `[à vérifier]` par le DPO (base légale,
   rattachement à la fiche « gestion du personnel », hébergeur et
   sous-traitance, analyse d'impact) ; `[à compléter]` responsable de
   traitement, contact du DPO, support de la correspondance ; `[à préciser]`
   durée de référence de conservation.
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
4. **Hébergeur** — tranché le 18/09/2026 (question 8, choix a) : **Render**,
   service Node et base PostgreSQL managée en région Francfort, plans payants
   exigés par le statut opposable (point 3). Service créé à la main le
   18/09/2026 (<https://pharmatechx.onrender.com>), hors blueprint :
   `[à vérifier]` dans le tableau de bord que ses plans, sa base, sa région et
   ses variables suivent `render.yaml`. Restent aussi : `[à vérifier]` les
   identifiants de plan du blueprint et le contenu des plans (mise en veille,
   sauvegardes, rétention, connexions), la documentation de Render n'étant pas
   joignable depuis l'environnement de travail ; `[à vérifier]` par le DPO :
   contrat de sous-traitance, sous-traitants ultérieurs, transfert hors UE
   (société américaine, données à Francfort) ; `[à préciser]` accord de la DSI
   (hébergement externe, nom de domaine, accès réseau, responsable des
   sauvegardes). Le dépôt n'a qu'une branche, déployée à chaque poussée :
   `[à préciser]` créer une branche de production distincte. Vercel reste
   documenté en repli, non retenu ; l'hébergement interne est écarté. Constat
   du 18/09/2026 : service et base sur plans gratuits, donc phase d'essai
   (`MISE_EN_SERVICE` absente) ; base gratuite à durée limitée `[à vérifier]`
   et sans sauvegarde : `pg_dump` pendant l'essai, plans payants avant la mise
   en service.
5. **Rôle « pharmacien »** : `[à préciser]` le visa du pharmacien responsable
   est porté par un code d'administration (choix posé), ou un rôle distinct
   est créé.
6. **Règle des quatre yeux** : `[à préciser]` le tuteur qui dépose une question
   peut-il la valider lui-même (choix posé : oui, tracé dans le journal), ou
   la validation doit-elle venir d'un autre profil ?
7. **Accès aux documents déposés** (procédures internes) : `[à préciser]`
   ouvert à quiconque a l'adresse (état livré, comme les modules) ou réservé
   aux sessions ouvertes par code.
8. **Hachage des adresses pour le limiteur de connexion** (5 échecs → 15 min,
   doublement) : `[à préciser]` seuils acceptés ?
9. **Sauvegarde** : sauvegardes de Render sur le plan payant `[à vérifier]`
   (contenu, rétention) et `pg_dump` conservé dans l'établissement
   (`docs/DEPLOIEMENT.md`) ; `[à préciser]` fréquence (hebdomadaire proposée),
   responsable, périodicité de l'essai de restauration ; un essai précède le
   premier rapport réel.

## B. Barèmes et règles d'évaluation

10. **Barème QIM** 1 / 0,5 / 0 selon les discordances — à confirmer (hérité).
11. **Barème du schéma à compléter** repris du Lecteur QIM · QCM : 1 point au
    plus, chaque légende vaut 1/n, fausse elle le retire, vide elle ne compte
    pas, plancher 0. `[à préciser]` confirmer, ou tout ou rien comme un QCM.
12. **Éliminatoire sur un schéma** : `[à préciser]` toute légende fausse *ou
    vide* rend le critère non acquis (choix posé) ou seules les fausses.
13. **Présentation des QIM** : Vrai/Faux par proposition (défaut) ou cases à
    cocher — à trancher avec les préparateurs (hérité).
14. **Mode entraînement** (correction immédiate, jamais enregistré) :
    `[à préciser]` le conserver tel quel, ou le réserver aux modules déjà
    évalués une fois en mode évaluation.
15. **Tirages** : Découverte 5, Habilitation 10 (toutes éliminatoires
    incluses), Complet — `[à préciser]` tailles à confirmer.
16. **Schéma, mode de réponse par défaut** : `[à préciser]` écrire (défaut) ou
    choisir dans la liste mélangée.

## C. Banque de questions et modules

17. **Statut à l'import** : toute question importée entre « à vérifier », même
    avec corrigé complet (choix posé). `[à préciser]` conserver, ou valider
    d'office les questions dont le corrigé est complet.
18. **Rédaction des modules** (les 56 textes restants) : `[à préciser]` en
    base par les tuteurs (à construire) ou dans le code par le pharmacien
    (état livré).
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
23. **Signalements anonymes** : `[à préciser]` les garder ouverts à tout
    apprenant (choix posé) ou réservés aux sessions par code.

## D. Rapports enregistrés (si mode nominatif)

24. **Numérotation** `RAP-AAAA-NNNN` avec une séquence globale (non remise à
    zéro chaque année) : `[à préciser]` acceptable ?
25. **Purge** — tranché le 18/09/2026 (question 5, choix d) : manuelle par
    l'administrateur, jamais automatique ; seuls les rapports clos ou annulés
    sont purgeables, confirmation par recopie du numéro ou du mot PURGER,
    numéros consignés au journal.
26. **Logos** dans le rapport téléchargé : adresses absolues vers le site
    (l'impression suppose le site joignable). `[à préciser]` incorporer les
    images dans le fichier.
27. **Sessions** de 12 h non révocables individuellement (hérité) :
    `[à préciser]` conserver.
31. **Paramètres de la décision** (`lib/decision.ts`) : `[à préciser]` largeur
    de la bande de garde égale au poids d'une question du tirage (70 à 89 %
    pour un seuil de 80 % sur dix questions ; choix posé), ou une demi-question,
    ou une largeur fixe en points ; `[à préciser]` minimum de 10 questions
    validées pour conclure (taille du tirage d'habilitation ; choix posé).
32. **Exclusions** : une question retirée de la banque après signalement est
    exclue du calcul, les exclusions étant fixées au premier acte de décision
    (arbitrage ou visa du tuteur) et jamais modifiées ensuite, même si une
    question est retirée plus tard. `[à préciser]` conserver, ou bloquer le visa
    du pharmacien quand une question du tirage est retirée après le visa du
    tuteur.
33. **Arbitrage** : porté par tout profil tuteur ou admin, sans exigence que
    l'arbitre soit distinct du tuteur qui vise (même règle que le point 6).
    `[à préciser]` le motif doit-il être choisi dans une liste fermée ?
34. **Signature** : une image par code d'accès admin, réduite à 600 px de large
    par le navigateur (comme dans la console), conservée en base et non sur le
    poste ; donnée personnelle de plus à déclarer. `[à préciser]` une image de
    signature pour le tuteur aussi (choix b de la question 2, écarté) ?
35. **Fichiers d'archivage** : CSV au séparateur « ; », UTF-8 avec marque
    d'ordre, dates lisibles en heure de Paris ; JSON complet ; zip sans
    compression. `[à préciser]` si un autre outil que le tableur doit lire ces
    fichiers (registre qualité, GED).
36. **Identifiants d'agents** (question 6, choix a) : format `AG-NNN` généré
    par le site sur une séquence globale, jamais saisi ni réattribué ; clôture
    sans suppression ; créés et clos par un tuteur ou l'administrateur (choix
    posé). `[à préciser]` réserver la création et la clôture à
    l'administrateur ? `[à préciser]` faut-il porter la fonction de l'agent
    (préparateur, interne…) sur le rapport autrement qu'à l'édition — une liste
    fermée en base resterait pseudonyme mais rétrécit l'anonymat dans une
    petite équipe. Le nom porté à l'édition n'est pas couvert par le sceau : le
    lien identifiant ↔ personne repose sur la correspondance tenue hors du
    site, `[à préciser]` sur quel support et avec quel accès.

## E. Présentation

28. **Mode sombre** : décision antérieure « plus tard » (hérité).
29. **Imagerie des modules** (photo d'habillage au sas, schéma de cascade de
    pression) : à produire en interne (hérité).
30. **PandaSuite** : la page de référence n'était pas accessible depuis
    l'environnement ; les fonctions ont été relevées sur les pages indexées.
    `[à préciser]` fonctions attendues qui manqueraient : embranchements de
    scénario, vidéo interactive, export SCORM.
