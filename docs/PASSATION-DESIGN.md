# Passation de design — Formation &amp; habilitation, unité de pharmacotechnie (CHD Vendée)

## Vue d'ensemble

Outil interne Next.js 15 de formation et d'évaluation des préparateurs en pharmacie d'une
unité de production de chimiothérapies, et des internes en rotation. Il couvre **les deux
premières étapes d'une chaîne d'habilitation en six étapes** : formation théorique, puis
évaluation des connaissances. Les quatre suivantes se déroulent au poste de travail et
devant le pharmacien responsable.

**Le message que le design doit porter, avant toute considération graphique : valider un
module à l'écran ne vaut pas habilitation.** Si un utilisateur ressort de l'application en
croyant l'inverse, l'implémentation a échoué. Ce message est répété, en clair, sur chaque
écran de cette passation — ne le supprimez pas en refactorisant.

Ce lot couvre la refonte visuelle complète et quatre écrans : accueil / programme, module,
parcours d'évaluation (réglage → passation → correction), connexion, plus le rapport A4
imprimable. Les écrans d'administration (`/admin` : codes, dépôts, ordonnancement) ne sont
pas traités.

## À propos des fichiers de design

Les fichiers de `maquettes/` sont des **références de design écrites en HTML** : des
prototypes qui montrent l'apparence et le comportement attendus. **Ce ne sont pas des
composants de production à copier tels quels.** Ils utilisent un format de composant
propriétaire (`.dc.html`, exécuté par `support.js`) dont la syntaxe — `<sc-for>`, `<sc-if>`,
`{{ hole }}`, `class Component extends DCLogic` — n'a aucun équivalent dans votre
codebase.

La tâche est de **recréer ces maquettes dans l'environnement existant du projet** :
Next.js 15 (App Router), React, CSS pur avec variables sur `:root`, sans framework CSS ni
librairie de composants. Les `<sc-for list={{x}}>` deviennent des `.map()`, les `<sc-if>`
des rendus conditionnels, les `style="…"` inline du CSS réutilisant les classes fournies
dans `globals.css`.

Pour ouvrir une maquette : servez le dossier `maquettes/` en HTTP (par exemple
`npx serve maquettes`) et ouvrez le fichier `.dc.html` — `support.js` doit être servi depuis
le même dossier. Les polices viennent de Google Fonts (Inter) ; le double-clic sur le
fichier local fonctionne aussi dans la plupart des navigateurs.

## Fidélité

**Haute fidélité (hifi).** Couleurs, typographies, espacements, rayons, ombres, cibles
tactiles, états et copie sont définitifs et vérifiés en contraste. Recréez l'interface
fidèlement. La copie française est rédigée pour ce contexte et ne doit pas être réécrite
sans validation du pharmacien responsable — en particulier les libellés de critères,
transcrits de la fiche d'habilitation, qui **font foi**.

Le fichier `globals.css` fourni est, lui, **du code de production** : il remplace
`app/globals.css` et porte tous les jetons et toutes les classes décrites ci-dessous.

## Contraintes non négociables

### Charte graphique Hôpitaux de Vendée (GHT 85, octobre 2025)

| Rôle | Couleur | Usage |
|---|---|---|
| Primaire 1 | `#005586` bleu foncé | titres, panneaux, actions. **Majoritaire** |
| Primaire 2 | `#E82A63` rose | barre d'identité, accents, barre de progression. **Majoritaire** |
| Secondaire 1 | `#46B4B3` turquoise | accent ponctuel uniquement |
| Secondaire 2 | `#F4C137` jaune | accent ponctuel uniquement |

