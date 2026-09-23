import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Compte, cumuler, type Comptes } from "@/components/ArbreBanque";
import { ancreDe, estOuvert, type BrancheFiliere, type BrancheModule, type EtatPlis } from "@/content/arbre-banque";
import type { LigneQuestion } from "@/content/banque-db";
import type { CodeActeur } from "@/content/quatre-yeux";
import { ActionsQuestion, ContenuQuestion, EtiquettesQuestion, TraceQuestion } from "./question-banque";

/**
 * Vue « Arborescence » de la banque (question 64, choix b, 23/09/2026) :
 * filière, niveau d'habilitation, module, question, en `<details>` imbriqués
 * — le repli marche au clavier et sans script. Chaque rangée porte son
 * décompte ; une question dépliée montre ses propositions et les mêmes
 * boutons que dans la liste. Après un geste, l'adresse de retour rouvre la
 * branche où il a été fait (`ouvrir`) et y ramène (ancre).
 */

interface Contexte {
  /** Questions retenues par les filtres, par module. */
  parModule: Map<string, LigneQuestion[]>;
  /** Couverture de la banque entière, comme la vue Liste : le filtre ne la change pas. */
  comptes: Comptes;
  signales: Record<string, number>;
  session: CodeActeur;
  etat: EtatPlis;
  /** Adresse qui rouvre une branche et y ramène, vue, filtres et repli gardés. */
  adresse: (chemin: string) => string;
}

const AUCUNE = { valides: 0, aVerifier: 0, reservees: 0 };

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/**
 * Sous un filtre, une rangée dit aussi combien de questions elle montre : son
 * décompte reste celui de la banque entière.
 */
function Affichees({ ids, ctx }: { ids: string[]; ctx: Contexte }) {
  if (!ctx.etat.filtre) return null;
  const n = ids.reduce((t, id) => t + (ctx.parModule.get(id)?.length ?? 0), 0);
  return <span className="legende arbo-affichees">{pluriel(n, "question affichée", "questions affichées")}</span>;
}

function QuestionArbre({ q, bm, ctx }: { q: LigneQuestion; bm: BrancheModule; ctx: Contexte }) {
  const chemin = `${bm.chemin}/${encodeURIComponent(q.id)}`;
  const retour = ctx.adresse(chemin);
  return (
    <li>
      <details id={ancreDe(chemin)} className="arbo-noeud arbo-question" open={estOuvert(chemin, 4, ctx.etat)}>
        <summary>
          <EtiquettesQuestion q={q} signalements={ctx.signales[q.id] ?? 0} />
          <span className="arbo-enonce">{q.enonce}</span>
        </summary>
        <div className="arbo-corps">
          <p className="arbo-trace">
            <TraceQuestion q={q} />
          </p>
          <ContenuQuestion q={q} />
          <ActionsQuestion
            q={q}
            session={ctx.session}
            retour={retour}
            modifier={`/admin/questions/${q.id}?retour=${encodeURIComponent(retour)}`}
            retourSuppression={ctx.adresse(bm.chemin)}
          />
        </div>
      </details>
    </li>
  );
}

