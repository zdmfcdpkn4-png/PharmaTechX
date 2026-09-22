"use client";

import { useFormStatus } from "react-dom";

/**
 * Bouton d'envoi qui montre l'attente (22/09/2026, « retours visuels lors des
 * clics et de la validation »). Pendant que le serveur traite le formulaire,
 * le bouton se désactive et porte un indicateur : on voit que l'appui a été
 * pris, et un second appui n'envoie rien de plus. Le libellé ne change pas.
 */
export function BoutonEnvoi({
  children,
  className = "bouton",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={pending ? `${className} est-en-cours` : className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? <span className="rond-attente" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
