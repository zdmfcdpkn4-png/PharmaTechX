"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { actionBasculerVue } from "@/app/actions-essai";
import { actionBasculerFormation } from "@/app/actions-formation";

/**
 * Interrupteur de la vue apprenant (02/10/2026, question 94, choix a), réservé
 * à l'administration : en haut du volet de gauche sur poste ; sous 62 rem, où
 * le volet n'existe pas, en tête de l'Accès rapide. Il entre dans le mode test
 * et en sort, chaque vue reprenant là où on l'a quittée (`basculerVue`,
 * `lib/essai.ts`). Au clic, il envoie la page affichée et, quand le programme
 * de l'apprenant est à l'écran, le profil qu'il montre : choisi là, ce profil
 * n'est pas dans l'adresse.
 *
 * Variante « formation » (06/10/2026, question 104, choix b) : le même
 * interrupteur, au même endroit, bascule un tuteur dont le code est relié à un
 * identifiant entre sa session de tutorat et sa formation
 * (`actionBasculerFormation`) ; là, tout s'enregistre sous son identifiant.
 */

/** Profil montré par « Composer le programme » en mode test ; null hors de l'écran. */
let profilAffiche: { filiere: string; niveau: string } | null = null;
/**
 * L'interrupteur du volet avait le focus au clic : il le retrouve dans la vue d'arrivée. Celui de
 * l'accès rapide le rend au bouton Menu, avec le panneau qu'il ferme.
 */
let focusApres = false;
/** Une bascule est partie d'ici : la vue d'arrivée s'affiche depuis le haut. */
let basculeLancee = false;

/** Le programme de l'apprenant test annonce le profil qu'il montre (`TableauDeBord`). */
export function useProfilAffiche(actif: boolean, filiere: string, niveau: string) {
  useEffect(() => {
    if (!actif) return;
    profilAffiche = { filiere, niveau };
    return () => {
      profilAffiche = null;
    };
  }, [actif, filiere, niveau]);
}

export function InterrupteurVue({
  apprenant,
  lieu,
  variante = "essai",
}: {
  apprenant: boolean;
  lieu: "volet" | "acces-rapide";
  /** « essai » : la vue apprenant de l'administration (mode test) ; « formation » : le tuteur en formation. */
  variante?: "essai" | "formation";
}) {
  // Un second clic pendant l'envoi partirait de la vue d'arrivée et la refermerait : il est ignoré.
  const envoye = useRef(false);
  const formulaire = useRef<HTMLFormElement>(null);
  const rearmer = useCallback(() => {
    envoye.current = false;
  }, []);
  // La vue a changé : l'interrupteur se réarme ; la page d'arrivée s'affiche depuis le haut, comme
  // après un lien (la redirection de l'action, appliquée par Next sans navigation, n'y remonte pas) ;
  // l'interrupteur du volet, s'il avait le focus, le retrouve.
  useEffect(() => {
    envoye.current = false;
    if (basculeLancee) {
      basculeLancee = false;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (lieu !== "volet" || !focusApres) return;
    focusApres = false;
    formulaire.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [apprenant, lieu]);
  const remplir = (e: React.FormEvent<HTMLFormElement>) => {
    if (envoye.current) {
      e.preventDefault();
      return;
    }
    envoye.current = true;
    basculeLancee = true;
    focusApres = lieu === "volet" && e.currentTarget.contains(document.activeElement);
    const champs = e.currentTarget.elements;
    const poser = (nom: string, valeur: string) => {
      (champs.namedItem(nom) as HTMLInputElement).value = valeur;
    };
    poser("ici", `${location.pathname}${location.search}${location.hash}`);
    const p = profilAffiche;
    poser("ecran", p ? "1" : "");
    poser("filiere", p?.filiere ?? "");
    poser("niveau", p?.niveau ?? "");
  };
  // Une clé par vue : la redirection de l'action revient en erreur au formulaire qui l'a envoyée, et
  // Next la rattrape à la racine, qui se remonte tout entière — page, menus, mémoire de la session —
  // si ce formulaire est encore là. Remplacé avec la vue, il ne reçoit plus rien (constaté le 02/10/2026).
  return (
    <form
      key={apprenant ? "apprenant" : "administration"}
      ref={formulaire}
      action={variante === "formation" ? actionBasculerFormation : actionBasculerVue}
      onSubmit={remplir}
      className={`interrupteur-vue interrupteur-vue--${lieu}`}
    >
      <input type="hidden" name="ici" />
      <input type="hidden" name="ecran" />
      <input type="hidden" name="filiere" />
      <input type="hidden" name="niveau" />
      <Bouton apprenant={apprenant} rearmer={rearmer} libelle={variante === "formation" ? "En formation" : "Vue apprenant"} />
    </form>
  );
}

function Bouton({ apprenant, rearmer, libelle }: { apprenant: boolean; rearmer: () => void; libelle: string }) {
  // Pendant l'envoi, l'interrupteur montre déjà la vue demandée ; l'envoi fini, il se réarme.
  const { pending } = useFormStatus();
  const enCours = useRef(false);
  useEffect(() => {
    if (enCours.current && !pending) rearmer();
    enCours.current = pending;
  }, [pending, rearmer]);
  const coche = pending ? !apprenant : apprenant;
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={coche}
      aria-disabled={pending || undefined}
      className="interrupteur-vue-bouton"
    >
      <span className="interrupteur-vue-libelle">{libelle}</span>
      <span className="interrupteur-vue-piste" aria-hidden="true">
        <span className="interrupteur-vue-curseur" />
      </span>
    </button>
  );
}
