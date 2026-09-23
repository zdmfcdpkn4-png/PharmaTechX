import Link from "next/link";
import { composerProgramme, comptesQuestionsBase, getModule, getParcours, getTousModulesAvecDeposes } from "@/content/store";
import { miseEnService, modeConservation, procedureReference } from "@/lib/config";
import { baseConfiguree, depotsGeneraux } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dernierEnCours, rattachement } from "@/lib/progression";
import { questionsRenseignees } from "@/content/en-cours";
import { lireModuleDepose } from "@/content/modules-db";
import { Reprendre, type EtapeReprise } from "@/components/Reprendre";
import { Progression } from "@/components/Progression";
import { blocsCompetence, criteres } from "@/content/habilitation";
import { getReferentiel } from "@/content/referentiel-db";
import { badgeEffectif } from "@/content/badges";
import type { Module, TypeParcours } from "@/content/types";
import { TableauDeBord, type DocumentResume, type ModuleResume, type ProgrammeALaCarte } from "@/components/TableauDeBord";
import { listerProgrammes, programmeDuCode } from "@/content/programmes-db";
import { MENTION_DEGRADE, lireIdProgramme, modulesDuProgramme, type Programme } from "@/content/programmes";

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
    badge: badgeEffectif(m.badge, m.titre, m.objectif),
  };
}

