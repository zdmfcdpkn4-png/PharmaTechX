# Accès rapide — spécifications fonctionnelles et ergonomiques

Statut : **construit le 21/09/2026** (paquet A), dans `components/AccesRapide.tsx`,
`content/acces-rapide.ts` et `lib/attente.ts`. Rédigée le 19/09/2026 à la
demande du pharmacien responsable.

Trois points de cette spécification ont été **écartés à la construction**, et
un quatrième était faux : voir le § 9, réécrit en conséquence. Le reste est
implémenté tel qu'écrit, et les huit critères d'acceptation du § 8 sont
vérifiés par le parcours de bout en bout (`e2e/parcours.e2e.js`).

---

## 1. Le problème que ce composant règle — et celui qu'il ne règle pas

Le volet de navigation répond à la question **« où puis-je aller ? »**. Depuis
sa refonte du 19/09/2026 il y répond bien : groupes repliés, un seul ouvert,
332 px sur l'accueil et 771 px sur l'administration dépliée, contre plus de
1 400 px auparavant.

Il ne répond pas à **« fais ce pour quoi je suis venu »**. Aujourd'hui, les
tâches les plus fréquentes coûtent deux à quatre actions, et surtout elles
commencent toutes par un **déplacement à l'aveugle** : rien, sur l'écran où
l'on se trouve, ne dit s'il y a des signalements ouverts, des questions à
relire ou des rapports en attente de visa. On va voir. Souvent pour rien.

| Profil | Tâche fréquente | Aujourd'hui |
|---|---|---|
| Poste | Reprendre le module en cours | accueil → sommaire → module → section |
| Poste | Lancer l'évaluation d'un module | accueil → module → Commencer |
| Tutorat | Relire les questions « à vérifier » | volet → Banque → filtre statut |
| Tutorat | Traiter un signalement | volet → Signalements |
| Tutorat | Créer un identifiant d'agent | volet → Personnel → Créer |
| Administration | Viser un rapport | volet → Rapports → ouvrir → viser |
| Administration | Arbitrer un verdict indéterminé | volet → Rapports → repérer → arbitrer |

**Ce que l'accès rapide fait** : porter ces tâches à **une ouverture et un
clic**, et montrer *avant* le clic s'il y a quelque chose à y faire.

**Ce qu'il ne fait pas** : remplacer le volet. Deux systèmes de navigation
concurrents coûtent plus qu'ils ne rapportent. Le volet reste la carte ;
l'accès rapide est le raccourci.

---

## 2. Principes retenus, et ce qui les fonde

Les principes ci-dessous ne sont pas décoratifs : chacun se traduit par une
règle opposable en section 3 à 6. Les références sont données pour être
vérifiées, non pour faire nombre.

**a. La cible doit être grande et proche.** Le déclencheur est un carré fixe
en haut à gauche, jamais déplacé, jamais masqué. C'est la loi de Fitts : le
temps d'atteinte croît avec la distance et décroît avec la taille de la
cible (Fitts 1954). Un coin est en pratique une cible de taille infinie sur
un axe — le pointeur y bute.

**b. Moins de choix visibles, plus vite décidé — mais pas n'importe comment.**
La loi de Hick-Hyman (Hick 1952 ; Hyman 1953) lie le temps de décision au
logarithme du nombre d'options. **Attention à son usage** : elle est établie
pour des alternatives équiprobables et apprises, et ne décrit pas la
recherche visuelle dans un menu qu'on découvre, qui est d'abord linéaire.
Elle justifie de **limiter à cinq** la liste d'actions fréquentes ; elle ne
justifie pas d'enfouir le reste.

**c. Large et plat plutôt qu'étroit et profond.** Les travaux sur les menus
hiérarchiques convergent : à nombre d'items égal, une arborescence large et
peu profonde bat une arborescence étroite et profonde, en temps comme en
erreurs (Kiger 1984 ; Landauer & Nachbar 1985). D'où **deux niveaux au
maximum** dans le panneau.

> **Une erreur à ne pas commettre ici.** On invoque couramment le « nombre
> magique 7 ± 2 » de Miller (1956) pour plafonner un menu. C'est un
> contresens : Miller mesurait l'empan de mémoire immédiate pour des éléments
> **sans rapport entre eux et non affichés**. Un menu est visible en
> permanence — il n'y a rien à mémoriser. Le plafond de cinq retenu plus bas
> vient du temps de balayage et de la place disponible, pas de Miller.

