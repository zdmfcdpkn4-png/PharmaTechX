"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { IMAGE_MAX_OCTETS } from "@/lib/images";
import { journaliser } from "@/lib/journal";
import { enregistrerSignature, retirerSignature } from "@/lib/signatures";

/**
 * Dépôt de la signature du pharmacien (code admin). L'image est réduite à
 * 600 px de large dans le navigateur avant l'envoi ; le serveur n'accepte
 * qu'un PNG ou JPEG lisible de 2 Mo au plus.
 */
export async function actionDeposerSignature(formData: FormData): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const s = await sessionRequise("admin");
  if (!s.acces) {
    return { ok: false, erreur: "Votre session date d'une version antérieure : reconnectez-vous, puis déposez la signature." };
  }
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, erreur: "Choisissez une image." };
  if (fichier.size > IMAGE_MAX_OCTETS) return { ok: false, erreur: "Image trop lourde (2 Mo au plus)." };
  const im = await enregistrerSignature(s.acces, Buffer.from(await fichier.arrayBuffer()));
  if (!im) return { ok: false, erreur: "L'image doit être un PNG ou un JPEG lisible." };
  await journaliser(s, "signature:depot", `acces:${s.acces}`, { largeur: im.largeur, hauteur: im.hauteur });
  revalidatePath("/admin/signature");
  return { ok: true };
}

export async function actionRetirerSignature() {
  const s = await sessionRequise("admin");
  if (s.acces) {
    await retirerSignature(s.acces);
    await journaliser(s, "signature:retrait", `acces:${s.acces}`);
  }
  revalidatePath("/admin/signature");
  redirect("/admin/signature?ok=retiree");
}