Turquoise et jaune ne doivent jamais devenir dominants. Dans le fond organique, ils sont
limités à deux formes de faible opacité (0,24 et 0,22 d'alpha) et de petite taille.

Éléments d'identité obligatoires : **barre rose verticale de 5 px sur tout le bord gauche**
(`body { border-left: 5px solid #E82A63 }`), **bandeau bleu horizontal en pied de page**,
logos *Hôpitaux de Vendée* et *Pharmacotechnie* jamais déformés, recolorés ni recadrés.

⚠️ Les maquettes affichent des **emplacements en pointillé** (« LOGO HDV », « LOGO
PHARMACO ») à la place des logos : les fichiers n'étaient pas fournis. Remettez les images
réelles du projet (`public/`), aux hauteurs indiquées dans `globals.css`
(`.logos img.hdv { height: 30px }`, `.logos img.pharmaco { height: 44px }`).

### Typographie

`"Aptos", "Inter", ui-sans-serif, system-ui, …` — Aptos est présente sur les postes du CHD
via Office ; Inter est le repli web (poids 400/500/600/700 ; servie par le site depuis le
23/09/2026, plus par Google Fonts — `docs/DECISIONS.md`). **Gilroy est
réservé à l'imprimé par la charte : ne pas l'utiliser ici.**

### Accessibilité — WCAG 2.1 AA

Cette cible a piloté plusieurs décisions, à ne pas défaire :

- Contraste ≥ 4,5:1 sur **tout** le texte, légendes comprises. L'ancien gris `#7b8792`
  (3,67:1 sur blanc) n'est plus utilisé pour du texte : il est remplacé par
  `--texte-doux: #566370` (6,1:1). `--trait-faible: #7b8792` ne sert plus qu'aux traits.
- La pastille « Obligatoire » utilise `#b41f4d` et non `#E82A63` : le rose de charte en
  fond avec du blanc 11 px ne donne que 4,25:1 ; `#b41f4d` donne 6,5:1. Le rose de charte
  reste utilisé pour les grandes surfaces et les traits, jamais sous du petit texte blanc.
- **Jamais la couleur seule.** Verdict, état « acquis / non acquis », « obligatoire »,
  « éliminatoire », « à rédiger », discordances : chaque état porte un libellé en texte en
  plus de sa couleur.
- Cibles tactiles ≥ 44 px (`--cible`), 52 px pour les actions principales
  (`--cible-large`) : l'usage sur tablette en zone, gants aux mains, est un cas réel.
- `:focus-visible` à 3 px sur tous les éléments focalisables, lien d'évitement en premier
  élément du document, `aria-current` sur la section courante du sommaire,
  `role="progressbar"` avec `aria-valuenow` tenu à jour.
- `@media (prefers-reduced-motion: reduce)` neutralise le défilement animé, toutes les
  transitions et les dérives du fond. Le retour en haut passe alors en `behavior: "auto"`.
  **Ne réintroduisez aucune animation hors de cette garde.**

### Ce qu'il ne faut pas faire (demande explicite du commanditaire)

- Pas de gamification, pas de badges, pas de félicitations à la validation d'un module.
- Pas de barre de progression suggérant un avancement **d'habilitation** : la seule
  progression affichée est celle de la session (`« Avancement de cette session — ce n'est
  pas un avancement d'habilitation »`) et celle de la lecture d'un module.
- Pas d'illustration 3D, pas de dégradé pastel décoratif hors du fond organique défini
  ici.
- Pas de réécriture des libellés de critères.

## Langage visuel de cette refonte

Deux nouveautés par rapport à la version précédente :

**1. Fond organique animé (`.fond-organique`)** — quatre formes floutées en couche fixe
derrière le contenu : bleu de charte en haut à gauche, rose à droite, turquoise et jaune en
touches basses. Rayons asymétriques (`border-radius: 62% 38% 55% 45% / 48% 58% 42% 52%`),
`filter: blur(78–92px)`, dérives de 46 à 68 secondes en `ease-in-out infinite alternate`,
amplitude ±5 % de translation et ±9 % d'échelle — volontairement sous le seuil de
perception directe. La couche est `position: fixed; inset: 0; z-index: -1;
pointer-events: none` et porte `aria-hidden="true"`. Markup attendu :

```html
<div class="fond-organique" aria-hidden="true">
  <span class="forme-1"></span><span class="forme-2"></span>
  <span class="forme-3"></span><span class="forme-4"></span>
</div>
```

**2. Verre dépoli (`.verre`, `.carte`, `.panneau-titre`)** — `background:
rgba(255,255,255,.72 → .88)` + `backdrop-filter: blur(16–22px) saturate(140–150%)` (avec
préfixe `-webkit-`) + bordure `rgba(255,255,255,.9)` + ombre bleutée
`0 10px 30px rgba(0,85,134,.08)`. **Les opacités sont hautes à dessein** : le texte reste
en `#16202a` sur un fond quasi blanc, donc le 4,5:1 tient même quand une forme colorée
passe derrière. N'abaissez pas ces valeurs sans remesurer le contraste.

Note de performance : `backdrop-filter` coûte en GPU. Sur les postes anciens de l'unité,
prévoyez un réglage de désactivation (`@media (prefers-reduced-transparency: reduce)` ou un
flag applicatif) qui retombe sur `background: var(--surface)` opaque.

## Écrans

### 1. Accueil / programme — `maquettes/Accueil - navigation confort.dc.html`

**Objet.** Répondre à « qu'est-ce que je dois faire aujourd'hui », et seulement ensuite
expliquer comment le dispositif est construit. C'était le principal défaut de la version
précédente : l'apprenant traversait trois sections de gouvernance avant son contenu.

**Structure (de haut en bas).**

1. `.progression-lecture` — 4 px, fixée en haut, jauge rose `#E82A63` qui se remplit au
   défilement. `role="progressbar"`, `aria-valuenow` en pourcentage entier.
2. Lien d'évitement `.lien-evitement` (hors écran, visible au focus).
3. `.entete` — fixe, verre dépoli à 88 %, `top: 4px` (sous la jauge), `left: 5px` (après la
   barre rose). Logos + « Formation &amp; habilitation » / « Unité de production — CHD
   Vendée », nav d'ancres (Mes modules, Le dispositif, L'évaluation, Questions), bouton
   Connexion. **Se masque au défilement descendant** (`transform: translateY(calc(-100% -
   4px))`, 260 ms) et réapparaît dès 6 px de défilement montant ; toujours visible dans les
   `hauteur + 8 px` premiers pixels.
