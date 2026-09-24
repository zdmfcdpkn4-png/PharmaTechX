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
 * son auteur (règle des quatre yeux, question 12) — ou de son auteur, s'il
 * est un code d'administration (23/09/2026).
 *
 * `test/prompt-depot.test.ts` passe l'exemple dans l'analyseur réel : le
 * prompt et le format ne peuvent pas diverger sans que les tests tombent.
 *
 * Depuis le 23/09/2026 (questions 57 et 58, choix a), le prompt exige le
 * mot-clé QCM ou QIM devant chaque question, et fait écrire une ligne
 * « Module : » avant les questions de chaque module, d'après la liste des
 * modules qu'il porte : un dépôt peut en servir plusieurs.
 *
 * Depuis le 24/09/2026, il fait recopier sous chaque question l'extrait du
 * document de référence qui donne la réponse (« Extrait : « … » »), mot pour
 * mot : le relecteur le confronte au document avant de valider. La
 * justification seule ne le permettait pas.
 */

/** Exemple canonique du format attendu : lu tel quel par l'analyseur. */
export const EXEMPLE_DEPOT = `Module : B1-01

QCM 1. Énoncé de la question (plusieurs réponses)
A. Première proposition (V)
B. Deuxième proposition (F)
C. Troisième proposition (V)
D. Quatrième proposition (F)
Réponses : A C
Justification : texte affiché à l'apprenant après la correction.
Extrait : « phrase du document de référence qui donne la réponse, recopiée mot pour mot »
Source : ANSM — Bonnes pratiques de préparation 2023 — 21/07/2023 — https://ansm.sante.fr/
Éliminatoire : oui
Réservée à l'évaluation : oui
Obligatoire : oui
Niveau : intermédiaire

QIM 2. Concernant la zone à atmosphère contrôlée, chaque proposition se juge séparément.
A. Proposition vraie (V)
B. Proposition fausse (F)
C. Proposition vraie (V)
Justification : …

QCM 3. Sur cette photographie du sas d'habillage, quel équipement manque-t-il ?
Image : sas-habillage.jpg
Description de l'image : Sas d'habillage vu depuis l'entrée, avec son banc de séparation et son portant de tenues.
A. Les surchaussures (V)
B. La charlotte (F)
C. Le masque (F)
Justification : …

Module : B3-01

SCHÉMA 1. Légendez les éléments repérés sur cette coupe d'isolateur.
Image : isolateur-coupe.png
Description de l'image : Coupe d'un isolateur, vue de face, deux repères numérotés.
1. sas de transfert (32, 24, 14, 5)
2. filtre HEPA | filtre terminal (58, 19)
Justification : …

Module : B1-01

SÉQUENCE 1. Remettez dans l'ordre les étapes de l'habillage en zone à atmosphère contrôlée.
Image : tenue-zac.jpg
Description de l'image : Tenue complète de zone à atmosphère contrôlée, portée par un mannequin.
1. Hygiène des mains
2. Surchaussures
3. Combinaison
Justification : …
Extrait : « … »

TEXTE 1. Le sas de {1} est en dépression par rapport à la {2}.
1. transfert
2. zone à atmosphère contrôlée
Leurres : couloir | décontamination
Justification : …`;

/** Module tel que la liste du prompt le donne : son nom court (code du critère, sinon identifiant) et son titre. */
export interface ModulePrompt {
  repere: string;
  titre: string;
}

/**
 * Prompt à copier dans l'assistant, avec le texte source à la fin. La liste
 * des modules est celle du site au moment de la copie : les modules déposés
 * y figurent, les modules retirés non.
 */
