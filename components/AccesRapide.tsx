"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { ContexteMenu } from "./Menu";
import type { GroupeRail } from "./Navigation";
import { nomAccessible, type ItemAttente } from "@/content/acces-rapide";
import { DERNIER, type DernierModule } from "./LectureModule";
import { BoutonRevoirTutoriel } from "./Tutoriel";

/**
 * Accès rapide (paquet A, 21/09/2026) — `docs/ACCES-RAPIDE.md`.
 *
 * Le volet répond à « où puis-je aller ? ». Ce panneau répond à « fais ce pour
 * quoi je suis venu », et surtout il montre **avant** le clic s'il y a quelque
 * chose à y faire : c'est le compteur qui supprime le déplacement à vide, pas
 * le raccourci.
 *
 * Une seule surface pour les deux tailles d'écran : sous 62 rem elle se pose
 * en tiroir à gauche (le volet permanent est alors masqué), au-dessus elle
 * s'ouvre en panneau centré. La feuille de style décide ; le balisage, les
 * intitulés et l'ordre sont les mêmes.
 *
 * Écart assumé avec le § 5.2 de la spécification, qui annonçait un panneau
 * « qui ne répète pas la navigation » sur poste : « Aller à » y figure quand
 * même. Un lanceur dont la recherche n'atteint pas les écrans n'est pas un
 * lanceur, et la main n'a pas à quitter le clavier pour rejoindre le volet.
 */

export interface ReprisePossible {
  /** `lecture` : repère posé sur ce poste. `evaluation` : session laissée en plan. */
  nature: "lecture" | "evaluation";
  libelle: string;
  detail: string;
  href: string;
}

interface Entree {
  cle: string;
  zone: "reprendre" | "faire" | "aller";
  libelle: string;
  href: string;
  detail?: string;
  nombre?: number;
  /** Intitulé du groupe, pour « Aller à ». */
  groupe?: string;
}

const sansAccent = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Aplatit le volet en une liste de liens, groupe par groupe, dans l'ordre du volet. */
function entreesDuVolet(groupes: GroupeRail[], administration: GroupeRail | null): Entree[] {
  const out: Entree[] = [];
  for (const g of [...groupes, ...(administration ? [administration] : [])]) {
    for (const l of g.liens ?? []) {
      out.push({ cle: `${g.id}:${l.href}`, zone: "aller", libelle: l.libelle, href: l.href, groupe: g.titre });
    }
    for (const s of g.sous ?? []) {
      for (const l of s.liens) {
        out.push({
          cle: `${g.id}:${s.titre}:${l.href}`,
          zone: "aller",
          libelle: l.libelle,
          href: l.href,
          groupe: `${g.titre} · ${s.titre}`,
        });
      }
    }
  }
  return out;
}

