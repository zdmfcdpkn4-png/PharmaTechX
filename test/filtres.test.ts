import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adresseDuFiltre,
  adresseFiltree,
  compteRetenu,
  correspond,
  filtrent,
  libellePuce,
  lireChoix,
  lireJour,
  lireTexte,
  parametresActifs,
  periode,
  pucesFiltres,
  retourListe,
  type ChampFiltre,
} from "../content/filtres";
import {
  DOCUMENTS_GENERAUX,
  SANS_PROGRAMME,
  codeRetenu,
  critereProgrammeRetenu,
  documentRetenu,
  entreeReferentielRetenue,
  etapeRapport,
  ligneRepertoireRetenue,
  lireFiltrePersonnel,
  lireFiltreProgrammeComplet,
  lireFiltreProgrammes,
  lireFiltreRattachement,
  lireFiltreReferentiel,
  lireFiltreSituations,
  moduleRegleRetenu,
  programmeRetenu,
  situationRetenue,
  lireFiltreCodes,
  lireFiltreDocuments,
  lireFiltreModules,
  lireFiltreRapports,
  lireFiltreSignalements,
  moduleDeposeRetenu,
  rapportRetenu,
  signalementRetenu,
  statutDeLEtape,
} from "../content/filtres-listes";

const ETAT: ChampFiltre = {
  nom: "etat",
  libelle: "État",
  options: [
    { valeur: "actif", libelle: "Actifs" },
    { valeur: "revoque", libelle: "Révoqués" },
  ],
  valeur: "revoque",
  minuscule: true,
};
const PROFIL: ChampFiltre = { nom: "profil", libelle: "Profil", options: [{ valeur: "tuteur", libelle: "Tutorat" }], valeur: "" };

test("lecture des paramètres : texte resserré et coupé, choix permis, jour valide, période remise dans l'ordre", () => {
  assert.equal(lireTexte("  poste   isolateur "), "poste isolateur");
  assert.equal(lireTexte(["a", "b"]), "a", "un paramètre répété : le premier");
  assert.equal(lireTexte(42), "");
  assert.equal(lireTexte("x".repeat(300)).length, 100);
  assert.equal(lireChoix("tuteur", ["poste", "tuteur"]), "tuteur");
  assert.equal(lireChoix("pharmacien", ["poste", "tuteur"]), "", "valeur inconnue : aucun filtre");
  assert.equal(lireJour("2026-10-02"), "2026-10-02");
  assert.equal(lireJour("2026-02-30"), "", "jour impossible");
  assert.deepEqual(periode("2026-10-02", "2026-09-01"), ["2026-09-01", "2026-10-02"]);
  assert.deepEqual(periode("", "2026-09-01"), ["", "2026-09-01"]);
});

test("recherche : chaque mot, sans casse ni accents, dans n'importe quel ordre", () => {
  assert.ok(correspond("Poste isolateur — Bloc A", "bloc isolateur"));
  assert.ok(correspond("Réévaluation", "reevaluation"));
  assert.ok(!correspond("Poste isolateur", "isolateur hotte"));
  assert.ok(correspond("n'importe quoi", ""), "recherche vide : tout est retenu");
});

test("puces : une par filtre actif, chacune retire le sien et garde les autres ; libellés", () => {
  const recherche = { valeur: "bloc A", placeholder: "" };
  const puces = pucesFiltres("/admin", [["vue", "liste"]], recherche, [PROFIL, ETAT]);
  assert.deepEqual(
    puces.map((p) => p.libelle),
    ["Recherche : « bloc A »", "État : révoqués"],
  );
  assert.equal(puces[0].href, "/admin?vue=liste&etat=revoque", "sans la recherche, état et paramètre gardé restent");
  assert.equal(puces[1].href, "/admin?vue=liste&q=bloc+A");
  assert.deepEqual(parametresActifs(undefined, [PROFIL, ETAT]), [["etat", "revoque"]]);
  assert.equal(adresseFiltree("/admin/modules", []), "/admin/modules");
  assert.equal(libellePuce({ nom: "du", libelle: "Du", type: "jour", valeur: "2026-10-01" }), "Du 01/10/2026");
  assert.equal(libellePuce({ ...PROFIL, valeur: "tuteur" }), "Profil : Tutorat", "sans minuscule demandée, l'option telle quelle");
  assert.equal(
    libellePuce({ nom: "etape", libelle: "Statut", options: [{ valeur: "clos", libelle: "Clos (4)", puce: "Clos" }], valeur: "clos", minuscule: true }),
    "Statut : clos",
    "la puce ne reprend pas le compte de l'option",
  );
});

