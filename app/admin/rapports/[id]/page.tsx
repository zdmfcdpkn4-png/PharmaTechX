import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { conservationNominative } from "@/lib/config";
import { LIBELLES_STATUT_RAPPORT, lireRapport } from "@/lib/rapports";
import { QUALITES_VISA } from "@/lib/rapport";
import { actionAnnulerRapport, actionViserRapport } from "../actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  vise: "Visa enregistré.",
  annule: "Rapport annulé.",
  "nom-manquant": "Le nom du signataire est obligatoire.",
  "deja-vise": "Ce visa est déjà porté.",
  "tuteur-d-abord": "Le visa du tuteur précède celui du pharmacien.",
  indisponible: "Ce rapport ne peut plus être visé.",
  "motif-manquant": "L'annulation demande un motif.",
};

export default async function Rapport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { id } = await params;
  const p = await searchParams;
  if (!conservationNominative()) notFound();
  const r = await lireRapport(id);
  if (!r) notFound();
  const session = (await getSession())!;
  const visaTuteur = r.visas.find((v) => v.qualite === "tuteur");
  const visaPharmacien = r.visas.find((v) => v.qualite === "pharmacien");
  const peutViserTuteur = r.statut !== "annule" && !visaTuteur;
  const peutViserPharmacien = r.statut !== "annule" && Boolean(visaTuteur) && !visaPharmacien && session.role === "admin";
  const message = p.ok ? MESSAGES[p.ok] : p.erreur ? MESSAGES[p.erreur] : null;

  return (
    <>
      <p className="fil">
        <Link href="/admin/rapports">Rapports</Link> › {r.numero}
      </p>
      <section className="panneau-titre">
        <p className="sur-titre">{LIBELLES_STATUT_RAPPORT[r.statut]}</p>
        <h1>{r.numero} — {r.module_titre}</h1>
        <p>
          {r.apprenant_nom}{r.apprenant_qualite ? ` (${r.apprenant_qualite})` : ""} · émis le{" "}
          {new Date(r.emis_le).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} ·{" "}
          {r.tirage} · <strong>{r.resultat.score} %</strong> — {r.resultat.reussi ? "critère acquis" : "critère non acquis"}
          {r.resultat.echecEliminatoire ? " (éliminatoire manquée)" : ""}
        </p>
        <p className="legende" style={{ margin: 0 }}>
          Empreinte SHA-256 du résultat scellé : <code>{r.empreinte}</code>
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href={`/admin/rapports/${r.id}/imprimer`} target="_blank" rel="noreferrer" className="bouton">
            Ouvrir le rapport A4 (imprimer, PDF)
          </a>
        </div>
      </section>

      {message && (
        <p className={`encart ${p.ok ? "encart--ok" : "encart--attention"}`} role="status">{message}</p>
      )}
      {r.statut === "annule" && (
        <p className="encart encart--attention">
          Annulé le {r.annule_le ? new Date(r.annule_le).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : ""} — motif : {r.annule_motif}
        </p>
      )}

      <div className="section-titre">
        <h2>Visas</h2>
        <span className="compte">{r.visas.length} / 3</span>
      </div>
      <table className="tableau">
        <thead>
          <tr><th>Qualité</th><th>Objet</th><th>Signataire</th><th>Date</th><th>Empreinte</th></tr>
        </thead>
        <tbody>
          {QUALITES_VISA.map((q) => {
            const v = r.visas.find((x) => x.qualite === q.qualite);
            return (
              <tr key={q.qualite}>
                <td><strong>{q.libelle}</strong></td>
                <td>{q.objet}{v?.commentaire ? <><br /><em>{v.commentaire}</em></> : null}</td>
                <td>{v ? <>{v.nom}<br /><span className="legende">{v.role_session}{v.libelle_session ? ` · ${v.libelle_session}` : ""}</span></> : <span className="legende">en attente</span>}</td>
                <td>{v ? new Date(v.signe_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : ""}</td>
                <td>{v ? <code>{v.empreinte.slice(0, 12)}</code> : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {peutViserTuteur && (
        <section className="carte">
          <h3>Visa du tuteur (N3)</h3>
          <p className="legende">Prend connaissance du résultat avant l&apos;entrée en compagnonnage au poste. Le visa porte votre nom, votre profil de session et l&apos;empreinte du rapport.</p>
          <form action={actionViserRapport}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="qualite" value="tuteur" />
            <div className="rangee">
              <label className="champ"><span>Nom du tuteur</span><input type="text" name="nom" required maxLength={120} /></label>
              <label className="champ"><span>Commentaire (facultatif)</span><input type="text" name="commentaire" maxLength={500} /></label>
            </div>
            <div className="actions"><button type="submit" className="bouton">Apposer le visa tuteur</button></div>
          </form>
        </section>
      )}

      {peutViserPharmacien && (
        <section className="carte">
          <h3>Visa du pharmacien responsable</h3>
          <p className="legende">Accuse réception de la preuve de l&apos;étape 2 pour le dossier d&apos;habilitation. Il ne prononce pas l&apos;habilitation (chapitre IV de la fiche).</p>
          <form action={actionViserRapport}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="qualite" value="pharmacien" />
            <div className="rangee">
              <label className="champ"><span>Nom du pharmacien</span><input type="text" name="nom" required maxLength={120} /></label>
              <label className="champ"><span>Commentaire (facultatif)</span><input type="text" name="commentaire" maxLength={500} /></label>
            </div>
            <div className="actions"><button type="submit" className="bouton">Apposer le visa pharmacien</button></div>
          </form>
        </section>
      )}
      {r.statut !== "annule" && Boolean(visaTuteur) && !visaPharmacien && session.role !== "admin" && (
        <p className="encart">Le visa du pharmacien responsable demande un code d&apos;administration.</p>
      )}

      <div className="section-titre">
        <h2>Synthèse</h2>
        <span className="compte">{r.resultat.detail.length} questions</span>
      </div>
      <table className="tableau">
        <thead><tr><th>N°</th><th>Format</th><th>Énoncé</th><th>Résultat</th><th>Points</th></tr></thead>
        <tbody>
          {r.resultat.detail.map((d, i) => (
            <tr key={d.questionId}>
              <td>{i + 1}</td>
              <td>{d.type}{d.eliminatoire ? " · élim." : ""}</td>
              <td>{d.enonce}</td>
              <td>{d.correct ? "exact" : d.type === "QIM" ? `${d.discordances} discordance(s)` : d.type === "SCH" ? `${d.discordances} légende(s) en écart` : "erroné"}</td>
              <td>{String(d.note).replace(".", ",")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {session.role === "admin" && r.statut !== "annule" && (
        <section className="carte">
          <h3>Annuler ce rapport</h3>
          <p className="legende">Un rapport annulé reste en base, avec son motif ; l&apos;apprenant en émet un nouveau.</p>
          <form action={actionAnnulerRapport}>
            <input type="hidden" name="id" value={r.id} />
            <label className="champ"><span>Motif</span><input type="text" name="motif" required maxLength={500} /></label>
            <div className="actions"><button type="submit" className="bouton bouton--secondaire">Annuler le rapport</button></div>
          </form>
        </section>
      )}
    </>
  );
}
