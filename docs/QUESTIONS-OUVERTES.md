# Questions ouvertes — à trancher par le pharmacien responsable

Chaque point est marqué `[à préciser]` dans le code ou l'interface à l'endroit
exact où la donnée manque. Rien n'a été comblé par défaut : quand une valeur
a dû être posée pour que le squelette fonctionne, elle est nommée ici comme
telle. Ordre : ce qui change le déploiement en premier.

## A. Avant le déploiement effectif

1. **Référence « métrologie » pour la signature et la gestion des rapports.**
   Aucune application ni document de métrologie n'a été trouvé dans les dépôts
   GitHub accessibles (PharmaTechX, Quiz-Flore, PMP-PHARMACOTECHNIE, PHARMACO),
   les artefacts Claude ni Notion. Le circuit implémenté (numéro séquentiel,
   empreinte SHA-256, visas apprenant → tuteur → pharmacien, annulation
   motivée, journal, rapport A4) transpose la pratique ISO 10012.
   `[à préciser]` : (a) conforme à ce que fait la métrologie, ou (b) différent —
   partager l'application ou le document de référence.
2. **Conservation nominative des rapports** (`CONSERVATION_RAPPORTS`).
   `[à préciser]` : `aucune` (rapport téléchargé, signé sur papier, rien
   d'enregistré — état livré) ou `nominative` (rapports enregistrés avec le
   nom saisi, visas électroniques). Le mode nominatif traite des données
   personnelles d'agents : inscription au registre des traitements, information
   des agents, droits d'accès et de rectification, et
   `[à préciser]` durée de conservation (`RAPPORTS_CONSERVATION_MOIS`) : 24 mois
   (cycle de revalidation), 5 ans, 10 ans (document qualité) ?
3. **Statut du dispositif** : outil pédagogique ou preuve opposable en audit
   BPP 2023 / ISO 9001 ? Change les exigences d'horodatage, de conservation et
   d'accès. Marqueur visible en pied de chaque écran et sur chaque rapport.
4. **Hébergeur** : `[à préciser]` Render (processus Node, base Postgres
   managée, plan gratuit avec mise en veille) ou Vercel (fonctions Node, base
   Neon, Blob facultatif). Les deux sont prêts (`render.yaml`, variables
   documentées). Localisation des données d'agents hors de l'établissement :
   `[à préciser]` accord de la DSI / du DPO.
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
9. **Sauvegarde** : `[à préciser]` fréquence de `pg_dump` et responsable.

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
25. **Purge à l'échéance** : non implémentée ; `[à préciser]` manuelle par
    l'administrateur, ou automatique.
26. **Logos** dans le rapport téléchargé : adresses absolues vers le site
    (l'impression suppose le site joignable). `[à préciser]` incorporer les
    images dans le fichier.
27. **Sessions** de 12 h non révocables individuellement (hérité) :
    `[à préciser]` conserver.

## E. Présentation

28. **Mode sombre** : décision antérieure « plus tard » (hérité).
29. **Imagerie des modules** (photo d'habillage au sas, schéma de cascade de
    pression) : à produire en interne (hérité).
30. **PandaSuite** : la page de référence n'était pas accessible depuis
    l'environnement ; les fonctions ont été relevées sur les pages indexées.
    `[à préciser]` fonctions attendues qui manqueraient : embranchements de
    scénario, vidéo interactive, export SCORM.
