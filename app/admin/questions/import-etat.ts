import type { QuestionImportee } from "@/lib/import-questions";

/** Question importée, avec l'image appariée en base quand il y en a une. */
export type QuestionImporteeAvecImage = QuestionImportee & { imageId?: string | null };

/** État du dépôt en deux temps : analyse puis confirmation. */
export interface EtatImport {
  etape: "saisie" | "apercu" | "fait";
  moduleId: string;
  nom: string;
  formatDefaut: "QCM" | "QIM";
  questions: QuestionImporteeAvecImage[];
  images: { nom: string; id: string }[];
  avertissements: string[];
  erreur?: string;
  ajoutees?: number;
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
