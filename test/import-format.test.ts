import { test } from "node:test";
import assert from "node:assert/strict";
import { alertesFormat, indiceFormat, plier } from "../lib/import-format";
import { protectionOperateur } from "../content/modules/protection-operateur";
import { comportementZac } from "../content/modules/comportement-zac";

test("plier garde la longueur : une position vaut dans le texte d'origine", () => {
  const t = "Lesquelles sont FAUSSES ? L’énoncé";
  assert.equal(plier(t).length, t.length);
  assert.equal(plier(t), "lesquelles sont fausses ? l enonce");
});

test("consignes de QIM : vraies ou fausses, chaque proposition, la ou les propositions exactes", () => {
  for (const e of [
    "Concernant la ZAC, indiquez si les propositions suivantes sont vraies ou fausses.",
    "Concernant la zone à atmosphère contrôlée, chaque proposition se juge séparément.",
    "Concernant l'exposition professionnelle aux cytotoxiques, indiquer la ou les propositions exactes.",
    "Les propositions suivantes sont-elles vraies ou fausses ?",
    "Jugez les propositions indépendamment.",
  ]) {
    const i = indiceFormat(e);
    assert.equal(i.format, "QIM", e);
    assert.equal(i.net, true, e);
    assert.equal(i.aRebours, false, e);
  }
  assert.equal(indiceFormat("indiquez si les propositions suivantes sont vraies ou fausses").motif, "vraies ou fausses");
});

test("consignes de QCM : lesquelles, plusieurs réponses, une question posée", () => {
  assert.deepEqual(indiceFormat("Parmi les propositions suivantes concernant X, lesquelles sont vraies ? (plusieurs réponses possibles)"), {
    format: "QCM",
    net: true,
    aRebours: false,
    motif: "lesquelles",
  });
  const posee = indiceFormat("Sur cette photographie du sas d'habillage, quel équipement manque-t-il ?");
  assert.equal(posee.format, "QCM");
  assert.equal(posee.net, false, "une question posée n'est qu'un indice faible");
  assert.equal(indiceFormat("Question sans corrigé").format, null, "rien : le format par défaut s'appliquera");
  assert.equal(indiceFormat("Énoncé").format, null);
});

test("QCM à rebours : « lesquelles sont fausses ? » est repéré", () => {
  for (const e of [
    "Parmi les propositions suivantes concernant X, lesquelles sont fausses ? (plusieurs réponses possibles)",
    "Quelle affirmation est inexacte ?",
  ]) {
    const i = indiceFormat(e);
    assert.equal(i.format, "QCM", e);
    assert.equal(i.aRebours, true, e);
  }
});

test("les énoncés des modules rédigés se lisent dans leur format", () => {
  for (const m of [protectionOperateur, comportementZac]) {
    for (const q of [...m.questions, ...m.misesEnSituation.flatMap((s) => s.questions)]) {
      if (q.type !== "QCM" && q.type !== "QIM") continue;
      assert.equal(indiceFormat(q.enonce).format, q.type, q.enonce);
    }
  }
});

const base = { options: [{ vrai: true }, { vrai: false }], corrigeDetecte: true };

test("alerte : QCM à rebours enregistré en QIM — corrigé à l'envers", () => {
  const enonce = "Parmi les propositions suivantes, lesquelles sont fausses ? (plusieurs réponses possibles)";
  const qim = alertesFormat({ ...base, format: "QIM", enonce });
  assert.equal(qim.length, 1);
  assert.match(qim[0], /corrigé à l'envers/);
  assert.deepEqual(alertesFormat({ ...base, format: "QCM", enonce }), [], "en QCM, le corrigé est lu dans son sens");
});

test("alerte : format contredit par la consigne, dans les deux sens", () => {
  const qimEnQcm = alertesFormat({ ...base, format: "QCM", enonce: "Concernant X, indiquez si les propositions suivantes sont vraies ou fausses." });
  assert.match(qimEnQcm[0], /comme une QIM \(« vraies ou fausses »\)/);
  const qcmEnQim = alertesFormat({ ...base, format: "QIM", enonce: "Parmi ces situations, lesquelles sont à risque ? (plusieurs réponses)" });
  assert.match(qcmEnQim[0], /tourné comme un QCM \(« lesquelles »\)/);
  assert.deepEqual(
    alertesFormat({ ...base, format: "QIM", enonce: "Que savez-vous de la ZAC ?" }),
    [],
    "une question posée ne suffit pas à contredire un format écrit",
  );
});

test("alertes propres au QCM : aucune vraie, plusieurs vraies sans « plusieurs », (V)/(F) sur un QCM à rebours", () => {
  assert.deepEqual(
    alertesFormat({ format: "QCM", enonce: "Laquelle ?", options: [{ vrai: false }, { vrai: false }], corrigeDetecte: true }),
    ["QCM sans aucune proposition vraie : vérifier le corrigé."],
  );
  assert.deepEqual(
    alertesFormat({ format: "QIM", enonce: "Concernant X.", options: [{ vrai: false }, { vrai: false }], corrigeDetecte: true }),
    [],
    "une QIM peut n'avoir aucune proposition vraie",
  );
  assert.match(
    alertesFormat({ format: "QCM", enonce: "Laquelle ?", options: [{ vrai: true }, { vrai: true }], corrigeDetecte: true })[0],
    /devrait mentionner « plusieurs réponses »/,
  );
  const marques = alertesFormat({
    format: "QCM",
    enonce: "Lesquelles sont fausses ? (plusieurs réponses)",
    options: [{ vrai: true }, { vrai: false }],
    corrigeDetecte: true,
    corrigeParMarqueurs: true,
  });
  assert.equal(marques.length, 1);
  assert.match(marques[0], /le site fait cocher les \(V\)/);
});
