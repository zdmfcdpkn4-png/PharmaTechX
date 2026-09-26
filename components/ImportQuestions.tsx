"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ETAT_IMPORT_INITIAL, type EtatImport, type QuestionImporteeAvecImage } from "@/app/admin/questions/import-etat";
import type { ModuleChoix } from "./EditeurQuestion";
import { LIBELLES_NIVEAU_QUESTION, type LibellesNiveaux } from "@/content/niveaux-questions";
import { bilanPreparation } from "@/content/preparation-image";
import { alertesFormat, indiceFormat } from "@/lib/import-format";
import { preparerChamp } from "./preparerImage";

type ActionImport = (prec: EtatImport, fd: FormData) => Promise<EtatImport>;

/** Libellé d'un module dans une liste, comme dans le reste de la banque. */
function libelleModule(m: ModuleChoix): string {
  return `${m.critereId} — ${m.titre.slice(0, 70)}${m.redige ? "" : " (à rédiger)"}`;
}

/** D'où vient le format d'un QCM ou d'une QIM (question 58, choix a). */
function origineDuFormat(q: QuestionImporteeAvecImage): string {
  switch (q.origineFormat) {
    case "mot-cle":
      return "format du mot-clé";
    case "intertitre":
      return "format de l'intertitre";
    case "enonce": {
      const i = indiceFormat(q.enonce);
      return i.motif === "?" ? "format d'après l'énoncé : une question posée" : `format d'après l'énoncé : « ${i.motif} »`;
    }
    case "defaut":
      return "format par défaut du dépôt";
    default:
      return "";
  }
}

function libelleFormat(format: string): string {
  return format === "SCH" ? "Schéma" : format === "ORD" ? "Séquence" : format === "TAT" ? "Texte à trous" : format;
}

/**
 * Dépôt de questions en deux temps — repris du Lecteur QIM · QCM : le texte
 * (collé ou déposé en .txt, .md, .docx, .json) est analysé, l'aperçu montre
 * chaque question reconnue avec ses avertissements, puis l'ajout crée les
 * questions au statut « à vérifier ». Les images se déposent avec le texte :
 * celle d'un schéma s'apparie par nom, sinon par rang ; l'illustration de
 * toute autre question, par son nom seulement. Elles sont préparées sur
 * l'appareil dès leur choix (`preparerImage`) : une photo de téléphone part
 * réduite, sans ses métadonnées.
 *
 * Un dépôt sert plusieurs modules (questions 57 et 58, choix a) : l'aperçu
 * montre le module et le format de chaque question, d'où ils viennent, et
 * les laisse changer ; l'ajout est refusé tant qu'une question retenue n'a
 * pas de module.
 */