test("compte retenu : « n sur N » sous un filtre, accordé au nombre qui précède", () => {
  assert.equal(compteRetenu(12, 41, ["code", "codes"], true), "12 codes sur 41");
  assert.equal(compteRetenu(1, 41, ["code", "codes"], true), "1 code sur 41");
  assert.equal(compteRetenu(0, 41, ["code", "codes"], true), "0 code sur 41");
  assert.equal(compteRetenu(41, 41, ["code", "codes"], false), "41 codes");
  assert.equal(compteRetenu(1, 1, ["code", "codes"], false), "1 code");
  // Un tri a sa puce mais ne réduit pas la liste : le compte reste « 5 modules », pas « 5 sur 5 ».
  const CLASSEMENT: ChampFiltre = { nom: "ordre", libelle: "Classement", options: [{ valeur: "fort", libelle: "Le meilleur d'abord" }], valeur: "fort", tri: true };
  assert.equal(filtrent(undefined, [CLASSEMENT]), false);
  assert.equal(filtrent(undefined, [CLASSEMENT, { ...ETAT, valeur: "" }]), false);
  assert.equal(filtrent(undefined, [CLASSEMENT, ETAT]), true);
  assert.equal(filtrent({ valeur: "zac", placeholder: "" }, [CLASSEMENT]), true);
  assert.equal(pucesFiltres("/admin/statistiques", [], undefined, [CLASSEMENT]).length, 1, "le tri garde sa puce");
});

test("codes d'accès : libellé, profil, état, filière et niveau exacts, programme à la carte ou aucun", () => {
  const ref = { filieres: ["chimiotherapie", "sterile"], niveaux: ["N1a", "N2"], programmes: [3] };
  const code = { role: "poste", libelle: "Intérimaire bloc", filiere: "chimiotherapie", niveau: "N1a", programme_id: 3, actif: true };
  const f = lireFiltreCodes({ q: "interimaire", profil: "poste", etat: "actif", filiere: "chimiotherapie", niveau: "N1a", programme: "3" }, ref);
  assert.ok(codeRetenu(code, f));
  assert.ok(!codeRetenu({ ...code, actif: false }, f), "révoqué écarté par « actifs »");
  assert.ok(!codeRetenu({ ...code, filiere: null }, f), "un code sans filière n'est pas un code de cette filière");
  assert.ok(!codeRetenu(code, { ...f, programme: SANS_PROGRAMME }));
  assert.ok(codeRetenu({ ...code, programme_id: null }, { ...f, programme: SANS_PROGRAMME }));
  assert.equal(lireFiltreCodes({ programme: "99", profil: "pharmacien" }, ref).programme, "", "programme inconnu ignoré");
});

test("rapports : étape du circuit, statut demandé à la base, verdict après arbitrage", () => {
  assert.equal(etapeRapport({ statut: "emis", verdictBrut: "indetermine", arbitre: false }), "a_arbitrer");
  assert.equal(etapeRapport({ statut: "emis", verdictBrut: "indetermine", arbitre: true }), "a_viser_tuteur");
  assert.equal(etapeRapport({ statut: "emis", verdictBrut: "acquis", arbitre: false }), "a_viser_tuteur");
  assert.equal(etapeRapport({ statut: "vise_tuteur", verdictBrut: "acquis", arbitre: false }), "a_viser_pharmacien");
  assert.equal(etapeRapport({ statut: "clos", verdictBrut: "acquis", arbitre: false }), "clos");
  assert.equal(statutDeLEtape("a_arbitrer"), "emis");
  assert.equal(statutDeLEtape("a_viser_pharmacien"), "vise_tuteur");
  assert.equal(statutDeLEtape(""), undefined);
  const f = lireFiltreRapports({ etape: "a_arbitrer", verdict: "acquis", du: "2026-10-02", au: "2026-09-01", module: "inconnu" }, ["comportement-zac"]);
  assert.deepEqual([f.du, f.au, f.module], ["2026-09-01", "2026-10-02", ""]);
  assert.ok(!rapportRetenu({ etape: "a_viser_tuteur", verdict: "acquis" }, f));
  assert.ok(rapportRetenu({ etape: "a_arbitrer", verdict: "acquis" }, f));
  assert.ok(!rapportRetenu({ etape: "a_arbitrer", verdict: "non_acquis" }, f));
});

