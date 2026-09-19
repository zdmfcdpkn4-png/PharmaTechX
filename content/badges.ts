/**
 * Illustrations de domaine — banque d'images du site.
 *
 * Deux familles cohabitent, pour deux usages qui ne se confondent pas :
 *
 * - les **pictogrammes** (`components/Badge.tsx`), tracés en SVG monochrome sur
 *   une grille de 24, lisibles à 24 px : badge de filière, pastilles en ligne,
 *   impression noir et blanc ;
 * - les **illustrations** ci-dessous, aquarelles fournies par le pharmacien
 *   responsable le 19/09/2026, qui illustrent un module. Mesuré : leur dessin
 *   ne se lit pas en dessous de ~72 px et leurs légendes internes restent
 *   illisibles à toute taille d'écran courante. Elles se posent donc en
 *   vignette de module (72 à 128 px), jamais en pastille, et **jamais sur un
 *   rapport** : ce sont des ornements, elles n'ont aucune valeur normative et
 *   certaines portent des mentions décoratives sans signification.
 *
 * Les fichiers sont versionnés avec le code (`public/badges/*.webp`) plutôt que
 * déposés en base : ils suivent le déploiement, survivent à une remise à zéro
 * de la base et se servent sans session. En ajouter un : le fichier, et une
 * entrée ici.
 */

/**
 * Identifiants des pictogrammes SVG, déclarés ici pour que ce module reste pur
 * (testable sans JSX) et pour que `components/Badge.tsx`, typé
 * `Record<NomPictogramme, …>`, ne puisse ni en oublier un ni en inventer un :
 * la cohérence des deux fichiers est vérifiée à la compilation, pas à l'œil.
 */
export const NOMS_PICTOGRAMME = [
  "isolateur", "hotte", "flacon", "seringue", "poche", "gants", "balance", "sonde", "filtre",
  "dechets", "etiquette", "controle", "document", "formation", "sas", "nettoyage", "preparation",
  "stockage",
] as const;

export type NomPictogramme = (typeof NOMS_PICTOGRAMME)[number];

export interface Illustration {
  libelle: string;
  /** Nom du fichier dans `public/badges/`. */
  fichier: string;
}

