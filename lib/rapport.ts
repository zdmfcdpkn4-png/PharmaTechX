import type { ResultatEvaluation } from "@/app/api/evaluation/route";

/**
 * Rapport d'évaluation — document A4 imprimable, repris de la maquette
 * « Rapport evaluation - A4 imprimable » de la passation de design.
 *
 * Le même constructeur sert :
 *   - sur le poste de l'apprenant, pour le rapport de session téléchargé
 *     (`telechargerRapport`), sans qu'aucune donnée ne transite par le serveur ;
 *   - sur le serveur, pour rendre un rapport enregistré (`/admin/rapports/[id]`)
 *     avec son numéro, son empreinte et ses visas électroniques.
 *
 * Il ne contient que ce qui est fourni : sans conservation nominative, le nom
 * n'apparaît que si l'apprenant l'a saisi au moment du téléchargement, et
 * l'identification se complète à la main.
 */

export type QualiteVisa = "apprenant" | "tuteur" | "pharmacien";

export interface VisaRapport {
  qualite: QualiteVisa;
  nom: string;
  /** Date lisible (« 18 septembre 2026 à 14:02 »). */
  date: string;
  commentaire?: string;
}

export interface EnTeteRapport {
  /** Saisi par l'apprenant ou lu en base ; vide = à compléter à la main. */
  nom: string;
  qualite: string;
  parcours: string;
}

export interface OptionsRapport {
  /** Numéro attribué à l'enregistrement (RAP-2026-0001). */
  numero?: string;
  /** Empreinte SHA-256 du résultat scellé. */
  empreinte?: string;
  visas?: VisaRapport[];
  /** Préfixe des adresses de logos (origine du site) ; vide pour un rendu serveur. */
  baseUrl?: string;
  conservation?: "aucune" | "nominative";
  dureeConservationMois?: number | null;
  /** Date d'édition, sinon maintenant. */
  dateEdition?: Date;
}

export type ResultatRapport = ResultatEvaluation & { tentative?: number };

export const QUALITES_VISA: { qualite: QualiteVisa; libelle: string; objet: string }[] = [
  { qualite: "apprenant", libelle: "Apprenant", objet: "Atteste avoir lu le module et passé l'évaluation dans les conditions décrites." },
  { qualite: "tuteur", libelle: "Tuteur (N3)", objet: "Prend connaissance du résultat avant l'entrée en compagnonnage au poste." },
  { qualite: "pharmacien", libelle: "Pharmacien responsable", objet: "Réception de la preuve de l'étape 2 pour le dossier d'habilitation." },
];

