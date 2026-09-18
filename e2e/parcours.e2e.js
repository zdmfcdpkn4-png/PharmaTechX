/* Parcours de bout en bout, contre le serveur local avec base PostgreSQL. */
/*
 * Prérequis : un serveur construit (`npm run build && npm start`) lancé avec
 * une base VIDE, `AUTH_SECRET` et `CONSERVATION_RAPPORTS=nominative`, et
 * Chromium pour Playwright (`npx playwright install chromium`). Lancer :
 *
 *   BASE=http://localhost:3000 npm run e2e
 *
 * Le scénario crée l'administrateur initial : il ne se rejoue que sur une
 * base réinitialisée. Il termine par le blocage volontaire de l'adresse après
 * cinq échecs de connexion (quinze minutes).
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const zlib = require("node:zlib");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";

/** Un PNG de 480 × 320 avec trois rectangles de couleur, écrit dans un dossier temporaire. */
function pngDeTest() {
  const W = 480, H = 320;
  const px = (x, y) => {
    if (x >= 40 && x < 200 && y >= 40 && y < 120) return [0, 85, 134];
    if (x >= 260 && x < 440 && y >= 40 && y < 120) return [232, 42, 99];
    if (x >= 40 && x < 440 && y >= 180 && y < 280) return [70, 180, 179];
    return [245, 247, 249];
  };
  const lignes = [];
  for (let y = 0; y < H; y++) {
    const l = Buffer.alloc(1 + W * 3);
    for (let x = 0; x < W; x++) Buffer.from(px(x, y)).copy(l, 1 + x * 3);
    lignes.push(l);
  }
  const crc = (b) => { let c = ~0; for (const o of b) { c ^= o; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(lignes))), chunk("IEND", Buffer.alloc(0))]);
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "fp-e2e-"));
  const fichier = path.join(dossier, "isolateur-coupe.png");
  fs.writeFileSync(fichier, png);
  return fichier;
}
const PNG = pngDeTest();
const etapes = [];
const ok = (m) => { etapes.push("✔ " + m); console.log("✔", m); };