4. `.cale-entete` — cale compensant la hauteur **réelle** de l'en-tête. Un
   `ResizeObserver` écrit `hauteur + 4px` dans la cale et `hauteur + 20px` dans la variable
   CSS `--decalage`, consommée par `scroll-margin-top` des sections ancrées. Indispensable :
   l'en-tête passe sur deux lignes sous 1000 px de large, et une valeur en dur masquait le
   haut de page.
5. Héros en `.panneau-titre` (verre à 72 %, rayon 20 px, padding 36/32) : sur-titre mono
   rose `#b41f4d` 11 px `letter-spacing:.12em` en capitales, `h1` 42 px / 1,1 /
   `-0.025em` en `#005586` sur 26 ch, paragraphe 17 px / 1,6, deux actions, puis une ligne
   13 px `#566370` : « Aucun compte nominatif · résultats non conservés · 2 modules en ligne
   sur 53 critères ».
6. `#modules` — deux cartes `.carte--module` (verre 84 %, `border-left: 4px solid #005586`) :
   code `B1-01` en pastille mono, pastille rose « Obligatoire », contexte, `h3` 21 px,
   objectif, trois métadonnées (durée, 9 questions · 1 mise en situation, seuil 80 % · 2
   éliminatoires), colonne d'actions de 190 px (Lire le module / Passer l'évaluation) et
   état « Non évalué dans cette session ».
7. `#dispositif` — les 6 étapes en `<ol>` de cartes, chacune avec son numéro en pastille
   carrée, son étiquette de lieu (`.etiquette--site` bleue « Dans ce site »,
   `.etiquette--poste` turquoise « Au poste », `.etiquette--pharmacien` rose
   « Pharmacien ») et la **preuve attendue**.
8. `#evaluation` — grille des six formats (QCM, QIM, vignette, éliminatoire, correction
   sourcée, rapport) avec leur barème explicite. C'est la réponse au risque « je coche au
   hasard une QIM en croyant être en tout ou rien ».
9. `#questions` — accordéon `<details>` de six questions. La première est
   « Si je valide le module, suis-je habilité ? » → « Non. » C'est l'endroit où le
   malentendu se lève noir sur blanc.
10. Bandeau d'appel final sur `#005586`, puis `.pied` (mentions non nominatives + statut du
    dispositif `[à préciser]`) et `.bandeau-bleu` (adresses des trois sites).
11. `.retour-haut` — invisible jusqu'à **1,8 hauteur d'écran**, puis `opacity`/`translateY`
    en 220 ms. Au clic : remontée douce **et** focus replacé sur l'en-tête
    (`focus({ preventScroll: true })`).