export default async function Accueil({
  searchParams,
}: {
  searchParams: Promise<{ parcours?: string; programme?: string; progression?: string; premiere?: string; minutes?: string }>;
}) {
  const params = await searchParams;
  const parcoursId: TypeParcours =
    params.parcours === "maintien" ? "maintien" : "integration";
  const parcours = getParcours(parcoursId)!;
  const conservation = modeConservation();
  const { filieres, niveaux } = await getReferentiel();
  const [enBase, programme, session, ratt, programmesValides] = await Promise.all([
    comptesQuestionsBase(),
    composerProgramme(parcoursId),
    getSession(),
    conservation === "pseudonyme" ? rattachement() : Promise.resolve(null),
    baseConfiguree() ? listerProgrammes("valide").catch((): Programme[] => []) : Promise.resolve<Programme[]>([]),
  ]);

  // Programme à la carte (question 50) : demandé dans l'adresse, ou porté par
  // le code de poste de la session quand aucun parcours n'est demandé. Seul un
  // programme validé s'ouvre ; sinon le poste suit la fiche, et l'écran le dit.
  const idDemande = lireIdProgramme(params.programme);
  const idDuCode =
    !idDemande && !params.parcours && session?.acces && baseConfiguree()
      ? await programmeDuCode(session.acces).catch(() => null)
      : null;
  const idVise = idDemande ?? idDuCode;
  const programmeOuvert = idVise ? (programmesValides.find((x) => x.id === idVise) ?? null) : null;
  const programmeIndisponible = Boolean(idVise && !programmeOuvert);
  let aLaCarte: ProgrammeALaCarte | null = null;
  if (programmeOuvert) {
    const catalogue = await getTousModulesAvecDeposes({ publiesSeulement: true });
    const { presents, absents } = modulesDuProgramme(programmeOuvert, catalogue);
    aLaCarte = {
      id: programmeOuvert.id,
      nom: programmeOuvert.nom,
      destinataire: programmeOuvert.destinataire,
      motif: programmeOuvert.motif,
      validePar: programmeOuvert.validePar,
      valideLe: programmeOuvert.valideLe
        ? new Date(programmeOuvert.valideLe).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
        : null,
      modules: presents.map((m) => resumer(m, enBase)),
      absents: absents.length,
    };
  }
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

  // « Reprendre ma formation » (22/09/2026) : le programme de référence est
  // celui qui s'affiche à l'arrivée — le programme à la carte, ou le socle et
  // la filière du code de poste, au niveau du code — dans l'ordre de la fiche.
  const auNiveau = (liste: ModuleResume[]) =>
    niveauInitial ? liste.filter((m) => m.niveaux.includes(niveauInitial)) : liste;
  const etape = (m: ModuleResume): EtapeReprise => ({
    id: m.id,
    titre: m.titre,
    evaluable: m.nbQuestions > 0,
    redige: m.redige,
    badge: m.badge,
  });
  const programmeArrivee: EtapeReprise[] = (
    aLaCarte ? aLaCarte.modules : [...auNiveau(troncCommun), ...auNiveau(filiereInitiale ? (parPoste[filiereInitiale] ?? []) : [])]
  ).map(etape);
  const catalogue: EtapeReprise[] = [...troncCommun, ...Object.values(parPoste).flat(), ...(aLaCarte?.modules ?? [])].map(etape);
  // Évaluation laissée en plan : seul un agent rattaché en a une, gardée en base.
  const enCours = ratt ? await dernierEnCours(ratt.agentId).catch(() => null) : null;
  const evaluationEnCours = enCours
    ? {
        moduleId: enCours.moduleId,
        titre:
          getModule(enCours.moduleId)?.titre ??
          (await lireModuleDepose(enCours.moduleId).catch(() => null))?.titre ??
          enCours.moduleId,
        detail: `${questionsRenseignees(enCours.etat)} sur ${enCours.etat.questionIds.length} questions`,
      }
    : null;

  return (
    <>
      {/* ───────────────────────────────────────────────────────── héros */}
      <section className="panneau-titre">
        <p className="sur-titre">
          Étapes 1 et 2 sur 6 —{" "}
          {programmeOuvert
            ? `programme à la carte « ${programmeOuvert.nom} » · ${MENTION_DEGRADE}`
            : parcours.titre.toLowerCase()}
        </p>
        <h1>Se former, puis prouver ce qu&apos;on sait faire</h1>
        <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>
          {programmeOuvert
            ? `Programme composé à la main pour un profil qui ne suit pas la fiche${programmeOuvert.destinataire ? ` : ${programmeOuvert.destinataire}` : ""}.`
            : parcours.description}
        </p>
        {/* Tableau de bord (22/09/2026) : reprendre là où l'on s'est arrêté,
            et les modules consultés sur ce poste. « Comment fonctionne
            l'habilitation » a quitté cette rangée : l'avertissement juste
            en dessous mène au même endroit. */}
        <Reprendre
          evaluation={evaluationEnCours}
          programme={programmeArrivee}
          catalogue={catalogue}
          requete={aLaCarte ? `?programme=${aLaCarte.id}` : ""}
        />
        <div className="actions" style={{ marginTop: 0 }}>
          <a href="#modules" className="bouton bouton--secondaire">
            Voir mes modules
          </a>
        </div>
        <p className="avertissement-hero">
          <strong>Valider un module à l&apos;écran ne vaut pas habilitation.</strong> Ce site
          couvre les étapes 1 et 2 sur 6 ; les quatre suivantes se déroulent au poste de
          travail et devant le pharmacien responsable —{" "}
          <Link href="/reperes#dispositif">le dispositif en détail</Link>.
        </p>
        <p className="mentions-hero">
          {rediges.length} critère{rediges.length > 1 ? "s" : ""} évaluable{rediges.length > 1 ? "s" : ""} sur {criteres.length}
        </p>
      </section>

      <nav className="nav-sections" aria-label="Choix du parcours">
        <Link
          href="/?parcours=integration"
          className={`bouton bouton--compact ${!programmeOuvert && parcoursId === "integration" ? "" : "bouton--discret"}`}
        >
          Intégration
        </Link>
        <Link
          href="/?parcours=maintien"
          className={`bouton bouton--compact ${!programmeOuvert && parcoursId === "maintien" ? "" : "bouton--discret"}`}
        >
          Maintien d&apos;habilitation
        </Link>
        {programmesValides.map((x) => (
          <Link
            key={x.id}
            href={`/?programme=${x.id}`}
            className={`bouton bouton--compact ${programmeOuvert?.id === x.id ? "" : "bouton--discret"}`}
            aria-label={`${x.nom}, programme à la carte, ${MENTION_DEGRADE}`}
          >
            {x.nom} <span className="etiquette etiquette--attention">dégradé</span>
          </Link>
        ))}
      </nav>
      {programmeIndisponible && (
        <p className="encart encart--attention" role="status">
          {idDemande
            ? "Ce programme à la carte n'est pas validé, ou a été retiré : le parcours de la fiche est affiché."
            : "Le programme à la carte de ce code de poste n'est plus validé : le parcours de la fiche est affiché. Signalez-le à votre tuteur."}
        </p>
      )}

      {/* ──────────────────────────────────────────────────── mes modules */}
      <section id="modules" className="section">
        <h2>Mes modules</h2>
        <p className="section-intro">{programmeOuvert ? `Programme à la carte — ${MENTION_DEGRADE}.` : `${parcours.destinataire}.`}</p>
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
          parcoursTitre={programmeOuvert ? `Programme à la carte « ${programmeOuvert.nom} »` : parcours.titre}
          aLaCarte={aLaCarte}
          conservation={conservation}
          procedure={procedureReference()}
          miseEnService={miseEnService()}
          documents={documents}
          filiereInitiale={filiereInitiale}
          niveauInitial={niveauInitial}
          identifiantRattache={ratt?.identifiant ?? null}
          documentsReserves={documentsReserves}
          essai={Boolean(session?.essai)}
        />
      </section>

      {conservation === "pseudonyme" && baseConfiguree() && (
        <Progression
          rattache={ratt}
          message={params.progression}
          premiere={params.premiere}
          minutes={params.minutes}
          essai={Boolean(session?.essai)}
        />
      )}

    </>
  );
}
