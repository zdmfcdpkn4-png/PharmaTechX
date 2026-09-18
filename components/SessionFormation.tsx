"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";

/**
 * Mémoire de session.
 *
 * Les résultats sont conservés en mémoire vive du navigateur, le temps de
 * l'onglet. Rien n'est écrit : ni cookie, ni localStorage, ni sessionStorage.
 * Fermer l'onglet efface tout — c'est voulu, et c'est ce qui rend l'export du
 * rapport nécessaire à la fin du parcours.
 *
 * Quand la conservation nominative est activée, l'émission d'un rapport
 * l'enregistre côté serveur ; la mémoire de session garde alors le numéro et
 * l'empreinte reçus, pour les inscrire sur le fichier téléchargé.
 */

export interface ResultatSession extends ResultatEvaluation {
  /** Nombre de tentatives déjà effectuées sur ce module dans la session. */
  tentative: number;
}

export interface EmissionSession {
  id: string;
  numero: string;
  empreinte: string;
  emisLe: string;
}

interface Contexte {
  resultats: ResultatSession[];
  enregistrer: (r: ResultatEvaluation) => void;
  dernierPourModule: (moduleId: string) => ResultatSession | undefined;
  reinitialiser: () => void;
  emissions: Record<string, EmissionSession>;
  marquerEmis: (r: ResultatSession, e: EmissionSession) => void;
  cleEmission: (r: ResultatSession) => string;
}

const SessionContexte = createContext<Contexte | null>(null);

export function SessionFormation({ children }: { children: React.ReactNode }) {
  const [resultats, setResultats] = useState<ResultatSession[]>([]);
  const [emissions, setEmissions] = useState<Record<string, EmissionSession>>({});

  const enregistrer = useCallback((r: ResultatEvaluation) => {
    setResultats((prec) => {
      const tentative = prec.filter((x) => x.moduleId === r.moduleId).length + 1;
      return [...prec, { ...r, tentative }];
    });
  }, []);

  const dernierPourModule = useCallback(
    (moduleId: string) => [...resultats].reverse().find((r) => r.moduleId === moduleId),
    [resultats],
  );

  const reinitialiser = useCallback(() => {
    setResultats([]);
    setEmissions({});
  }, []);

  const cleEmission = useCallback((r: ResultatSession) => `${r.moduleId}#${r.tentative}`, []);

  const marquerEmis = useCallback(
    (r: ResultatSession, e: EmissionSession) => {
      setEmissions((prec) => ({ ...prec, [cleEmission(r)]: e }));
    },
    [cleEmission],
  );

  const valeur = useMemo(
    () => ({ resultats, enregistrer, dernierPourModule, reinitialiser, emissions, marquerEmis, cleEmission }),
    [resultats, enregistrer, dernierPourModule, reinitialiser, emissions, marquerEmis, cleEmission],
  );

  return <SessionContexte.Provider value={valeur}>{children}</SessionContexte.Provider>;
}

export function useSessionFormation(): Contexte {
  const ctx = useContext(SessionContexte);
  if (!ctx) {
    throw new Error("useSessionFormation doit être utilisé sous <SessionFormation>.");
  }
  return ctx;
}