export function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nombre(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function etatDe(d: ResultatRapport["detail"][number]): string {
  if (d.correct) return d.type === "QIM" ? "Aucune discordance" : d.type === "SCH" ? "Toutes les légendes justes" : "Réponse exacte";
  if (d.type === "QIM") {
    return `${d.discordances} discordance${d.discordances > 1 ? "s" : ""}${d.nonJugees > 0 ? ` — dont ${d.nonJugees} sans réponse` : ""}`;
  }
  if (d.type === "SCH") {
    const fausses = d.discordances - d.nonJugees;
    return `${fausses} légende${fausses > 1 ? "s" : ""} fausse${fausses > 1 ? "s" : ""}${d.nonJugees > 0 ? `, ${d.nonJugees} vide${d.nonJugees > 1 ? "s" : ""}` : ""}`;
  }
  return "Réponse erronée";
}

function couleurDe(d: ResultatRapport["detail"][number]): string {
  return d.note >= 1 ? "#1f6b45" : d.note > 0 ? "#8a5a00" : "#99271f";
}

function formatDe(d: ResultatRapport["detail"][number]): string {
  if (d.type === "QIM") return "QIM";
  if (d.type === "SCH") return "Schéma";
  return d.reponsesAttendues.length > 1 ? "QCM multiple" : "QCM";
}

function objetDe(d: ResultatRapport["detail"][number]): string {
  const e = d.enonce.replace(/\s+/g, " ").trim();
  return e.length > 90 ? `${e.slice(0, 87)}…` : e;
}

function tableauVisas(visas: VisaRapport[], empreinte?: string): string {
  const lignes = QUALITES_VISA.map((q) => {
    const v = visas.find((x) => x.qualite === q.qualite);
    if (v) {
      return `<tr>
        <td class="q">${q.libelle}</td>
        <td>${echapper(q.objet)}${v.commentaire ? `<br><em>${echapper(v.commentaire)}</em>` : ""}</td>
        <td>${echapper(v.date)}</td>
        <td><strong>${echapper(v.nom)}</strong><br><span class="petit">visa électronique${empreinte ? ` · ${empreinte.slice(0, 12)}` : ""}</span></td>
      </tr>`;
    }
    return `<tr>
      <td class="q">${q.libelle}</td>
      <td>${echapper(q.objet)}</td>
      <td class="vide"></td>
      <td class="vide"></td>
    </tr>`;
  }).join("");
  return `<table class="visas">
    <thead><tr><th style="width:24%">Qualité</th><th>Objet du visa</th><th style="width:16%">Date</th><th style="width:24%">Signature</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  <p class="petit">Le visa du pharmacien responsable ne prononce pas l'habilitation : il accuse réception de la preuve de l'étape 2. L'habilitation finale se prononce au chapitre IV de la fiche d'habilitation.</p>`;
}

function sectionCritere(r: ResultatRapport, entete: EnTeteRapport, o: OptionsRapport, premiere: boolean): string {
  const verdict = r.reussi ? "Critère acquis pour cette évaluation" : "Critère non acquis";
  const motif = r.reussi
    ? "Le seuil est atteint et aucune question éliminatoire n'est en échec. La suite du parcours reste à réaliser au poste."
    : r.echecEliminatoire
      ? "Échec sur une question éliminatoire : le critère est non acquis quel que soit le score global. Reprise du module puis nouveau tirage."
      : "Le seuil de réussite n'est pas atteint. Reprise du module puis nouveau tirage.";

  const synthese = r.detail
    .map(
      (d, i) => `<tr>
      <td class="mono">${i + 1}</td>
      <td>${formatDe(d)}${d.eliminatoire ? " · éliminatoire" : ""}</td>
      <td>${echapper(objetDe(d))}</td>
      <td><strong>${etatDe(d)}</strong></td>
      <td class="mono droite">${nombre(d.note)} / 1</td>
    </tr>`,
    )
    .join("");

  const identification = `<table class="ident">
    <tbody>
      <tr><td class="q">Nom et prénom</td><td>${entete.nom ? `<strong>${echapper(entete.nom)}</strong>` : '<span class="aide">à renseigner par l\'apprenant</span>'}</td></tr>
      <tr><td class="q">Fonction et unité</td><td>${entete.qualite ? echapper(entete.qualite) : '<span class="aide">préparateur en pharmacie, interne, pharmacien — unité de production</span>'}</td></tr>
      <tr><td class="q">Date de passation</td><td>${echapper(r.horodatage)}${r.tentative ? ` <span class="petit">— tentative n°${r.tentative} dans la session</span>` : ""}</td></tr>
      ${entete.parcours ? `<tr><td class="q">Parcours</td><td>${echapper(entete.parcours)}</td></tr>` : ""}
    </tbody>
  </table>`;

  const details = r.detail
    .map((d, i) => {
      const legendes = d.legendes
        ? `<table class="legendes"><thead><tr><th>N°</th><th>Réponse donnée</th><th>Attendu</th><th>Verdict</th></tr></thead><tbody>${d.legendes
            .map(
              (l) =>
                `<tr><td class="mono">${l.numero}</td><td>${echapper(l.reponse || "—")}</td><td>${echapper(l.attendu)}</td><td>${l.verdict === "juste" ? "juste" : l.verdict === "fausse" ? "fausse" : "sans réponse"}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : `<p class="rep">Réponse donnée : <span>${d.choixApprenant.length ? echapper(d.choixApprenant.join(" · ")) : "aucune"}</span></p>
           <p class="rep">Attendu : <strong>${echapper(d.reponsesAttendues.join(" · "))}</strong></p>`;
      return `<div class="detail" style="border-left-color:${couleurDe(d)}">
        <div class="detail-tete">
          <span class="mono num">Question ${i + 1}</span>
          <span class="etat" style="color:${couleurDe(d)}">${etatDe(d)}</span>
          <span class="petit">${formatDe(d)}</span>
          ${d.eliminatoire ? '<span class="elim">Éliminatoire</span>' : ""}
          <span class="mono points">${nombre(d.note)} / 1 point</span>
        </div>
        ${d.situation ? `<p class="petit">Mise en situation — ${echapper(d.situation)}</p>` : ""}
        <p class="enonce">${echapper(d.enonce)}</p>
        ${legendes}
        ${d.justification ? `<p class="justif">${echapper(d.justification)}</p>` : ""}
        ${d.sources.length ? `<p class="petit">Source : ${echapper(d.sources.join(" ; "))}</p>` : ""}
      </div>`;
    })
    .join("");

  const sources = [...new Set(r.detail.flatMap((d) => d.sources))];

  return `<section class="critere${premiere ? "" : " nouvelle-page"}">
    <p class="sur-titre">Étape 2 sur 6 — évaluation des connaissances</p>
    <h1>${echapper(r.moduleTitre)}</h1>
    <p class="contexte">${r.critereId ? `Critère ${echapper(r.critereId)} · ` : ""}${r.tirage ? `${echapper(r.tirage)} · ` : ""}seuil de réussite ${r.seuilReussite} %${o.numero ? ` · rapport n° ${echapper(o.numero)}` : ""}</p>

    <table class="verdict">
      <tbody><tr>
        <td class="v">
          <div class="lib">Verdict de l'évaluation</div>
          <div class="grand" style="color:${r.reussi ? "#1f6b45" : "#99271f"}">${verdict}</div>
          <div>${motif}</div>
        </td>
        <td class="s">
          <div class="lib">Score</div>
          <div class="score">${r.score} %</div>
          <div class="petit">${nombre(r.pointsObtenus)} / ${r.pointsTotal} points</div>
          <div>Seuil de réussite : <strong>${r.seuilReussite} %</strong></div>
        </td>
      </tr></tbody>
    </table>

    <h2>Identification${entete.nom ? "" : ", à compléter à la main"}</h2>
    ${identification}

    <h2>Synthèse par question</h2>
    <table class="synthese">
      <thead><tr><th>N°</th><th>Format</th><th>Objet de la question</th><th>Résultat</th><th class="droite">Points</th></tr></thead>
      <tbody>${synthese}</tbody>
    </table>

    <div class="encadre">
      <strong>Ce rapport ne vaut pas habilitation.</strong> Il documente la seule étape 2 de la chaîne en six étapes. Le compagnonnage au poste, l'évaluation pratique par le tuteur, la validation par le pharmacien responsable et le maintien de l'habilitation se déroulent hors de l'application et se consignent sur la fiche d'habilitation.
    </div>

    <h2>Visas</h2>
    ${tableauVisas(o.visas ?? [], o.empreinte)}

    <h2 class="nouvelle-page">Détail des questions, justifications et sources</h2>
    <p class="petit">Chaque justification renvoie au texte applicable. Les questions éliminatoires sont signalées : une erreur y invalide le critère quel que soit le score global.</p>
    ${details}
    ${sources.length ? `<h2>Sources citées</h2><ol class="sources">${sources.map((s) => `<li>${echapper(s)}</li>`).join("")}</ol>` : ""}
  </section>`;
}

export function construireRapport(
  entete: EnTeteRapport,
  resultats: ResultatRapport[],
  options: OptionsRapport = {},
): string {
  const date = (options.dateEdition ?? new Date()).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
  const base = options.baseUrl ?? "";
  const titre = resultats.length === 1
    ? `Rapport d'évaluation — ${resultats[0].critereId ?? resultats[0].moduleTitre}`
    : `Rapport de session — ${resultats.length} critères`;
  const conservation =
    options.conservation === "nominative"
      ? `Rapport enregistré par l'application${options.numero ? ` sous le n° ${echapper(options.numero)}` : ""}${
          options.dureeConservationMois ? ` — conservation ${options.dureeConservationMois} mois` : " — durée de conservation : [à préciser]"
        }.`
      : "Document sans donnée nominative enregistrée : l'identité est portée par l'apprenant. Aucun résultat n'est conservé par l'application.";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)}</title>
