"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { bilanPreparation } from "@/content/preparation-image";
import { preparerChamp } from "./preparerImage";
import type { EtatFormulaireQuestion } from "@/app/admin/questions/import-etat";
import type { Legende } from "@/content/schema";
import {
  DEFINITIONS_NIVEAU_QUESTION,
  LIBELLES_NIVEAU_QUESTION,
  NIVEAUX_QUESTION,
  trousDuTexte,
  type ModeReponse,
  type NiveauQuestion,
  type TypeQuestion,
} from "@/content/types";
import { EditeurSchema } from "./EditeurSchema";

/**
 * Formulaire de création ou de modification d'une question — profils
 * tutorat et administration. Les propositions et les légendes sont tenues
 * dans l'état du composant et envoyées en JSON dans des champs cachés ; le
 * reste est un formulaire ordinaire, soumis à l'action serveur.
 */

export interface ModuleChoix {
  id: string;
  titre: string;
  critereId: string;
  redige: boolean;
  /** `base` pour un module déposé depuis l'administration. */
  origine?: "code" | "base";
}

export interface SituationChoix {
  id: string;
  titre: string;
  moduleId: string;
}

export interface OptionForm {
  id: string;
  texte: string;
  vrai: boolean;
}

export interface QuestionInitiale {
  id?: string;
  moduleId: string;
  situationId: string | null;
  format: TypeQuestion;
  enonce: string;
  options: OptionForm[];
  legendes: Legende[];
  modeReponse: ModeReponse;
  imageUrl: string | null;
  imageLargeur: number;
  imageHauteur: number;
  imageAlt: string;
  justification: string;
  eliminatoire: boolean;
  reservee: boolean;
  /** Posée à chaque évaluation qui peut conclure (question 63). */
  obligatoire: boolean;
  /** Initial, intermédiaire, avancé ; `null` = à préciser. */
  niveauQuestion: NiveauQuestion | null;
  /** Une référence par ligne : « Source — Libellé — Date — URL ». */
  references: string;
  statut: "a_verifier" | "valide" | "retire";
}

const LETTRES = "abcdefghijkl";

function optionsVides(n: number): OptionForm[] {
  return Array.from({ length: n }, (_, i) => ({ id: LETTRES[i], texte: "", vrai: false }));
}

/** Étapes d'une séquence : toutes comptent, c'est leur ordre qui est jugé. */
function etapesVides(n: number): OptionForm[] {
  return Array.from({ length: n }, (_, i) => ({ id: LETTRES[i], texte: "", vrai: true }));
}

/** QCM et QIM partagent la forme « propositions » ; les autres formats non. */
function memeForme(a: TypeQuestion, b: TypeQuestion): boolean {
  const proposition = (f: TypeQuestion) => f === "QCM" || f === "QIM";
  return proposition(a) && proposition(b);
}

/** Premier identifiant libre : les listes d'un QCM restent en a, b, c… */
function idLibre(existants: OptionForm[]): string {
  const pris = new Set(existants.map((o) => o.id));
  for (const l of LETTRES) if (!pris.has(l)) return l;
  return `o${existants.length + 1}`;
}

/** Nombre d'éléments qu'un format accepte : cinq propositions, douze étapes. */
const MAX_ELEMENTS: Record<string, number> = { QCM: 5, QIM: 5, ORD: 12, TAT: 12 };