**d. Reconnaître plutôt que se rappeler.** Sixième heuristique de Nielsen
(1994). Les intitulés du panneau sont **ceux du volet, mot pour mot** : pas
de synonyme, pas d'abréviation, pas de vocabulaire propre au raccourci.

**e. L'ordre est fixe, jamais adaptatif.** Un menu qui se réorganise selon
l'usage détruit la mémoire spatiale qu'il prétend servir : Mitchell &
Shneiderman (1989) mesurent les menus dynamiques **plus lents** et moins
appréciés que les menus statiques. **Règle dure** : l'ordre des items ne
change jamais. Seuls les **compteurs** changent.

---

## 3. Arborescence

Trois zones, dans cet ordre, toujours le même. Profondeur maximale : deux
niveaux.

```
┌─ Accès rapide ───────────────────────────── [×] ─┐
│  🔍  Rechercher un écran…                        │  ← champ de filtre
├──────────────────────────────────────────────────┤
│  REPRENDRE                                       │  ← 0 à 2 items, contextuel
│    ▸ Habillage et comportement en ZAC   §3/7     │
│    ▸ Évaluation en cours — 4 questions restantes │
├──────────────────────────────────────────────────┤
│  À FAIRE                                         │  ← 0 à 5 items, selon rôle
│    ▸ Signalements                            (3) │
│    ▸ Questions à vérifier                   (12) │
│    ▸ Rapports en attente de visa             (2) │
├──────────────────────────────────────────────────┤
│  ALLER À                                         │  ← le volet, replié
│    ▸ Formation                                 › │
│    ▸ Repères                                   › │
│    ▸ Administration                            › │
└──────────────────────────────────────────────────┘
```

### 3.1 « Reprendre » — le contexte, pas une liste

Ce que l'agent avait commencé. **Zéro, un ou deux items, jamais plus.**

| Item | Condition d'apparition | Source |
|---|---|---|
| Module en cours | un repère de lecture existe sur ce poste | `localStorage`, déjà posé par `LectureModule` |
| Évaluation en cours | une évaluation est ouverte et non soumise | mémoire d'onglet (`SessionFormation`) ; base si progression rattachée |

Si les deux sont absents, **la zone entière disparaît** — pas de cadre vide,
pas de « rien à reprendre ». Un cadre vide est du bruit qu'il faut lire pour
constater qu'il ne dit rien.

### 3.2 « À faire » — la file d'attente, chiffrée

Le cœur du gain. Chaque item porte un **compteur calculé côté serveur**, déjà
disponible : `compterSignalementsOuverts()`, le décompte `aVerifier` de la
banque, les rapports en attente de visa du tableau de pilotage.

| Profil | Items, dans cet ordre |
|---|---|
| Poste | *(zone absente)* |
| Tutorat | Signalements · Questions à vérifier · Rapports en attente de visa · Identifiants d'agents |
| Administration | Rapports en attente de visa · Verdicts à arbitrer · Signalements · Questions à vérifier · Codes d'accès |

**Règles dures :**

1. **Un item à zéro ne disparaît pas** : il s'affiche en gris, compteur `0`,
   et reste cliquable. Un item qui va et vient détruit la mémoire spatiale
   (principe **e**). C'est le compteur qui informe, pas la présence.
2. **Jamais plus de cinq items.** Au-delà, ce n'est plus un raccourci.
3. **Aucun item que le rôle ne peut pas exécuter.** Pas d'item grisé « réservé
   à l'administration » : un profil de tutorat ne doit pas apprendre
   l'existence d'écrans qu'il n'ouvrira jamais.
4. **Zone entière absente pour un profil de poste.** Un apprenant n'a pas de
   file d'attente ; lui en montrer une vide lui apprend seulement qu'il est
   surveillé.

### 3.3 « Aller à » — le volet, à l'identique

Les trois groupes du volet, repliés, avec leurs sous-parties. **Même code,
mêmes intitulés, même ordre** (`components/Navigation.tsx`). Sous 62 rem,
c'est déjà ce que fait le tiroir : la zone y est le tiroir.

### 3.4 Le champ de recherche

Filtre **par préfixe et par sous-chaîne** sur les intitulés visibles des trois
zones. Pas de recherche plein texte dans les modules ni dans les questions :
ce serait un autre composant, avec d'autres exigences (pertinence, pagination,
droits d'accès question par question). **Hors périmètre, et à dire
explicitement** pour que personne ne l'attende.

