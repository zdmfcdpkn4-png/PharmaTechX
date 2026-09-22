import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { conservationActive, miseEnService } from "@/lib/config";
import { CopierMention } from "@/components/CopierMention";
import { LIBELLES_REFUS_MENTION, mentionDePreuve } from "@/lib/mention";
import { LIBELLES_COURTS_VERDICT, LIBELLES_VERDICT, expliquerVerdict } from "@/lib/decision";
import { LIBELLES_STATUT_RAPPORT, contexteDecision, lireRapport } from "@/lib/rapports";
import { QUALITES_VISA } from "@/lib/rapport";
import { dataUri, lireSignature, signatureCourante } from "@/lib/signatures";
import { actionAnnulerRapport, actionArbitrerRapport, actionPurgerRapport, actionViserRapport } from "../actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  vise: "Visa enregistré.",
  "vise-sans-signature": "Visa enregistré, sans image de signature : aucune signature n'est déposée pour votre code. Déposez-la depuis « Signature » pour les prochains rapports.",
  arbitre: "Arbitrage enregistré : le verdict brut est conservé à côté du verdict arbitré.",
  annule: "Rapport annulé.",
  "deja-vise": "Ce visa est déjà porté.",
  "tuteur-d-abord": "Le visa du tuteur précède celui du pharmacien.",
  indisponible: "Ce rapport ne peut plus être visé.",
  "rapport-indisponible": "Ce rapport ne peut plus être visé.",
  "motif-manquant": "L'annulation demande un motif.",
  "signalement-ouvert": "Un signalement est ouvert sur une question de ce tirage : traitez-le avant de viser.",
  "arbitrage-requis": "Le verdict brut est indéterminé : un arbitrage motivé du tuteur précède le visa.",
  "non-concluant": "Tirage non concluant : ce rapport ne peut pas être visé. Annulez-le avec motif.",
  "verdict-manquant": "Choisissez le verdict arbitré.",
  "motif-court": "Le motif de l'arbitrage est obligatoire (dix caractères au moins).",
  "rapport-deja-vise": "Le rapport est déjà visé : l'arbitrage n'est plus possible.",
  "deja-arbitre": "Ce rapport est déjà arbitré.",
  "arbitrage-inutile": "Le verdict brut n'est pas indéterminé : rien à arbitrer.",
  confirmation: "Recopiez exactement le numéro du rapport pour confirmer la suppression.",
  "non-purgeable": "Seul un rapport clos ou annulé peut être supprimé.",
};

const COULEURS: Record<string, string> = {
  acquis: "etiquette--ok",
  non_acquis: "etiquette--attention",
  indetermine: "etiquette--obligatoire",
  non_concluant: "etiquette--neutre",
};

function date(iso: string, style: "short" | "long" = "short"): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: style, timeStyle: "short" });
}

/** Qui a porté un visa ou un arbitrage : le libellé du code de session, jamais un nom. */
function profil(v: { role_session: string; libelle_session: string }): string {
  return v.libelle_session || v.role_session;
}