export const ILLUSTRATIONS: Record<string, Illustration> = {
  "sterilite-microbiologique": { libelle: "Contrôle de stérilité microbiologique", fichier: "sterilite-microbiologique.webp" },
  "culture-microbiologique": { libelle: "Cultures microbiologiques", fichier: "culture-microbiologique.webp" },
  "surveillance-environnementale": { libelle: "Surveillance environnementale", fichier: "surveillance-environnementale.webp" },
  "classe-iso-5": { libelle: "Classification ISO 5", fichier: "classe-iso-5.webp" },
  "zone-sterile": { libelle: "Zone stérile et sas", fichier: "zone-sterile.webp" },
  "habillage-sterile": { libelle: "Habillage stérile (gowning)", fichier: "habillage-sterile.webp" },
  "poste-securite-microbiologique": { libelle: "Poste de sécurité microbiologique", fichier: "poste-securite-microbiologique.webp" },
  "preparation-isolateur": { libelle: "Préparation en isolateur", fichier: "preparation-isolateur.webp" },
  "matieres-premieres": { libelle: "Distribution des matières premières", fichier: "matieres-premieres.webp" },
  "controle-qualite": { libelle: "Contrôle qualité (chromatographie)", fichier: "controle-qualite.webp" },
  "nettoyage-cip": { libelle: "Validation du nettoyage (CIP)", fichier: "nettoyage-cip.webp" },
  "sterilisation-sip": { libelle: "Stérilisation SIP et nettoyage CIP", fichier: "sterilisation-sip.webp" },
  autoclave: { libelle: "Autoclave", fichier: "autoclave.webp" },
  "eau-ppi": { libelle: "Unité de production d'eau PPI", fichier: "eau-ppi.webp" },
  "stockage-chimio": { libelle: "Stockage chimiothérapies régulé", fichier: "stockage-chimio.webp" },
  "chaine-du-froid": { libelle: "Logistique chaîne du froid", fichier: "chaine-du-froid.webp" },
  "transport-refrigere": { libelle: "Transport réfrigéré", fichier: "transport-refrigere.webp" },
  etiquetage: { libelle: "Étiquetage et traçabilité", fichier: "etiquetage.webp" },
  "dossier-de-lot": { libelle: "Dossier de lot et documentation", fichier: "dossier-de-lot.webp" },
  "dechets-chimiques": { libelle: "Déchets chimiques et biologiques", fichier: "dechets-chimiques.webp" },
  // Seconde série, 19/09/2026. Les quatre dernières viennent d'une planche au
  // dessin différent — aplats colorés, anneau plus fin : elles voisinent
  // correctement mais ne se confondent pas avec les autres.
  "analyse-microscopique": { libelle: "Analyse microscopique", fichier: "analyse-microscopique.webp" },
  "filtration-hepa": { libelle: "Filtration HEPA et flux d'air", fichier: "filtration-hepa.webp" },
  "hotte-laminaire": { libelle: "Hotte à flux laminaire", fichier: "hotte-laminaire.webp" },
  "combinaison-integrale": { libelle: "Tenue intégrale et flux d'air", fichier: "combinaison-integrale.webp" },
  "marche-en-avant": { libelle: "Circuits et marche en avant", fichier: "marche-en-avant.webp" },
  "tri-dechets": { libelle: "Tri des déchets et collecteurs", fichier: "tri-dechets.webp" },
  "registre-releves": { libelle: "Registre et relevés", fichier: "registre-releves.webp" },
  "attestation-habilitation": { libelle: "Attestation d'habilitation", fichier: "attestation-habilitation.webp" },
  "resultats-conformes": { libelle: "Résultats conformes", fichier: "resultats-conformes.webp" },
  "danger-cmr": { libelle: "Danger CMR et protection", fichier: "danger-cmr.webp" },
  "logistique-thermosensible": { libelle: "Logistique des produits thermosensibles", fichier: "logistique-thermosensible.webp" },
  "formation-diplome": { libelle: "Formation et diplôme", fichier: "formation-diplome.webp" },
  "procede-pharmaceutique": { libelle: "Procédé pharmaceutique", fichier: "procede-pharmaceutique.webp" },
};

export const NOMS_ILLUSTRATION = Object.keys(ILLUSTRATIONS);

/**
 * Valeur enregistrée qui vaut « aucun badge », par opposition à la chaîne vide
 * qui vaut « jamais renseigné » et laisse jouer la proposition. Sans ce
 * marqueur, retirer le badge d'un module le ferait revenir à la lecture
 * suivante.
 */
export const SANS_BADGE = "aucun";

/**
 * Illustration proposée d'après le titre et l'objectif d'un module, pour les
 * modules déjà en place qui n'en portent pas. Le plus spécifique d'abord :
 * « autoclave » avant « stérilisation », « protection de l'opérateur » avant
 * « préparation ».
 *
 * Rien n'est proposé quand aucun mot ne correspond : sur un dispositif qui sert
 * de preuve, une illustration fausse coûte plus cher qu'une case vide.
 */
