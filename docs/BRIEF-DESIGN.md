# Brief de design — Formation & habilitation, unité de pharmacotechnie

Document à donner tel quel à Claude Design. Il décrit ce qui existe, ce qui est
négociable et ce qui ne l'est pas.

---

## 1. Ce qu'est ce produit

Un outil interne de formation et d'évaluation pour les **préparateurs en
pharmacie** d'une unité de production de chimiothérapies, et les internes qui y
tournent. Il couvre les deux premières étapes d'une chaîne d'habilitation en six
étapes : formation théorique, puis évaluation des connaissances. Les quatre
suivantes se passent au poste de travail et devant le pharmacien responsable.

**Le message central que le design doit porter** : valider un module à l'écran
ne vaut pas habilitation. Si un utilisateur ressort en croyant l'inverse, le
design a échoué, quelle que soit sa qualité graphique.

### Qui l'utilise, et comment

| Profil | Contexte d'usage | Conséquence pour le design |
|---|---|---|
| Préparateur en formation | Sur un poste de l'unité, entre deux séries de production. Souvent debout, parfois pressé | Lisibilité à distance, cibles tactiles larges, reprise possible après interruption |
| Interne en rotation | Découverte rapide, quelques semaines | Navigation évidente sans apprentissage |
| Tuteur (N3) | Dépose des documents, ordonne les modules | Écrans de gestion denses, orientés tableau |
| Pharmacien responsable | Lit les rapports, prononce les habilitations | Le rapport imprimé doit être irréprochable |

Ce n'est **pas** un produit grand public. Pas de gamification, pas de badges,
pas de félicitations enthousiastes. Un échec sur une question éliminatoire doit
se lire immédiatement et sans ambiguïté — il y a un enjeu de sécurité derrière.

---

## 2. Contraintes non négociables

### Charte graphique Hôpitaux de Vendée (GHT 85, octobre 2025)

| Rôle | Couleur | Usage |
|---|---|---|
| Primaire 1 | `#005586` bleu foncé | Titres, blocs, accentuation. **Majoritaire** |
| Primaire 2 | `#E82A63` rose | Accents visuels, barres, encadrés majeurs. **Majoritaire** |
| Secondaire 1 | `#46B4B3` turquoise | **Accent ponctuel uniquement** |
| Secondaire 2 | `#F4C137` jaune | **Accent ponctuel uniquement** |

Le turquoise et le jaune ne doivent **jamais** devenir dominants.

**Éléments d'identité obligatoires** :
- barre rose verticale sur le bord gauche, pleine hauteur
- bandeau bleu horizontal en pied de page
- logo *Hôpitaux de Vendée* et logo *Pharmacotechnie*, jamais déformés,
  jamais recolorés, jamais recadrés

**Typographie** : Aptos (présente sur les postes du CHD via Office), Inter en
repli web. Gilroy est réservé à l'imprimé par la charte — ne pas l'utiliser ici.

### Accessibilité

Cible **WCAG 2.1 AA**. Points d'attention propres à ce contexte :
- contraste 4,5:1 minimum sur tout le texte, y compris les légendes grises
- **jamais la couleur seule** pour porter une information : conforme/non
  conforme, obligatoire, éliminatoire doivent aussi se lire en texte ou en forme
- cibles tactiles ≥ 44 px — l'usage sur tablette en zone est probable
- mode sombre déjà implémenté, à conserver et à vérifier

### Technique

Next.js 15, CSS pur avec variables sur `:root` — pas de framework CSS, pas de
librairie de composants. Toute la palette et les rayons sont dans
`app/globals.css`. Une refonte visuelle se fait en réécrivant ce fichier.

---

## 3. Inventaire des écrans

Les captures jointes sont numérotées dans cet ordre.

| # | Écran | Rôle | Enjeu de design principal |
|---|---|---|---|
| 01 | Accueil / programme | tous | Le plus chargé. Chaîne d'habilitation + composition du programme + 58 cartes de critères + blocs dépliables + conditions de niveaux. **Candidat n°1 à la refonte** |
| 02 | Connexion | tous | Sobre. Doit expliquer qu'un code ouvre un profil, pas un compte personnel |
| 03 | Module | apprenant | Lecture longue : 5 sections, sources par section, documents rattachés, bibliographie. Confort de lecture |
| 04 | Réglage de l'évaluation | apprenant | Trois niveaux de tirage à choisir. Simple |
| 05 | Passation | apprenant | **Le plus critique.** Vignettes de mise en situation, QCM, QIM, progression |
| 06 | Correction | apprenant | Score, verdict, justification et source par question |
| 07 | Accueil mobile | tous | 390 px. Vérifier que les cartes et les filtres tiennent |
| 08 | Question mobile | apprenant | Cibles tactiles, longueur des énoncés |
| 09 | Mode sombre | tous | Contraste des primaires éclaircies |

Non capturés car nécessitant une base de données : `/admin` (codes, dépôts,
ordonnancement). Écrans de gestion, denses, à traiter après les écrans
apprenant.

---

## 4. Ce qui ne va pas aujourd'hui — mon diagnostic

À prendre comme point de départ, pas comme vérité.

1. **L'accueil fait tout à la fois.** Chaîne d'habilitation, filtres, tuiles de
   synthèse, 58 cartes, blocs dépliables, conditions de niveaux, export du
   rapport. Un apprenant qui vient faire un module traverse trois sections de
   gouvernance avant d'atteindre son contenu. Séparer *ce que je dois faire
   aujourd'hui* de *comment le dispositif est construit*.

