"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSessionFormation } from "./SessionFormation";
import { telechargerRapport } from "@/lib/rapport";

export interface ModuleResume {
  id: string;
  titre: string;
  objectif: string;
  bloc: string;
  critereId: string;
  affectation: "tronc-commun" | "poste";
  postes: string[];
  niveaux: string[];
  dureeMinutes: string;
  redige: boolean;
  nbQuestions: number;
  nbSituations: number;
  periodiciteMois: string;
}

export interface PosteResume {
  id: string;
  libelle: string;
  niveauxRequis: string[];
}

export interface NiveauResume {
  code: string;
  libelle: string;
  filiere: string;
}

const A_PRECISER = "[à préciser]";

function Marqueur({ valeur }: { valeur: string }) {
  if (valeur === A_PRECISER) {
    return <code className="a-preciser">{A_PRECISER}</code>;
  }
  return <>{valeur}</>;
}

function CarteModule({ m }: { m: ModuleResume }) {
  const { dernierPourModule } = useSessionFormation();
  const resultat = dernierPourModule(m.id);

  const corps = (
    <article className={`carte carte--module${m.redige ? "" : " est-vide"}`}>
      <ul className="meta-module">
        <li className="etiquette etiquette--neutre">
          Bloc <Marqueur valeur={m.bloc} />
        </li>
        <li className="etiquette etiquette--neutre">
          Critère <Marqueur valeur={m.critereId} />
        </li>
        {m.redige ? (
          <li className="etiquette">
            {m.nbQuestions} questions · {m.nbSituations} mise
            {m.nbSituations > 1 ? "s" : ""} en situation
          </li>
        ) : (
          <li className="etiquette etiquette--attention">À rédiger</li>
        )}
      </ul>

      <h3>{m.titre}</h3>
      <p className="objectif">
        <Marqueur valeur={m.objectif} />
      </p>

      {resultat && (
        <p
          className={`resultat-ligne ${resultat.reussi ? "ok" : "ko"}`}
          aria-live="polite"
        >
          <strong>{resultat.score}&nbsp;%</strong> —{" "}
          {resultat.reussi ? "critère acquis" : "critère non acquis"}
          {resultat.echecEliminatoire && " (question éliminatoire manquée)"}
        </p>
      )}

      <p className="legende">
        Niveaux&nbsp;: <Marqueur valeur={m.niveaux.join(", ")} /> · Revalidation
        tous les <Marqueur valeur={m.periodiciteMois} /> mois
      </p>
    </article>
  );

  return m.redige ? (
    <Link href={`/module/${m.id}`} className="carte-lien">
      {corps}
    </Link>
  ) : (
    corps
  );
}

