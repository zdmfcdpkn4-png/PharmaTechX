import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, listerZip, zip } from "../lib/zip";

test("crc32 de référence", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  assert.equal(crc32(Buffer.alloc(0)), 0);
});

test("archive stockée : trois entrées relisibles, noms UTF-8, contenus intacts", () => {
  const html = "<!DOCTYPE html><p>é</p>";
  const archive = zip(
    [
      { nom: "RAP-2026-0001.html", contenu: html },
      { nom: "RAP-2026-0001.csv", contenu: "﻿a;b\r\n1;2\r\n" },
      { nom: "dossier/résumé.json", contenu: Buffer.from("{}") },
    ],
    new Date(2026, 8, 18, 14, 2, 0),
  );
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  const entrees = listerZip(archive);
  assert.deepEqual(
    entrees.map((e) => e.nom),
    ["RAP-2026-0001.html", "RAP-2026-0001.csv", "dossier/résumé.json"],
  );
  assert.equal(entrees[0].taille, Buffer.byteLength(html));
  assert.equal(entrees[0].crc, crc32(Buffer.from(html)));
  // Les données de la première entrée suivent son entête local.
  const nomLen = archive.readUInt16LE(26);
  const debut = 30 + nomLen;
  assert.equal(archive.toString("utf8", debut, debut + Buffer.byteLength(html)), html);
});
