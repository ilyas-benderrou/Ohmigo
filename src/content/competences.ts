import type { Competence, Level } from '../engine/types';

export const COMPETENCE_LABELS: Record<Competence, string> = {
  C1: 'Identifier le type de montage',
  C2: 'Calculer en série',
  C3: 'Calculer en parallèle',
  C4: 'Décomposer un circuit mixte',
  C5: 'Cas particuliers (court-circuit, pont, échelle)',
  C6: 'Problème inverse',
};

export const LEVEL_LABELS: Record<Level, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};