export function promptDepot(modules: ModulePrompt[]): string {
  const liste = [...modules]
    .sort((a, b) => a.repere.localeCompare(b.repere, "fr", { numeric: true }))
    .map((m) => `${m.repere} — ${m.titre}`)
    .join("\n");
  return `Tu mets en forme des questions d'évaluation pour le dépôt du site de formation de l'unité de pharmacotechnie (CHD Vendée). Tu transcris ce que le texte source contient ; tu ne rédiges pas de contenu nouveau. Le document de référence, s'il est joint, sert à recopier l'extrait qui justifie chaque réponse.

RÈGLES ABSOLUES
1. N'invente rien : ni question, ni proposition, ni corrigé, ni justification, ni extrait, ni source. Ce qui n'est pas dans le texte source ou le document de référence n'apparaît pas dans ta réponse.
2. Ne reformule pas le fond. Tu peux corriger une faute de frappe évidente et retirer ce qui n'appartient pas à la question (numéros de page, en-têtes, pieds de page). Rien d'autre.
3. Corrigé absent ou ambigu : écris les propositions sans « (V) » ni « (F) » et ajoute la ligne « Justification : [à vérifier] ». Un tuteur tranchera dans l'éditeur.
4. Source : ne recopie que celle que porte le texte source. Pas de source probable, pas d'URL reconstituée, pas de date devinée. Rien à recopier, pas de ligne « Source ».
5. Réponds en texte brut et rien d'autre : pas de Markdown, pas de numérotation ajoutée, pas de phrase d'introduction ni de conclusion, pas de commentaire sur ton travail.

FORMAT ATTENDU

${EXEMPLE_DEPOT}

PRÉCISIONS
- Une ligne vide sépare deux questions. Au plus 120 questions, de A à E (cinq propositions au plus), énoncé de 2 000 caractères au plus.
- Chaque question commence par son mot-clé, « QCM n. » ou « QIM n. », même quand le texte source ne l'écrit qu'une fois, en intertitre. Le format se lit dans le texte source : l'intertitre sous lequel la question est rangée, ou sa consigne — « indiquez si … vraies ou fausses », « indiquer la ou les propositions exactes » : QIM ; « lesquelles… ? », « quel… ? » : QCM. Rien ne le dit : écris « Q n. », le site proposera un format que le tuteur vérifiera.
- QCM : une seule réponse exacte, sauf si l'énoncé dit « plusieurs réponses ». QIM : chaque proposition se juge vraie ou fausse séparément.
- « Module : B1-05 » — seule sur sa ligne, précédée d'une ligne vide, avant la première question d'un module : elle vaut pour les questions qui suivent, jusqu'à la ligne Module suivante. Le code se prend dans la liste MODULES ci-dessous, d'après ce que dit le texte source (titre de chapitre, thème traité). Le texte source ne permet pas de choisir, ou hésite entre deux modules : pas de ligne Module, le site proposera un module que le tuteur vérifiera.
- Le corrigé s'écrit « (V) » / « (F) » en fin de proposition, ou en ligne « Réponses : A C ». Si le texte source porte les deux, ils doivent coïncider ; sinon, applique la règle 3.
- « Extrait : « … » » — sous la justification, la phrase du document de référence qui donne la réponse, recopiée mot pour mot entre guillemets, 300 caractères au plus ; une ligne par phrase. Le relecteur la confronte au document avant de valider, et l'apprenant la lit après la correction. Pour un QCM ou une QIM, tu peux écrire à la place, sous chaque proposition, une ligne « Extrait A : « … » » : la phrase qui la confirme ou qu'elle contredit. Le document de référence est le texte source lui-même, ou le document joint à la conversation. Aucune phrase ne donne la réponse, ou pas de document : pas de ligne Extrait, et jamais de phrase reformulée.
- « Éliminatoire : oui » — une erreur rend le critère non acquis, quel que soit le score. À ne mettre que si le texte source le dit.
- « Réservée à l'évaluation : oui » — la question n'est jamais posée en entraînement. Même règle.
- « Obligatoire : oui » — la question est posée à chaque évaluation qui peut conclure. Même règle.
- « Niveau : initial », « Niveau : intermédiaire » ou « Niveau : avancé » — le niveau de la question (restitution ; reformulation, comparaison ; raisonnement, piège). Même règle : à ne mettre que si le texte source le dit. Sinon, pas de ligne : le tuteur le renseignera dans l'éditeur.
- « Image : nom-du-fichier.jpg » — illustration d'une question de tout type (QCM, QIM, séquence, texte à trous), ou image d'un schéma à compléter : photographie, schéma, capture. La ligne suit l'énoncé. Le fichier se dépose avec le texte, sur le même écran ; le nom doit être celui du fichier, l'extension importe peu. N'annonce une image que si le texte source en désigne une.
- « Description de l'image : … » — sous la ligne Image, ce que montre l'image, en une phrase, sans donner la réponse : elle est lue à la place de l'image par un lecteur d'écran. Recopie la légende ou le titre que le texte source donne à l'image ; il n'en donne pas : pas de ligne, le tuteur l'écrira dans l'éditeur.
- Schéma à compléter : « SCHÉMA n. », puis « Image : … », puis une légende par ligne, numérotée. Entre parenthèses, la place du mot sur l'image en pourcentage de l'image (x, y, largeur, hauteur) ; deux nombres posent un repère sans rien masquer. Si le texte source ne donne pas ces positions, écris les légendes sans parenthèses : elles seront placées à la main dans l'éditeur.
- Une légende accepte des variantes, séparées par « | » : « filtre HEPA | filtre terminal ».
- Séquence à ordonner : « SÉQUENCE n. », puis une étape par ligne, numérotée, **dans l'ordre juste**. L'apprenant les recevra mélangées. N'écris une séquence que si le texte source donne l'ordre.
- Texte à trous : « TEXTE n. », l'énoncé portant les marques {1}, {2}… là où il manque un mot, puis une ligne numérotée par trou avec la vignette attendue, dans l'ordre des marques. Une ligne « Leurres : … | … » ajoute des vignettes fausses au menu. Ne crée des leurres que si le texte source en propose.

MODULES (code — titre)
${liste}

DOCUMENT DE RÉFÉRENCE
Le document d'où viennent les réponses (procédure, chapitre des BPP…) est joint à la conversation, s'il n'est pas le texte source lui-même. Les extraits s'y recopient.

TEXTE SOURCE À METTRE EN FORME
"""
[colle ici le texte brut]
"""`;
}

