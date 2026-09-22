"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cleTutoriel, type EtapeTutoriel, type ProfilTutoriel } from "@/content/tutoriel";

/**
 * Visite guidée du site, au premier passage d'un profil (demande du
 * 19/09/2026).
 *
 * Ce qui décide de la première fois : une clé posée dans `localStorage`, sur
 * le poste, par profil. Le choix est contraint — il n'existe nulle part de
 * « personne » à qui rattacher cette mémoire : un code ouvre un profil, pas
 * un compte, et l'inscrire en base sous le code masquerait la visite à tous
 * ceux qui partagent ce code. **Conséquence assumée** : sur un poste partagé,
 * le deuxième agent ne voit pas la visite s'ouvrir seule. D'où le bouton
 * « Revoir la présentation », permanent dans le volet — dans le Menu sur
 * écran tactile, où les lignes de 44 px ne lui laissent pas de place.
 *
 * Rien de nominatif n'y est écrit : la clé porte le profil et un numéro de
 * version, comme le repère de lecture des modules (`LectureModule`).
 */

interface EtatTutoriel {
  ouvrir: () => void;
  disponible: boolean;
}

const ContexteTutoriel = createContext<EtatTutoriel | null>(null);

export function TutorielProvider({
  profil,
  etapes,
  children,
}: {
  /** `null` hors session : aucune visite, et le bouton du volet s'efface. */
  profil: ProfilTutoriel | null;
  etapes: EtapeTutoriel[];
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [index, setIndex] = useState(0);

  // Première fois : lu après le montage seulement. Lire `localStorage` au
  // premier rendu ferait diverger le rendu serveur et le rendu client.
  useEffect(() => {
    if (!profil || etapes.length === 0) return;
    try {
      if (!localStorage.getItem(cleTutoriel(profil))) {
        setIndex(0);
        setOuvert(true);
      }
    } catch {
      // Stockage refusé (navigation privée, politique du poste) : la visite
      // ne s'ouvre pas d'elle-même. Le bouton du volet reste le recours.
    }
  }, [profil, etapes.length]);

  const marquerVue = useCallback(() => {
    if (!profil) return;
    try {
      localStorage.setItem(cleTutoriel(profil), new Date().toISOString());
    } catch {
      // Sans stockage, la visite reparaîtra : préférable à un blocage.
    }
  }, [profil]);

  const fermer = useCallback(() => {
    setOuvert(false);
    marquerVue();
  }, [marquerVue]);

  const ouvrir = useCallback(() => {
    setIndex(0);
    setOuvert(true);
  }, []);

  return (
    <ContexteTutoriel.Provider value={{ ouvrir, disponible: Boolean(profil) && etapes.length > 0 }}>
      {children}
      {ouvert && etapes.length > 0 && (
        <Visite etapes={etapes} index={index} setIndex={setIndex} fermer={fermer} />
      )}
    </ContexteTutoriel.Provider>
  );
}

function Visite({
  etapes,
  index,
  setIndex,
  fermer,
}: {
  etapes: EtapeTutoriel[];
  index: number;
  setIndex: (n: number) => void;
  fermer: () => void;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const etape = etapes[index];
  const dernier = index === etapes.length - 1;

  useEffect(() => {
    boite.current?.focus();
  }, []);

  // Échappement pour sortir, tabulation enfermée dans la boîte : une fenêtre
  // modale qui laisse filer le clavier derrière elle n'en est pas une.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fermer();
        return;
      }
      if (e.key !== "Tab" || !boite.current) return;
      const cibles = boite.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernierFocusable = cibles[cibles.length - 1];
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || actif === boite.current)) {
        e.preventDefault();
        dernierFocusable.focus();
      } else if (!e.shiftKey && actif === dernierFocusable) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener("keydown", auClavier);
    document.body.classList.add("menu-ouvert");
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.classList.remove("menu-ouvert");
    };
  }, [fermer]);

  return (
    <div className="visite-voile" role="presentation" onClick={fermer}>
      <div
        ref={boite}
        className="visite"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visite-titre"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="visite-entete">
          <p className="sur-titre">
            Présentation — étape {index + 1} sur {etapes.length}
          </p>
          <button type="button" className="visite-fermer" onClick={fermer} aria-label="Fermer la présentation">
            ×
          </button>
        </div>

        <h2 id="visite-titre">{etape.titre}</h2>
        <p className="visite-texte">{etape.texte}</p>

        {etape.href && (
          <p className="visite-lien">
            <Link href={etape.href} onClick={fermer}>
              {etape.lien ?? "Ouvrir cet écran"} →
            </Link>
          </p>
        )}

        <ol className="visite-points" aria-hidden="true">
          {etapes.map((e, i) => (
            <li key={e.titre} className={i === index ? "actif" : undefined} />
          ))}
        </ol>

        <div className="visite-actions">
          <button
            type="button"
            className="bouton bouton--secondaire bouton--compact"
            onClick={() => setIndex(index - 1)}
            disabled={index === 0}
          >
            Précédent
          </button>
          {dernier ? (
            <button type="button" className="bouton bouton--compact" onClick={fermer}>
              Terminer
            </button>
          ) : (
            <button type="button" className="bouton bouton--compact" onClick={() => setIndex(index + 1)}>
              Suivant
            </button>
          )}
          <button type="button" className="visite-passer" onClick={fermer}>
            Passer
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bouton du volet. Rend `null` hors session : sans profil, il n'y a pas de
 * visite à revoir, et le volet de la connexion n'en porte pas.
 */
export function BoutonRevoirTutoriel() {
  const ctx = useContext(ContexteTutoriel);
  if (!ctx?.disponible) return null;
  return (
    <button type="button" className="rail-bouton" onClick={ctx.ouvrir}>
      Revoir la présentation
    </button>
  );
}
