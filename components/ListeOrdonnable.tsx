"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { deplacer } from "@/content/ordres";
import { Badge } from "./Badge";

export interface ElementOrdonnable {
  id: string;
  titre: string;
  /** Code du critère, p. ex. « B1-02 ». */
  code?: string;
  /** Mention courte : « socle », « nouveau, pas encore rangé »… */
  mention?: string;
  /** Vignette du module (illustration ou pictogramme, `content/badges.ts`), en tête de ligne. */
  badge?: string;
}

/**
 * Liste à ranger (ordonnancement, question 55, choix a) : trois gestes pour
 * un même déplacement, à prendre selon l'appareil et la longueur de la liste.
 *
 *   - glisser la poignée, à la souris ou au doigt (événements de pointeur :
 *     le glisser-déposer natif ne marche pas au doigt sur iPad) ; la page
 *     défile quand le pointeur approche d'un bord ;
 *   - les flèches ↑ ↓, ou les touches fléchées sur la poignée ;
 *   - le numéro saisi, validé par Entrée ou en quittant le champ — le plus
 *     court pour envoyer le dernier module en tête d'une longue liste.
 *
 * L'ordre part avec le formulaire qui englobe la liste : un champ caché par
 * élément, dans l'ordre affiché. Chaque déplacement est annoncé aux lecteurs
 * d'écran.
 *
 * Chaque ligne peut porter la vignette de son module (`badge`) et des
 * commandes propres (`complement`, p. ex. les cases du parcours d'un agent,
 * question 103) ; `onChange` reçoit l'ordre après chaque déplacement. Des
 * éléments ajoutés en cours de route se rangent à la suite, sans défaire
 * l'ordre déjà saisi.
 */
