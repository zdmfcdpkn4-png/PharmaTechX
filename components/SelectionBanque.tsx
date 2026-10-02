"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actionLotQuestions } from "@/app/admin/questions/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { FORMULAIRE_SELECTION, annonceReclassement, planReclassement, type StatutReclasse } from "@/content/reclassement";
import {
  AUSSI_MAX,
  GESTES_LOT,
  LIBELLES_GESTE,
  annonceAussiDans,
  annonceNiveau,
  annonceRetrait,
  annonceStatut,
  planAussiDans,
  planNiveau,
  planRetrait,
  planStatut,
  type GesteLot,
  type QuestionLot,
} from "@/content/lot-questions";
import { motsRecherche, texteCorrespond } from "@/content/filtres-banque";

/**
 * Sélection de plusieurs questions de la banque et gestes en lot (02/10/2026,
 * questions 88 et 89, choix a) : classer, poser aussi dans, retirer d'un
 * module, niveau, statut. Les cases sont rendues par le serveur, dans
 * l'arborescence comme dans la liste, rattachées au formulaire de la fenêtre
 * du geste par l'attribut `form` : une question garde ses propres formulaires
 * (Valider, Retirer…) sans formulaire imbriqué. Le DOM reste la source de
 * vérité ; ce composant compte, synchronise et annonce.
 *
 * - Une question posée dans plusieurs modules a une case sous chacun : elles
 *   bougent ensemble, et la question ne compte qu'une fois.
 * - La case d'un module coche ses questions affichées ; Maj + clic coche une
 *   plage, comme dans une messagerie.
 * - Chaque geste s'ouvre dans une fenêtre qui dit l'effet avant d'appliquer ;
 *   sur téléphone, « Actions… » ouvre d'abord la liste des gestes. Une
 *   nouvelle page repart à zéro.
 */

export type ModuleCible = { id: string; libelle: string; bloc: number | null; retire: boolean };
export type BlocCible = { numero: number; titre: string };
export type NiveauCible = { code: string; libelle: string };

const AIDES_GESTE: Record<GesteLot, string> = {
  classer: "changer leur module d'origine",
  aussi: "d'autres modules, en plus de leur module d'origine",
  retirer: "un module où elles sont aussi posées",
  niveau: "le niveau de question, ou « à préciser »",
  statut: "valider, remettre à vérifier, retirer",
};

const STATUTS: { code: StatutReclasse; libelle: string; aide: string }[] = [
  { code: "valide", libelle: "Valider", aide: "elles entrent dans les tirages ; règle des quatre yeux, question par question" },
  { code: "a_verifier", libelle: "Remettre à vérifier", aide: "elles sortent des tirages jusqu'à leur revalidation" },
  { code: "retire", libelle: "Retirer", aide: "elles ne sont plus posées ; l'historique les garde" },
];

function questions(n: number): string {
  return `${n} question${n > 1 ? "s" : ""}`;
}

function casesQuestions(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>("input.case-question")];
}

/** Ce que la case d'une question dit d'elle : de quoi annoncer chaque geste avant de l'appliquer. */
function lireCase(c: HTMLInputElement): QuestionLot {
  return {
    id: c.value,
    module_id: c.dataset.module ?? "",
    statut: (c.dataset.statut ?? "a_verifier") as StatutReclasse,
    aussi_dans: (c.dataset.aussi ?? "").split(" ").filter(Boolean),
    niveau: c.dataset.niveau || null,
    moi: c.dataset.moi === "1",
  };
}

