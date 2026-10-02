"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { baseConfiguree, depotsDuModule } from "@/lib/db";
import { journaliser } from "@/lib/journal";
import { enregistrerComplement, lireComplements } from "@/lib/complements-db";
import { COMPLEMENTS_FIXES, complementsDesRessources, complementsDesTextes, lireValeurComplement } from "@/content/complements";
import { getTousModules } from "@/content/store";

/**
 * Renseigne ou efface un élément à compléter (administration seule). La clé
 * doit être au catalogue ; un document doit être un document validé du module
 * concerné. Chaque geste va au journal, avec la valeur d'avant et d'après.
 */
export async function actionEnregistrerComplement(formData: FormData) {
  const s = await sessionRequise("admin");
  const cle = String(formData.get("cle") ?? "");
  const modules = getTousModules();
  const c = [...COMPLEMENTS_FIXES, ...complementsDesTextes(modules), ...complementsDesRessources(modules)].find((x) => x.cle === cle);
  if (!c) redirect("/admin/complements?erreur=inconnu");
  if (!baseConfiguree()) redirect("/admin/complements?erreur=base");

  const effacer = formData.get("effacer") === "1";
  const numero = Number(formData.get("document") ?? "");
  let document = c.moduleId && Number.isInteger(numero) && numero > 0 ? numero : null;
  if (document !== null && !(await depotsDuModule(c.moduleId!)).some((d) => d.id === document)) document = null;
  const apres = effacer ? null : lireValeurComplement({ texte: String(formData.get("texte") ?? ""), document });

  const avant = (await lireComplements())[cle];
  await enregistrerComplement(cle, apres, s);
  await journaliser(s, apres ? "complement:renseigne" : "complement:efface", cle, {
    avant: avant ? { texte: avant.texte, document: avant.document } : null,
    apres,
  });
  // Le pied de chaque page porte la procédure : tout le site se relit.
  revalidatePath("/", "layout");
  redirect(`/admin/complements?ok=${apres ? "renseigne" : "efface"}#${cle}`);
}
