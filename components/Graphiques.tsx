import { arcs, libelleMois, part, pointsCourbe, segments, type PointMois, type Tranche } from "@/lib/pilotage";

/**
 * Graphiques du tableau de bord, tracés en SVG **côté serveur** : aucune
 * bibliothèque, aucun script au navigateur, et la page s'imprime telle quelle.
 * Chaque figure porte un `aria-label` qui dit ce qu'elle montre, et les
 * chiffres qu'elle résume restent écrits à côté d'elle en toutes lettres — un
 * graphique n'est jamais le seul porteur d'une information.
 */

export const TONS_VERDICT = {
  acquis: "var(--succes)",
  non_acquis: "var(--echec)",
  indetermine: "var(--alerte)",
  non_concluant: "var(--trait-faible)",
} as const;

export type CleVerdict = keyof typeof TONS_VERDICT;

export const LIBELLES_VERDICT_COURT: Record<CleVerdict, string> = {
  acquis: "Acquis",
  non_acquis: "Non acquis",
  indetermine: "Indéterminé",
  non_concluant: "Non concluant",
};

export interface RepartitionVerdicts {
  acquis: number;
  non_acquis: number;
  indetermine: number;
  non_concluant: number;
}

export const CLES_VERDICT: CleVerdict[] = ["acquis", "non_acquis", "indetermine", "non_concluant"];

// ─────────────────────────────────────────────────────────────── cartouche

