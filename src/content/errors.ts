import type { Competence, ErrorCode } from '../engine/types';

/**
 * Base des erreurs (section 7.2).
 * Contenu pédagogique rédigé et validé par l'équipe : les indices et scripts reprennent le cahier des charges.
 * Pour brancher une vraie vidéo, il suffit de renseigner `video.videoUrl`.
 */
export interface MicroVideo {
  id: string;
  title: string;
  /** Script de la micro-vidéo (30–45 s), affiché tant que la vidéo n'existe pas. */
  script: string;
  /** URL de la vidéo (vide = placeholder « à venir »). */
  videoUrl: string;
  /** Formule clé affichée en LaTeX sous le script. */
  formula?: string;
  /** Segment éventuel de la vidéo à lire (en secondes). */
  segment?: { start: number; end: number };
}

export interface ErrorInfo {
  code: ErrorCode;
  name: string;
  /** Règle de détection (documentation, appliquée dans engine/diagnostic.ts). */
  detection: string;
  /** Indice donné à la 1re occurrence. */
  hint: string;
  /** Micro-vidéo proposée à la 2e occurrence (null = passage forcé en mode étapes). */
  video: MicroVideo | null;
  /** Gabarit de remédiation : même gabarit, nouvelles valeurs (section 9). */
  remediation: string;
  competences: Competence[];
}

const video = (code: ErrorCode, title: string, script: string, formula?: string): MicroVideo => ({
  id: `micro-${code}`,
  title,
  script,
  formula,
  videoUrl: '',
});