// ─────────────────────────────────────────── Génération à partir d'un document

/**
 * Prompt de **génération** — à la différence de `PROMPT_DEPOT`, qui transcrit
 * un questionnaire existant, celui-ci fait écrire dix questions à partir d'un
 * document joint à la conversation (procédure, chapitre des BPP…).
 *
 * Demandé le 22/09/2026, sur le modèle fourni par le pharmacien responsable,
 * **adapté au site** en quatre points que le code impose :
 *
 * 1. Tout QCM porte « (plusieurs réponses possibles) ». Le site affiche un
 *    QCM en boutons radio — une seule réponse cochable — si son énoncé ne
 *    contient pas le mot « plusieurs » (`estUneSeule`, `Evaluation.tsx`).
 *    Sans ce mot, huit QCM sur dix seraient impossibles à réussir, et les
 *    deux autres révéleraient qu'ils n'ont qu'une réponse.
 * 2. Le corrigé s'écrit « Réponses : A B D » ou « Réponses : aucune » : ce
 *    sont les lettres **à cocher**. Pour un QCM « lesquelles sont fausses ? »,
 *    ce sont donc les propositions fausses.
 * 3. Aucun « (V) » ni « (F) » en fin de proposition : le corrigé est sur sa
 *    ligne, et un « V » isolé en fin de phrase (« le facteur V ») resterait
 *    ambigu pour l'analyseur.
 * 4. Ni « Éliminatoire », ni « Réservée à l'évaluation », ni « Obligatoire » :
 *    ce sont des décisions du tuteur, prises dans l'éditeur, pas celles d'une IA.
 *
 * Les lignes « Extrait X » et « Pièges » sont lues par l'analyseur et
 * versées dans la justification, affichée après la correction ; la ligne
 * « Niveau » renseigne le niveau de la question — initial, intermédiaire ou
 * avancé, les trois paliers du site. `test/prompt-depot.test.ts` passe les
 * deux exemples dans l'analyseur réel.
 */

export type TypeGeneration = "QIM" | "QCM";

