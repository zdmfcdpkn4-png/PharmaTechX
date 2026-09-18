import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { enrichirErreurReseau, fabriqueSocket, familleIp, libelleFamille } from "../lib/reseau";

test("familleIp : 4 par défaut, 6 et auto acceptés, le reste refusé", () => {
  assert.equal(familleIp(undefined), 4);
  assert.equal(familleIp(""), 4);
  assert.equal(familleIp(" IPv4 "), 4);
  assert.equal(familleIp("6"), 6);
  assert.equal(familleIp("ipv6"), 6);
  assert.equal(familleIp("auto"), null);
  assert.throws(() => familleIp("5"), /DATABASE_IP=5/);
  assert.equal(libelleFamille(4), "4");
  assert.equal(libelleFamille(null), "auto");
});

test("fabriqueSocket(4) : l'hôte « localhost » est résolu en IPv4 à chaque connexion", async () => {
  const serveur = net.createServer((c) => c.end());
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const port = (serveur.address() as net.AddressInfo).port;
  try {
    for (let i = 0; i < 2; i++) {
      const s = fabriqueSocket(4)();
      const famille = await new Promise<string | undefined>((ok, ko) => {
        s.once("error", ko);
        s.connect(port, "localhost");
        s.once("connect", () => ok(s.remoteFamily));
      });
      assert.equal(famille, "IPv4");
      s.destroy();
    }
    // une adresse littérale n'est pas résolue et passe telle quelle
    const s = fabriqueSocket(4)();
    const adresse = await new Promise<string | undefined>((ok, ko) => {
      s.once("error", ko);
      s.connect(port, "127.0.0.1");
      s.once("connect", () => ok(s.remoteAddress));
    });
    assert.equal(adresse, "127.0.0.1");
    s.destroy();
  } finally {
    serveur.close();
  }
});

test("fabriqueSocket(null) : socket natif, connexion positionnelle intacte", async () => {
  const serveur = net.createServer((c) => c.end());
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const port = (serveur.address() as net.AddressInfo).port;
  try {
    const s = fabriqueSocket(null)();
    await new Promise<void>((ok, ko) => {
      s.once("error", ko);
      s.connect(port, "127.0.0.1");
      s.once("connect", () => ok());
    });
    s.destroy();
  } finally {
    serveur.close();
  }
});

test("enrichirErreurReseau : hôte sans adresse dans la famille, IPv6 injoignable", () => {
  const e1 = Object.assign(new Error("getaddrinfo ENOTFOUND db.abc.supabase.co"), { code: "ENOTFOUND" });
  assert.match(enrichirErreurReseau(e1, 4).message, /aucune adresse IPv4 .*DATABASE_IP=4.*pooler de session/);
  // pas de double enrichissement
  assert.equal(enrichirErreurReseau(e1, 4).message.split("DATABASE_IP").length, 2);
  const e2 = Object.assign(new Error("connect ENETUNREACH 2a05:d018::1:5432"), {
    code: "ENETUNREACH",
    address: "2a05:d018::1",
  });
  assert.match(enrichirErreurReseau(e2, null).message, /IPv6 injoignable.*DATABASE_IP=4/);
  const e3 = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
  assert.equal(enrichirErreurReseau(e3, 4).message, "connect ECONNREFUSED 127.0.0.1:5432");
  const e4 = Object.assign(new Error("getaddrinfo ENOTFOUND hote"), { code: "ENOTFOUND" });
  assert.equal(enrichirErreurReseau(e4, null).message, "getaddrinfo ENOTFOUND hote");
});