function ModuleArbre({ bm, ctx }: { bm: BrancheModule; ctx: Contexte }) {
  const m = bm.module;
  const questions = ctx.parModule.get(m.id) ?? [];
  const c = ctx.comptes[m.id] ?? AUCUNE;
  const vide = c.valides + c.aVerifier === 0;
  return (
    <li>
      <details
        id={ancreDe(bm.chemin)}
        className={`arbo-noeud arbo-module${vide ? " arbo-module--vide" : ""}`}
        open={estOuvert(bm.chemin, 3, ctx.etat)}
      >
        <summary>
          <span className="etiquette etiquette--site">{m.etiquette}</span>
          <span className="arbre-titre">{m.titre}</span>
          <Affichees ids={[m.id]} ctx={ctx} />
          <Compte c={c} />
        </summary>
        <div className="arbo-enfants">
          <p className="arbo-liens legende">
            <Link href={`/module/${m.id}`}>Voir le module</Link>
            {" · "}
            <Link href={`/admin/questions/nouvelle?module=${encodeURIComponent(m.id)}&retour=${encodeURIComponent(ctx.adresse(bm.chemin))}`}>
              Nouvelle question ici
            </Link>
            {bm.aussiSous.length > 0 && <> · figure aussi sous {bm.aussiSous.join(" ; ")}</>}
          </p>
          {questions.length === 0 ? (
            <p className="legende arbo-rien">Aucune question{ctx.etat.filtre ? " pour ce filtre" : ""}.</p>
          ) : (
            <ul className="liste-nue">
              {questions.map((q) => (
                <QuestionArbre key={q.id} q={q} bm={bm} ctx={ctx} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

function FiliereArbre({ f, ctx }: { f: BrancheFiliere; ctx: Contexte }) {
  return (
    <li>
      <details id={ancreDe(f.chemin)} className="arbo-noeud arbo-filiere" open={estOuvert(f.chemin, 1, ctx.etat)}>
        <summary>
          <Badge nom={f.badge} />
          <span className="arbre-titre">{f.libelle}</span>
          <Affichees ids={f.modules.map((m) => m.id)} ctx={ctx} />
          <Compte c={cumuler(f.modules, ctx.comptes)} modules={f.modules.length} />
        </summary>
        <ul className="liste-nue arbo-enfants">
          {f.niveaux.map((n) => (
            <li key={n.chemin}>
              <details id={ancreDe(n.chemin)} className="arbo-noeud arbo-niveau" open={estOuvert(n.chemin, 2, ctx.etat)}>
                <summary>
                  {n.code === null ? (
                    <span className="arbre-titre">Tous niveaux</span>
                  ) : (
                    <>
                      <span className={`etiquette ${n.connu ? "etiquette--neutre" : "etiquette--attention"}`}>{n.code}</span>
                      <span className="arbre-titre">{n.libelle}</span>
                    </>
                  )}
                  <Affichees ids={n.modules.map((bm) => bm.module.id)} ctx={ctx} />
                  <Compte c={cumuler(n.modules.map((bm) => bm.module), ctx.comptes)} modules={n.modules.length} />
                </summary>
                <ul className="liste-nue arbo-enfants">
                  {n.modules.map((bm) => (
                    <ModuleArbre key={bm.chemin} bm={bm} ctx={ctx} />
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export function ArborescenceBanque({
  arbre,
  parModule,
  comptes,
  signales,
  session,
  etat,
  parametres,
}: {
  /** L'arbre à montrer, déjà élagué sous un filtre. */
  arbre: BrancheFiliere[];
  parModule: Map<string, LigneQuestion[]>;
  comptes: Comptes;
  signales: Record<string, number>;
  session: CodeActeur;
  etat: EtatPlis;
  /** Vue, filtres et repli courants, que chaque lien et chaque geste gardent. */
  parametres: [string, string][];
}) {
  const ctx: Contexte = {
    parModule,
    comptes,
    signales,
    session,
    etat,
    adresse: (chemin) => {
      const q = new URLSearchParams(parametres);
      q.set("ouvrir", chemin);
      return `/admin/questions?${q.toString()}#${ancreDe(chemin)}`;
    },
  };
  const lienPlis = (plis: "tout" | "aucun") => {
    const q = new URLSearchParams(parametres.filter(([k]) => k !== "plis"));
    q.set("plis", plis);
    return `/admin/questions?${q.toString()}`;
  };
  // Chaque module une fois, même s'il figure sous plusieurs branches.
  const distincts = [...new Set(arbre.flatMap((f) => f.modules.map((m) => m.id)))].map((id) => ({ id }));

  return (
    <section className="section arborescence" aria-labelledby="t-arborescence">
      <div className="section-titre">
        <h2 id="t-arborescence" style={{ fontSize: "1.15rem" }}>
          Arborescence de la banque
        </h2>
        <span className="compte">
          <Compte c={cumuler(distincts, comptes)} modules={distincts.length} />
        </span>
      </div>
      <p className="legende">
        Filière, puis niveau, puis module, puis question. Un module rattaché à deux niveaux figure sous chacun, avec ses
        questions. Les modules sans question apparaissent en grisé.
      </p>
      <p className="arbo-plis">
        <Link href={lienPlis("tout")}>Tout déplier</Link>
        <span aria-hidden="true"> · </span>
        <Link href={lienPlis("aucun")}>Tout replier</Link>
      </p>
      {arbre.length === 0 ? (
        <p className="encart">Aucune question en base pour ce filtre.</p>
      ) : (
        <ul className="liste-nue arbo">
          {arbre.map((f) => (
            <FiliereArbre key={f.chemin} f={f} ctx={ctx} />
          ))}
        </ul>
      )}
    </section>
  );
}
