"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { ListeOrdonnable, type ElementOrdonnable } from "@/components/ListeOrdonnable";
import { chronologie } from "@/content/ordres";

/** Un module que le code de poste de l'agent lui ouvre, tel que la fiche le propose au parcours. */
export interface CandidatParcours {
  id: string;
  titre: string;
  /** Critère, ou « Dépôt » : ce qui précède le titre dans les listes. */
  code: string;
  badge?: string;
  /** Aucune question validée : au parcours, il resterait fermé à l'agent tant qu'une ne l'est pas. */
  sansQuestion: boolean;
}

/**
 * Composeur du parcours d'un agent (question 103, choix a, 05/10/2026), sur sa
 * fiche. Les candidats sont les modules que ses codes de poste reliés lui
 * ouvrent (question 101) ; le tutorat coche ceux du parcours, les range —
 * glisser, flèches, numéro (`ListeOrdonnable`) — et en ferme certains.
 * L'aperçu montre le parcours tel que l'agent le verra : ses vignettes, dans
 * l'ordre, les fermés grisés.
 *
 * Le formulaire envoie l'ordre complet de la liste (`modules`), les modules
 * cochés (`parcours`) et les fermés (`fermes`) ; l'action les compose
 * (`composerParcours`), sans rien retenir d'étranger aux candidats.
 */
export function ComposeurParcours({
  agentId,
  identifiant,
  candidats,
  initial,
  action,
  actionRetrait,
}: {
  agentId: number;
  identifiant: string;
  candidats: CandidatParcours[];
  /** Parcours enregistré, s'il y en a un : modules dans l'ordre, fermés. */
  initial: { modules: string[]; fermes: string[] } | null;
  action: (formData: FormData) => Promise<void>;
  actionRetrait: (formData: FormData) => Promise<void>;
}) {
  const connus = useMemo(() => new Set(candidats.map((c) => c.id)), [candidats]);
  const [coches, setCoches] = useState(() => new Set((initial?.modules ?? []).filter((id) => connus.has(id))));
  const [fermes, setFermes] = useState(() => new Set((initial?.fermes ?? []).filter((id) => connus.has(id))));
  // La liste part du parcours enregistré, puis des autres candidats dans l'ordre du programme.
  const ranges = useMemo(() => chronologie(candidats, initial?.modules ?? []), [candidats, initial]);
  const [ordre, setOrdre] = useState<string[]>(() => ranges.map((c) => c.id));
  const parId = useMemo(() => new Map(candidats.map((c) => [c.id, c])), [candidats]);
  const elements: ElementOrdonnable[] = useMemo(
    () =>
      ranges.map((c) => ({
        id: c.id,
        titre: c.titre,
        code: c.code,
        badge: c.badge,
        mention: c.sansQuestion ? "sans question : fermé à l'agent" : undefined,
      })),
    [ranges],
  );

  const cocher = (id: string, valeur: boolean) => {
    setCoches((s) => {
      const suite = new Set(s);
      if (valeur) suite.add(id);
      else suite.delete(id);
      return suite;
    });
    // Un module qui quitte le parcours n'est plus « fermé » : il n'est plus rien.
    if (!valeur) setFermes((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : s));
  };
  const fermer = (id: string, valeur: boolean) =>
    setFermes((s) => {
      const suite = new Set(s);
      if (valeur) suite.add(id);
      else suite.delete(id);
      return suite;
    });

  const apercu = ordre.filter((id) => coches.has(id));
  const nbFermes = apercu.filter((id) => fermes.has(id)).length;

  return (
    <>
      <form action={action} className="composeur-parcours">
        <input type="hidden" name="id" value={agentId} />
        <ListeOrdonnable
          nom="modules"
          elements={elements}
          libelle={`Modules que son code de poste ouvre à ${identifiant}, à cocher et à ranger`}
          onChange={setOrdre}
          complement={(el) => (
            <>
              <label className="choix-parcours">
                <input
                  type="checkbox"
                  name="parcours"
                  value={el.id}
                  checked={coches.has(el.id)}
                  onChange={(e) => cocher(el.id, e.target.checked)}
                />
                <span>au parcours</span>
              </label>
              <label className="choix-parcours">
                <input
                  type="checkbox"
                  name="fermes"
                  value={el.id}
                  checked={fermes.has(el.id)}
                  disabled={!coches.has(el.id)}
                  onChange={(e) => fermer(el.id, e.target.checked)}
                />
                <span>fermé</span>
              </label>
            </>
          )}
        />
        <div className="apercu-parcours-tete">
          <h3 id="t-apercu-parcours">Aperçu du parcours</h3>
          <span className="legende" role="status">
            {apercu.length} module{apercu.length > 1 ? "s" : ""} au parcours
            {nbFermes > 0 ? `, dont ${nbFermes} fermé${nbFermes > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        {apercu.length === 0 ? (
          <p className="encart">Cochez « au parcours » sur les modules retenus : l&apos;aperçu les montre dans l&apos;ordre.</p>
        ) : (
          <ol className="apercu-parcours" aria-labelledby="t-apercu-parcours">
            {apercu.map((id, i) => {
              const c = parId.get(id);
              if (!c) return null;
              const ferme = fermes.has(id);
              return (
                <li key={id} className={ferme ? "est-ferme" : undefined} title={`${i + 1}. ${c.titre}${ferme ? " — fermé" : ""}`}>
                  <span className="apercu-rang" aria-hidden="true">
                    {i + 1}
                  </span>
                  {c.badge ? <Badge nom={c.badge} taille={44} /> : <span className="vignette-vide">{c.code}</span>}
                  <span className="apercu-legende">
                    {c.code}
                    {ferme ? " · fermé" : ""}
                  </span>
                  <span className="visually-hidden">
                    {i + 1}. {c.titre}
                    {ferme ? ", fermé par le tutorat" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="submit" className="bouton">
            Enregistrer le parcours de {identifiant}
          </button>
          <span className="legende">Journalisé. L&apos;agent le voit dès sa prochaine page.</span>
        </div>
      </form>
      {initial && (
        <form action={actionRetrait} className="actions" style={{ marginTop: ".5rem" }}>
          <input type="hidden" name="id" value={agentId} />
          <button type="submit" className="bouton bouton--compact bouton--discret">
            Retirer le parcours
          </button>
          <span className="legende">L&apos;agent retrouve tout le programme de son code.</span>
        </form>
      )}
    </>
  );
}
