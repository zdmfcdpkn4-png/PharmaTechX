/**
 * Barre de progression du test (demande du 22/09/2026) : une pastille par
 * question, dans la barre de passation. Même langage que la barre du
 * parcours — en couleur ce qui est fait, grisé ce qui reste — : renseignée
 * en évaluation, corrigée en entraînement ; la question en cours est cerclée.
 *
 * Signalétique seulement : les pastilles sont masquées aux lecteurs d'écran,
 * qui lisent la barre de progression et le décompte écrit à côté. Au-delà de
 * vingt questions, les numéros disparaissent et les pastilles rétrécissent,
 * pour que la barre de passation garde sa hauteur sur une tablette.
 */
export function PastillesQuestions({
  faites,
  courante = null,
  libelle,
}: {
  /** Pour chaque question, dans l'ordre du tirage : faite ou non. */
  faites: boolean[];
  /** Index de la question à l'écran (entraînement), `null` sinon. */
  courante?: number | null;
  /** Nom de la barre de progression, lu par les lecteurs d'écran. */
  libelle: string;
}) {
  const total = faites.length;
  const nbFaites = faites.filter(Boolean).length;
  const compactes = total > 20;
  return (
    <div
      className={`pastilles-questions${compactes ? " pastilles-questions--compactes" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={nbFaites}
      aria-label={libelle}
    >
      <ol aria-hidden="true">
        {faites.map((f, i) => (
          <li key={i} className={`${f ? "est-faite" : "est-grisee"}${courante === i ? " est-courante" : ""}`}>
            {compactes ? "" : i + 1}
          </li>
        ))}
      </ol>
    </div>
  );
}