**À compléter côté données.** La liste des 39 autres critères du programme est annoncée
mais pas dépliée dans cette maquette. Décision prise avec le commanditaire : les afficher
**repliés par bloc** (`details.bloc`, 7 blocs), en lignes discrètes `.ligne-critere`
(fond `--surface-douce`, 13 px `--texte-doux`, code mono, mention « Obligatoire » en
`#b41f4d`, état « À rédiger »). Le modèle de ces lignes est visible dans
`maquettes/Accueil - 5 directions.dc.html`, options `1a` et `1b`.

### 2. Module — `maquettes/Module - lecture longue.dc.html`

**Objet.** Lecture longue confortable (5 sections, 40 min) reprenable après interruption.

- Même en-tête dynamique, même jauge, même retour en haut que l'accueil.
- `.panneau-titre` : `B1-01`, pastille Obligatoire, contexte, `h1` 36 px sur 30 ch,
  objectif, trois pastilles de métadonnées.
- Layout `.module` : `grid-template-columns: 238px minmax(0,1fr)`, `gap: 2rem`. Sous 62 rem,
  une colonne et sommaire non collant.
- `.sommaire` collant à `calc(var(--decalage) + 1rem)` : 5 entrées, **section courante
  marquée par un filet rose à gauche + fond bleu clair + graisse 650 +
  `aria-current="true"`**. Le repérage se fait au défilement (dernière section dont le haut
  est passé sous `hauteur d'en-tête + 40 px`), dans le même `requestAnimationFrame` que la
  jauge — pas d'observateur supplémentaire.
- Texte : 17 px / 1,75, `max-width: 68ch`, `text-wrap: pretty`. Les points clés sont des
  paragraphes à filet rose gauche (`.point-cle`) avec amorce en gras — pas des encadrés
  colorés, pour ne pas hacher la lecture.
- **Sources par section** dans un `<details>` replié (« Sources de cette section ») : la
  traçabilité est disponible sans casser le flux de lecture.
- Documents rattachés : 5 lignes, nature en pastille, deux marquées `[à rattacher]` avec le
  style monospace ambre à bordure pointillée (`.a-preciser`) — procédure interne et vidéo
  restent à produire.
- Bandeau bleu « L'évaluation de ce critère comporte 9 questions », puis bibliographie.
- **Reprise de lecture** : la section courante est écrite dans
  `localStorage["chd-b1-01-lecture"]` (`{id, titre, num}`), avec un debounce de 600 ms, dans
  un `try/catch` (le stockage peut être refusé). À l'ouverture, si un repère existe, un
  bouton turquoise apparaît dans l'en-tête : « Reprendre : *titre de section* ». Le
  sommaire offre « Oublier ce repère ». C'est la seule donnée persistée par
  l'application, elle est locale au poste et non nominative — le pied de page le dit.

### 3. Évaluation — `maquettes/Evaluation - passation et correction.dc.html`

Trois états dans un seul écran : `reglage` → `passation` → `correction`.

**Réglage.** Trois tirages en `<label>` de 56 px : Découverte (5 questions), Habilitation
(9 questions, tirage de référence, toutes les éliminatoires incluses), Complet. Le seuil et
la règle des éliminatoires sont annoncés **avant** de commencer.

**Passation.**

- Une `fieldset.question` par question : rang « Question n / 9 », **format en pastille
  bleue** (`QCM — une seule réponse`, `QCM — plusieurs réponses`, `QIM — barème à la
  discordance`), pastille rose « Éliminatoire » le cas échéant, énoncé 19 px / 650 sur
  60 ch, puis **le barème en clair sous l'énoncé**.
- **La QIM est refondue.** Au lieu de cinq cases à cocher (où ne rien cocher passait pour
  une réponse), chaque proposition est jugée **Vrai / Faux** par une paire de radios de
  48 px, avec l'avertissement : « Chaque proposition se juge séparément — une proposition
  laissée sans réponse compte comme une discordance ». C'est la correction du défaut n° 5
  du brief. Le mode « cases à cocher » reste implémenté pour comparaison
  (prop `qimEnVraiFaux`) ; tranchez avec les préparateurs avant de retirer l'un des deux.
- **Vignette de mise en situation** (`.vignette`) : verre 86 %, bordure bleue + filet gauche
  5 px, sur-titre « Mise en situation — lisez posément », titre 22 px, deux paragraphes en
  **16 px / interligne 1,7** (plus grand et plus aéré que le reste : le but est de faire
  ralentir la lecture), et la mention « Deux questions portent sur cette situation ».
