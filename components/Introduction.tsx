"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Introduction animée à l'ouverture du site (demande du 27/09/2026 :
 * « applique ce prompt pour générer une animation à l'ouverture avec le logo
 * du site » — « Make a dynamic 15-second motion graphics video that shows what
 * an incredible motion designer you are, like it's your showreel for a résumé.
 * Go all out »).
 *
 * Quinze secondes en cinq temps, sur le papier du logo (#F8F4EB) :
 *  1. une goutte tombe dans la fiole du centre du logo ; les rayons et les
 *     circuits en partent, des gouttes de couleur éclosent en aquarelle ;
 *  2. le nom du site, « Formation & habilitation », en typographie animée ;
 *  3. le mandala se peint — ruban, pétales, anneau cuivre, flèches,
 *     hexagones —, puis le logo paraît à sa place, par un diaphragme ;
 *  4. le logo entier : emblème, nom « pharmacotechnie » tracé de gauche à
 *     droite, ligne d'unité ;
 *  5. l'emblème gagne sa place dans l'en-tête pendant que le papier se replie
 *     sur lui : l'introduction rend la main au site.
 *
 * Le logo n'est ni redessiné ni recoloré (charte, `globals.css`) : les trois
 * images viennent du fichier fourni le 18/09/2026 (`pharmaco-logo.jpg`),
 * recadré et détouré du papier, rien d'autre. Ce qui se peint avant lui en est
 * une évocation, relevée sur l'emblème, et s'efface quand il paraît.
 *
 * Quand : une fois par session de navigation. Le gabarit rend l'introduction
 * tant que le cookie `fp_intro` manque ; ce composant le pose à son montage —
 * cookie de session, valeur « 1 », rien d'autre. Recharger la page pendant
 * l'animation ne la rejoue pas.
 *
 * Toujours passable : une touche n'importe où, la molette, ou le bouton
 * « Passer l'introduction ». Le bouton ne paraît qu'à la demande (27/09/2026) :
 * un clic ou un toucher pendant la séquence floute le pourtour de l'écran et
 * le montre en bas à droite, aux couleurs du site. Le clic ne passe jamais
 * lui-même (question 82) : pendant le vol final, le bouton déjà sorti, il ne
 * fait rien et l'introduction finit seule. La touche frappée
 * n'est pas perdue — sauf Échap, Entrée et Espace, qui ne servent alors qu'à
 * passer — : sur la page de connexion, le premier caractère du code entre dans
 * le champ. Au clavier, le bouton est le premier arrêt et paraît avec le
 * focus ; aller au-delà termine l'introduction, pour qu'aucun élément ne
 * prenne le focus sous elle (WCAG 2.2, critère 2.4.11).
 *
 * Jamais jouée : mouvement réduit demandé, contraste forcé, impression
 * (`globals.css`). Le décor est `aria-hidden` : une aide technique n'entend que
 * le bouton. Onglet ouvert en arrière-plan : l'animation attend d'être vue.
 *
 * Toute la chronologie tient dans `TEMPS` : chaque valeur devient une variable
 * CSS `--t-…` de la racine, que les règles de `globals.css` prennent pour
 * délai. Les éléments répétés reçoivent le leur en `--d`.
 */

/** Chronologie, en secondes depuis l'ouverture. */
const TEMPS = {
  fiole: 0.05,
  goutte: 0.45,
  impact: 0.95,
  rayons: 1.2,
  circuits: 1.5,
  couleurs: 1.65,
  recul: 2.45,
  formation: 2.75,
  formationSortie: 4.05,
  esperluette: 3.95,
  remplissage: 4.45,
  esperluetteRecul: 5.2,
  habilitation: 5.25,
  habilitationSortie: 6.45,
  esperluetteSortie: 6.4,
  retour: 6.55,
  pulsation: 7.0,
  ruban: 7.1,
  taches: 7.15,
  petales: 7.25,
  anneau: 7.85,
  fleches: 8.05,
  hexagones: 8.15,
  diaphragme: 8.8,
  eclats: 9.0,
  effacement: 9.05,
  reflet: 9.85,
  montee: 10.45,
  nom: 10.95,
  unite: 11.75,
  bouton: 13.0,
  sortieTextes: 13.1,
  vol: 13.3,
  repli: 13.5,
  fondu: 14.45,
  fin: 15,
} as const;

/** Chute d'une goutte jusqu'à l'impact (`intro-chute` : 80 % de 0,62 s). */
const CHUTE = 0.5;

/** Temps 4 : l'emblème monte d'une fraction de sa taille et se réduit. */
const MONTEE = 0.125;
const REDUCTION = 0.6;

type Etat = "joue" | "passe" | "fini";
type Couleur = "sarcelle" | "rose" | "safran" | "prune";
type Point = readonly [number, number];

const COOKIE = "fp_intro";

// ─────────────────────────────── géométrie, relevée sur l'emblème (640 × 640)

/** Centre de la fiole. */
const C: Point = [320, 318];

/** Nœuds des huit rayons, dans le sens horaire depuis le haut. */
const NOEUDS: Point[] = [
  [320, 222], [383, 272], [406, 313], [383, 356],
  [320, 390], [257, 356], [236, 313], [259, 272],
];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Rayon : du bord de la fiole (du col, en haut) au bord du nœud ; angle en degrés depuis le haut. */
function rayon([x, y]: Point, i: number) {
  const dx = x - C[0];
  const dy = y - C[1];
  const l = Math.hypot(dx, dy);
  const ux = dx / l;
  const uy = dy / l;
  const depart = i === 0 ? 72 : 42;
  const fin = l - 14;
  return {
    d: `M ${r1(C[0] + ux * depart)} ${r1(C[1] + uy * depart)} L ${r1(C[0] + ux * fin)} ${r1(C[1] + uy * fin)}`,
    angle: r1((Math.atan2(ux, -uy) * 180) / Math.PI),
  };
}

const RAYONS = NOEUDS.map(rayon);

/** Circuits d'un pétale, dans le repère d'un nœud (vers l'extérieur = −y) ; extrémités creuses. */
const CIRCUIT = [
  { d: "M 0 -14 V -66", bout: [0, -73] as Point, r: 7, decalage: 0 },
  { d: "M 0 -30 L -18 -48 V -92", bout: [-18, -99] as Point, r: 6, decalage: 0.08 },
  { d: "M 0 -40 L 16 -56 V -80", bout: [16, -87] as Point, r: 6, decalage: 0.14 },
];

/** Pétales : arc extérieur, arc intérieur, surface (repère du centre, pointe vers −y). */
const PETALE_GRAND = {
  ext: "M -88 -58 C -150 -118 -44 -196 0 -244 C 44 -196 150 -118 88 -58",
  int: "M -70 -68 C -122 -118 -36 -182 0 -222 C 36 -182 122 -118 70 -68",
  fond: "M -88 -58 C -150 -118 -44 -196 0 -244 C 44 -196 150 -118 88 -58 Q 0 -22 -88 -58 Z",
};
const PETALE_PETIT = {
  ext: "M -60 -80 C -110 -126 -30 -178 0 -214 C 30 -178 110 -126 60 -80",
  int: "M -46 -88 C -86 -126 -24 -166 0 -196 C 24 -166 86 -126 46 -88",
  fond: "M -60 -80 C -110 -126 -30 -178 0 -214 C 30 -178 110 -126 60 -80 Q 0 -48 -60 -80 Z",
};
/** Petits pétales d'abord (dessous), teinte d'aquarelle alternée. */
const PETALES = [
  ...[45, 135, 225, 315].map((angle, i) => ({ angle, forme: PETALE_PETIT, teinte: (["rose", "safran", "rose", "sarcelle"] as const)[i], rang: i })),
  ...[0, 90, 180, 270].map((angle, i) => ({ angle, forme: PETALE_GRAND, teinte: "papier" as const, rang: i + 4 })),
];

/** Flèches montantes, en haut à droite : fût puis pointe. */
const FLECHES = [
  { fut: "M 430 162 L 474 124", pointe: "M 461 114 L 489 108 L 483 136 Z" },
  { fut: "M 468 172 L 516 124", pointe: "M 503 114 L 532 106 L 526 135 Z" },
  { fut: "M 468 236 L 520 184", pointe: "M 507 174 L 536 166 L 530 195 Z" },
];
const BARRES = [
  { x: 394, y: 143, h: 15 },
  { x: 407, y: 133, h: 25 },
  { x: 420, y: 122, h: 36 },
];

/** Hexagone « pointe en haut ». */
function hexagone(cx: number, cy: number, r: number) {
  const p = [0, 60, 120, 180, 240, 300].map((a) => {
    const t = (a * Math.PI) / 180;
    return `${r1(cx + r * Math.sin(t))} ${r1(cy - r * Math.cos(t))}`;
  });
  return `M ${p.join(" L ")} Z`;
}
const HEXAGONES = [hexagone(410, 492, 38), hexagone(372, 516, 28)];

/** Taches d'aquarelle, en % de la toile ; `t` : début de l'éclosion. */
const TACHES: { c: Couleur; x: number; y: number; w: number; h: number; t: number; forme: string }[] = [
  { c: "sarcelle", x: 50, y: 50, w: 40, h: 38, t: TEMPS.impact, forme: "58% 42% 55% 45% / 45% 58% 42% 55%" },
  { c: "rose", x: 15, y: 55, w: 20, h: 36, t: TEMPS.couleurs + CHUTE, forme: "46% 54% 40% 60% / 55% 45% 55% 45%" },
  { c: "safran", x: 86, y: 52, w: 19, h: 34, t: TEMPS.couleurs + 0.1 + CHUTE, forme: "55% 45% 62% 38% / 42% 56% 44% 58%" },
  { c: "prune", x: 12, y: 44, w: 7, h: 7, t: TEMPS.couleurs + 0.2 + CHUTE, forme: "50% 50% 46% 54% / 52% 48% 52% 48%" },
  { c: "rose", x: 27, y: 21, w: 14, h: 16, t: TEMPS.taches, forme: "60% 40% 52% 48% / 44% 60% 40% 56%" },
  { c: "safran", x: 41, y: 12, w: 9, h: 13, t: TEMPS.taches + 0.1, forme: "50% 50% 40% 60% / 60% 50% 50% 40%" },
  { c: "safran", x: 31, y: 84, w: 13, h: 16, t: TEMPS.taches + 0.2, forme: "44% 56% 58% 42% / 50% 42% 58% 50%" },
  { c: "rose", x: 63, y: 81, w: 19, h: 16, t: TEMPS.taches + 0.3, forme: "56% 44% 48% 52% / 40% 58% 42% 60%" },
  { c: "safran", x: 72, y: 88, w: 11, h: 12, t: TEMPS.taches + 0.4, forme: "52% 48% 44% 56% / 58% 44% 56% 42%" },
  { c: "safran", x: 85, y: 70, w: 13, h: 18, t: TEMPS.taches + 0.5, forme: "48% 52% 60% 40% / 46% 54% 46% 54%" },
  { c: "rose", x: 86, y: 29, w: 10, h: 10, t: TEMPS.taches + 0.6, forme: "58% 42% 50% 50% / 50% 60% 40% 50%" },
  { c: "prune", x: 79, y: 77, w: 8, h: 7, t: TEMPS.taches + 0.7, forme: "52% 48% 44% 56% / 50% 50% 50% 50%" },
];

/** Gouttes qui tombent : la première dans le col de la fiole, les autres sur leurs taches. */
const GOUTTES: { c: Couleur; x: number; y: number; t: number }[] = [
  { c: "sarcelle", x: 50, y: 38.6, t: TEMPS.goutte },
  { c: "rose", x: 15, y: 55, t: TEMPS.couleurs },
  { c: "safran", x: 86, y: 52, t: TEMPS.couleurs + 0.1 },
  { c: "prune", x: 12, y: 44, t: TEMPS.couleurs + 0.2 },
];

/** Éclats projetés à l'apparition du logo. */
const ECLATS = Array.from({ length: 16 }, (_, i) => ({
  angle: i * 22.5 + 11.25,
  c: (["rose", "safran", "sarcelle", "prune"] as const)[i % 4],
  retard: (i % 4) * 0.04 + (i % 3) * 0.03,
  portee: 0.58 + (i % 3) * 0.05,
}));

const FORMATION = [..."Formation"];
const HABILITATION = [..."habilitation"];
const MILIEU = (HABILITATION.length - 1) / 2;

// ─────────────────────────────────────────────────────────────── utilitaires

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Variables `--t-…` de la racine, tirées de `TEMPS`. */
const VARIABLES_TEMPS = Object.fromEntries(
  Object.entries(TEMPS).map(([cle, s]) => [`--t-${kebab(cle)}`, `${s}s`]),
) as React.CSSProperties;

const d = (s: number) => ({ "--d": `${r1(s * 1000) / 1000}s` }) as React.CSSProperties;

function Goutte() {
  return (
    <svg viewBox="0 0 20 28" aria-hidden="true">
      <path d="M 10 0 C 10 0 20 13 20 18.5 A 10 10 0 0 1 0 18.5 C 0 13 10 0 10 0 Z" fill="currentColor" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────── composant

export function Introduction({ afficher }: { afficher: boolean }) {
  // Figé au premier rendu : un rendu serveur ultérieur (action, navigation)
  // arrive avec le cookie posé et `afficher` faux ; il ne coupe pas
  // l'animation en cours.
  const [etat, setEtat] = useState<Etat>(afficher ? "joue" : "fini");
  const [attente, setAttente] = useState(false);
  // Pourtour flouté et bouton montrés : clic, toucher ou focus sur le bouton.
  const [revele, setRevele] = useState(false);
  const auMontage = useRef(afficher);
  const racine = useRef<HTMLDivElement>(null);
  const boite = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  // Le bouton sort avec le vol final (`--t-bouton`) : un clic n'y fait plus rien.
  const boutonSorti = useRef(false);

  const passer = useCallback(() => setEtat((e) => (e === "joue" ? "passe" : e)), []);

  // Cookie de session, mouvement réduit, onglet caché.
  useEffect(() => {
    if (!auMontage.current) return;
    try {
      document.cookie = `${COOKIE}=1; path=/; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    } catch {
      // Cookie refusé : l'introduction se rejouera à la prochaine page chargée.
    }
    if (matchMedia("(prefers-reduced-motion: reduce), (forced-colors: active)").matches) {
      setEtat("fini");
      return;
    }
    const vue = () => setAttente(document.visibilityState === "hidden");
    vue();
    document.addEventListener("visibilitychange", vue);
    return () => document.removeEventListener("visibilitychange", vue);
  }, []);

  // Vol final : de la place de l'emblème au temps 4 jusqu'au logo de l'en-tête.
  useEffect(() => {
    if (etat !== "joue") return;
    const mesurer = () => {
      const r = racine.current;
      const b = boite.current;
      if (!r || !b) return;
      const s = b.offsetWidth;
      const ox = r.clientWidth / 2;
      const oy = r.clientHeight / 2 - MONTEE * s;
      const logo = document.querySelector<HTMLElement>(".entete .logos img.pharmaco");
      const c = logo?.getBoundingClientRect();
      if (c && c.width > 0 && c.bottom > 0 && c.top < r.clientHeight) {
        const cx = c.left + c.width / 2;
        const cy = c.top + c.height / 2;
        r.style.setProperty("--vol-x", `${r1(cx - ox)}px`);
        r.style.setProperty("--vol-y", `${r1(cy - oy)}px`);
        r.style.setProperty("--vol-s", `${Math.round((c.height / (REDUCTION * s)) * 1000) / 1000}`);
        r.style.setProperty("--cible-x", `${r1(cx)}px`);
        r.style.setProperty("--cible-y", `${r1(cy)}px`);
      } else {
        // Logo absent (téléphone étroit) ou hors de vue : repli vers le haut, défauts CSS.
        for (const p of ["--vol-x", "--vol-y", "--vol-s", "--cible-x", "--cible-y"]) r.style.removeProperty(p);
      }
    };
    mesurer();
    // L'en-tête peut encore bouger d'ici là (polices) : dernière mesure juste avant le vol.
    const avantVol = window.setTimeout(mesurer, (TEMPS.vol - 0.4) * 1000);
    window.addEventListener("resize", mesurer);
    return () => {
      window.clearTimeout(avantVol);
      window.removeEventListener("resize", mesurer);
    };
  }, [etat]);

  // Passer au clavier, ou en quittant l'introduction par tabulation. Seule la
  // tabulation compte : un focus posé par programme (visite guidée qui
  // s'ouvre) ne doit pas couper l'animation.
  useEffect(() => {
    if (etat !== "joue") return;
    let suivi = 0;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        suivi = window.setTimeout(() => {
          const actif = document.activeElement;
          if (actif && actif !== document.body && !racine.current?.contains(actif)) passer();
        }, 0);
        return;
      }
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
      if (e.target === bouton.current && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
      }
      passer();
    };
    window.addEventListener("keydown", auClavier, true);
    return () => {
      window.removeEventListener("keydown", auClavier, true);
      window.clearTimeout(suivi);
    };
  }, [etat, passer]);

  // Filet : si la fin d'animation n'arrive pas (onglet longtemps caché), on retire.
  useEffect(() => {
    if (etat === "fini" || attente) return;
    const t = window.setTimeout(() => setEtat("fini"), (etat === "passe" ? 1 : TEMPS.fin + 1.5) * 1000);
    return () => window.clearTimeout(t);
  }, [etat, attente]);

  if (etat === "fini") return null;

  return (
    <div
      ref={racine}
      className="intro"
      data-etat={etat}
      data-attente={attente ? "" : undefined}
      data-revele={revele ? "" : undefined}
      style={{ ...VARIABLES_TEMPS, "--montee": MONTEE, "--reduction": REDUCTION } as React.CSSProperties}
      onPointerDown={(e) => {
        if (e.target === bouton.current || bouton.current?.contains(e.target as Node)) return;
        if (!boutonSorti.current) setRevele(true);
      }}
      onWheel={passer}
      onAnimationStart={(e) => {
        if (e.animationName === "intro-bouton-sort") boutonSorti.current = true;
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && (e.animationName === "intro-fin" || e.animationName === "intro-sortie")) {
          setEtat("fini");
        }
      }}
    >
      <div className="intro-fond" />

      <div className="intro-scene" aria-hidden="true">
        {/* Temps 1 et 3 : la construction, calée sur l'emblème. */}
        <div className="intro-toile">
          <div className="intro-taches">
            {TACHES.map((t, i) => (
              <span
                key={i}
                className={`intro-tache intro-tache--${t.c}`}
                style={{
                  ...d(t.t),
                  left: `${t.x - t.w / 2}%`,
                  top: `${t.y - t.h / 2}%`,
                  width: `${t.w}%`,
                  height: `${t.h}%`,
                  borderRadius: t.forme,
                }}
              />
            ))}
          </div>

          <svg className="intro-dessin" viewBox="0 0 640 640">
            <defs>
              <clipPath id="intro-clip-fiole">
                <circle cx={C[0]} cy={C[1]} r={31} />
              </clipPath>
              <linearGradient id="intro-degrade-ruban" gradientUnits="userSpaceOnUse" x1="220" y1="90" x2="330" y2="590">
                <stop offset="0" stopColor="#665175" />
                <stop offset="1" stopColor="#9f737d" />
              </linearGradient>
              <linearGradient id="intro-degrade-anneau" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="0">
                <stop offset="0" stopColor="#9b6f62" />
                <stop offset="1" stopColor="#dcb8a8" />
              </linearGradient>
            </defs>

            {/* Temps 3 : ruban (dessous), pétales. */}
            <g className="intro-ruban">
              <path
                className="intro-trace"
                pathLength={1}
                style={d(TEMPS.ruban)}
                d="M 300 590 C 258 548 222 470 218 380 C 214 280 206 172 234 122 C 266 64 366 52 410 102 C 444 142 438 214 404 266"
              />
              <path className="intro-trace" pathLength={1} style={d(TEMPS.ruban + 0.75)} d="M 436 440 C 462 468 492 486 522 500" />
            </g>

            {PETALES.map((p) => (
              <g key={p.angle} transform={`translate(${C[0]} ${C[1]}) rotate(${p.angle})`}>
                <g className="intro-petale" style={d(TEMPS.petales + p.rang * 0.07)}>
                  <path className={`intro-petale-fond intro-petale-fond--${p.teinte}`} d={p.forme.fond} />
                  <path className="intro-trace intro-petale-ext" pathLength={1} style={d(TEMPS.petales + p.rang * 0.07 + 0.1)} d={p.forme.ext} />
                  <path className="intro-trace intro-petale-int" pathLength={1} style={d(TEMPS.petales + p.rang * 0.07 + 0.25)} d={p.forme.int} />
                </g>
              </g>
            ))}

            {/* Temps 1 : circuits, rayons, nœuds. */}
            {NOEUDS.map(([x, y], i) => (
              <g key={`c${i}`} transform={`translate(${x} ${y}) rotate(${RAYONS[i].angle})`}>
                {CIRCUIT.map((c, k) => (
                  <g key={k}>
                    <path className="intro-trace intro-circuit" pathLength={1} style={d(TEMPS.circuits + i * 0.035 + c.decalage)} d={c.d} />
                    <circle
                      className="intro-pop intro-bout"
                      cx={c.bout[0]}
                      cy={c.bout[1]}
                      r={c.r}
                      style={d(TEMPS.circuits + i * 0.035 + c.decalage + 0.38)}
                    />
                  </g>
                ))}
              </g>
            ))}
            {RAYONS.map((r, i) => (
              <path key={`r${i}`} className="intro-trace intro-rayon" pathLength={1} style={d(TEMPS.rayons + i * 0.04)} d={r.d} />
            ))}
            {NOEUDS.map(([x, y], i) => (
              <circle key={`n${i}`} className="intro-pop intro-noeud" cx={x} cy={y} r={12} style={d(TEMPS.rayons + i * 0.04 + 0.32)} />
            ))}

            {/* La fiole : onde de choc, liquide, contour. */}
            <circle className="intro-onde" cx={C[0]} cy={C[1]} r={40} style={d(TEMPS.impact)} />
            <circle className="intro-onde" cx={C[0]} cy={C[1]} r={40} style={d(TEMPS.impact + 0.16)} />
            <circle className="intro-onde" cx={C[0]} cy={C[1]} r={40} style={d(TEMPS.pulsation)} />
            <g className="intro-fiole">
              <circle className="intro-fiole-fond" cx={C[0]} cy={C[1]} r={38} />
              <g clipPath="url(#intro-clip-fiole)">
                <g className="intro-liquide">
                  <path
                    className="intro-vague intro-vague--claire"
                    d="M 240 314 q 12.5 -6 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 V 380 H 240 Z"
                  />
                  <path
                    className="intro-vague"
                    d="M 240 319 q 12.5 -6 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 V 380 H 240 Z"
                  />
                </g>
              </g>
              <path className="intro-trace intro-fiole-trait" pathLength={1} style={d(TEMPS.fiole)} d="M 312 281 A 38 38 0 1 0 328 281" />
              <path className="intro-trace intro-fiole-trait" pathLength={1} style={d(TEMPS.fiole + 0.3)} d="M 312 281 V 250 H 305" />
              <path className="intro-trace intro-fiole-trait" pathLength={1} style={d(TEMPS.fiole + 0.3)} d="M 328 281 V 250 H 335" />
            </g>

            {/* Temps 3 : anneau, flèches, barres, hexagones. */}
            <path
              className="intro-trace intro-anneau"
              pathLength={1}
              style={d(TEMPS.anneau)}
              d="M 320 6 A 305 314 0 0 1 320 634 A 305 314 0 0 1 320 6"
            />
            {FLECHES.map((f, i) => (
              <g key={`f${i}`}>
                <path className="intro-trace intro-fleche" pathLength={1} style={d(TEMPS.fleches + i * 0.08)} d={f.fut} />
                <path className="intro-pop intro-pointe" style={d(TEMPS.fleches + i * 0.08 + 0.32)} d={f.pointe} />
              </g>
            ))}
            {BARRES.map((b, i) => (
              <rect key={`b${i}`} className="intro-barre" x={b.x} y={b.y} width={8} height={b.h} style={d(TEMPS.fleches + 0.05 + i * 0.07)} />
            ))}
            {HEXAGONES.map((h, i) => (
              <g key={`h${i}`}>
                <path className="intro-hexagone-fond" d={h} style={d(TEMPS.hexagones + 0.3 + i * 0.1)} />
                <path className="intro-trace intro-hexagone" pathLength={1} style={d(TEMPS.hexagones + i * 0.1)} d={h} />
              </g>
            ))}
          </svg>

          <div className="intro-gouttes">
            {GOUTTES.map((g, i) => (
              <span
                key={i}
                className={`intro-goutte intro-couleur--${g.c}`}
                style={{ ...d(g.t), left: `${g.x}%`, top: `${g.y}%` }}
              >
                <Goutte />
              </span>
            ))}
          </div>
        </div>

        {/* Temps 2 : « Formation & habilitation ». */}
        <div className="intro-mots">
          <span className="intro-formation">
            {FORMATION.map((l, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                {l}
              </span>
            ))}
          </span>
          <span className="intro-esperluette">&amp;</span>
          <span className="intro-habilitation">
            {HABILITATION.map((l, i) => (
              <span
                key={i}
                style={
                  {
                    "--c": Math.abs(i - MILIEU),
                    "--e": MILIEU - Math.abs(i - MILIEU),
                    "--k": MILIEU - i,
                  } as React.CSSProperties
                }
              >
                {l}
              </span>
            ))}
          </span>
        </div>

        <div className="intro-eclats">
          {ECLATS.map((e, i) => (
            <span
              key={i}
              className={`intro-eclat intro-couleur--${e.c}`}
              style={
                {
                  ...d(TEMPS.eclats + e.retard),
                  "--a": `${e.angle}deg`,
                  "--portee": e.portee,
                } as React.CSSProperties
              }
            >
              <Goutte />
            </span>
          ))}
        </div>

        {/* Temps 3 à 5 : le logo, puis son vol vers l'en-tête. */}
        <div className="intro-vol">
          <div className="intro-monte" ref={boite}>
            <div className="intro-embleme">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pharmaco-embleme.webp" alt="" width={640} height={640} draggable={false} />
              <span className="intro-reflet" />
            </div>
          </div>
        </div>

        <div className="intro-legende">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="intro-nom" src="/pharmaco-nom.webp" alt="" width={671} height={106} draggable={false} />
          <span className="intro-unite-cadre">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="intro-unite" src="/pharmaco-unite.webp" alt="" width={508} height={108} draggable={false} />
          </span>
        </div>
      </div>

      <div className="intro-flou" aria-hidden="true" />

      <button type="button" ref={bouton} className="intro-passer" onClick={passer} onFocus={() => setRevele(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" className="intro-passer-piste" />
          <path className="intro-passer-avance" pathLength={1} d="M 12 3 A 9 9 0 1 1 11.99 3" />
        </svg>
        Passer l&apos;introduction
      </button>
    </div>
  );
}
