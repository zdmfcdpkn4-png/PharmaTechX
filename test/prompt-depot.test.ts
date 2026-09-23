import test from "node:test";
import assert from "node:assert/strict";
import { EXEMPLE_DEPOT, promptDepot } from "../content/prompt-depot";
import { analyserTexte } from "../lib/import-questions";
import { alertesFormat } from "../lib/import-format";
import { reperesModules, resoudreLigneModule } from "../lib/import-module";
import { emplacements } from "../content/parcours";
import { protectionOperateur } from "../content/modules/protection-operateur";
import { comportementZac } from "../content/modules/comportement-zac";

/** Les modules du code, sous la forme que lit la ligne « Module : ». */
const MODULES_CODE = [protectionOperateur, comportementZac, ...emplacements].map((m) => ({
  id: m.id,
  titre: m.titre,
  critere: String(m.critereId),
}));

/*
 * Le prompt décrit un format ; l'analyseur en lit un autre s'ils divergent.
 * On passe donc l'exemple du prompt dans l'analyseur réel : toute dérive de
 * l'un par rapport à l'autre tombe ici.
 */
test("l'exemple du prompt est lu par l'analyseur du dépôt", () => {
  const r = analyserTexte(EXEMPLE_DEPOT, { formatDefaut: "QCM" });
  assert.deepEqual(
    r.questions.map((q) => q.format),
    ["QCM", "QIM", "QCM", "SCH", "ORD", "TAT"],
    "six questions, dans l'ordre de l'exemple",
  );

  const [qcm, qim, illustre, schema, sequence, trous] = r.questions;

  assert.equal(qcm.options.length, 4);
  assert.deepEqual(
    qcm.options.filter((o) => o.vrai).map((o) => o.id),
    ["a", "c"],
    "le corrigé « Réponses : A C » est lu",
  );
  assert.ok(qcm.corrigeDetecte, "corrigé complet");
  assert.ok(qcm.eliminatoire, "« Éliminatoire : oui » est lu");
  assert.ok(qcm.reservee, "« Réservée à l'évaluation : oui » est lu");
  assert.equal(qcm.niveauQuestion, "intermediaire", "« Niveau : intermédiaire » est lu");
  assert.equal(qim.niveauQuestion, null, "sans ligne de niveau : à préciser");
  assert.equal(qcm.refs.length, 1, "une source lue");
  assert.match(qcm.justification, /après la correction/);

  assert.equal(qim.options.length, 3);
  assert.deepEqual(qim.options.map((o) => o.vrai), [true, false, true]);

  assert.equal(illustre.imageNom, "sas-habillage.jpg", "l'illustration d'un QCM est lue");
  assert.match(illustre.imageAlt ?? "", /^Sas d'habillage vu depuis l'entrée/, "sa description est lue");
  assert.equal(illustre.options.length, 3);

  assert.equal(schema.legendes.length, 2);
  assert.equal(schema.imageNom, "isolateur-coupe.png");
  assert.match(schema.imageAlt ?? "", /^Coupe d'un isolateur/);
  assert.equal(schema.legendes[1].attendu, "filtre HEPA | filtre terminal");

  assert.deepEqual(
    sequence.options.map((o) => o.texte),
    ["Hygiène des mains", "Surchaussures", "Combinaison"],
    "les étapes sont lues dans l'ordre juste",
  );
  assert.ok(sequence.options.every((o) => o.vrai), "toutes les étapes comptent, c'est l'ordre qui est jugé");
  assert.equal(sequence.imageNom, "tenue-zac.jpg", "une séquence porte une illustration (23/09/2026)");
  assert.match(sequence.imageAlt ?? "", /mannequin/);
  assert.equal(sequence.enonce.includes("Image"), false, "la ligne Image ne se colle plus à l'énoncé");

  assert.equal(trous.enonce.includes("{1}"), true, "les marques de trou restent dans l'énoncé");
  assert.deepEqual(
    trous.options.filter((o) => o.vrai).map((o) => o.texte),
    ["transfert", "zone à atmosphère contrôlée"],
    "les vignettes attendues suivent l'ordre des trous",
  );
  assert.deepEqual(
    trous.options.filter((o) => !o.vrai).map((o) => o.texte),
    ["couloir", "décontamination"],
    "les leurres viennent ensuite",
  );

  assert.equal(r.avertissements.length, 0, "aucun avertissement sur l'exemple de référence");
  assert.deepEqual(
    r.questions.map((q) => alertesFormat(q)),
    [[], [], [], [], [], []],
    "aucune alerte de format non plus",
  );
  assert.deepEqual(
    [qcm, qim, illustre].map((q) => q.origineFormat),
    ["mot-cle", "mot-cle", "mot-cle"],
    "le format vient du mot-clé",
  );

  // Questions 57 et 58 : un dépôt sert plusieurs modules, par ligne « Module : ».
  assert.deepEqual(
    r.questions.map((q) => q.moduleLigne),
    ["B1-01", "B1-01", "B1-01", "B3-01", "B1-01", "B1-01"],
    "chaque ligne Module vaut pour les questions qui la suivent",
  );
  assert.deepEqual(resoudreLigneModule("B1-01", MODULES_CODE), { id: "comportement-zac" });
  assert.deepEqual(resoudreLigneModule("B3-01", MODULES_CODE), { id: "critere-b3-01" });
});

test("le prompt porte l'exemple, la liste des modules, et interdit d'inventer", () => {
  const noms = reperesModules(MODULES_CODE);
  const prompt = promptDepot(MODULES_CODE.map((m) => ({ repere: noms.get(m.id) ?? m.id, titre: m.titre })));
  assert.ok(prompt.includes(EXEMPLE_DEPOT), "l'exemple est repris dans le prompt");
  assert.match(prompt, /N'invente rien/);
  assert.match(prompt, /\[à vérifier\]/);
  assert.match(prompt, /TEXTE SOURCE/);
  assert.match(prompt, /Chaque question commence par son mot-clé/, "mot-clé exigé (question 58)");
  assert.match(prompt, /écris « Q n\. »/, "format inconnu : ni QCM ni QIM inventé");
  assert.match(prompt, /« Module : B1-05 »/, "ligne Module décrite (question 57)");
  assert.ok(prompt.includes("MODULES (code — titre)\nB1-01 — Comportement et habillage"), "liste triée par code");
  assert.ok(prompt.includes("B7-01 — Participation à la formation"), "dernier critère listé");
  const lignes = prompt.split("MODULES (code — titre)\n")[1].split("\n\n")[0].split("\n");
  assert.equal(lignes.length, 53, "un module par critère de la fiche");
  for (const ligne of lignes) {
    const code = ligne.split(" — ")[0];
    assert.ok(resoudreLigneModule(code, MODULES_CODE).id, `le code ${code} de la liste se relit`);
  }
});

// ─────────────────────────── Prompt de génération à partir d'un document

import { EXEMPLE_GENERATION, promptGeneration } from "../content/prompt-depot";

for (const type of ["QIM", "QCM"] as const) {
  test(`génération ${type} : l'exemple du prompt est lu sans avertissement`, () => {
    const r = analyserTexte(EXEMPLE_GENERATION[type], { formatDefaut: type });
    assert.equal(r.questions.length, 2);
    assert.deepEqual(r.avertissements, []);
    for (const q of r.questions) {
      assert.equal(q.format, type);
      assert.equal(q.options.length, 5, "cinq propositions, A à E");
      assert.ok(q.corrigeDetecte, "corrigé lu sur la ligne Réponses");
      assert.deepEqual(q.avertissements, [], `aucun avertissement : ${q.enonce.slice(0, 40)}`);
      assert.equal(
        q.options.some((o) => /Extrait|«/.test(o.texte)),
        false,
        "aucun extrait n'est collé au texte d'une proposition",
      );
      assert.match(q.justification, /^A : « .+ » ; B : « .+ » ; C : « .+ » ; D : « .+ » ; E : « .+ »\./, "extraits dans l'ordre des lettres");
      assert.match(q.justification, /Pièges : .+\.$/, "les pièges ferment la justification");
      assert.equal(/Niveau|Difficulté/.test(q.justification), false, "le niveau n'est plus dans la justification");
      assert.ok(q.niveauQuestion && ["initial", "intermediaire", "avance"].includes(q.niveauQuestion), "le niveau est un champ");
      assert.equal(q.refs.length, 1, "source lue");
    }
  });

  test(`génération ${type} : le prompt porte la répartition du modèle et les règles du site`, () => {
    const p = promptGeneration(type);
    assert.ok(p.includes(`écris 10 questions de type ${type}`));
    assert.ok(p.includes("environ 3, 4 et 3"), "trois niveaux de difficulté");
    assert.ok(p.includes("N'invente rien"));
    assert.ok(p.includes("Réponses : aucune"));
    assert.ok(p.includes("N'écris ni « (V) » ni « (F) »"));
    assert.ok(p.includes("N'écris ni « Éliminatoire » ni « Réservée à l'évaluation »"));
    assert.ok(p.includes(EXEMPLE_GENERATION[type]), "l'exemple testé est celui du prompt");
  });
}

test("génération QIM : une question sans aucune vraie se lit « Réponses : aucune »", () => {
  const [, seconde] = analyserTexte(EXEMPLE_GENERATION.QIM, { formatDefaut: "QIM" }).questions;
  assert.equal(seconde.options.some((o) => o.vrai), false);
  assert.ok(seconde.corrigeDetecte);
});

test("génération QCM : tout énoncé porte « plusieurs », sinon le site afficherait des boutons radio", () => {
  for (const q of analyserTexte(EXEMPLE_GENERATION.QCM, { formatDefaut: "QCM" }).questions) {
    assert.match(q.enonce, /plusieurs réponses possibles/);
  }
  assert.ok(promptGeneration("QCM").includes("figure sur TOUTES les questions"));
});

test("génération QCM : « lesquelles sont fausses ? » — les lettres à cocher sont les fausses", () => {
  const [, fausses] = analyserTexte(EXEMPLE_GENERATION.QCM, { formatDefaut: "QCM" }).questions;
  assert.match(fausses.enonce, /lesquelles sont fausses/);
  assert.deepEqual(fausses.options.filter((o) => o.vrai).map((o) => o.id), ["a", "c"]);
  assert.match(fausses.justification, /Pièges : A valeur modifiée, C restriction\./);
});

test("génération : le prompt emploie les trois niveaux du site, et eux seuls", () => {
  for (const type of ["QIM", "QCM"] as const) {
    const p = promptGeneration(type);
    assert.ok(p.includes("Niveau : initial (restitution), intermédiaire (reformulation, comparaison) ou avancé (raisonnement, piège)"));
    assert.equal(/Difficulté|\bbase\b/.test(p), false, `${type} : plus de « Difficulté » ni de « base »`);
  }
});

// ─────────────────────────── Illustrations de tout type (23/09/2026)

test("prompt de transcription : image et description pour tout type, sans donner la réponse", () => {
  const prompt = promptDepot([]);
  assert.match(prompt, /tout type \(QCM, QIM, séquence, texte à trous\)/);
  assert.match(prompt, /« Description de l'image : … »/);
  assert.match(prompt, /sans donner la réponse/);
  assert.match(prompt, /N'annonce une image que si le texte source en désigne une/);
});

test("prompt de génération : une figure du document s'annonce, et se lit au dépôt", () => {
  for (const type of ["QIM", "QCM"] as const) {
    const p = promptGeneration(type);
    assert.ok(p.includes("« Image : figure-p12-1.png »"), `${type} : nom de la capture à déposer`);
    assert.ok(p.includes("Pas de figure dans les sources : pas de ligne Image."));
  }
  // Ce qu'un assistant écrirait en suivant la règle : lu sans avertissement.
  const [q] = analyserTexte(
    `QIM 1. Concernant la figure du sas, indiquez si les propositions suivantes sont vraies ou fausses.
Image : figure-p12-1.png
Description de l'image : Plan du sas de transfert et de ses deux portes.
A. Les deux portes du sas ne s'ouvrent jamais en même temps.
Extrait A : « les portes sont asservies »
B. Le sas est en surpression par rapport au couloir.
Extrait B : « le sas est en dépression »
Réponses : A
Pièges : B inversion
Niveau : initial`,
    { formatDefaut: "QIM" },
  ).questions;
  assert.equal(q.imageNom, "figure-p12-1.png");
  assert.equal(q.imageAlt, "Plan du sas de transfert et de ses deux portes.");
  assert.deepEqual(q.avertissements, []);
  assert.equal(/Image|Description/.test(q.enonce), false, "ni l'une ni l'autre ligne dans l'énoncé");
});

test("texte à trous : la ligne Image est lue comme pour les autres formats", () => {
  const [q] = analyserTexte(
    `TEXTE 1. Sur cette photographie, la porte du sas s'ouvre vers le {1}.
Image : sas-porte.jpg
Description de l'image : Porte d'un sas, vue de face.
1. couloir
Leurres : local`,
    { formatDefaut: "QCM" },
  ).questions;
  assert.equal(q.format, "TAT");
  assert.equal(q.imageNom, "sas-porte.jpg");
  assert.equal(q.imageAlt, "Porte d'un sas, vue de face.");
  assert.equal(q.enonce, "Sur cette photographie, la porte du sas s'ouvre vers le {1}.");
});

test("description sans ligne Image : signalée ; « Description : » seule reste du texte", () => {
  const [sansImage] = analyserTexte(
    `QCM 1. Quelle tenue ?
Description de l'image : Tenue sur mannequin.
A. Combinaison (V)
B. Blouse (F)`,
    { formatDefaut: "QCM" },
  ).questions;
  assert.equal(sansImage.imageNom, undefined);
  assert.ok(sansImage.avertissements.some((a) => a.startsWith("Description d'image sans ligne « Image : »")));

  const [libre] = analyserTexte(
    `QCM 1. Lisez l'extrait.
Description : la zone est classée ISO 7.
A. Vrai (V)
B. Faux (F)`,
    { formatDefaut: "QCM" },
  ).questions;
  assert.equal(libre.imageAlt, undefined, "sans « de l'image », la ligne n'est pas une description d'image");
  assert.match(libre.enonce, /Description : la zone est classée ISO 7\./, "elle continue l'énoncé, comme avant");
});