/** Répartition des propositions vraies sur dix questions, par type. */
const REPARTITION: Record<TypeGeneration, string> = {
  QIM: `QIM : chaque proposition est vraie ou fausse indépendamment. Sur les 10 questions : 1 sans aucune vraie, 2 à une vraie, 3 à deux, 2 à trois, 1 à quatre, 1 à cinq.`,
  QCM: `QCM : jamais 0 vraie. Sur les 10 questions : 2 à une vraie, 3 à deux, 3 à trois, 1 à quatre, 1 à cinq ; une seule formulée « lesquelles sont fausses ? ».`,
};

/** Consigne d'énoncé, par type. */
const CONSIGNE: Record<TypeGeneration, string> = {
  QIM: `Consigne QIM : « Concernant X, indiquez si les propositions suivantes sont vraies ou fausses. »`,
  QCM: `Consigne QCM : « Parmi les propositions suivantes concernant X, lesquelles sont vraies ? (plusieurs réponses possibles) », ou « … lesquelles sont fausses ? (plusieurs réponses possibles) ». La mention « (plusieurs réponses possibles) » figure sur TOUTES les questions, même celles à une seule réponse : le site en tire l'affichage en cases à cocher, et l'apprenant ne doit pas pouvoir deviner le nombre de réponses.`,
};

/** Exemples de format, lus tels quels par l'analyseur dans les tests. */
export const EXEMPLE_GENERATION: Record<TypeGeneration, string> = {
  QIM: `QIM 1. Concernant [thème unique de la question], indiquez si les propositions suivantes sont vraies ou fausses.
A. [Proposition vraie, reprise fidèle d'une phrase du document.]
Extrait A : « [phrase du document qui la confirme, mot pour mot] »
B. [Proposition fausse : une seule erreur, ici une restriction abusive.]
Extrait B : « [phrase du document qu'elle contredit, mot pour mot] »
C. [Proposition vraie.]
Extrait C : « [phrase du document, mot pour mot] »
D. [Proposition fausse : une valeur ou une unité modifiée.]
Extrait D : « [phrase du document qu'elle contredit, mot pour mot] »
E. [Proposition vraie.]
Extrait E : « [phrase du document, mot pour mot] »
Réponses : A C E
Pièges : B restriction, D valeur modifiée
Niveau : intermédiaire
Source : [organisme] — [code et titre du document] — [date du document]

QIM 2. Concernant [autre thème], indiquez si les propositions suivantes sont vraies ou fausses.
A. [Proposition fausse : deux termes inversés.]
Extrait A : « [phrase du document qu'elle contredit] »
B. [Proposition fausse : une condition oubliée.]
Extrait B : « [phrase du document qu'elle contredit] »
C. [Proposition fausse : un terme remplacé par son voisin.]
Extrait C : « [phrase du document qu'elle contredit] »
D. [Proposition fausse : un énoncé juste attribué au mauvais équipement.]
Extrait D : « [phrase du document qu'elle contredit] »
E. [Proposition fausse : le dernier mot faux.]
Extrait E : « [phrase du document qu'elle contredit] »
Réponses : aucune
Pièges : A inversion, B condition oubliée, C terme voisin, D mauvaise attribution, E dernier mot
Niveau : avancé
Source : [organisme] — [code et titre du document] — [date du document]`,
  QCM: `QCM 1. Parmi les propositions suivantes concernant [thème unique de la question], lesquelles sont vraies ? (plusieurs réponses possibles)
A. [Proposition fausse : deux termes inversés.]
Extrait A : « [phrase du document qu'elle contredit, mot pour mot] »
B. [Proposition vraie, reprise fidèle d'une phrase du document.]
Extrait B : « [phrase du document qui la confirme, mot pour mot] »
C. [Proposition fausse : une condition oubliée.]
Extrait C : « [phrase du document qu'elle contredit, mot pour mot] »
D. [Proposition vraie.]
Extrait D : « [phrase du document, mot pour mot] »
E. [Proposition fausse : le dernier mot faux.]
Extrait E : « [phrase du document qu'elle contredit, mot pour mot] »
Réponses : B D
Pièges : A inversion, C condition oubliée, E dernier mot
Niveau : initial
Source : [organisme] — [code et titre du document] — [date du document]

QCM 2. Parmi les propositions suivantes concernant [autre thème], lesquelles sont fausses ? (plusieurs réponses possibles)
A. [Proposition fausse : une valeur modifiée.]
Extrait A : « [phrase du document qu'elle contredit] »
B. [Proposition vraie.]
Extrait B : « [phrase du document qui la confirme] »
C. [Proposition fausse : une restriction abusive.]
Extrait C : « [phrase du document qu'elle contredit] »
D. [Proposition vraie.]
Extrait D : « [phrase du document qui la confirme] »
E. [Proposition vraie.]
Extrait E : « [phrase du document qui la confirme] »
Réponses : A C
Pièges : A valeur modifiée, C restriction
Niveau : intermédiaire
Source : [organisme] — [code et titre du document] — [date du document]`,
};