test("signalements : ouvert ou clos, motif, objet (question ou fiche), module", () => {
  const s = { statut: "traite", motif: "Ambigu", depot_id: null, module_id: "comportement-zac" };
  const f = lireFiltreSignalements({ etat: "clos", motif: "Ambigu", objet: "question", module: "comportement-zac" }, ["comportement-zac"]);
  assert.ok(signalementRetenu(s, f));
  assert.ok(signalementRetenu({ ...s, statut: "rejete" }, f), "rejeté : clos aussi");
  assert.ok(!signalementRetenu({ ...s, statut: "ouvert" }, f));
  assert.ok(!signalementRetenu({ ...s, depot_id: 4 }, f), "une fiche n'est pas une question");
  assert.equal(lireFiltreSignalements({ motif: "Inventé" }, []).motif, "");
  assert.equal(lireFiltreSignalements({ motif: "Fichier illisible ou qui ne s'ouvre pas" }, []).motif, "Fichier illisible ou qui ne s'ouvre pas");
});

test("modules déposés : recherche, statut, bloc ; un tronc commun ou un module sans niveau concerne chaque profil", () => {
  const ref = { blocs: [1, 5], filieres: ["chimiotherapie", "sterile"], niveaux: ["N1a", "N2"] };
  const m = {
    id: "mod-x",
    titre: "Élimination des déchets cytotoxiques",
    objectif: "Trier",
    critere_id: "B5-09",
    statut: "publie",
    bloc: 5,
    filieres: [] as string[],
    niveaux: ["N2"],
  };
  const f = lireFiltreModules({ q: "dechets", statut: "publie", bloc: "5", filiere: "sterile", niveau: "n2" }, ref);
  assert.equal(f.niveau, "", "le niveau se lit tel que le référentiel l'écrit");
  assert.ok(moduleDeposeRetenu(m, { ...f, niveau: "N2" }), "tronc commun : retenu pour la filière stérile");
  assert.ok(!moduleDeposeRetenu(m, { ...f, niveau: "N1a" }), "niveau coché N2 : pas N1a");
  assert.ok(moduleDeposeRetenu(m, { ...f, q: "B5-09" }), "la recherche lit le critère");
  assert.ok(!moduleDeposeRetenu({ ...m, filieres: ["chimiotherapie"] }, f));
  assert.ok(!moduleDeposeRetenu(m, { ...f, bloc: "1" }));
});

test("documents : nature, rattachement (général ou module), profil du document ou de son module", () => {
  const ref = { natures: ["procedure-interne", "synthese"], modules: ["comportement-zac"], filieres: ["chimiotherapie"], niveaux: ["N1a"] };
  const general = { titre: "PHAR-FT160 — Habillage", nature: "procedure-interne", module_id: null, filieres: ["chimiotherapie"], niveaux: [] as string[] };
  const rattache = { titre: "Fiche ZAC", nature: "synthese", module_id: "comportement-zac", filieres: [] as string[], niveaux: [] as string[] };
  const profil = (id: string) => (id === "comportement-zac" ? { postes: ["sterile"], niveaux: [] } : undefined);
  const f = lireFiltreDocuments({ module: DOCUMENTS_GENERAUX, filiere: "chimiotherapie" }, ref);
  assert.ok(documentRetenu(general, f, profil));
  assert.ok(!documentRetenu(rattache, f, profil), "rattaché : pas un document général");
  assert.ok(!documentRetenu(rattache, { ...f, module: "comportement-zac" }, profil), "son module n'est pas posé en chimiothérapie");
  assert.ok(documentRetenu(rattache, { ...f, module: "comportement-zac", filiere: "" }, profil));
  assert.ok(documentRetenu(general, { ...f, q: "ft160 habillage" }, profil));
  assert.equal(lireFiltreDocuments({ nature: "inconnue" }, ref).nature, "");
});

test("personnel : identifiant normalisé par la page, critère, verdict", () => {
  const f = lireFiltrePersonnel({ agent: "ag 1", critere: "B1-02", verdict: "acquis" }, ["B1-02"]);
  const l = { agent_identifiant: "AG-001", critere: "B1-02", verdict: "acquis" };
  assert.ok(ligneRepertoireRetenue(l, f, "AG-001"));
  assert.ok(!ligneRepertoireRetenue({ ...l, verdict: "non_acquis" }, f, "AG-001"));
  assert.ok(!ligneRepertoireRetenue({ ...l, agent_identifiant: "AG-002" }, f, "AG-001"));
  assert.equal(lireFiltrePersonnel({ critere: "B9-99" }, ["B1-02"]).critere, "");
});

