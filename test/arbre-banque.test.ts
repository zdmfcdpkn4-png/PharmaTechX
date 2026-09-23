import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOUS,
  ancreDe,
  cheminDe,
  construireArbre,
  elaguer,
  estOuvert,
  lireChemin,
  lirePlis,
  retourBanque,
  type ModuleRattache,
} from "../content/arbre-banque";

// ── Banque en arborescence par profil (question 64, choix b, 23/09/2026)

const filieres = [
  { id: "socle", libelle: "Socle commun" },
  { id: "chimiotherapie", libelle: "Chimiothérapie", badge: "isolateur" },
  { id: "sterilisation", libelle: "Stérilisation" },
];
const niveaux = [
  { code: "N1a", libelle: "N1a — socle général" },
  { code: "N2", libelle: "N2 — routine" },
];

function mod(id: string, postes: string[], niv: string[]): ModuleRattache {
  return { id, titre: `Titre ${id}`, etiquette: id.toUpperCase(), postes, niveaux: niv };
}

const modules = [
  mod("tronc-sans-niveau", [], []),
  mod("tronc-n1a", [], ["N1a"]),
  mod("double", ["chimiotherapie"], ["N1a", "N2"]),
  mod("deux-filieres", ["chimiotherapie", "sterilisation"], ["N2"]),
  mod("orphelin", ["chimiotherapie"], ["N9"]),
  mod("filiere-retiree", ["ancienne"], []),
];

test("filière, niveau, module : tronc commun en tête, filières du référentiel, filière absente en fin", () => {
  const arbre = construireArbre(filieres, niveaux, modules);
  assert.deepEqual(
    arbre.map((f) => [f.libelle, f.connue]),
    [
      ["Tronc commun — tous postes", true],
      ["Chimiothérapie", true],
      ["Stérilisation", true],
      ["ancienne — filière absente du référentiel", false],
    ],
    "la filière « socle » n'est jamais une branche : ses modules sont au tronc commun",
  );
  const tronc = arbre[0];
  assert.deepEqual(
    tronc.niveaux.map((n) => [n.code, n.libelle, n.modules.map((m) => m.module.id)]),
    [
      [null, "Tous niveaux", ["tronc-sans-niveau"]],
      ["N1a", "N1a — socle général", ["tronc-n1a"]],
    ],
    "« Tous niveaux » d'abord, puis les niveaux dans l'ordre du référentiel ; un niveau sans module n'a pas de branche",
  );
  const chimio = arbre[1];
  assert.deepEqual(
    chimio.niveaux.map((n) => [n.code, n.connu, n.modules.map((m) => m.module.id)]),
    [
      ["N1a", true, ["double"]],
      ["N2", true, ["double", "deux-filieres"]],
      ["N9", false, ["orphelin"]],
    ],
    "un niveau cité mais absent du référentiel reste visible, en fin de filière",
  );
  assert.deepEqual(chimio.modules.map((m) => m.id), ["double", "deux-filieres", "orphelin"], "décompte de la filière : chaque module une fois");
});

test("un module rattaché à deux niveaux ou deux filières figure sous chacun, et le dit", () => {
  const arbre = construireArbre(filieres, niveaux, modules);
  const branches = arbre.flatMap((f) => f.niveaux.flatMap((n) => n.modules));
  const double = branches.filter((b) => b.module.id === "double");
  assert.equal(double.length, 2, "sous N1a et sous N2");
  assert.deepEqual(double.map((b) => b.aussiSous), [["Chimiothérapie › N2"], ["Chimiothérapie › N1a"]]);
  const deux = branches.filter((b) => b.module.id === "deux-filieres");
  assert.deepEqual(deux.map((b) => b.aussiSous), [["Stérilisation › N2"], ["Chimiothérapie › N2"]]);
  const seul = branches.find((b) => b.module.id === "tronc-n1a")!;
  assert.deepEqual(seul.aussiSous, [], "un module rattaché une fois n'annonce rien");
  assert.equal(new Set(branches.map((b) => b.chemin)).size, branches.length, "chaque branche a son propre chemin");
});

test("chemins : tronc commun et « Tous niveaux » sous l'astérisque, segments encodés", () => {
  const arbre = construireArbre(filieres, niveaux, modules);
  assert.equal(arbre[0].chemin, TOUS);
  assert.equal(arbre[0].niveaux[0].chemin, `${TOUS}/${TOUS}`);
  assert.equal(arbre[0].niveaux[0].modules[0].chemin, "*/*/tronc-sans-niveau");
  assert.equal(arbre[1].niveaux[1].modules[0].chemin, "chimiotherapie/N2/double");
  assert.equal(cheminDe("a/b", "c d"), "a%2Fb/c%20d", "un « / » dans un identifiant ne coupe pas le chemin");
});

test("élagage : seuls les modules retenus, et les branches qui en portent encore", () => {
  const arbre = construireArbre(filieres, niveaux, modules);
  const elague = elaguer(arbre, (id) => id === "double");
  assert.deepEqual(
    elague.map((f) => [f.libelle, f.modules.map((m) => m.id), f.niveaux.map((n) => n.code)]),
    [["Chimiothérapie", ["double"], ["N1a", "N2"]]],
  );
  assert.deepEqual(
    elague[0].niveaux[1].modules[0].aussiSous,
    ["Chimiothérapie › N1a"],
    "le rattachement ne change pas avec le filtre",
  );
  assert.deepEqual(elaguer(arbre, () => false), [], "rien de retenu : aucune branche");
  assert.equal(arbre[1].niveaux.length, 3, "l'arbre d'origine n'est pas modifié");
});

