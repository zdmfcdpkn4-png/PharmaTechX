import net from "node:net";

/**
 * Famille d'adresses IP pour joindre la base (`DATABASE_IP`) : `4` (défaut),
 * `6`, ou `auto` (résolution laissée à Node, qui essaie les deux).
 *
 * Pourquoi `4` par défaut : le service tourne sur un hébergeur qui ne sort
 * pas en IPv6 `[à vérifier]` (Render), et l'hôte direct d'une base Supabase
 * (`db.<ref>.supabase.co`) n'a qu'une adresse IPv6 sans l'option payante
 * « IPv4 address ». Le pooler de session de Supabase
 * (`*.pooler.supabase.com`, port 5432) répond en IPv4 : c'est lui que
 * `DATABASE_URL` doit désigner. Imposer la famille rend l'échec lisible
 * (« aucune adresse IPv4 pour cet hôte ») au lieu d'un `ENETUNREACH` sur une
 * adresse IPv6, et évite d'attendre un essai IPv6 voué à l'échec.
 *
 * Module pur (pas de `server-only`) pour rester testable avec `tsx --test` ;
 * il n'est importé que par `lib/db.ts`.
 */
export type FamilleIp = 4 | 6 | null;

export function familleIp(valeur: string | undefined = process.env.DATABASE_IP): FamilleIp {
  const v = (valeur ?? "").trim().toLowerCase();
  if (v === "" || v === "4" || v === "ipv4") return 4;
  if (v === "6" || v === "ipv6") return 6;
  if (v === "auto" || v === "0") return null;
  const e = new Error(`DATABASE_IP=${valeur} : attendu 4, 6 ou auto`) as NodeJS.ErrnoException;
  e.code = "DATABASE_IP";
  throw e;
}

/** Libellé pour la page de santé : « 4 », « 6 » ou « auto ». */
export function libelleFamille(f: FamilleIp): string {
  return f === null ? "auto" : String(f);
}

/**
 * Complète le message d'une erreur de connexion quand elle tient à la famille
 * d'adresses : hôte sans adresse dans la famille imposée (`ENOTFOUND`), ou
 * adresse IPv6 injoignable depuis l'hébergeur en résolution automatique.
 * Renvoie la même erreur, pour que `pg` la transmette telle quelle.
 */
export function enrichirErreurReseau<E extends NodeJS.ErrnoException>(e: E, famille: FamilleIp): E {
  if (typeof e?.message !== "string" || e.message.includes("DATABASE_IP")) return e;
  const adresse = (e as { address?: unknown }).address;
  if (e.code === "ENOTFOUND" && famille !== null) {
    e.message += ` — aucune adresse IPv${famille} pour cet hôte (DATABASE_IP=${famille}) ; avec Supabase, DATABASE_URL doit désigner le pooler de session (*.pooler.supabase.com), l'hôte direct db.<ref>.supabase.co n'ayant qu'une adresse IPv6`;
  } else if (
    (e.code === "ENETUNREACH" || e.code === "EHOSTUNREACH") &&
    typeof adresse === "string" &&
    adresse.includes(":")
  ) {
    e.message += ` — adresse IPv6 injoignable depuis cet hébergeur ; poser DATABASE_IP=4 et un hôte joignable en IPv4 (pooler de session Supabase)`;
  }
  return e;
}

/**
 * Fabrique de socket pour `pg` (option `stream`) : chaque connexion du pool
 * résout l'hôte dans la famille imposée, à chaque fois (jamais d'adresse
 * figée : celles d'un pooler changent). `pg` appelle `connect(port, host)` ;
 * une adresse littérale (`127.0.0.1`, `::1`) n'est pas résolue et garde sa
 * famille ; un chemin de socket Unix passe inchangé.
 */
export function fabriqueSocket(famille: FamilleIp): () => net.Socket {
  return () => {
    const s = new net.Socket();
    s.on("error", (e) => enrichirErreurReseau(e as NodeJS.ErrnoException, famille));
    if (famille === null) return s;
    const natif = s.connect.bind(s) as (...args: unknown[]) => net.Socket;
    s.connect = ((...args: unknown[]) => {
      const [port, hote] = args;
      if (typeof port === "number") {
        return natif({ port, host: typeof hote === "string" ? hote : "localhost", family: famille });
      }
      return natif(...args);
    }) as typeof s.connect;
    return s;
  };
}