---

## 4. Micro-interactions

### 4.1 Ouverture

| Aspect | Spécification |
|---|---|
| Déclencheurs | clic sur le hamburger ; `Ctrl+K` / `⌘K` ; `/` quand aucun champ n'a le focus |
| Animation | translation de 8 px + opacité 0 → 1, **180 ms**, `ease-out` |
| Mouvement réduit | sous `prefers-reduced-motion: reduce`, opacité seule, **90 ms** |
| Focus à l'ouverture | **poste** : le champ de recherche. **Tactile** : le panneau lui-même (`tabindex="-1"`) — donner le focus à un champ y déclenche le clavier virtuel, qui mange la moitié de l'écran avant qu'on ait rien demandé |
| Fond | voile `rgba(16,24,32,.38)`, défilement du corps verrouillé |

### 4.2 Pendant

| Aspect | Spécification |
|---|---|
| Frappe | filtre immédiat, **sans anti-rebond** — la liste est locale, il n'y a rien à attendre |
| Flèches ↑ ↓ | déplacent la sélection ; rebouclent aux extrémités |
| `Entrée` | ouvre l'item sélectionné ; à défaut de sélection, le premier résultat |
| `Tab` | **enfermée** dans le panneau (WCAG 2.1.2, pas de piège au clavier : `Échap` sort toujours) |
| Survol | change la sélection, comme les flèches — un seul item sélectionné à la fois, jamais deux repères concurrents |
| Compteurs | **ne s'animent pas, ne clignotent pas.** Un chiffre qui bouge attire l'œil vers ce qu'on n'a pas demandé |
| Aucun résultat | « Aucun écran ne correspond à *xyz*. » et la zone « Aller à » reste entière, dépliée |

### 4.3 Fermeture

`Échap`, clic sur le voile, clic sur le `×`, suivi d'un lien, changement de
route. **Dans tous les cas, le focus revient au hamburger** — sans quoi la
tabulation repart du haut du document, et l'utilisateur au clavier est perdu
(WCAG 2.4.3).

### 4.4 Le déclencheur lui-même

- `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`.
- **Une pastille, pas un nombre** : un point de 6 px, couleur de marque, si
  au moins un item de « À faire » est non nul pour ce rôle. Un nombre sur le
  déclencheur oblige à le lire et à le comparer à chaque passage ; le point
  dit la seule chose utile de l'extérieur — « il y a quelque chose ».
- **Aucune pastille pour un profil de poste.**

---

## 5. Gestion de l'espace

### 5.1 Sous 62 rem — téléphone et tablette

Le volet **est** déjà un tiroir ouvert au hamburger. L'accès rapide ne crée
pas une seconde surface : **il devient le contenu du tiroir**, « Reprendre »
et « À faire » s'insérant au-dessus de « Aller à ».

| Aspect | Valeur |
|---|---|
| Largeur | `min(19rem, 86vw)` — inchangée |
| Entrée | translation depuis la gauche, 260 ms (celle du tiroir actuel) |
| Cible tactile | **44 px** de haut par item |
| Recherche | présente, mais **sans focus automatique** (§ 4.1) |
| Clavier virtuel | le panneau défile ; la zone « À faire » reste au-dessus du pli |

### 5.2 Au-dessus de 62 rem — poste de travail

Le volet est permanent : le hamburger est aujourd'hui **masqué**. Il
**réapparaît**, et ouvre une surface différente : un **panneau centré** de
`min(34rem, 92vw)`, ancré à 12 vh du haut.

Pourquoi pas le tiroir sur poste : il doublerait un volet déjà visible. Le
panneau centré, lui, ne répète pas la navigation — il porte le contexte et la
file d'attente, que le volet ne montre pas.

| Aspect | Valeur |
|---|---|
| Largeur | `min(34rem, 92vw)` |
| Hauteur | `max-height: 72vh`, zones « Reprendre » et « À faire » **jamais** dans la partie défilante |
| Position | centré horizontalement, 12 vh du haut — pas verticalement centré : le regard part du haut |
| Cible | 32 px par item, comme le volet sur poste |
| Raccourci annoncé | `⌘K` en gris à droite du champ, une fois |

### 5.3 Impression