export function EditeurQuestion({
  modules,
  situations,
  initiale,
  moduleInitial,
  action,
}: {
  modules: ModuleChoix[];
  situations: SituationChoix[];
  initiale?: QuestionInitiale;
  moduleInitial?: string;
  action: (prec: EtatFormulaireQuestion, fd: FormData) => Promise<EtatFormulaireQuestion>;
}) {
  const [etat, formAction, enCours] = useActionState(action, {} as EtatFormulaireQuestion);
  const [moduleId, setModuleId] = useState(initiale?.moduleId ?? moduleInitial ?? modules[0]?.id ?? "");
  const [format, setFormat] = useState<TypeQuestion>(initiale?.format ?? "QCM");
  const [options, setOptions] = useState<OptionForm[]>(
    initiale?.options.length ? initiale.options : optionsVides(4),
  );
  const [enonce, setEnonce] = useState(initiale?.enonce ?? "");
  const [legendes, setLegendes] = useState<Legende[]>(initiale?.legendes ?? []);
  const [image, setImage] = useState<{ url: string; w: number; h: number } | null>(
    initiale?.imageUrl ? { url: initiale.imageUrl, w: initiale.imageLargeur, h: initiale.imageHauteur } : null,
  );

  const situationsDuModule = useMemo(
    () => situations.filter((s) => s.moduleId === moduleId),
    [situations, moduleId],
  );

  const majOption = (i: number, patch: Partial<OptionForm>) =>
    setOptions((prec) => prec.map((o, k) => (k === i ? { ...o, ...patch } : o)));

  // Séquence à ordonner : la liste est l'ordre juste ; l'apprenant la reçoit
  // mélangée. Les flèches suffisent — pas de glisser-déposer, inutilisable
  // avec des gants et inaccessible au clavier.
  const deplacer = (i: number, pas: number) =>
    setOptions((prec) => {
      const j = i + pas;
      if (j < 0 || j >= prec.length) return prec;
      const suite = [...prec];
      [suite[i], suite[j]] = [suite[j], suite[i]];
      return suite;
    });

  // Texte à trous : les vignettes attendues d'abord, dans l'ordre des trous,
  // puis les leurres. C'est cet ordre que le serveur relit.
  const trous = useMemo(() => trousDuTexte(enonce), [enonce]);
  const attendues = options.filter((o) => o.vrai);
  const leurres = options.filter((o) => !o.vrai);
  const recomposer = (att: OptionForm[], leu: OptionForm[]) => setOptions([...att, ...leu]);

  useEffect(() => {
    if (format !== "TAT") return;
    setOptions((prec) => {
      const att = prec.filter((o) => o.vrai);
      const leu = prec.filter((o) => !o.vrai);
      if (att.length === trous.length) return prec;
      const suite = att.slice(0, trous.length);
      while (suite.length < trous.length) {
        suite.push({ id: idLibre([...suite, ...leu]), texte: "", vrai: true });
      }
      return [...suite, ...leu];
    });
  }, [format, trous.length]);

  const choisirImage = (fichier: File | null) => {
    if (!fichier) return;
    const url = URL.createObjectURL(fichier);
    const im = new Image();
    im.onload = () => setImage({ url, w: im.naturalWidth, h: im.naturalHeight });
    im.src = url;
  };

  // Préparée sur l'appareil dès le choix : une photo part réduite, sans ses
  // métadonnées (`preparerImage`, repris du quiz de Flore).
  const [preparationImage, setPreparationImage] = useState<{ enCours: boolean; bilan: string }>({ enCours: false, bilan: "" });
  const preparerEtChoisir = async (input: HTMLInputElement) => {
    setPreparationImage({ enCours: true, bilan: "Préparation de l'image…" });
    const [faite] = await preparerChamp(input);
    setPreparationImage({ enCours: false, bilan: faite ? bilanPreparation([faite]) : "" });
    choisirImage(faite?.fichier ?? null);
  };

  return (
    <form action={formAction} className="carte formulaire-question">
      {initiale?.id && <input type="hidden" name="id" value={initiale.id} />}
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="legendes" value={JSON.stringify(legendes)} />

      {etat.erreur && (
        <p className="encart encart--attention" role="alert">
          {etat.erreur}
        </p>
      )}

      <div className="rangee">
        <label className="champ">
          <span>Module (critère de la fiche)</span>
          <select name="moduleId" value={moduleId} onChange={(e) => setModuleId(e.target.value)} required>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.critereId} — {m.titre.slice(0, 70)}{m.redige ? "" : " (à rédiger)"}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Format</span>
          <select
            name="format"
            value={format}
            onChange={(e) => {
              // Changer de format vide la liste : des propositions ne sont pas
              // des étapes, et des étapes ne sont pas des leurres. Le passage
              // QCM ↔ QIM, lui, garde les propositions.
              const suivant = e.target.value as TypeQuestion;
              if (!memeForme(format, suivant)) {
                setOptions(suivant === "ORD" ? etapesVides(3) : suivant === "TAT" ? [] : optionsVides(4));
              }
              setFormat(suivant);
            }}
          >
            <option value="QCM">QCM — tout ou rien</option>
            <option value="QIM">QIM — barème à la discordance</option>
            <option value="SCH">Schéma à compléter</option>
            <option value="ORD">Séquence à ordonner</option>
            <option value="TAT">Texte à trous</option>
          </select>
        </label>
      </div>

      <label className="champ">
        <span>
          Énoncé
          {format === "QCM" ? " (écrire « plusieurs réponses » s'il y en a plusieurs)" : ""}
          {format === "TAT" ? " — marquez chaque trou par {1}, {2}…" : ""}
        </span>
        <textarea
          name="enonce"
          rows={format === "TAT" ? 5 : 3}
          required
          maxLength={2000}
          value={enonce}
          onChange={(e) => setEnonce(e.target.value)}
        />
      </label>

      {/* Image : obligatoire pour un schéma, facultative en illustration de
          tout autre format (décisions du 19/09 et du 23/09/2026). */}
      <fieldset className="groupe">
        <legend className="champ-titre">
          {format === "SCH" ? "Image du schéma" : "Illustration (facultative)"}
        </legend>
        <div className="rangee">
          <label className="champ">
            <span>Image (PNG ou JPEG, 2 Mo au plus){image ? " — laisser vide pour conserver l'actuelle" : ""}</span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg"
              onChange={(e) => void preparerEtChoisir(e.currentTarget)}
            />
          </label>
          <label className="champ">
            <span>
              Description de l&apos;image (lue à la place de l&apos;image)
              {format === "SCH" ? "" : " — sans donner la réponse"}
            </span>
            <input type="text" name="imageAlt" maxLength={300} defaultValue={initiale?.imageAlt ?? ""} />
          </label>
        </div>
        <p className="legende" role="status" aria-live="polite">
          {preparationImage.bilan}
        </p>
        <p className="legende">
          Photographie : aucune donnée de patient (étiquette nominative, ordonnance, écran de logiciel),
          aucune personne reconnaissable sans son accord.
        </p>
        {format !== "SCH" && image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="apercu-illustration" />
            <label className="option option--compact">
              <input type="checkbox" name="retirerImage" />
              <span>Retirer l&apos;illustration</span>
            </label>
          </>
        )}
      </fieldset>

      {format === "ORD" ? (
        <fieldset className="groupe">
          <legend className="champ-titre">Étapes, dans l&apos;ordre juste</legend>
          <p className="legende">
            L&apos;apprenant les reçoit mélangées et donne un rang à chacune. Les flèches
            corrigent l&apos;ordre ici.
          </p>
          {options.map((o, i) => (
            <div key={o.id} className="proposition proposition--editeur">
              <span className="num" aria-hidden="true">{i + 1}</span>
              <label className="champ" style={{ flex: "1 1 18rem", margin: 0 }}>
                <span className="visually-hidden">Étape {i + 1}</span>
                <input
                  type="text"
                  value={o.texte}
                  maxLength={300}
                  onChange={(e) => majOption(i, { texte: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="bouton bouton--compact bouton--discret"
                disabled={i === 0}
                aria-label={`Monter l'étape ${i + 1}`}
                onClick={() => deplacer(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="bouton bouton--compact bouton--discret"
                disabled={i === options.length - 1}
                aria-label={`Descendre l'étape ${i + 1}`}
                onClick={() => deplacer(i, 1)}
              >
                ↓
              </button>
              {options.length > 2 && (
                <button
                  type="button"
                  className="bouton bouton--compact bouton--discret"
                  aria-label={`Retirer l'étape ${i + 1}`}
                  onClick={() => setOptions((prec) => prec.filter((_, k) => k !== i))}
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_ELEMENTS.ORD && (
            <button
              type="button"
              className="bouton bouton--compact bouton--secondaire"
              onClick={() => setOptions((prec) => [...prec, { id: idLibre(prec), texte: "", vrai: true }])}
            >
              Ajouter une étape
            </button>
          )}
        </fieldset>
      ) : format === "TAT" ? (
        <fieldset className="groupe">
          <legend className="champ-titre">Trous et vignettes</legend>
          {trous.length === 0 ? (
            <p className="encart encart--attention">
              Aucun trou dans l&apos;énoncé : écrivez {"{1}"}, {"{2}"}… là où l&apos;apprenant
              devra placer une vignette.
            </p>
          ) : (
            <p className="legende">
              Une vignette attendue par trou. Les leurres sont proposés dans le même menu
              déroulant, à tous les trous.
            </p>
          )}
          {trous.map((n, i) => (
            <div key={`t${n}`} className="proposition proposition--editeur">
              <span className="num" aria-hidden="true">{n}</span>
              <label className="champ" style={{ flex: "1 1 18rem", margin: 0 }}>
                <span className="visually-hidden">Vignette attendue au trou {n}</span>
                <input
                  type="text"
                  value={attendues[i]?.texte ?? ""}
                  maxLength={120}
                  placeholder={`Vignette attendue au trou ${n}`}
                  onChange={(e) =>
                    recomposer(
                      attendues.map((o, k) => (k === i ? { ...o, texte: e.target.value } : o)),
                      leurres,
                    )
                  }
                />
              </label>
            </div>
          ))}
          <p className="champ-titre" style={{ marginTop: ".5rem" }}>Leurres</p>
          {leurres.map((o, i) => (
            <div key={o.id} className="proposition proposition--editeur">
              <span className="num" aria-hidden="true">·</span>
              <label className="champ" style={{ flex: "1 1 18rem", margin: 0 }}>
                <span className="visually-hidden">Leurre {i + 1}</span>
                <input
                  type="text"
                  value={o.texte}
                  maxLength={120}
                  onChange={(e) =>
                    recomposer(attendues, leurres.map((l, k) => (k === i ? { ...l, texte: e.target.value } : l)))
                  }
                />
              </label>
              <button
                type="button"
                className="bouton bouton--compact bouton--discret"
                aria-label={`Retirer le leurre ${i + 1}`}
                onClick={() => recomposer(attendues, leurres.filter((_, k) => k !== i))}
              >
                Retirer
              </button>
            </div>
          ))}
          {options.length < MAX_ELEMENTS.TAT && (
            <button
              type="button"
              className="bouton bouton--compact bouton--secondaire"
              onClick={() => recomposer(attendues, [...leurres, { id: idLibre(options), texte: "", vrai: false }])}
            >
              Ajouter un leurre
            </button>
          )}
        </fieldset>
      ) : format === "SCH" ? (
        <fieldset className="groupe">
          <legend className="champ-titre">Schéma</legend>
          <label className="champ">
            <span>Réponse de l&apos;apprenant</span>
            <select name="modeReponse" defaultValue={initiale?.modeReponse ?? "ecrire"}>
              <option value="ecrire">Écrire chaque légende</option>
              <option value="choisir">Choisir chaque légende dans la liste mélangée</option>
              <option value="decouvrir">Découvrir chaque cache, jugé par le tuteur (façon Anki)</option>
            </select>
          </label>
          <p className="legende" style={{ margin: 0 }}>
            « Découvrir » : l&apos;apprenant dit ce que cache chaque numéro, lève le cache, et la réponse
            est jugée juste ou fausse — par le tuteur présent en évaluation, qui confirme par son propre
            code ; par l&apos;apprenant lui-même en entraînement. Le mot écrit sous chaque cache sert de
            référence au jugement et au rapport.
          </p>
          <EditeurSchema
            imageUrl={image?.url ?? null}
            largeur={image?.w ?? 0}
            hauteur={image?.h ?? 0}
            legendes={legendes}
            onChange={setLegendes}
          />
        </fieldset>
      ) : (
        <fieldset className="groupe">
          <legend className="champ-titre">
            Propositions — cocher {format === "QIM" ? "celles qui sont vraies" : "la ou les réponses exactes"}
          </legend>
          {options.map((o, i) => (
            <div key={o.id} className="proposition proposition--editeur">
              <span className="num" aria-hidden="true">{o.id.toUpperCase()}</span>
              <label className="champ" style={{ flex: "1 1 18rem", margin: 0 }}>
                <span className="visually-hidden">Proposition {o.id.toUpperCase()}</span>
                <input
                  type="text"
                  value={o.texte}
                  maxLength={500}
                  onChange={(e) => majOption(i, { texte: e.target.value })}
                />
              </label>
              <label className="option option--compact">
                <input type="checkbox" checked={o.vrai} onChange={(e) => majOption(i, { vrai: e.target.checked })} />
                <span>{format === "QIM" ? "Vraie" : "Exacte"}</span>
              </label>
              {options.length > 2 && (
                <button
                  type="button"
                  className="bouton bouton--compact bouton--discret"
                  onClick={() =>
                    setOptions((prec) => prec.filter((_, k) => k !== i).map((x, k) => ({ ...x, id: LETTRES[k] })))
                  }
                  aria-label={`Retirer la proposition ${o.id.toUpperCase()}`}
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
          {options.length < 5 && (
            <button
              type="button"
              className="bouton bouton--compact bouton--secondaire"
              onClick={() => setOptions((prec) => [...prec, { id: LETTRES[prec.length], texte: "", vrai: false }])}
            >
              Ajouter une proposition
            </button>
          )}
        </fieldset>
      )}

      <label className="champ">
        <span>Justification affichée après correction</span>
        <textarea name="justification" rows={4} maxLength={3000} defaultValue={initiale?.justification ?? ""} />
      </label>

      <label className="champ">
        <span>Références — une par ligne : Source — Libellé — Date — URL</span>
        <textarea
          name="references"
          rows={3}
          maxLength={3000}
          placeholder="ANSM — Bonnes pratiques de préparation 2023 — 21/07/2023 — https://ansm.sante.fr/…"
          defaultValue={initiale?.references ?? ""}
        />
      </label>

      <div className="rangee">
        <label className="champ">
          <span>Mise en situation de rattachement</span>
          <select name="situationId" defaultValue={initiale?.situationId ?? ""}>
            <option value="">Question isolée</option>
            {situationsDuModule.map((s) => (
              <option key={s.id} value={s.id}>{s.titre}</option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Statut</span>
          <select name="statut" defaultValue={initiale?.statut === "retire" ? "retire" : "a_verifier"}>
            <option value="a_verifier">À vérifier — hors tirage</option>
            <option value="retire">Retirée</option>
          </select>
        </label>
      </div>
      <p className="legende">
        {initiale?.statut === "valide"
          ? "Cette question est validée : enregistrer une modification la remet « à vérifier », et un autre code que le vôtre la validera — ou vous-même si votre code est d'administration, validation alors tracée (règle des quatre yeux)."
          : "Une question créée ou modifiée part « à vérifier » : un autre code que son auteur la valide depuis la banque — ou son auteur s'il est d'administration, validation alors tracée (règle des quatre yeux)."}
      </p>

      <label className="champ" style={{ maxWidth: "26rem" }}>
        <span>Niveau de la question</span>
        <select name="niveauQuestion" defaultValue={initiale?.niveauQuestion ?? ""}>
          <option value="">À préciser</option>
          {NIVEAUX_QUESTION.map((n) => (
            <option key={n} value={n}>
              {LIBELLES_NIVEAU_QUESTION[n]} — {DEFINITIONS_NIVEAU_QUESTION[n]}
            </option>
          ))}
        </select>
      </label>

      <label className="option option--compact" style={{ display: "inline-flex" }}>
        <input type="checkbox" name="eliminatoire" defaultChecked={initiale?.eliminatoire ?? false} />
        <span>Question éliminatoire — une erreur rend le critère non acquis</span>
      </label>
      <label className="option option--compact" style={{ display: "inline-flex" }}>
        <input type="checkbox" name="reservee" defaultChecked={initiale?.reservee ?? false} />
        <span>
          Réservée à l&apos;évaluation — jamais posée en entraînement ni en Découverte, tirée en priorité en
          Habilitation et Complet
        </span>
      </label>
      <label className="option option--compact" style={{ display: "inline-flex" }}>
        <input type="checkbox" name="obligatoire" defaultChecked={initiale?.obligatoire ?? false} />
        <span>
          Obligatoire — posée à chaque évaluation Habilitation et Complet, sous le niveau cible, sans effet sur la
          note ; comptée dans sa part de niveau
        </span>
      </label>

      <div className="actions">
        <button type="submit" className="bouton" disabled={enCours || preparationImage.enCours}>
          {enCours ? "Enregistrement…" : initiale?.id ? "Enregistrer les modifications" : "Créer la question"}
        </button>
        <Link href={`/admin/questions?module=${encodeURIComponent(moduleId)}`} className="bouton bouton--secondaire">
          Annuler
        </Link>
      </div>
    </form>
  );
}
