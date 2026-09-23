import type { QuestionImportee } from "@/lib/import-questions";

/**
 * D'où vient le module d'une question à l'analyse (question 57, choix a) :
 * sa ligne « Module : », le module choisi au formulaire, la proposition du
 * site — ou rien, et il est à choisir dans l'aperçu.
 */
export type OrigineModule = "ligne" | "formulaire" | "proposition" | "a-choisir";

/** Question importée, avec l'image appariée en base et le module retenu à l'analyse. */
export type QuestionImporteeAvecImage = QuestionImportee & {
  imageId?: string | null;
  /** Module retenu à l'analyse ; `null` : à choisir. */
  moduleId?: string | null;
  origineModule?: OrigineModule;
  /** Ce qui a décidé, en clair : la ligne lue, les mots partagés, l'hésitation. */
  detailModule?: string;
};

/** État du dépôt en deux temps : analyse puis confirmation. */
export interface EtatImport {
  etape: "saisie" | "apercu" | "fait";
  /** Module choisi au formulaire, facultatif : il vaut pour les questions sans ligne « Module : ». */
  moduleId: string;
  nom: string;
  formatDefaut: "QCM" | "QIM";
  questions: QuestionImporteeAvecImage[];
  images: { nom: string; id: string }[];
  avertissements: string[];
  erreur?: string;
  ajoutees?: number;
  /** Après l'ajout : nombre de questions par module. */
  ajouteesParModule?: { id: string; n: number }[];
}

export const ETAT_IMPORT_INITIAL: EtatImport = {
  etape: "saisie",
  moduleId: "",
  nom: "",
  formatDefaut: "QCM",
  questions: [],
  images: [],
  avertissements: [],
};

/** État du formulaire de question (création ou modification). */
export interface EtatFormulaireQuestion {
  erreur?: string;
}
