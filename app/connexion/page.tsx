import Link from "next/link";
import { baseConfiguree } from "@/lib/db";
import { secretConfigure } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { actionConnexion } from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "code-invalide": "Code non reconnu. Vérifiez la saisie, ou entrez sans code : la consultation reste ouverte.",
  "non-configure": "Le contrôle d'accès n'est pas encore actif : la base de données n'est pas branchée.",
  "session-fermee":
    "Votre session a été fermée : le code d'accès qui l'avait ouverte a été révoqué, remplacé ou supprimé. Entrez un code en cours de validité.",
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; minutes?: string; suite?: string }>;
}) {
  const { erreur, minutes, suite } = await searchParams;
  const pret = baseConfiguree();
  const conservation = conservationActive();
  const message =
    erreur === "bloque"
      ? `Trop de tentatives : nouvel essai possible dans ${minutes ?? "15"} minute${Number(minutes ?? 15) > 1 ? "s" : ""}.`
      : erreur
        ? MESSAGES[erreur]
        : null;

  return (
    <article className="connexion">
      <section className="panneau-titre">
        <p className="sur-titre">Accès à l&apos;outil</p>
        <h1>Un code ouvre un profil, pas un compte</h1>
        <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>
          Le site est réservé au personnel de l&apos;unité : tout s&apos;ouvre par un code de rôle,
          poste de travail, tutorat ou administration. Un code ne désigne aucune personne. Seul
          l&apos;agent qui le décide rattache sa progression à son identifiant, avec un code
          personnel.
        </p>
      </section>

      {!pret && (
        <div className="encart encart--attention" role="status">
          <strong>Contrôle d&apos;accès inactif — le site est ouvert à quiconque a l&apos;adresse.</strong>
          <p style={{ margin: ".5rem 0 0" }}>
            La base de données n&apos;est pas branchée : aucun code n&apos;est vérifié et tous les
            écrans sont accessibles. Renseignez <code>DATABASE_URL</code> et <code>AUTH_SECRET</code>,
            puis rechargez cette page. Cet état doit être levé avant tout usage du dispositif comme
            preuve en audit.
          </p>
        </div>
      )}

      {pret && !secretConfigure() && (
        <p className="encart encart--attention">
          <strong>Variable <code>AUTH_SECRET</code> absente.</strong> Les sessions ne survivront pas à
          un redéploiement et leur signature est prévisible. Ajoutez-la dans les variables
          d&apos;environnement (une chaîne aléatoire d&apos;au moins 32 caractères).
        </p>
      )}

      {message && (
        <p className="encart encart--attention" role="alert">
          {message}
        </p>
      )}

      <div className="connexion-colonnes">
        <section className="carte">
          <h2>Entrer un code de rôle</h2>
          <form action={actionConnexion}>
            {suite && <input type="hidden" name="suite" value={suite} />}
            <label className="champ champ--code">
              <span>Code d&apos;accès</span>
              <input
                type="password"
                name="code"
                placeholder="XXXXX-XXXXX"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                required
                disabled={!pret}
                aria-describedby="aide-code"
              />
              <span id="aide-code" className="aide">
                Dix caractères, séparés par un tiret. Le code est remis par le tutorat ou
                l&apos;administration.
              </span>
            </label>
            <div className="actions">
              <button type="submit" className="bouton" disabled={!pret}>
                Entrer
              </button>
              {!pret && (
                <Link href="/" className="bouton bouton--secondaire">
                  Consulter sans code
                </Link>
              )}
            </div>
            <p className="legende">
              {pret
                ? "Le code de poste ouvre les modules, les évaluations et les documents. Les codes de tutorat et d'administration ouvrent en plus la banque de questions, les dépôts, les visas et l'ordonnancement des modules."
                : "Sans base, vous accédez aux modules et aux évaluations. La banque de questions, les dépôts de documents, les visas et l'ordonnancement des modules demandent un code de tutorat ou d'administration."}
            </p>
          </form>
        </section>

        <section className="carte" aria-labelledby="titre-profils">
          <h2 id="titre-profils">Ce qu&apos;ouvre chaque profil</h2>
          <ul className="profils">
            <li>
              <strong>Poste de travail</strong> <span className="etiquette etiquette--neutre">apprenant</span>
              <p>Lecture des modules, passation des évaluations et des entraînements, documents, export ou émission du rapport. Code remis par le tutorat, requis pour tout le site (décision du 18/09/2026).</p>
            </li>
            <li>
              <strong>Tutorat</strong> <span className="etiquette etiquette--neutre">N3</span>
              <p>Banque de questions (création, dépôt, validation), mises en situation, documents rattachés, signalements, codes de poste{conservation ? ", identifiants d'agents, visa tuteur des rapports" : ""}.</p>
            </li>
            <li>
              <strong>Administration</strong> <span className="etiquette etiquette--neutre">pharmacien</span>
              <p>Tout ce qui précède, plus les codes de tous rôles, la suppression, le journal{conservation ? ", le visa pharmacien, l'annulation et la purge des rapports" : ""}.</p>
            </li>
          </ul>
        </section>
      </div>

      <section className="encart" aria-labelledby="titre-donnees">
        <h2 id="titre-donnees" style={{ fontSize: "1.1rem" }}>
          {conservation ? "Ce que le site enregistre : aucun nom" : "Ce que le site enregistre : rien de nominatif"}
        </h2>
        <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.25rem" }}>
          <li>Les codes d&apos;accès, hachés : la base ne permet pas de les relire.</li>
          <li>Les réponses transmises pour correction ne portent ni nom, ni matricule, ni adresse ; les échecs de connexion sont comptés par empreinte d&apos;adresse, jamais l&apos;adresse elle-même.</li>
          <li>Les résultats vivent en mémoire de l&apos;onglet le temps de la session ; le repère de lecture d&apos;un module reste sur le poste, effaçable depuis le sommaire.</li>
          {conservation ? (
            <li>
              <strong>Les rapports émis par l&apos;apprenant</strong> sont enregistrés sous son identifiant d&apos;agent (AG-001…), sans nom, numérotés, scellés et visés par le tuteur puis le pharmacien responsable ; la correspondance identifiant ↔ agent est tenue hors du site et le nom n&apos;est porté qu&apos;à l&apos;édition du rapport. Conservation jusqu&apos;à purge manuelle. <a href="/donnees-personnelles">Vos données et vos droits</a>.
            </li>
          ) : (
            <li>Aucun résultat n&apos;est conservé : le rapport téléchargé par l&apos;apprenant est le seul support.</li>
          )}
          <li>Les actions d&apos;administration sont journalisées par rôle et libellé de profil.</li>
        </ul>
      </section>

    </article>
  );
}
