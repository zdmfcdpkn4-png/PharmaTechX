import Link from "next/link";
import { conservationActive, dureeConservationMois, procedureReference } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Information des agents (RGPD, art. 13), resserrée le 22/09/2026 à la
 * demande du pharmacien responsable : « synthétiser drastiquement », puis
 * « circonscrire tout le RGPD dans un onglet spécifique » — cette page est
 * cet onglet, en fin de volet, et aucun autre écran ne parle plus des
 * données (ce qu'ils en disaient est repris ici). Chaque
 * élément exigé par l'article 13 reste — responsable, DPO, finalité, base
 * légale, destinataires, durée, droits, réclamation — en une ligne chacun.
 * Le détail vit dans la fiche de registre (`docs/RGPD.md`). Les éléments
 * propres à l'établissement restent [à compléter] tant que le DPO ne les a
 * pas fournis : ils ne sont pas inventés.
 */
export default function DonneesPersonnelles() {
  const active = conservationActive();
  const duree = dureeConservationMois();
  const procedure = procedureReference();
  const aCompleter = <code className="a-preciser">[à compléter]</code>;

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › RGPD
      </p>
      <section className="panneau-titre">
        <p className="sur-titre">RGPD, article 13</p>
        <h1>Vos données et vos droits</h1>
        <p>
          {active
            ? "Aucun nom : le site ne connaît que votre identifiant d'agent (AG-001…)."
            : "Rien de nominatif : aucun résultat n'est conservé ; le nom saisi pour un rapport reste sur ce poste, dans le fichier téléchargé."}
        </p>
      </section>

      <section className="carte">
        <dl className="rgpd">
          <dt>Enregistré</dt>
          <dd>
            Les rapports que vous émettez et leurs visas ; votre progression si vous la rattachez (code personnel
            haché), et l&apos;ordre de modules que le tutorat vous fixe ; le journal d&apos;administration ; une empreinte de l&apos;adresse de connexion, pour limiter les
            tentatives. Jamais votre nom — la correspondance est tenue hors du site.
          </dd>
          <dt>Pourquoi</dt>
          <dd>
            Tracer l&apos;étape 2 de l&apos;habilitation. Améliorer les formations : vos évaluations conservées
            entrent, agrégées, dans des statistiques de réussite par module et par question — sans nom, sans
            décision sur vous, aucun taux sous cinq agents. Base légale : {aCompleter} avec le DPO (pas le
            consentement).
          </dd>
          <dt>Qui y accède</dt>
          <dd>Tuteurs, pharmacien responsable, administrateur du site ; aucun tiers. Hébergement : {aCompleter}.</dd>
          <dt>Combien de temps</dt>
          <dd>
            Jusqu&apos;à suppression par l&apos;administrateur{duree ? ` (cible : ${duree} mois)` : ""} ; durée de
            référence <code className="a-preciser">[à préciser]</code> avec le DPO.
          </dd>
          <dt>Vos droits</dt>
          <dd>
            Accès, rectification (un rapport scellé s&apos;annule et se réémet), limitation, opposition ; effacement
            dans la limite de la traçabilité de l&apos;habilitation. Auprès du pharmacien responsable ou du DPO :{" "}
            {aCompleter}. Réclamation : CNIL (cnil.fr).
          </dd>
          <dt>Responsable</dt>
          <dd>{aCompleter}</dd>
        </dl>
        <p className="legende" style={{ marginBottom: 0 }}>
          Procédure : {procedure ? <code>{procedure}</code> : aCompleter}. Fiche de registre à valider par le DPO avant
          la mise en service.
        </p>
      </section>
    </article>
  );
}