export function TableauDeBord({
  troncCommun,
  parPoste,
  postes,
  niveaux,
  parcoursTitre,
}: {
  troncCommun: ModuleResume[];
  parPoste: Record<string, ModuleResume[]>;
  postes: PosteResume[];
  niveaux: NiveauResume[];
  parcoursTitre: string;
}) {
  const [posteId, setPosteId] = useState<string>("");
  const [niveauCode, setNiveauCode] = useState<string>("");
  const { resultats } = useSessionFormation();
  const [nom, setNom] = useState("");
  const [qualite, setQualite] = useState("");

  const parNiveau = (liste: ModuleResume[]) =>
    niveauCode ? liste.filter((m) => m.niveaux.includes(niveauCode)) : liste;

  const socle = parNiveau(troncCommun);
  const modulesPoste = parNiveau(posteId ? (parPoste[posteId] ?? []) : []);

  const programme = useMemo(
    () => [...socle, ...modulesPoste],
    [socle, modulesPoste],
  );

  const rediges = programme.filter((m) => m.redige);
  const evalues = new Set(resultats.map((r) => r.moduleId));
  const acquis = resultats.filter((r) => r.reussi).length;
  const avancement =
    rediges.length === 0
      ? 0
      : Math.round(
          (rediges.filter((m) => evalues.has(m.id)).length / rediges.length) *
            100,
        );

  return (
    <>
      <section className="carte" aria-labelledby="t-filtres">
        <h2 id="t-filtres">Composer le programme</h2>
        <p className="legende">
          Le programme d&apos;un agent se compose du socle transversal (blocs 1
          et 3), exigé de tous, puis des critères de sa filière et de son niveau
          — conformément au chapitre III de la fiche d&apos;habilitation.
        </p>

        <div className="rangee">
          <label className="champ">
            <span>Filière</span>
            <select
              value={posteId}
              onChange={(e) => setPosteId(e.target.value)}
            >
              <option value="">Socle transversal seul</option>
              {postes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.libelle}
                </option>
              ))}
            </select>
          </label>

          <label className="champ">
            <span>Niveau visé</span>
            <select
              value={niveauCode}
              onChange={(e) => setNiveauCode(e.target.value)}
            >
              <option value="">Tous niveaux</option>
              {niveaux.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.libelle}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="tuiles">
        <div className="tuile">
          <span className="valeur">{programme.length}</span>
          <span className="libelle">critères au programme</span>
        </div>
        <div className="tuile">
          <span className="valeur">{rediges.length}</span>
          <span className="libelle">modules disponibles</span>
        </div>
        <div className="tuile">
          <span className="valeur">{resultats.length}</span>
          <span className="libelle">évaluations passées</span>
        </div>
        <div className="tuile">
          <span className="valeur">{acquis}</span>
          <span className="libelle">critères acquis</span>
        </div>
      </div>

      <div className="avancement" aria-hidden="true">
        <span style={{ width: `${avancement}%` }} />
      </div>
      <p className="legende">
        {avancement}&nbsp;% des modules disponibles ont été évalués dans cette
        session — {parcoursTitre.toLowerCase()}.
      </p>

      <div className="section-titre">
        <h2>Socle transversal</h2>
        <span className="compte">
          {socle.length} critère{socle.length > 1 ? "s" : ""} — blocs 1 et 3,
          prérequis aux deux parcours
        </span>
      </div>
      <div className="grille">
        {socle.map((m) => (
          <CarteModule key={m.id} m={m} />
        ))}
      </div>

      <div className="section-titre">
        <h2>Critères de la filière</h2>
        <span className="compte">
          {posteId
            ? `${modulesPoste.length} critère(s)`
            : "aucune filière choisie"}
        </span>
      </div>
      {posteId ? (
        <div className="grille">
          {modulesPoste.map((m) => (
            <CarteModule key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <p className="encart">
          Choisir une filière ci-dessus — Chimiothérapie, Préparatoire ou
          Encadrement — pour afficher les critères qui s&apos;y rattachent.
        </p>
      )}

      <div className="section-titre">
        <h2>Rapport de session</h2>
        <span className="compte">{resultats.length} évaluation(s)</span>
      </div>
      <section className="carte">
        <p>
          Le rapport reprend chaque critère évalué, sa note et le détail question
          par question. Il est écrit sur le poste de l&apos;apprenant : le nom
          saisi ci-dessous n&apos;est envoyé nulle part, il ne sert qu&apos;à
          renseigner l&apos;en-tête du fichier au moment du téléchargement.
        </p>

        <div className="rangee">
          <label className="champ">
            <span>Nom de l&apos;apprenant</span>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom Prénom"
              autoComplete="off"
            />
          </label>
          <label className="champ">
            <span>Qualité</span>
            <input
              type="text"
              value={qualite}
              onChange={(e) => setQualite(e.target.value)}
              placeholder="Préparateur, interne, niveau visé…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="actions">
          <button
            type="button"
            className="bouton"
            disabled={resultats.length === 0}
            onClick={() =>
              telechargerRapport(
                {
                  nom,
                  qualite,
                  parcours: `${parcoursTitre}${
                    posteId
                      ? ` — ${postes.find((p) => p.id === posteId)?.libelle}`
                      : " — tronc commun"
                  }`,
                },
                resultats,
              )
            }
          >
            Télécharger le rapport
          </button>
          {resultats.length === 0 && (
            <span className="legende">
              Aucune évaluation passée dans cette session.
            </span>
          )}
        </div>
      </section>
    </>
  );
}
