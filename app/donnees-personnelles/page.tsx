import Link from "next/link";
import { conservationActive, dureeConservationMois, miseEnService, procedureReference } from "@/lib/config";
import { STATUT_DISPOSITIF, dateMiseEnServiceLisible } from "@/lib/statut";

export const dynamic = "force-dynamic";

/**
 * Information des agents (RGPD, art. 13) sur le traitement « rapports
 * d'évaluation enregistrés », en mode pseudonyme. Le texte reprend la fiche
 * de registre de `docs/RGPD.md` ; les éléments propres à l'établissement
 * (responsable, DPO, hébergeur) sont marqués [à compléter] tant que le DPO ne
 * les a pas fournis — ils ne sont pas inventés.
 */
export default function DonneesPersonnelles() {
  const active = conservationActive();
  const duree = dureeConservationMois();
  const procedure = procedureReference();
  const enService = miseEnService();
  const aCompleter = <code className="a-preciser">[à compléter]</code>;

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › Données personnelles
      </p>
      <section className="panneau-titre">
        <p className="sur-titre">Information des agents — RGPD, article 13</p>
        <h1>Vos données et vos droits</h1>
        <p>
          {active
            ? "Ce site enregistre les rapports d'évaluation que vous choisissez d'émettre, sous un identifiant d'agent et sans votre nom. Voici ce qui est traité, pourquoi, par qui, pendant combien de temps, et ce que vous pouvez demander."
            : "Ce site n'enregistre aucun résultat : le rapport que vous téléchargez sur votre poste est le seul support. Ce qui suit décrit le traitement tel qu'il existerait si l'enregistrement des rapports était activé."}
        </p>
      </section>

      <section className="carte">
        <h2>Ce qui est enregistré, et ce qui ne l&apos;est pas</h2>
        <ul>
          <li><strong>Jamais votre nom, votre prénom ni votre matricule.</strong> Le site ne connaît que l&apos;identifiant d&apos;agent (AG-001, AG-002…) que votre tuteur vous remet. La correspondance entre cet identifiant et vous est tenue par le pharmacien responsable, hors du site, sur un support qui ne quitte pas l&apos;établissement.</li>
          <li><strong>Sur émission seulement</strong> : le rapport d&apos;évaluation que vous décidez d&apos;émettre — critère, tirage, réponses données et corrigé, score, verdict — rattaché à votre identifiant, numéroté et scellé par une empreinte.</li>
          <li><strong>Le circuit de décision</strong> : l&apos;arbitrage motivé du tuteur si le verdict est indéterminé, le visa du tuteur, le visa du pharmacien responsable avec l&apos;image de sa signature. Chacun porte le profil de session de son auteur, la date et l&apos;empreinte.</li>
          <li><strong>Le journal</strong> des actions d&apos;administration, par rôle et libellé de profil.</li>
          <li><strong>Ne sont pas enregistrés</strong> : vos réponses hors émission, les entraînements, votre adresse (les échecs de connexion sont comptés par empreinte d&apos;adresse), et le nom porté à l&apos;impression d&apos;un rapport, qui n&apos;est ni conservé ni écrit au journal.</li>
        </ul>
        <p className="legende">
          Un identifiant reste une donnée à caractère personnel au sens du règlement (UE) 2016/679 (pseudonymisation, article 4 § 5) : c&apos;est pourquoi ce traitement figure au registre des traitements de l&apos;établissement et vous est décrit ici.
        </p>
      </section>

      <section className="carte">
        <h2>Pourquoi, et sur quel fondement</h2>
        <p>
          <strong>Finalité</strong> : documenter l&apos;étape 2 (évaluation des connaissances) de la chaîne d&apos;habilitation du personnel de l&apos;unité de pharmacotechnie, et en tenir la traçabilité (registre des rapports, répertoire par agent et par critère). Le rapport ne vaut pas habilitation : elle se prononce hors du site, sur la fiche d&apos;habilitation.
        </p>
        <p>
          <strong>Base légale</strong> : {aCompleter} — à arrêter avec le délégué à la protection des données ; exécution d&apos;une mission d&apos;intérêt public (article 6 § 1 e) ou respect d&apos;une obligation légale de documentation de l&apos;habilitation du personnel (article 6 § 1 c, bonnes pratiques de préparation). Le traitement ne repose pas sur votre consentement.
        </p>
      </section>

      <section className="carte">
        <h2>Qui y accède, où, combien de temps</h2>
        <ul>
          <li><strong>Responsable du traitement</strong> : {aCompleter} (l&apos;établissement, représenté par sa direction).</li>
          <li><strong>Accès</strong> : les tuteurs et le pharmacien responsable de l&apos;unité (rapports, visas, répertoire), l&apos;administrateur du site (purge, journal). Aucun autre destinataire ; aucune transmission à un tiers.</li>
          <li><strong>Hébergement</strong> : {aCompleter} — hébergeur retenu et localisation des serveurs, arrêtés avec la direction des systèmes d&apos;information et le délégué à la protection des données. Les données transmises ne comportent aucun nom.</li>
          <li><strong>Durée</strong> : les rapports sont conservés jusqu&apos;à leur suppression manuelle par l&apos;administrateur{duree ? `, la durée cible annoncée étant de ${duree} mois` : ""} ; aucune suppression automatique. La durée de conservation de référence est <code className="a-preciser">[à préciser]</code> avec le délégué à la protection des données.</li>
        </ul>
      </section>

      <section className="carte">
        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander l&apos;accès aux rapports rattachés à votre identifiant, leur rectification lorsqu&apos;ils sont inexacts (un rapport scellé ne se modifie pas : il s&apos;annule avec motif et se réémet), la limitation du traitement, et vous opposer au traitement pour des raisons tenant à votre situation particulière. L&apos;effacement s&apos;exerce dans les limites de l&apos;obligation de traçabilité de l&apos;habilitation.
        </p>
        <p>
          Adressez-vous au pharmacien responsable de l&apos;unité, qui tient la correspondance des identifiants, ou au délégué à la protection des données de l&apos;établissement : {aCompleter}. Vous pouvez aussi introduire une réclamation auprès de la CNIL (cnil.fr).
        </p>
      </section>

      <p className="encart">
        {enService ? `En service depuis le ${dateMiseEnServiceLisible(enService)}. ` : "Phase d'essai : aucun rapport ne vaut preuve tant que la mise en service n'est pas prononcée. "}Statut du dispositif : {STATUT_DISPOSITIF.long}, décision du {STATUT_DISPOSITIF.decideLe} ; le rapport ne vaut pas habilitation. Procédure de référence : {procedure ? <code>{procedure}</code> : aCompleter}. Fiche de registre et texte de référence : <code>docs/RGPD.md</code>, à valider par le délégué à la protection des données avant la mise en service.
      </p>
    </article>
  );
}
