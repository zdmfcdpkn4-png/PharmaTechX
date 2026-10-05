import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PARCOURS_DE_L_AGENT,
  getModuleComplet,
  modulesAvecQuestions,
  positionDansListe,
  positionDansParcours,
  positionDansProfil,
  positionDansProgramme,
  type Ouvert,
} from "@/content/store";
import { lireIdProgramme } from "@/content/programmes";
import { requeteProfil } from "@/content/ordres";
import { accesLibre, fermetureDeLaPage, profilDeLaPage, profilImpose } from "@/lib/profil-impose";
import { programmeDuPoste } from "@/lib/programme-poste";
import { HorsProgramme } from "@/components/HorsProgramme";
import { getCritere } from "@/content/habilitation";
import { listeBlocs } from "@/content/blocs-db";
import { A_PRECISER, libelleNature } from "@/content/types";
import { baseConfiguree, compterDepotsDuModule, depotsDuModule } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rattachement } from "@/lib/progression";
import { STATUTS_MODULE } from "@/content/modules-db";
import { Corps } from "@/components/Corps";
import { Badge } from "@/components/Badge";
import { badgeEffectif } from "@/content/badges";
import { LectureModule } from "@/components/LectureModule";
import { NoterConsultation } from "@/components/NoterConsultation";
import { conservationActive } from "@/lib/config";
import { SEUILS_STAT, bilanModule } from "@/lib/statistiques";
import { lireComplements } from "@/lib/complements-db";
import { MARQUEUR_TEXTE, cleRessource, cleTexte } from "@/content/complements";
import { ACompleter } from "@/components/ACompleter";
import { lireEssais } from "@/lib/statistiques-db";

export const dynamic = "force-dynamic";