- `.barre-passation` fixée en bas : « n / 9 questions renseignées », jauge bleue,
  avertissement « Avancement de cette session — ce n'est pas un avancement d'habilitation »,
  bouton « Valider l'évaluation » de 52 px. Prévoyez une cale de bas de page (`padding-bottom:
  120px` sur le conteneur) pour que la barre ne recouvre pas la dernière question.

**Barème implémenté (à reproduire tel quel).**

| Format | Règle |
|---|---|
| QCM une réponse | 1 point si exact, 0 sinon |
| QCM plusieurs réponses | tout ou rien : l'ensemble coché doit être exactement l'ensemble attendu |
| QIM | 0 discordance → 1 point ; 1 discordance → 0,5 ; ≥ 2 → 0. **Une proposition sans réponse est une discordance** |
| Éliminatoire | erreur ou absence de réponse → critère non acquis, quel que soit le score |

Score = somme / 9, arrondi à l'entier en pourcentage ; points affichés avec virgule
décimale (`0,5`). Acquis = `pct >= seuil && !échecÉliminatoire`.

**Correction.**

- `.resultat-entete` : score 44 px, « n / 9 points — seuil de réussite 80 % », verdict en
  titre **coloré et libellé** (« Critère acquis pour cette évaluation » / « Critère non
  acquis »), motif, et si échec éliminatoire un encadré `--echec-fond` bordé : « Échec sur
  une question éliminatoire : le critère est non acquis quel que soit le score. »
- Une `.correction` par question, filet gauche de 5 px : vert `#1f6b45` (exact), ambre
  `#8a5a00` (partiel, QIM à une discordance), rouge `#99271f` (erroné / annulé). En-tête :
  rang, état en texte (« Réponse exacte », « 2 discordances »…), pastille Éliminatoire,
  points à droite. Puis énoncé, « Votre réponse », « Attendu », justification 15 px / 1,65
  sur 66 ch, et **la source sur un filet séparé**.
- Bloc de sortie : « Ce résultat ne vaut pas habilitation… », Exporter le rapport / Nouveau
  tirage / Revoir le module.

**Contenu.** Les 9 questions du critère B1-01 sont réelles (énoncés, options,
justifications, sources), y compris la mise en situation « Le sas, la porte et le carton »
(~700 caractères, 2 paragraphes). Elles sont dans la méthode `banque()` du fichier et
doivent venir de la base en production.

### 4. Connexion — `maquettes/Connexion - code de role.dc.html`

- `h1` « Un code ouvre un profil, pas un compte », explication en 17 px.
- **Bandeau d'avertissement `role="status"`** quand la base n'est pas branchée :
  « Contrôle d'accès inactif — le site est ouvert à quiconque a l'adresse », avec la
  marche à suivre (stores Postgres et Blob) et la phrase « Cet état doit être levé avant
  tout usage du dispositif comme preuve en audit ». Piloté par la prop `controleInactif`.
- Formulaire : champ code en monospace 20 px, `letter-spacing:.08em`, 56 px de haut,
  placeholder `XXXXX-XXXXX`, `aria-describedby` vers l'aide. Bouton Entrer désactivé tant
  que le champ est vide ; « Consulter sans code » toujours disponible. Erreur en
  `role="alert"`.
- Colonne « Ce qu'ouvre chaque profil » : Poste de travail (apprenant, aucun code requis),
  Tutorat (dépôts, ordonnancement), Administration (codes, programme).
- Encadré bleu « Ce que le site enregistre : rien de nominatif » — quatre garanties en
  clair, dont le repère de lecture local.

### 5. Rapport A4 — `maquettes/Rapport evaluation - A4 imprimable.dc.html`

La seule pièce qui quitte l'outil et arrive sur le bureau du pharmacien. Construite comme
un **document imprimable en flux** (A4, marges 0,7 in), pas comme une page web :

- **En-tête répété sur chaque page** : logos, « CHD Vendée — Pharmacie à usage intérieur,
  unité de pharmacotechnie », « Rapport d'évaluation des connaissances — fiche
  d'habilitation, chapitre III, critère B1-01 », référence du tirage et date à droite,
  filet rose 2 pt en dessous.
