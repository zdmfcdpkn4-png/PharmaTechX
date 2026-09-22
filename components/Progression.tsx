import Link from "next/link";
import { actionDefinirCode, actionDetacher, actionRattacher } from "@/app/actions-progression";
import { LIBELLES_COURTS_VERDICT, type Verdict } from "@/lib/decision";
import { historique, statistiquesAgent, type LigneProgression, type Rattachement, type ResumeEntrainement } from "@/lib/progression";
import { getTousModulesAvecDeposes } from "@/content/store";

/**
 * « Ma progression » (décision du 18/09/2026, question 11, choix c) :
 * rattachement par identifiant d'agent et code personnel, puis résumé et
 * historique des traces conservées sous cet identifiant. Composant serveur :
 * les formulaires sont de simples actions.
 */

const MESSAGES: Record<string, string> = {
  ok: "Progression rattachée : vos évaluations, entraînements et lectures sont conservés sous votre identifiant.",
  inconnu: "Identifiant inconnu : vérifiez-le auprès de votre tuteur.",
  clos: "Cet identifiant est clos : aucune progression ne peut plus s'y rattacher.",
  code: "Code personnel incorrect. Oublié ? Votre tuteur peut le réinitialiser.",
  format: "Saisissez votre identifiant (AG-001, AG-002…).",
  "format-code": "Le code personnel compte 4 à 8 chiffres.",
  confirmation: "Les deux saisies du code ne concordent pas.",
  deja: "Un code personnel existe déjà pour cet identifiant : saisissez-le.",
  indisponible: "Le rattachement n'est pas disponible sur ce site.",
};

const NATURES: Record<LigneProgression["nature"], string> = {
  evaluation: "Évaluation",
  entrainement: "Entraînement",
  lecture: "Lecture",
};

function date(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
}

export async function Progression({
  rattache,
  message,
  premiere,
  minutes,
}: {
  rattache: Rattachement | null;
  message?: string;
  premiere?: string;
  minutes?: string;
}) {
  const texte = message ? (message === "bloque" ? `Trop de tentatives : réessayez dans ${minutes ?? "quelques"} minutes.` : MESSAGES[message]) : null;
  const classe = message === "ok" ? "encart encart--ok" : "encart encart--attention";

  if (rattache) {
    const [stats, traces, modules] = await Promise.all([
      statistiquesAgent(rattache.agentId),
      historique(rattache.agentId),
      getTousModulesAvecDeposes(),
    ]);
    const titre = (id: string) => modules.find((m) => m.id === id)?.titre ?? id;
    const recentes = [...traces].reverse().slice(0, 40);
    return (
      <section id="progression" className="section">
        <h2>Ma progression</h2>
        {texte && <p className={classe} role="status">{texte}</p>}
        <section className="carte">
          <p>
            Progression rattachée à <code>{rattache.identifiant}</code> : évaluations, entraînements et lectures y sont
            conservés ; une évaluation interrompue se reprend.
          </p>
          <div className="tuiles">
            <div className="tuile"><span className="valeur">{stats.evaluations}</span><span className="libelle">évaluations conservées</span></div>
            <div className="tuile"><span className="valeur">{stats.entrainements}</span><span className="libelle">entraînements terminés</span></div>
            <div className="tuile"><span className="valeur">{stats.lectures}</span><span className="libelle">modules lus</span></div>
            <div className="tuile"><span className="valeur">{stats.derniere ? date(stats.derniere).split(" ")[0] : "—"}</span><span className="libelle">dernière activité</span></div>
          </div>
          {recentes.length > 0 ? (
            <table className="tableau" style={{ marginTop: "1rem" }}>
              <thead>
                <tr><th>Date</th><th>Nature</th><th>Module</th><th>Résultat</th></tr>
              </thead>
              <tbody>
                {recentes.map((t) => {
                  const e = t.nature === "entrainement" ? (t.resultat as ResumeEntrainement | null) : null;
                  return (
                    <tr key={t.id}>
                      <td>{date(t.cree_le)}</td>
                      <td>{NATURES[t.nature]}</td>
                      <td>{titre(t.module_id)}</td>
                      <td>
                        {t.nature === "evaluation" && t.score !== null
                          ? `${t.score} % · ${t.verdict ? LIBELLES_COURTS_VERDICT[t.verdict as Verdict] ?? t.verdict : ""}`
                          : t.nature === "entrainement" && e
                            ? `${e.justes} / ${e.total} justes`
                            : "lu"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="legende">Aucune trace pour l&apos;instant : lisez un module, passez une évaluation.</p>
          )}
          <form action={actionDetacher} className="actions">
            <button type="submit" className="bouton bouton--compact bouton--secondaire">Se détacher</button>
            <span className="legende">Sur un poste partagé, détachez-vous en partant : le rattachement expire seul au bout de douze heures.</span>
          </form>
        </section>
      </section>
    );
  }

  if (premiere) {
    return (
      <section id="progression" className="section">
        <h2>Ma progression</h2>
        {texte && <p className={classe} role="status">{texte}</p>}
        <section className="carte">
          <p>
            <strong>Première fois pour {premiere}</strong> : choisissez un code personnel de 4 à 8 chiffres. Il protège votre
            progression sur un poste partagé ; ne le confiez à personne. Oublié, votre tuteur le réinitialise.
          </p>
          <form action={actionDefinirCode}>
            <input type="hidden" name="identifiant" value={premiere} />
            <div className="rangee">
              <label className="champ">
                <span>Code personnel (4 à 8 chiffres)</span>
                <input type="password" name="nouveauCode" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} required autoComplete="new-password" />
              </label>
              <label className="champ">
                <span>Confirmez le code</span>
                <input type="password" name="confirmation" inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} required autoComplete="new-password" />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="bouton">Choisir ce code et rattacher ma progression</button>
              <Link href="/#progression" className="bouton bouton--secondaire">Annuler</Link>
            </div>
          </form>
        </section>
      </section>
    );
  }

  return (
    <section id="progression" className="section">
      <h2>Ma progression</h2>
      {texte && <p className={classe} role="status">{texte}</p>}
      <section className="carte">
        <p>
          Rattachez vos évaluations à votre identifiant pour les retrouver d&apos;une session à l&apos;autre. Première
          fois : saisissez-le, puis choisissez un code personnel.
        </p>
        <form action={actionRattacher}>
          <div className="rangee">
            <label className="champ">
              <span>Identifiant d&apos;agent</span>
              <input type="text" name="identifiant" placeholder="AG-001" required autoComplete="off" maxLength={20} />
            </label>
            <label className="champ">
              <span>Code personnel</span>
              <input type="password" name="code" inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8} autoComplete="current-password" placeholder="Vide la première fois" />
            </label>
          </div>
          <div className="actions">
            <button type="submit" className="bouton">Reprendre ma progression</button>
          </div>
        </form>
      </section>
    </section>
  );
}
