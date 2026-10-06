"use client";

import { useMemo, useState } from "react";
import { ListeOrdonnable, type ElementOrdonnable } from "@/components/ListeOrdonnable";
import { VignetteModule } from "@/components/VignetteModule";
import { chronologie } from "@/content/ordres";
import type { EtatAvancement } from "@/content/avancement-agent";

/** Un module proposé au parcours : du périmètre du code de l'agent, ou publié hors de ce périmètre. */
export interface CandidatParcours {
  id: string;
  titre: string;
  /** Critère, ou « Dépôt » : ce qui précède le titre dans les listes. */
  code: string;
  badge?: string;
  /** Aucune question validée : au parcours, il resterait fermé à l'agent tant qu'une ne l'est pas. */
  sansQuestion: boolean;
}

/** Avancement d'un module, déjà libellé par le serveur : « Acquis le 06/10/2026 · 85 % », « Lu le … ». */
export interface AvancementAffiche {
  etat: EtatAvancement;
  libelle: string;
}

const VIERGE: AvancementAffiche = { etat: "vierge", libelle: "Pas commencé" };

const CLASSES_AVANCEMENT: Record<EtatAvancement, string> = {
  acquis: "etiquette--ok",
  non_acquis: "etiquette--echec",
  indetermine: "etiquette--attention",
  non_concluant: "etiquette--attention",
  entraine: "etiquette--neutre",
  lu: "etiquette--neutre",
  vierge: "etiquette--neutre",
};