<style>
  @page { size: A4; margin: 12mm 14mm 14mm; }
  * { box-sizing: border-box; }
  html { background: #f0f2f4; }
  body { margin: 0; font-family: Aptos, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #16202a; font-size: 11pt; line-height: 1.5; }
  .feuille { max-width: 210mm; margin: 0 auto; background: #fff; padding: 12mm 14mm; }
  table.page { width: 100%; border-collapse: collapse; }
  table.page > thead > tr > td, table.page > tfoot > tr > td, table.page > tbody > tr > td { padding: 0; border: 0; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  .entete-page { display: flex; align-items: flex-end; gap: 14px; padding-bottom: 8px; margin-bottom: 14px; border-bottom: 2pt solid #E82A63; }
  .entete-page img { display: block; }
  .entete-page img.hdv { height: 26px; }
  .entete-page img.pharmaco { height: 36px; }
  .entete-page .sep { width: 1px; height: 26px; background: #d8dde2; }
  .entete-page .t { font-size: 10pt; line-height: 1.3; }
  .entete-page .t strong { display: block; }
  .entete-page .t span { color: #566370; font-size: 9pt; }
  .entete-page .ref { margin-left: auto; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; color: #566370; white-space: nowrap; }
  .pied-page { display: flex; gap: 14px; align-items: baseline; padding-top: 8px; margin-top: 14px; border-top: 1px solid #d8dde2; font-size: 8.5pt; line-height: 1.4; color: #566370; }
  .pied-page .mono { flex: none; }
  .sur-titre { margin: 0 0 4px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #b41f4d; }
  h1 { margin: 0 0 6px; font-size: 22pt; line-height: 1.15; letter-spacing: -.01em; color: #005586; }
  h2 { margin: 16px 0 6px; font-size: 13pt; line-height: 1.25; color: #005586; }
  .contexte { margin: 0 0 16px; font-size: 11pt; color: #566370; }
  table { width: 100%; border-collapse: collapse; }
  .verdict td { padding: 12px 14px; border: 1.5pt solid #005586; vertical-align: top; }
  .verdict td.v { width: 62%; }
  .verdict td.s { border-left: 0; }
  .lib { font-size: 9pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #566370; }
  .grand { font-size: 17pt; font-weight: 700; line-height: 1.2; margin-top: 4px; }
  .score { font-size: 24pt; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; margin-top: 2px; }
  .ident td, .synthese td, .synthese th, .visas td, .visas th, .legendes td, .legendes th { padding: 7px 10px; border: 1px solid #d8dde2; vertical-align: top; font-size: 10.5pt; }
  .ident td.q, .visas td.q { width: 30%; background: #f0f2f4; font-weight: 600; }
  .synthese th, .legendes th { text-align: left; background: #005586; color: #fff; font-size: 9pt; letter-spacing: .04em; text-transform: uppercase; border-color: #005586; }
  .visas th { text-align: left; background: #f0f2f4; font-size: 9pt; letter-spacing: .04em; text-transform: uppercase; }
  .visas td.vide { height: 56px; }
  .aide { color: #566370; }
  .mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
  .droite { text-align: right; }
  .petit { font-size: 9pt; color: #566370; }
  .encadre { border: 1px solid #8a5a00; background: #fdf3e0; padding: 10px 14px; margin: 14px 0; font-size: 10.5pt; line-height: 1.5; }
  .detail { margin: 0 0 12px; padding: 0 0 10px 12px; border-left: 3px solid #7b8792; border-bottom: 1px solid #d8dde2; }
  .detail-tete { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin-bottom: 4px; }
  .detail-tete .num { font-size: 9.5pt; font-weight: 700; color: #003f65; }
  .detail-tete .etat { font-size: 9pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .detail-tete .points { margin-left: auto; font-size: 9.5pt; font-weight: 700; }
  .elim { font-size: 8.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #fff; background: #b41f4d; padding: 2px 7px; border-radius: 3px; }
  .enonce { margin: 0 0 5px; font-size: 11.5pt; font-weight: 650; line-height: 1.4; }
  .rep { margin: 0 0 3px; font-size: 10.5pt; color: #566370; }
  .rep span, .rep strong { color: #16202a; }
  .justif { margin: 4px 0 5px; font-size: 11pt; line-height: 1.55; }
  .legendes { margin: 4px 0 6px; }
  .sources { margin: 0; padding-left: 20px; font-size: 10pt; line-height: 1.55; color: #566370; }
  .sources li { margin-bottom: 6px; }
  .actions { display: flex; gap: 10px; margin: 0 auto 12px; max-width: 210mm; }
  .actions button { font: inherit; padding: 10px 18px; border-radius: 10px; border: 1px solid #005586; background: #005586; color: #fff; cursor: pointer; }
  @media print {
    html { background: #fff; }
    .feuille { max-width: none; padding: 0; }
    .actions { display: none; }
    .nouvelle-page { break-before: page; }
    .detail, .visas tr, .synthese tr, .verdict, .encadre { break-inside: avoid; }
    p, li { orphans: 3; widows: 3; }
  }
</style>
</head>
<body>
<div class="actions"><button type="button" onclick="window.print()">Imprimer ou enregistrer en PDF</button></div>
<div class="feuille">
<table class="page">
  <thead><tr><td>
    <div class="entete-page">
      <img class="hdv" src="${base}/hdv.png" alt="Hôpitaux de Vendée">
      <span class="sep"></span>
      <img class="pharmaco" src="${base}/pharmaco-web.png" alt="Pharmacotechnie">
      <div class="t"><strong>CHD Vendée — Pharmacie à usage intérieur, unité de pharmacotechnie</strong><span>Rapport d'évaluation des connaissances — fiche d'habilitation, chapitre III</span></div>
      <span class="ref">${options.numero ? `${echapper(options.numero)} · ` : ""}édité le ${echapper(date)}</span>
    </div>
  </td></tr></thead>
  <tfoot><tr><td>
    <div class="pied-page">
      <span>${conservation}</span>
      <span class="mono">Statut du dispositif : [à préciser]${options.empreinte ? ` · empreinte ${options.empreinte.slice(0, 16)}` : ""}</span>
    </div>
  </td></tr></tfoot>
  <tbody><tr><td>
    ${resultats.map((r, i) => sectionCritere(r, entete, options, i === 0)).join("")}
  </td></tr></tbody>
</table>
</div>
</body>
</html>`;
}

export function nomFichierRapport(nom: string, numero?: string): string {
  const jour = new Date().toISOString().slice(0, 10);
  const propre = (nom || "apprenant")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `rapport-evaluation-${numero ? `${numero.toLowerCase()}-` : ""}${propre}-${jour}.html`;
}

/** Construit et télécharge le rapport sur le poste, sans passer par le serveur. */
export function telechargerRapport(
  entete: EnTeteRapport,
  resultats: ResultatRapport[],
  options: OptionsRapport = {},
): void {
  const html = construireRapport(entete, resultats, {
    baseUrl: typeof window !== "undefined" ? window.location.origin : "",
    ...options,
  });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichierRapport(entete.nom, options.numero);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
