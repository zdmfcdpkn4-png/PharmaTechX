import { sessionRequise } from "@/lib/auth";
import { miseEnService } from "@/lib/config";
import { dataUri, signatureCourante } from "@/lib/signatures";
import { DepotSignature } from "@/components/DepotSignature";
import { actionRetirerSignature } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  retiree: "Signature retirée. Les rapports déjà clos conservent l'image incrustée.",
};

/**
 * Signature du pharmacien — modèle de la console métrologique : une image
 * déposée une fois, incrustée dans chaque rapport clos. Une par code admin.
 */
export default async function Signature({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const p = await searchParams;
  const session = await sessionRequise("admin");
  const courante = await signatureCourante(session.acces);
  const enService = miseEnService();

  return (
    <>
      <section className="panneau-titre">
        <h1>Signature du pharmacien</h1>
        <p>
          L&apos;image déposée ici est incrustée dans le rapport au visa du pharmacien, qui clôt le
          rapport. Elle est rattachée à votre code d&apos;accès (« {session.libelle} ») et conservée en
          base. Un rapport clos garde l&apos;image telle qu&apos;elle était au moment du visa.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok" role="status">{MESSAGES[p.ok]}</p>}

      {!session.acces ? (
        <p className="encart encart--attention">
          Votre session a été ouverte par une version antérieure du site et ne porte pas
          l&apos;identifiant de votre code. Déconnectez-vous puis reconnectez-vous pour déposer une signature.
        </p>
      ) : (
        <section className="carte">
          <h2 style={{ fontSize: "1.15rem" }}>Image de signature</h2>
          <DepotSignature courante={courante ? dataUri(courante) : null} />
          {courante && (
            <form action={actionRetirerSignature} style={{ marginTop: "1rem" }}>
              <div className="actions">
                <button type="submit" className="bouton bouton--compact bouton--secondaire">Retirer la signature</button>
              </div>
            </form>
          )}
        </section>
      )}

      <p className="encart">
        Ni l&apos;image incrustée ni le visa par clic ne valent signature électronique au sens du
        règlement eIDAS : la valeur de preuve vient du registre, de l&apos;empreinte et du journal.
        Le rapport clos est une preuve opposable de l&apos;étape 2 (décision du 18/09/2026) : la
        procédure de référence doit décrire ce mode de signature.
        {enService ? "" : " Le site est en phase d'essai : les rapports ne valent pas preuve tant que la mise en service n'est pas prononcée."}
      </p>
    </>
  );
}
