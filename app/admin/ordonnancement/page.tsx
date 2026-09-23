import Link from "next/link";
import { getReferentiel } from "@/content/referentiel-db";
import { modulesDuParcours, modulesDuProfilDeParcours } from "@/content/store";
import {
  lireOrdreAgent,
  lireOrdreProfil,
  listerOrdresAgents,
  listerOrdresProfil,
  type OrdreAgent,
  type OrdreProfil,
} from "@/content/ordres-db";
import { appliquerOrdre, lireProfilDemande, ordreApplicable, requeteProfil } from "@/content/ordres";
import type { Module } from "@/content/types";
import { baseConfiguree } from "@/lib/db";
import { conservationActive } from "@/lib/config";
import { agentParIdentifiant } from "@/lib/agents";
import { etiquetteModule } from "../questions/commun";
import { actionOrdonner } from "@/app/actions";
import { actionOrdonnerApprenant, actionOrdonnerProfil, actionRetirerOrdreApprenant, actionRetirerOrdreProfil } from "./actions";
import { ChoixProfil } from "./choix";
import { ListeOrdonnable, type ElementOrdonnable } from "@/components/ListeOrdonnable";

export const dynamic = "force-dynamic";

/**
 * Ordonnancement (question 55, choix a, 23/09/2026) : un ordre par profil de
 * poste, niveau cible et parcours, sur les seuls modules du profil ; sinon
 * l'ordre général du parcours. Les modules se rangent en glissant, par les
 * flèches ou par leur numéro (`components/ListeOrdonnable.tsx`) ; la saisie
 * d'identifiants séparés par des virgules a disparu. Avec un identifiant
 * d'apprenant (question 56, choix a), c'est son ordre propre sur le profil
 * qu'on range : rattaché, il passe avant celui du profil.
 */

const MESSAGES: Record<string, string> = {
  enregistre: "Ordre général enregistré.",
  profil: "Ordre du profil enregistré : l'accueil de ce profil affiche ses modules numérotés dans cet ordre.",
  retire: "Ordre propre retiré : ce profil suit de nouveau l'ordre général, regroupé par bloc à l'accueil.",
  apprenant: "Ordre de l'apprenant enregistré : rattaché, il voit les modules de ce profil dans cet ordre, avant celui du profil.",
  "apprenant-retire": "Ordre propre retiré : l'apprenant suit de nouveau l'ordre du profil.",
};

const ERREURS: Record<string, string> = {
  profil: "Profil inconnu : choisissez un profil de poste et l'un de ses niveaux.",
  "profil-vide": "Aucun module pour ce profil à ce niveau : rien à ranger.",
  apprenants: "La progression n'est pas conservée sous identifiant : pas d'ordre propre à un apprenant.",
  "apprenant-sans-profil":
    "Choisissez aussi le profil de poste et le niveau de l'apprenant : son ordre porte sur les modules de ce profil.",
  "apprenant-inconnu": "Identifiant d'apprenant inconnu.",
  "apprenant-clos": "Identifiant clos : il ne se rattache plus, un ordre propre ne lui servirait pas.",
};

const PARCOURS = { integration: "Intégration", maintien: "Maintien d'habilitation" } as const;

function element(m: Module, mention?: string): ElementOrdonnable {
  return {
    id: m.id,
    titre: m.titre,
    code: etiquetteModule(m),
    mention: mention ?? (m.affectation === "tronc-commun" ? "socle" : undefined),
  };
}

function date(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
}

