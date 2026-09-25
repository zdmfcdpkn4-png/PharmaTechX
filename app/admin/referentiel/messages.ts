/**
 * Messages du Référentiel et de la page d'une filière (question 80, choix a) :
 * les mêmes actions renvoient les mêmes codes, qui se lisent pareil sur les
 * deux écrans.
 */

export const MESSAGES: Record<string, string> = {
  filiere: "Filière enregistrée.",
  niveau: "Niveau enregistré.",
  "filiere-supprimee": "Dépôt de filière supprimé.",
  "niveau-supprime": "Dépôt de niveau supprimé.",
};

export const ERREURS: Record<string, string> = {
  libelle: "Le libellé est obligatoire.",
  identifiant: "L'identifiant doit faire au moins deux caractères une fois normalisé.",
  code: "Le code du niveau est obligatoire.",
  "filiere-manquante": "Un niveau se rattache à une filière.",
  prefixe:
    "Ce code porte le préfixe d'un autre métier que celui de la filière choisie (PH- pharmacien / interne, AP- aide en pharmacie, AE- agent d'entretien).",
  longueur: "Le code dépasse douze caractères une fois le préfixe du métier ajouté.",
  "metier-change": "Un niveau ne change pas de métier : ajoutez-en un autre dans la filière voulue.",
  "metier-filiere":
    "Cette filière porte des niveaux : elle garde son métier. Supprimez d'abord ses niveaux déposés, ou ajoutez une autre filière.",
};
