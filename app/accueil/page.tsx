import Link from "next/link";
import { getSession, LIBELLES_ROLE } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationActive, modeConservation } from "@/lib/config";
import { modeStockage } from "@/lib/stockage";
import { comptesAttente } from "@/lib/attente";
import { arriveeDuPoste } from "@/lib/arrivee";
import { totauxQuestions } from "@/content/banque-db";
import { listerModulesDeposes } from "@/content/modules-db";
import { AUCUN_COMPTE, itemsAFaire, totalEnAttente } from "@/content/acces-rapide";
import { aCoteDuCircuit, arretsCircuit } from "@/content/accueil";
import { getReferentiel } from "@/content/referentiel-db";
import { Badge } from "@/components/Badge";
import { CheminAgent } from "@/components/CheminAgent";

export const dynamic = "force-dynamic";

/**
 * Accueil après la connexion (question 91, choix a, 02/10/2026) : « le
 * chemin ». Chaque profil a le sien — l'agent, ses six étapes d'habilitation ;
 * le tutorat et l'administration, le circuit d'une question et d'un rapport.
 * Le bandeau, le menu et l'accès rapide ne changent pas ; le programme garde
 * son adresse (`/`). Les médaillons sont ceux du site, toujours légendés : rien
 * ne repose sur l'image seule.
 */
export default async function Accueil() {
  const session = await getSession();
  if (!session || session.role === "poste") return <AccueilPoste session={session} />;
  return <AccueilGestion role={session.role} />;
}

async function AccueilPoste({ session }: { session: Awaited<ReturnType<typeof getSession>> }) {
  const [{ programme, evaluation, requete }, { filieres }] = await Promise.all([arriveeDuPoste(session), getReferentiel()]);
  const filiere = filieres.find((f) => f.id === session?.filiere)?.libelle;
  const profil = [filiere, session?.niveau].filter(Boolean).join(" · ");
  return (
    <>
      <section className="panneau-titre accueil-titre">
        <p className="sur-titre">{profil || "Poste de travail"}</p>
        <h1>Mon habilitation</h1>
        <p>
          Six étapes ; ce site couvre les deux premières.{" "}
          <strong>Valider un module à l&apos;écran ne vaut pas habilitation.</strong>
        </p>
      </section>
      <section className="carte accueil-carte" aria-label="Les six étapes de l'habilitation">
        <CheminAgent programme={programme} evaluation={evaluation} requete={requete} />
      </section>
      <p className="accueil-liens">
        <Link href={`/${requete}`}>Mon programme</Link>
        <Link href="/reperes#dispositif">Le dispositif</Link>
        <Link href="/donnees-personnelles">Vos données</Link>
      </p>
    </>
  );
}

async function AccueilGestion({ role }: { role: "tuteur" | "admin" }) {
  const conservation = conservationActive();
  const base = baseConfiguree();
  const [comptes, totaux, brouillons] = await Promise.all([
    base ? comptesAttente(role, conservation).catch(() => AUCUN_COMPTE) : Promise.resolve(AUCUN_COMPTE),
    base ? totauxQuestions().catch(() => ({ valides: 0, aVerifier: 0 })) : Promise.resolve({ valides: 0, aVerifier: 0 }),
    base ? listerModulesDeposes("brouillon").then((l) => l.length).catch(() => 0) : Promise.resolve(0),
  ]);
  const arrets = arretsCircuit(role, comptes, conservation, { validees: totaux.valides, brouillons });
  // Le même total que « À faire », dans l'accès rapide : mêmes comptes, même somme.
  const total = totalEnAttente(itemsAFaire(role, comptes, conservation));
  const stockage = modeStockage();
  return (
    <>
      <section className="panneau-titre accueil-titre">
        <p className="sur-titre">
          {LIBELLES_ROLE[role]} · {total === 0 ? "rien en attente" : `${total} en attente`}
        </p>
        <h1>Le circuit</h1>
        <p>D&apos;une question déposée au rapport visé, avec ce qui attend à chaque arrêt.</p>
      </section>

      <section className="carte accueil-carte" aria-label="Le circuit d'une question et d'un rapport">
        <ol className="circuit">
          {arrets.map((a, i) => (
            <li key={a.cle} className={`circuit-arret${a.lien ? "" : " circuit-arret--hors"}`}>
              <span className="circuit-medaillon">
                <Badge nom={a.medaillon} taille={88} />
                {a.enAttente > 0 && (
                  <span className="circuit-compte" aria-hidden="true">
                    {a.enAttente}
                  </span>
                )}
              </span>
              <span className="circuit-titre">
                {a.lien ? (
                  <Link href={a.lien.href} className="circuit-lien">
                    {a.titre}
                    <span className="lecture-seule">
                      {" "}— arrêt {i + 1} sur {arrets.length}, {a.lien.libelle}
                      {a.enAttente > 0 ? `, ${a.enAttente} en attente` : ""}
                    </span>
                  </Link>
                ) : (
                  a.titre
                )}
              </span>
              <span className="circuit-detail">{a.detail}</span>
              {a.autres.length > 0 && (
                <span className="circuit-autres">
                  {a.autres.map((l) => (
                    <Link key={l.href} href={l.href}>
                      {l.libelle}
                    </Link>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>

        <h2 className="circuit-sous">À côté du circuit</h2>
        <ul className="a-cote">
          {aCoteDuCircuit(role).map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="a-cote-lien">
                <Badge nom={x.medaillon} taille={44} />
                <span>{x.titre}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="legende">
        Le site couvre les étapes 1 et 2 de l&apos;habilitation : valider un module ne vaut pas habilitation. Stockage des
        documents : {stockage === "blob" ? "Vercel Blob" : stockage === "base" ? "base de données" : "aucun"} ·
        conservation des rapports :{" "}
        {modeConservation() === "pseudonyme"
          ? "pseudonyme (rapports sous identifiant d'agent, circuit de visas)"
          : "aucune (rapport téléchargé, signature papier)"}
        .
      </p>
    </>
  );
}