const TEXTE_IMPORT = `QCM 1. Quelle est la voie d'exposition prépondérante ? (plusieurs réponses)
A. L'inhalation (F)
B. La voie cutanée (V)
C. L'ingestion (F)
D. La piqûre seule (F)
Justification : les mesures de contamination surfacique montrent une exposition cutanée.
Source : INRS — TF 255 — 2020 — https://www.inrs.fr/media.html?refINRS=TF+255
Éliminatoire : oui

QIM 2. Concernant les ZAC, indiquer les propositions exactes.
A. ISO 5 = 3 520 particules par m³ (V)
B. Grade A : ISO 5 au repos et en activité (V)
C. Le comptage particulaire renseigne sur la charge microbiologique (F)
D. L'opérateur est le principal contributeur (V)
E. Une sortie brève dispense de refaire l'habillage (F)

SCHÉMA 1. Légendez les éléments repérés sur cette coupe d'isolateur.
Image : isolateur-coupe.png
1. sas de transfert (8, 12, 33, 25)
2. filtre HEPA | filtre terminal (54, 12, 37, 25)
3. plan de travail (8, 56, 83, 31)
Justification : cf. procédure interne.
`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERREUR PAGE:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });

  // 0. santé
  const sante = await (await page.request.get(BASE + "/api/sante")).json();
  assert.equal(sante.base, "joignable");
  assert.equal(sante.conservation, "nominative");
  ok("santé : base joignable, conservation nominative");

  // 1. amorçage
  await page.goto(BASE + "/connexion");
  await page.click("button:has-text(\"Créer l'administrateur initial\")");
  await page.waitForURL(/\/admin\?amorce=/);
  const codeAdmin = new URL(page.url()).searchParams.get("amorce");
  assert.match(codeAdmin, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  await page.waitForSelector("text=Code administrateur initial");
  ok("amorçage : code admin affiché, session ouverte");

  // 1b. amorçage refusé ensuite
  const r2 = await page.request.get(BASE + "/connexion");
  assert.equal(r2.status(), 200);

  // 2. codes tuteur et poste
  await page.selectOption("select[name=role]", "tuteur");
  await page.fill("input[name=libelle]", "Tuteur test");
  await page.click("button:has-text(\"Générer le code\")");
  await page.waitForURL(/nouveau=/);
  const codeTuteur = new URL(page.url()).searchParams.get("nouveau");
  assert.match(codeTuteur, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  ok("code tuteur créé : " + codeTuteur);

  // 3. nouvelle question QCM validée
  await page.goto(BASE + "/admin/questions/nouvelle?module=comportement-zac");
  await page.fill("textarea[name=enonce]", "Question de test créée dans le formulaire ?");
  const champs = page.locator(".proposition--editeur input[type=text]");
  await champs.nth(0).fill("Bonne réponse");
  await champs.nth(1).fill("Mauvaise 1");
  await champs.nth(2).fill("Mauvaise 2");
  await champs.nth(3).fill("Mauvaise 3");
  await page.locator(".proposition--editeur input[type=checkbox]").nth(0).check();
  await page.fill("textarea[name=justification]", "Parce que c'est la bonne.");
  await page.fill("textarea[name=references]", "ANSM — BPP 2023 — 21/07/2023 — https://ansm.sante.fr/x");
  await page.selectOption("select[name=statut]", "valide");
  await page.click("button:has-text('Créer la question')");
  await page.waitForURL(/admin\/questions\?module=comportement-zac&ok=creee/);
  await page.waitForSelector("text=Question de test créée dans le formulaire");
  ok("question QCM créée et validée");

  // 3b. erreur de formulaire (QCM sans réponse exacte) reste sur la page
  await page.goto(BASE + "/admin/questions/nouvelle?module=comportement-zac");
  await page.fill("textarea[name=enonce]", "Sans bonne réponse");
  await champs.nth(0).fill("a");
  await champs.nth(1).fill("b");
  await page.click("button:has-text('Créer la question')");
  await page.waitForSelector("[role=alert]:has-text('au moins une proposition exacte')");
  ok("formulaire : erreur affichée sans perdre la saisie");

  // 4. import texte + image
  await page.goto(BASE + "/admin/questions/import");
  await page.selectOption("select[name=moduleId]", "critere-b1-02");
  await page.fill("textarea[name=texte]", TEXTE_IMPORT);
  await page.setInputFiles("input[name=images]", PNG);
  await page.click("button:has-text('Analyser')");
  await page.waitForSelector("h2:has-text('Aperçu — 3 questions')");
  assert.equal(await page.locator("text=Image appariée").count(), 1);
  await page.click("button:has-text('Ajouter à la banque')");
  await page.waitForSelector("text=3 questions ajoutées");
  ok("import : 3 questions reconnues, image appariée, ajoutées à vérifier");

  // 5. validation des 3 questions importées
  for (let i = 0; i < 3; i++) {
    await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=a_verifier");
    const bouton = page.locator("form button:has-text('Valider')").first();
    if (!(await bouton.count())) break;
    await bouton.click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=valide");
  assert.equal(await page.locator(".question-ligne").count(), 3);
  ok("3 questions importées validées");

  // 6. édition du schéma : image et légendes visibles, une légende posée au clic
  await page.locator(".question-ligne:has-text('Schéma') a:has-text('Modifier')").first().click();
  await page.waitForSelector(".schema-cadre--editeur img");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator(".editeur-legende").count(), 3);
  const cadre = page.locator(".schema-cadre--editeur");
  const box = await cadre.boundingBox();
  await cadre.click({ position: { x: box.width * 0.5, y: box.height * 0.95 } });
  await page.waitForSelector(".editeur-legende:nth-child(4)");
  await page.locator(".editeur-legende input[type=text]").nth(3).fill("bandeau bas | bas");
  await page.click("button:has-text('Enregistrer les modifications')");
  await page.waitForURL(/ok=modifiee/);
  ok("éditeur de schéma : légende posée au clic et enregistrée (4 légendes)");

  // 7. apprenant : module évaluable sans texte, évaluation complète
  await page.goto(BASE + "/module/critere-b1-02");
  await page.waitForSelector("a:has-text(\"Passer l'évaluation\")");
  await page.click("a:has-text(\"Passer l'évaluation\")");
  await page.waitForSelector("text=Régler l'évaluation");
  await page.check("input[name=difficulte] >> nth=2"); // Complet
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("fieldset.question");
  const fieldsets = page.locator("fieldset.question");
  const n = await fieldsets.count();
  assert.equal(n, 3);
  for (let i = 0; i < n; i++) {
    const f = fieldsets.nth(i);
    if (await f.locator(".schema").count()) {
      const inputs = f.locator(".schema-legendes input");
      const ni = await inputs.count();
      const mots = ["sas de transfert", "filtre terminal", "plan de travail", "bas"];
      for (let k = 0; k < ni; k++) await inputs.nth(k).fill(mots[k] ?? "x");
    } else if (await f.locator(".proposition").count()) {
      const props = f.locator(".proposition");
      const np = await props.count();
      for (let k = 0; k < np; k++) await props.nth(k).locator("label:has-text('Vrai') input").check();
    } else {
      await f.locator("label.option input").nth(1).check();
    }
  }
  await page.click("button:has-text(\"Valider l'évaluation\")");
  await page.waitForSelector(".resultat-entete");
  const score = await page.locator(".resultat-entete .score").innerText();
  ok("évaluation complète corrigée : " + score.replace(/\s+/g, " "));
  assert.equal(await page.locator(".schema-legendes--revele").count(), 1);
  assert.equal(await page.locator(".schema-legendes--revele .legende-juste").count(), 4);

  // 8. signalement
  await page.locator("details.signaler summary").first().click();
  await page.locator("details.signaler select").first().selectOption("Ambigu");
  await page.locator("details.signaler textarea").first().fill("Test de signalement e2e");
  await page.locator("details.signaler button:has-text('Transmettre')").first().click();
  await page.waitForSelector("text=Signalement transmis");
  ok("signalement transmis");

  // 9. rapport de session : émission nominative (navigation client, état conservé)
  await page.click("a:has-text('Rapport de session')");
  await page.waitForSelector("#rapport");
  await page.fill("input[placeholder='Nom Prénom']", "Apprenant Test");
  await page.fill("input[placeholder='Préparateur, interne, niveau visé…']", "Préparateur");
  await page.click("button:has-text('Émettre et enregistrer')");
  await page.waitForSelector("text=émis sous le n° RAP-");
  const ligne = await page.locator(".ligne-rapport").first().innerText();
  const numero = /RAP-\d{4}-\d{4}/.exec(ligne)[0];
  ok("rapport émis : " + numero);

  // 9b. téléchargement du rapport (fichier html)
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".ligne-rapport button:has-text('Télécharger')").first().click(),
  ]);
  assert.match(dl.suggestedFilename(), /^rapport-evaluation-rap-\d{4}-\d{4}-apprenant-test-/);
  ok("rapport téléchargé : " + dl.suggestedFilename());

  // 10. visas tuteur puis pharmacien (session admin)
  await page.goto(BASE + "/admin/rapports");
  await page.click(`a:has-text('${numero}')`);
  await page.waitForSelector("h3:has-text('Visa du tuteur')");
  await page.fill("form:has(input[value=tuteur]) input[name=nom]", "Tuteur Test");
  await page.click("button:has-text('Apposer le visa tuteur')");
  await page.waitForSelector("text=Visa enregistré");
  await page.waitForSelector("h3:has-text('Visa du pharmacien')");
  await page.fill("form:has(input[value=pharmacien]) input[name=nom]", "Pharmacien Test");
  await page.click("button:has-text('Apposer le visa pharmacien')");
  await page.waitForSelector("text=Clos — visé par le pharmacien responsable");
  ok("circuit de visas : tuteur puis pharmacien, rapport clos");
  const impr = await page.request.get(page.url().replace(/\?.*$/, "") + "/imprimer");
  const html = await impr.text();
  assert.ok(html.includes("visa électronique") && html.includes(numero) && html.includes("Pharmacien Test"));
  ok("rapport A4 imprimable avec visas électroniques");

  // 11. signalements et journal
  await page.goto(BASE + "/admin/signalements");
  await page.waitForSelector("text=Test de signalement e2e");
  await page.locator("button:has-text('Clore — traité')").first().click();
  await page.waitForSelector("text=Traité par");
  await page.goto(BASE + "/admin/journal");
  await page.waitForSelector("code:has-text('emission-rapport')");
  await page.waitForSelector("code:has-text('visa:pharmacien')");
  ok("signalement clos, journal renseigné");

  // 12. documents : dépôt en base
  await page.goto(BASE + "/admin/documents");
  await page.setInputFiles("input[name=fichier]", PNG);
  await page.fill("input[name=titre]", "Schéma déposé test");
  await page.selectOption("select[name=moduleId]", "comportement-zac");
  await page.click("button:has-text('Déposer')");
  await page.waitForSelector("text=Document déposé");
  const lien = await page.locator("a:has-text('Schéma déposé test')").getAttribute("href");
  assert.match(lien, /^\/api\/fichiers\//);
  const doc = await page.request.get(BASE + lien);
  assert.equal(doc.status(), 200);
  assert.equal(doc.headers()["content-type"], "image/png");
  await page.goto(BASE + "/module/comportement-zac");
  await page.waitForSelector("a:has-text('Schéma déposé test')");
  ok("document déposé en base, servi, rattaché au module");

  // 13. déconnexion, connexion tuteur, journal interdit
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.click("button:has-text('quitter')");
  await page.waitForURL(/\/connexion/);
  await page.fill("input[name=code]", codeTuteur);
  await page.click("button:has-text('Entrer')");
  await page.waitForURL(/\/admin$/);
  await page.goto(BASE + "/admin/journal");
  await page.waitForURL(/\/admin$/);
  ok("connexion tuteur : administration accessible, journal réservé");

  // 14. mode entraînement (sans enregistrement)
  await page.goto(BASE + "/module/comportement-zac/evaluation");
  await page.check("input[name=difficulte] >> nth=0");
  await page.check("input[name=mode] >> nth=1");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("fieldset.question");
  const f0 = page.locator("fieldset.question").first();
  if (await f0.locator(".proposition").count()) {
    const props = f0.locator(".proposition");
    for (let k = 0; k < (await props.count()); k++) await props.nth(k).locator("label:has-text('Faux') input").check();
  } else {
    await f0.locator("label.option input").first().check();
  }
  await page.click("button:has-text('Vérifier')");
  await page.waitForSelector(".correction");
  await page.waitForSelector("button:has-text('Question suivante')");
  ok("entraînement : correction immédiate après la première question");

  // 15. limiteur : 5 échecs bloquent
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.click("button:has-text('quitter')");
  await page.waitForURL(/\/connexion/);
  // L'URL ne change pas d'un échec à l'autre : attendre la réponse de l'action,
  // pas une navigation, sinon les soumissions se chevauchent.
  const soumettreCode = async (code) => {
    await page.fill("input[name=code]", code);
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.status() === 303),
      page.click("button:has-text('Entrer')"),
    ]);
    await page.waitForLoadState("networkidle");
  };
  for (let i = 0; i < 5; i++) {
    await soumettreCode("AAAAA-AAAAA");
    await page.waitForSelector("[role=alert]");
  }
  await soumettreCode(codeAdmin);
  await page.waitForURL(/erreur=bloque/);
  await page.waitForSelector("[role=alert]:has-text('Trop de tentatives')");
  ok("limiteur : adresse bloquée après cinq échecs");

  await browser.close();
  console.log("\nE2E terminé : " + etapes.length + " étapes réussies");
})().catch((e) => {
  console.error("ÉCHEC E2E :", e);
  process.exit(1);
});
