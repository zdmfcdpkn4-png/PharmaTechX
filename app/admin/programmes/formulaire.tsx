import { blocsCompetence } from "@/content/habilitation";
import { getTousModulesAvecDeposes } from "@/content/store";
import { A_PRECISER, type Module } from "@/content/types";
import { MAX_MODULES_PROGRAMME, MENTION_DEGRADE, type Programme } from "@/content/programmes";

/**
 * Formulaire d'un programme à la carte (question 50), création et
 * modification. Rendu serveur : les modules cochés et leur rang partent tels
 * quels à l'action, qui les ordonne (`ordonnerProgramme`). Sans rang, un
 * module garde l'ordre de la liste — celui de la fiche.
 */
export async function FormulaireProgramme({
  initiale,
  action,
  libelleBouton,
}: {
  initiale?: Programme | null;
  action: (formData: FormData) => Promise<void>;
  libelleBouton: string;
}) {
  const modules = await getTousModulesAvecDeposes({ publiesSeulement: true });
  const rangDe = new Map((initiale?.modules ?? []).map((id, i) => [id, i + 1]));
  const groupes: { cle: string; titre: string; modules: Module[] }[] = [
    ...blocsCompetence.map((b) => ({
      cle: String(b.numero),
      titre: `Bloc ${b.numero} — ${b.titre}`,
      modules: modules.filter((m) => m.origine !== "base" && m.bloc === b.numero),
    })),
    {
      cle: "deposes",
      titre: "Modules déposés",
      modules: modules.filter((m) => m.origine === "base"),
    },
  ].filter((g) => g.modules.length > 0);

  return (
    <form action={action} className="carte">
      {initiale && <input type="hidden" name="id" value={initiale.id} />}
      <div className="rangee">
        <label className="champ">
          <span>Nom du programme</span>
          <input
            type="text"
            name="nom"
            required
            maxLength={120}
            defaultValue={initiale?.nom ?? ""}
            placeholder="Intérimaire — chimiothérapie seule"
          />
        </label>
        <label className="champ">
          <span>Pour qui</span>
          <input
            type="text"
            name="destinataire"
            maxLength={200}
            defaultValue={initiale?.destinataire ?? ""}
            placeholder="Préparateur intérimaire, trois mois"
          />
        </label>
      </div>
      <label className="champ">
        <span>Motif de l&apos;écart à la fiche d&apos;habilitation (exigé pour valider)</span>
        <textarea
          name="motif"
          rows={3}
          maxLength={1000}
          defaultValue={initiale?.motif ?? ""}
          placeholder="Remplacement limité à la chimiothérapie : le préparatoire n'est pas exercé."
        />
      </label>
      <fieldset className="groupe">
        <legend className="champ-titre">
          Modules — cochez-les un à un ; le rang fixe l&apos;ordre (sans rang : l&apos;ordre de la fiche)
        </legend>
        <p className="legende" style={{ marginTop: 0 }}>
          Au plus {MAX_MODULES_PROGRAMME} modules. Le programme sera marqué « {MENTION_DEGRADE} » partout où il
          paraît : il ne se confond ni avec l&apos;intégration ni avec le maintien de la fiche.
        </p>
        {groupes.map((g) => {
          const coches = g.modules.filter((m) => rangDe.has(m.id)).length;
          return (
            <details key={g.cle} className="programme-groupe" open={coches > 0 || !initiale}>
              <summary>
                {g.titre}
                <span className="etiquette etiquette--neutre">
                  {coches > 0 ? `${coches} choisi${coches > 1 ? "s" : ""} sur ${g.modules.length}` : `${g.modules.length}`}
                </span>
              </summary>
              <ul className="liste-nue programme-modules">
                {g.modules.map((m) => (
                  <li key={m.id}>
                    <label className="programme-module">
                      <input type="checkbox" name="modules" value={m.id} defaultChecked={rangDe.has(m.id)} />
                      <span>
                        {typeof m.critereId === "string" && m.critereId !== A_PRECISER ? <strong>{m.critereId}</strong> : null}{" "}
                        {m.titre}
                      </span>
                    </label>
                    <label className="programme-rang">
                      <span className="visually-hidden">Rang de {m.titre}</span>
                      <input
                        type="number"
                        name={`rang-${m.id}`}
                        min={1}
                        max={MAX_MODULES_PROGRAMME}
                        step={1}
                        placeholder="rang"
                        defaultValue={rangDe.get(m.id) ?? ""}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </fieldset>
      <div className="actions">
        <button type="submit" className="bouton">
          {libelleBouton}
        </button>
      </div>
    </form>
  );
}
