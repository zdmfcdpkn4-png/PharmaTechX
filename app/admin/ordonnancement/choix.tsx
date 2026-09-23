"use client";

import { useState } from "react";

/**
 * Choix du profil à ranger (question 55, choix a) : parcours, profil de
 * poste, niveau cible. Les niveaux proposés sont ceux de la filière choisie ;
 * sans filière, c'est l'ordre général du parcours qu'on range. Un identifiant
 * d'apprenant, facultatif, range son ordre propre sur ce profil (question 56,
 * choix a). Formulaire en GET : avant l'hydratation, il marche tel quel.
 */
export function ChoixProfil({
  parcours,
  filiere,
  niveau,
  postes,
  agent,
  apprenants,
}: {
  parcours: "integration" | "maintien";
  filiere: string;
  niveau: string;
  postes: { id: string; libelle: string; niveaux: { code: string; libelle: string }[] }[];
  /** Identifiant d'apprenant saisi, tel quel. */
  agent: string;
  /** Progression conservée sous identifiant : sans elle, pas d'ordre propre à un apprenant. */
  apprenants: boolean;
}) {
  const [choisie, setChoisie] = useState(filiere);
  const niveaux = postes.find((p) => p.id === choisie)?.niveaux ?? [];
  return (
    <form method="get" className="carte">
      <div className="rangee">
        <label className="champ">
          <span>Parcours</span>
          <select name="parcours" defaultValue={parcours}>
            <option value="integration">Intégration</option>
            <option value="maintien">Maintien d&apos;habilitation</option>
          </select>
        </label>
        <label className="champ">
          <span>Profil de poste</span>
          <select name="filiere" value={choisie} onChange={(e) => setChoisie(e.target.value)}>
            <option value="">Ordre général — tous les profils</option>
            {postes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Niveau cible</span>
          {/* Une clé par filière : la liste repart du premier niveau quand la filière change. */}
          <select key={choisie} name="niveau" defaultValue={choisie === filiere ? niveau : ""} disabled={!choisie}>
            {niveaux.length === 0 && <option value="">—</option>}
            {niveaux.map((n) => (
              <option key={n.code} value={n.code}>
                {n.libelle}
              </option>
            ))}
          </select>
        </label>
        {apprenants && (
          <label className="champ">
            <span>Apprenant (facultatif)</span>
            <input type="text" name="agent" defaultValue={agent} placeholder="AG-001" autoComplete="off" maxLength={20} />
          </label>
        )}
      </div>
      <div className="actions">
        <button type="submit" className="bouton">
          Afficher les modules
        </button>
      </div>
    </form>
  );
}
