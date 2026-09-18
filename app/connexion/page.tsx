import Link from "next/link";
import { baseConfiguree } from "@/lib/db";
import { secretConfigure } from "@/lib/auth";
import { conservationNominative } from "@/lib/config";
import { actionAmorcage, actionConnexion } from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "code-invalide": "Code non reconnu. Vérifiez la saisie, ou entrez sans code : la consultation reste ouverte.",
  "non-configure": "Le contrôle d'accès n'est pas encore actif : la base de données n'est pas branchée.",
  "deja-amorce": "Un administrateur existe déjà : l'amorçage est fermé.",
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; minutes?: string }>;
}) {
  const { erreur, minutes } = await searchParams;
  const pret = baseConfiguree();
  const nominative = conservationNominative();
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
          L&apos;accès se fait par code de rôle : administration, tutorat, ou poste de travail. Un
          code ne désigne aucune personne — il n&apos;y a ni identifiant nominatif, ni mot de passe
          individuel, ni historique rattaché à un agent.
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
              <Link href="/" className="bouton bouton--secondaire">
                Consulter sans code
              </Link>
            </div>
            <p className="legende">
              Sans code, vous accédez aux modules et aux évaluations. La banque de questions, les
              dépôts de documents, les visas et l&apos;ordonnancement des modules demandent un code
              de tutorat ou d&apos;administration.
            </p>
          </form>
        </section>

        <section className="carte" aria-labelledby="titre-profils">
          <h2 id="titre-profils">Ce qu&apos;ouvre chaque profil</h2>
          <ul className="profils">
            <li>
              <strong>Poste de travail</strong> <span className="etiquette etiquette--neutre">apprenant</span>
              <p>Lecture des modules, passation des évaluations et des entraînements, export du rapport. Profil par défaut : aucun code requis.</p>
            </li>
            <li>
              <strong>Tutorat</strong> <span className="etiquette etiquette--neutre">N3</span>
              <p>Banque de questions (création, dépôt, validation), mises en situation, documents rattachés, signalements, codes de poste{nominative ? ", visa tuteur des rapports" : ""}.</p>
            </li>
            <li>
              <strong>Administration</strong> <span className="etiquette etiquette--neutre">pharmacien</span>
              <p>Tout ce qui précède, plus les codes de tous rôles, la suppression, le journal{nominative ? ", le visa pharmacien et l'annulation des rapports" : ""}.</p>
            </li>
          </ul>
        </section>
      </div>

      <section className="encart" aria-labelledby="titre-donnees">
        <h2 id="titre-donnees" style={{ fontSize: "1.1rem" }}>
          {nominative ? "Ce que le site enregistre" : "Ce que le site enregistre : rien de nominatif"}
        </h2>
        <ul style={{ margin: ".5rem 0 0", paddingLeft: "1.25rem" }}>
          <li>Les codes d&apos;accès, hachés : la base ne permet pas de les relire.</li>
          <li>Les réponses transmises pour correction ne portent ni nom, ni matricule, ni adresse ; les échecs de connexion sont comptés par empreinte d&apos;adresse, jamais l&apos;adresse elle-même.</li>
          <li>Les résultats vivent en mémoire de l&apos;onglet le temps de la session ; le repère de lecture d&apos;un module reste sur le poste, effaçable depuis le sommaire.</li>
          {nominative ? (
            <li>
              <strong>Les rapports émis par l&apos;apprenant</strong> sont enregistrés avec le nom qu&apos;il saisit, numérotés, scellés et visés par le tuteur puis le pharmacien responsable. Durée de conservation et information des agents : <code className="a-preciser">[à préciser]</code>.
            </li>
          ) : (
            <li>Aucun résultat n&apos;est conservé : le rapport téléchargé par l&apos;apprenant est le seul support.</li>
          )}
          <li>Les actions d&apos;administration sont journalisées par rôle et libellé de profil.</li>
        </ul>
      </section>

      {pret && (
        <section className="carte">
          <h2>Première mise en service</h2>
          <p className="legende">
            S&apos;il n&apos;existe encore aucun administrateur, ce bouton en crée un et affiche son
            code une seule fois. Il devient inopérant dès qu&apos;un administrateur existe.
          </p>
          <form action={actionAmorcage}>
            <button type="submit" className="bouton bouton--secondaire">
              Créer l&apos;administrateur initial
            </button>
          </form>
        </section>
      )}
    </article>
  );
}
