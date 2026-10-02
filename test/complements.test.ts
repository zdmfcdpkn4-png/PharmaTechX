import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPLEMENTS_FIXES,
  LONGUEUR_MAX_COMPLEMENT,
  MARQUEUR_TEXTE,
  cleRessource,
  cleTexte,
  complementsDesRessources,
  complementsDesTextes,
  lireValeurComplement,
  procedureDuRapport,
  procedureEffective,
} from "../content/complements";
import { protectionOperateur } from "../content/modules/protection-operateur";
import { comportementZac } from "../content/modules/comportement-zac";
import type { Module } from "../content/types";

test("à compléter : la procédure et les cinq mentions de la page RGPD, chacune avec l'endroit où elle se voit", () => {
  assert.deepEqual(
    COMPLEMENTS_FIXES.map((c) => c.cle),
    ["procedure", "rgpd-responsable", "rgpd-contact", "rgpd-base-legale", "rgpd-hebergement", "rgpd-duree"],
  );
  for (const c of COMPLEMENTS_FIXES) {
    assert.ok(c.ou.href.startsWith("/"), `${c.cle} : adresse interne`);
    assert.ok(c.aide.length > 0, `${c.cle} : ce qu'il faut fournir`);
  }
});

test("à compléter : les documents « à rattacher » sont ceux des modules du code sans adresse", () => {
  const fictif = {
    id: "m",
    titre: "Module",
    ressources: [
      { id: "public", titre: "Texte public", nature: "reglementaire", url: "https://exemple.fr/texte.pdf" },
      { id: "interne", titre: "Procédure interne", nature: "procedure", url: null, commentaire: "à déposer par la PUI" },
    ],
  } as Pick<Module, "id" | "titre" | "ressources">;
  const [seul, ...reste] = complementsDesRessources([fictif]);
  assert.equal(reste.length, 0, "la source publique, qui a son adresse, n'attend rien");
  assert.equal(seul.cle, cleRessource("m", "interne"));
  assert.equal(seul.cle, "ressource:m:interne");
  assert.equal(seul.moduleId, "m");
  assert.equal(seul.ou.href, "/module/m");
  assert.match(seul.aide, /^à déposer par la PUI\. /);

  // Les deux modules rédigés : chaque document sans adresse, une clé chacun.
  const reels = complementsDesRessources([comportementZac, protectionOperateur]);
  assert.ok(reels.length > 0);
  assert.equal(new Set(reels.map((c) => c.cle)).size, reels.length, "clés uniques");
  for (const c of reels) {
    const m = [comportementZac, protectionOperateur].find((x) => x.id === c.moduleId)!;
    assert.equal(m.ressources.find((r) => cleRessource(m.id, r.id) === c.cle)?.url, null);
  }
});

test("à compléter : chaque donnée locale du texte, dans l'ordre de lecture, libellée par sa phrase", () => {
  const fictif = {
    id: "m",
    titre: "Module",
    sections: [
      { titre: "Une", corps: `Introduction.\n\nValeur locale de l'unité : ${MARQUEUR_TEXTE}.\n\n- **Liste** puis : \`${MARQUEUR_TEXTE}\`` },
      { titre: "Deux", corps: "Rien à préciser ici." },
      { titre: "Trois", corps: `1. Première phrase. Fréquence retenue : ${MARQUEUR_TEXTE} — 30 minutes ailleurs.` },
    ],
  } as unknown as Pick<Module, "id" | "titre" | "sections">;
  const textes = complementsDesTextes([fictif]);
  assert.deepEqual(
    textes.map((c) => [c.cle, c.libelle, c.ou.href]),
    [
      [cleTexte("m", 1), "Valeur locale de l'unité", "/module/m#section-1"],
      ["texte:m:2", "Liste puis", "/module/m#section-1"],
      ["texte:m:3", "Fréquence retenue", "/module/m#section-3"],
    ],
  );
  assert.match(textes[2].aide, /« Fréquence retenue : … — 30 minutes ailleurs\. »$/, "la phrase entière en aide");
  assert.ok(textes.every((c) => c.groupe === "texte" && c.long && !c.moduleId), "un champ de texte, sans document");

  // Les deux modules rédigés : autant de données que de marqueurs dans leurs sections.
  for (const m of [comportementZac, protectionOperateur]) {
    const attendues = m.sections.reduce((n, x) => n + x.corps.split(MARQUEUR_TEXTE).length - 1, 0);
    const reelles = complementsDesTextes([m]);
    assert.ok(attendues > 0, `${m.id} : des données locales à préciser`);
    assert.equal(reelles.length, attendues, m.id);
    assert.ok(reelles.every((c) => c.libelle.length > 0 && !c.libelle.includes(MARQUEUR_TEXTE)), `${m.id} : libellés lisibles`);
  }
});

test("à compléter : une valeur lue en base est bornée, sinon rien n'est renseigné", () => {
  assert.equal(lireValeurComplement(null), null);
  assert.equal(lireValeurComplement("texte nu"), null);
  assert.equal(lireValeurComplement({ texte: "   " }), null, "des blancs ne renseignent rien");
  assert.deepEqual(lireValeurComplement({ texte: "  PR-01 — Habilitation  " }), { texte: "PR-01 — Habilitation", document: null });
  assert.equal(lireValeurComplement({ texte: "x".repeat(LONGUEUR_MAX_COMPLEMENT + 20) })?.texte.length, LONGUEUR_MAX_COMPLEMENT);
  assert.deepEqual(lireValeurComplement({ texte: "", document: 12 }), { texte: "", document: 12 }, "un document seul suffit");
  assert.equal(lireValeurComplement({ texte: "", document: -1 }), null);
  assert.equal(lireValeurComplement({ texte: "", document: 1.5 }), null);
  assert.equal(lireValeurComplement({ texte: "", document: "12" }), null);
});

test("procédure : celle du site, sinon Render, sinon le marqueur ; un rapport garde celle de son émission", () => {
  assert.equal(procedureEffective({ texte: "PR-SITE", document: null }, "PR-RENDER"), "PR-SITE");
  assert.equal(procedureEffective(null, "PR-RENDER"), "PR-RENDER");
  assert.equal(procedureEffective(undefined, null), null);
  // Scellée à l'émission : vide, aucune n'était en vigueur ; un rapport plus ancien garde l'ancienne lecture.
  assert.equal(procedureDuRapport("PR-2026-A", "PR-2027-B"), "PR-2026-A");
  assert.equal(procedureDuRapport("", "PR-2027-B"), null);
  assert.equal(procedureDuRapport(null, "PR-2027-B"), "PR-2027-B");
});
