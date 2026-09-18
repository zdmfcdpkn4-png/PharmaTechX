import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { lireJournal } from "@/lib/journal";

export const dynamic = "force-dynamic";

export default async function Journal() {
  const session = (await getSession())!;
  if (session.role !== "admin") redirect("/admin");
  const entrees = await lireJournal(300);
  return (
    <>
      <section className="panneau-titre">
        <h1>Journal des actions</h1>
        <p>
          Trois cents dernières actions d&apos;administration : rôle et libellé de profil, jamais
          une personne. Les visas y figurent avec le nom saisi par le signataire.
        </p>
      </section>
      <table className="tableau">
        <thead><tr><th>Quand</th><th>Profil</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
        <tbody>
          {entrees.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.quand).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
              <td>{e.role} · {e.libelle}</td>
              <td><code>{e.action}</code></td>
              <td>{e.cible}</td>
              <td className="legende">{Object.keys(e.details).length ? JSON.stringify(e.details) : ""}</td>
            </tr>
          ))}
          {entrees.length === 0 && <tr><td colSpan={5} className="legende">Journal vide.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