export default async function PageModule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ programme?: string; parcours?: string; filiere?: string; niveau?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Un module déposé non publié n'est lisible qu'en tutorat ou en administration.
  const session = await getSession();
  const mod = await getModuleComplet(id, { inclureBrouillons: session?.role === "tuteur" || session?.role === "admin" });
  if (!mod) notFound();
  // Question 101 (choix b) : hors de son programme, un code de poste n'ouvre ni la page d'un module ni ses
  // documents ; hors du parcours que le tutorat lui a fixé, ou sur un module qu'il tient fermé, pas davantage
  // (question 103, choix a). Un apprenant — code de poste, mode test, site sans base — n'ouvre qu'un module
  // qui a des questions (05/10/2026, demande directe). La page dit pourquoi, sans rien servir du module.
  const impose = profilImpose(session, baseConfiguree());
  const duPoste = impose && session ? await programmeDuPoste(session, impose) : null;
  const libre = accesLibre(session);
  const nbQuestions = mod.questions.length + mod.misesEnSituation.reduce((s, x) => s + x.questions.length, 0);
  const ferme = fermetureDeLaPage(duPoste, { libre, moduleId: mod.id, nbQuestions });
  if (ferme) return <HorsProgramme titre={mod.titre} motif={ferme} />;
  const depose = mod.origine === "base";

  const critere = typeof mod.critereId === "string" ? getCritere(mod.critereId) : undefined;
  // Bloc servi (question 81) : un bloc corrigé ou ajouté se lit sous son titre du moment.
  const bloc = typeof mod.bloc === "number" ? (await listeBlocs()).find((b) => b.numero === mod.bloc) : undefined;
  const nbElim =
    mod.questions.filter((q) => q.eliminatoire).length +
    mod.misesEnSituation.reduce((s, x) => s + x.questions.filter((q) => q.eliminatoire).length, 0);
  // Documents déposés réservés aux sessions ouvertes par un code (question 13, choix b).
  const depots = baseConfiguree() && session ? await depotsDuModule(mod.id).catch(() => []) : [];
  const reserves = baseConfiguree() && !session ? await compterDepotsDuModule(mod.id).catch(() => 0) : 0;
  // Renseignés dans Réglages › À compléter (02/10/2026) : les données locales du texte d'un module rédigé,
  // et ses documents « à rattacher » — leur référence, et le document déposé choisi, qui quitte alors la
  // liste des autres documents.
  const renseignes: Awaited<ReturnType<typeof lireComplements>> =
    mod.ressources.some((r) => !r.url) || (!depose && mod.sections.some((s) => s.corps.includes(MARQUEUR_TEXTE)))
      ? await lireComplements()
      : {};
  // Chaque [à préciser] du texte, dans l'ordre de lecture, a sa clé ; un module déposé garde ses encadrés.
  let rangTexte = 0;
  const marqueursSections = mod.sections.map((s) =>
    depose
      ? undefined
      : Array.from({ length: s.corps.split(MARQUEUR_TEXTE).length - 1 }, () => {
          const cle = cleTexte(mod.id, ++rangTexte);
          return { cle, valeur: renseignes[cle]?.texte ?? null };
        }),
  );
  const etatRessource = (r: (typeof mod.ressources)[number]) => {
    const v = r.url ? undefined : renseignes[cleRessource(mod.id, r.id)];
    const lien = r.url ?? depots.find((d) => d.id === v?.document)?.url ?? null;
    return { lien, reference: v?.texte ?? "", fait: Boolean(lien || v?.texte) };
  };
  const pris = new Set(mod.ressources.map((r) => (r.url ? null : renseignes[cleRessource(mod.id, r.id)]?.document)));
  const autresDepots = depots.filter((d) => !pris.has(d.id));
  const aRattacher = mod.ressources.filter((r) => !etatRessource(r).fait).length;
  // Entré par un programme à la carte (question 50) : on enchaîne dans son
  // ordre, et chaque lien garde le programme ; sinon, le parcours d'intégration.
  // Profil imposé (05/10/2026, `lib/profil-impose.ts`) : pour un code de poste, le programme et le profil sont
  // ceux du code ; l'adresse ne garde que le parcours.
  const idProgramme = duPoste ? duPoste.idProgramme : lireIdProgramme(sp.programme);
  // Le précédent et le suivant d'un apprenant sautent les modules qui ne lui sont pas ouverts.
  const ouvrir = (ids: Set<string>): Ouvert => (m) => ids.has(m.id);
  const ouvert = libre ? undefined : ouvrir(duPoste ? duPoste.ouverts : await modulesAvecQuestions());
  // Parcours fixé à l'agent par le tutorat (question 103, choix a) : le précédent et le suivant se prennent
  // dans son ordre, avant tout autre ; l'adresse n'a rien à garder.
  const dansParcours = duPoste?.parcours ? positionDansListe(duPoste.parcours.modules, mod.id, ouvert, PARCOURS_DE_L_AGENT) : null;
  const dansProgramme = idProgramme && !dansParcours ? await positionDansProgramme(idProgramme, mod.id, ouvert) : null;
  // Entré par un profil qui a son ordre (question 55) : on enchaîne dans sa
  // chronologie — celle de l'apprenant rattaché, s'il a la sienne (question 56).
  const profil = dansParcours || dansProgramme ? null : profilDeLaPage(impose, sp);
  const ratt = profil ? await rattachement() : null;
  const dansProfil = profil
    ? await positionDansProfil(profil.parcours, profil.filiere, profil.niveau, mod.id, ratt?.agentId ?? null, ouvert)
    : null;
  // Pour un code de poste, le précédent et le suivant se prennent dans son programme (question 101, choix b).
  const position =
    dansParcours ??
    dansProgramme ??
    dansProfil ??
    (duPoste
      ? positionDansListe(duPoste.parParcours[sp.parcours === "maintien" ? "maintien" : "integration"], mod.id, ouvert)
      : await positionDansParcours("integration", mod.id, ouvert));
  // Le profil suit de page en page, même sans ordre propre : son niveau est le niveau cible du tirage (question 62).
  const requete = dansProgramme ? `?programme=${idProgramme}` : profil ? requeteProfil(profil) : "";
  const sommaire = mod.sections.map((s, i) => ({ id: `section-${i + 1}`, titre: s.titre }));
  // Statistiques de réussite (question 78) : un repère pour le tutorat et l'administration, jamais pour l'apprenant.
  const stat =
    (session?.role === "tuteur" || session?.role === "admin") && baseConfiguree() && conservationActive()
      ? bilanModule(mod.id, mod.titre, await lireEssais([mod.id]).catch(() => []))
      : null;

  const contenu = (
    <>
      {mod.sections.length > 0 && (
        <div className="corps-module">
          {mod.sections.map((s, i) => (
            <section key={i} id={`section-${i + 1}`} aria-labelledby={`titre-section-${i + 1}`}>
              <p className="sur-titre">Section {i + 1} sur {mod.sections.length}</p>
              <h2 id={`titre-section-${i + 1}`} tabIndex={-1}>{s.titre}</h2>
              <Corps texte={s.corps} marqueurs={marqueursSections[i]} admin={session?.role === "admin"} />
              {s.references && s.references.length > 0 && (
                <details className="sources">
                  <summary>Sources de cette section</summary>
                  <ul>
                    {s.references.map((r, j) => (
                      <li key={j}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer">
                            {r.source} — {r.libelle}
                          </a>
                        ) : (
                          <>
                            {r.source} — {r.libelle}
                          </>
                        )}
                        {r.localisation ? ` · ${r.localisation}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </div>
      )}

      {(mod.ressources.length > 0 || autresDepots.length > 0 || reserves > 0) && (
        <section className="carte" style={{ marginTop: "1.5rem" }}>
          <div className="section-titre" style={{ marginTop: 0 }}>
            <h2>Documents rattachés</h2>
            <span className="compte">
              {mod.ressources.length + autresDepots.length + reserves}
              {aRattacher > 0 ? ` · ${aRattacher} encore à rattacher` : ""}
            </span>
          </div>
          {reserves > 0 && (
            <p className="encart" style={{ marginTop: 0 }}>
              {reserves} document{reserves > 1 ? "s" : ""} déposé{reserves > 1 ? "s" : ""} réservé{reserves > 1 ? "s" : ""} aux sessions
              ouvertes par un code : <Link href="/connexion">connectez-vous</Link> avec votre code de poste pour les lire.
            </p>
          )}
          <ul className="liste-nue">
            {autresDepots.map((d) => (
              <li key={`d-${d.id}`}>
                <span className="etiquette etiquette--neutre">{libelleNature(d.nature)}</span>{" "}
                <a href={d.url} target="_blank" rel="noreferrer">
                  {d.titre}
                </a>{" "}
                <span className="legende">— déposé le {new Date(d.depose_le).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
            {mod.ressources.map((r) => {
              const { lien, reference, fait } = etatRessource(r);
              return (
                <li key={r.id} className={fait ? "" : "est-vide"}>
                  <span className="etiquette etiquette--neutre">{libelleNature(r.nature)}</span>{" "}
                  {lien ? (
                    <a href={lien} target="_blank" rel="noreferrer">
                      {r.titre}
                    </a>
                  ) : (
                    r.titre
                  )}
                  {reference && <span className="legende"> — {reference}</span>}
                  {!fait && (
                    <>
                      {" "}— <ACompleter cle={cleRessource(mod.id, r.id)} admin={session?.role === "admin"} texte="à rattacher" />{" "}
                      <span className="legende">{r.commentaire ?? "document à déposer"}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="encart" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: ".25rem" }}>
          {nbQuestions > 0
            ? `L'évaluation de ce critère comporte ${nbQuestions} question${nbQuestions > 1 ? "s" : ""}`
            : "Ce critère n'a pas encore d'évaluation"}
        </h2>
        <p style={{ marginBottom: nbQuestions > 0 ? ".75rem" : 0 }}>
          {nbQuestions > 0 ? (
            <>
              QCM, QIM{mod.questions.some((q) => q.type === "SCH") ? ", schémas" : ""}
              {mod.misesEnSituation.length > 0 ? ` et ${mod.misesEnSituation.length} mise${mod.misesEnSituation.length > 1 ? "s" : ""} en situation` : ""}
              {nbElim > 0 ? ` — ${nbElim} question${nbElim > 1 ? "s" : ""} éliminatoire${nbElim > 1 ? "s" : ""}` : ""}.
              Réussir cette évaluation ne vaut pas habilitation : elle constitue la preuve de l&apos;étape 2 sur 6.
            </>
          ) : (
            <>
              Fermé aux apprenants tant qu&apos;aucune question n&apos;est validée. Les tuteurs peuvent en déposer depuis
              l&apos;administration.
            </>
          )}
        </p>
        {position && (
          <p className="legende" style={{ marginBottom: ".75rem" }}>
            Parcours : {position.libelle}, module {position.rang} sur {position.total}
            {position.precedent ? <> · précédent : <Link href={`/module/${position.precedent.id}${requete}`}>{position.precedent.titre}</Link></> : null}
            {position.suivant ? <> · suivant : <Link href={`/module/${position.suivant.id}${requete}`}>{position.suivant.titre}</Link></> : " · dernier de la liste"}
          </p>
        )}
        <div className="actions" style={{ marginTop: 0 }}>
          {nbQuestions > 0 && (
            <Link href={`/module/${mod.id}/evaluation${requete}`} className="bouton">
              Passer l&apos;évaluation
            </Link>
          )}
          {position?.suivant && (
            <Link href={`/module/${position.suivant.id}${requete}`} className="bouton bouton--secondaire">
              Module suivant
            </Link>
          )}
          <Link href={`/${requete}`} className="bouton bouton--secondaire">
            Retour au programme
          </Link>
        </div>
      </section>

      {mod.bibliographie.length > 0 && (
        <div className="references" style={{ marginTop: "2rem" }}>
          <strong>Bibliographie du module</strong>
          <ol>
            {mod.bibliographie.map((r, i) => (
              <li key={i}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.libelle}
                  </a>
                ) : (
                  r.libelle
                )}{" "}
                — {r.source}, {r.date}
                {r.localisation ? ` · ${r.localisation}` : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );

  return (
    <article>
      <NoterConsultation module={mod.id} titre={mod.titre} />
      <p className="fil">
        <Link href={`/${requete}`}>Programme</Link> › {typeof mod.critereId === "string" && mod.critereId !== A_PRECISER ? mod.critereId : mod.titre}
      </p>

      <section className="panneau-titre">
        <ul className="meta-module" style={{ margin: 0 }}>
          {depose ? (
            <li className="etiquette etiquette--site">Module déposé</li>
          ) : null}
          {depose && mod.critereId === A_PRECISER ? null : (
            <li className="etiquette etiquette--code">
              {mod.critereId === A_PRECISER ? <code className="a-preciser">{A_PRECISER}</code> : mod.critereId}
            </li>
          )}
          {critere?.obligatoire && <li className="etiquette etiquette--obligatoire">Obligatoire</li>}
        </ul>
        <div className="titre-vignette">
          <Badge nom={badgeEffectif(mod.badge, mod.titre, mod.objectif)} taille={96} />
          <div>
            <h1>{mod.titre}</h1>
            <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>{mod.objectif}</p>
          </div>
        </div>
        <ul className="meta-module" style={{ margin: 0 }}>
          {mod.sections.length > 0 && (
            <li className="etiquette etiquette--neutre">
              {mod.sections.length} section{mod.sections.length > 1 ? "s" : ""}
              {typeof mod.dureeMinutes === "number" && mod.dureeMinutes > 0 ? ` · ${mod.dureeMinutes} min` : ""}
            </li>
          )}
          {nbQuestions > 0 && (
            <li className="etiquette etiquette--neutre">
              {nbQuestions} question{nbQuestions > 1 ? "s" : ""}
              {mod.misesEnSituation.length > 0 ? ` · ${mod.misesEnSituation.length} mise${mod.misesEnSituation.length > 1 ? "s" : ""} en situation` : ""}
            </li>
          )}
          <li className="etiquette etiquette--neutre">
            Seuil {mod.seuilReussite} %{nbElim > 0 ? ` · ${nbElim} éliminatoire${nbElim > 1 ? "s" : ""}` : ""}
          </li>
          {/* Rejoint les pastilles (question 91) : une rangée de repères au lieu de deux. */}
          <li className="legende">
            {bloc ? `Bloc ${bloc.numero} — ` : ""}
            {mod.affectation === "tronc-commun"
              ? "tronc commun, tous postes"
              : depose
                ? `filière${mod.postes.length > 1 ? "s" : ""} ${mod.postes.join(", ")}`
                : "critère de poste"}
            {mod.niveaux.length > 0 ? ` · niveau${mod.niveaux.length > 1 ? "x" : ""} ${mod.niveaux.join(", ")}` : depose ? " · tous niveaux" : ""}
            {" · "}revalidation {typeof mod.periodiciteMois === "number" ? `${mod.periodiciteMois} mois` : A_PRECISER}
          </li>
        </ul>
      </section>

      {!mod.redige && (
        <p className="encart encart--attention">
          Ce critère est un emplacement ouvert : son contenu de formation reste à rédiger.
          {nbQuestions > 0 ? " Son évaluation, elle, est disponible à partir des questions déposées." : ""}
        </p>
      )}
      {depose && mod.statut !== "publie" && (
        <p className="encart encart--attention">
          Module déposé au statut « {STATUTS_MODULE[mod.statut ?? "brouillon"]} » : visible des tuteurs et
          administrateurs seulement, absent du programme des apprenants.
        </p>
      )}

      {stat && stat.agents > 0 && (
        <p className="encart stat-bandeau">
          <strong>Statistiques</strong> (tutorat et administration) :{" "}
          {stat.premierEssai.taux === null
            ? `${stat.agents} agent${stat.agents > 1 ? "s" : ""} évalué${stat.agents > 1 ? "s" : ""} — un taux à partir de ${SEUILS_STAT.effectif}`
            : `réussite au premier essai ${stat.premierEssai.taux} % (IC 95 % ${stat.premierEssai.bas}–${stat.premierEssai.haut}) sur ${stat.premierEssai.n} agents`}
          {stat.essaisPourReussir !== null && ` · ${String(stat.essaisPourReussir).replace(".", ",")} essai(s) pour réussir`}
          {stat.aRevoir && " · à revoir"}
          {" · "}
          <Link href={`/admin/statistiques/${encodeURIComponent(mod.id)}`}>Voir l&apos;analyse</Link>
        </p>
      )}

      {sommaire.length > 0 ? (
        <LectureModule moduleId={mod.id} moduleTitre={mod.titre} sommaire={sommaire}>
          {contenu}
        </LectureModule>
      ) : (
        contenu
      )}
    </article>
  );
}