- **Pied répété** : mention sans donnée nominative + « Statut du dispositif : [à préciser] ».
- Page 1 : sur-titre « Étape 2 sur 6 », titre du critère 22 pt, ligne de contexte, puis
  **tableau verdict / score** bordé 1,5 pt bleu ; tableau « Identification, à compléter à la
  main » (nom, fonction, date) — le fichier ne contient volontairement aucune identité ;
  **synthèse par question** (n°, format, objet, résultat, points) avec `<thead>` répété ;
  encadré ambre « Ce rapport ne vaut pas habilitation » ; **tableau de visas** (apprenant,
  tuteur N3, pharmacien responsable) avec cellules de 56 px pour la signature manuscrite,
  suivi de la précision : le visa du pharmacien accuse réception de la preuve de l'étape 2,
  il ne prononce pas l'habilitation (chapitre IV).
- Page 2 et suivantes (`break-before: page`) : détail question par question — état, format,
  éliminatoire, points, énoncé, réponse donnée, attendu, justification, source. Puis les
  références du module.
- Corps à 12 pt minimum, `break-inside: avoid` sur chaque bloc de correction et chaque
  ligne de tableau, `orphans/widows: 3`.
- Export : impression navigateur → PDF. Les règles `@media print` de `globals.css`
  neutralisent verre dépoli, fond organique, en-tête fixe, jauge, barres et boutons.

### 6. Document d'exploration — `maquettes/Accueil - 5 directions.dc.html`

Dix directions d'accueil explorées avant arbitrage (tour 1 : fil unique, rail + liste
dense, matrice critères × niveaux, recherche d'abord, chaîne en bandeau ; tour 2 :
architectures de landing). **Direction retenue : le fil unique (`1a`) enrichi des tuiles
« fait / hors du site » (`2a`), de la grille des formats (`2c`) et de l'accordéon (`2e`)**
— c'est-à-dire l'écran 1 de cette passation. Ce fichier est fourni comme trace de
décision et comme réserve de motifs (matrice pour le profil tutorat, liste dense pour les
41 critères, recherche pour les internes). Il n'est pas à implémenter.

## Interactions et comportements

| Comportement | Détail d'implémentation |
|---|---|
| En-tête masqué / rétabli | Un seul écouteur `scroll` sur `window` en `{ passive: true, capture: true }` (la capture attrape aussi un conteneur défilant), tout le travail dans un `requestAnimationFrame` avec garde anti-rafale. Seuils : +6 px de delta pour masquer, −6 px pour rétablir, jamais masqué sous `hauteur + 8 px`. |
| Hauteur d'en-tête | `ResizeObserver` sur l'en-tête → `.cale-entete { height }` et `--decalage` sur la racine. Ne jamais figer 72 px : l'en-tête wrappe sous ~1000 px. |
| Jauge de lecture | `haut / (scrollHeight − hauteurVue)`, écrite en `%` sur la jauge, arrondie à l'entier dans `aria-valuenow`. |
| Retour en haut | Visible au-delà de `1.8 × hauteurVue` (réglable 1 → 3). `scrollTo({ top: 0, behavior })`, `behavior: "auto"` si `prefers-reduced-motion`. Focus replacé sur l'en-tête. |
| Ancres | `scroll-margin-top: var(--decalage)` sur chaque section ancrée. |
| Sommaire du module | Section courante = dernière dont `getBoundingClientRect().top <= hauteurEntête + 40`. Mise à jour du style et de `aria-current` seulement au changement. |
| Reprise de lecture | `localStorage["chd-b1-01-lecture"]`, debounce 600 ms, `try/catch`, effaçable par l'utilisateur. |
| Accordéons | `<details>/<summary>` natifs (clavier et lecteur d'écran gratuits). Marqueur `+` / `–` en `::after`, marqueur natif masqué. |
| Passation | État local : `{ etape, tirage, rep }`. `rep[idQuestion]` = index (QCM simple), `{i: bool}` (QCM multiple), `{i: true|false|undefined}` (QIM). Aucun envoi réseau, aucune persistance. |
| Nettoyage | Écouteurs `scroll`/`resize` retirés et `ResizeObserver` déconnecté au démontage ; `clearTimeout` du debounce. |

## État applicatif à prévoir

- **Session d'évaluation** (mémoire de l'onglet, jamais persistée) : critère, tirage,
  réponses, score calculé, verdict. Perdue à la fermeture — c'est voulu et annoncé.
- **Repère de lecture** : `localStorage`, une clé par module.
- **Profil d'accès** : code de rôle → profil (`poste`, `tutorat`, `administration`).
  Tant que la base n'est pas branchée, `controleInactif = true` et le bandeau d'alerte
  s'affiche.
