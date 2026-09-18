"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { EtatFormulaireQuestion } from "@/app/admin/questions/import-etat";
import type { Legende } from "@/content/schema";
import type { ModeReponse, TypeQuestion } from "@/content/types";
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
  /** Une référence par ligne : « Source — Libellé — Date — URL ». */
  references: string;
  statut: "a_verifier" | "valide" | "retire";
}

const LETTRES = "abcde";

function optionsVides(n: number): OptionForm[] {
  return Array.from({ length: n }, (_, i) => ({ id: LETTRES[i], texte: "", vrai: false }));
}

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

  const choisirImage = (fichier: File | null) => {
    if (!fichier) return;
    const url = URL.createObjectURL(fichier);
    const im = new Image();
    im.onload = () => setImage({ url, w: im.naturalWidth, h: im.naturalHeight });
    im.src = url;
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
          <select name="format" value={format} onChange={(e) => setFormat(e.target.value as TypeQuestion)}>
            <option value="QCM">QCM — tout ou rien</option>
            <option value="QIM">QIM — barème à la discordance</option>
            <option value="SCH">Schéma à compléter</option>
          </select>
        </label>
      </div>

      <label className="champ">
        <span>Énoncé{format === "QCM" ? " (écrire « plusieurs réponses » s'il y en a plusieurs)" : ""}</span>
        <textarea name="enonce" rows={3} required maxLength={2000} defaultValue={initiale?.enonce ?? ""} />
      </label>

      {format === "SCH" ? (
        <fieldset className="groupe">
          <legend className="champ-titre">Schéma</legend>
          <div className="rangee">
            <label className="champ">
              <span>Image (PNG ou JPEG, 2 Mo au plus){image ? " — laisser vide pour conserver l'actuelle" : ""}</span>
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg"
                onChange={(e) => choisirImage(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="champ">
              <span>Description de l&apos;image (lue à la place de l&apos;image)</span>
              <input type="text" name="imageAlt" maxLength={300} defaultValue={initiale?.imageAlt ?? ""} />
            </label>
          </div>
          <label className="champ">
            <span>Réponse de l&apos;apprenant</span>
            <select name="modeReponse" defaultValue={initiale?.modeReponse ?? "ecrire"}>
              <option value="ecrire">Écrire chaque légende</option>
              <option value="choisir">Choisir chaque légende dans la liste mélangée</option>
            </select>
          </label>
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
          ? "Cette question est validée : enregistrer une modification la remet « à vérifier », et un autre code que le vôtre la validera (règle des quatre yeux)."
          : "Une question créée ou modifiée part « à vérifier » : un autre code que son auteur la valide depuis la banque (règle des quatre yeux)."}
      </p>

      <label className="option option--compact" style={{ display: "inline-flex" }}>
        <input type="checkbox" name="eliminatoire" defaultChecked={initiale?.eliminatoire ?? false} />
        <span>Question éliminatoire — une erreur rend le critère non acquis</span>
      </label>

      <div className="actions">
        <button type="submit" className="bouton" disabled={enCours}>
          {enCours ? "Enregistrement…" : initiale?.id ? "Enregistrer les modifications" : "Créer la question"}
        </button>
        <Link href={`/admin/questions?module=${encodeURIComponent(moduleId)}`} className="bouton bouton--secondaire">
          Annuler
        </Link>
      </div>
    </form>
  );
}
