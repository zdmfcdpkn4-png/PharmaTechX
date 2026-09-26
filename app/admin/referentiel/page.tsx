import { redirect } from "next/navigation";

/**
 * L'ancien Référentiel s'est scindé en Filières et Niveaux, dans le sous-menu
 * Squelette (question 81, choix a, 26/09/2026). L'adresse reste servie, pour
 * les liens déjà enregistrés : elle mène aux filières.
 */
export default function Referentiel() {
  redirect("/admin/filieres");
}
