"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { ContexteMenu } from "./Menu";
import type { GroupeRail } from "./Navigation";
import { PictoMenu, type ThemeMenu } from "./PictoMenu";
import { nomAccessible, totalEnAttente, type ItemAttente } from "@/content/acces-rapide";
import { groupePorteLaPage, relevePage } from "@/lib/rail";
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
 * Une seule surface, un tiroir à gauche à toutes les tailles (question 61,
 * choix a) : sous 62 rem, le volet permanent est masqué et le tiroir le
 * remplace ; au-dessus, il se pose sur la colonne du volet et laisse la page
 * découverte, ni assombrie ni floutée — le panneau centré sur un voile gênait
 * la lecture. Un clic sur la page le ferme. La feuille de style décide ; le
 * balisage, les intitulés et l'ordre sont les mêmes.
 *
 * Écart assumé avec le § 5.2 de la spécification, qui annonçait un panneau
 * « qui ne répète pas la navigation » sur poste : « Aller à » y figure quand
 * même. Un lanceur dont la recherche n'atteint pas les écrans n'est pas un
 * lanceur, et la main n'a pas à quitter le clavier pour rejoindre le volet.
 *
 * « Aller à » en accordéon (choix b du 23/09/2026) : chaque groupe est un
 * bandeau qui se replie, et seul celui de la page courante s'ouvre de lui-même
 * — la règle de la barre latérale (`lib/rail.ts`). Un groupe ouvert ou fermé à
 * la main le reste jusqu'au rechargement de la page. Pendant une recherche,
 * tous les groupes qui ont un résultat sont ouverts. L'onglet RGPD reste une
 * entrée directe.
 *
 * « À faire » repliable (question 75, choix a, 25/09/2026) : sur téléphone, la
 * partie fixe laissait à « Aller à » 161 px sur un iPhone 15, 55 px sur un
 * iPhone SE. Replié, l'intitulé porte le total de la file ; l'état est gardé
 * sur le poste, comme le mode zone. Pendant une recherche, ses résultats
 * s'affichent quand même, comme ceux d'un groupe replié.
 *
 * Sous-menus d'administration (question 76, choix a, 25/09/2026) : « Administration · »
 * ouvrait quatre bandeaux de suite et les faisait passer sur deux lignes sur
 * poste ; un pictogramme en tient lieu. Le mot reste dans le nom lu et dans la
 * recherche ; le volet de poste garde son groupe « Administration ».
 *
 * Un pictogramme par thème (question 77, choix a, 25/09/2026) : chaque bandeau
 * porte celui de son thème (`components/PictoMenu.tsx`), le même que dans le
 * volet de poste ; l'entrée RGPD, le cadenas. L'écusson ne reste que sur le
 * groupe « Administration » du volet, seul endroit où ce groupe a un intitulé.
 */

/** Repli de « À faire », mémorisé sur le poste seulement. */
const REPLI_A_FAIRE = "fp-a-faire-replie";

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
  /** Groupe repliable de « Aller à » ; absent pour une entrée directe (onglet RGPD). */
  repli?: { cle: string; porteLaPage: boolean };
  /** Sous-menu d'administration : le pictogramme tient lieu du nom du groupe (question 76). */
  administration?: { groupe: string; sousMenu: string };
  /** Pictogramme du thème (question 77) : celui du groupe, du sous-menu ou de l'entrée directe. */
  picto?: ThemeMenu;
}

