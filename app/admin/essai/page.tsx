import { getReferentiel } from "@/content/referentiel-db";
import { actionDemarrerEssai } from "@/app/actions-essai";
import { MENTION_ESSAI } from "@/lib/essai";

export const dynamic = "force-dynamic";

/**
 * Tester en apprenant (mode test du 23/09/2026, choix a) : le parcours de
 * l'apprenant jusqu'au rapport émis, sans rien écrire en base. Sa propre page
 * depuis la question 91 (choix a) : il était une section de la page des codes,
 * où son lien du menu menait au bas de l'écran. Rangé sous Modules : il essaie
 * le programme, pas une question.
 */
export default async function Essai() {
  const { filieres, niveaux } = await getReferentiel();
  return (
    <>
      <section className="panneau-titre">
        <h1>Tester en apprenant</h1>
        <p>
          Parcourez le site comme un apprenant, jusqu&apos;au rapport émis : rien n&apos;est écrit en base. Le rapport porte
          un numéro ESSAI-… et le filigrane « {MENTION_ESSAI} ».
        </p>
      </section>

      {/* Profil facultatif (24/09/2026) : le programme s'ouvre dessus et le
          niveau devient le niveau cible des évaluations, comme avec un code de poste. */}
      <section className="carte" aria-labelledby="t-essai">
        <h2 id="t-essai">Tester le parcours apprenant</h2>
        <form action={actionDemarrerEssai}>
          <div className="rangee">
            <label className="champ">
              <span>Filière</span>
              <select name="essaiFiliere" defaultValue="">
                <option value="">Au choix, à l&apos;écran</option>
                {filieres
                  .filter((f) => f.id !== "socle")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.libelle}
                    </option>
                  ))}
              </select>
            </label>
            <label className="champ">
              <span>Niveau (niveau cible des évaluations)</span>
              <select name="essaiNiveau" defaultValue="">
                <option value="">Au choix, à l&apos;écran</option>
                {niveaux.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.libelle}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="legende">
            Un profil choisi ouvre directement son programme ; ses évaluations tirent au niveau choisi, comme pour un
            agent muni d&apos;un code de poste. Sans choix, l&apos;apprenant test les choisit à l&apos;écran.
          </p>
          <button type="submit" className="bouton">Démarrer un test</button>
          {/* Sous le bouton (question 91) : la règle utile au moment de lancer le test. */}
          <p className="legende">Testez depuis votre propre poste : le navigateur garde ses repères.</p>
        </form>
      </section>
    </>
  );
}