const PROPOSITIONS: [RegExp, string][] = [
  [/autoclav|sterilisateur|chaleur humide/, "autoclave"],
  [/sip|sterilisation en place|vapeur/, "sterilisation-sip"],
  [/hepa|filtre terminal|integrite du filtre|test dop|test pao|filtration de l.air/, "filtration-hepa"],
  [/eau ppi|eau pour preparation|osmose|osmoseur|eau purifiee|qualite de l.eau/, "eau-ppi"],
  [/tri des dechets|collecteur|opct|aiguille|objet piquant/, "tri-dechets"],
  [/dechet|dasri|elimination|effluent|excreta/, "dechets-chimiques"],
  [/cmr|cancerogene|mutagene|reprotoxique|pictogramme de danger|classification sgh|toxicite/, "danger-cmr"],
  [/chromatograph|hplc|controle qualite|dosage|analyse quantitative|spectroph/, "controle-qualite"],
  [/microscop|examen direct|coloration de gram|lame et lamelle/, "analyse-microscopique"],
  [/dossier de lot|documentation|fiche de fabrication|enregistrement|tracabilite documentaire/, "dossier-de-lot"],
  [/registre|releve|cahier de|feuille de suivi/, "registre-releves"],
  [/attestation|certificat|visa d.habilitation/, "attestation-habilitation"],
  [/diplome|cursus|compagnonnage|tutorat|formation initiale|nouvel arrivant/, "formation-diplome"],
  [/etiquet|code.barre|datamatrix|marquage|identification du produit/, "etiquetage"],
  [/thermosensible|temperature dirigee|2 a 8|chaine thermique/, "logistique-thermosensible"],
  [/chaine du froid|logistique|acheminement|livraison|coursier/, "chaine-du-froid"],
  [/transport|glaciere|expedition|conteneur isotherme/, "transport-refrigere"],
  [/stockage|conservation|refrigerateur|frigo|armoire|enceinte thermostat/, "stockage-chimio"],
  [/nettoyage|cip|rincage|decontamination|bionettoyage|desinfection/, "nettoyage-cip"],
  [/combinaison|scaphandre|tenue integrale|surblouse/, "combinaison-integrale"],
  [/habillage|habillement|gowning|tenue|epi|protection de l.operateur|protection operateur|equipement de protection/, "habillage-sterile"],
  [/particul|surveillance environnementale|biocontamination|monitoring|pression differentielle/, "surveillance-environnementale"],
  [/iso 5|classe iso|classification|grade a|grade b/, "classe-iso-5"],
  [/gelose|boite de petri|ensemencement|prelevement de surface|gant.?test|media fill|test de remplissage/, "culture-microbiologique"],
  [/sterilite|essai de sterilite|microbiolog/, "sterilite-microbiologique"],
  [/hotte|psm|poste de securite|flux laminaire|flux d.air/, "poste-securite-microbiologique"],
  [/procede de fabrication|maitrise du procede|automate|robotis|ligne de production/, "procede-pharmaceutique"],
  [/matiere premiere|pesee|peser|gravimetri|balance|dotation|deconditionnement/, "matieres-premieres"],
  [/isolateur|reconstitution|preparation|cytotoxique|chimiotherapie|seringue|poche/, "preparation-isolateur"],
  [/marche en avant|circuit|cheminement|flux de personnel|flux des produits/, "marche-en-avant"],
  [/zac|zone d.atmosphere|zone sterile|salle propre|sas|comportement|circulation/, "zone-sterile"],
];

/*
 * Deux illustrations n'ont volontairement aucun mot-clé : « Hotte à flux
 * laminaire » et « Résultats conformes » recouvrent des domaines déjà tenus
 * par « Poste de sécurité microbiologique » et « Contrôle qualité ». Plutôt
 * que d'inventer une distinction qui n'existe pas dans les titres, elles
 * restent au choix de la main.
 */

function sansAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function badgeSuggere(titre: string, objectif = ""): string | undefined {
  const t = sansAccent(`${titre} ${objectif}`);
  for (const [motif, badge] of PROPOSITIONS) if (motif.test(t)) return badge;
  return undefined;
}

/**
 * Illustration à afficher pour un module : le choix enregistré s'il y en a un,
 * rien si le badge a été explicitement retiré, sinon la proposition.
 */
export function badgeEffectif(
  enregistre: string | null | undefined,
  titre: string,
  objectif = "",
): string | undefined {
  const v = (enregistre ?? "").trim();
  if (v === SANS_BADGE) return undefined;
  if (v) return v;
  return badgeSuggere(titre, objectif);
}