export function ListeOrdonnable({
  nom,
  elements,
  libelle,
  complement,
  onChange,
}: {
  /** Nom des champs cachés : `formData.getAll(nom)` rend l'ordre. */
  nom: string;
  elements: ElementOrdonnable[];
  /** Nom accessible de la liste. */
  libelle: string;
  /** Rendu à droite du titre de chaque ligne : cases, boutons… */
  complement?: (el: ElementOrdonnable) => ReactNode;
  /** Appelé avec les identifiants dans leur nouvel ordre, après chaque déplacement. */
  onChange?: (ordre: string[]) => void;
}) {
  const [liste, setListe] = useState(elements);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [annonce, setAnnonce] = useState("");
  const [enGlisse, setEnGlisse] = useState<string | null>(null);
  const lignes = useRef(new Map<string, HTMLLIElement>());
  const glisse = useRef<{ id: string; pointeur: number } | null>(null);

  // Les éléments peuvent changer après le premier rendu — un module ajouté hors périmètre au parcours d'un
  // agent (06/10/2026) : l'ordre courant est gardé, les nouveaux se rangent à la suite, les retirés sortent.
  useEffect(() => {
    setListe((courante) => {
      const parId = new Map(elements.map((e) => [e.id, e]));
      const gardes = courante.filter((e) => parId.has(e.id)).map((e) => parId.get(e.id)!);
      const connus = new Set(gardes.map((e) => e.id));
      const suite = [...gardes, ...elements.filter((e) => !connus.has(e.id))];
      return suite.length === courante.length && suite.every((e, i) => e === courante[i]) ? courante : suite;
    });
  }, [elements]);

  const bouger = (id: string, vers: number) => {
    const de = liste.findIndex((x) => x.id === id);
    if (de < 0) return;
    const suite = deplacer(liste, de, vers);
    const place = suite.findIndex((x) => x.id === id) + 1;
    if (place === de + 1) return;
    setListe(suite);
    onChange?.(suite.map((x) => x.id));
    setAnnonce(`« ${suite[place - 1].titre} » en position ${place} sur ${suite.length}.`);
  };

  const oublier = (id: string) =>
    setSaisies((s) => {
      const suite = { ...s };
      delete suite[id];
      return suite;
    });

  const valider = (id: string) => {
    const brut = saisies[id];
    oublier(id);
    const n = Number(brut);
    if (brut !== undefined && Number.isInteger(n) && n >= 1) bouger(id, n - 1);
  };

  const clavierRang = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    // Entrée dans un champ numérique enverrait le formulaire : ici, elle range.
    if (e.key === "Enter") {
      e.preventDefault();
      valider(id);
    } else if (e.key === "Escape") {
      oublier(id);
    }
  };

  const clavierPoignee = (e: KeyboardEvent<HTMLButtonElement>, id: string, i: number) => {
    const vers =
      e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : e.key === "Home" ? 0 : e.key === "End" ? liste.length - 1 : null;
    if (vers === null) return;
    e.preventDefault();
    bouger(id, vers);
  };

  const debutGlisse = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    glisse.current = { id, pointeur: e.pointerId };
    setEnGlisse(id);
  };

  const mouvement = (e: PointerEvent<HTMLButtonElement>) => {
    const g = glisse.current;
    if (!g || g.pointeur !== e.pointerId) return;
    // Défilement instantané : le site défile en douceur, et une animation par
    // mouvement du pointeur traînerait derrière le doigt.
    if (e.clientY < 56) window.scrollBy({ top: -14, behavior: "instant" });
    else if (e.clientY > window.innerHeight - 56) window.scrollBy({ top: 14, behavior: "instant" });
    // L'élément se pose avant la première ligne dont le milieu est sous le
    // pointeur ; il compte lui-même dans la liste, d'où le décalage vers le bas.
    let avant = liste.length;
    for (let i = 0; i < liste.length; i++) {
      const r = lignes.current.get(liste[i].id)?.getBoundingClientRect();
      if (r && e.clientY < r.top + r.height / 2) {
        avant = i;
        break;
      }
    }
    const de = liste.findIndex((x) => x.id === g.id);
    bouger(g.id, avant > de ? avant - 1 : avant);
  };

  const finGlisse = (e: PointerEvent<HTMLButtonElement>) => {
    const g = glisse.current;
    if (!g || g.pointeur !== e.pointerId) return;
    glisse.current = null;
    setEnGlisse(null);
  };

  return (
    <div className="liste-ordonnable">
      <p className="lecture-seule" aria-live="polite">
        {annonce}
      </p>
      <ol aria-label={libelle}>
        {liste.map((el, i) => (
          <li
            key={el.id}
            ref={(noeud) => {
              if (noeud) lignes.current.set(el.id, noeud);
              else lignes.current.delete(el.id);
            }}
            className={`ordonnable${enGlisse === el.id ? " ordonnable--glisse" : ""}`}
          >
            <button
              type="button"
              className="ordonnable-poignee"
              aria-label={`Déplacer « ${el.titre} » : glisser, ou flèches haut et bas`}
              onPointerDown={(e) => debutGlisse(e, el.id)}
              onPointerMove={mouvement}
              onPointerUp={finGlisse}
              onPointerCancel={finGlisse}
              onKeyDown={(e) => clavierPoignee(e, el.id, i)}
            >
              <span aria-hidden="true">⠿</span>
            </button>
            <input
              type="number"
              className="ordonnable-rang"
              inputMode="numeric"
              min={1}
              max={liste.length}
              value={saisies[el.id] ?? String(i + 1)}
              aria-label={`Position de « ${el.titre} »`}
              onChange={(e) => setSaisies((s) => ({ ...s, [el.id]: e.target.value }))}
              onBlur={() => valider(el.id)}
              onKeyDown={(e) => clavierRang(e, el.id)}
            />
            {el.badge ? (
              <span className="ordonnable-vignette" aria-hidden="true">
                <Badge nom={el.badge} taille={44} />
              </span>
            ) : null}
            <span className="ordonnable-texte">
              {el.code ? <code>{el.code}</code> : null} {el.titre}
              {el.mention ? <span className="etiquette etiquette--neutre">{el.mention}</span> : null}
            </span>
            {complement ? <span className="ordonnable-choix">{complement(el)}</span> : null}
            <span className="ordonnable-fleches">
              <button
                type="button"
                className="bouton bouton--compact bouton--discret"
                aria-label={`Monter « ${el.titre} »`}
                aria-disabled={i === 0}
                onClick={() => i > 0 && bouger(el.id, i - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="bouton bouton--compact bouton--discret"
                aria-label={`Descendre « ${el.titre} »`}
                aria-disabled={i === liste.length - 1}
                onClick={() => i < liste.length - 1 && bouger(el.id, i + 1)}
              >
                ↓
              </button>
            </span>
            <input type="hidden" name={nom} value={el.id} />
          </li>
        ))}
      </ol>
    </div>
  );
}