Le panneau ne s'imprime pas — même règle que `.rail` et `.visite-voile`
(`display: none !important` dans la feuille d'impression).

---

## 6. Réduire la charge mentale, accélérer les tâches fréquentes

Sept mesures, chacune rattachée à un principe de la section 2.

1. **Supprimer le déplacement à l'aveugle** (principe **a**). Les compteurs
   sont l'essentiel du gain : ils suppriment le trajet « aller voir s'il y a
   quelque chose ». Un tuteur qui ouvre le panneau et lit `Signalements (0)`
   a obtenu sa réponse **sans changer d'écran**.
2. **Ordre invariant** (principe **e**). Au bout de quelques jours, la main
   va au deuxième item sans lire. Cette mémoire est le gain de vitesse réel ;
   la moindre réorganisation l'anéantit.
3. **Plafond de cinq** (principe **b**) pour « À faire ». Au-delà, le temps de
   balayage annule le raccourci.
4. **Vocabulaire unique** (principe **d**). « Signalements » ici, dans le
   volet et en titre de page. Trois mots pour une chose, c'est trois choses
   dans la tête de l'utilisateur.
5. **Deux niveaux maximum** (principe **c**).
6. **Rien de désactivé.** Un item grisé se lit, s'interprète, et ne sert à
   rien. Ce que le rôle ne peut pas faire n'apparaît pas.
7. **Aucune zone vide.** « Reprendre » disparaît s'il n'y a rien à reprendre.
   Un cadre vide coûte une lecture pour un renseignement nul.

---

## 7. Accessibilité — exigences opposables

| Exigence | Référence |
|---|---|
| `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | ARIA Authoring Practices, *Dialog (Modal)* |
| Tabulation enfermée, `Échap` sort toujours | WCAG 2.1.2 *No Keyboard Trap* (A) |
| Focus rendu au déclencheur à la fermeture | WCAG 2.4.3 *Focus Order* (A) |
| Focus jamais masqué par le voile | WCAG 2.4.11 *Focus Not Obscured (Minimum)* (AA, WCAG 2.2) |
| Cible ≥ 24 px ; **44 px retenus en tactile** | WCAG 2.5.8 *Target Size (Minimum)* (AA, WCAG 2.2) |
| Compteur dans le nom accessible : « Signalements, 3 en attente » | WCAG 4.1.2 *Name, Role, Value* (A) |
| Contraste ≥ 4,5:1, y compris les items à zéro en gris | WCAG 1.4.3 *Contrast (Minimum)* (AA) |
| `prefers-reduced-motion` respecté | WCAG 2.3.3 *Animation from Interactions* (AAA) |

> **Correction d'une erreur présente dans le code.** Le commentaire de
> `--cible` donnait 44 px comme « minimum WCAG 2.1 AA ». C'est faux : le
> critère *Target Size* 2.5.5 de WCAG 2.1 est de niveau **AAA**, et le
> minimum **AA** (2.5.8, introduit par WCAG 2.2) est de **24 px**. Nous
> gardons 44 px en tactile — c'est un choix de confort, aligné sur les
> recommandations d'Apple (44 pt) et de Material (48 dp), pas une obligation
> de niveau AA. Corrigé dans la feuille de style le 19/09/2026.

---

## 8. Critères d'acceptation, mesurables

| # | Critère | Comment le vérifier |
|---|---|---|
| 1 | Toute tâche du tableau § 1 s'atteint en **une ouverture + un clic** | parcours de bout en bout, une étape par tâche |
| 2 | Les compteurs égalent ceux des écrans correspondants | e2e : créer 1 signalement, lire `(1)` dans le panneau |
| 3 | Un item à zéro reste visible et cliquable | e2e : aucun signalement → `Signalements (0)` présent |
| 4 | Un profil de poste ne voit **ni** « À faire » **ni** pastille | e2e sous code de poste |
| 5 | `Échap` ferme et rend le focus au hamburger | e2e : `document.activeElement` après `Échap` |
| 6 | La tabulation ne sort pas du panneau ouvert | e2e : 20 `Tab`, le focus reste dedans |
| 7 | L'ordre des items ne dépend d'aucun historique | test unitaire sur le module de composition |
| 8 | Le panneau n'apparaît pas à l'impression | test de feuille d'impression |
| 9 | Ouverture perçue < 100 ms, aucun appel réseau | les compteurs voyagent avec la page |

---

## 9. Écarts à la construction, et ce qui reste à trancher

### 9.1 Écarts assumés (21/09/2026)

1. **« Identifiants d'agents » et « Codes d'accès » ne figurent pas dans la
   file d'attente**, contrairement au tableau du § 3.2. Ce sont des écrans, pas
   des files : le nombre qu'on leur accolerait — l'effectif, le nombre de
   codes — n'appelle aucun acte, or c'est le compteur qui informe. Ils restent
   dans « Aller à ».
2. **« Verdicts à arbitrer » est un item du tutorat**, et non de la seule
   administration. L'arbitrage est l'acte du tuteur (`peutArbitrer`,
   `app/admin/rapports/[id]/page.tsx`) ; l'administration l'exerce aussi. Les
   deux profils portent la même liste dans le même ordre ; seuls les compteurs
   diffèrent, le visa du pharmacien demandant un code d'administration.
3. **« Aller à » figure aussi dans le panneau de poste**, là où le § 5.2
   annonçait un panneau « qui ne répète pas la navigation ». Un lanceur dont la
   recherche n'atteint pas les écrans n'est pas un lanceur, et la main n'a pas
   à quitter le clavier pour rejoindre le volet.

### 9.2 Une affirmation de cette note était fausse

La version du 19/09 indiquait que le décompte « verdicts à arbitrer »
n'existait pas en base et serait à ajouter à `lib/pilotage-db.ts`.
`rapportsEnAttente()` renvoie déjà `verdict_brut` et `arbitre` : c'est un
filtre, pas une requête. L'estimation de coût qui en découlait était donc
surévaluée.

### 9.3 Ce qui reste à trancher

- `[à préciser]` **Le raccourci `⌘K` sur les postes du CHD** : à confirmer
  qu'il n'entre pas en conflit avec un usage établi de l'établissement. La
  touche `/` et le hamburger ouvrent le même panneau, le raccourci n'est donc
  pas une condition d'usage.
- `[à préciser]` **Fréquence réelle des tâches.** Le tableau § 1 est un
  classement raisonné, pas une mesure. Une semaine de journal
  (`/admin/journal` enregistre déjà les actions par rôle) le confirmerait ou
  le corrigerait — et c'est cette mesure, pas l'intuition, qui doit fixer
  l'ordre des items. L'ordre construit est donc provisoire, mais il est
  **invariant** : c'est la condition de la mémoire spatiale, pas sa remise en
  cause.

---

## 10. Références

1. Fitts PM. The information capacity of the human motor system in
   controlling the amplitude of movement. *J Exp Psychol.* 1954;47(6):381-391.
2. Hick WE. On the rate of gain of information. *Q J Exp Psychol.*
   1952;4(1):11-26.
3. Hyman R. Stimulus information as a determinant of reaction time.
   *J Exp Psychol.* 1953;45(3):188-196.
4. Miller GA. The magical number seven, plus or minus two: some limits on our
   capacity for processing information. *Psychol Rev.* 1956;63(2):81-97.
   *(Cité ici pour signaler son détournement courant, non pour l'appliquer.)*
5. Kiger JI. The depth/breadth trade-off in the design of menu-driven user
   interfaces. *Int J Man-Machine Studies.* 1984;20(2):201-213. `[à vérifier]`
   la pagination exacte.
6. Landauer TK, Nachbar DW. Selection from alphabetic and numeric menu trees
   using a touch screen: breadth, depth and width. In: *Proc CHI '85.*
   New York: ACM; 1985. p. 73-78. `[à vérifier]` la pagination exacte.
7. Mitchell J, Shneiderman B. Dynamic versus static menus: an exploratory
   comparison. *SIGCHI Bulletin.* 1989;20(4):33-37. `[à vérifier]` le volume.
8. Nielsen J. *10 Usability Heuristics for User Interface Design.* Nielsen
   Norman Group; 1994, mis à jour 2024.
9. W3C. *Web Content Accessibility Guidelines (WCAG) 2.2.* Recommandation du
   5 décembre 2023.
10. W3C. *ARIA Authoring Practices Guide — Dialog (Modal) Pattern.*

> Les références 5, 6 et 7 sont citées de mémoire et portent la marque
> `[à vérifier]` : les conclusions sont, à ma connaissance, correctement
> rapportées, mais je n'ai pas pu consulter ces articles depuis cet
> environnement — le proxy sortant y bloque l'accès. À contrôler avant toute
> reprise de ce document dans un écrit opposable.