test("repli par défaut : filières ouvertes, le reste replié ; sous un filtre, ouvert jusqu'aux modules", () => {
  const defaut = { plis: "defaut" as const, ouvrir: null, filtre: false };
  assert.equal(estOuvert("chimiotherapie", 1, defaut), true);
  assert.equal(estOuvert("chimiotherapie/N2", 2, defaut), false);
  assert.equal(estOuvert("chimiotherapie/N2/double", 3, defaut), false);
  const filtre = { ...defaut, filtre: true };
  assert.equal(estOuvert("chimiotherapie/N2", 2, filtre), true);
  assert.equal(estOuvert("chimiotherapie/N2/double", 3, filtre), true);
  assert.equal(estOuvert("chimiotherapie/N2/double/q-1", 4, filtre), false, "une question ne s'ouvre qu'à la demande");
});

test("Tout déplier s'arrête aux modules ; Tout replier replie tout", () => {
  const tout = { plis: "tout" as const, ouvrir: null, filtre: false };
  assert.equal(estOuvert("*", 1, tout), true);
  assert.equal(estOuvert("*/N1a", 2, tout), true);
  assert.equal(estOuvert("*/N1a/tronc-n1a", 3, tout), true);
  assert.equal(estOuvert("*/N1a/tronc-n1a/q-1", 4, tout), false);
  const aucun = { plis: "aucun" as const, ouvrir: null, filtre: true };
  assert.equal(estOuvert("*", 1, aucun), false, "même sous un filtre");
  assert.equal(estOuvert("*/N1a", 2, aucun), false);
});

test("après un geste, la branche du geste est rouverte, ancêtres compris, et elle seule", () => {
  const e = { plis: "aucun" as const, ouvrir: "chimiotherapie/N2/double/q-1", filtre: false };
  assert.equal(estOuvert("chimiotherapie", 1, e), true);
  assert.equal(estOuvert("chimiotherapie/N2", 2, e), true);
  assert.equal(estOuvert("chimiotherapie/N2/double", 3, e), true);
  assert.equal(estOuvert("chimiotherapie/N2/double/q-1", 4, e), true, "la question elle-même, pour voir son nouvel état");
  assert.equal(estOuvert("chimiotherapie/N1a/double", 3, e), false, "le même module sous une autre branche reste replié");
  assert.equal(estOuvert("chimiotherapie/N2/doublet", 3, e), false, "un préfixe de mot n'est pas un ancêtre");
});

test("lecture de l'adresse : plis inconnu = défaut, chemin trop long ignoré", () => {
  assert.equal(lirePlis(undefined), "defaut");
  assert.equal(lirePlis("tout"), "tout");
  assert.equal(lirePlis("aucun"), "aucun");
  assert.equal(lirePlis("n'importe"), "defaut");
  assert.equal(lireChemin(undefined), null);
  assert.equal(lireChemin(""), null);
  assert.equal(lireChemin("*/N1a/m"), "*/N1a/m");
  assert.equal(lireChemin("x".repeat(601)), null);
});

test("adresse de retour : la banque seulement, ancre gardée, paramètres placés avant elle", () => {
  assert.equal(retourBanque("/admin/questions?module=m"), "/admin/questions?module=m");
  assert.equal(
    retourBanque("/admin/questions?vue=arbre&ouvrir=*%2FN1a#arb-x", { erreur: "quatre-yeux" }),
    "/admin/questions?vue=arbre&ouvrir=*%2FN1a&erreur=quatre-yeux#arb-x",
    "l'erreur avant l'ancre, sinon le serveur ne la lit pas",
  );
  assert.equal(retourBanque("/admin/questions?ok=creee", { ok: "modifiee" }), "/admin/questions?ok=modifiee", "remplacée, pas doublée");
  assert.equal(retourBanque("/admin/questions"), "/admin/questions");
  assert.equal(retourBanque("https://ailleurs.example/admin/questions"), null, "jamais une autre adresse");
  assert.equal(retourBanque("//ailleurs.example/admin/questions"), null);
  assert.equal(retourBanque("/admin/questionsX"), null);
  assert.equal(retourBanque("/admin/signalements"), null);
  assert.equal(retourBanque(undefined), null);
  assert.equal(retourBanque(null), null);
  assert.equal(retourBanque(`/admin/questions?x=${"y".repeat(1200)}`), null, "une adresse démesurée n'est pas lue");
});

test("ancres : sans caractère à réencoder, et deux chemins distincts n'ont jamais la même", () => {
  assert.equal(ancreDe("*/N1a/b1-01"), "arb-_2a__2f_N1a_2f_b1-01");
  assert.match(ancreDe("chimio/N2/q-Ab_9%20"), /^[A-Za-z0-9_-]+$/);
  const chemins = ["a_b", "a/b", "a_2f_b", "a%2Fb", "*/*", "_2a_"];
  assert.equal(new Set(chemins.map(ancreDe)).size, chemins.length, "injective, « _ » compris");
});
