import { actionDefinirCode, actionRattacher } from "@/app/actions-progression";
import { BoutonEnvoi } from "./BoutonEnvoi";

/**
 * Rattachement sous un code de poste relié (question 99, choix a, 05/10/2026) :
 * l'identifiant est celui du code, l'agent ne saisit que son code personnel —
 * ou le choisit, la première fois. Posé sur l'accueil et dans « Ma
 * progression » ; le serveur déduit l'identifiant du code et refuse tout autre.
 */
export function RattachementRelie({
  identifiant,
  actif,
  codeDefini,
  depuis,
  texte,
  classe,
}: {
  identifiant: string;
  actif: boolean;
  codeDefini: boolean;
  /** Page qui pose le formulaire : la réponse y revient. */
  depuis: "accueil" | "programme";
  texte?: string | null;
  classe?: string;
}) {
  return (
    <section className="carte" id={depuis === "accueil" ? "rattachement" : undefined} aria-label="Rattacher ma progression">
      {texte && (
        <p className={classe} role="status">
          {texte}
        </p>
      )}
      {!actif ? (
        <p style={{ margin: 0 }}>
          Ce code de poste est relié à <code>{identifiant}</code>, un identifiant clos : aucune progression ne s&apos;y
          rattache. Voyez votre tuteur.
        </p>
      ) : codeDefini ? (
        <>
          <p>
            Ce code de poste est relié à <code>{identifiant}</code>. Saisissez votre code personnel : vos évaluations,
            entraînements et lectures seront conservés sous cet identifiant.
          </p>
          <form action={actionRattacher}>
            <input type="hidden" name="depuis" value={depuis} />
            <div className="rangee">
              <label className="champ">
                <span>Code personnel</span>
                <input
                  type="password"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  maxLength={8}
                  required
                  autoComplete="current-password"
                />
              </label>
            </div>
            <div className="actions">
              <BoutonEnvoi>Rattacher ma progression</BoutonEnvoi>
            </div>
          </form>
        </>
      ) : (
        <>
          <p>
            <strong>Première connexion de {identifiant}</strong> : choisissez un code personnel de 4 à 8 chiffres. Lui
            seul prouve que c&apos;est bien vous ; ne le confiez à personne. Oublié, votre tuteur le réinitialise.
          </p>
          <form action={actionDefinirCode}>
            <input type="hidden" name="depuis" value={depuis} />
            <div className="rangee">
              <label className="champ">
                <span>Code personnel (4 à 8 chiffres)</span>
                <input
                  type="password"
                  name="nouveauCode"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  minLength={4}
                  maxLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label className="champ">
                <span>Confirmez le code</span>
                <input
                  type="password"
                  name="confirmation"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  minLength={4}
                  maxLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="actions">
              <BoutonEnvoi>Choisir ce code et rattacher ma progression</BoutonEnvoi>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
