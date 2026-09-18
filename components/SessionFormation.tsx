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
 * Quand la conservation des rapports est activée (mode pseudonyme),
 * l'émission d'un rapport l'enregistre côté serveur sous l'identifiant
 * d'agent saisi ; la mémoire de session garde alors le numéro, l'empreinte et
 * l'identifiant reçus, pour les inscrire sur le fichier téléchargé.
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
  /** Identifiant d'agent sous lequel le rapport est enregistré. */
  identifiant: string;
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

/** Rapport émis par l'agent, tel que le serveur le connaît (progression rattachée). */
export interface EmissionInitiale extends EmissionSession {
  moduleId: string | null;
  horodatageIso: string | null;
}

/** Numérote les tentatives par module, dans l'ordre chronologique. */
function numeroter(liste: ResultatEvaluation[]): ResultatSession[] {
  const compte: Record<string, number> = {};
  return liste.map((r) => ({ ...r, tentative: (compte[r.moduleId] = (compte[r.moduleId] ?? 0) + 1) }));
}

/** Retrouve, pour chaque évaluation conservée, le rapport émis qui lui correspond. */
function indexer(resultats: ResultatSession[], emissions: EmissionInitiale[]): Record<string, EmissionSession> {
  const out: Record<string, EmissionSession> = {};
  for (const r of resultats) {
    const e = emissions.find((x) => x.moduleId === r.moduleId && x.horodatageIso === r.horodatageIso);
    if (e) out[`${r.moduleId}#${r.tentative}`] = { id: e.id, numero: e.numero, empreinte: e.empreinte, emisLe: e.emisLe, identifiant: e.identifiant };
  }
  return out;
}

export function SessionFormation({
  children,
  initialResultats = [],
  initialEmissions = [],
}: {
  children: React.ReactNode;
  /** Évaluations conservées sous l'identifiant rattaché (question 11) : la mémoire de session part de là. */
  initialResultats?: ResultatEvaluation[];
  initialEmissions?: EmissionInitiale[];
}) {
  const [resultats, setResultats] = useState<ResultatSession[]>(() => numeroter(initialResultats));
  const [emissions, setEmissions] = useState<Record<string, EmissionSession>>(() =>
    indexer(numeroter(initialResultats), initialEmissions),
  );

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
