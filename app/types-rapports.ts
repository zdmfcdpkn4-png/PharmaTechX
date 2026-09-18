/** Réponse de l'action d'émission d'un rapport (voir `app/actions-rapports.ts`). */
export type ReponseEmission =
  | { ok: true; id: string; numero: string; empreinte: string; emisLe: string; identifiant: string }
  | { ok: false; erreur: string };
