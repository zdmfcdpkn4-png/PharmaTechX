import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listerSituations } from "@/content/banque-db";
import { getTousModulesAvecDeposes } from "@/content/store";
import { titreModule as titreDe } from "../commun";
import { actionEnregistrerSituation, actionSupprimerSituation } from "../actions";

export const dynamic = "force-dynamic";

export default async function Situations({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; ok?: string; erreur?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const modules = await getTousModulesAvecDeposes();
  const moduleId = modules.some((m) => m.id === p.module) ? p.module : undefined;
  const situations = await listerSituations(moduleId);
  const titreModule = (id: string) => titreDe(modules, id);

  return (
    <>
      <section className="panneau-titre">
        <h1>Mises en situation</h1>
        <p>
          Une vignette décrit un cas concret de l&apos;unité ; les questions qui s&apos;y
          rattachent sont tirées ensemble, avec la vignette entière. Créez la situation ici, puis
          rattachez-lui des questions depuis leur formulaire.
        </p>
      </section>

      {p.ok && <p className="encart encart--ok">Mise en situation enregistrée.</p>}
      {p.erreur && <p className="encart encart--attention">Titre, contexte et module sont obligatoires.</p>}

      <section className="carte">
        <h2>Nouvelle mise en situation</h2>
        <form action={actionEnregistrerSituation}>
          <label className="champ">
            <span>Module</span>
            <select name="moduleId" defaultValue={moduleId ?? ""} required>
              <option value="">— choisir —</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {typeof m.critereId === "string" ? m.critereId : "—"} — {m.titre.slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Titre</span>
            <input type="text" name="titre" maxLength={200} required placeholder="Le sas, la porte et le carton" />
          </label>
          <label className="champ">
            <span>Vignette (400 à 700 caractères, deux paragraphes séparés par une ligne vide)</span>
            <textarea name="contexte" rows={6} maxLength={4000} required />
          </label>
          <div className="actions">
            <button type="submit" className="bouton">Créer</button>
          </div>
        </form>
      </section>

      <div className="section-titre">
        <h2>Situations existantes</h2>
        <span className="compte">{situations.length}</span>
      </div>
      <ul className="liste-nue">
        {situations.map((s) => (
          <li key={s.id} className="carte">
            <div className="etape-tete">
              <strong>{s.titre}</strong>
              <span className="etiquette etiquette--neutre">{s.nb_questions} question{s.nb_questions > 1 ? "s" : ""}</span>
              <span className="legende" style={{ marginLeft: "auto" }}>{titreModule(s.module_id)}</span>
            </div>
            <details className="bloc">
              <summary>Modifier</summary>
              <div className="contenu-bloc">
                <form action={actionEnregistrerSituation}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="moduleId" value={s.module_id} />
                  <label className="champ">
                    <span>Titre</span>
                    <input type="text" name="titre" maxLength={200} defaultValue={s.titre} required />
                  </label>
                  <label className="champ">
                    <span>Vignette</span>
                    <textarea name="contexte" rows={6} maxLength={4000} defaultValue={s.contexte} required />
                  </label>
                  <div className="actions">
                    <button type="submit" className="bouton bouton--compact">Enregistrer</button>
                    <Link href={`/admin/questions/nouvelle?module=${encodeURIComponent(s.module_id)}`} className="bouton bouton--compact bouton--secondaire">
                      Ajouter une question
                    </Link>
                  </div>
                </form>
                {session.role === "admin" && (
                  <form action={actionSupprimerSituation} style={{ marginTop: ".5rem" }}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="moduleId" value={s.module_id} />
                    <button type="submit" className="bouton bouton--compact bouton--discret">
                      Supprimer (les questions restent, détachées)
                    </button>
                  </form>
                )}
              </div>
            </details>
          </li>
        ))}
        {situations.length === 0 && <li className="legende">Aucune mise en situation en base.</li>}
      </ul>
    </>
  );
}
