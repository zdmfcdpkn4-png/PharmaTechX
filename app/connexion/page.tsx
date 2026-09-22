import Link from "next/link";
import { baseConfiguree } from "@/lib/db";
import { secretConfigure } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { actionConnexion } from "@/app/actions";
import { Badge } from "@/components/Badge";

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
        <p style={{ fontSize: "1.0625rem", maxWidth: "52ch" }}>
          Réservé au personnel de l&apos;unité.
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
          </form>
        </section>

        <section className="carte" aria-labelledby="titre-profils">
          <h2 id="titre-profils">Ce qu&apos;ouvre chaque profil</h2>
          <ul className="profils">
            <li>
              <Badge nom="preparation" taille={28} />
              <div>
                <strong>Poste de travail</strong>{" "}
                <span className="etiquette etiquette--neutre">apprenant</span>
                <p>Modules, entraînements, évaluations, rapport.</p>
              </div>
            </li>
            <li>
              <Badge nom="formation" taille={28} />
              <div>
                <strong>Tutorat</strong> <span className="etiquette etiquette--neutre">N3</span>
                <p>
                  Et&nbsp;: banque de questions, dépôts, signalements, codes de poste
                  {conservation ? ", identifiants d'agents, visa tuteur" : ""}.
                </p>
              </div>
            </li>
            <li>
              <Badge nom="controle" taille={28} />
              <div>
                <strong>Administration</strong>{" "}
                <span className="etiquette etiquette--neutre">pharmacien</span>
                <p>
                  Et&nbsp;: codes de tous rôles, référentiel, barème, journal
                  {conservation ? ", visa pharmacien, annulation et purge" : ""}.
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>

      {/* Une ligne au lieu d'un encadré (22/09/2026, « moins visible ») : le
          détail vit sur « Vos données et vos droits », qui est sa place. */}
      <p className="legende">
        {conservation ? "Aucun nom n'est enregistré." : "Rien de nominatif n'est enregistré."}{" "}
        <Link href="/donnees-personnelles">Vos données et vos droits</Link>
      </p>

    </article>
  );
}
