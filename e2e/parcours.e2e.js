/* Parcours de bout en bout, contre le serveur local avec base PostgreSQL. */
/*
 * Prérequis : un serveur construit (`npm run build && npm start`) lancé avec
 * une base VIDE, `AUTH_SECRET` et `CONSERVATION_RAPPORTS=pseudonyme`, et
 * Chromium pour Playwright (`npx playwright install chromium`). Lancer :
 *
 *   BASE=http://localhost:3000 npm run e2e
 *
 * Avec `CAPTURES=<dossier>`, des captures d'écran des écrans de décision
 * (identifiants, émission, rapport, A4, information RGPD) y sont déposées.
 *
 * Le scénario crée l'administrateur initial : il ne se rejoue que sur une
 * base réinitialisée. Il termine par le blocage volontaire de l'adresse après
 * cinq échecs de connexion (quinze minutes).
 *
 * Le parcours de décision (modèle métrologie) est joué avec une banque de dix
 * questions dont le scénario connaît le corrigé : score de 80 % dans la bande
 * de garde, signalement qui verrouille les visas, arbitrage du tuteur, visa
 * du pharmacien avec signature incrustée, paquet d'archivage, registre et
 * répertoire du personnel. Aucun nom n'entre en base : l'apprenant émet sous
 * un identifiant d'agent créé par l'administrateur, et le nom n'est porté
 * qu'à l'édition (POST) du rapport, hors sceau.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const zlib = require("node:zlib");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const CAPTURES = process.env.CAPTURES;

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

/*
 * Banque déposée : huit QCM, un QIM, un schéma. Le scénario connaît le
 * corrigé et répond faux aux QCM 2 et 3 : 8 / 10 = 80 %, dans la bande de
 * garde (70 à 89 %), donc verdict indéterminé.
 */
const QCMS = [
  { enonce: "Quelle est la voie d'exposition prépondérante ? (plusieurs réponses)", options: [["L'inhalation", false], ["La voie cutanée", true], ["L'ingestion", false], ["La piqûre seule", false]], justification: "Les mesures de contamination surfacique montrent une exposition cutanée.", source: "INRS — TF 255 — 2020 — https://www.inrs.fr/media.html?refINRS=TF+255", eliminatoire: true },
  { enonce: "Quel grade correspond à un poste de travail en isolateur ?", options: [["Grade A", true], ["Grade B", false], ["Grade C", false], ["Grade D", false]], justification: "Le volume de travail est de classe A.", faux: true },
  { enonce: "Combien de paires de gants porte-t-on sous isolateur ?", options: [["Aucune", false], ["Une", false], ["Deux", true], ["Trois", false]], justification: "Double gantage.", faux: true },
  { enonce: "À quelle fréquence change-t-on les gants de l'isolateur ?", options: [["Selon la procédure interne", true], ["Jamais", false], ["Une fois par an", false], ["À chaque préparation", false]], justification: "Selon procédure." },
  { enonce: "Que faire en cas de rupture de gant ?", options: [["Continuer", false], ["Arrêter et changer le gant", true], ["Ignorer", false], ["Rincer à l'eau", false]], justification: "Arrêt immédiat." },
  { enonce: "Quel document trace la préparation ?", options: [["La fiche de fabrication", true], ["Le cahier de liaison", false], ["Rien", false], ["Le planning", false]], justification: "Traçabilité." },
  { enonce: "Qui libère la préparation ?", options: [["Le préparateur seul", false], ["Le pharmacien", true], ["L'infirmier", false], ["Le patient", false]], justification: "Libération pharmaceutique." },
  { enonce: "Quelle est la durée maximale de conservation d'un flacon entamé sans donnée de stabilité ?", options: [["Selon le RCP", true], ["Une semaine", false], ["Un mois", false], ["Illimitée", false]], justification: "RCP." },
];
const QIM = {
  enonce: "Concernant les ZAC, indiquer les propositions exactes.",
  propositions: [["ISO 5 = 3 520 particules par m³", true], ["Grade A : ISO 5 au repos et en activité", true], ["Le comptage particulaire renseigne sur la charge microbiologique", false], ["L'opérateur est le principal contributeur", true], ["Une sortie brève dispense de refaire l'habillage", false]],
};
const SCHEMA = { enonce: "Légendez les éléments repérés sur cette coupe d'isolateur.", mots: ["sas de transfert", "filtre terminal", "plan de travail", "bas"] };

