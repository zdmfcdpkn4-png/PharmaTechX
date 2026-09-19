"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ETAT_IMPORT_INITIAL, type EtatImport } from "@/app/admin/questions/import-etat";
import type { ModuleChoix } from "./EditeurQuestion";

type ActionImport = (prec: EtatImport, fd: FormData) => Promise<EtatImport>;

/**
 * Dépôt de questions en deux temps — repris du Lecteur QIM · QCM : le texte
 * (collé ou déposé en .txt, .md, .docx, .json) est analysé, l'aperçu montre
 * chaque question reconnue avec ses avertissements, puis l'ajout crée les
 * questions au statut « à vérifier ». Les images se déposent avec le texte :
 * celle d'un schéma s'apparie par nom, sinon par rang ; l'illustration d'un
 * QCM ou d'une QIM, par son nom seulement.
 */
export function ImportQuestions({
  modules,
  moduleInitial,
  analyser,
  confirmer,
}: {
  modules: ModuleChoix[];
  moduleInitial?: string;
  analyser: ActionImport;
  confirmer: ActionImport;
}) {
  const [analyse, actionAnalyse, enAnalyse] = useActionState(analyser, ETAT_IMPORT_INITIAL);
  const [confirmation, actionConfirme, enConfirmation] = useActionState(confirmer, ETAT_IMPORT_INITIAL);

  if (confirmation.etape === "fait") {
    return (
      <section className="carte">
        <p className="encart encart--ok">
          <strong>{confirmation.ajoutees} question{(confirmation.ajoutees ?? 0) > 1 ? "s" : ""} ajoutée{(confirmation.ajoutees ?? 0) > 1 ? "s" : ""}</strong>{" "}
          au statut « à vérifier ». Elles n&apos;entrent dans les tirages qu&apos;une fois validées.
        </p>
        <div className="actions">
          <Link href={`/admin/questions?module=${encodeURIComponent(analyse.moduleId)}&statut=a_verifier`} className="bouton">
            Vérifier ces questions
          </Link>
          <Link href="/admin/questions/import" className="bouton bouton--secondaire">
            Nouveau dépôt
          </Link>
        </div>
      </section>
    );
  }

  if (analyse.etape === "apercu") {
    const nbAvert = analyse.questions.filter((q) => q.avertissements.length > 0).length;
    return (
      <form action={actionConfirme} className="carte">
        <input type="hidden" name="moduleId" value={analyse.moduleId} />
        <input type="hidden" name="nom" value={analyse.nom} />
        <input type="hidden" name="questions" value={JSON.stringify(analyse.questions)} />
        <h2>Aperçu — {analyse.questions.length} question{analyse.questions.length > 1 ? "s" : ""} reconnue{analyse.questions.length > 1 ? "s" : ""}</h2>
        <p className="legende">
          Dépôt « {analyse.nom} » pour le module {analyse.moduleId}.{" "}
          {nbAvert > 0 ? `${nbAvert} question${nbAvert > 1 ? "s" : ""} porte${nbAvert > 1 ? "nt" : ""} un avertissement.` : "Aucun avertissement."}{" "}
          Décochez ce qu&apos;il ne faut pas ajouter.
        </p>
        {analyse.avertissements.length > 0 && (
          <ul className="encart encart--attention" style={{ margin: "0 0 1rem", paddingLeft: "2rem" }}>
            {analyse.avertissements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {confirmation.erreur && (
          <p className="encart encart--attention" role="alert">{confirmation.erreur}</p>
        )}
        <ol className="apercu-import">
          {analyse.questions.map((q, i) => (
            <li key={i} className="apercu-question">
              <div className="etape-tete">
                <label className="option option--compact">
                  <input type="checkbox" name={`exclure-${i}`} />
                  <span>Exclure</span>
                </label>
                <span className="etiquette etiquette--site">
                  {q.format === "SCH"
                    ? "Schéma"
                    : q.format === "ORD"
                      ? "Séquence"
                      : q.format === "TAT"
                        ? "Texte à trous"
                        : q.format}
                </span>
                {q.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
                {!q.corrigeDetecte && <span className="etiquette etiquette--attention">Sans corrigé</span>}
                {(q.format === "SCH" || q.imageNom) && (
                  <span className={`etiquette ${q.imageId ? "etiquette--neutre" : "etiquette--attention"}`}>
                    {q.imageId ? "Image appariée" : "Image à choisir"}
                  </span>
                )}
              </div>
              <p className="question-enonce" style={{ fontSize: "1rem" }}>{q.enonce}</p>
              {q.format === "SCH" ? (
                <p className="legende">
                  {q.legendes.length} légende{q.legendes.length > 1 ? "s" : ""} :{" "}
                  {q.legendes.map((l) => l.attendu || "(sans mot)").join(" · ")}
                </p>
              ) : q.format === "ORD" ? (
                <ol className="apercu-options">
                  {q.options.map((o) => (
                    <li key={o.id} className="vraie">
                      {o.texte}
                    </li>
                  ))}
                </ol>
              ) : q.format === "TAT" ? (
                <ul className="apercu-options">
                  {q.options.map((o, k) => (
                    <li key={o.id} className={o.vrai ? "vraie" : "fausse"}>
                      <span className="num">{o.vrai ? k + 1 : "·"}</span> {o.texte}{" "}
                      <span className="legende">({o.vrai ? "attendue" : "leurre"})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="apercu-options">
                  {q.options.map((o) => (
                    <li key={o.id} className={o.vrai ? "vraie" : "fausse"}>
                      <span className="num">{o.id.toUpperCase()}</span> {o.texte}{" "}
                      <span className="legende">({o.vrai ? "vrai" : "faux"})</span>
                    </li>
                  ))}
                </ul>
              )}
              {q.justification && <p className="legende">Justification : {q.justification}</p>}
              {q.refs.length > 0 && (
                <p className="legende">Sources : {q.refs.map((r) => [r.source, r.libelle].filter(Boolean).join(" — ")).join(" ; ")}</p>
              )}
              {q.avertissements.length > 0 && (
                <p className="legende" style={{ color: "var(--alerte)" }}>{q.avertissements.join(" ")}</p>
              )}
            </li>
          ))}
        </ol>
        <div className="actions">
          <button type="submit" className="bouton" disabled={enConfirmation}>
            {enConfirmation ? "Ajout…" : "Ajouter à la banque, à vérifier"}
          </button>
          <Link href="/admin/questions/import" className="bouton bouton--secondaire">
            Recommencer
          </Link>
        </div>
      </form>
    );
  }

  return (
    <form action={actionAnalyse} className="carte">
      {analyse.erreur && (
        <p className="encart encart--attention" role="alert">{analyse.erreur}</p>
      )}
      <div className="rangee">
        <label className="champ">
          <span>Module de rattachement</span>
          <select name="moduleId" defaultValue={analyse.moduleId || moduleInitial || ""} required>
            <option value="">— choisir —</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.critereId} — {m.titre.slice(0, 70)}{m.redige ? "" : " (à rédiger)"}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Format quand la ligne ne dit ni QCM ni QIM</span>
          <select name="formatDefaut" defaultValue={analyse.formatDefaut}>
            <option value="QCM">QCM</option>
            <option value="QIM">QIM</option>
          </select>
        </label>
      </div>
      <label className="champ">
        <span>Texte à analyser</span>
        <textarea
          name="texte"
          rows={14}
          placeholder={"QCM 1. Énoncé de la question\nA. Proposition (V)\nB. Proposition (F)\nC. Proposition (F)\nD. Proposition (F)\nRéponses : A\nJustification : …\nSource : ANSM — BPP 2023 — 21/07/2023 — https://…\nÉliminatoire : oui\n\nQCM 2. Sur cette photographie, quel équipement manque-t-il ?\nImage : sas-habillage.jpg\nA. Les surchaussures (V)\nB. La charlotte (F)\n\nSCHÉMA 1. Légendez ce schéma.\nImage : isolateur.png\n1. sas de transfert (32, 24, 14, 5)\n2. filtre HEPA | filtre terminal (58, 19)"}
        />
      </label>
      <div className="rangee">
        <label className="champ">
          <span>ou fichier (.txt, .md, .docx, .json)</span>
          <input type="file" name="fichier" accept=".txt,.md,.docx,.json,text/plain,text/markdown,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        </label>
        <label className="champ">
          <span>Images des schémas et illustrations (PNG ou JPEG)</span>
          <input type="file" name="images" accept="image/png,image/jpeg" multiple />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="bouton" disabled={enAnalyse}>
          {enAnalyse ? "Analyse…" : "Analyser"}
        </button>
      </div>
    </form>
  );
}
