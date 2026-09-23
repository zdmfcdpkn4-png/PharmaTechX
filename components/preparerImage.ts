/**
 * Préparation d'une image sur l'appareil, avant l'envoi (23/09/2026, reprise
 * du quiz de Flore) : décodée par le navigateur, qui applique l'orientation
 * EXIF, réduite à 2 000 px de côté et ré-encodée sous 2 Mo, la limite du
 * serveur. Ce qui décide est dans `content/preparation-image.ts`.
 *
 * Une image que ce navigateur ne sait pas décoder part telle quelle : le
 * serveur la refuse alors en le disant, comme avant.
 */
import {
  aReencoder,
  dimensionsReduites,
  IMAGE_MAX_OCTETS,
  nomJpeg,
  QUALITES_JPEG,
  type BilanImage,
} from "@/content/preparation-image";

export interface ImagePreparee extends BilanImage {
  fichier: File;
}

function decoder(f: Blob): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      res(im);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      res(null);
    };
    im.src = url;
  });
}

function versBlob(c: HTMLCanvasElement, type: string, qualite?: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob(res, type, qualite));
}

/** Toile à la taille voulue ; fond blanc pour un JPEG, qui n'a pas de transparence. */
function toile(im: HTMLImageElement, w: number, h: number, fondBlanc: boolean): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  if (fondBlanc) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(im, 0, 0, w, h);
  return c;
}

export async function preparerImage(f: File): Promise<ImagePreparee> {
  const telle: ImagePreparee = { fichier: f, reencodee: false, avant: f.size, apres: f.size };
  const im = await decoder(f);
  if (!im || !im.naturalWidth || !im.naturalHeight) return telle;
  if (!aReencoder(f.type, f.size, im.naturalWidth, im.naturalHeight)) return telle;
  let { w, h } = dimensionsReduites(im.naturalWidth, im.naturalHeight);
  // Un PNG reste PNG si la réduction suffit : traits nets, transparence gardée.
  if (f.type === "image/png") {
    const c = toile(im, w, h, false);
    const b = c ? await versBlob(c, "image/png") : null;
    if (b && b.size <= IMAGE_MAX_OCTETS) {
      return { fichier: new File([b], f.name, { type: "image/png" }), reencodee: true, avant: f.size, apres: b.size };
    }
  }
  for (let essai = 0; essai < 3; essai++) {
    const c = toile(im, w, h, true);
    if (!c) return telle;
    for (const q of QUALITES_JPEG) {
      const b = await versBlob(c, "image/jpeg", q);
      if (b && b.size <= IMAGE_MAX_OCTETS) {
        return { fichier: new File([b], nomJpeg(f.name), { type: "image/jpeg" }), reencodee: true, avant: f.size, apres: b.size };
      }
    }
    ({ w, h } = dimensionsReduites(w, h, Math.round(Math.max(w, h) * 0.75)));
  }
  return telle;
}

/**
 * Prépare les fichiers d'un champ et les remet à leur place, dans le même
 * ordre : c'est le champ, tel quel, qui part avec le formulaire.
 */
export async function preparerChamp(input: HTMLInputElement): Promise<ImagePreparee[]> {
  const fichiers = [...(input.files ?? [])];
  const faites: ImagePreparee[] = [];
  for (const f of fichiers) faites.push(await preparerImage(f));
  if (faites.some((p) => p.reencodee)) {
    try {
      const dt = new DataTransfer();
      for (const p of faites) dt.items.add(p.fichier);
      input.files = dt.files;
    } catch {
      // Champ non modifiable ici : les fichiers d'origine partent, le serveur trie.
      return fichiers.map((f) => ({ fichier: f, reencodee: false, avant: f.size, apres: f.size }));
    }
  }
  return faites;
}