/** Prompt à copier, avec le document joint à la conversation. */
export function promptGeneration(type: TypeGeneration): string {
  return `À partir des seules sources jointes à cette conversation, écris 10 questions de type ${type}, 5 propositions A à E chacune, pour le dépôt du site de formation de l'unité de pharmacotechnie (CHD Vendée).

${REPARTITION[type]}

Texte brut, sans markdown, sans introduction ni commentaire. Modèle exact :

${EXEMPLE_GENERATION[type]}

${CONSIGNE[type]}

Règles :
- Chaque proposition doit être tranchée par une phrase des sources ; sinon ne l'écris pas. N'invente rien.
- Extrait X : la phrase des sources qui tranche la proposition X, recopiée mot pour mot, 200 caractères au plus. Pour une proposition fausse, cite la phrase qu'elle contredit. Aucune phrase ne convient : omets la proposition, et renumérote les lettres sans trou.
- Une question = un seul thème. Propositions déclaratives au présent, 8 à 25 mots, une idée chacune, ton neutre.
- Niveau : initial (restitution), intermédiaire (reformulation, comparaison) ou avancé (raisonnement, piège) — environ 3, 4 et 3. Ce sont les trois niveaux des questions du site.
- Propositions fausses, une seule erreur chacune : inversion de deux termes (surpression/dépression, amont/aval, entrée/sortie, propre/stérile), terme remplacé par son voisin, valeur, unité ou signe modifiés, condition oubliée, énoncé juste attribué au mauvais équipement, local ou poste, dernier mot faux. Mots restrictifs (uniquement, toujours, jamais, tous) : au plus 3 propositions fausses et 1 vraie sur l'ensemble.
- Si les sources donnent des chiffres, au moins 2 questions en contiennent, avec unités.
- Figure ou photographie : une question peut porter sur une figure, une photographie ou un schéma des sources, si elle ne se comprend pas sans l'image. Écris alors, juste sous l'énoncé, « Image : figure-p12-1.png » (page 12, première figure de la page), puis « Description de l'image : … » — ce que montre l'image, en une phrase, sans donner la réponse. Chaque proposition reste tranchée par une phrase des sources : la légende de la figure ou le texte qui la commente. Le tuteur déposera la capture de la figure sous ce nom. Pas de figure dans les sources : pas de ligne Image.
- Les lettres vraies varient d'une question à l'autre.
- Numérotation continue, une ligne vide entre deux questions.

Règles propres au site :
- Réponses : les lettres à cocher, séparées par des espaces. Pour une QIM, les propositions vraies ; pour un QCM « lesquelles sont vraies ? », les vraies ; pour un QCM « lesquelles sont fausses ? », les fausses. Aucune : « Réponses : aucune ».
- N'écris ni « (V) » ni « (F) » en fin de proposition : le corrigé est sur la ligne Réponses.
- Pièges : la lettre de chaque proposition fausse, suivie de son type d'erreur.
- Source : recopie la référence que porte le document (organisme — code et titre — date), séparée par des tirets longs. Le document n'en porte pas : pas de ligne Source. Ne reconstitue ni code, ni titre, ni date.
- N'écris ni « Éliminatoire », ni « Réservée à l'évaluation », ni « Obligatoire » : ces décisions reviennent au tuteur.`;
}
