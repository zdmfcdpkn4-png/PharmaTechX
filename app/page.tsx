import Link from "next/link";
import { composerProgramme, comptesQuestionsBase, getParcours } from "@/content/store";
import { miseEnService, modeConservation, procedureReference } from "@/lib/config";
import { baseConfiguree, depotsGeneraux } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rattachement } from "@/lib/progression";
import { Progression } from "@/components/Progression";
import { blocsCompetence, criteres } from "@/content/habilitation";
import { getReferentiel } from "@/content/referentiel-db";
import type { Module, TypeParcours } from "@/content/types";
import { TableauDeBord, type DocumentResume, type ModuleResume } from "@/components/TableauDeBord";

function resumer(m: Module, enBase: Record<string, number>): ModuleResume {
  return {
    id: m.id,
    titre: m.titre,
    objectif: m.objectif,
    bloc: typeof m.bloc === "number" ? String(m.bloc) : m.bloc,
    critereId: m.critereId,
    affectation: m.affectation,
    postes: m.postes,
    niveaux: m.niveaux,
    dureeMinutes:
      typeof m.dureeMinutes === "number" ? `${m.dureeMinutes}` : m.dureeMinutes,
    redige: m.redige,
    nbQuestions:
      m.questions.length +
      m.misesEnSituation.reduce((s, x) => s + x.questions.length, 0) +
      (enBase[m.id] ?? 0),
    nbSituations: m.misesEnSituation.length,
    periodiciteMois:
      typeof m.periodiciteMois === "number"
        ? `${m.periodiciteMois}`
        : m.periodiciteMois,
    origine: m.origine ?? "code",
  };
}

export default async function Accueil({
  searchParams,
}: {
  searchParams: Promise<{ parcours?: string; progression?: string; premiere?: string; minutes?: string }>;
}) {
  const params = await searchParams;
  const parcoursId: TypeParcours =
    params.parcours === "maintien" ? "maintien" : "integration";
  const parcours = getParcours(parcoursId)!;
  const conservation = modeConservation();
  const { filieres, niveaux } = await getReferentiel();
  const [enBase, programme, session, ratt] = await Promise.all([
    comptesQuestionsBase(),
    composerProgramme(parcoursId),
    getSession(),
    conservation === "pseudonyme" ? rattachement() : Promise.resolve(null),
  ]);
  // Un code de poste porte sa filière et son niveau : le programme s'ouvre dessus.
  const filiereInitiale = filieres.some((f) => f.id !== "socle" && f.id === session?.filiere) ? session!.filiere! : "";
  const niveauInitial = niveaux.some((n) => n.code === session?.niveau) ? session!.niveau! : "";

  const troncCommun = programme.troncCommun.map((m) => resumer(m, enBase));
  const parPoste: Record<string, ModuleResume[]> = {};
  for (const f of filieres) {
    if (f.id === "socle") continue;
    parPoste[f.id] = (programme.parFiliere[f.id] ?? []).map((m) => resumer(m, enBase));
  }
  // Documents généraux, proposés par profil (filières, niveaux) — question 10 ;
  // réservés aux sessions ouvertes par un code — question 13, choix b.
  const generaux = baseConfiguree() ? await depotsGeneraux().catch(() => []) : [];
  const documents: DocumentResume[] = session
    ? generaux.map((d) => ({
        id: d.id,
        titre: d.titre,
        nature: d.nature,
        url: d.url,
        filieres: d.filieres,
        niveaux: d.niveaux,
      }))
    : [];
  const documentsReserves = session ? 0 : generaux.length;

  const rediges = [...troncCommun, ...Object.values(parPoste).flat()].filter(
    (m) => m.redige || m.nbQuestions > 0,
  );

  return (
    <>
      {/* ───────────────────────────────────────────────────────── héros */}
      <section className="panneau-titre">
        <p className="sur-titre">
          Étapes 1 et 2 sur 6 — {parcours.titre.toLowerCase()}
        </p>
        <h1>Se former, puis prouver ce qu&apos;on sait faire</h1>
        <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>
          {parcours.description}
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href="#modules" className="bouton">
            Voir mes modules
          </a>
          <Link href="/reperes#dispositif" className="bouton bouton--secondaire">
            Comment fonctionne l&apos;habilitation
          </Link>
        </div>
        <p className="avertissement-hero">
          <strong>Valider un module à l&apos;écran ne vaut pas habilitation.</strong> Ce site
          couvre les étapes 1 et 2 sur 6 ; les quatre suivantes se déroulent au poste de
          travail et devant le pharmacien responsable —{" "}
          <Link href="/reperes#dispositif">le dispositif en détail</Link>.
        </p>
        <p className="mentions-hero">
          Aucun compte nominatif · {conservation === "pseudonyme" ? "rapports enregistrés sur émission, sous identifiant" : "résultats non conservés"} · {rediges.length}{" "}
          critère{rediges.length > 1 ? "s" : ""} évaluable{rediges.length > 1 ? "s" : ""} sur {criteres.length}
        </p>
      </section>

      <nav className="nav-sections" aria-label="Choix du parcours">
        <Link
          href="/?parcours=integration"
          className={`bouton bouton--compact ${parcoursId === "integration" ? "" : "bouton--discret"}`}
        >
          Intégration
        </Link>
        <Link
          href="/?parcours=maintien"
          className={`bouton bouton--compact ${parcoursId === "maintien" ? "" : "bouton--discret"}`}
        >
          Maintien d&apos;habilitation
        </Link>
      </nav>

      {/* ──────────────────────────────────────────────────── mes modules */}
      <section id="modules" className="section">
        <h2>Mes modules</h2>
        <p className="section-intro">{parcours.destinataire}.</p>
        <TableauDeBord
          troncCommun={troncCommun}
          parPoste={parPoste}
          postes={filieres
            .filter((f) => f.id !== "socle")
            .map((f) => ({
              id: f.id,
              libelle: f.libelle,
              niveauxRequis: f.niveaux,
            }))}
          niveaux={niveaux.map((n) => ({
            code: n.code,
            libelle: n.libelle,
            filiere: n.filiere,
          }))}
          blocs={blocsCompetence.map((b) => ({
            numero: String(b.numero),
            titre: b.titre,
          }))}
          parcoursTitre={parcours.titre}
          conservation={conservation}
          procedure={procedureReference()}
          miseEnService={miseEnService()}
          documents={documents}
          filiereInitiale={filiereInitiale}
          niveauInitial={niveauInitial}
          identifiantRattache={ratt?.identifiant ?? null}
          documentsReserves={documentsReserves}
        />
      </section>

      {conservation === "pseudonyme" && baseConfiguree() && (
        <Progression rattache={ratt} message={params.progression} premiere={params.premiere} minutes={params.minutes} />
      )}

    </>
  );
}
