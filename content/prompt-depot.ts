/**
 * Mise en forme d'un texte de questions par une IA, avant dépôt.
 *
 * Le dépôt du site (`lib/import-questions.ts`) n'utilise aucune IA : il lit un
 * format précis et n'invente rien. Ce fichier porte le format en un seul
 * endroit — l'exemple affiché sur l'écran de dépôt, et le prompt que le
 * tuteur copie pour faire mettre en forme un texte brut (polycopié, compte
 * rendu de formation, questionnaire papier) par l'assistant de son choix.
 *
 * Le prompt interdit d'inventer : une IA qui complète un corrigé absent ou
 * fabrique une source produirait une question fausse que le dépôt ne saurait
 * pas distinguer d'une vraie. C'est aussi pourquoi toute question déposée
 * entre au statut « à vérifier » et attend la validation d'un autre code que
 * son auteur (règle des quatre yeux, question 12).
 *
 * `test/prompt-depot.test.ts` passe l'exemple dans l'analyseur réel : le
 * prompt et le format ne peuvent pas diverger sans que les tests tombent.
 */

/** Exemple canonique du format attendu : lu tel quel par l'analyseur. */
export const EXEMPLE_DEPOT = `QCM 1. Énoncé de la question (plusieurs réponses)
A. Première proposition (V)
B. Deuxième proposition (F)
C. Troisième proposition (V)
D. Quatrième proposition (F)
Réponses : A C
Justification : texte affiché à l'apprenant après la correction.
Source : ANSM — Bonnes pratiques de préparation 2023 — 21/07/2023 — https://ansm.sante.fr/
Éliminatoire : oui
Réservée à l'évaluation : oui

QIM 2. Concernant la zone à atmosphère contrôlée, chaque proposition se juge séparément.
A. Proposition vraie (V)
B. Proposition fausse (F)
C. Proposition vraie (V)
Justification : …

QCM 3. Sur cette photographie du sas d'habillage, quel équipement manque-t-il ?
Image : sas-habillage.jpg
A. Les surchaussures (V)
B. La charlotte (F)
C. Le masque (F)
Justification : …

SCHÉMA 1. Légendez les éléments repérés sur cette coupe d'isolateur.
Image : isolateur-coupe.png
1. sas de transfert (32, 24, 14, 5)
2. filtre HEPA | filtre terminal (58, 19)
Justification : …`;

/** Prompt à copier dans l'assistant, avec le texte source à la fin. */
export const PROMPT_DEPOT = `Tu mets en forme des questions d'évaluation pour le dépôt du site de formation de l'unité de pharmacotechnie (CHD Vendée). Tu transcris ce que le texte source contient ; tu ne rédiges pas de contenu nouveau.

RÈGLES ABSOLUES
1. N'invente rien : ni question, ni proposition, ni corrigé, ni justification, ni source. Ce qui n'est pas dans le texte source n'apparaît pas dans ta réponse.
2. Ne reformule pas le fond. Tu peux corriger une faute de frappe évidente et retirer ce qui n'appartient pas à la question (numéros de page, en-têtes, pieds de page). Rien d'autre.
3. Corrigé absent ou ambigu : écris les propositions sans « (V) » ni « (F) » et ajoute la ligne « Justification : [à vérifier] ». Un tuteur tranchera dans l'éditeur.
4. Source : ne recopie que celle que porte le texte source. Pas de source probable, pas d'URL reconstituée, pas de date devinée. Rien à recopier, pas de ligne « Source ».
5. Réponds en texte brut et rien d'autre : pas de Markdown, pas de numérotation ajoutée, pas de phrase d'introduction ni de conclusion, pas de commentaire sur ton travail.

FORMAT ATTENDU

${EXEMPLE_DEPOT}

PRÉCISIONS
- Une ligne vide sépare deux questions. Au plus 120 questions, de A à E (cinq propositions au plus), énoncé de 2 000 caractères au plus.
- QCM : une seule réponse exacte, sauf si l'énoncé dit « plusieurs réponses ». QIM : chaque proposition se juge vraie ou fausse séparément.
- Le corrigé s'écrit « (V) » / « (F) » en fin de proposition, ou en ligne « Réponses : A C ». Si le texte source porte les deux, ils doivent coïncider ; sinon, applique la règle 3.
- « Éliminatoire : oui » — une erreur rend le critère non acquis, quel que soit le score. À ne mettre que si le texte source le dit.
- « Réservée à l'évaluation : oui » — la question n'est jamais posée en entraînement. Même règle.
- « Image : nom-du-fichier.png » — illustration d'une question, ou image d'un schéma à compléter. Le fichier se dépose avec le texte, sur le même écran ; le nom doit être exactement celui du fichier.
- Schéma à compléter : « SCHÉMA n. », puis « Image : … », puis une légende par ligne, numérotée. Entre parenthèses, la place du mot sur l'image en pourcentage de l'image (x, y, largeur, hauteur) ; deux nombres posent un repère sans rien masquer. Si le texte source ne donne pas ces positions, écris les légendes sans parenthèses : elles seront placées à la main dans l'éditeur.
- Une légende accepte des variantes, séparées par « | » : « filtre HEPA | filtre terminal ».

TEXTE SOURCE À METTRE EN FORME
"""
[colle ici le texte brut]
"""`;