const TEXTE_IMPORT = [
  ...QCMS.map((q, i) => {
    const lignes = [`QCM ${i + 1}. ${q.enonce}`];
    q.options.forEach(([texte, vrai], k) => lignes.push(`${"ABCD"[k]}. ${texte} (${vrai ? "V" : "F"})`));
    lignes.push(`Justification : ${q.justification}`);
    if (q.source) lignes.push(`Source : ${q.source}`);
    if (q.eliminatoire) lignes.push("Éliminatoire : oui");
    return lignes.join("\n");
  }),
  [`QIM 9. ${QIM.enonce}`, ...QIM.propositions.map(([t, v], k) => `${"ABCDE"[k]}. ${t} (${v ? "V" : "F"})`)].join("\n"),
  `SCHÉMA 1. ${SCHEMA.enonce}
Image : isolateur-coupe.png
1. sas de transfert (8, 12, 33, 25)
2. filtre HEPA | filtre terminal (54, 12, 37, 25)
3. plan de travail (8, 56, 83, 31)
Justification : cf. procédure interne.`,
].join("\n\n") + "\n";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("ERREUR PAGE:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });
  /** Capture d'un écran (ou d'un élément), seulement si CAPTURES est défini. */
  const capture = async (nom, cible) => {
    if (!CAPTURES) return;
    const chemin = path.join(CAPTURES, nom + ".png");
    if (cible) await cible.screenshot({ path: chemin });
    else await page.screenshot({ path: chemin, fullPage: true });
  };
  /** Capture d'un document HTML rendu à part (rapport A4). */
  const captureHtml = async (nom, html) => {
    if (!CAPTURES) return;
    const p2 = await ctx.newPage();
    await p2.setContent(html.replace("<head>", `<head><base href="${BASE}/">`), { waitUntil: "load" });
    await p2.screenshot({ path: path.join(CAPTURES, nom + ".png"), fullPage: true });
    await p2.close();
  };

  // 0. santé
  const sante = await (await page.request.get(BASE + "/api/sante")).json();
  assert.equal(sante.base, "joignable");
  assert.equal(sante.conservation, "pseudonyme");
  ok("santé : base joignable, conservation pseudonyme");

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

  // 2b. signature du pharmacien déposée (image réduite dans le navigateur)
  await page.goto(BASE + "/admin/signature");
  await page.waitForSelector("text=Aucune signature déposée");
  await page.setInputFiles("input[name=fichier]", PNG);
  await page.waitForSelector("text=Signature enregistrée");
  await page.reload();
  await page.waitForSelector("img[alt='Signature déposée']");
  ok("signature du pharmacien déposée et rattachée au code admin");

  // 2c. identifiant d'agent généré par le site — aucun nom saisi nulle part
  await page.goto(BASE + "/admin/personnel");
  await page.click("button:has-text('Créer un identifiant')");
  await page.waitForURL(/ok=cree&identifiant=/);
  const identifiant = new URL(page.url()).searchParams.get("identifiant");
  assert.equal(identifiant, "AG-001");
  await page.waitForSelector("code:has-text('AG-001')");
  await capture("01-personnel-identifiants");
  ok("identifiant d'agent créé : " + identifiant);

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

  // 4. import texte + image : dix questions
  await page.goto(BASE + "/admin/questions/import");
  await page.selectOption("select[name=moduleId]", "critere-b1-02");
  await page.fill("textarea[name=texte]", TEXTE_IMPORT);
  await page.setInputFiles("input[name=images]", PNG);
  await page.click("button:has-text('Analyser')");
  await page.waitForSelector("h2:has-text('Aperçu — 10 questions')");
  assert.equal(await page.locator("text=Image appariée").count(), 1);
  await page.click("button:has-text('Ajouter à la banque')");
  await page.waitForSelector("text=10 questions ajoutées");
  ok("import : 10 questions reconnues, image appariée, ajoutées à vérifier");

  // 5. validation des questions importées
  for (let i = 0; i < 12; i++) {
    await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=a_verifier");
    const bouton = page.locator("form button:has-text('Valider')").first();
    if (!(await bouton.count())) break;
    await bouton.click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=valide");
  assert.equal(await page.locator(".question-ligne").count(), 10);
  ok("10 questions importées validées");

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

  // 7. apprenant : tirage complet de dix questions, corrigé connu, 8 / 10
  await page.goto(BASE + "/module/critere-b1-02");
  await page.waitForSelector("a:has-text(\"Passer l'évaluation\")");
  await page.click("a:has-text(\"Passer l'évaluation\")");
  await page.waitForSelector("text=Régler l'évaluation");
  assert.equal(await page.locator("input[name=difficulte]:disabled").count(), 0);
  await page.check("input[name=difficulte] >> nth=2"); // Complet
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("fieldset.question");
  const fieldsets = page.locator("fieldset.question");
  const n = await fieldsets.count();
  assert.equal(n, 10);
  for (let i = 0; i < n; i++) {
    const f = fieldsets.nth(i);
    const enonce = (await f.locator(".question-enonce").innerText()).trim();
    if (await f.locator(".schema").count()) {
      const inputs = f.locator(".schema-legendes input");
      const ni = await inputs.count();
      assert.equal(ni, 4);
      for (let k = 0; k < ni; k++) await inputs.nth(k).fill(SCHEMA.mots[k]);
    } else if (await f.locator(".proposition").count()) {
      for (const [texte, vrai] of QIM.propositions) {
        await f.locator(".proposition", { hasText: texte }).locator(`label:has-text('${vrai ? "Vrai" : "Faux"}') input`).check();
      }
    } else {
      const q = QCMS.find((x) => x.enonce === enonce);
      assert.ok(q, "QCM inconnu : " + enonce);
      const [bonne] = q.options.find(([, v]) => v);
      const [mauvaise] = q.options.find(([, v]) => !v);
      await f.locator("label.option", { hasText: q.faux ? mauvaise : bonne }).locator("input").check();
    }
  }
  await page.click("button:has-text(\"Valider l'évaluation\")");
  await page.waitForSelector(".resultat-entete");
  const score = (await page.locator(".resultat-entete .score").innerText()).replace(/\s+/g, " ");
  assert.equal(score, "80 %");
  await page.waitForSelector(".resultat-entete--indetermine");
  await page.waitForSelector("h2:has-text('Verdict indéterminé')");
  ok("évaluation complète corrigée : 80 %, verdict indéterminé (bande de garde 70 à 89 %)");
  assert.equal(await page.locator(".schema-legendes--revele").count(), 1);
  assert.equal(await page.locator(".schema-legendes--revele .legende-juste").count(), 4);

  // 8. signalement sur la première question du tirage
  await page.locator("details.signaler summary").first().click();
  await page.locator("details.signaler select").first().selectOption("Ambigu");
  await page.locator("details.signaler textarea").first().fill("Test de signalement e2e");
  await page.locator("details.signaler button:has-text('Transmettre')").first().click();
  await page.waitForSelector("text=Signalement transmis");
  ok("signalement transmis");

  // 9. rapport de session : émission sous identifiant (navigation client, état conservé)
  await page.click("a:has-text('Rapport de session')");
  await page.waitForSelector("#rapport");
  assert.equal(await page.locator("input[placeholder='Nom Prénom']").count(), 0);
  await page.fill("input[name=identifiant]", "AG-999");
  await page.click("button:has-text('Émettre et enregistrer')");
  await page.waitForSelector("[role=alert]:has-text('AG-999 inconnu')");
  await capture("02-emission-identifiant", page.locator("section.carte:has(input[name=identifiant])"));
  await page.fill("input[name=identifiant]", "ag 1");
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
  assert.match(dl.suggestedFilename(), /^rapport-evaluation-rap-\d{4}-\d{4}-ag-001-/);
  ok("rapport téléchargé : " + dl.suggestedFilename());

  // 10. verrou : signalement ouvert sur le tirage, aucun visa possible
  await page.goto(BASE + "/admin/rapports");
  await page.waitForSelector(`text=${numero}`);
  await page.waitForSelector("text=arbitrage attendu");
  await page.click(`a:has-text('${numero}')`);
  await page.waitForSelector("text=Visas verrouillés");
  const titreVisaTuteur = page.getByRole("heading", { level: 3, name: "Visa du tuteur (N3)", exact: true });
  const titreArbitrage = page.getByRole("heading", { level: 3, name: "Arbitrage du tuteur", exact: true });
  assert.equal(await titreVisaTuteur.count(), 0);
  assert.equal(await titreArbitrage.count(), 0);
  const urlRapport = page.url().replace(/\?.*$/, "");
  ok("visas verrouillés par le signalement ouvert : ni visa ni arbitrage");

  // 10b. le signalement est traité : l'arbitrage s'ouvre
  await page.goto(BASE + "/admin/signalements");
  await page.waitForSelector("text=Test de signalement e2e");
  await page.locator("button:has-text('Clore — traité')").first().click();
  await page.waitForSelector("text=Traité par");
  await page.goto(urlRapport);
  await titreArbitrage.waitFor();
  assert.equal(await titreVisaTuteur.count(), 0);
  ok("signalement clos : arbitrage requis avant le visa du tuteur");

  // 10c. arbitrage motivé, puis visas tuteur et pharmacien (signature incrustée)
  await page.check("input[name=verdict][value=acquis]");
  assert.equal(await page.locator("input[name=nom]").count(), 1); // seul le formulaire d'édition porte un nom
  await page.fill("textarea[name=motif]", "Les deux erreurs portent sur des points revus en compagnonnage.");
  await page.click("button:has-text(\"Enregistrer l'arbitrage\")");
  await page.waitForSelector("text=Arbitrage enregistré");
  await page.waitForSelector("text=Arbitrage du tuteur : acquis");
  await titreVisaTuteur.waitFor();
  await page.waitForSelector("text=l'identifiant AG-001 est bien celui de l'agent évalué");
  await page.click("button:has-text('Apposer le visa tuteur')");
  await page.waitForSelector("text=Visa enregistré");
  await page.waitForSelector("h3:has-text('Visa du pharmacien')");
  await page.waitForSelector("text=Votre signature déposée sera incrustée");
  await page.click("button:has-text('Apposer le visa pharmacien')");
  await page.waitForSelector("text=Clos — visé par le pharmacien responsable");
  await page.waitForSelector("img[alt='Signature — Administrateur initial']");
  await capture("03-rapport-clos");
  ok("arbitrage puis visas tuteur et pharmacien : rapport clos, signature incrustée, aucun nom saisi");

  // 10d. rapport A4 pseudonyme (GET) puis avec le nom porté à l'édition (POST), hors sceau
  const impr = await page.request.get(urlRapport + "/imprimer");
  const html = await impr.text();
  assert.ok(html.includes("visa électronique") && html.includes(numero) && html.includes("AG-001"));
  assert.ok(html.includes("Administrateur initial")); // visas portés par la session d'administration
  assert.ok(html.includes("à compléter à la main, d'après la correspondance"));
  assert.ok(html.includes("Arbitrage du tuteur : <strong>acquis</strong>"));
  assert.ok(html.includes("Verdict brut : indéterminé"));
  assert.ok(html.includes('<img class="signature" src="data:image/png;base64,'));
  const imprNom = await page.request.post(urlRapport + "/imprimer", { form: { nom: "Apprenant Test", qualite: "Préparateur" } });
  const htmlNom = await imprNom.text();
  assert.ok(htmlNom.includes("Apprenant Test") && htmlNom.includes("Préparateur"));
  assert.ok(htmlNom.includes("porté à l'édition, hors sceau, non enregistré"));
  await captureHtml("04-a4-pseudonyme", html);
  await captureHtml("05-a4-nom-porte", htmlNom);
  ok("rapport A4 : pseudonyme en GET, nom porté à l'édition en POST, verdict arbitré, signature incrustée");
  const paquet = await page.request.get(urlRapport + "/paquet");
  assert.equal(paquet.status(), 200);
  assert.equal(paquet.headers()["content-type"], "application/zip");
  const octets = await paquet.body();
  assert.equal(octets.readUInt32LE(0), 0x04034b50);
  for (const ext of ["html", "csv", "json"]) assert.ok(octets.includes(Buffer.from(`${numero}.${ext}`)), ext);
  assert.ok(!octets.includes(Buffer.from("Apprenant Test")));
  const paquetNom = await page.request.post(urlRapport + "/paquet", { form: { nom: "Apprenant Test" } });
  const octetsNom = await paquetNom.body();
  assert.equal(octetsNom.readUInt32LE(0), 0x04034b50);
  assert.ok(octetsNom.includes(Buffer.from("Apprenant Test")) && octetsNom.includes(Buffer.from('"hors_sceau": true')));
  ok("paquet d'archivage : zip HTML, CSV, JSON ; pseudonyme en GET, nom hors sceau en POST");
  const registre = await page.request.get(BASE + "/admin/rapports/registre.csv");
  const csv = await registre.text();
  assert.ok(csv.startsWith("﻿numero;statut;emis_le;agent;"));
  assert.ok(csv.includes(`${numero};clos;`) && csv.includes(";AG-001;B1-02;") && csv.includes(";indéterminé;acquis;acquis;"));
  assert.ok(!csv.includes("Apprenant Test"));
  ok("registre cumulatif CSV : ligne du rapport par identifiant, verdict brut et verdict final");
  await page.goto(BASE + "/admin/personnel");
  await page.waitForSelector("td:has-text('AG-001')");
  await page.waitForSelector("td:has-text('80 % · acquis')");
  const repertoire = await page.request.get(BASE + "/admin/personnel/repertoire.csv");
  assert.ok((await repertoire.text()).includes("AG-001;actif;B1-02;"));
  ok("personnel & historique : ligne par identifiant et critère, export CSV");

  // 11. journal
  await page.goto(BASE + "/admin/journal");
  await page.waitForSelector("code:has-text('emission-rapport')");
  await page.waitForSelector("code:has-text('arbitrage-rapport')");
  await page.waitForSelector("code:has-text('visa:pharmacien')");
  await page.waitForSelector("code:has-text('signature:depot')");
  await page.waitForSelector("code:has-text('agent:creation')");
  await page.waitForSelector("code:has-text('export:impression')");
  const journal = await page.content();
  assert.ok(!journal.includes("Apprenant Test"));
  ok("journal renseigné : émission, arbitrage, visas, signature, identifiant ; aucun nom");

  // 11b. purge manuelle : purge datée (rien avant aujourd'hui), puis suppression du rapport
  const aujourdhui = new Date().toISOString().slice(0, 10);
  await page.goto(BASE + `/admin/rapports?avant=${aujourdhui}`);
  await page.waitForSelector("text=serait supprimé");
  assert.ok(await page.locator("button:has-text('Supprimer définitivement')").isDisabled());
  await page.goto(urlRapport);
  await page.fill("form:has(button:has-text('Supprimer définitivement')) input[name=confirmation]", "RAP-0000-0000");
  await page.click("button:has-text('Supprimer définitivement')");
  await page.waitForSelector("text=Recopiez exactement le numéro");
  await page.fill("form:has(button:has-text('Supprimer définitivement')) input[name=confirmation]", numero);
  await page.click("button:has-text('Supprimer définitivement')");
  await page.waitForURL(/ok=purge&n=1/);
  await page.waitForSelector("text=1 rapport supprimé définitivement");
  await page.waitForSelector("text=Aucun rapport.");
  await page.goto(BASE + "/admin/journal");
  await page.waitForSelector("code:has-text('purge-rapport')");
  ok("purge manuelle : purge datée à vide, confirmation exigée, rapport supprimé et journalisé");

  // 11c. l'identifiant survit à la purge et se clôt
  await page.goto(BASE + "/admin/personnel");
  await page.waitForSelector("code:has-text('AG-001')");
  await page.click("button:has-text('Clore')");
  await page.waitForURL(/ok=clos&identifiant=AG-001/);
  await page.waitForSelector("text=Identifiant AG-001 clos");
  ok("identifiant d'agent conservé après purge, puis clos");
  await page.goto(BASE + "/donnees-personnelles");
  await page.waitForSelector("h1:has-text('Vos données et vos droits')");
  await capture("06-donnees-personnelles");

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