- **Données de référence à servir** : 7 blocs, 53 critères (40 obligatoires, 18 au socle
  transversal), niveaux `N1a / N1b / N1c / N2 / N3` et `N1c→2`, modules rédigés,
  banques de questions, documents rattachés, bibliographies.

## Jetons de design

Tous présents dans `globals.css`. Résumé :

**Couleurs** — `#005586` `#003f65` `#e6f0f5` `#e82a63` `#b41f4d` `#46b4b3` `#f4c137` ·
surfaces `#f5f7f9` `#ffffff` `#f0f2f4` · bords `#d8dde2` `#b6bec6` · texte `#16202a`
`#566370` · traits `#7b8792` · succès `#1f6b45` / `#e6f3ec` · alerte `#8a5a00` /
`#fdf3e0` · échec `#99271f` / `#fbeae8`.

**Verre** — `rgba(255,255,255,.88 / .82 / .72)`, bordure `rgba(255,255,255,.9)`,
`blur(16px) saturate(140%)` et `blur(20px) saturate(150%)`.

**Rayons** — 20 / 14 / 10 px, pastilles 999 px.
**Ombres** — `0 1px 2px rgba(16,24,32,.04), 0 10px 30px rgba(0,85,134,.08)` et la variante
haute `0 22px 60px rgba(0,85,134,.12)`.
**Typographie** — 42 / 36 / 32 px (h1 selon écran), 26 / 22 px (h2), 21 / 19 / 17 px
(h3, énoncés, corps de lecture), 16 px (options), 15 / 14 / 13 px (secondaire), 12 px
(mentions), 11 px mono (sur-titres, codes, pastilles). Interlignes 1,1 à 1,15 pour les
titres, 1,55 à 1,75 pour le texte. `letter-spacing` −0,025 em sur les grands titres,
+0,05 à 0,12 em sur les capitales mono.
**Mesures** — cibles 44 / 48 / 52 / 56 px, largeur de contenu 70 rem, longueur de ligne
68 ch, transitions 120 ms (jauge) / 220 ms (apparitions) / 260 ms (en-tête).

## Assets

- **Logos HdV et Pharmacotechnie : à remettre depuis le projet** (emplacements en pointillé
  dans les maquettes).
- **Imagerie du module** : deux emplacements rayés attendent une photo d'habillage au sas et
  un schéma de cascade de pression — à produire en interne, avec accord des agents
  photographiés.
- **Police Inter** : Google Fonts, poids 400/500/600/700. Aptos vient des postes CHD.
- Aucune icône bitmap ni SVG décoratif : les marqueurs sont des formes CSS (carrés de 7 px,
  pastilles, filets) et des glyphes texte (`↑`, `+`, `›`).

## Fichiers de ce paquet

```
design_handoff_formation_habilitation/
├── README.md                                     ← ce document
├── globals.css                                   ← remplace app/globals.css (code de production)
├── BRIEF-DESIGN.md                               ← brief d'origine du commanditaire
└── maquettes/
    ├── Accueil - navigation confort.dc.html      ← écran 1, direction retenue
    ├── Module - lecture longue.dc.html           ← écran 3
    ├── Evaluation - passation et correction.dc.html ← écrans 4, 5 et 6
    ├── Connexion - code de role.dc.html          ← écran 2
    ├── Rapport evaluation - A4 imprimable.dc.html ← rapport exporté
    ├── Accueil - 5 directions.dc.html            ← 10 directions explorées (trace de décision)
    ├── doc-page.js                               ← moteur de pagination du rapport
    └── support.js                                ← runtime des maquettes (non destiné à la production)
```

## Points ouverts

1. **Statut du dispositif** : outil pédagogique ou preuve opposable en audit BPP 2023 /
   ISO 9001 ? Le marqueur `[à préciser]` (monospace, fond ambre, bordure pointillée) est
   présent en pied de chaque écran et doit **rester visible** jusqu'à décision. La réponse
   change les exigences de conservation et d'horodatage.
2. **Mode sombre** : décision « à traiter plus tard ». Le bloc commenté en fin de
   `globals.css` liste les trois points à reprendre (jetons de verre propres au thème,
   alphas du fond divisés par deux, contrastes des primaires éclaircies à remesurer).
