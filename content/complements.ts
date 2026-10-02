/**
 * Ce que le site affiche en encadré jaune tant qu'il manque, et que
 * l'administration renseigne depuis Réglages › À compléter (demande du
 * 02/10/2026). Renseigné, un élément remplace son encadré partout où il
 * paraît ; effacé, l'encadré revient. Rien n'est jamais rempli par une valeur
 * vraisemblable : sans saisie, le marqueur reste.
 *
 * Quatre familles :
 * - le dispositif : la procédure de référence, en pied de chaque page, sur la
 *   page RGPD et sur les rapports (la variable `PROCEDURE_HABILITATION` n'est
 *   plus qu'un repli) ;
 * - la page RGPD : les cinq mentions propres à l'établissement ;
 * - le texte des modules rédigés : chaque donnée locale [à préciser] ;
 * - les modules rédigés : chaque document « à rattacher » de leur liste.
 *
 * Module pur : le stockage est dans `lib/complements-db.ts` (table
 * `parametres`, une ligne par élément, clé `complement:…`).
 */
import { A_PRECISER, type Module } from "./types";

export type GroupeComplement = "dispositif" | "rgpd" | "texte" | "module";

export interface Complement {
  /** Clé stable : ancre de la page d'administration et suffixe de la ligne en base. */
  cle: string;
  groupe: GroupeComplement;
  libelle: string;
  /** Où l'encadré se voit. */
  ou: { libelle: string; href: string };
  /** Ce qu'il faut fournir, et qui le décide. */
  aide: string;
  /** Champ sur plusieurs lignes. */
  long?: boolean;
  /** Document « à rattacher » : le module dont les documents déposés se proposent. */
  moduleId?: string;
}

/** Ce qu'un élément porte une fois renseigné. */
export interface ValeurComplement {
  texte: string;
  /** Document déposé (`depots.id`) rattaché à un document « à rattacher » d'un module. */
  document: number | null;
}

/** Au-delà, ce n'est plus une mention mais un texte : il se dépose dans Documents. */
export const LONGUEUR_MAX_COMPLEMENT = 500;

export const COMPLEMENTS_FIXES: readonly Complement[] = [
  {
    cle: "procedure",
    groupe: "dispositif",
    libelle: "Procédure de référence",
    ou: { libelle: "Pied de chaque page, page RGPD, rapports", href: "/donnees-personnelles" },
    aide:
      "Code et titre de la procédure d'habilitation dans votre système documentaire. Un rapport garde la procédure en vigueur à son émission : la changer ne réécrit pas les rapports déjà émis.",
  },
  {
    cle: "rgpd-responsable",
    groupe: "rgpd",
    long: true,
    libelle: "Responsable du traitement",
    ou: { libelle: "Page RGPD, « Responsable »", href: "/donnees-personnelles" },
    aide: "L'établissement et la personne qui le représente : nom et qualité.",
  },
  {
    cle: "rgpd-contact",
    groupe: "rgpd",
    libelle: "Contact pour exercer ses droits",
    ou: { libelle: "Page RGPD, « Vos droits »", href: "/donnees-personnelles" },
    aide: "Adresse ou téléphone du pharmacien responsable ou du délégué à la protection des données.",
  },
  {
    cle: "rgpd-base-legale",
    groupe: "rgpd",
    long: true,
    libelle: "Base légale",
    ou: { libelle: "Page RGPD, « Pourquoi »", href: "/donnees-personnelles" },
    aide: "La base légale (article 6 du RGPD) arrêtée avec le DPO.",
  },
  {
    cle: "rgpd-hebergement",
    groupe: "rgpd",
    long: true,
    libelle: "Hébergement",
    ou: { libelle: "Page RGPD, « Qui y accède »", href: "/donnees-personnelles" },
    aide: "Les hébergeurs du site et de la base de données, et leur localisation, tels que validés par le DPO.",
  },
  {
    cle: "rgpd-duree",
    groupe: "rgpd",
    long: true,
    libelle: "Durée de conservation de référence",
    ou: { libelle: "Page RGPD, « Combien de temps »", href: "/donnees-personnelles" },
    aide: "La durée arrêtée avec le DPO. Elle s'annonce : aucune purge automatique n'en découle, l'administrateur purge à la main.",
  },
];

