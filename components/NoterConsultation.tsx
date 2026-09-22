"use client";

import { useEffect } from "react";
import { CLE_CONSULTATIONS, ajouterConsultation, lireConsultations } from "@/content/tableau";

/**
 * Note l'ouverture d'un module dans la trace locale des modules consultés
 * (tableau de bord de l'accueil, 22/09/2026). Rien n'est rendu, rien n'est
 * transmis : la trace reste dans le navigateur, comme les repères de lecture.
 */
export function NoterConsultation({ module, titre }: { module: string; titre: string }) {
  useEffect(() => {
    try {
      const liste = lireConsultations(localStorage.getItem(CLE_CONSULTATIONS));
      const suite = ajouterConsultation(liste, { module, titre, le: new Date().toISOString() });
      localStorage.setItem(CLE_CONSULTATIONS, JSON.stringify(suite));
    } catch {
      // stockage refusé : l'accueil ne proposera simplement pas ce module
    }
  }, [module, titre]);
  return null;
}
