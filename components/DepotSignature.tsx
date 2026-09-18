"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actionDeposerSignature } from "@/app/admin/signature/actions";

/**
 * Dépôt de l'image de signature — repris de la console métrologique : l'image
 * est réduite à 600 px de large dans le navigateur, en PNG, avant l'envoi.
 * Si le navigateur ne sait pas la redessiner, le fichier part tel quel et le
 * serveur juge (PNG ou JPEG, 2 Mo au plus).
 */
const LARGEUR_MAX = 600;

async function reduire(fichier: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(fichier);
    if (bitmap.width <= LARGEUR_MAX && (fichier.type === "image/png" || fichier.type === "image/jpeg")) {
      bitmap.close();
      return fichier;
    }
    const echelle = Math.min(1, LARGEUR_MAX / bitmap.width);
    const toile = document.createElement("canvas");
    toile.width = Math.max(1, Math.round(bitmap.width * echelle));
    toile.height = Math.max(1, Math.round(bitmap.height * echelle));
    const ctx = toile.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(bitmap, 0, 0, toile.width, toile.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resoudre) => toile.toBlob(resoudre, "image/png"));
    return blob ?? fichier;
  } catch {
    return fichier;
  }
}

export function DepotSignature({ courante }: { courante: string | null }) {
  const router = useRouter();
  const [apercu, setApercu] = useState<string | null>(null);
  const [etat, setEtat] = useState<"repos" | "envoi" | "fait" | "erreur">("repos");
  const [message, setMessage] = useState<string | null>(null);

  const deposer = async (fichier: File) => {
    setEtat("envoi");
    setMessage(null);
    try {
      const blob = await reduire(fichier);
      setApercu(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("fichier", blob, "signature.png");
      const r = await actionDeposerSignature(fd);
      if (r.ok) {
        setEtat("fait");
        setMessage("Signature enregistrée : elle sera incrustée dans les rapports que vous clorez.");
        router.refresh();
      } else {
        setEtat("erreur");
        setMessage(r.erreur);
      }
    } catch {
      setEtat("erreur");
      setMessage("Le dépôt a échoué.");
    }
  };

  const image = apercu ?? courante;

  return (
    <div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Signature déposée" style={{ display: "block", maxWidth: "100%", maxHeight: 120, marginBottom: ".75rem", background: "#fff", padding: ".25rem", border: "1px solid var(--trait, #d8dde2)" }} />
      ) : (
        <p className="legende">Aucune signature déposée.</p>
      )}
      <label className="champ">
        <span>Image de signature (PNG ou JPEG, réduite à {LARGEUR_MAX} px de large)</span>
        <input
          type="file"
          name="fichier"
          accept="image/png,image/jpeg"
          disabled={etat === "envoi"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void deposer(f);
          }}
        />
      </label>
      {message && (
        <p className={`encart ${etat === "erreur" ? "encart--attention" : "encart--ok"}`} role="status">{message}</p>
      )}
      {etat === "envoi" && <p className="legende">Envoi…</p>}
    </div>
  );
}
