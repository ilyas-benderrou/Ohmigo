/**
 * Vidéo d'introduction (≈ 1 min) en deux segments.
 * Les scripts sont des propositions à valider par l'équipe pédagogique.
 * Pour brancher la vraie vidéo, renseigner `INTRO_VIDEO.videoUrl` (MP4 ou WebM).
 */
export interface VideoSegment {
  id: 'serie' | 'parallele';
  title: string;
  start: number;
  end: number;
  script: string;
  /** Formule clé du segment (LaTeX). */
  formula: string;
}

export const INTRO_VIDEO = {
  id: 'intro',
  title: 'Résistances en série et en parallèle',
  videoUrl: '',
  segments: [
    {
      id: 'serie',
      title: 'Montage en série',
      start: 0,
      end: 30,
      script:
        "En série, les résistances sont branchées l'une après l'autre : le courant n'a qu'un seul chemin et traverse chacune d'elles. Les résistances s'additionnent : $R_{eq}$ est donc plus grande que chacune des résistances.",
      formula: 'R_{eq} = R_1 + R_2 + R_3',
    },
    {
      id: 'parallele',
      title: 'Montage en parallèle',
      start: 30,
      end: 60,
      script:
        "En parallèle, les résistances sont branchées entre les deux mêmes nœuds : le courant se divise entre les branches. On additionne les inverses, puis on inverse le résultat : $R_{eq}$ est plus petite que la plus petite des résistances.",
      formula: '\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}',
    },
  ] satisfies VideoSegment[],
};

export const segmentVideoId = (id: VideoSegment['id']): string => `intro-${id}`;
