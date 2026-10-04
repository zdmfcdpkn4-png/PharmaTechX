/** Le rapport engagé : le modèle, par son alias de /model. */
export type Vitesse = 'haiku' | 'sonnet' | 'opus' | 'fable'

/** Le régime : le niveau d'effort, tel que /effort le prend. */
export type Regime = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type EtatEtape = 'fait' | 'en cours' | 'à faire'

/** Le remplissage de la fenêtre de contexte, tel que la ligne d'état le donne. */
export type Contexte = {
  /** Jetons de la dernière requête sur la fenêtre, en %. */
  percent: number | null
  tokens: number | null
  fenetre: number | null
  /** Seuil du compactage automatique, en % de la fenêtre ; null s'il est éteint ou inconnu. */
  seuilAuto: number | null
}

/** Le modèle et l'effort de la dernière requête du fil principal. */
export type Reglage = { modele: string | null; effort: string | null }

export type SousAgent = { type: string; pour: string }

/** Ce que Claude conseille pour l'analyse qui commence ou la suivante (outil cap). */
export type Conseil = {
  analyse: string
  modele: Vitesse
  effort: Regime
  pourquoi: string
  sousAgents: SousAgent[]
}

export type Etape = { etape: string; etat: EtatEtape }

export type Tache = {
  id: string
  sujet: string
  statut: 'pending' | 'in_progress' | 'completed'
  /** La forme « en train de… » donnée à la création, quand elle existe. */
  forme: string | null
}

/** Un bouton à confirmer : premier appui arme, second appui agit. */
export type Arme = { action: 'compacter' | 'relais' }

declare module 'claude-code' {
  interface PluginState {
    'tableau-de-bord': {
      contexte: Contexte
      reglage: Reglage
      conseil: Conseil | null
      plan: Etape[]
      taches: Tache[]
      arme: Arme | null
      aide: boolean
      /** Dernier niveau d'alerte annoncé (0 à 3), pour n'annoncer qu'une montée. */
      alerte: number
    }
  }
}