export default async function Rapport({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { id } = await params;
  const p = await searchParams;
  if (!conservationActive()) notFound();
  const r = await lireRapport(id);
  if (!r) notFound();
  const session = (await getSession())!;
  const ctx = await contexteDecision(r);
  const d = ctx.decision;
  const visaTuteur = r.visas.find((v) => v.qualite === "tuteur");
  const visaPharmacien = r.visas.find((v) => v.qualite === "pharmacien");
  const verrouSignalement = ctx.signalementsOuverts.length > 0;
  // Un signalement ouvert peut retirer une question du calcul : on arbitre après.
  const peutArbitrer = ctx.arbitrageRequis && !verrouSignalement;
  const peutViserTuteur =
    r.statut === "emis" && !verrouSignalement && !ctx.arbitrageRequis && d.verdictBrut !== "non_concluant";
  const peutViserPharmacien = r.statut === "vise_tuteur" && !verrouSignalement && session.role === "admin";
  const signatureDuPharmacien = peutViserPharmacien ? await signatureCourante(session.acces) : null;
  const signatureIncrustee = visaPharmacien?.signature_id ? await lireSignature(visaPharmacien.signature_id) : null;
  const message = p.ok ? MESSAGES[p.ok] : p.erreur ? MESSAGES[p.erreur] : null;
  const exclues = new Map(ctx.exclusions.map((e) => [e.questionId, e.motif]));
  const numeroDe = (questionId: string) => r.resultat.detail.findIndex((q) => q.questionId === questionId) + 1;

  const mention = mentionDePreuve(
    {
      numero: r.numero,
      moduleTitre: r.module_titre,
      emisLe: r.emis_le,
      statut: r.statut,
      score: d.score,
      verdict: LIBELLES_COURTS_VERDICT[ctx.verdictFinal],
    },
    { miseEnService: miseEnService() },
  );

  return (
    <>
      <p className="fil">
        <Link href="/admin/rapports">Rapports</Link> › {r.numero}
      </p>
      <section className="panneau-titre">
        <p className="sur-titre">{LIBELLES_STATUT_RAPPORT[r.statut]}</p>
        <h1>{r.numero} — {r.module_titre}</h1>
        <p>
          Agent <code>{r.agent_identifiant}</code> · émis le {date(r.emis_le, "long")} ·{" "}
          {r.tirage} · <strong>{d.score} %</strong> —{" "}
          <span className={`etiquette ${COULEURS[ctx.verdictFinal]}`}>{LIBELLES_COURTS_VERDICT[ctx.verdictFinal]}</span>
        </p>
        <p className="legende" style={{ margin: 0 }}>
          Empreinte SHA-256 du résultat scellé : <code>{r.empreinte}</code>
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href={`/admin/rapports/${r.id}/imprimer`} target="_blank" rel="noreferrer" className="bouton">
            Ouvrir le rapport A4 sans nom (imprimer, PDF)
          </a>
          {r.statut === "clos" && (
            <a href={`/admin/rapports/${r.id}/paquet`} className="bouton bouton--secondaire">
              Paquet d&apos;archivage sans nom (HTML signé, CSV, JSON)
            </a>
          )}
        </div>
        {r.statut === "clos" && (
          <p className="legende" style={{ marginBottom: 0 }}>
            Le paquet se classe au dossier d&apos;habilitation avec le rapport A4 (décision du
            19/09/2026) : il porte le résultat scellé, de sorte que l&apos;empreinte reste vérifiable
            sans le site ni la base.
          </p>
        )}
        <div className="carte" style={{ marginTop: "1rem" }}>
          <p className="legende" style={{ marginTop: 0 }}>
            <strong>Colonne « Outils / Preuve de compétence » de la fiche d&apos;habilitation.</strong>{" "}
            {"texte" in mention
              ? "À recopier dans la cellule du critère concerné. L'empreinte n'y figure pas : elle se lit sur le rapport, retrouvé par son numéro."
              : LIBELLES_REFUS_MENTION[mention.refus]}
          </p>
          {"texte" in mention && <CopierMention texte={mention.texte} />}
        </div>
      </section>

      {message && (
        <p className={`encart ${p.ok ? "encart--ok" : "encart--attention"}`} role="status">{message}</p>
      )}
      {r.statut === "annule" && (
        <p className="encart encart--attention">
          Annulé le {r.annule_le ? date(r.annule_le, "long") : ""} — motif : {r.annule_motif}
        </p>
      )}

      {/* ─────────────────────────────────────────── édition avec le nom */}
      <section className="carte">
        <h3 style={{ marginTop: 0 }}>Éditer avec le nom de l&apos;agent</h3>
        <p className="legende">
          Le site ne connaît l&apos;agent que par l&apos;identifiant <code>{r.agent_identifiant}</code>. Le nom
          saisi ici est porté sur l&apos;édition demandée, avec la mention « hors sceau, non enregistré » :
          il n&apos;est ni conservé en base, ni écrit au journal, ni transmis dans l&apos;adresse. Le paquet
          produit depuis ce formulaire le porte en revanche dans ses fichiers, marqué hors sceau.
          Reportez-vous à la correspondance tenue par le pharmacien responsable.
        </p>
        <form method="post" action={`/admin/rapports/${r.id}/imprimer`} target="_blank">
          <div className="rangee">
            <label className="champ"><span>Nom et prénom</span><input type="text" name="nom" maxLength={120} autoComplete="off" required /></label>
            <label className="champ"><span>Fonction (facultatif)</span><input type="text" name="qualite" maxLength={120} autoComplete="off" placeholder="Préparateur, interne…" /></label>
          </div>
          <div className="actions">
            <button type="submit" className="bouton">Imprimer avec le nom</button>
            {r.statut === "clos" && (
              <button type="submit" className="bouton bouton--secondaire" formAction={`/admin/rapports/${r.id}/paquet`} formTarget="_self">
                Paquet d&apos;archivage avec le nom
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ─────────────────────────────────────────────────────── décision */}
      <div className="section-titre">
        <h2>Décision</h2>
        <span className="compte">{LIBELLES_COURTS_VERDICT[d.verdictBrut]} → {LIBELLES_COURTS_VERDICT[ctx.verdictFinal]}</span>
      </div>
      <section className="carte">
        <h3 style={{ marginTop: 0 }}>{LIBELLES_VERDICT[ctx.verdictFinal]}</h3>
        <p>
          Score <strong>{d.score} %</strong> ({String(d.pointsObtenus).replace(".", ",")} / {d.pointsTotal} points
          {d.nbExclues > 0 ? " comptés" : ""}) · seuil {d.seuil} % · bande de garde {d.bandeBasse} à {d.bandeHaute} %
          {d.echecEliminatoire ? " · éliminatoire manquée" : ""}
          {!d.concluant ? ` · ${d.minQuestions} questions requises pour conclure` : ""}
        </p>
        <p className="legende">Verdict brut : {LIBELLES_COURTS_VERDICT[d.verdictBrut]} — {expliquerVerdict(d)}</p>
        {ctx.arbitrage && (
          <p className="encart encart--ok">
            <strong>Arbitrage du tuteur : {LIBELLES_COURTS_VERDICT[ctx.arbitrage.verdict]}</strong> — {ctx.arbitrage.motif}
            <br />
            <span className="legende">
              {profil(ctx.arbitrage)} · {ctx.arbitrage.role_session} · {date(ctx.arbitrage.le)} · score {ctx.arbitrage.score} %, verdict brut {LIBELLES_COURTS_VERDICT[ctx.arbitrage.verdictBrut]}
            </span>
          </p>
        )}
        {ctx.exclusions.length > 0 && (
          <p className="encart">
            <strong>{ctx.exclusions.length} question{ctx.exclusions.length > 1 ? "s" : ""} exclue{ctx.exclusions.length > 1 ? "s" : ""} du calcul</strong>
            {" — "}
            {ctx.exclusions.map((e) => `n° ${numeroDe(e.questionId)} (${e.motif})`).join(", ")}.
            {" "}
            Score initial {r.resultat.score} % sur {r.resultat.pointsTotal} questions.{" "}
            <span className="legende">
              {ctx.exclusionsFixees ? "Exclusions fixées au premier acte de décision." : "Calculées à l'instant ; elles seront fixées à l'arbitrage ou au visa du tuteur."}
            </span>
          </p>
        )}
        {ctx.retraitsPosterieurs.length > 0 && (
          <p className="encart encart--attention" role="status">
            <strong>Retrait postérieur à la décision :</strong>{" "}
            {ctx.retraitsPosterieurs
              .map((x) => `question n° ${numeroDe(x.questionId)} retirée de la banque le ${date(x.le)}`)
              .join(", ")}
            , après la fixation des exclusions. Score et verdict inchangés : {d.score} %, {LIBELLES_COURTS_VERDICT[ctx.verdictFinal]}.
            {ctx.decisionSiExclues && (
              <>
                {" "}À titre indicatif, {ctx.retraitsPosterieurs.length > 1 ? "exclues aussi" : "exclue aussi"}, le score serait de{" "}
                {ctx.decisionSiExclues.score} % (verdict brut {LIBELLES_COURTS_VERDICT[ctx.decisionSiExclues.verdictBrut]}).
              </>
            )}{" "}
            <span className="legende">
              Le pharmacien responsable vise ou annule en connaissance de cause (décision du 18/09/2026, question 19).
            </span>
          </p>
        )}
        {verrouSignalement && (
          <p className="encart encart--attention">
            <strong>Visas verrouillés :</strong> {ctx.signalementsOuverts.length} signalement{ctx.signalementsOuverts.length > 1 ? "s" : ""} ouvert{ctx.signalementsOuverts.length > 1 ? "s" : ""} sur ce tirage —{" "}
            {ctx.signalementsOuverts.map((s) => `question n° ${numeroDe(s.question_id)} (${s.motif})`).join(", ")}.{" "}
            <Link href="/admin/signalements">Traiter les signalements</Link>. Une question retirée est exclue du calcul.
          </p>
        )}
        {d.verdictBrut === "non_concluant" && r.statut !== "annule" && (
          <p className="encart encart--attention">
            Tirage non concluant : ce rapport ne peut pas entrer au dossier d&apos;habilitation. À annuler avec motif ; l&apos;apprenant repasse un tirage d&apos;habilitation.
          </p>
        )}
      </section>

      {peutArbitrer && (
        <section className="carte">
          <h3>Arbitrage du tuteur</h3>
          <p className="legende">
            Le score est dans la bande de garde : l&apos;outil ne tranche pas seul. Choisissez et motivez ; le verdict brut « indéterminé » reste consigné et imprimé à côté de votre décision. L&apos;arbitrage porte votre profil de session (« {session.libelle} »), jamais un nom.
          </p>
          <form action={actionArbitrerRapport}>
            <input type="hidden" name="id" value={r.id} />
            <fieldset className="choix-difficulte">
              <legend className="champ-titre">Verdict arbitré</legend>
              <label className="option">
                <input type="radio" name="verdict" value="acquis" required />
                <span><strong>Acquis</strong> — le critère est validé pour cette évaluation</span>
              </label>
              <label className="option">
                <input type="radio" name="verdict" value="non_acquis" />
                <span><strong>Non acquis</strong> — reprise du module puis nouveau tirage</span>
              </label>
            </fieldset>
            <label className="champ">
              <span>Motif (obligatoire)</span>
              <textarea name="motif" rows={3} required minLength={10} maxLength={1000} placeholder="Ce qui a fait pencher la décision : questions manquées, mise en situation, observation au poste…" />
            </label>
            <div className="actions"><button type="submit" className="bouton">Enregistrer l&apos;arbitrage</button></div>
          </form>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────── visas */}
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
                <td>{q.objet}{v?.commentaire && v.commentaire !== q.objet ? <><br /><em>{v.commentaire}</em></> : null}</td>
                <td>
                  {v ? (
                    <>
                      {q.qualite === "pharmacien" && signatureIncrustee && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dataUri(signatureIncrustee)} alt={`Signature — ${profil(v)}`} style={{ display: "block", maxHeight: 44, maxWidth: 160 }} />
                      )}
                      {q.qualite === "apprenant" ? <code>{r.agent_identifiant}</code> : profil(v)}
                      <br /><span className="legende">{v.role_session}{q.qualite === "apprenant" && v.libelle_session ? ` · ${v.libelle_session}` : ""}</span>
                    </>
                  ) : <span className="legende">en attente</span>}
                </td>
                <td>{v ? date(v.signe_le) : ""}</td>
                <td>{v ? <code>{v.empreinte.slice(0, 12)}</code> : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {peutViserTuteur && (
        <section className="carte">
          <h3>Visa du tuteur (N3)</h3>
          <p className="legende">
            Prend connaissance du résultat avant l&apos;entrée en compagnonnage au poste. Le visa porte votre profil de session (« {session.libelle} »), la date et l&apos;empreinte du rapport ; il fixe les questions exclues du calcul. <strong>Vérifiez que l&apos;identifiant {r.agent_identifiant} est bien celui de l&apos;agent évalué</strong> : un rapport mal rattaché s&apos;annule.
          </p>
          <form action={actionViserRapport}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="qualite" value="tuteur" />
            <label className="champ"><span>Commentaire (facultatif)</span><input type="text" name="commentaire" maxLength={500} /></label>
            <div className="actions"><button type="submit" className="bouton">Apposer le visa tuteur</button></div>
          </form>
        </section>
      )}
      {r.statut === "emis" && !peutViserTuteur && !verrouSignalement && ctx.arbitrageRequis && (
        <p className="encart">Le visa du tuteur attend l&apos;arbitrage ci-dessus.</p>
      )}

      {peutViserPharmacien && (
        <section className="carte">
          <h3>Visa du pharmacien responsable</h3>
          <p className="legende">Accuse réception de la preuve de l&apos;étape 2 pour le dossier d&apos;habilitation. Il ne prononce pas l&apos;habilitation (chapitre IV de la fiche). Il clôt le rapport et porte votre profil de session (« {session.libelle} »).</p>
          {signatureDuPharmacien ? (
            <p className="legende">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUri(signatureDuPharmacien)} alt="Votre signature" style={{ display: "block", maxHeight: 44, maxWidth: 160, marginBottom: ".25rem" }} />
              Votre signature déposée sera incrustée dans le rapport.
            </p>
          ) : (
            <p className="encart encart--attention">
              Aucune signature déposée pour votre code : le visa sera porté sans image. <Link href="/admin/signature">Déposer une signature</Link>.
            </p>
          )}
          <form action={actionViserRapport}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="qualite" value="pharmacien" />
            <label className="champ"><span>Commentaire (facultatif)</span><input type="text" name="commentaire" maxLength={500} /></label>
            <div className="actions"><button type="submit" className="bouton">Apposer le visa pharmacien et clore</button></div>
          </form>
        </section>
      )}
      {r.statut === "vise_tuteur" && Boolean(visaTuteur) && !visaPharmacien && session.role !== "admin" && (
        <p className="encart">Le visa du pharmacien responsable demande un code d&apos;administration.</p>
      )}

      {/* ──────────────────────────────────────────────────────── synthèse */}
      <div className="section-titre">
        <h2>Synthèse</h2>
        <span className="compte">{r.resultat.detail.length} questions</span>
      </div>
      <table className="tableau">
        <thead><tr><th>N°</th><th>Format</th><th>Énoncé</th><th>Résultat</th><th>Points</th></tr></thead>
        <tbody>
          {r.resultat.detail.map((q, i) => {
            const exclue = exclues.has(q.questionId);
            return (
              <tr key={q.questionId} style={exclue ? { opacity: 0.6 } : undefined}>
                <td>{i + 1}</td>
                <td>{q.type}{q.eliminatoire ? " · élim." : ""}</td>
                <td>{q.enonce}</td>
                <td>
                  {q.correct ? "exact" : q.type === "QIM" ? `${q.discordances} discordance(s)` : q.type === "SCH" ? `${q.discordances} légende(s) en écart` : "erroné"}
                  {exclue ? <><br /><span className="legende">exclue du calcul</span></> : null}
                </td>
                <td>{exclue ? "—" : String(q.note).replace(".", ",")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {session.role === "admin" && r.statut !== "annule" && (
        <section className="carte">
          <h3>Annuler ce rapport</h3>
          <p className="legende">Un rapport annulé reste en base, avec son motif ; l&apos;apprenant en émet un nouveau. C&apos;est aussi la voie pour un rapport émis sous un mauvais identifiant.</p>
          <form action={actionAnnulerRapport}>
            <input type="hidden" name="id" value={r.id} />
            <label className="champ"><span>Motif</span><input type="text" name="motif" required maxLength={500} /></label>
            <div className="actions"><button type="submit" className="bouton bouton--secondaire">Annuler le rapport</button></div>
          </form>
        </section>
      )}

      {session.role === "admin" && (r.statut === "clos" || r.statut === "annule") && (
        <section className="carte">
          <h3>Supprimer définitivement ce rapport</h3>
          <p className="legende">
            Purge manuelle, sans purge automatique (décision du 18/09/2026). Le rapport, ses visas et son
            arbitrage disparaissent de la base ; seul le journal garde le numéro. Téléchargez le paquet
            d&apos;archivage avant, si le dossier qualité doit le conserver.
          </p>
          <form action={actionPurgerRapport}>
            <input type="hidden" name="id" value={r.id} />
            <label className="champ">
              <span>Recopiez le numéro {r.numero} pour confirmer</span>
              <input type="text" name="confirmation" required maxLength={20} autoComplete="off" />
            </label>
            <div className="actions"><button type="submit" className="bouton bouton--secondaire">Supprimer définitivement</button></div>
          </form>
        </section>
      )}
    </>
  );
}
