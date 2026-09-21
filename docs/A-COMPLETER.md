# Le chemin des éléments à compléter

Inventaire des marqueurs `[à compléter]`, `[à préciser]` et `[à vérifier]`
portés par le site, relevé dans le dépôt le 21/09/2026.

Pour chacun : **où il se voit**, **ce qui le porte**, **ce qu'il faut
fournir**, **qui décide**. Rien n'y est rempli par une valeur vraisemblable :
un marqueur affiché vaut mieux qu'un chiffre inventé sur une pièce opposable.

Trois familles, dans l'ordre de ce qu'elles bloquent :

- **A.** Ce qui empêche le rapport de valoir preuve — 4 points, tous des
  variables d'environnement ou des arbitrages du DPO.
- **B.** Ce qui empêche le site de servir — le contenu de formation.
- **C.** Ce qui attend une décision et non une donnée — renvoi à
  `QUESTIONS-OUVERTES.md`.

---

## A. Ce qui empêche le rapport de valoir preuve

### A1. Référence de la procédure interne

| | |
|---|---|
| **Où ça se voit** | Pied de page de **tous** les écrans (`app/layout.tsx`), page `/donnees-personnelles`, et **sur chaque rapport** — le rapport imprime littéralement « procédure `[à compléter]` » |
| **Ce qui le porte** | Variable d'environnement `PROCEDURE_HABILITATION`, lue par `procedureReference()` (`lib/config.ts`) |
| **À fournir** | Le code et le titre de la procédure dans votre système documentaire, en une chaîne — par exemple `CHD-PR-0000 — Habilitation des préparateurs en pharmacotechnie` |
| **Qui décide** | Vous, pharmacien responsable |
| **Où le poser** | Tableau de bord Render, puis redéploiement |

Tant qu'elle manque, le rapport dit de lui-même qu'il n'est rattaché à aucune
procédure. C'est voulu (décision du 18/09/2026, question 7, choix b) : un
document opposable qui ne cite pas la procédure qui l'encadre doit le dire.

### A2. Date de mise en service

| | |
|---|---|
| **Où ça se voit** | Bandeau « **Phase d'essai — ne vaut pas preuve** » sur les écrans et sur les rapports (`lib/statut.ts`, `components/TableauDeBord.tsx`, `lib/rapport.ts`) |
| **Ce qui le porte** | `MISE_EN_SERVICE`, au format `AAAA-MM-JJ` (`lib/config.ts`) |
| **À fournir** | La date à laquelle le dispositif devient une preuve opposable |
| **Qui décide** | Vous, après l'avis du DPO (point A4) et la validation qualité |
| **Où le poser** | Tableau de bord Render, puis redéploiement |

À ne pas poser avant que A1, A3 et A4 soient réglés : la date transforme tous
les rapports en pièces opposables, y compris ceux qui n'ont pas de procédure
de rattachement.

### A3. Durée de conservation annoncée

| | |
|---|---|
| **Où ça se voit** | Sur le rapport et sur `/donnees-personnelles`, où le texte dit aujourd'hui : « la durée de conservation de référence est `[à préciser]` avec le délégué à la protection des données » |
| **Ce qui le porte** | `RAPPORTS_CONSERVATION_MOIS` (entier, en mois), lue par `dureeConservationMois()` |
| **À fournir** | La durée de référence, en mois |
| **Qui décide** | Vous **avec le DPO** |

Attention à ce que cette valeur est et n'est pas : **une annonce, pas un
mécanisme**. Aucune purge automatique n'existe (décision du 18/09/2026,
question 5, choix d) ; l'administrateur purge à la main depuis
`/admin/rapports`. Annoncer une durée sans la tenir serait pire que ne rien
annoncer.

La durée d'archivage du dossier d'habilitation fait référence — `[à vérifier]`
dans votre plan d'archivage.

### A4. Ce que le DPO doit arrêter

Tenu dans `docs/RGPD.md` (§ 2, fiche de registre, et § 4, ce qui reste à
faire). Les cases de la fiche de registre encore ouvertes :

| Case | Marqueur | À fournir |
|---|---|---|
| Responsable du traitement | `[à compléter]` | Le CHD Vendée, représenté par qui — nom et qualité |
| Délégué à la protection des données | `[à compléter]` | Nom et adresse de contact |
| Base légale, finalités | `[à vérifier]` | L'analyse du DPO |
| Analyse d'impact (AIPD) | `[à vérifier]` | Nécessaire ou non, et la trace écrite de l'avis |
| Fichier de rapprochement identifiant ↔ nom | `[à préciser]` | Chemin sur le réseau, droits, titulaire de leur attribution |
| Région du projet Supabase | `[à préciser]` | Union européenne ; Francfort recommandé, à consigner |
| Entité contractante Supabase | `[à vérifier]` | Société signataire et contrat de sous-traitance |
| Mécanisme de transfert hors UE | `[à vérifier]` | Cadre UE–États-Unis ou clauses contractuelles types |
| Durée de conservation du journal | `[à préciser]` | — |
| Accord de la DSI | `[à préciser]` | Hébergement externe d'un traitement de l'établissement |
| Information des agents | `[à compléter]` | Note de service ou mention au dossier d'habilitation |

Ces cases ne sont pas du code : aucune ne se pose dans le site. Elles se
remplissent dans `docs/RGPD.md`, qui sert de projet de fiche de registre.

---

## B. Ce qui empêche le site de servir : le contenu

### B1. Cinquante-six textes de formation