test("programmes à la carte, mises en situation : recherche et statut, recherche et module", () => {
  const x = { nom: "Intérimaire test", destinataire: "préparateur intérimaire", motif: "remplacement", statut: "valide" };
  assert.ok(programmeRetenu(x, lireFiltreProgrammes({ q: "interimaire", statut: "valide" })));
  assert.ok(!programmeRetenu(x, lireFiltreProgrammes({ statut: "brouillon" })));
  assert.equal(lireFiltreProgrammes({ statut: "publie" }).statut, "");
  const s = { titre: "Le sas", contexte: "La porte et le carton", module_id: "comportement-zac" };
  assert.ok(situationRetenue(s, lireFiltreSituations({ q: "carton", module: "comportement-zac" }, ["comportement-zac"])));
  assert.ok(!situationRetenue(s, lireFiltreSituations({ q: "hotte" }, [])));
});

test("rattachement : code et titre, bloc, filière et niveau réglés ou de la fiche", () => {
  const ref = { blocs: [1, 2], filieres: ["chimiotherapie", "sterile"], niveaux: ["N1a", "N2"] };
  const m = { critere: "B1-02", titre: "Comportement en ZAC", bloc: 1, filieres: [] as string[], niveaux: ["N2"] };
  assert.ok(moduleRegleRetenu(m, lireFiltreRattachement({ q: "b1-02", bloc: "1", filiere: "sterile", niveau: "N2" }, ref)));
  assert.ok(!moduleRegleRetenu(m, lireFiltreRattachement({ niveau: "N1a" }, ref)));
  assert.ok(!moduleRegleRetenu(m, lireFiltreRattachement({ bloc: "2" }, ref)));
});

test("filières, niveaux : métier et recherche ; Repères : code ou mot, bloc, obligatoires", () => {
  const f = lireFiltreReferentiel({ q: "chimio", metier: "preparateur" }, ["preparateur", "ide"]);
  assert.ok(entreeReferentielRetenue({ texte: "Chimiothérapie chimiotherapie", metier: "preparateur" }, f));
  assert.ok(!entreeReferentielRetenue({ texte: "Chimiothérapie", metier: "ide" }, f));
  assert.equal(lireFiltreReferentiel({ metier: "autre" }, ["preparateur"]).metier, "");
  const c = { code: "B5-09", libelle: "Élimination des déchets", sousSection: null, bloc: 5, obligatoire: true };
  const g = lireFiltreProgrammeComplet({ q: "dechets", bloc: "5", obligatoires: "1" }, [5]);
  assert.ok(critereProgrammeRetenu(c, g));
  assert.ok(!critereProgrammeRetenu({ ...c, obligatoire: false }, g));
  assert.ok(critereProgrammeRetenu(c, lireFiltreProgrammeComplet({ q: "b5-09" }, [5])), "le code se cherche");
  assert.equal(lireFiltreProgrammeComplet({ obligatoires: "oui" }, [5]).obligatoires, "");
});

test("retour d'une action : la liste filtrée qu'a portée le formulaire, la sienne seulement ; sinon la liste entière", () => {
  // La page écrit son filtre lu ; les valeurs vides ne s'écrivent pas.
  const liste = adresseDuFiltre("/admin/signalements", lireFiltreSignalements({ etat: "ouvert", motif: "", module: "m1" }, ["m1"]));
  assert.equal(liste, "/admin/signalements?etat=ouvert&module=m1");
  assert.equal(adresseDuFiltre("/admin/niveaux", lireFiltreReferentiel({}, ["preparateur"])), "/admin/niveaux");
  assert.equal(adresseDuFiltre("/admin/personnel", lireFiltrePersonnel({ agent: "ag 1" }, [])), "/admin/personnel?agent=ag+1");
  // L'action y revient, son message ajouté ; il remplace un message de même nom.
  assert.equal(retourListe(liste, "/admin/signalements"), liste);
  assert.equal(retourListe("/admin?q=poste&ok=ancien", "/admin", { ok: "code-supprime" }), "/admin?q=poste&ok=code-supprime");
  assert.equal(retourListe("/admin/filieres?metier=ide#fin", "/admin/filieres", { ok: "filiere" }), "/admin/filieres?metier=ide&ok=filiere#fin");
  // Une autre adresse, même voisine, ramène à la liste entière : jamais ailleurs.
  for (const autre of ["/admin/questions?q=x", "/admin/", "/administration", "//exemple.fr/admin", "https://exemple.fr/admin", "/admin/../admin", "x".repeat(1300)]) {
    assert.equal(retourListe(autre, "/admin", { ok: "1" }), "/admin?ok=1", autre.slice(0, 40));
  }
  assert.equal(retourListe(null, "/admin/rattachement", { ok: "seuil" }), "/admin/rattachement?ok=seuil", "champ absent : une création");
  assert.equal(retourListe(["/admin?q=x"], "/admin"), "/admin", "une valeur qui n'est pas un texte");
});
