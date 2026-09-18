import type { ResultatSession } from "@/components/SessionFormation";

/**
 * Génération du rapport de session.
 *
 * Le fichier est construit dans le navigateur, à partir des résultats détenus
 * en mémoire, et téléchargé via un Blob. Il ne transite par aucun serveur.
 * Le nom saisi par l'apprenant n'est utilisé qu'ici, au moment de l'écriture du
 * fichier : il n'est jamais envoyé nulle part.
 *
 * Le format retenu est un HTML autonome, imprimable en PDF depuis le
 * navigateur : lisible sans logiciel particulier, archivable, et signable après
 * impression.
 */

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EnTeteRapport {
  /** Saisi par l'apprenant, utilisé uniquement dans le fichier produit. */
  nom: string;
  /** Champ libre : fonction, secteur, niveau visé. */
  qualite: string;
  parcours: string;
}

export function construireRapport(
  entete: EnTeteRapport,
  resultats: ResultatSession[],
): string {
  const date = new Date().toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const modules = resultats.map((r) => {
    const lignes = r.detail
      .map(
        (d) => `
        <tr class="${d.correct ? "ok" : "ko"}">
          <td>${d.situation ? `<em>${echapper(d.situation)}</em><br>` : ""}${echapper(d.enonce)}</td>
          <td class="c">${d.type}</td>
          <td class="c">${d.note.toString().replace(".", ",")}</td>
          <td class="c">${d.correct ? "Conforme" : `${d.discordances} discordance${d.discordances > 1 ? "s" : ""}`}${d.eliminatoire ? '<br><span class="elim">éliminatoire</span>' : ""}</td>
        </tr>`,
      )
      .join("");

    return `
      <section>
        <h2>${echapper(r.moduleTitre)}</h2>
        <p class="resume ${r.reussi ? "ok" : "ko"}">
          <strong>${r.score}&nbsp;%</strong>
          (${r.pointsObtenus.toString().replace(".", ",")} / ${r.pointsTotal} points) —
          seuil de réussite ${r.seuilReussite}&nbsp;% —
          <strong>${r.reussi ? "acquis" : "non acquis"}</strong>${r.echecEliminatoire ? " — échec sur une question éliminatoire" : ""}
          <br><span class="petit">Tentative n°${r.tentative} — correction du ${echapper(r.horodatage)}</span>
        </p>
        <table>
          <thead>
            <tr><th>Question</th><th>Format</th><th>Note</th><th>Résultat</th></tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
      </section>`;
  });

  const modulesAcquis = resultats.filter((r) => r.reussi).length;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport de formation — ${echapper(entete.nom || "sans nom")}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: Aptos, Inter, system-ui, sans-serif; color: #16202a; line-height: 1.5; font-size: 11pt; border-left: 4px solid #E82A63; padding-left: 10mm; }
  h1 { color: #005586; font-size: 17pt; margin: 0 0 .2rem; }
  h2 { color: #005586; font-size: 12.5pt; margin: 1.4rem 0 .4rem; border-top: 1px solid #d8dde2; padding-top: .7rem; }
  .entete { border: 1px solid #005586; border-radius: 6px; padding: .8rem 1rem; margin: 1rem 0 1.5rem; }
  .entete dl { display: grid; grid-template-columns: max-content 1fr; gap: .2rem 1rem; margin: 0; }
  .entete dt { font-weight: 700; color: #005586; }
  .entete dd { margin: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  th { background: #005586; color: #fff; text-align: left; padding: .35rem .5rem; font-weight: 600; }
  td { border-bottom: 1px solid #e3e7ea; padding: .35rem .5rem; vertical-align: top; }
  td.c { text-align: center; white-space: nowrap; }
  tr.ko td { background: #fbeae8; }
  .elim { color: #99271f; font-size: 8pt; font-weight: 700; text-transform: uppercase; }
  .resume { padding: .5rem .7rem; border-radius: 5px; }
  .resume.ok { background: #e6f3ec; border-left: 3px solid #1f6b45; }
  .resume.ko { background: #fbeae8; border-left: 3px solid #99271f; }
  .petit { font-size: 9pt; color: #566370; }
  .mentions { margin-top: 2rem; font-size: 9pt; color: #566370; border-top: 2px solid #005586; padding-top: .6rem; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem; }
  .signatures div { border: 1px dashed #b6bec6; border-radius: 5px; padding: .6rem; min-height: 22mm; font-size: 9.5pt; color: #566370; }
</style>
</head>
<body>
<h1>Rapport de formation et d'évaluation</h1>
<p class="petit">Unité de pharmacotechnie — CHD Vendée — document édité le ${echapper(date)}</p>

<div class="entete">
  <dl>
    <dt>Apprenant</dt><dd>${echapper(entete.nom) || "<em>non renseigné</em>"}</dd>
    <dt>Qualité</dt><dd>${echapper(entete.qualite) || "<em>non renseignée</em>"}</dd>
    <dt>Parcours</dt><dd>${echapper(entete.parcours)}</dd>
    <dt>Modules évalués</dt><dd>${resultats.length} — dont ${modulesAcquis} acquis</dd>
  </dl>
</div>

${modules.join("")}

<div class="signatures">
  <div><strong>Visa de l'apprenant</strong><br>Date et signature</div>
  <div><strong>Visa du pharmacien responsable</strong><br>Date et signature</div>
</div>

<p class="mentions">
  Ce rapport est édité localement sur le poste de l'apprenant à partir d'une session de formation.
  Aucune donnée nominative n'est enregistrée par l'application : ce fichier est le seul support du résultat.
  Sa valeur en tant que preuve d'habilitation dépend du statut retenu pour le dispositif — [à préciser].
</p>
</body>
</html>`;
}

export function telechargerRapport(
  entete: EnTeteRapport,
  resultats: ResultatSession[],
): void {
  const html = construireRapport(entete, resultats);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const jour = new Date().toISOString().slice(0, 10);
  const nomFichier = (entete.nom || "apprenant")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  a.href = url;
  a.download = `rapport-formation-${nomFichier}-${jour}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
