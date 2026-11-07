import type { Level } from '../engine/types';

/**
 * Textes de feedback (positifs et précis) et indices généraux à la demande.
 * Contenu rédigé par l'équipe, modifiable ici.
 */
export const GROUP_OK = {
  S: 'Bien vu : ces résistances sont bien en série. Calcule maintenant leur résistance équivalente.',
  P: 'Bien vu : ces résistances sont bien en parallèle. Calcule maintenant leur résistance équivalente.',
};

export const VALUE_OK = [
  'Calcul juste ! Le schéma se simplifie.',
  'Exact. Continue avec le schéma simplifié.',
  'Parfait, la valeur est correcte.',
];

export const SUCCESS_MESSAGES = [
  'Bravo ! Ta démarche est complète et juste.',
  'Excellent travail, tu as simplifié le circuit jusqu’au bout.',
  'Très bien ! Méthode et calculs sont corrects.',
];

/** Indices généraux demandés volontairement par l'élève (bouton « Besoin d'un indice ? »). */
export const GENERAL_HINTS: Record<Level, string[]> = {
  facile: [
    "Repère le chemin du courant entre les deux bornes : un seul chemin, ou plusieurs branches ?",
    'En série, les résistances s’additionnent ; en parallèle, ce sont les inverses qui s’additionnent.',
  ],
  moyen: [
    'Commence par le groupe le plus « intérieur » : deux résistances qui forment déjà un bloc simple.',
    'Repère les nœuds : deux résistances entre les mêmes deux nœuds sont en parallèle.',
  ],
  difficile: [
    'Avant de calculer, cherche un fil qui court-circuite une résistance, ou un pont équilibré.',
    "Si le schéma est difficile à lire, suis le courant depuis la borne d'entrée et repère les nœuds.",
  ],
};

export const DIRECT_LABEL = 'Tu connais déjà $R_{eq}$ ? Réponse directe :';
export const SELECTION_TOO_SMALL = 'Sélectionne au moins deux résistances en cliquant dessus.';
export const UNKNOWN_FINAL =
  'Je ne reconnais pas ta démarche dans ce résultat. Résous-le étape par étape pour qu’on voie ton raisonnement.';
export const NOT_SHORTED = "Cette résistance n'est pas court-circuitée : le courant la traverse bien.";
export const NOT_BRIDGE = "Ce n'est pas la résistance centrale d'un pont équilibré.";
export const SHORT_REMOVED = 'Exact : la résistance est court-circuitée par le fil, aucun courant ne la traverse. On la retire.';
export const BRIDGE_REMOVED =
  'Exact : $\\frac{R_1}{R_2} = \\frac{R_3}{R_4}$, donc C et D sont au même potentiel. La résistance centrale ne conduit pas, on la retire.';
export const DIRECT_WRONG = 'Ce n’est pas encore ça. Passe en mode étape par étape pour qu’on voie ton raisonnement.';