export function Cartouche({
  valeur,
  unite,
  libelle,
  precision,
  ton,
}: {
  valeur: string | number;
  unite?: string;
  libelle: string;
  precision?: string;
  ton?: string;
}) {
  return (
    <div className="cartouche">
      <p className="cartouche-valeur" style={ton ? { color: ton } : undefined}>
        {valeur}
        {unite && <span className="cartouche-unite">{unite}</span>}
      </p>
      <p className="cartouche-libelle">{libelle}</p>
      {precision && <p className="cartouche-precision">{precision}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────── barre empilée

/** Répartition des verdicts sur une barre unique, à hauteur fixe. */
export function BarreVerdicts({ r, hauteur = 10 }: { r: RepartitionVerdicts; hauteur?: number }) {
  const total = CLES_VERDICT.reduce((s, c) => s + r[c], 0);
  if (total === 0) return <div className="barre-verdicts barre-verdicts--vide" aria-hidden="true" />;
  const texte = CLES_VERDICT.filter((c) => r[c] > 0)
    .map((c) => `${LIBELLES_VERDICT_COURT[c]} ${r[c]} (${part(r[c], total)} %)`)
    .join(", ");
  return (
    <div className="barre-verdicts" style={{ height: hauteur }} role="img" aria-label={texte}>
      {CLES_VERDICT.map((c) =>
        r[c] > 0 ? (
          <span key={c} style={{ width: `${(r[c] / total) * 100}%`, background: TONS_VERDICT[c] }} />
        ) : null,
      )}
    </div>
  );
}

export function LegendeVerdicts({ r }: { r: RepartitionVerdicts }) {
  return (
    <ul className="legende-graphique">
      {CLES_VERDICT.map((c) => (
        <li key={c}>
          <span className="pastille" style={{ background: TONS_VERDICT[c] }} aria-hidden="true" />
          {LIBELLES_VERDICT_COURT[c]} <strong>{r[c]}</strong>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────────────────────────────────────────────── anneau

/** Anneau des verdicts, avec le taux d'acquis au centre. */
export function AnneauVerdicts({ r }: { r: RepartitionVerdicts }) {
  const total = CLES_VERDICT.reduce((s, c) => s + r[c], 0);
  const rayon = 54;
  const circ = 2 * Math.PI * rayon;
  const parts = arcs(CLES_VERDICT.map((c) => r[c]), circ);
  const texte =
    total === 0
      ? "Aucun rapport sur ce périmètre"
      : CLES_VERDICT.filter((c) => r[c] > 0)
          .map((c) => `${LIBELLES_VERDICT_COURT[c]} ${part(r[c], total)} %`)
          .join(", ");
  return (
    <svg className="anneau" viewBox="0 0 140 140" role="img" aria-label={texte}>
      <circle cx="70" cy="70" r={rayon} fill="none" stroke="var(--surface-douce)" strokeWidth="16" />
      {total > 0 &&
        CLES_VERDICT.map((c, i) =>
          r[c] > 0 ? (
            <circle
              key={c}
              cx="70"
              cy="70"
              r={rayon}
              fill="none"
              stroke={TONS_VERDICT[c]}
              strokeWidth="16"
              strokeDasharray={`${parts[i].longueur} ${circ - parts[i].longueur}`}
              strokeDashoffset={-parts[i].debut}
              transform="rotate(-90 70 70)"
            />
          ) : null,
        )}
      <text x="70" y="66" className="anneau-chiffre">
        {total > 0 ? `${part(r.acquis, total)} %` : "—"}
      </text>
      <text x="70" y="86" className="anneau-mention">
        acquis
      </text>
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────── courbe

/**
 * Évolution mensuelle : volume en barres discrètes, taux d'acquis en ligne.
 * Un mois sans rapport coupe la ligne au lieu de la faire passer par zéro —
 * l'absence de mesure n'est pas une mesure nulle.
 */
export function CourbeMensuelle({ points }: { points: PointMois[] }) {
  const L = 640;
  const H = 180;
  const marge = 16;
  if (points.length === 0) return <p className="legende">Aucun rapport sur ce périmètre.</p>;
  const taux = points.map((p) => (p.n > 0 ? part(p.acquis, p.n) : null));
  const pts = pointsCourbe(taux, L, H, 100, marge);
  const volMax = Math.max(1, ...points.map((p) => p.n));
  const largeurBarre = Math.max(4, Math.min(28, (L - 2 * marge) / Math.max(1, points.length) - 8));
  const texte = points
    .filter((p) => p.n > 0)
    .map((p) => `${libelleMois(p.mois)} : ${p.n} rapport(s), ${part(p.acquis, p.n)} % acquis`)
    .join(" ; ");
  return (
    <figure className="graphique">
      <svg viewBox={`0 0 ${L} ${H + 26}`} className="courbe" role="img" aria-label={`Évolution mensuelle. ${texte}`}>
        {[0, 50, 100].map((v) => {
          const y = H - (v / 100) * H;
          return (
            <g key={v}>
              <line x1="0" x2={L} y1={y} y2={y} className="grille" />
              {/* la graduation du haut passe sous son trait, sinon elle sort du cadre */}
              <text x="2" y={v === 100 ? y + 11 : y - 4} className="graduation">{v} %</text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const x = marge + (points.length > 1 ? (i * (L - 2 * marge)) / (points.length - 1) : 0);
          const h = (p.n / volMax) * (H * 0.55);
          return (
            <rect
              key={p.mois}
              x={x - largeurBarre / 2}
              y={H - h}
              width={largeurBarre}
              height={h}
              rx="3"
              className="volume"
            />
          );
        })}
        {segments(pts).map((s, i) => (
          <polyline key={i} points={s.map((p) => `${p.x},${p.y}`).join(" ")} className="ligne" />
        ))}
        {pts.map((p, i) => (p ? <circle key={i} cx={p.x} cy={p.y} r="3.5" className="point" /> : null))}
        {points.map((p, i) => {
          const x = marge + (points.length > 1 ? (i * (L - 2 * marge)) / (points.length - 1) : 0);
          const pas = Math.ceil(points.length / 12);
          if (i % pas !== 0) return null;
          // les libellés des extrémités s'alignent vers l'intérieur : centrés, ils déborderaient
          const ancre = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
          return (
            <text key={p.mois} x={x} y={H + 18} className="graduation" textAnchor={ancre}>
              {libelleMois(p.mois)}
            </text>
          );
        })}
      </svg>
      <figcaption className="legende">
        Ligne : part d&apos;acquis du mois. Barres : nombre de rapports émis. Un mois sans rapport interrompt la ligne.
      </figcaption>
    </figure>
  );
}

// ──────────────────────────────────────────────────────────── histogramme

/** Répartition des scores par tranches de dix points, avec le seuil marqué. */
export function HistogrammeScores({ tranches, seuil }: { tranches: Tranche[]; seuil?: number | null }) {
  const L = 640;
  const H = 150;
  const total = tranches.reduce((s, t) => s + t.n, 0);
  if (total === 0) return <p className="legende">Aucun rapport sur ce périmètre.</p>;
  const max = Math.max(1, ...tranches.map((t) => t.n));
  const pas = L / tranches.length;
  const texte = tranches
    .filter((t) => t.n > 0)
    .map((t) => `${t.de} à ${t.a} % : ${t.n}`)
    .join(" ; ");
  return (
    <figure className="graphique">
      <svg viewBox={`0 0 ${L} ${H + 24}`} className="histogramme" role="img" aria-label={`Répartition des scores. ${texte}`}>
        {tranches.map((t, i) => {
          const h = (t.n / max) * H;
          return (
            <g key={t.de}>
              <rect
                x={i * pas + 4}
                y={H - h}
                width={pas - 8}
                height={h}
                rx="4"
                className={seuil != null && t.a < seuil ? "tranche tranche--sous-seuil" : "tranche"}
              />
              {t.n > 0 && (
                <text x={i * pas + pas / 2} y={H - h - 4} className="graduation graduation--x">
                  {t.n}
                </text>
              )}
              <text x={i * pas + pas / 2} y={H + 16} className="graduation graduation--x">
                {t.de}
              </text>
            </g>
          );
        })}
        {seuil != null && (
          <line x1={(seuil / 100) * L} x2={(seuil / 100) * L} y1="0" y2={H} className="seuil" />
        )}
      </svg>
      <figcaption className="legende">
        Scores des rapports, par tranches de dix points.
        {seuil != null ? ` Trait vertical : seuil de réussite le plus courant (${seuil} %).` : ""}
      </figcaption>
    </figure>
  );
}
