import { lireOrdonnancement } from "@/lib/db";
import { getTousModules } from "@/content/store";
import { actionOrdonner } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Ordonnancement({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const p = await searchParams;
  const modules = getTousModules();
  const [integration, maintien] = await Promise.all([
    lireOrdonnancement("integration"),
    lireOrdonnancement("maintien"),
  ]);
  const ordre = (rangs: Record<string, number>) =>
    Object.entries(rangs)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id)
      .join(", ");

  return (
    <>
      <section className="panneau-titre">
        <h1>Ordonnancement des modules</h1>
        <p>
          Collez les identifiants de module dans l&apos;ordre souhaité, séparés par des virgules.
          Les modules non listés conservent l&apos;ordre de la fiche d&apos;habilitation. Un
          glisser-déposer reste à faire — limite connue.
        </p>
      </section>
      {p.ok && <p className="encart encart--ok">Ordre enregistré.</p>}
      <section className="carte">
        <form action={actionOrdonner}>
          <label className="champ">
            <span>Parcours</span>
            <select name="parcours" defaultValue="integration">
              <option value="integration">Intégration</option>
              <option value="maintien">Maintien d&apos;habilitation</option>
            </select>
          </label>
          <label className="champ">
            <span>Ordre</span>
            <input
              type="text"
              name="ordre"
              defaultValue={ordre(integration)}
              placeholder="protection-operateur-cytotoxiques, comportement-zac, critere-b1-02…"
            />
          </label>
          <div className="actions">
            <button type="submit" className="bouton">
              Enregistrer l&apos;ordre
            </button>
          </div>
        </form>
        <p className="legende">Ordre actuel — maintien : {ordre(maintien) || "ordre de la fiche"}.</p>
      </section>
      <details className="bloc">
        <summary>Identifiants des {modules.length} modules</summary>
        <div className="contenu-bloc">
          {modules.map((m) => (
            <div key={m.id} className="ligne-critere">
              <span className="code">{typeof m.critereId === "string" ? m.critereId : "—"}</span>
              <span className="libelle">
                <code>{m.id}</code> — {m.titre}
              </span>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