export function SelectionBanque({
  modules,
  blocs,
  niveaux,
  role,
  retour,
  affichees,
}: {
  /** Tous les modules, retirés compris : un module retiré se quitte, il ne se rejoint pas. */
  modules: ModuleCible[];
  blocs: BlocCible[];
  /** Niveaux de question en vigueur, « à préciser » compris. */
  niveaux: NiveauCible[];
  /** Rôle de la session : l'administration valide aussi les siennes. */
  role: string;
  retour: string;
  /** Questions affichées, comptées par le serveur : « Tout sélectionner » le dit dès le premier affichage. */
  affichees: number;
}) {
  const [choisies, setChoisies] = useState<QuestionLot[]>([]);
  const [total, setTotal] = useState(affichees);
  const [geste, setGeste] = useState<GesteLot | null>(null);
  // Fermée, la fenêtre ne garde que son formulaire : aucun de ses boutons ne traîne, caché, dans la page.
  const [ouverte, setOuverte] = useState(false);
  const [cibleClasser, setCibleClasser] = useState("");
  const [cibleRetrait, setCibleRetrait] = useState("");
  const [aussi, setAussi] = useState<string[]>([]);
  const [chercher, setChercher] = useState("");
  const [niveau, setNiveau] = useState("");
  const [statut, setStatut] = useState<StatutReclasse | "">("");
  const tout = useRef<HTMLInputElement>(null);
  const barre = useRef<HTMLDivElement>(null);
  const fenetre = useRef<HTMLDialogElement>(null);
  const derniere = useRef<number | null>(null);

  const relire = useCallback(() => {
    const vues = new Map<string, QuestionLot>();
    const cochees = new Map<string, QuestionLot>();
    for (const c of casesQuestions()) {
      const q = lireCase(c);
      vues.set(q.id, q);
      if (c.checked) cochees.set(q.id, q);
    }
    setTotal(vues.size);
    setChoisies([...cochees.values()]);
    // Case d'un module : cochée si toutes ses questions le sont, à moitié si quelques-unes.
    for (const m of document.querySelectorAll<HTMLInputElement>("input.case-module")) {
      const branche = m.dataset.branche ? document.getElementById(m.dataset.branche) : null;
      const dedans = branche ? [...branche.querySelectorAll<HTMLInputElement>("input.case-question")] : [];
      const n = dedans.filter((c) => c.checked).length;
      m.checked = dedans.length > 0 && n === dedans.length;
      m.indeterminate = n > 0 && n < dedans.length;
    }
    if (tout.current) {
      tout.current.checked = vues.size > 0 && cochees.size === vues.size;
      tout.current.indeterminate = cochees.size > 0 && cochees.size < vues.size;
    }
  }, []);

  const toutCocher = useCallback(
    (coche: boolean) => {
      for (const c of casesQuestions()) c.checked = coche;
      relire();
    },
    [relire],
  );

  useEffect(() => {
    // Nouvelle page (filtre, geste) : la sélection repart vide.
    for (const c of document.querySelectorAll<HTMLInputElement>("input.case-question, input.case-module")) {
      c.checked = false;
      c.indeterminate = false;
    }
    relire();
    const auClic = (e: MouseEvent) => {
      const c = e.target;
      if (!(c instanceof HTMLInputElement)) return;
      if (c.classList.contains("case-question")) {
        const toutes = casesQuestions();
        const i = toutes.indexOf(c);
        const touchees =
          e.shiftKey && derniere.current !== null && i >= 0
            ? toutes.slice(Math.min(i, derniere.current), Math.max(i, derniere.current) + 1)
            : [c];
        derniere.current = i;
        const valeurs = new Set(touchees.map((x) => x.value));
        for (const x of toutes) if (valeurs.has(x.value)) x.checked = c.checked;
        relire();
      } else if (c.classList.contains("case-module")) {
        const branche = c.dataset.branche ? document.getElementById(c.dataset.branche) : null;
        const valeurs = new Set([...(branche?.querySelectorAll<HTMLInputElement>("input.case-question") ?? [])].map((x) => x.value));
        for (const x of casesQuestions()) if (valeurs.has(x.value)) x.checked = c.checked;
        relire();
      }
    };
    document.addEventListener("click", auClic);
    return () => document.removeEventListener("click", auClic);
  }, [relire]);

  // La barre fixe ne doit rien cacher du bas de la page.
  useEffect(() => {
    document.body.classList.toggle("a-selection", choisies.length > 0);
    return () => document.body.classList.remove("a-selection");
  }, [choisies.length]);

  // Plus rien de sélectionné : la fenêtre n'a plus d'objet.
  useEffect(() => {
    if (choisies.length === 0) fenetre.current?.close();
  }, [choisies.length]);

  // Ouverte une fois son contenu rendu : le focus va à son premier champ.
  useEffect(() => {
    const f = fenetre.current;
    if (ouverte && f && !f.open) f.showModal();
  }, [ouverte]);

  // Sa hauteur réelle règle la marge du bas de la page.
  useEffect(() => {
    const el = barre.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const suivre = new ResizeObserver(() => {
      document.body.style.setProperty("--hauteur-selection", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    });
    suivre.observe(el);
    return () => {
      suivre.disconnect();
      document.body.style.removeProperty("--hauteur-selection");
    };
  }, []);

  const libelles = useMemo(() => new Map(modules.map((m) => [m.id, m.libelle])), [modules]);
  const libelle = (id: string) => libelles.get(id) ?? id;
  const ouverts = useMemo(() => modules.filter((m) => !m.retire), [modules]);
  // « Poser aussi dans » : les modules ouverts par bloc, ceux sans bloc à la fin.
  const parBloc = useMemo(() => {
    const groupes = new Map<number | null, ModuleCible[]>();
    for (const m of ouverts) groupes.set(m.bloc, [...(groupes.get(m.bloc) ?? []), m]);
    return [...groupes.entries()].sort(([a], [b]) => (a ?? 999) - (b ?? 999));
  }, [ouverts]);
  const titreBloc = (n: number | null) => {
    if (n === null) return "Bloc à préciser";
    const b = blocs.find((x) => x.numero === n);
    return b ? `Bloc ${n} — ${b.titre}` : `Bloc ${n}`;
  };
  const mots = motsRecherche(chercher);
  // « Retirer d'un module » : ceux où l'une au moins des questions choisies est aussi posée.
  const ailleurs = [...new Set(choisies.flatMap((q) => q.aussi_dans))].sort((a, b) =>
    libelle(a).localeCompare(libelle(b), "fr", { numeric: true }),
  );
  const retrait = ailleurs.includes(cibleRetrait) ? cibleRetrait : "";

  const n = choisies.length;
  const ouvrir = (g: GesteLot | null) => {
    setGeste(g);
    setOuverte(true);
  };
  const fermer = () => fenetre.current?.close();

  // L'effet, dit avant d'appliquer, et le nombre de questions que le geste change.
  let annonce = "";
  let applicables = 0;
  if (geste === "classer") {
    const plan = planReclassement(choisies.map((q) => q.id), choisies, cibleClasser);
    annonce = cibleClasser ? annonceReclassement(plan, libelle(cibleClasser)) : "Choisissez le module.";
    applicables = cibleClasser ? plan.aClasser.length : 0;
  } else if (geste === "aussi") {
    const plan = planAussiDans(choisies, aussi);
    annonce = annonceAussiDans(plan, aussi.map(libelle));
    applicables = plan.touchees.length;
  } else if (geste === "retirer") {
    if (ailleurs.length === 0) annonce = n > 1 ? "Aucune des questions choisies n'est posée ailleurs que dans son module d'origine." : "La question choisie n'est posée que dans son module d'origine.";
    else if (!retrait) annonce = "Choisissez le module.";
    else {
      const plan = planRetrait(choisies, retrait);
      annonce = annonceRetrait(plan, libelle(retrait));
      applicables = plan.touchees.length;
    }
  } else if (geste === "niveau") {
    if (!niveau) annonce = "Choisissez le niveau.";
    else {
      const plan = planNiveau(choisies, niveau === "a_preciser" ? null : niveau);
      annonce = annonceNiveau(plan, niveaux.find((x) => x.code === niveau)?.libelle ?? niveau);
      applicables = plan.touchees.length;
    }
  } else if (geste === "statut") {
    if (!statut) annonce = "Choisissez le statut.";
    else {
      const plan = planStatut(choisies, statut, role);
      annonce = annonceStatut(plan, statut);
      applicables = plan.touchees.length;
    }
  }

  const titre =
    geste === null
      ? `${questions(n)} sélectionnée${n > 1 ? "s" : ""}`
      : {
          classer: `Classer ${questions(n)} dans un module`,
          aussi: `Poser ${questions(n)} aussi dans…`,
          retirer: `Retirer ${questions(n)} d'un module`,
          niveau: `Niveau de ${questions(n)}`,
          statut: `Statut de ${questions(n)}`,
        }[geste];

  return (
    <div className="selection-banque">
      <label className="case-tout">
        <input ref={tout} type="checkbox" disabled={total === 0} onChange={(e) => toutCocher(e.currentTarget.checked)} />
        <span>
          Tout sélectionner ({total} affichée{total > 1 ? "s" : ""})
        </span>
      </label>
      <div ref={barre} className="barre-selection" hidden={n === 0} role="region" aria-label="Actions sur les questions sélectionnées">
        <p className="barre-selection-compte" aria-live="polite">
          <strong>{n}</strong> sélectionnée{n > 1 ? "s" : ""}
        </p>
        <span className="barre-selection-gestes">
          {GESTES_LOT.map((g, i) => (
            <button
              key={g}
              type="button"
              className={`bouton bouton--compact${i === 0 ? "" : " bouton--secondaire"}`}
              onClick={() => ouvrir(g)}
            >
              {LIBELLES_GESTE[g]}…
            </button>
          ))}
        </span>
        <button type="button" className="bouton bouton--compact barre-selection-actions" onClick={() => ouvrir(null)}>
          Actions…
        </button>
        <button
          type="button"
          className="bouton bouton--compact bouton--discret barre-selection-vider"
          aria-label="Désélectionner"
          onClick={() => toutCocher(false)}
        >
          <span aria-hidden="true">✕</span>
          <span className="barre-selection-vider-texte">Désélectionner</span>
        </button>
      </div>

      <dialog
        ref={fenetre}
        className="fenetre-lot"
        aria-labelledby="t-fenetre-lot"
        onClose={() => setOuverte(false)}
        onClick={(e) => {
          // Un clic sur le voile, hors de la fenêtre, la ferme.
          if (e.target === e.currentTarget) fermer();
        }}
      >
        <form id={FORMULAIRE_SELECTION} action={actionLotQuestions} className="fenetre-lot-corps">
          <input type="hidden" name="retour" value={retour} />
          <input type="hidden" name="geste" value={geste ?? ""} />
          {ouverte && (
            <>
              <h2 id="t-fenetre-lot" className="fenetre-lot-titre">
                {titre}
              </h2>
              <div className="fenetre-lot-choix">
                {geste === null && (
                  <ul className="liste-nue fenetre-lot-menu">
                    {GESTES_LOT.map((g) => (
                      <li key={g}>
                        <button type="button" onClick={() => setGeste(g)}>
                          <strong>{LIBELLES_GESTE[g]}</strong>
                          <span className="legende">{AIDES_GESTE[g]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {geste === "classer" && (
                  <label className="champ">
                    <span>Module d&apos;origine</span>
                    <select name="module" value={cibleClasser} onChange={(e) => setCibleClasser(e.currentTarget.value)}>
                      <option value="">— choisir un module —</option>
                      {ouverts.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.libelle}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {geste === "aussi" && (
                  <>
                    <p className="legende">
                      Chacune reste dans son module d&apos;origine, où elle se modifie et se valide ; elle entre aussi dans le
                      tirage des modules cochés.
                    </p>
                    <label className="champ">
                      <span>Chercher un module</span>
                      <input
                        type="search"
                        value={chercher}
                        onChange={(e) => setChercher(e.currentTarget.value)}
                        // Entrée cherche, elle n'applique pas le geste.
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        placeholder="titre ou code, par exemple B4-02"
                      />
                    </label>
                    {parBloc.map(([bloc, liste]) => {
                      const visibles = liste.filter((m) => texteCorrespond(m.libelle, mots));
                      const cochees = liste.filter((m) => aussi.includes(m.id)).length;
                      return (
                        // Un module caché par la recherche reste dans le formulaire : coché, il part avec.
                        <details
                          key={bloc ?? "aucun"}
                          className="aussi-bloc"
                          open={mots.length > 0 || cochees > 0}
                          hidden={visibles.length === 0}
                        >
                          <summary>
                            {titreBloc(bloc)}
                            <span className="legende">
                              {" "}
                              — {liste.length} module{liste.length > 1 ? "s" : ""}
                              {cochees > 0 ? `, ${cochees} coché${cochees > 1 ? "s" : ""}` : ""}
                            </span>
                          </summary>
                          <span className="cases">
                            {liste.map((m) => (
                              <label key={m.id} hidden={!visibles.includes(m)}>
                                <input
                                  type="checkbox"
                                  name="modules"
                                  value={m.id}
                                  checked={aussi.includes(m.id)}
                                  disabled={!aussi.includes(m.id) && aussi.length >= AUSSI_MAX}
                                  onChange={(e) => {
                                    const coche = e.currentTarget.checked;
                                    setAussi((prec) =>
                                      coche ? [...prec.filter((x) => x !== m.id), m.id] : prec.filter((x) => x !== m.id),
                                    );
                                  }}
                                />
                                {m.libelle}
                              </label>
                            ))}
                          </span>
                        </details>
                      );
                    })}
                  </>
                )}

                {geste === "retirer" && ailleurs.length > 0 && (
                  <label className="champ">
                    <span>Module à quitter</span>
                    <select name="module" value={retrait} onChange={(e) => setCibleRetrait(e.currentTarget.value)}>
                      <option value="">— choisir un module —</option>
                      {ailleurs.map((id) => (
                        <option key={id} value={id}>
                          {libelle(id)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {geste === "niveau" && (
                  <fieldset className="fenetre-lot-radios">
                    <legend>Niveau de question</legend>
                    {niveaux.map((x) => (
                      <label key={x.code}>
                        <input type="radio" name="niveau" value={x.code} checked={niveau === x.code} onChange={() => setNiveau(x.code)} />
                        {x.libelle}
                      </label>
                    ))}
                  </fieldset>
                )}

                {geste === "statut" && (
                  <fieldset className="fenetre-lot-radios">
                    <legend>Statut</legend>
                    {STATUTS.map((x) => (
                      <label key={x.code}>
                        <input type="radio" name="statut" value={x.code} checked={statut === x.code} onChange={() => setStatut(x.code)} />
                        <span>
                          {x.libelle} <span className="legende">— {x.aide}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>

              <div className="fenetre-lot-pied">
                {geste !== null && (
                  <p className="fenetre-lot-effet" role="status">
                    {annonce}
                  </p>
                )}
                <div className="actions">
                  {geste !== null && (
                    <BoutonEnvoi className="bouton" disabled={applicables === 0}>
                      {applicables > 0 ? `Appliquer à ${questions(applicables)}` : "Appliquer"}
                    </BoutonEnvoi>
                  )}
                  <button type="button" className="bouton bouton--secondaire" onClick={fermer}>
                    {geste === null ? "Fermer" : "Annuler"}
                  </button>
                  {geste !== null && (
                    <button type="button" className="bouton bouton--discret" onClick={() => setGeste(null)}>
                      Autres gestes
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </form>
      </dialog>
    </div>
  );
}
