# Rapports d'évaluation enregistrés — fiche de registre et information des agents

Proposition rédigée le 18/09/2026 pour le délégué à la protection des données
(DPO) de l'établissement, à la suite de la décision du pharmacien responsable
(question 6, choix a) : les rapports d'évaluation sont enregistrés sous un
**identifiant d'agent généré par le site, sans nom** ; la correspondance
identifiant ↔ agent est tenue par le pharmacien hors du site ; le nom n'est
porté qu'à l'édition du rapport (impression, paquet d'archivage) et n'est
jamais conservé.

**Examen par le DPO — 19/09/2026.** Le pharmacien responsable rapporte que le
DPO a examiné le dispositif et validé le principe : **les résultats des agents
sont conservés sous le seul numéro d'anonymisation**, le **fichier de
rapprochement** numéro ↔ personne étant tenu hors du site. Le mode
`CONSERVATION_RAPPORTS=pseudonyme` est activé en conséquence. Ce que cet
examen ne dit pas, et qui reste ouvert : `[à compléter]` la trace écrite de
l'avis (date, forme, référence à citer au registre) ; `[à vérifier]` la base
légale retenue, le rattachement à la fiche « gestion du personnel » ou une
fiche propre, la nécessité d'une analyse d'impact, les contrats de
sous-traitance de Render et de Supabase et les mécanismes de transfert. Ces
points ne sont pas réputés tranchés par le seul fait de l'examen.

Ce document est une proposition : il ne vaut ni inscription au registre ni
validation juridique. Les éléments que seul l'établissement détient sont
marqués `[à compléter]` ; ceux qui demandent un arbitrage du DPO sont marqués
`[à vérifier]` ; ceux qui attendent une décision du pharmacien responsable,
`[à préciser]`. Rien n'y est posé par défaut.

## 1. Pourquoi une fiche malgré la pseudonymisation

- Un identifiant attribué à un agent et relié à ses résultats est une donnée
  **pseudonymisée**, donc une donnée à caractère personnel : règlement (UE)
  2016/679, art. 4 § 1 et § 5, considérant 26. Dans une équipe de petite
  taille, l'identifiant, le critère, la date et le visa du tuteur suffisent à
  retrouver la personne (critère d'individualisation : G29, avis 05/2014 sur
  les techniques d'anonymisation, WP216).
- Le traitement reste nominatif hors du site : le rapport imprimé avec le nom
  entre au dossier d'habilitation, fichier au sens de l'art. 2 § 1 ; la
  correspondance tenue par le pharmacien est elle-même un fichier.
- La pseudonymisation est une mesure de protection dès la conception et de
  sécurité (art. 25 et 32) : elle réduit le risque, en particulier vis-à-vis
  d'un hébergeur hors de l'établissement, sans dispenser du registre (art. 30)
  ni de l'information des personnes (art. 13).
- `[à vérifier]` Le traitement « formation et habilitation du personnel » est
  vraisemblablement déjà inscrit au registre de l'établissement au titre de la
  gestion du personnel (référentiel CNIL du 21 novembre 2019). La question
  pour le DPO est de savoir si cet outil, hébergé hors de l'établissement, s'y
  rattache comme un simple moyen, ou fait l'objet d'une fiche propre, celle-ci.

## 2. Fiche de registre (art. 30 § 1) — proposition

| Rubrique | Contenu proposé |
|---|---|
| Responsable du traitement | `[à compléter]` Centre hospitalier départemental de Vendée, représenté par `[à compléter]` |
| Délégué à la protection des données | `[à compléter]` nom et adresse de contact |
| Service opérationnel | Pharmacie à usage intérieur, unité de pharmacotechnie — pharmacien responsable de l'unité |
| Dénomination | Rapports d'évaluation des connaissances du personnel de pharmacotechnie (étape 2 de la chaîne d'habilitation) |
| Finalités | 1. Documenter l'évaluation des connaissances (étape 2 sur 6) préalable à l'habilitation du personnel de l'unité. 2. En tenir la traçabilité : registre des rapports, répertoire par agent et par critère. 3. Tracer les actes de décision (arbitrage, visas) et d'administration (journal). 4. Suivre le parcours de formation de l'agent qui rattache sa progression (décision du 18/09/2026, question 11, choix c). Le rapport ne vaut pas habilitation. |
| Base légale | `[à vérifier]` art. 6 § 1 e (exécution d'une mission d'intérêt public) ou art. 6 § 1 c (obligation légale de documentation de l'habilitation du personnel : bonnes pratiques de préparation, arrêté du 8 août 2023). Le traitement ne repose pas sur le consentement. |
| Personnes concernées | Agents de l'unité évalués (préparateurs, internes, pharmaciens) ; tuteurs et pharmacien responsable au titre des visas, de l'arbitrage et de la signature |
| Catégories de données — agents évalués | Identifiant pseudonyme généré (`AG-NNN`), état (actif ou clos) et dates ; par rapport émis : critère, tirage, réponses données et corrigé, score, verdict brut et verdict final, numéro, empreinte, dates ; arbitrage motivé du tuteur — motif en texte libre (décision du 18/09/2026, question 26, choix a), qui ne doit porter aucun nom, garantie procédurale et non technique ; visas (qualité, profil de session, date, empreinte). |
| Catégories de données — tuteurs et pharmacien | Profil de session (libellé du code d'accès, choisi par l'administrateur) ; image de signature du pharmacien, rattachée à son code, incrustée dans les rapports clos ; aucune image de signature n'est collectée pour les tuteurs, dont le visa s'imprime en toutes lettres (décision du 18/09/2026, question 25, choix a). Les modules déposés, les documents et le barème réglé portent le profil de session de leur auteur (rôle et libellé du code), jamais une personne. |
| Catégories de données — journal | Rôle, libellé de profil, action, cible (numéro de rapport, identifiant d'agent), date. |
| Catégories de données — progression (question 11, choix c) | Sur rattachement de l'agent par son identifiant et son code personnel (4 à 8 chiffres, conservé haché par scrypt, jamais lisible) : évaluations complètes avec leur résultat scellé (critère, tirage, réponses, corrigé, score, verdict, barème, date), entraînements terminés (score, tirage, date), modules lus (date), évaluation en cours (questions posées et réponses saisies, jusqu'à correction ou abandon) ; ordre des modules fixé par le tutorat pour l'apprenant sur un profil (question 56, 23/09/2026), suivi quand il est rattaché. Sans rattachement, rien de tout cela n'est conservé, sauf un ordre propre fixé par le tutorat. Purge par l'administrateur, journalisée, sur demande de l'agent ou à son départ ; les rapports émis ne sont pas touchés. |
| Hors du site | Correspondance identifiant ↔ nom, tenue par le pharmacien responsable (décision du 18/09/2026, question 28, choix a) : **un fichier sur le réseau de l'établissement**, dans un dossier à droits restreints, lisible par les tuteurs qui visent — `[à préciser]` chemin, droits et titulaire de leur attribution ; hors du site, jamais déposé dessus. Conservée aussi longtemps que le dossier d'habilitation et détruite avec lui (durée `[à vérifier]`). L'identifiant porté sur la pièce classée au dossier en est le complément, non le substitut. Les tuteurs, qui créent les identifiants et visent les rapports, connaissent de fait la correspondance des agents qu'ils suivent (décision du 18/09/2026, question 27, choix a) : la réidentification n'est pas confinée au pharmacien. **Paquet d'archivage classé** au dossier d'habilitation, en GED ou sur le réseau (décision du 19/09/2026, question 33, choix b) : HTML, CSV et JSON du rapport, résultat scellé compris, et — s'il est produit depuis le formulaire d'édition — le nom et la fonction, marqués hors sceau. Conservation et accès suivent le dossier d'habilitation. |
| Données jamais traitées par le site | Nom, prénom, matricule, adresse électronique ; adresse IP en clair (empreinte salée pour le limiteur de connexion) ; réponses hors émission ; entraînements. Le nom porté à l'édition d'un rapport n'est ni enregistré, ni journalisé, ni transmis dans une adresse. |
| Données sensibles (art. 9) | Aucune |
| Destinataires | Tuteurs (profil « tuteur ») ; pharmacien responsable et administrateur du site (profil « admin ») ; l'agent lui-même, pour sa progression rattachée ; aucun tiers |
| Ressources tierces | Aucune : le navigateur ne joint que le site, polices comprises (décision du 23/09/2026, `docs/DECISIONS.md`). Jusqu'à cette version, chaque page chargeait la police Inter depuis Google Fonts, qui recevait l'adresse IP du poste — sur le site en ligne jusqu'au déploiement de cette version `[à compléter : date, lisible dans l'historique des déploiements de Render]` |
| Illustrations des questions | Photographies et schémas déposés par les tuteurs : aucune donnée de patient (étiquette nominative, ordonnance, écran de logiciel), aucune personne reconnaissable sans son accord — règle affichée au dépôt, dans l'éditeur et sous les prompts (décision du 23/09/2026). Une photo est ré-encodée sur l'appareil avant l'envoi : ses métadonnées (lieu, appareil, date) ne parviennent pas au site. `[à vérifier]` forme de l'accord d'un agent reconnaissable, si l'exception devait servir |
| Sous-traitant, hébergeur du service | **Render** (décision du 18/09/2026, question 8, choix a ; service en ligne `pharmatechx.onrender.com`) : service Node en région Francfort, Union européenne ; les données transitent par lui, la base est ailleurs. Société de droit américain : `[à vérifier]` dénomination et adresse de l'entité contractante, contrat de sous-traitance (art. 28, « Data Processing Addendum » de Render), liste des sous-traitants ultérieurs (fournisseur d'infrastructure de la région Francfort). Un accès à distance depuis les États-Unis est un transfert au sens du chapitre V : `[à vérifier]` mécanisme retenu, certification au cadre de protection des données UE–États-Unis (décision d'adéquation du 10 juillet 2023) ou clauses contractuelles types. Les données transmises ne comportent aucun nom. |
| Sous-traitant, hébergeur de la base | **Supabase** (décision du 18/09/2026, demande du pharmacien responsable) : base PostgreSQL managée, où résident toutes les données du traitement, sans nom ; région `[à préciser]` (Union européenne, Francfort recommandé, à consigner) ; jointe par le service seul, en IPv4 et en TLS, par le pooler de session de Supabase. Société `[à vérifier]` (Supabase, Inc., États-Unis, ou entité européenne contractante) : `[à vérifier]` contrat de sous-traitance (« Data Processing Addendum » de Supabase), sous-traitants ultérieurs (fournisseur d'infrastructure de la région, Amazon Web Services `[à vérifier]`), mécanisme de transfert (cadre UE–États-Unis ou clauses contractuelles types), chiffrement au repos et sauvegardes selon le plan. L'API de données du projet est coupée et chaque table est protégée par la sécurité au niveau des lignes : hors le service, seul le tableau de bord de Supabase donne accès à la base (compte de l'établissement, `[à préciser]` titulaire, authentification à deux facteurs). |
| Durée de conservation | Jusqu'à purge manuelle par l'administrateur, sans purge automatique (décision du 18/09/2026, question 5, choix d). Durée de référence `[à préciser]` par le pharmacien responsable avec le DPO ; la durée d'archivage du dossier d'habilitation `[à vérifier]` fait référence. Journal : `[à préciser]`. Image de signature : jusqu'à son retrait, les rapports clos gardant l'image incrustée. Progression rattachée, ordre propre des modules compris : jusqu'à purge manuelle par l'administrateur depuis l'écran Personnel, à la demande de l'agent ou à son départ, sans purge automatique et sans effet de la clôture de l'identifiant (décision du 18/09/2026, question 15, choix a) ; critère de durée `[à vérifier]` par le DPO ; le rattachement lui-même expire au bout de douze heures, ou de quatre heures sans activité. |
| Mesures de sécurité | Pseudonymisation dès la conception (aucun nom en base, identifiant généré, aucun champ libre sur l'agent) ; codes d'accès hachés (scrypt, sel par code) ; sessions signées (HMAC), 12 h au plus, liées à leur code d'accès et fermées dès sa révocation ou sa suppression, ou après quatre heures sans activité ; contrôle des rôles côté serveur ; limiteur d'échecs de connexion ; résultats scellés par le serveur et empreinte SHA-256 des rapports ; rapports non modifiables (annulation motivée) ; journal des actions ; purge manuelle confirmée et journalisée ; progression rattachée par un code personnel haché (scrypt), cookie signé de douze heures au plus, levé à la sortie (« Quitter », question 70) ou après quatre heures sans activité, cinq échecs bloquent l'adresse un quart d'heure, code réinitialisable par un tuteur sans jamais être lu ; sécurité au niveau des lignes activée sur chaque table et droits retirés aux rôles de l'API de données de Supabase (base accessible par le service seul) ; chiffrement en transit (TLS vers la base), chiffrement au repos et sauvegardes `[à vérifier]` selon l'hébergeur et le plan. |
| Information des personnes | Page `/donnees-personnelles` du site, seule à parler des données depuis le 22/09/2026 : l'onglet « RGPD » du volet et de l'accès rapide, présents sur chaque écran, y mène ; `[à compléter]` note de service ou mention au dossier d'habilitation. |
| Exercice des droits | Auprès du pharmacien responsable (qui tient la correspondance) ou du DPO. Accès (l'agent lit lui-même sa progression sur le site) ; rectification par annulation motivée et réémission (un rapport scellé ne se modifie pas) ; limitation ; opposition (art. 21, si base légale art. 6 § 1 e) ; effacement dans les limites de l'obligation de traçabilité de l'habilitation — la progression rattachée, elle, se purge sans réserve. |
| Analyse d'impact (art. 35) | `[à vérifier]` a priori non requise : pas de données sensibles, pas de surveillance systématique, faible volume, pseudonymisation ; à confirmer par le DPO au regard des listes CNIL des traitements soumis ou exemptés. |

## 3. Texte d'information des agents (art. 13)

Le texte affiché sur la page `/donnees-personnelles` du site reprend, dans
l'ordre de l'art. 13 : identité du responsable et contact du DPO
(`[à compléter]`) ; finalités et base légale (`[à vérifier]`) ; catégories de
données, en insistant sur ce qui n'est jamais enregistré ; destinataires ;
hébergement (`[à compléter]`) ; durée de conservation (`[à préciser]`) ;
droits et voie d'exercice ; droit de réclamation auprès de la CNIL. Depuis
le 22/09/2026, il est le seul endroit du site qui parle des données : on y
accède par l'onglet « RGPD », en fin de volet sur poste et dans l'accès rapide
sur tablette et téléphone — donc depuis chaque écran, y compris la connexion.
Le formulaire d'émission et le pied de page n'y renvoient plus : la note de
service `[à compléter]` porte l'information au moment de la remise de
l'identifiant.

Ce que l'agent doit comprendre en trois phrases : le site ne connaît que son
identifiant ; le pharmacien responsable seul fait le lien avec son nom, hors
du site ; son nom n'apparaît que sur le rapport imprimé qui rejoint son
dossier d'habilitation.

## 4. Ce qui reste à faire avant la mise en service

1. `[à vérifier]` DPO — **examiné le 19/09/2026**, principe validé
   (conservation sous le seul numéro d'anonymisation, fichier de rapprochement
   hors du site) ; restent ouverts : base légale retenue ; rattachement à la
   fiche « gestion du personnel » ou fiche propre ; nécessité d'une analyse
   d'impact ; contrats de sous-traitance de Render et de Supabase,
   sous-traitants ultérieurs et mécanismes de transfert hors UE.
   `[à compléter]` la trace écrite de l'avis.
2. `[à compléter]` Établissement : responsable de traitement, contact du DPO,
   entités contractantes de Render et de Supabase, région du projet Supabase,
   titulaire du compte Supabase. Support de la correspondance
   identifiant ↔ nom tranché (question 28, choix a : fichier sur le réseau de
   l'établissement, dossier à droits restreints, lisible par les tuteurs) :
   restent `[à compléter]` le chemin, les droits et qui les attribue.
3. `[à préciser]` Pharmacien responsable : durée de référence de conservation
   des rapports et du journal (la progression rattachée suit la question 15 :
   purge manuelle au départ de l'agent) ; mode
   d'information des agents en plus de la page du site.
4. `CONSERVATION_RAPPORTS=pseudonyme` — **activé le 19/09/2026** après examen
   du DPO, avant que les points 1 à 3 ne soient tous clos : le dispositif est
   en phase d'essai (`MISE_EN_SERVICE` absente) et chaque écran et chaque
   rapport le disent. Ces points restent à clore **avant la mise en service
   comme preuve**, et la page `/donnees-personnelles` comme cette fiche sont à
   compléter avec les réponses.

## Sources

- Règlement (UE) 2016/679 du 27 avril 2016 (RGPD), art. 2 § 1, 4 § 1 et § 5,
  6, 13, 21, 25, 28, 30, 32, 35 ; considérant 26.
- Groupe de travail « article 29 », avis 05/2014 sur les techniques
  d'anonymisation, WP216, 10 avril 2014.
- Comité européen de la protection des données, lignes directrices 01/2025
  sur la pseudonymisation, janvier 2025 `[à vérifier : version définitive
  après consultation publique]`.
- CNIL, référentiel relatif aux traitements de données à caractère personnel
  mis en œuvre aux fins de gestion du personnel, délibération n° 2019-160 du
  21 novembre 2019 `[à vérifier : numéro]`.
- Arrêté du 8 août 2023 relatif aux bonnes pratiques de préparation :
  exigence d'habilitation documentée du personnel.