2. **Les cartes de critères se ressemblent toutes.** 56 des 58 sont des
   emplacements vides marqués « À rédiger ». Visuellement elles pèsent autant
   que les deux modules réels. Le rapport signal/bruit est mauvais.

3. **Rien ne distingue un critère obligatoire d'un critère facultatif** sur les
   cartes, alors que c'est ce qui conditionne l'habilitation. La donnée existe
   (44 des 58 sont « O »), elle n'est pas exploitée visuellement.

4. **Aucune notion de progression dans un parcours.** L'apprenant ne voit pas où
   il en est dans une séquence, ni ce qui vient après.

5. **Les QIM ne se distinguent pas assez des QCM** à l'écran, alors que leur
   barème est différent (une discordance coûte la moitié des points). Le risque
   est qu'un apprenant coche au hasard en croyant être en tout-ou-rien.

6. **Les vignettes de mise en situation** sont un bloc de texte dans un encadré
   bleu clair. Elles racontent une scène — elles mériteraient un traitement qui
   fasse ralentir la lecture.

7. **Le rapport téléchargé** est correct mais austère. C'est pourtant la seule
   pièce qui sort de l'outil et arrive sur le bureau du pharmacien.

---

## 5. Objets de contenu réels, avec leurs dimensions

Travailler sur ces longueurs, pas sur du faux texte.

**Libellé de critère** — de 34 à 148 caractères. Le plus long :
> « Préparations particulières : poches (duoperf, vide, filtre), diffuseurs,
> seringues (SC, GEU, IT, Texium, chimioembolisation) »

**Identifiant de critère** — `B1-04`, `B3-10`, `B6-11`. Court, à afficher.

**Niveaux** — `N1a`, `N1c`, `N2`, `N3`, `P1`, `P2`, et `N1c→2` pour les critères
du bloc 5 qui se valident en doublon puis en autonomie.

**Titre de bloc** — jusqu'à 78 caractères :
> « Réaliser des préparations magistrales et hospitalières (parcours
> préparatoire) »

**Énoncé de question** — de 45 à 130 caractères. Options de 12 à 120 caractères.
Une QIM a 5 propositions, un QCM en a 4.

**Vignette de mise en situation** — 400 à 700 caractères, 2 paragraphes.

**Justification de correction** — 200 à 450 caractères, suivie d'une ligne de
source.

**Volumétrie** : 7 blocs, 58 critères, 44 obligatoires, 18 au socle transversal.
Un programme filtré affiche entre 18 et 41 cartes.

---

## 6. États à ne pas oublier

- carte de module **rédigé** vs **emplacement à rédiger**
- critère **obligatoire** vs facultatif
- question **éliminatoire** — avant réponse, et après échec
- QIM avec **0, 1, ≥ 2 discordances** — trois traitements distincts
- module **acquis** / **non acquis** / non encore évalué
- **contrôle d'accès inactif** (base non branchée) — bandeau d'avertissement
- un `[à préciser]` subsiste : le statut du dispositif en audit. Il a un style
  dédié (monospace, fond ambre, bordure pointillée) qui doit rester visible

---

## 7. Ce que je ne veux pas voir

- des dégradés pastel et des illustrations 3D — c'est un outil d'habilitation
  opposable, pas une application d'apprentissage grand public
- des barres de progression qui suggèrent un avancement d'habilitation : le site
  ne couvre que 2 étapes sur 6, et la progression affichée est celle de la
  session, rien de plus
- des félicitations à la validation d'un module
- du turquoise ou du jaune en couleur dominante
- une réécriture des libellés de critères : ils sont transcrits de la fiche
  d'habilitation et font foi

---

## 8. Jetons actuels, à reprendre ou à remplacer

```css
--hdv-bleu: #005586;      --hdv-rose: #e82a63;
--hdv-turquoise: #46b4b3; --hdv-jaune: #f4c137;

--fond: #f6f7f8;          --surface: #ffffff;
--surface-douce: #f0f2f4; --bord: #d8dde2;
--bord-fort: #b6bec6;     --texte: #16202a;
--texte-doux: #566370;    --texte-faible: #7b8792;

--succes: #1f6b45;  --succes-fond: #e6f3ec;
--alerte: #8a5a00;  --alerte-fond: #fdf3e0;
--echec:  #99271f;  --echec-fond:  #fbeae8;

--rayon: 18px;      --rayon-sm: 10px;
--largeur: 68rem;
```

Les couleurs sémantiques (succès, alerte, échec) ont été choisies hors charte,
faute d'équivalent : la charte n'en prévoit pas. Elles sont donc **ouvertes à
discussion**, à condition de conserver un contraste AA et de ne pas empiéter sur
le rose primaire.

---

## 9. Par où commencer

Dans cet ordre, du plus rentable au moins :

1. **L'accueil** — le séparer en « mon programme » et « le dispositif »
2. **La carte de critère** — c'est le composant le plus répété, 58 fois
3. **La passation** — QCM, QIM et vignette, avec leurs états
4. **La correction** — hiérarchie entre verdict, justification et source
5. **Le rapport imprimé** — la seule pièce qui quitte l'outil
6. Les écrans d'administration