export function cleRessource(moduleId: string, ressourceId: string): string {
  return `ressource:${moduleId}:${ressourceId}`;
}

/** Le marqueur d'une donnée locale dans le texte d'un module rédigé. */
export const MARQUEUR_TEXTE = A_PRECISER;

/** Clé de la n-ième donnée locale du texte d'un module, comptée dans l'ordre de lecture, à partir de 1. */
export function cleTexte(moduleId: string, n: number): string {
  return `texte:${moduleId}:${n}`;
}

/** Sans balisage : puces, numéros, gras, italique, code. */
function sansBalises(t: string): string {
  return t
    .replace(/^\s*(?:[-*>]|\d+\.)\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`/g, "")
    .trim();
}

/**
 * Les données locales du texte des modules rédigés : chaque [à préciser] de
 * leurs sections, compté dans l'ordre de lecture — l'ordre où `Corps` les
 * affiche. Le libellé est le début de la phrase qui le porte ; la phrase
 * entière sert d'aide.
 */
export function complementsDesTextes(modules: Pick<Module, "id" | "titre" | "sections">[]): Complement[] {
  return modules.flatMap((m) => {
    let n = 0;
    return m.sections.flatMap((s, i) =>
      s.corps.split("\n").flatMap((ligne) => {
        const parts = ligne.split(MARQUEUR_TEXTE);
        return parts.slice(1).map((apres, j) => {
          // La dernière phrase avant le marqueur, la fin de la sienne après lui.
          const avant = parts[j].split(/(?<=[.!?])\s+/).pop() ?? "";
          const fin = apres.split(/(?<=[.!?])\s+/)[0];
          const libelle = sansBalises(avant).replace(/[\s:—–-]+$/, "") || `Donnée ${n + 1} du module`;
          n += 1;
          return {
            cle: cleTexte(m.id, n),
            groupe: "texte" as const,
            libelle,
            ou: { libelle: `Module « ${m.titre} », section « ${s.titre} »`, href: `/module/${m.id}#section-${i + 1}` },
            aide: `Donnée de l'unité, affichée dans le texte à la place de l'encadré : « ${sansBalises(`${avant}…${fin}`).replace(/…\.$/, "…")} »`,
            long: true,
          };
        });
      }),
    );
  });
}

/** Les documents « à rattacher » des modules du code : ceux dont la fiche ne donne pas d'adresse. */
export function complementsDesRessources(modules: Pick<Module, "id" | "titre" | "ressources">[]): Complement[] {
  return modules.flatMap((m) =>
    m.ressources
      .filter((r) => r.url === null)
      .map((r) => ({
        cle: cleRessource(m.id, r.id),
        groupe: "module" as const,
        libelle: r.titre,
        ou: { libelle: `Page du module « ${m.titre} »`, href: `/module/${m.id}` },
        aide: `${r.commentaire ? `${r.commentaire.replace(/\.$/, "")}. ` : ""}Sa référence dans votre système documentaire, et le document déposé s'il est dans Documents.`,
        moduleId: m.id,
      })),
  );
}

/**
 * Valeur lue en base, validée : texte coupé à la longueur permise, document
 * entier positif ou rien. `null` quand il ne reste rien à afficher.
 */
export function lireValeurComplement(brut: unknown): ValeurComplement | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const texte = typeof o.texte === "string" ? o.texte.trim().slice(0, LONGUEUR_MAX_COMPLEMENT) : "";
  const document = Number.isInteger(o.document) && (o.document as number) > 0 ? (o.document as number) : null;
  return texte || document ? { texte, document } : null;
}

/**
 * La procédure en vigueur : celle renseignée sur le site, sinon la variable
 * d'environnement de Render, sinon rien — et le pied comme le rapport
 * impriment alors [à compléter].
 */
export function procedureEffective(renseignee: ValeurComplement | null | undefined, environnement: string | null): string | null {
  return renseignee?.texte || environnement || null;
}

/**
 * La procédure qu'imprime un rapport enregistré. Scellée à l'émission depuis
 * le 02/10/2026 : une chaîne vide dit qu'aucune n'était en vigueur. Un rapport
 * émis avant (`null`) garde l'ancienne lecture, la procédure en vigueur.
 */
export function procedureDuRapport(scellee: string | null, enVigueur: string | null): string | null {
  return scellee === null ? enVigueur : scellee || null;
}
