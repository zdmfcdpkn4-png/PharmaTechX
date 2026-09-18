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
 * l'onglet. Rien n'est écrit : ni cookie, ni localStorage, ni sessionStorage,
 * ni base côté serveur. Fermer l'onglet efface tout — c'est voulu, et c'est ce
 * qui rend l'export du rapport nécessaire à la fin du parcours.
 */

export interface ResultatSession extends ResultatEvaluation {
  /** Nombre de tentatives déjà effectuées sur ce module dans la session. */
  tentative: number;
}

interface Contexte {
  resultats: ResultatSession[];
  enregistrer: (r: ResultatEvaluation) => void;
  dernierPourModule: (moduleId: string) => ResultatSession | undefined;
  reinitialiser: () => void;
}

const SessionContexte = createContext<Contexte | null>(null);

export function SessionFormation({ children }: { children: React.ReactNode }) {
  const [resultats, setResultats] = useState<ResultatSession[]>([]);

  const enregistrer = useCallback((r: ResultatEvaluation) => {
    setResultats((prec) => {
      const tentative =
        prec.filter((x) => x.moduleId === r.moduleId).length + 1;
      return [...prec, { ...r, tentative }];
    });
  }, []);

  const dernierPourModule = useCallback(
    (moduleId: string) =>
      [...resultats].reverse().find((r) => r.moduleId === moduleId),
    [resultats],
  );

  const reinitialiser = useCallback(() => setResultats([]), []);

  const valeur = useMemo(
    () => ({ resultats, enregistrer, dernierPourModule, reinitialiser }),
    [resultats, enregistrer, dernierPourModule, reinitialiser],
  );

  return (
    <SessionContexte.Provider value={valeur}>
      {children}
    </SessionContexte.Provider>
  );
}

export function useSessionFormation(): Contexte {
  const ctx = useContext(SessionContexte);
  if (!ctx) {
    throw new Error(
      "useSessionFormation doit être utilisé sous <SessionFormation>.",
    );
  }
  return ctx;
}
