"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as KEvent, MouseEvent as MEvent, PointerEvent as PEvent } from "react";
import {
  arrondir,
  borner,
  cacheParDefaut,
  centre,
  contenir,
  motAttendu,
  ordreLecture,
  poser,
  type Legende,
  type Repere,
} from "@/content/schema";

/**
 * Éditeur d'un schéma à compléter — repris, simplifié, du Lecteur QIM · QCM.
 *
 * - **cliquer** l'image pose une légende à cet endroit ; le champ du mot
 *   s'ouvre aussitôt ;
 * - **glisser** un repère le déplace (souris, doigt) ; au clavier, les
 *   flèches déplacent le repère focalisé de 1 % (Maj : 5 %) ;
 * - chaque légende porte son mot attendu (variantes après « | »), un cache
 *   qui recouvre le mot d'origine, réglable en largeur et hauteur, ou aucun
 *   cache si l'image est déjà muette ;
 * - « Aperçu apprenant » montre les caches opaques, tels qu'ils seront vus.
 *
 * Tout est en pourcentage de l'image (`Repere`) : le zoom ne change rien.
 */

interface Glisse {
  id: string;
  pointeur: number;
  x0: number;
  y0: number;
  origine: Repere;
  rect: DOMRect;
  bouge: boolean;
}

const PAS = 1;

function deplacer(r: Repere, dx: number, dy: number): Repere {
  if (r.cache) {
    const cache = contenir({ ...r.cache, x: r.cache.x + dx, y: r.cache.y + dy });
    return { ...centre(cache), cache };
  }
  return { x: arrondir(borner(r.x + dx, 0, 100)), y: arrondir(borner(r.y + dy, 0, 100)) };
}