| | |
|---|---|
| **Où ça se voit** | Sur l'accueil, chaque critère non rédigé porte l'étiquette « **Module à rédiger** » ; sur sa page, « Ce critère est un emplacement ouvert : son contenu de formation reste à rédiger » |
| **Ce qui le porte** | `content/habilitation.ts` (les 58 critères) et `content/modules/` (les textes) |
| **État exact** | **58 critères, 2 rédigés** — `comportement-zac` (critère 1.1) et `protection-operateur-cytotoxiques` (critère 1.4). **56 emplacements vides.** |
| **À fournir** | Le texte de chaque module |
| **Qui décide** | Vous et les tuteurs ; tranché le 19/09/2026 (question 10, choix a) : les textes vivent dans le code, je les place et je pousse |

C'est, de loin, le plus gros poste de travail restant. Il ne demande aucun
développement : la rédaction peut commencer aujourd'hui.

### B2. Données locales des deux modules rédigés

Les deux textes existants s'appuient sur le référentiel externe — ANSM, BPP
2023, BPF annexe 1, ISO 14644 — et laissent les valeurs de l'unité ouvertes.
Le marqueur est **dans le corps du texte**, mis en évidence à l'écran par
`components/Corps.tsx`, à deux endroits mesurés :

| Fichier | Ligne | Phrase |
|---|---|---|
| `content/modules/comportement-zac.ts` | 86 | « Classes retenues local par local au CHD Vendée, et régime de pression associé : `[à préciser]`. » |
| `content/modules/protection-operateur.ts` | 108 | « Configuration de l'unité (type d'enceinte, régime de pression, dispositifs de transfert retenus au CHD Vendée) : `[à préciser]`. » |

À fournir (question 21 de `QUESTIONS-OUVERTES.md`) : classe ISO de chaque
local, régime de pression associé, composition et fonctionnement des sas,
type d'enceinte et dispositifs de transfert, fréquence de changement des
gants, emplacement du kit de déversement, circuit de déclaration d'un
incident.

### B3. Procédures internes à rattacher

**Correction d'une formulation que j'ai d'abord écrite ici** : les modules
rédigés ne citent **aucune** procédure interne. Ils ne renvoient qu'à des
référentiels publics. Les références CHD-FT1647, CHD-FT1645 et CHD-FT482
figurent dans la question 22 de `QUESTIONS-OUVERTES.md` comme procédures que
*vous* souhaitez rattacher — elles ne sont attendues nulle part dans le code.

**À fournir** : les fichiers, déposés depuis `/admin/documents` par un tuteur
ou par vous, puis rattachés au module ou au critère concerné. Aucun marqueur
ne s'affiche tant qu'ils manquent : c'est un manque silencieux, et c'est
justement pourquoi il est listé ici.

### B4. Postes de travail

| | |
|---|---|
| **Où ça se voit** | Sélecteur de filière, entrée « **Postes de travail — `[à préciser]`** » |
| **Ce qui le porte** | `postesDeTravail`, `content/habilitation.ts:162` |
| **À fournir** | La liste des postes de l'unité, **si** vous voulez composer les programmes par poste |
| **Qui décide** | Vous |

La fiche d'habilitation raisonne en filières et niveaux, pas en postes : cette
entrée est un ajout, et elle peut rester vide sans rien bloquer. C'est le seul
marqueur de cette liste qui soit **facultatif**.

### B5. Périodicité de revalidation par critère

| | |
|---|---|
| **Où ça se voit** | Page d'un module, « revalidation N mois » ou `[à préciser]` |
| **Ce qui le porte** | `maintien.periodiciteMois` (`content/habilitation.ts`), valeur **24 mois**, reprise de votre fiche |
| **État** | La valeur globale **existe** et s'affiche. Le marqueur ne paraît que pour un module déposé en base dont la périodicité n'a pas été saisie |
| **À fournir** | Rien, sauf si un critère doit avoir une périodicité propre |

---

## C. Ce qui attend une décision, pas une donnée

Ces points ne se ferment pas en fournissant une valeur : ils demandent un
arbitrage. Ils sont tenus dans `docs/QUESTIONS-OUVERTES.md`, avec leur numéro.

- **20** — axe « poste de travail » : la fiche raisonne en filières et niveaux.
- **28** — mode sombre : différé.
- **29** — imagerie des modules : photo d'habillage au sas, schéma de cascade.
- **38** — évaluation transversale, « session mixte ».
- **39** — tutoriel d'usage du site.
- **40** — accès rapide : conflit éventuel de `⌘K`, ordre des items de la file.

Hors de cette liste, un chantier tranché sur le principe et non construit :
le **parcours dégradé** pour intérimaire et remplaçant, composé à la main et
marqué « dégradé » partout (question 36, choix b, du 18/09/2026 ; consigné
dans `DECISIONS.md`, pas dans `QUESTIONS-OUVERTES.md`).

Et deux points d'exploitation :

- **Supabase** — activer « Enforce SSL on incoming connections », maintenant
  que la liaison est mesurée en TLSv1.3.
- **`DATABASE_SSL=verify` + autorité de certification Supabase** — différé
  par décision, à poser avant la mise en service.

---

## Ordre conseillé

1. **A4** — l'avis du DPO, parce qu'il conditionne A3 et la date de A2, et
   qu'il ne dépend pas de moi.
2. **A1** — la référence de procédure, dès qu'elle existe : une ligne dans
   Render, et tous les écrans cessent de dire qu'elle manque.
3. **B2 et B3** — les données locales et les procédures : elles rendent les
   deux modules existants complets, donc utilisables en vrai.
4. **B1** — la rédaction des 56 textes, qui court en fond.
5. **A3 puis A2** — la durée, puis la date, en dernier : la date change la
   nature de toutes les pièces produites.

`[à vérifier]` : cet ordre est un conseil d'organisation, pas une exigence
réglementaire. Aucun texte ne l'impose.
