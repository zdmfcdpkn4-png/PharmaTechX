/* Parcours de bout en bout, contre le serveur local avec base PostgreSQL. */
/*
 * Prérequis : un serveur construit (`npm run build && npm start`) lancé avec
 * une base VIDE, `AUTH_SECRET`, `CONSERVATION_RAPPORTS=pseudonyme`,
 * `MISE_EN_SERVICE=<AAAA-MM-JJ>` (sinon les rapports portent « phase d'essai ») et
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
  assert.match(sante.horloge, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(Math.abs(Date.parse(sante.horloge) - Date.now()) < 60_000, "horloge du serveur à moins d'une minute du poste");
  assert.match(String(sante.mise_en_service), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(sante.base_ip, "4", "base jointe en IPv4 par défaut (DATABASE_IP)");
  assert.equal(sante.base_erreur, null);
  ok("santé : base joignable, conservation pseudonyme, horloge du serveur exposée");

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
  assert.equal(await page.locator("select[name=statut] option[value=valide]").count(), 0, "pas de validation à l'enregistrement");
  await page.click("button:has-text('Créer la question')");
  await page.waitForURL(/admin\/questions\?module=comportement-zac&ok=creee/);
  await page.waitForSelector("text=Question de test créée dans le formulaire");
  const ligneCreee = page.locator(".question-ligne", { hasText: "Question de test créée dans le formulaire" });
  assert.equal(await ligneCreee.locator("button:has-text('Valider')").count(), 0, "l'auteur ne valide pas");
  await ligneCreee.locator("text=à valider par un autre code").waitFor();
  ok("question QCM créée à vérifier ; validation refusée à son auteur (quatre yeux)");

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

  /** Change de code d'accès : quitter la session, se connecter avec un autre code. */
  const rebrancher = async (code) => {
    await page.goto(BASE + "/");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.click("button:has-text('quitter')");
    await page.waitForURL(/\/connexion/);
    await page.fill("input[name=code]", code);
    await page.click("button:has-text('Entrer')");
    await page.waitForURL(/\/admin$/);
  };

  // 5. quatre yeux : le tuteur modifie le schéma importé par l'administrateur, puis valide les neuf autres ;
  //    le schéma, dont il est devenu l'auteur, attend l'administrateur
  await rebrancher(codeTuteur);
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=a_verifier");

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

  for (let i = 0; i < 12; i++) {
    await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=a_verifier");
    const bouton = page.locator("form button:has-text('Valider')").first();
    if (!(await bouton.count())) break;
    await bouton.click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=valide");
  assert.equal(await page.locator(".question-ligne").count(), 9, "le tuteur valide les neuf questions écrites par l'administrateur");
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=a_verifier");
  assert.equal(await page.locator(".question-ligne").count(), 1);
  await page.locator(".question-ligne", { hasText: "à valider par un autre code" }).waitFor();
  await rebrancher(codeAdmin);
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=a_verifier");
  await page.locator("form button:has-text('Valider')").first().click();
  await page.waitForLoadState("networkidle");
  await page.goto(BASE + "/admin/questions?module=critere-b1-02&statut=valide");
  assert.equal(await page.locator(".question-ligne").count(), 10);
  ok("quatre yeux : neuf questions validées par le tuteur, le schéma modifié par le tuteur validé par l'administrateur, dix validées");

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
  assert.ok(html.includes("Document qualité — preuve de l'étape 2") && html.includes("procédure [à compléter]"));
  assert.ok(html.includes("en service depuis le") && !html.includes("Phase d'essai"));
  assert.ok(html.includes("horloge du serveur, 20"));
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

  // 12b. module déposé (question 10) : création, brouillon invisible, publication au programme
  await page.goto(BASE + "/admin/modules");
  await page.fill("input[name=titre]", "Module déposé test");
  await page.fill("input[name=objectif]", "Objectif du module déposé.");
  await page.fill("textarea[name=presentation]", "Présentation courte du **module déposé**.\n\n- point un\n- point deux");
  await page.check("input[name=filieres][value=chimiotherapie]");
  await page.check("input[name=niveaux][value=N1c]");
  await page.fill("input[name=seuil]", "70");
  await page.click("button:has-text('Créer le module')");
  await page.waitForURL(/\/admin\/modules\/mod-[A-Za-z0-9_-]+\?ok=cree/);
  const idModule = page.url().match(/\/admin\/modules\/(mod-[A-Za-z0-9_-]+)/)[1];
  await page.goto(BASE + "/");
  await page.selectOption("label:has-text('Filière') select", "chimiotherapie");
  assert.equal(await page.locator("h3:has-text('Module déposé test')").count(), 0, "brouillon absent du programme");
  await page.goto(BASE + "/module/" + idModule);
  await page.waitForSelector("text=visible des tuteurs et administrateurs seulement");
  await page.goto(BASE + "/admin/modules/" + idModule);
  await page.click("button:has-text('Publier')");
  await page.waitForURL(/ok=publie/);
  await page.goto(BASE + "/");
  await page.selectOption("label:has-text('Filière') select", "chimiotherapie");
  await page.waitForSelector("h3:has-text('Module déposé test')");
  await page.selectOption("label:has-text('Niveau visé') select", "P1");
  assert.equal(await page.locator("h3:has-text('Module déposé test')").count(), 0, "absent au niveau P1");
  ok("module déposé : brouillon invisible, publié au programme Chimiothérapie · N1c");

  // 12c. questions déposées dans le module déposé, présentation et seuil propre
  const TEXTE_DEPOT = `QCM 1. Question déposée une (une seule réponse)
A. Bonne (V)
B. Mauvaise (F)
Justification : justification une.

QIM 2. Question déposée deux, indiquer les propositions exactes.
A. Première vraie (V)
B. Deuxième fausse (F)
C. Troisième vraie (V)
Justification : justification deux.`;
  await page.goto(BASE + "/admin/questions/import?module=" + idModule);
  await page.selectOption("select[name=moduleId]", idModule);
  await page.fill("textarea[name=texte]", TEXTE_DEPOT);
  await page.click("button:has-text('Analyser')");
  await page.waitForSelector("h2:has-text('Aperçu — 2 questions')");
  await page.click("button:has-text('Ajouter à la banque')");
  await page.waitForSelector("text=2 questions ajoutées");
  // validation par un autre code que l'auteur : le tuteur ; qui ne publie ni ne modifie un module publié
  await rebrancher(codeTuteur);
  for (let i = 0; i < 3; i++) {
    await page.goto(BASE + "/admin/questions?module=" + idModule + "&statut=a_verifier");
    const bouton = page.locator("form button:has-text('Valider')").first();
    if (!(await bouton.count())) break;
    await bouton.click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(BASE + "/admin/modules/" + idModule);
  assert.equal(await page.locator("button:has-text('Repasser en brouillon')").count(), 0);
  assert.equal(await page.locator("button:has-text('Retirer')").count(), 0);
  assert.equal(await page.locator("input[name=titre]").count(), 0, "module publié : pas de formulaire pour le tuteur");
  await page.waitForSelector("text=réservée à l'administration");
  await rebrancher(codeAdmin);
  await page.goto(BASE + "/module/" + idModule);
  await page.waitForSelector("h2:has-text('comporte 2 questions')");
  await page.waitForSelector("h2:has-text('Présentation')");
  await page.waitForSelector("strong:has-text('module déposé')");
  await page.waitForSelector("li:has-text('point un')");
  const seuilDe = async (id) =>
    (await page.textContent("section.panneau-titre p")).replace(/ /g, " ");
  await page.goto(BASE + "/module/" + idModule + "/evaluation");
  assert.match(await seuilDe(idModule), /Seuil de réussite 70 %/);
  ok("module déposé : deux questions importées et validées, présentation affichée, seuil propre 70 %");

  // 12d. barème réglable : QIM à 0,25 et seuil par défaut 85 %, annoncés, puis valeurs rétablies
  await page.goto(BASE + "/admin/bareme");
  await page.fill("input[name=qim1]", "0.25");
  await page.fill("input[name=seuilDefaut]", "85");
  await page.click("button:has-text('Enregistrer le barème')");
  await page.waitForURL(/ok=enregistre/);
  await page.waitForSelector("text=1 discordance → 0,25");
  await page.goto(BASE + "/");
  await page.waitForSelector("text=1 discordance → 0,25");
  await page.goto(BASE + "/module/comportement-zac/evaluation");
  assert.match(await seuilDe("comportement-zac"), /Seuil de réussite 85 %/, "seuil par défaut sur un module du code");
  await page.goto(BASE + "/module/" + idModule + "/evaluation");
  assert.match(await seuilDe(idModule), /Seuil de réussite 70 %/, "seuil propre du module déposé conservé");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("p.question-bareme:has-text('1 discordance → 0,25')");
  await page.goto(BASE + "/admin/bareme");
  await page.click("button:has-text('Rétablir les valeurs par défaut')");
  await page.waitForURL(/ok=defaut/);
  await page.goto(BASE + "/");
  await page.waitForSelector("text=1 discordance → 0,5");
  ok("barème réglé : QIM à 0,25 et seuil par défaut 85 % annoncés à l'accueil et sous la question, puis valeurs par défaut rétablies");

  // 12e. document général proposé aux profils Chimiothérapie · N1c
  await page.goto(BASE + "/admin/documents");
  await page.setInputFiles("input[name=fichier]", PNG);
  await page.fill("input[name=titre]", "Document profil chimio");
  await page.check("input[name=filieres][value=chimiotherapie]");
  await page.check("input[name=niveaux][value=N1c]");
  await page.click("button:has-text('Déposer')");
  await page.waitForSelector("text=Document déposé");
  await page.waitForSelector("text=profils : chimiotherapie, N1c");
  await page.goto(BASE + "/");
  assert.equal(await page.locator("a:has-text('Document profil chimio')").count(), 0, "invisible sans filière");
  await page.selectOption("label:has-text('Filière') select", "chimiotherapie");
  await page.waitForSelector("a:has-text('Document profil chimio')");
  await page.selectOption("label:has-text('Niveau visé') select", "N2");
  assert.equal(await page.locator("a:has-text('Document profil chimio')").count(), 0, "invisible au niveau N2");
  ok("document général proposé aux profils Chimiothérapie · N1c seulement");

  // 12f. fin de test : document de synthèse, rejeu des questions ratées, module suivant du parcours
  await page.goto(BASE + "/admin/documents");
  await page.setInputFiles("input[name=fichier]", PNG);
  await page.fill("input[name=titre]", "Synthèse du module déposé");
  await page.selectOption("select[name=nature]", "synthese");
  await page.selectOption("select[name=moduleId]", idModule);
  await page.click("button:has-text('Déposer')");
  await page.waitForSelector("text=Document déposé");
  await page.waitForSelector("text=Fiche de synthèse");
  await page.goto(BASE + "/module/" + idModule + "/evaluation");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("fieldset.question");
  const fsDepot = page.locator("fieldset.question");
  assert.equal(await fsDepot.count(), 2);
  for (let i = 0; i < 2; i++) {
    const f = fsDepot.nth(i);
    if (await f.locator(".proposition").count()) {
      for (const [texte, vrai] of [["Première vraie", true], ["Deuxième fausse", false], ["Troisième vraie", true]]) {
        await f.locator(".proposition", { hasText: texte }).locator(`label:has-text('${vrai ? "Vrai" : "Faux"}') input`).check();
      }
    } else {
      // QCM : réponse fausse volontaire, pour avoir une question à retravailler
      await f.locator("label.option", { hasText: "Mauvaise" }).locator("input").check();
    }
  }
  await page.click("button:has-text(\"Valider l'évaluation\")");
  await page.waitForSelector(".resultat-entete");
  await page.waitForSelector("h2:has-text('Document de synthèse')");
  await page.waitForSelector("img.synthese-image");
  await page.click("button:has-text('Retravailler la question ratée')");
  await page.waitForSelector("text=À revoir · 1 question ratée");
  assert.equal(await page.locator("fieldset.question").count(), 1);
  await page.goto(BASE + "/module/comportement-zac");
  await page.waitForSelector("a:has-text('Module suivant')");
  await page.waitForSelector("text=Parcours : Socle transversal, module");
  ok("fin de test : document de synthèse affiché, question ratée rejouée en entraînement, module suivant du parcours");

  // 12g. progression rattachée (question 11, choix c) : première fois, code personnel, évaluation conservée
  // AG-001 a été clos plus haut : un identifiant clos ne se rattache pas, d'où un second identifiant.
  await page.goto(BASE + "/#progression");
  await page.fill("#progression input[name=identifiant]", "ag 1");
  await page.click("#progression button:has-text('Reprendre ma progression')");
  await page.waitForURL(/progression=clos/);
  await page.goto(BASE + "/admin/personnel");
  await page.click("button:has-text('Créer un identifiant')");
  await page.waitForURL(/ok=cree&identifiant=AG-002/);
  await page.goto(BASE + "/#progression");
  await page.fill("#progression input[name=identifiant]", "ag 2");
  await page.click("#progression button:has-text('Reprendre ma progression')");
  await page.waitForURL(/premiere=AG-002/);
  await page.fill("input[name=nouveauCode]", "1234");
  await page.fill("input[name=confirmation]", "1234");
  await page.click("button:has-text('Choisir ce code')");
  await page.waitForURL(/progression=ok/);
  await page.waitForSelector("#progression code:has-text('AG-002')");
  await page.waitForSelector("a[title='Progression rattachée']:has-text('AG-002')");
  await page.goto(BASE + "/module/" + idModule + "/evaluation");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("fieldset.question");
  const fsProg = page.locator("fieldset.question");
  const nProg = await fsProg.count();
  for (let i = 0; i < nProg; i++) {
    const f = fsProg.nth(i);
    if (await f.locator(".proposition").count()) {
      for (const [texte, vrai] of [["Première vraie", true], ["Deuxième fausse", false], ["Troisième vraie", true]]) {
        await f.locator(".proposition", { hasText: texte }).locator(`label:has-text('${vrai ? "Vrai" : "Faux"}') input`).check();
      }
    } else {
      await f.locator("label.option", { hasText: "Bonne" }).locator("input").check();
    }
  }
  await page.click("button:has-text(\"Valider l'évaluation\")");
  await page.waitForSelector(".resultat-entete");
  // rechargement complet : la mémoire de session repart des évaluations conservées
  await page.goto(BASE + "/#progression");
  await page.waitForSelector("#progression td:has-text('Module déposé test')");
  await page.waitForSelector("#progression td:has-text('100 %')");
  await page.waitForSelector("h2:has-text('Mes évaluations')");
  assert.equal(await page.getAttribute("input[name=identifiant][readonly]", "value"), "AG-002");
  ok("progression rattachée : identifiant clos refusé, code personnel choisi, évaluation conservée et relue après rechargement, identifiant verrouillé à l'émission");

  // 12h. évaluation interrompue : sauvegardée, reprise avec la réponse conservée, effacée après correction
  await page.goto(BASE + "/module/comportement-zac/evaluation");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("fieldset.question");
  const premierQcm = page.locator("fieldset.question").filter({ has: page.locator("label.option") }).first();
  const enonceRepris = (await premierQcm.locator(".question-enonce").innerText()).trim();
  await premierQcm.locator("label.option input").first().check();
  await page.waitForTimeout(1500); // sauvegarde regroupée (700 ms) puis réponse du serveur
  await page.goto(BASE + "/module/comportement-zac/evaluation");
  await page.waitForSelector("text=interrompue");
  await page.click("button:has-text('Reprendre')");
  await page.waitForSelector("fieldset.question");
  const repris = page.locator("fieldset.question").filter({ hasText: enonceRepris });
  assert.equal(await repris.locator("label.option input").first().isChecked(), true, "réponse conservée à la reprise");
  await page.click("button:has-text(\"Valider l'évaluation\")");
  await page.waitForSelector(".resultat-entete");
  await page.goto(BASE + "/module/comportement-zac/evaluation");
  await page.waitForSelector("button:has-text('Commencer')");
  assert.equal(await page.locator("text=interrompue").count(), 0, "session en cours effacée après correction");
  ok("évaluation interrompue : sauvegardée sous l'identifiant, reprise avec la réponse conservée, effacée après correction");

  // 12i. tutorat : traces de l'agent, purge confirmée, code réinitialisé, détachement, nouveau code exigé
  await page.goto(BASE + "/admin/personnel");
  const ligneAg2 = page.locator("tr:has(code:has-text('AG-002'))");
  await ligneAg2.locator("td:has-text('défini')").waitFor();
  await ligneAg2.locator("a[href^='/admin/personnel/']").click();
  await page.waitForURL(/\/admin\/personnel\/\d+$/);
  await page.waitForSelector("h1:has-text('Progression de AG-002')");
  assert.ok((await page.locator("table.tableau tbody tr").count()) >= 2, "au moins deux évaluations conservées");
  await page.fill("input[name=confirmation]", "AG-002");
  await page.click("button:has-text('Purger les')");
  await page.waitForURL(/ok=purge/);
  await page.click("button:has-text('Réinitialiser le code personnel')");
  await page.waitForURL(/ok=code/);
  await page.locator("tr:has(code:has-text('AG-002')) td:has-text('absent')").waitFor();
  await page.goto(BASE + "/#progression");
  await page.click("#progression button:has-text('Se détacher')");
  await page.waitForSelector("#progression button:has-text('Reprendre ma progression')");
  await page.fill("#progression input[name=identifiant]", "AG-002");
  await page.click("#progression button:has-text('Reprendre ma progression')");
  await page.waitForURL(/premiere=AG-002/);
  ok("tutorat : traces listées, purge confirmée par recopie, code réinitialisé, détachement, nouveau code exigé au retour");

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

  // 14b. tout le site derrière un code (question 13, choix c) : sans session, documents et API refusés,
  //      pages renvoyées à la connexion avec la page demandée ; santé et données personnelles publiques
  assert.equal((await page.request.get(BASE + lien)).status(), 401, "document déposé refusé sans session");
  assert.equal((await page.request.get(BASE + "/api/images/inconnu")).status(), 401, "API refusée sans session");
  assert.equal((await page.request.get(BASE + "/api/sante")).status(), 200, "page de santé publique");
  await page.goto(BASE + "/module/comportement-zac");
  await page.waitForURL(/\/connexion\?suite=%2Fmodule%2Fcomportement-zac/);
  await page.goto(BASE + "/");
  await page.waitForURL(/\/connexion$/);
  await page.goto(BASE + "/donnees-personnelles");
  await page.waitForSelector("h1:has-text('Vos données et vos droits')");
  // la connexion renvoie vers la page demandée
  await page.goto(BASE + "/connexion?suite=%2Fmodule%2Fcomportement-zac");
  await page.fill("input[name=code]", codeTuteur);
  await page.click("button:has-text('Entrer')");
  await page.waitForURL(/\/module\/comportement-zac$/);
  await page.waitForSelector("a:has-text('Schéma déposé test')");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.click("button:has-text('quitter')");
  await page.waitForURL(/\/connexion/);
  ok("tout le site derrière un code : 401 sur documents et API sans session, pages renvoyées à la connexion, retour à la page demandée après le code");

  // 14c. session liée à son code (question 16, choix b) : révoquer ou supprimer un code ferme ses sessions
  //      à la requête suivante ; réactiver ne rouvre pas les sessions d'avant
  await page.fill("input[name=code]", codeAdmin);
  await page.click("button:has-text('Entrer')");
  await page.waitForURL(/\/admin$/);
  await page.selectOption("select[name=role]", "poste");
  await page.fill("input[name=libelle]", "Poste jetable");
  await page.click("button:has-text(\"Générer le code\")");
  await page.waitForURL(/nouveau=/);
  const codeJetable = new URL(page.url()).searchParams.get("nouveau");
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  const entrerJetable = async () => {
    await page2.goto(BASE + "/connexion");
    await page2.fill("input[name=code]", codeJetable);
    await page2.click("button:has-text('Entrer')");
    await page2.waitForURL(/\/$/);
  };
  const apiJetable = async () => (await page2.request.get(BASE + "/api/images/inconnu")).status();
  await entrerJetable();
  await page2.goto(BASE + "/module/comportement-zac");
  await page2.waitForSelector("h1");
  assert.equal(await apiJetable(), 404, "API servie avec une session valide (identifiant inconnu)");
  await page.goto(BASE + "/admin");
  const carteJetable = page.locator("li.carte", { hasText: "Poste jetable" });
  await carteJetable.locator("button:has-text('Révoquer')").click();
  await carteJetable.locator("text=révoqué").waitFor();
  assert.equal(await apiJetable(), 401, "API refusée dès la révocation du code");
  await page2.goto(BASE + "/module/comportement-zac");
  await page2.waitForURL(/\/connexion\?erreur=session-fermee&suite=%2Fmodule%2Fcomportement-zac/);
  await page2.waitForSelector("[role=alert]:has-text('Votre session a été fermée')");
  await carteJetable.locator("button:has-text('Réactiver')").click();
  await carteJetable.locator("button:has-text('Révoquer')").waitFor();
  assert.equal(await apiJetable(), 401, "réactiver ne rouvre pas la session d'avant");
  await entrerJetable();
  assert.equal(await apiJetable(), 404, "nouvelle session valide après réactivation");
  await carteJetable.locator("button:has-text('Supprimer')").click();
  await page.waitForSelector("li.carte:has-text('Poste jetable')", { state: "detached" });
  assert.equal(await apiJetable(), 401, "code supprimé : session fermée");
  await ctx2.close();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.click("button:has-text('quitter')");
  await page.waitForURL(/\/connexion/);
  ok("session liée à son code : révocation et suppression ferment la session à la requête suivante, réactivation sans effet sur celle d'avant");
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
