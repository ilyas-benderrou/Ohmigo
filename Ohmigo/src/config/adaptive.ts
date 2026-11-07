/**
 * Constantes du moteur adaptatif (section 9 du cahier des charges).
 * Toutes les valeurs sont ajustables ici sans toucher au reste du code.
 */
export interface AdaptiveConfig {
  streakToLevelUp: number;
  minNoHintInStreak: number;
  extraExercisesWhenSlow: number;
  slowTimeSec: Record<'facile' | 'moyen' | 'difficile', number>;
  hintAt: number;
  videoAt: number;
  alertAt: number;
  successGain: number;
  errorPenalty: number;
  initialCompetence: number;
  reviewDelayMin: number;
  reviewDelayMax: number;
  weakestCompetenceBias: number;
  guessTimeSec: number;
  answerRelTolerance: number;
}

export const ADAPTIVE: AdaptiveConfig = {
  /** Réussites d'affilée nécessaires pour passer au niveau suivant. */
  streakToLevelUp: 3,
  /** Parmi ces réussites, nombre minimal sans indice. */
  minNoHintInStreak: 2,
  /** Exercices supplémentaires exigés après une réussite très lente. */
  extraExercisesWhenSlow: 1,
  /** Au-delà de cette durée (s), une réussite est jugée « très longue ». */
  slowTimeSec: { facile: 240, moyen: 420, difficile: 600 },

  /** Paliers d'aide pour une même erreur : 1 = indice, 2 = micro-vidéo + remédiation, 3 = alerte professeur. */
  hintAt: 1,
  videoAt: 2,
  alertAt: 3,

  /** Évolution de la maîtrise des compétences (score borné entre 0 et 100). */
  successGain: 15,
  errorPenalty: 10,
  initialCompetence: 0,

  /** Révision espacée : l'exercice revient entre min et max exercices plus tard. */
  reviewDelayMin: 2,
  reviewDelayMax: 3,

  /** Probabilité de choisir un gabarit de la compétence la plus faible (sinon : gabarit au hasard du niveau). */
  weakestCompetenceBias: 0.75,

  /** Réponse directe plus rapide que ce délai (s) et ne correspondant à rien → E0 (réponse au hasard). */
  guessTimeSec: 10,

  /** Tolérance relative sur les valeurs saisies (1 %). */
  answerRelTolerance: 0.01,
};

/** Code PIN du professeur par défaut (modifiable depuis le tableau de bord). */
export const DEFAULT_TEACHER_PIN = '1234';
