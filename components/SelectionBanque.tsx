"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { actionClasserQuestions } from "@/app/admin/questions/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import {
  FORMULAIRE_SELECTION,
  annonceReclassement,
  planReclassement,
  type QuestionAClasser,
  type StatutReclasse,
} from "@/content/reclassement";

/**
 * Sélection de plusieurs questions de la banque et reclassement en lot
 * (02/10/2026, question 88, choix a). Les cases sont rendues par le serveur,
 * dans l'arborescence comme dans la liste, rattachées à ce formulaire par
 * l'attribut `form` : une question garde ses propres formulaires (Valider,
 * Retirer…) sans formulaire imbriqué. Le DOM reste la source de vérité ; ce
 * composant compte, synchronise et annonce.
 *
 * - Une question posée dans plusieurs modules a une case sous chacun : elles
 *   bougent ensemble, et la question ne compte qu'une fois.
 * - La case d'un module coche ses questions affichées ; Maj + clic coche une
 *   plage, comme dans une messagerie.
 * - L'effet est dit avant d'appliquer ; une nouvelle page repart à zéro.
 */

export type ModuleCible = { id: string; libelle: string };

function casesQuestions(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>("input.case-question")];
}

export function SelectionBanque({ modules, retour }: { modules: ModuleCible[]; retour: string }) {
  const [choisies, setChoisies] = useState<QuestionAClasser[]>([]);
  const [total, setTotal] = useState(0);
  const [cible, setCible] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const tout = useRef<HTMLInputElement>(null);
  const barre = useRef<HTMLFormElement>(null);
  const derniere = useRef<number | null>(null);

  const relire = useCallback(() => {
    const vues = new Map<string, QuestionAClasser>();
    const cochees = new Map<string, QuestionAClasser>();
    for (const c of casesQuestions()) {
      const q: QuestionAClasser = {
        id: c.value,
        module_id: c.dataset.module ?? "",
        statut: (c.dataset.statut ?? "a_verifier") as StatutReclasse,
      };
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
    // Nouvelle page (filtre, geste, reclassement) : la sélection repart vide.
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

  useEffect(() => {
    if (choisies.length === 0) setConfirmer(false);
  }, [choisies.length]);

  // Sa hauteur réelle, plus grande quand elle annonce l'effet, règle la marge du bas de la page.
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

  const n = choisies.length;
  const plan = planReclassement(
    choisies.map((q) => q.id),
    choisies,
    cible,
  );
  const libelle = modules.find((m) => m.id === cible)?.libelle ?? "";

  return (
    <div className="selection-banque">
      <label className="case-tout">
        <input ref={tout} type="checkbox" disabled={total === 0} onChange={(e) => toutCocher(e.currentTarget.checked)} />
        <span>
          Tout sélectionner ({total} affichée{total > 1 ? "s" : ""})
        </span>
      </label>
      <form
        ref={barre}
        id={FORMULAIRE_SELECTION}
        action={actionClasserQuestions}
        className="barre-selection"
        hidden={n === 0}
        aria-label="Actions sur les questions sélectionnées"
      >
        <input type="hidden" name="retour" value={retour} />
        <input type="hidden" name="module" value={cible} />
        <p className="barre-selection-compte" aria-live="polite">
          <strong>{n}</strong> sélectionnée{n > 1 ? "s" : ""}
        </p>
        {confirmer ? (
          <>
            <p className="barre-selection-annonce" role="status">
              {annonceReclassement(plan, libelle)}
            </p>
            <BoutonEnvoi className="bouton bouton--compact" disabled={plan.aClasser.length === 0}>
              Confirmer
            </BoutonEnvoi>
            <button type="button" className="bouton bouton--compact bouton--secondaire" onClick={() => setConfirmer(false)}>
              Annuler
            </button>
          </>
        ) : (
          <>
            <label className="barre-selection-champ">
              <span>Classer dans</span>
              <select value={cible} onChange={(e) => setCible(e.currentTarget.value)}>
                <option value="">— choisir un module —</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.libelle}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="bouton bouton--compact" disabled={!cible} onClick={() => setConfirmer(true)}>
              Classer…
            </button>
          </>
        )}
        <button
          type="button"
          className="bouton bouton--compact bouton--discret barre-selection-vider"
          onClick={() => {
            toutCocher(false);
            setConfirmer(false);
          }}
        >
          Désélectionner
        </button>
      </form>
    </div>
  );
}
