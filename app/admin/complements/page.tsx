import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { baseConfiguree, depotsDuModule, type LigneDepot } from "@/lib/db";
import { procedureReference } from "@/lib/config";
import { lireComplements } from "@/lib/complements-db";
import {
  COMPLEMENTS_FIXES,
  LONGUEUR_MAX_COMPLEMENT,
  complementsDesRessources,
  complementsDesTextes,
  type Complement,
  type GroupeComplement,
} from "@/content/complements";
import { getTousModules } from "@/content/store";
import { actionEnregistrerComplement } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  renseigne: "Enregistré : l'encadré est remplacé partout où il paraissait.",
  efface: "Effacé : l'encadré revient.",
};

const ERREURS: Record<string, string> = {
  inconnu: "Élément inconnu.",
  base: "Sans base de données, rien ne s'enregistre ici.",
};

const GROUPES: { groupe: GroupeComplement; titre: string }[] = [
  { groupe: "dispositif", titre: "Le dispositif" },
  { groupe: "rgpd", titre: "Page RGPD" },
  { groupe: "texte", titre: "Données locales du texte des modules rédigés" },
  { groupe: "module", titre: "Documents à rattacher des modules rédigés" },
];

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/**
 * À compléter (02/10/2026, demande directe) : ce que le site affiche en
 * encadré jaune tant qu'il manque, renseigné ici par l'administration. Une
 * valeur remplace l'encadré partout ; effacée, l'encadré revient.
 */
export default async function ACompleter({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const p = await searchParams;
  await sessionRequise("admin");
  const modules = getTousModules();
  const ressources = complementsDesRessources(modules);
  const tous: Complement[] = [...COMPLEMENTS_FIXES, ...complementsDesTextes(modules), ...ressources];
  const modulesConcernes = [...new Set(ressources.map((r) => r.moduleId!))];
  const [renseignes, documents] = await Promise.all([
    lireComplements(),
    Promise.all(
      modulesConcernes.map(async (id) => [id, baseConfiguree() ? await depotsDuModule(id).catch(() => []) : []] as const),
    ).then((l) => Object.fromEntries(l) as Record<string, LigneDepot[]>),
  ]);
  const faits = tous.filter((c) => renseignes[c.cle]).length;
  const surRender = procedureReference();

  return (
    <>
      <section className="panneau-titre">
        <p className="sur-titre">
          {faits} sur {tous.length} renseigné{faits > 1 ? "s" : ""}
        </p>
        <h1>À compléter</h1>
        <p>
          Ce que le site affiche en encadré jaune tant qu&apos;il manque. Renseigné ici, un élément remplace son encadré
          partout ; effacé, l&apos;encadré revient.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok" role="status">{MESSAGES[p.ok]}</p>}
      {p.erreur && <p className="encart encart--attention">{ERREURS[p.erreur] ?? "Erreur."}</p>}
      {!baseConfiguree() && (
        <p className="encart encart--attention">
          Sans base de données, rien ne s&apos;enregistre : la procédure se pose alors dans Render
          (<code>PROCEDURE_HABILITATION</code>).
        </p>
      )}

      {GROUPES.map(({ groupe, titre }) => {
        const elements = tous.filter((c) => c.groupe === groupe);
        if (elements.length === 0) return null;
        const n = elements.filter((c) => renseignes[c.cle]).length;
        return (
          <div key={groupe}>
            <div className="section-titre">
              <h2>{titre}</h2>
              <span className="compte">
                {n} sur {elements.length}
              </span>
            </div>
            {elements.map((c) => {
              const v = renseignes[c.cle];
              const docs = c.moduleId ? (documents[c.moduleId] ?? []) : [];
              return (
                <section key={c.cle} id={c.cle} className="carte complement">
                  <div className="etape-tete">
                    <h3 style={{ margin: 0 }}>{c.libelle}</h3>
                    {v ? (
                      <span className="etiquette etiquette--ok">Renseigné</span>
                    ) : (
                      <code className="a-preciser">[à compléter]</code>
                    )}
                  </div>
                  <p className="legende">
                    Se voit : <Link href={c.ou.href}>{c.ou.libelle}</Link>. {c.aide}
                  </p>
                  {c.cle === "procedure" && surRender && (
                    <p className="legende">
                      Posée dans Render : « {surRender} ».{" "}
                      {v ? "Celle renseignée ici la remplace." : "Renseignée ici, elle la remplacera."}
                    </p>
                  )}
                  <form action={actionEnregistrerComplement}>
                    <input type="hidden" name="cle" value={c.cle} />
                    <label className="champ">
                      <span>{c.moduleId ? "Référence" : c.libelle}</span>
                      {c.long ? (
                        <textarea name="texte" rows={2} maxLength={LONGUEUR_MAX_COMPLEMENT} defaultValue={v?.texte ?? ""} />
                      ) : (
                        <input type="text" name="texte" maxLength={LONGUEUR_MAX_COMPLEMENT} defaultValue={v?.texte ?? ""} />
                      )}
                    </label>
                    {c.moduleId &&
                      (docs.length > 0 ? (
                        <label className="champ">
                          <span>Document déposé</span>
                          <select name="document" defaultValue={v?.document ? String(v.document) : ""}>
                            <option value="">— aucun —</option>
                            {docs.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.titre}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="legende">
                          Aucun document déposé pour ce module :{" "}
                          <Link href={`/admin/documents?module=${encodeURIComponent(c.moduleId)}`}>Documents</Link>.
                        </p>
                      ))}
                    <div className="actions">
                      <button type="submit" className="bouton bouton--compact">Enregistrer</button>
                      {v && (
                        <button type="submit" name="effacer" value="1" className="bouton bouton--compact bouton--discret">
                          Effacer
                        </button>
                      )}
                    </div>
                  </form>
                  {v && (
                    <p className="legende" style={{ marginBottom: 0 }}>
                      Renseigné par {v.modifiePar} le {date(v.modifieLe)}.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