export function EditeurSchema({
  imageUrl,
  largeur,
  hauteur,
  legendes,
  onChange,
}: {
  imageUrl: string | null;
  largeur: number;
  hauteur: number;
  legendes: Legende[];
  onChange: (legendes: Legende[]) => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const glisse = useRef<Glisse | null>(null);
  const ignorerClic = useRef(false);
  const [apercu, setApercu] = useState(false);
  const [aFocaliser, setAFocaliser] = useState<string | null>(null);
  const ratio = largeur > 0 && hauteur > 0 ? largeur / hauteur : 1.5;
  const ordre = ordreLecture(legendes);

  useEffect(() => {
    if (!aFocaliser) return;
    const el = document.getElementById(`mot-${aFocaliser}`) as HTMLInputElement | null;
    el?.focus();
    setAFocaliser(null);
  }, [aFocaliser, legendes]);

  const nouvelId = (): string => {
    let n = legendes.length + 1;
    while (legendes.some((l) => l.id === `l${n}`)) n++;
    return `l${n}`;
  };

  const majLegende = (id: string, patch: Partial<Legende>) =>
    onChange(legendes.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const poserAuClic = (e: MEvent<HTMLDivElement>) => {
    if (ignorerClic.current) {
      ignorerClic.current = false;
      return;
    }
    if (!cadre.current || !imageUrl) return;
    const rect = cadre.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = nouvelId();
    onChange([...legendes, { id, attendu: "", repere: poser(x, y, ratio) }]);
    setAFocaliser(id);
  };

  const debutGlisse = (e: PEvent<HTMLButtonElement>, l: Legende) => {
    if (!cadre.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    glisse.current = {
      id: l.id,
      pointeur: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      origine: l.repere,
      rect: cadre.current.getBoundingClientRect(),
      bouge: false,
    };
  };

  const mouvement = (e: PEvent<HTMLButtonElement>) => {
    const g = glisse.current;
    if (!g || g.pointeur !== e.pointerId) return;
    const dx = ((e.clientX - g.x0) / g.rect.width) * 100;
    const dy = ((e.clientY - g.y0) / g.rect.height) * 100;
    if (!g.bouge && Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) return;
    g.bouge = true;
    majLegende(g.id, { repere: deplacer(g.origine, dx, dy) });
  };

  const finGlisse = (e: PEvent<HTMLButtonElement>) => {
    const g = glisse.current;
    if (!g || g.pointeur !== e.pointerId) return;
    if (g.bouge) ignorerClic.current = true;
    glisse.current = null;
  };

  const clavier = (e: KEvent<HTMLButtonElement>, l: Legende) => {
    const pas = e.shiftKey ? PAS * 5 : PAS;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-pas, 0],
      ArrowRight: [pas, 0],
      ArrowUp: [0, -pas],
      ArrowDown: [0, pas],
    };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    majLegende(l.id, { repere: deplacer(l.repere, v[0], v[1]) });
  };

  const basculerCache = (l: Legende, avec: boolean) => {
    if (avec) {
      const cache = cacheParDefaut(l.repere.x, l.repere.y, ratio);
      majLegende(l.id, { repere: { ...centre(cache), cache } });
    } else {
      majLegende(l.id, { repere: { x: l.repere.x, y: l.repere.y } });
    }
  };

  const tailleCache = (l: Legende, w: number, h: number) => {
    const base = l.repere.cache ?? { x: l.repere.x, y: l.repere.y, w: 14, h: 5 };
    const cache = contenir({ x: base.x, y: base.y, w, h });
    majLegende(l.id, { repere: { ...centre(cache), cache } });
  };

  const supprimer = (id: string) => onChange(legendes.filter((l) => l.id !== id));

  return (
    <div className="editeur-schema">
      {imageUrl ? (
        <>
          <div className="editeur-schema-outils">
            <p className="legende" style={{ margin: 0, flex: "1 1 16rem" }}>
              Cliquez sur l&apos;image pour poser une légende ; glissez un repère pour le déplacer
              (flèches au clavier, Maj pour aller plus vite).
            </p>
            <label className="option option--compact">
              <input type="checkbox" checked={apercu} onChange={(e) => setApercu(e.target.checked)} />
              <span>Aperçu apprenant</span>
            </label>
          </div>
          <div
            ref={cadre}
            className={`schema-cadre schema-cadre--editeur${apercu ? " schema-cadre--apercu" : ""}`}
            style={{ aspectRatio: `${largeur || 4} / ${hauteur || 3}` }}
            onClick={poserAuClic}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" draggable={false} />
            {ordre.map((i, k) => {
              const l = legendes[i];
              const c = l.repere.cache;
              return (
                <span key={l.id}>
                  {c && (
                    <span
                      className="schema-cache"
                      aria-hidden="true"
                      style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
                    />
                  )}
                  <button
                    type="button"
                    className="schema-repere schema-repere--editeur"
                    style={{ left: `${l.repere.x}%`, top: `${l.repere.y}%` }}
                    aria-label={`Repère ${k + 1}${motAttendu(l.attendu) ? ` — ${motAttendu(l.attendu)}` : ""}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => debutGlisse(e, l)}
                    onPointerMove={mouvement}
                    onPointerUp={finGlisse}
                    onPointerCancel={finGlisse}
                    onKeyDown={(e) => clavier(e, l)}
                  >
                    {k + 1}
                  </button>
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <p className="encart encart--attention">Choisissez d&apos;abord une image (PNG ou JPEG, 2 Mo au plus).</p>
      )}

      <ol className="editeur-legendes">
        {ordre.map((i, k) => {
          const l = legendes[i];
          return (
            <li key={l.id} className="editeur-legende">
              <span className="num" aria-hidden="true">{k + 1}</span>
              <label className="champ" style={{ flex: "1 1 14rem", margin: 0 }}>
                <span className="visually-hidden">Mot attendu de la légende {k + 1}</span>
                <input
                  id={`mot-${l.id}`}
                  type="text"
                  value={l.attendu}
                  placeholder="mot attendu | variante acceptée"
                  onChange={(e) => majLegende(l.id, { attendu: e.target.value })}
                />
              </label>
              <label className="option option--compact">
                <input
                  type="checkbox"
                  checked={Boolean(l.repere.cache)}
                  onChange={(e) => basculerCache(l, e.target.checked)}
                />
                <span>Cache</span>
              </label>
              {l.repere.cache && (
                <span className="editeur-taille">
                  <label>
                    <span className="visually-hidden">Largeur du cache en %</span>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      step={0.5}
                      value={l.repere.cache.w}
                      onChange={(e) => tailleCache(l, Number(e.target.value), l.repere.cache!.h)}
                    />
                  </label>
                  ×
                  <label>
                    <span className="visually-hidden">Hauteur du cache en %</span>
                    <input
                      type="number"
                      min={1.5}
                      max={100}
                      step={0.5}
                      value={l.repere.cache.h}
                      onChange={(e) => tailleCache(l, l.repere.cache!.w, Number(e.target.value))}
                    />
                  </label>
                  <span className="legende">%</span>
                </span>
              )}
              <button
                type="button"
                className="bouton bouton--compact bouton--discret"
                onClick={() => supprimer(l.id)}
                aria-label={`Supprimer la légende ${k + 1}`}
              >
                Supprimer
              </button>
            </li>
          );
        })}
      </ol>
      {legendes.length === 0 && imageUrl && (
        <p className="legende">Aucune légende : cliquez sur le schéma pour en poser une.</p>
      )}
    </div>
  );
}