/** Comparaison sans accents ni casse, pour la recherche d'un module hors périmètre. */
function plat(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Composeur du parcours d'un agent (question 103, choix a, 05/10/2026 ;
 * avancement et hors périmètre le 06/10/2026), sur sa fiche. Les candidats
 * sont les modules que ses codes de poste reliés lui ouvrent (question 101).
 * Sans parcours enregistré, tous sont cochés « au parcours » : c'est ce que
 * l'agent voit, et le tutorat part de là — il range (glisser, flèches, numéro :
 * `ListeOrdonnable`), décoche ce que l'agent n'a pas à faire, ferme ce qu'il
 * ne doit pas encore ouvrir (retour d'usage du 06/10/2026 : l'ordre rangé
 * s'enregistre ainsi d'emblée, là où rien de coché faisait refuser l'envoi et
 * perdre l'ordre saisi). Chaque ligne dit l'avancement de l'agent sur le
 * module, lu dans ses traces conservées. Au besoin, un module publié hors de
 * ce périmètre s'ajoute à la liste et entre au parcours comme les autres.
 * L'aperçu montre le parcours tel que l'agent le verra : ses vignettes, dans
 * l'ordre, la coche sur les acquis, les fermés grisés.
 *
 * Le formulaire envoie l'ordre complet de la liste (`modules`), les modules
 * cochés (`parcours`) et les fermés (`fermes`) ; l'action les compose
 * (`composerParcours`), sans rien retenir d'étranger aux candidats. Seul
 * l'ordre des modules cochés est conservé : un module décoché n'est plus
 * proposé, sa place dans la liste ne compte pas. Rien de coché : le bouton
 * reste inactif, et le dit.
 */
export function ComposeurParcours({
  agentId,
  identifiant,
  candidats,
  horsPerimetre,
  avancement,
  initial,
  action,
  actionRetrait,
}: {
  agentId: number;
  identifiant: string;
  /** Modules du périmètre : ceux que ses codes de poste reliés lui ouvrent. */
  candidats: CandidatParcours[];
  /** Les autres modules publiés, que le tutorat peut ajouter au parcours. */
  horsPerimetre: CandidatParcours[];
  /** Avancement par module, pour ceux qui ont une trace ; les autres n'ont pas commencé. */
  avancement: Record<string, AvancementAffiche>;
  /** Parcours enregistré, s'il y en a un : modules dans l'ordre, fermés. */
  initial: { modules: string[]; fermes: string[] } | null;
  action: (formData: FormData) => Promise<void>;
  actionRetrait: (formData: FormData) => Promise<void>;
}) {
  const idsHors = useMemo(() => new Set(horsPerimetre.map((h) => h.id)), [horsPerimetre]);
  const connus = useMemo(() => new Set([...candidats.map((c) => c.id), ...idsHors]), [candidats, idsHors]);
  // Modules hors périmètre présents dans la liste : ceux du parcours enregistré, puis ceux ajoutés ici.
  const [ajoutes, setAjoutes] = useState(() => new Set((initial?.modules ?? []).filter((id) => idsHors.has(id))));
  // Sans parcours enregistré, tout le périmètre du code est au parcours : c'est ce que l'agent voit aujourd'hui.
  const [coches, setCoches] = useState(
    () => new Set(initial ? initial.modules.filter((id) => connus.has(id)) : candidats.map((c) => c.id)),
  );
  const [fermes, setFermes] = useState(() => new Set((initial?.fermes ?? []).filter((id) => connus.has(id))));
  const proposes = useMemo(
    () => [...candidats, ...horsPerimetre.filter((h) => ajoutes.has(h.id))],
    [candidats, horsPerimetre, ajoutes],
  );
  // La liste part du parcours enregistré, puis des autres candidats dans l'ordre du programme ; un module
  // ajouté en cours de route se range à la suite (`ListeOrdonnable`).
  const ranges = useMemo(() => chronologie(proposes, initial?.modules ?? []), [proposes, initial]);
  const [ordre, setOrdre] = useState<string[]>(() => ranges.map((c) => c.id));
  const parId = useMemo(() => new Map([...candidats, ...horsPerimetre].map((c) => [c.id, c])), [candidats, horsPerimetre]);
  const elements: ElementOrdonnable[] = useMemo(
    () =>
      ranges.map((c) => ({
        id: c.id,
        titre: c.titre,
        code: c.code,
        badge: c.badge,
        mention:
          [idsHors.has(c.id) ? "hors périmètre" : "", c.sansQuestion ? "sans question : fermé à l'agent" : ""]
            .filter(Boolean)
            .join(" · ") || undefined,
      })),
    [ranges, idsHors],
  );
  const [filtre, setFiltre] = useState("");

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
  // Un module hors périmètre ajouté entre dans la liste, coché, en fin d'ordre.
  const ajouter = (id: string) => {
    setAjoutes((s) => new Set([...s, id]));
    setOrdre((o) => (o.includes(id) ? o : [...o, id]));
    cocher(id, true);
  };

  const avancementDe = (id: string): AvancementAffiche => avancement[id] ?? VIERGE;
  const apercu = ordre.filter((id) => coches.has(id));
  const nbFermes = apercu.filter((id) => fermes.has(id)).length;
  const nbHors = apercu.filter((id) => idsHors.has(id)).length;
  const nbAcquis = apercu.filter((id) => avancementDe(id).etat === "acquis").length;
  const complements = [
    nbFermes > 0 ? `${nbFermes} fermé${nbFermes > 1 ? "s" : ""}` : "",
    nbHors > 0 ? `${nbHors} hors périmètre` : "",
  ].filter(Boolean);
  const statut = `${apercu.length} module${apercu.length > 1 ? "s" : ""} au parcours${
    complements.length > 0 ? `, dont ${complements.join(" et ")}` : ""
  } · ${nbAcquis > 0 ? `${nbAcquis} acquis` : "aucun acquis"}`;
  const restants = horsPerimetre.filter((h) => !ajoutes.has(h.id));
  const motif = plat(filtre.trim());
  const disponibles = motif ? restants.filter((h) => plat(`${h.code} ${h.titre}`).includes(motif)) : restants;

  return (
    <>
      <form action={action} className="composeur-parcours">
        <input type="hidden" name="id" value={agentId} />
        <ListeOrdonnable
          nom="modules"
          elements={elements}
          libelle={`Modules proposés à ${identifiant} — ceux de son code de poste, et ceux ajoutés hors périmètre —, à cocher et à ranger`}
          onChange={setOrdre}
          complement={(el) => {
            const a = avancementDe(el.id);
            return (
              <>
                <span className={`etiquette avancement-module avancement-module--${a.etat} ${CLASSES_AVANCEMENT[a.etat]}`}>
                  {a.libelle}
                </span>
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
            );
          }}
        />
        {horsPerimetre.length > 0 && (
          <details className="ajout-hors-perimetre">
            <summary>
              Ajouter un module hors du périmètre de son code ({restants.length} disponible{restants.length > 1 ? "s" : ""})
            </summary>
            <p className="legende">
              Un module que son code n&apos;ouvre pas, mais que vous jugez utile : ajouté, il entre au parcours comme les
              autres — l&apos;agent l&apos;ouvre, s&apos;y évalue et reçoit ses documents. Pour l&apos;en retirer, décochez
              « au parcours ».
            </p>
            <label className="champ">
              <span>Chercher un module</span>
              <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="titre ou critère" />
            </label>
            <ul className="hors-perimetre-liste" aria-label="Modules hors périmètre à ajouter">
              {disponibles.map((h) => (
                <li key={h.id} data-module={h.id}>
                  <VignetteModule badge={h.badge} taille={32} secours={<span className="vignette-vide">{h.code}</span>} />
                  <span className="ordonnable-texte">
                    <code>{h.code}</code> {h.titre}
                    {h.sansQuestion ? <span className="etiquette etiquette--neutre">sans question</span> : null}
                  </span>
                  <button type="button" className="bouton bouton--compact bouton--secondaire" onClick={() => ajouter(h.id)}>
                    Ajouter
                  </button>
                </li>
              ))}
              {disponibles.length === 0 && (
                <li className="legende">{restants.length === 0 ? "Tous les modules publiés sont déjà dans la liste." : "Aucun module ne répond à cette recherche."}</li>
              )}
            </ul>
          </details>
        )}
        <div className="apercu-parcours-tete">
          <h3 id="t-apercu-parcours">Aperçu du parcours</h3>
          <span className="legende" role="status">
            {statut}
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
              const hors = idsHors.has(id);
              const acquis = avancementDe(id).etat === "acquis";
              const marques = `${ferme ? " · fermé" : ""}${hors ? " · hors périmètre" : ""}`;
              return (
                <li
                  key={id}
                  className={[ferme ? "est-ferme" : "", hors ? "est-hors" : ""].filter(Boolean).join(" ") || undefined}
                  title={`${i + 1}. ${c.titre}${acquis ? " — acquis" : ""}${marques.replace(/ · /g, " — ")}`}
                >
                  <span className="apercu-rang" aria-hidden="true">
                    {i + 1}
                  </span>
                  <VignetteModule badge={c.badge} taille={44} acquis={acquis} secours={<span className="vignette-vide">{c.code}</span>} />
                  {/* Le nom du module sous la vignette (retour d'usage du 06/10/2026 : « Dépôt » seul ne disait rien) ;
                      trois lignes au plus, le titre entier au survol. */}
                  <span className="apercu-titre">
                    <span className="visually-hidden">{i + 1}. </span>
                    {c.titre}
                  </span>
                  <span className="apercu-legende">
                    {c.code}
                    {marques}
                    {acquis ? <span className="visually-hidden"> · acquis</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="submit" className="bouton" disabled={apercu.length === 0}>
            Enregistrer le parcours de {identifiant}
          </button>
          <span className="legende">
            {apercu.length === 0
              ? "Cochez au moins un module « au parcours » pour enregistrer."
              : "Journalisé. L'agent le voit dès sa prochaine page."}
          </span>
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