3. **Classes ISO local par local** et composition exacte des sas : à préciser avec le
   pharmacien responsable avant diffusion du module B1-01.
4. **Présentation des QIM** : Vrai/Faux (par défaut) ou cases à cocher — à trancher avec
   les préparateurs, les deux modes sont implémentés.
5. **56 critères sur 58 restent à rédiger.** Le design les traite en lignes discrètes
   repliées par bloc ; la charge rédactionnelle reste entière.
6. **Écrans d'administration** (`/admin`) non traités : denses, orientés tableau, à
   concevoir après validation des écrans apprenant. Le motif « matrice critères × niveaux »
   de `Accueil - 5 directions.dc.html` (option `1c`) en est le point de départ.

---

# Journal d'intégration (Claude Code, 18/09/2026)

Ce qui a été repris du présent handoff, et ce qui reste ouvert.

## Fait

- `globals.css` installé tel quel, suivi d'un bloc « Supplément applicatif »
  clairement délimité en fin de fichier pour les classes que la passation ne
  couvrait pas (`.section-titre`, `.tuiles`, `.champ`, `.encart`, `.etapes`,
  `.choix-difficulte`, `.barre-passation-interne`…). À fusionner lors d'une
  prochaine itération de design.
- Coque d'interface (`components/Chrome.tsx`) : jauge de lecture, lien
  d'évitement, en-tête masqué/rétabli au défilement, `ResizeObserver` écrivant
  `--decalage`, retour en haut avec focus replacé, `prefers-reduced-motion`.
- Fond organique à quatre formes, `aria-hidden`, en couche fixe.
- Logos réels remis en place aux hauteurs prévues.
- ~~Inter chargée par `<link>` plutôt que `next/font` — pas de récupération au
  build, et le rendu reste correct si Google Fonts est injoignable depuis le
  réseau de l'établissement.~~ Remplacé le 23/09/2026 : Inter est servie par
  le site, sans aucun appel à Google (`docs/DECISIONS.md`).
- Accueil restructuré : héros, `#modules`, `#dispositif` (6 étapes avec leur
  étiquette de lieu et leur preuve), `#evaluation` (les 6 formats et leur
  barème), programme complet replié par bloc en `.ligne-critere`, conditions
  des niveaux, `#questions` en accordéon — la première question étant
  « Si je valide le module, suis-je habilité ? → Non. »
- **QIM refondues en Vrai/Faux** avec la conséquence de notation qui va avec :
  une proposition non jugée compte comme une discordance. Le serveur reçoit
  désormais deux champs (`reponses` = propositions jugées vraies, `juges` =
  propositions jugées) car « non cochée » et « non jugée » ne peuvent pas être
  distinguées autrement. Vérifié : tout juste → 1 pt ; une non jugée → 0,5 ;
  rien jugé → 5 discordances → 0. L'ancien mode cases à cocher reste
  disponible via `qimEnVraiFaux={false}`.
- Correction à trois états (`--exacte` / `--partielle` / `--erronee`), encadré
  d'échec éliminatoire, bloc de sortie « ce résultat ne vaut pas habilitation ».
- Barre de passation fixe avec avancement de session explicitement distingué
  d'un avancement d'habilitation.

## Non fait — par ordre d'intérêt

1. **Module en lecture longue** : le sommaire collant à deux colonnes, le
   repérage de section au défilement, les `.point-cle` à filet rose, les
   sources par section en `<details>` replié et la reprise de lecture en
   `localStorage` ne sont pas implémentés. La page module a seulement reçu le
   nouveau vocabulaire de classes.
2. **Rapport A4** : `lib/rapport.ts` produit toujours l'ancien HTML imprimable.
   La maquette (en-tête et pied répétés, tableau de visas, synthèse par
   question, pagination `break-before`) n'est pas reprise.
3. **Connexion** : classes mises à jour, mais la colonne « Ce qu'ouvre chaque
   profil » et l'encadré « Ce que le site enregistre » ne sont pas là.
4. **Écrans d'administration** : non traités par le design, non retouchés.
5. **Mode sombre** : resté en attente, comme décidé.
6. **Imagerie du module** (photo d'habillage au sas, schéma de cascade de
   pression) : à produire en interne.
7. **Repli `prefers-reduced-transparency`** pour les postes anciens : le
   `backdrop-filter` n'a pas de solution de repli opaque.