const sansAccent = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Aplatit le volet en une liste de liens, groupe par groupe, dans l'ordre du volet. */
function entreesDuVolet(groupes: GroupeRail[], administration: GroupeRail | null, chemin: string): Entree[] {
  const out: Entree[] = [];
  // Même ordre que le volet : les onglets (RGPD) ferment la liste.
  const ordre = [
    ...groupes.filter((g) => !g.onglet),
    ...(administration ? [administration] : []),
    ...groupes.filter((g) => g.onglet),
  ];
  for (const g of ordre) {
    if (g.onglet) {
      // Entrée directe, comme l'onglet du volet : l'intitulé du groupe, puis
      // celui de la page. Les deux restent dans le texte que filtre la recherche.
      const l = g.liens?.[0];
      if (l) out.push({ cle: `${g.id}:${l.href}`, zone: "aller", libelle: g.titre, detail: l.libelle, href: l.href, groupe: l.libelle, picto: g.id });
      continue;
    }
    const repli = { cle: g.id, porteLaPage: groupePorteLaPage(g.id, chemin) };
    for (const l of g.liens ?? []) {
      out.push({ cle: `${g.id}:${l.href}`, zone: "aller", libelle: l.libelle, href: l.href, groupe: g.titre, repli, picto: g.id });
    }
    for (const s of g.sous ?? []) {
      // Un sous-menu d'administration est un groupe du Menu, ouvert s'il porte
      // la page courante — la règle des sous-menus de la barre latérale.
      const repliSous = { cle: `${g.id}/${s.titre}`, porteLaPage: s.liens.some((l) => relevePage(chemin, l.href)) };
      for (const l of s.liens) {
        out.push({
          cle: `${g.id}:${s.titre}:${l.href}`,
          zone: "aller",
          libelle: l.libelle,
          href: l.href,
          groupe: `${g.titre} · ${s.titre}`,
          repli: repliSous,
          picto: s.picto,
          ...(g.id === "administration" ? { administration: { groupe: g.titre, sousMenu: s.titre } } : {}),
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
  const chemin = usePathname();
  const ouvert = menu?.ouvert ?? false;
  const panneau = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [filtre, setFiltre] = useState("");
  const [choisi, setChoisi] = useState(0);
  // La présélection sert le clavier (flèches, Entrée) : sur écran tactile, elle
  // surlignait un lien que personne n'avait choisi, comme s'il était la page
  // en cours. Elle ne s'affiche qu'avec un pointeur fin, ou dès qu'on tape.
  const [presel, setPresel] = useState(false);
  // Groupes ouverts ou fermés à la main ; les autres suivent la page courante.
  const [replis, setReplis] = useState<Record<string, boolean>>({});
  // « À faire » replié : lu à l'ouverture, comme le repère de lecture.
  const [faireReplie, setFaireReplie] = useState(false);
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
    return [...r, ...f, ...entreesDuVolet(groupes, administration, chemin)];
  }, [lecture, reprises, items, groupes, administration, chemin]);

  const recherche = filtre.trim() !== "";
  const visibles = useMemo(() => {
    const q = sansAccent(filtre.trim());
    if (!q) return toutes;
    return toutes.filter((e) => sansAccent(`${e.libelle} ${e.groupe ?? ""}`).includes(q));
  }, [toutes, filtre]);

  // Pendant une recherche, tout groupe qui a un résultat est ouvert — « À faire » aussi.
  const groupeOuvert = (r: NonNullable<Entree["repli"]>) => recherche || (replis[r.cle] ?? r.porteLaPage);
  const faireDeplie = recherche || !faireReplie;
  // Les flèches et Entrée ne parcourent que les liens affichés.
  const navigables = useMemo(
    () =>
      visibles.filter((e) =>
        e.zone === "faire" ? faireDeplie : !e.repli || recherche || (replis[e.repli.cle] ?? e.repli.porteLaPage),
      ),
    [visibles, recherche, replis, faireDeplie],
  );

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
    try {
      setFaireReplie(localStorage.getItem(REPLI_A_FAIRE) === "1");
    } catch {
      setFaireReplie(false);
    }
    // Sur tactile, donner le focus au champ ouvre le clavier virtuel, qui mange
    // la moitié de l'écran avant qu'on ait rien demandé : on vise le panneau.
    const tactile = window.matchMedia("(pointer: coarse)").matches;
    setPresel(!tactile);
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
        setPresel(true);
        setChoisi((i) => {
          const n = navigables.length;
          if (n === 0) return 0;
          return e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
        });
        return;
      }
      if (e.key === "Enter") {
        // Entrée sur un lien ou un bouton du panneau (un intitulé de groupe)
        // garde son effet propre : ouvrir ce lien, replier ce groupe.
        const surCible = (e.target as HTMLElement | null)?.closest?.("a[href], button");
        if (surCible && panneau.current?.contains(surCible)) return;
        const cible = navigables[choisi] ?? navigables[0];
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
  }, [ouvert, menu, navigables, choisi, router]);

  if (!menu) return null;

  const zone = (nom: Entree["zone"]) => visibles.filter((e) => e.zone === nom);
  const reprendre = zone("reprendre");
  const aFaire = zone("faire");
  const allerA = zone("aller");
  const rang = (e: Entree) => navigables.indexOf(e);
  const classe = (e: Entree) => `ar-item${presel && rang(e) === choisi ? " ar-item--choisi" : ""}`;

  // « Aller à » : liens consécutifs d'un même groupe réunis sous son intitulé.
  const blocs: {
    cle: string;
    titre: string;
    repli?: Entree["repli"];
    administration?: Entree["administration"];
    picto?: ThemeMenu;
    entrees: Entree[];
  }[] = [];
  for (const e of allerA) {
    const cle = e.repli?.cle ?? e.cle;
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.cle === cle) dernier.entrees.push(e);
    else blocs.push({ cle, titre: e.groupe ?? "", repli: e.repli, administration: e.administration, picto: e.picto, entrees: [e] });
  }
  // Intitulé d'un bandeau : le pictogramme de son thème, puis son nom. Sous-menu
  // d'administration : le seul nom du sous-menu à l'écran, le nom complet pour
  // le lecteur d'écran.
  const intitule = (b: (typeof blocs)[number]) => (
    <span className="ar-groupe-titre">
      {b.picto ? <PictoMenu theme={b.picto} /> : null}
      {b.administration ? (
        <>
          <span className="lecture-seule">{b.administration.groupe} · </span>
          <span className="ar-groupe-court">{b.administration.sousMenu}</span>
        </>
      ) : (
        b.titre
      )}
    </span>
  );
  const lienAller = (e: Entree) => (
    <Link
      key={e.cle}
      href={e.href}
      className={classe(e)}
      onClick={suivre}
      onMouseEnter={() => setChoisi(rang(e))}
    >
      {/* Entrée directe (onglet RGPD) : son pictogramme en tête, faute de bandeau. */}
      {!e.repli && e.picto ? <PictoMenu theme={e.picto} /> : null}
      <span className="ar-libelle">{e.libelle}</span>
      {e.detail ? <span className="ar-detail">{e.detail}</span> : null}
    </Link>
  );

  const suivre = () => menu.fermer();

  // Total de la file, porté par l'intitulé replié : le repli n'efface pas le compteur.
  const total = totalEnAttente(items);
  const basculerAFaire = () => {
    const replie = !faireReplie;
    setFaireReplie(replie);
    try {
      if (replie) localStorage.setItem(REPLI_A_FAIRE, "1");
      else localStorage.removeItem(REPLI_A_FAIRE);
    } catch {
      // stockage refusé : le repli vaut pour cette ouverture seulement
    }
  };

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
              setPresel(true);
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
                  className={`${classe(e)} ar-item--reprise`}
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
            <section className="ar-zone ar-zone--faire">
              {/* Pendant une recherche, la zone reste ouverte : l'intitulé
                  n'est plus qu'un titre, comme celui d'un groupe. */}
              {recherche ? (
                <h3 className="sur-titre">À faire</h3>
              ) : (
                <h3 className="sur-titre ar-titre-repli">
                  <button
                    type="button"
                    className="ar-repli"
                    aria-expanded={!faireReplie}
                    aria-controls={`${titreId}-faire`}
                    onClick={basculerAFaire}
                  >
                    <span className="ar-repli-titre">À faire</span>
                    {faireReplie ? (
                      <>
                        <span className={`ar-compte${total === 0 ? " ar-compte--nul" : ""}`} aria-hidden="true">
                          {total}
                        </span>
                        <span className="lecture-seule">, {total === 0 ? "aucun" : `${total} en attente`}</span>
                      </>
                    ) : null}
                    <span className="ar-chevron" aria-hidden="true" />
                  </button>
                </h3>
              )}
              <div id={`${titreId}-faire`} className="ar-zone-liens" hidden={!faireDeplie}>
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
              </div>
            </section>
          )}

        </div>

        <div className="ar-defilant">
          <section className="ar-zone">
            <h3 className="sur-titre">Aller à</h3>
            {allerA.length === 0 ? (
              <p className="ar-vide">Aucun écran ne correspond à « {filtre} ».</p>
            ) : (
              blocs.map((b) => {
                const repli = b.repli;
                if (!repli) return b.entrees.map(lienAller);
                const deplie = groupeOuvert(repli);
                const idListe = `${titreId}-${b.cle.replace(/[^a-z0-9]+/gi, "-")}`;
                return (
                  <div key={b.cle} className="ar-bloc">
                    {/* Pendant une recherche, les groupes restent ouverts :
                        l'intitulé n'est plus qu'un titre. */}
                    {recherche ? (
                      <span className="ar-groupe">{intitule(b)}</span>
                    ) : (
                      <button
                        type="button"
                        className="ar-groupe"
                        aria-expanded={deplie}
                        aria-controls={idListe}
                        onClick={() => setReplis((r) => ({ ...r, [repli.cle]: !deplie }))}
                      >
                        {intitule(b)}
                        <span className="ar-chevron" aria-hidden="true" />
                      </button>
                    )}
                    <div id={idListe} className="ar-groupe-liens" hidden={!deplie}>
                      {b.entrees.map(lienAller)}
                    </div>
                  </div>
                );
              })
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