export default async function Ordonnancement({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; parcours?: string; filiere?: string; niveau?: string; agent?: string }>;
}) {
  const sp = await searchParams;
  const parcoursId = sp.parcours === "maintien" ? "maintien" : "integration";
  const { filieres, niveaux } = await getReferentiel();
  const postes = filieres
    .filter((f) => f.id !== "socle")
    .map((f) => ({
      id: f.id,
      libelle: f.libelle,
      niveaux: f.niveaux.map((code) => ({ code, libelle: niveaux.find((n) => n.code === code)?.libelle ?? code })),
    }));
  const demande = lireProfilDemande(sp);
  const poste = demande ? postes.find((p) => p.id === demande.filiere) : undefined;
  const niveau = poste && demande ? poste.niveaux.find((n) => n.code === demande.niveau) : undefined;
  const profil = demande && poste && niveau ? demande : null;
  const profilInconnu = Boolean(sp.filiere) && !profil;

  // Ordre propre à un apprenant (question 56) : identifiant connu et actif, sur un profil.
  const apprenants = conservationActive() && baseConfiguree();
  const agentSaisi = typeof sp.agent === "string" ? sp.agent.trim().slice(0, 20) : "";
  const agent = apprenants && agentSaisi && profil ? await agentParIdentifiant(agentSaisi).catch(() => null) : null;
  const erreurApprenant = !agentSaisi
    ? null
    : !apprenants
      ? "apprenants"
      : !profil
        ? profilInconnu
          ? null
          : "apprenant-sans-profil"
        : !agent
          ? "apprenant-inconnu"
          : !agent.actif
            ? "apprenant-clos"
            : null;
  const apprenant = agent && agent.actif && !erreurApprenant ? agent : null;

  const [ordres, ordresAgents, ordre, ordreAgent] = await Promise.all([
    baseConfiguree() ? listerOrdresProfil().catch((): OrdreProfil[] => []) : Promise.resolve<OrdreProfil[]>([]),
    apprenants ? listerOrdresAgents().catch((): OrdreAgent[] => []) : Promise.resolve<OrdreAgent[]>([]),
    profil && baseConfiguree()
      ? lireOrdreProfil(profil.filiere, profil.niveau, profil.parcours).catch(() => null)
      : Promise.resolve(null),
    profil && apprenant
      ? lireOrdreAgent(apprenant.id, profil.filiere, profil.niveau, profil.parcours).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Liste à ranger : les modules du profil — ceux que l'ordre en vigueur nomme,
  // puis ceux entrés depuis, signalés —, ou tous ceux du parcours pour l'ordre
  // général. Pour un apprenant, l'ordre en vigueur est le sien, sinon celui du profil.
  let elements: ElementOrdonnable[] = [];
  if (profil && !erreurApprenant) {
    const modules = await modulesDuProfilDeParcours(profil.parcours, profil.filiere, profil.niveau);
    const base = apprenant ? ordreApplicable(ordreAgent?.modules, ordre?.modules)?.ordre : ordre?.modules;
    if (base) {
      const { ranges, nouveaux } = appliquerOrdre(modules, base);
      elements = [...ranges.map((m) => element(m)), ...nouveaux.map((m) => element(m, "nouveau, à ranger"))];
    } else {
      elements = modules.map((m) => element(m));
    }
  } else if (!profilInconnu && !erreurApprenant) {
    elements = (await modulesDuParcours(parcoursId)).map((m) => element(m));
  }
  const libelleProfil = profil && poste && niveau ? `${poste.libelle} · ${niveau.libelle}` : "";

  return (
    <>
      <section className="panneau-titre">
        <h1>Ordonnancement des modules</h1>
        <p>
          Choisissez un profil de poste, son niveau cible et le parcours : seuls les modules de ce profil —
          socle et filière, au niveau choisi — sont proposés. Rangez-les en glissant la poignée, avec les
          flèches, ou en tapant leur numéro. Un profil qui a son ordre voit à l&apos;accueil ses modules
          numérotés dans cet ordre ; les autres suivent l&apos;ordre général, regroupé par bloc.
          {apprenants
            ? " Avec l'identifiant d'un apprenant, c'est son ordre propre sur ce profil qu'on range : quand il est rattaché, il passe avant celui du profil."
            : ""}
        </p>
      </section>
      {sp.ok && MESSAGES[sp.ok] && (
        <p className="encart encart--ok" role="status">
          {MESSAGES[sp.ok]}
        </p>
      )}
      {sp.erreur && ERREURS[sp.erreur] && (
        <p className="encart encart--attention" role="alert">
          {ERREURS[sp.erreur]}
        </p>
      )}

      <ChoixProfil
        parcours={parcoursId}
        filiere={profil?.filiere ?? (typeof sp.filiere === "string" ? sp.filiere : "")}
        niveau={profil?.niveau ?? ""}
        postes={postes}
        agent={agentSaisi}
        apprenants={apprenants}
      />

      {profilInconnu ? (
        <p className="encart encart--attention" role="alert">
          {ERREURS.profil}
        </p>
      ) : erreurApprenant ? (
        <p className="encart encart--attention" role="alert">
          {ERREURS[erreurApprenant]}
        </p>
      ) : profil && apprenant ? (
        <section className="carte" aria-labelledby="t-liste">
          <h2 id="t-liste">
            {apprenant.identifiant} — {libelleProfil} — {PARCOURS[profil.parcours]}
          </h2>
          <p className="legende">
            {ordreAgent
              ? `Ordre propre à ${apprenant.identifiant} sur ce profil, fixé le ${date(ordreAgent.modifieLe)} par ${ordreAgent.modifiePar}.`
              : `Pas encore d'ordre propre à ${apprenant.identifiant} : la liste part de l'ordre ${ordre ? "du profil" : "général"}. L'enregistrer en fait son ordre, suivi quand il est rattaché.`}
          </p>
          {elements.length === 0 ? (
            <p className="encart">{ERREURS["profil-vide"]}</p>
          ) : (
            <form action={actionOrdonnerApprenant}>
              <input type="hidden" name="parcours" value={profil.parcours} />
              <input type="hidden" name="filiere" value={profil.filiere} />
              <input type="hidden" name="niveau" value={profil.niveau} />
              <input type="hidden" name="agent" value={apprenant.identifiant} />
              <ListeOrdonnable
                nom="modules"
                elements={elements}
                libelle={`Modules de ${apprenant.identifiant}, profil ${libelleProfil}`}
              />
              <div className="actions">
                <button type="submit" className="bouton">
                  Enregistrer l&apos;ordre de {apprenant.identifiant}
                </button>
              </div>
            </form>
          )}
          {ordreAgent && (
            <form action={actionRetirerOrdreApprenant} className="actions">
              <input type="hidden" name="parcours" value={profil.parcours} />
              <input type="hidden" name="filiere" value={profil.filiere} />
              <input type="hidden" name="niveau" value={profil.niveau} />
              <input type="hidden" name="agent" value={apprenant.identifiant} />
              <button type="submit" className="bouton bouton--secondaire">
                Revenir à l&apos;ordre du profil
              </button>
            </form>
          )}
        </section>
      ) : profil ? (
        <section className="carte" aria-labelledby="t-liste">
          <h2 id="t-liste">
            {libelleProfil} — {PARCOURS[profil.parcours]}
          </h2>
          <p className="legende">
            {ordre
              ? `Ordre propre de ce profil, fixé le ${date(ordre.modifieLe)} par ${ordre.modifiePar}.`
              : "Pas encore d'ordre propre : la liste suit l'ordre général du parcours, puis la fiche. L'enregistrer en fait l'ordre de ce profil."}
          </p>
          {elements.length === 0 ? (
            <p className="encart">{ERREURS["profil-vide"]}</p>
          ) : (
            <form action={actionOrdonnerProfil}>
              <input type="hidden" name="parcours" value={profil.parcours} />
              <input type="hidden" name="filiere" value={profil.filiere} />
              <input type="hidden" name="niveau" value={profil.niveau} />
              <ListeOrdonnable nom="modules" elements={elements} libelle={`Modules du profil ${libelleProfil}`} />
              <div className="actions">
                <button type="submit" className="bouton">
                  Enregistrer l&apos;ordre de ce profil
                </button>
              </div>
            </form>
          )}
          {ordre && (
            <form action={actionRetirerOrdreProfil} className="actions">
              <input type="hidden" name="parcours" value={profil.parcours} />
              <input type="hidden" name="filiere" value={profil.filiere} />
              <input type="hidden" name="niveau" value={profil.niveau} />
              <button type="submit" className="bouton bouton--secondaire">
                Revenir à l&apos;ordre général
              </button>
            </form>
          )}
        </section>
      ) : (
        <section className="carte" aria-labelledby="t-liste">
          <h2 id="t-liste">Ordre général — {PARCOURS[parcoursId]}</h2>
          <p className="legende">
            Tous les modules du parcours. Il s&apos;applique aux profils qui n&apos;ont pas leur ordre, à
            l&apos;intérieur de chaque bloc de l&apos;accueil, et sert de point de départ à l&apos;ordre d&apos;un
            profil.
          </p>
          <form action={actionOrdonner}>
            <input type="hidden" name="parcours" value={parcoursId} />
            <ListeOrdonnable nom="modules" elements={elements} libelle={`Ordre général du parcours ${PARCOURS[parcoursId]}`} />
            <div className="actions">
              <button type="submit" className="bouton">
                Enregistrer l&apos;ordre général
              </button>
            </div>
          </form>
        </section>
      )}

      {ordres.length > 0 && (
        <section className="carte" aria-labelledby="t-ordres">
          <h2 id="t-ordres">Profils qui ont leur ordre</h2>
          <ul className="liste-nue">
            {ordres.map((o) => {
              const p = postes.find((x) => x.id === o.filiere);
              const n = p?.niveaux.find((x) => x.code === o.niveau);
              return (
                <li key={`${o.parcours}-${o.filiere}-${o.niveau}`}>
                  <Link href={`/admin/ordonnancement${requeteProfil(o)}`}>
                    {p?.libelle ?? o.filiere} · {n?.libelle ?? o.niveau} — {PARCOURS[o.parcours]}
                  </Link>{" "}
                  <span className="legende">
                    {o.modules.length} module{o.modules.length > 1 ? "s" : ""}, fixé le {date(o.modifieLe)} par {o.modifiePar}
                    {p && n ? "" : " — profil retiré du référentiel"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ordresAgents.length > 0 && (
        <section className="carte" aria-labelledby="t-apprenants">
          <h2 id="t-apprenants">Apprenants qui ont leur ordre</h2>
          <ul className="liste-nue">
            {ordresAgents.map((o) => {
              const p = postes.find((x) => x.id === o.filiere);
              const n = p?.niveaux.find((x) => x.code === o.niveau);
              return (
                <li key={`${o.agentId}-${o.parcours}-${o.filiere}-${o.niveau}`}>
                  <Link href={`/admin/ordonnancement${requeteProfil(o)}&agent=${encodeURIComponent(o.identifiant)}`}>
                    {o.identifiant} — {p?.libelle ?? o.filiere} · {n?.libelle ?? o.niveau} — {PARCOURS[o.parcours]}
                  </Link>{" "}
                  <span className="legende">
                    {o.modules.length} module{o.modules.length > 1 ? "s" : ""}, fixé le {date(o.modifieLe)} par {o.modifiePar}
                    {p && n ? "" : " — profil retiré du référentiel"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