export const ERRORS: Record<ErrorCode, ErrorInfo> = {
  E0: {
    code: 'E0',
    name: 'Réponse au hasard',
    detection: 'Réponse donnée en moins de 10 s, ou ne correspondant à aucun distracteur.',
    hint: "Résous-le étape par étape pour qu'on voie ton raisonnement.",
    video: null,
    remediation: 'Passage forcé en mode étape par étape sur le même gabarit.',
    competences: [],
  },
  E1: {
    code: 'E1',
    name: 'Confusion série / parallèle',
    detection: 'Mauvais type choisi pour un groupe de résistances.',
    hint: 'Suis le courant : se divise-t-il ou passe-t-il par un seul chemin ?',
    video: video(
      'E1',
      'Série ou parallèle ? Suis le courant',
      "Le courant est animé en jaune. Quand il n'a qu'un seul chemin et traverse les résistances l'une après l'autre, elles sont en série. Quand il arrive à un nœud et se divise en plusieurs branches qui se rejoignent ensuite, ces branches sont en parallèle.",
    ),
    remediation: 'Même gabarit, nouvelles valeurs, présentation différente.',
    competences: ['C1'],
  },
  E2: {
    code: 'E2',
    name: 'Parallèle additionné comme une série',
    detection: 'Réponse égale à la somme des résistances.',
    hint: '$R_{eq}$ doit-elle être plus grande ou plus petite que la plus petite résistance ?',
    video: video(
      'E2',
      'Deux chemins, passage plus facile',
      "Ouvrir un deuxième chemin au courant, c'est comme ouvrir une deuxième porte : le passage devient plus facile. La résistance équivalente d'un groupe en parallèle est donc toujours plus petite que la plus petite des résistances du groupe.",
      'R_{eq} < \\min(R_1, R_2, \\dots)',
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C3'],
  },
  E3: {
    code: 'E3',
    name: "Oubli d'inverser 1/Req",
    detection: 'Réponse égale à 1/Req (somme des inverses non inversée).',
    hint: 'As-tu calculé $R_{eq}$ ou $\\dfrac{1}{R_{eq}}$ ?',
    video: video(
      'E3',
      "La dernière étape : l'inversion",
      "On reprend le calcul pas à pas : on additionne les inverses $\\frac{1}{R_1} + \\frac{1}{R_2} + \\dots$ On obtient $\\frac{1}{R_{eq}}$, pas $R_{eq}$. Un cadre rouge entoure l'étape finale : il faut inverser le résultat pour trouver $R_{eq}$.",
      '\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3} \\;\\Rightarrow\\; \\boxed{R_{eq} = \\dfrac{1}{\\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}}}',
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C3'],
  },
  E4: {
    code: 'E4',
    name: 'Produit/somme appliqué à 3 résistances',
    detection: 'Réponse égale à $\\dfrac{R_1 R_2 R_3}{R_1 + R_2 + R_3}$.',
    hint: 'Cette formule ne marche que pour 2 résistances.',
    video: video(
      'E4',
      'Produit sur somme : seulement pour 2',
      "La formule $\\frac{R_1 R_2}{R_1 + R_2}$ vient de $\\frac{1}{R_1} + \\frac{1}{R_2}$ : elle n'est valable que pour deux résistances. Pour trois, on additionne les trois inverses, ou on regroupe d'abord deux résistances, puis on associe le résultat avec la troisième.",
      'R_{eq} = \\frac{R_1 R_2}{R_1 + R_2} \\quad \\text{(2 résistances seulement)}',
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C3'],
  },
  E5: {
    code: 'E5',
    name: 'Mauvais regroupement',
    detection: 'Groupe topologiquement invalide (résistances qui ne sont pas entre les mêmes nœuds).',
    hint: 'Ces résistances sont-elles entre les mêmes deux nœuds ?',
    video: video(
      'E5',
      'Les nœuds en couleur',
      "Chaque nœud du schéma reçoit une couleur. Deux résistances branchées entre la même paire de couleurs sont en parallèle. Deux résistances qui se suivent, reliées par un nœud où rien d'autre n'est branché, sont en série.",
    ),
    remediation: 'Même gabarit, nouvelles valeurs, nœuds colorés.',
    competences: ['C4'],
  },
  E6: {
    code: 'E6',
    name: 'Court-circuit non vu',
    detection: 'Résistance court-circuitée incluse dans le calcul.',
    hint: 'Regarde le fil : que fait le courant face à un chemin sans résistance ?',
    video: video(
      'E6',
      'Le courant prend le fil',
      "Face à un fil sans résistance, le courant passe entièrement par le fil. La résistance qui est en parallèle avec ce fil ne reçoit plus de courant : elle « s'éteint » et disparaît du schéma.",
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C5'],
  },
  E7: {
    code: 'E7',
    name: 'Pont équilibré non reconnu',
    detection: 'Résistance centrale du pont incluse dans le calcul.',
    hint: 'Compare $\\dfrac{R_1}{R_2}$ et $\\dfrac{R_3}{R_4}$.',
    video: video(
      'E7',
      'Le pont équilibré',
      "Quand $\\frac{R_1}{R_2} = \\frac{R_3}{R_4}$, les points C et D sont au même potentiel. Aucun courant ne traverse la résistance centrale : on peut la retirer, et il reste deux branches simples en parallèle.",
      '\\frac{R_1}{R_2} = \\frac{R_3}{R_4} \\;\\Rightarrow\\; R_{eq} = (R_1 + R_2) \\,/\\!/\\, (R_3 + R_4)',
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C5'],
  },
  E8: {
    code: 'E8',
    name: 'Échelle prise par le mauvais bout',
    detection: 'Réduction commencée du côté de la borne A.',
    hint: "Commence par l'extrémité la plus éloignée de A.",
    video: video(
      'E8',
      "L'échelle, de droite à gauche",
      "Dans un réseau en échelle, seules les résistances du dernier échelon sont directement associables. On simplifie donc de l'extrémité vers A, échelon par échelon, jusqu'à n'avoir plus qu'une résistance.",
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C5'],
  },
  E9: {
    code: 'E9',
    name: 'Erreur de calcul (fractions)',
    detection: 'Bonne méthode, mauvaise valeur.',
    hint: 'Ta méthode est juste, revérifie le calcul des fractions.',
    video: video(
      'E9',
      'Rappel : le dénominateur commun',
      "Pour additionner $\\frac{1}{12} + \\frac{1}{6} + \\frac{1}{4}$, on écrit toutes les fractions avec le même dénominateur. On simplifie, puis on n'oublie pas d'inverser.",
      '\\frac{1}{12} + \\frac{1}{6} + \\frac{1}{4} = \\frac{1}{12} + \\frac{2}{12} + \\frac{3}{12} = \\frac{6}{12} \\;\\Rightarrow\\; R_{eq} = \\frac{12}{6} = 2\\,\\Omega',
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C2', 'C3'],
  },
  E10: {
    code: 'E10',
    name: "Erreur d'unité",
    detection: 'Réponse multipliée ou divisée par 1000.',
    hint: 'Vérifie l’unité : Ω ou kΩ ?',
    video: video(
      'E10',
      'Ω et kΩ',
      "Par exemple 4,7 kΩ = 4700 Ω et 220 Ω = 0,22 kΩ. On peut calculer en kΩ du début à la fin, à condition d'écrire le résultat avec la bonne unité.",
      '1\\,\\mathrm{k}\\Omega = 1000\\,\\Omega',
    ),
    remediation: 'Même gabarit, nouvelles valeurs en kΩ.',
    competences: ['C2'],
  },
  E11: {
    code: 'E11',
    name: 'Équation mal posée (problème inverse)',
    detection: 'R trouvée correspondant à une équation fausse typique.',
    hint: 'Que reste-t-il pour la partie parallèle après avoir retiré la résistance en série ?',
    video: video(
      'E11',
      "Poser l'équation pas à pas",
      "On écrit d'abord que $R_{eq}$ est la somme de la partie en série et de la partie parallèle, puis on isole $R$ à la fin.",
      'R_p = R_{eq} - R_s \\quad\\text{puis}\\quad \\frac{1}{R} = \\frac{1}{R_p} - \\frac{1}{R_1}',
    ),
    remediation: 'Même gabarit, nouvelles valeurs.',
    competences: ['C6'],
  },
};

export const errorLabel = (code: ErrorCode): string => `${code} – ${ERRORS[code].name}`;
