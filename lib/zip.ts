/**
 * Archive ZIP minimale, sans compression (méthode « stockage ») et sans
 * dépendance : de quoi livrer le paquet d'archivage d'un rapport (HTML, CSV,
 * JSON) en un seul téléchargement. Les noms sont écrits en UTF-8 (drapeau 0x800).
 */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(donnees: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) c = TABLE_CRC[(c ^ donnees[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dateDos(d: Date): { heure: number; jour: number } {
  const annee = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    jour: ((annee - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface EntreeZip {
  nom: string;
  contenu: Buffer | string;
  date?: Date;
}

export function zip(entrees: EntreeZip[], date = new Date()): Buffer {
  const locaux: Buffer[] = [];
  const central: Buffer[] = [];
  let decalage = 0;

  for (const e of entrees) {
    const nom = Buffer.from(e.nom, "utf8");
    const donnees = typeof e.contenu === "string" ? Buffer.from(e.contenu, "utf8") : e.contenu;
    const crc = crc32(donnees);
    const { heure, jour } = dateDos(e.date ?? date);

    const local = Buffer.alloc(30 + nom.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version requise
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(0, 8); // stockage
    local.writeUInt16LE(heure, 10);
    local.writeUInt16LE(jour, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(donnees.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    nom.copy(local, 30);

    const cd = Buffer.alloc(46 + nom.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version de création
    cd.writeUInt16LE(20, 6); // version requise
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(heure, 12);
    cd.writeUInt16LE(jour, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(donnees.length, 20);
    cd.writeUInt32LE(donnees.length, 24);
    cd.writeUInt16LE(nom.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // commentaire
    cd.writeUInt16LE(0, 34); // disque
    cd.writeUInt16LE(0, 36); // attributs internes
    cd.writeUInt32LE(0, 38); // attributs externes
    cd.writeUInt32LE(decalage, 42);
    nom.copy(cd, 46);

    locaux.push(local, donnees);
    central.push(cd);
    decalage += local.length + donnees.length;
  }

  const tailleCentral = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(decalage, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locaux, ...central, fin]);
}

/** Noms des entrées d'une archive produite par `zip` (lecture du répertoire central). */
export function listerZip(archive: Buffer): { nom: string; taille: number; crc: number }[] {
  const finIdx = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (finIdx < 0) return [];
  const nb = archive.readUInt16LE(finIdx + 10);
  let pos = archive.readUInt32LE(finIdx + 16);
  const out: { nom: string; taille: number; crc: number }[] = [];
  for (let i = 0; i < nb; i++) {
    if (archive.readUInt32LE(pos) !== 0x02014b50) break;
    const crc = archive.readUInt32LE(pos + 16);
    const taille = archive.readUInt32LE(pos + 24);
    const n = archive.readUInt16LE(pos + 28);
    const extra = archive.readUInt16LE(pos + 30);
    const commentaire = archive.readUInt16LE(pos + 32);
    out.push({ nom: archive.toString("utf8", pos + 46, pos + 46 + n), taille, crc });
    pos += 46 + n + extra + commentaire;
  }
  return out;
}