export function AccesRapide({
  groupes,
  administration,
  items,
  reprises,
  avant,
}: {
  groupes: GroupeRail[];
  administration: GroupeRail | null;
  items: ItemAttente[];
  reprises: ReprisePossible[];
  /**
   * Bloc placé en tête du panneau. Avant connexion, il porte le contenu du
   * volet d'accueil : sous 62 rem, le volet permanent est masqué, et sans lui
   * ce qu'il faut savoir avant d'entrer disparaîtrait du téléphone.
   */
  avant?: React.ReactNode;
}) {
  const menu = useContext(ContexteMenu);
  const router = useRouter();
  const ouvert = menu?.ouvert ?? false;
  const panneau = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [filtre, setFiltre] = useState("");
  const [choisi, setChoisi] = useState(0);
  // Repère de lecture : local au poste, lu à l'ouverture seulement — jamais au
  // premier rendu, qui doit être identique côté serveur et côté navigateur.
  const [lecture, setLecture] = useState<ReprisePossible | null>(null);
  const titreId = useId();

  const toutes: Entree[] = useMemo(() => {
    const r: Entree[] = [...(lecture ? [lecture] : []), ...reprises].map((x) => ({
      cle: `reprendre:${x.nature}`,
      zone: "reprendre",
      libelle: x.libelle,
      detail: x.detail,
      href: x.href,
    }));
    const f: Entree[] = items.map((i) => ({
      cle: `faire:${i.cle}`,
      zone: "faire",
      libelle: i.libelle,
      href: i.href,
      nombre: i.nombre,
    }));
    return [...r, ...f, ...entreesDuVolet(groupes, administration)];
  }, [lecture, reprises, items, groupes, administration]);

  const visibles = useMemo(() => {
    const q = sansAccent(filtre.trim());
    if (!q) return toutes;
    return toutes.filter((e) => sansAccent(`${e.libelle} ${e.groupe ?? ""}`).includes(q));
  }, [toutes, filtre]);

  // Le panneau s'ouvre : état remis à zéro, focus posé, défilement du corps figé.
  useEffect(() => {
    if (!ouvert) return;
    setFiltre("");
    setChoisi(0);
    try {
      const brut = localStorage.getItem(DERNIER);
      const d = brut ? (JSON.parse(brut) as DernierModule) : null;
      setLecture(
        d && d.module && d.titre
          ? {
              nature: "lecture",
              libelle: d.titre,
              detail: `lecture, section ${d.num} sur ${d.total}`,
              href: `/module/${d.module}`,
            }
          : null,
      );
    } catch {
      setLecture(null);
    }
    // Sur tactile, donner le focus au champ ouvre le clavier virtuel, qui mange
    // la moitié de l'écran avant qu'on ait rien demandé : on vise le panneau.
    const tactile = window.matchMedia("(pointer: coarse)").matches;
    const cible = tactile ? panneau.current : champ.current;
    cible?.focus({ preventScroll: true });
    document.body.classList.add("menu-ouvert");
    return () => document.body.classList.remove("menu-ouvert");
  }, [ouvert]);

  // Clavier : ouverture par ⌘K / Ctrl+K et par « / », fermeture par Échap,
  // tabulation enfermée, flèches et entrée. Un seul écouteur, sur le document.
  useEffect(() => {
    const dansUnChamp = (c: EventTarget | null) => {
      const el = c as HTMLElement | null;
      if (!el) return false;
      const t = el.tagName;
      return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
    };
    const auClavier = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        menu?.basculer();
        return;
      }
      if (!ouvert && e.key === "/" && !dansUnChamp(e.target)) {
        e.preventDefault();
        menu?.ouvrir();
        return;
      }
      if (!ouvert) return;
      if (e.key === "Escape") {
        e.preventDefault();
        menu?.fermer();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setChoisi((i) => {
          const n = visibles.length;
          if (n === 0) return 0;
          return e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
        });
        return;
      }
      if (e.key === "Enter") {
        const cible = visibles[choisi] ?? visibles[0];
        if (!cible) return;
        e.preventDefault();
        menu?.fermer();
        router.push(cible.href);
        return;
      }
      if (e.key === "Tab" && panneau.current) {
        // WCAG 2.1.2 : la tabulation ne sort pas du panneau, et Échap sort
        // toujours — ce n'est donc pas un piège au clavier.
        const focusables = panneau.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const premier = focusables[0];
        const dernier = focusables[focusables.length - 1];
        const actif = document.activeElement;
        if (e.shiftKey && (actif === premier || actif === panneau.current)) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && actif === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [ouvert, menu, visibles, choisi, router]);

  if (!menu) return null;

  const zone = (nom: Entree["zone"]) => visibles.filter((e) => e.zone === nom);
  const reprendre = zone("reprendre");
  const aFaire = zone("faire");
  const allerA = zone("aller");
  const rang = (e: Entree) => visibles.indexOf(e);
  const classe = (e: Entree) => `ar-item${rang(e) === choisi ? " ar-item--choisi" : ""}`;

  const suivre = () => menu.fermer();

  return (
    <>
      <div
        className={`ar-voile${ouvert ? " ar-voile--visible" : ""}`}
        onClick={menu.fermer}
        aria-hidden="true"
      />
      <div
        ref={panneau}
        id="acces-rapide"
        className={`acces-rapide${ouvert ? " acces-rapide--ouvert" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
      >
        <div className="ar-entete">
          <h2 id={titreId} className="sur-titre">Accès rapide</h2>
          <button type="button" className="ar-fermer" onClick={menu.fermer} aria-label="Fermer l'accès rapide">
            ×
          </button>
        </div>

        <div className="ar-recherche">
          <input
            ref={champ}
            type="search"
            value={filtre}
            onChange={(e) => {
              setFiltre(e.target.value);
              setChoisi(0);
            }}
            placeholder="Rechercher un écran…"
            aria-label="Rechercher un écran"
            autoComplete="off"
          />
          <span className="ar-raccourci" aria-hidden="true">⌘K</span>
        </div>

        <div className="ar-fixe">
          {avant}

          {/* Zone absente s'il n'y a rien à reprendre : un cadre vide coûte une
              lecture pour un renseignement nul. */}
          {reprendre.length > 0 && (
            <section className="ar-zone">
              <h3 className="sur-titre">Reprendre</h3>
              {reprendre.map((e) => (
                <Link
                  key={e.cle}
                  href={e.href}
                  className={classe(e)}
                  onClick={suivre}
                  onMouseEnter={() => setChoisi(rang(e))}
                >
                  <span className="ar-libelle">{e.libelle}</span>
                  <span className="ar-detail">{e.detail}</span>
                </Link>
              ))}
            </section>
          )}

          {/* Zone entière absente pour un profil de poste : un apprenant n'a pas
              de file d'attente, et lui en montrer une vide lui apprendrait
              seulement qu'il est surveillé. */}
          {items.length > 0 && (
            <section className="ar-zone">
              <h3 className="sur-titre">À faire</h3>
              {aFaire.length === 0 ? (
                <p className="ar-vide">Aucun de ces écrans ne correspond au filtre.</p>
              ) : (
                aFaire.map((e) => (
                  <Link
                    key={e.cle}
                    href={e.href}
                    className={`${classe(e)}${e.nombre === 0 ? " ar-item--nul" : ""}`}
                    onClick={suivre}
                    onMouseEnter={() => setChoisi(rang(e))}
                    aria-label={nomAccessible({ libelle: e.libelle, nombre: e.nombre ?? 0 })}
                  >
                    <span className="ar-libelle">{e.libelle}</span>
                    <span className="ar-compte" aria-hidden="true">{e.nombre}</span>
                  </Link>
                ))
              )}
            </section>
          )}

        </div>

        <div className="ar-defilant">
          <section className="ar-zone">
            <h3 className="sur-titre">Aller à</h3>
            {allerA.length === 0 ? (
              <p className="ar-vide">Aucun écran ne correspond à « {filtre} ».</p>
            ) : (
              allerA.map((e, i) => (
                <div key={e.cle}>
                  {e.groupe && e.groupe !== allerA[i - 1]?.groupe ? (
                    <span className="ar-groupe">{e.groupe}</span>
                  ) : null}
                  <Link
                    href={e.href}
                    className={classe(e)}
                    onClick={suivre}
                    onMouseEnter={() => setChoisi(rang(e))}
                  >
                    <span className="ar-libelle">{e.libelle}</span>
                  </Link>
                </div>
              ))
            )}
          </section>

          {/* Sous 62 rem le volet permanent est masqué : sans ce rappel, le
              bouton « Revoir la présentation » deviendrait inatteignable sur
              tablette et téléphone. Rend `null` hors session. Le clic ferme
              aussi le panneau, sinon la visite s'ouvrirait derrière lui. */}
          <div onClick={suivre}>
            <BoutonRevoirTutoriel />
          </div>
        </div>
      </div>
    </>
  );
}