export function ImportQuestions({
  modules,
  moduleInitial,
  analyser,
  confirmer,
  libellesNiveaux = LIBELLES_NIVEAU_QUESTION,
}: {
  modules: ModuleChoix[];
  moduleInitial?: string;
  analyser: ActionImport;
  confirmer: ActionImport;
  /** Noms des niveaux de question en vigueur (question 81), pour l'aperçu. */
  libellesNiveaux?: LibellesNiveaux;
}) {
  const [analyse, actionAnalyse, enAnalyse] = useActionState(analyser, ETAT_IMPORT_INITIAL);
  const [confirmation, actionConfirme, enConfirmation] = useActionState(confirmer, ETAT_IMPORT_INITIAL);
  const [preparation, setPreparation] = useState<{ enCours: boolean; bilan: string }>({ enCours: false, bilan: "" });

  const preparerImages = async (input: HTMLInputElement) => {
    setPreparation({ enCours: true, bilan: "Préparation des images…" });
    const faites = await preparerChamp(input);
    setPreparation({ enCours: false, bilan: bilanPreparation(faites) });
  };

  if (confirmation.etape === "fait") {
    const parModule = confirmation.ajouteesParModule ?? [];
    const lien = (id: string) => `/admin/questions?vue=liste&module=${encodeURIComponent(id)}&statut=a_verifier`;
    return (
      <section className="carte">
        <p className="encart encart--ok">
          <strong>{confirmation.ajoutees} question{(confirmation.ajoutees ?? 0) > 1 ? "s" : ""} ajoutée{(confirmation.ajoutees ?? 0) > 1 ? "s" : ""}</strong>{" "}
          au statut « à vérifier »{parModule.length > 1 ? `, dans ${parModule.length} modules` : ""}. Elles n&apos;entrent dans les
          tirages qu&apos;une fois validées.
        </p>
        {parModule.length > 1 && (
          <ul className="liste-nue depot-modules">
            {parModule.map(({ id, n }) => {
              const m = modules.find((x) => x.id === id);
              return (
                <li key={id}>
                  <Link href={lien(id)}>{m ? libelleModule(m) : id}</Link> — {n} question{n > 1 ? "s" : ""}
                </li>
              );
            })}
          </ul>
        )}
        <div className="actions">
          <Link href={parModule.length === 1 ? lien(parModule[0].id) : "/admin/questions?vue=liste&statut=a_verifier"} className="bouton">
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
    return (
      <ApercuImport
        analyse={analyse}
        modules={modules}
        erreur={confirmation.erreur}
        confirmer={actionConfirme}
        enConfirmation={enConfirmation}
        libellesNiveaux={libellesNiveaux}
      />
    );
  }

  return (
    <form action={actionAnalyse} className="carte">
      {analyse.erreur && (
        <p className="encart encart--attention" role="alert">{analyse.erreur}</p>
      )}
      <div className="rangee">
        <label className="champ">
          <span>Module des questions sans ligne « Module : »</span>
          <select name="moduleId" defaultValue={analyse.moduleId || moduleInitial || ""}>
            <option value="">— proposer d&apos;après les mots —</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {libelleModule(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Format quand ni mot-clé, ni intertitre, ni énoncé ne le disent</span>
          <select name="formatDefaut" defaultValue={analyse.formatDefaut}>
            <option value="QCM">QCM</option>
            <option value="QIM">QIM</option>
          </select>
        </label>
      </div>
      <p className="legende">
        Une ligne « Module : B1-05 » dans le texte vaut pour les questions qui la suivent ; sans elle,
        le module choisi ici ; sans choix ici, le site propose le module qui partage le plus de mots
        avec la question. Le module et le format de chaque question se vérifient, et se changent,
        dans l&apos;aperçu.
      </p>
      <label className="champ">
        <span>Texte à analyser</span>
        <textarea
          name="texte"
          rows={14}
          placeholder={"Module : B1-02\n\nQCM 1. Énoncé de la question\nA. Proposition (V)\nB. Proposition (F)\nC. Proposition (F)\nD. Proposition (F)\nRéponses : A\nJustification : …\nSource : ANSM — BPP 2023 — 21/07/2023 — https://…\nÉliminatoire : oui\n\nQCM 2. Sur cette photographie, quel équipement manque-t-il ?\nImage : sas-habillage.jpg\nA. Les surchaussures (V)\nB. La charlotte (F)\n\nSCHÉMA 1. Légendez ce schéma.\nImage : isolateur.png\n1. sas de transfert (32, 24, 14, 5)\n2. filtre HEPA | filtre terminal (58, 19)"}
        />
      </label>
      <div className="rangee">
        <label className="champ">
          <span>ou fichier (.txt, .md, .docx, .json)</span>
          <input type="file" name="fichier" accept=".txt,.md,.docx,.json,text/plain,text/markdown,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        </label>
        <label className="champ">
          <span>Images des schémas et illustrations (PNG ou JPEG)</span>
          <input
            type="file"
            name="images"
            accept="image/png,image/jpeg"
            multiple
            onChange={(e) => void preparerImages(e.currentTarget)}
          />
        </label>
      </div>
      <p className="legende" role="status" aria-live="polite" data-preparation={preparation.enCours ? "en-cours" : "prete"}>
        {preparation.bilan}
      </p>
      <p className="legende">
        Photographies : aucune donnée de patient (étiquette nominative, ordonnance, écran de logiciel),
        aucune personne reconnaissable sans son accord. Une photo est réduite à 2 000 px et débarrassée
        de ses métadonnées (lieu, appareil, date) avant l&apos;envoi.
      </p>
      <div className="actions">
        <button type="submit" className="bouton" disabled={enAnalyse || preparation.enCours}>
          {enAnalyse ? "Analyse…" : "Analyser"}
        </button>
      </div>
    </form>
  );
}

/**
 * Aperçu d'un dépôt : chaque question, son module et son format, avec ce qui
 * les a décidés. Les choix faits ici partent avec le formulaire
 * (`module-i`, `format-i`) ; les avertissements qui tiennent au format sont
 * recalculés à chaque changement.
 *
 * Le formulaire s'envoie par `onSubmit`, pas par `action` : React
 * réinitialise un formulaire à action après chaque envoi, et un refus du
 * serveur aurait remis les listes de l'écran à « à choisir » quand l'état
 * garde les choix faits.
 */
function ApercuImport({
  analyse,
  modules,
  erreur,
  confirmer,
  enConfirmation,
  libellesNiveaux,
}: {
  analyse: EtatImport;
  modules: ModuleChoix[];
  erreur?: string;
  confirmer: (fd: FormData) => void;
  enConfirmation: boolean;
  libellesNiveaux: LibellesNiveaux;
}) {
  const questions = analyse.questions;
  const [choix, setChoix] = useState<string[]>(() => questions.map((q) => q.moduleId ?? ""));
  const [formats, setFormats] = useState<string[]>(() => questions.map((q) => q.format));
  const [exclues, setExclues] = useState<boolean[]>(() => questions.map(() => false));
  const [pourTous, setPourTous] = useState("");
  const options = useMemo(
    () =>
      modules.map((m) => (
        <option key={m.id} value={m.id}>
          {libelleModule(m)}
        </option>
      )),
    [modules],
  );
  // Nom court dans la répartition : le code du critère ; un module déposé, qui
  // n'en a pas toujours, se nomme par son titre.
  const courts = useMemo(
    () => new Map(modules.map((m) => [m.id, m.origine === "base" ? m.titre.slice(0, 40) : m.critereId])),
    [modules],
  );

  const changer = <T,>(set: Dispatch<SetStateAction<T[]>>, i: number, v: T) =>
    set((prec) => prec.map((x, k) => (k === i ? v : x)));

  const alertes = questions.map((q, i) => [...q.avertissements, ...alertesFormat({ ...q, format: formats[i] })]);
  const nbAvert = alertes.filter((a) => a.length > 0).length;
  const retenues = questions.map((_, i) => i).filter((i) => !exclues[i]);
  const sansModule = retenues.filter((i) => !choix[i]).length;
  const repartition = new Map<string, number>();
  for (const i of retenues) if (choix[i]) repartition.set(choix[i], (repartition.get(choix[i]) ?? 0) + 1);

  return (
    <form
      className="carte"
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => confirmer(donnees));
      }}
    >
      <input type="hidden" name="nom" value={analyse.nom} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      <h2>Aperçu — {questions.length} question{questions.length > 1 ? "s" : ""} reconnue{questions.length > 1 ? "s" : ""}</h2>
      <p className="legende">
        Dépôt « {analyse.nom} ».{" "}
        {nbAvert > 0 ? `${nbAvert} question${nbAvert > 1 ? "s" : ""} porte${nbAvert > 1 ? "nt" : ""} un avertissement.` : "Aucun avertissement."}{" "}
        Décochez ce qu&apos;il ne faut pas ajouter ; le module et le format de chaque question se changent ici.
      </p>
      <p className="legende depot-repartition">
        Modules :{" "}
        {[...repartition].map(([id, n]) => `${courts.get(id) ?? id} (${n})`).join(" · ") || "aucun"}
        {sansModule > 0 ? ` · à choisir (${sansModule})` : ""}
      </p>
      {sansModule > 0 && (
        <div className="rangee apercu-pour-tous">
          <label className="champ">
            <span>Module des questions à choisir</span>
            <select value={pourTous} onChange={(e) => setPourTous(e.target.value)}>
              <option value="">— choisir —</option>
              {options}
            </select>
          </label>
          <div className="actions">
            <button
              type="button"
              className="bouton bouton--secondaire"
              disabled={!pourTous}
              onClick={() => setChoix((prec) => prec.map((v) => v || pourTous))}
            >
              Appliquer aux questions à choisir
            </button>
          </div>
        </div>
      )}
      {analyse.avertissements.length > 0 && (
        <ul className="encart encart--attention" style={{ margin: "0 0 1rem", paddingLeft: "2rem" }}>
          {analyse.avertissements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {erreur && (
        <p className="encart encart--attention" role="alert">{erreur}</p>
      )}
      <ol className="apercu-import">
        {questions.map((q, i) => {
          const qcmOuQim = q.format === "QCM" || q.format === "QIM";
          return (
            <li key={i} className="apercu-question">
              <div className="etape-tete">
                <label className="option option--compact">
                  <input
                    type="checkbox"
                    name={`exclure-${i}`}
                    checked={exclues[i]}
                    onChange={(e) => changer(setExclues, i, e.target.checked)}
                  />
                  <span>Exclure</span>
                </label>
                <span className="etiquette etiquette--site">{libelleFormat(formats[i])}</span>
                {q.niveauQuestion ? (
                  <span className="etiquette etiquette--neutre">{libellesNiveaux[q.niveauQuestion]}</span>
                ) : (
                  <span className="etiquette etiquette--attention">Niveau à préciser</span>
                )}
                {!choix[i] && <span className="etiquette etiquette--attention">Module à choisir</span>}
                {q.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
                {!q.corrigeDetecte && <span className="etiquette etiquette--attention">Sans corrigé</span>}
                {(q.format === "SCH" || q.imageNom) && (
                  <span className={`etiquette ${q.imageId ? "etiquette--neutre" : "etiquette--attention"}`}>
                    {q.imageId ? "Image appariée" : "Image à choisir"}
                  </span>
                )}
              </div>
              <div className="rangee apercu-rattachement">
                <label className="champ">
                  <span>Module</span>
                  <select
                    name={`module-${i}`}
                    aria-label={`Module de la question ${i + 1}`}
                    value={choix[i]}
                    onChange={(e) => changer(setChoix, i, e.target.value)}
                  >
                    <option value="">— à choisir —</option>
                    {options}
                  </select>
                </label>
                {qcmOuQim && (
                  <label className="champ champ--format">
                    <span>Format</span>
                    <select
                      name={`format-${i}`}
                      aria-label={`Format de la question ${i + 1}`}
                      value={formats[i]}
                      onChange={(e) => changer(setFormats, i, e.target.value)}
                    >
                      <option value="QCM">QCM</option>
                      <option value="QIM">QIM</option>
                    </select>
                  </label>
                )}
              </div>
              <p className="legende apercu-origine">
                {choix[i] === (q.moduleId ?? "") ? q.detailModule : "module choisi dans l'aperçu"}
                {qcmOuQim && ` · ${formats[i] === q.format ? origineDuFormat(q) : "format changé dans l'aperçu"}`}
              </p>
              <p className="question-enonce" style={{ fontSize: "1rem" }}>{q.enonce}</p>
              {q.imageAlt && (
                <p className="legende">Description de l&apos;image : {q.imageAlt}</p>
              )}
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
              {alertes[i].length > 0 && (
                <p className="legende apercu-alertes" style={{ color: "var(--alerte)" }}>{alertes[i].join(" ")}</p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="actions">
        <button type="submit" className="bouton" disabled={enConfirmation || sansModule > 0 || retenues.length === 0}>
          {enConfirmation ? "Ajout…" : "Ajouter à la banque, à vérifier"}
        </button>
        <Link href="/admin/questions/import" className="bouton bouton--secondaire">
          Recommencer
        </Link>
      </div>
      {/* Région annoncée : toujours présente, pour qu'un lecteur d'écran dise son changement. */}
      <p className="legende" role="status">
        {sansModule > 0
          ? `${sansModule} question${sansModule > 1 ? "s" : ""} sans module : choisissez-le, ou excluez-la${sansModule > 1 ? "s" : ""}.`
          : ""}
      </p>
    </form>
  );
}
