# OHMIGO — Cahier des charges pour Claude Code

> **Instruction pour Claude Code :** lis ce fichier en entier, puis construis **toute l'application, les 7 phases d'un seul coup, sans t'arrêter pour demander ma validation**. Je n'ai pas le temps de suivre chaque étape. Suis l'ordre de la section 12. À la fin de chaque phase, vérifie toi-même que `npm run dev` démarre et que `npm test` passe, corrige les erreurs, puis enchaîne directement sur la phase suivante. Si un point est ambigu, fais le choix le plus raisonnable, note-le dans `DECISIONS.md` et continue. Ne t'arrête que si tu es vraiment bloqué. À la toute fin, donne-moi un résumé court et les commandes pour lancer l'app.

---

## 1. Présentation

**Ohmigo** est une application web éducative, intelligente et adaptative, destinée aux élèves du lycée technique (bac STE / STM) pour maîtriser le **calcul de la résistance équivalente** (montages série, parallèle, mixte et cas particuliers).

- L'élève regarde une courte vidéo, puis **analyse des schémas électriques** de difficulté croissante (facile → moyen → difficile).
- Il résout **étape par étape** : il identifie le montage, regroupe les résistances, calcule, et le schéma se simplifie sous ses yeux.
- L'application **diagnostique le type d'erreur** et répond de façon ciblée : indice → micro-vidéo → exercice de remédiation → alerte au professeur.
- Le professeur suit chaque élève et la classe via un **tableau de bord**.

Slogan : *Ohmigo – Ton compagnon intelligent pour maîtriser les résistances.*

Projet réalisé dans le cadre du master « Système éducatif intelligent et communicant » (ENS Fès).

---

## 2. Principes pédagogiques (non négociables)

1. **Ne jamais donner la réponse finale** à l'élève, même après plusieurs erreurs.
2. **Les exercices sont toujours des schémas** : l'élève doit reconnaître lui-même s'il s'agit d'un montage série, parallèle ou mixte. Jamais d'énoncé du type « R1 et R2 sont en série, calcule ».
3. **Valeurs aléatoires** à chaque tentative (jamais le même exercice avec les mêmes valeurs).
4. **Résultats « propres »** : les valeurs sont choisies pour que Req tombe juste (ex. 2 Ω, 3,6 Ω, 4 Ω), pas 2,857 Ω.
5. **Aide progressive (scaffolding)** : indice d'abord, vidéo ensuite, professeur en dernier.
6. **Feedback positif et précis** : « Ta méthode est juste, revois le calcul des fractions » plutôt que « Faux ».
7. Pas de note négative visible, pas de classement entre élèves.
8. L'élève ne reste jamais bloqué indéfiniment : après 3 échecs sur la même erreur, le professeur est alerté et l'élève revient au niveau précédent.
9. **Le contenu pédagogique (indices, vidéos) est rédigé et validé par l'équipe**, pas généré librement par une IA. L'« intelligence » du système = **diagnostic + choix de la bonne aide**.

---

## 3. Stack technique

- **React + Vite + TypeScript**
- **Tailwind CSS**
- **Vitest** pour les tests (obligatoires sur le moteur de circuits et le diagnostic)
- **Schémas en SVG** générés par code (pas d'images statiques)
- **Persistance :** une couche d'accès aux données abstraite (`src/data/repository.ts`).
  - V1 : `localStorage` avec des données de démo (doit marcher sans aucune configuration).
  - V2 (plus tard) : Firebase (Auth + Firestore), en changeant seulement l'implémentation du repository.
- L'app doit tourner sur **Windows** avec `npm install` puis `npm run dev`.
- Interface en **français**, responsive (PC + téléphone).

---

## 4. Rôles et écrans

### 4.1 Connexion
- Élève : prénom + nom + code de classe (ex. `1STE-A`). Pas de mot de passe en V1.
- Professeur : code PIN (V1 : `1234`, configurable).
- Données de démo : 1 classe, 8 élèves fictifs avec un historique varié (pour montrer le tableau de bord).

### 4.2 Espace élève
1. **Accueil** : progression (niveau atteint, compétences C1–C6 en barres de couleur), bouton « Continuer ».
2. **Vidéo d'introduction** (≈ 1 min) en 2 segments : série (0:00–0:30), parallèle (0:30–1:00). Lecteur avec chapitres ; l'app peut lancer un seul segment.
3. **Question de compréhension** après la vidéo (schéma simple : série ou parallèle ?). Si faux → revoir le segment concerné.
4. **Exercices** par niveau (voir sections 5 et 6).
5. **Bilan** de fin de session : niveaux validés, compétences, erreurs corrigées.

### 4.3 Espace professeur (tableau de bord)
- **Vue classe** : liste des élèves (niveau, compétences C1–C6 en couleur, dernière activité, alerte éventuelle).
- **Erreurs fréquentes de la classe** : graphique en barres par code d'erreur (ex. « E3 : 65 % des élèves »).
- **Fiche élève** : historique des tentatives, erreurs répétées, temps passé, vidéos revues, courbe de progression.
- **Alertes** : « Youssef bloqué sur E6 (court-circuit) – 3 échecs ».
- **Actions** : débloquer / faire passer un élève de niveau, réinitialiser sa progression, laisser un message à l'élève.
- **Export CSV** des résultats (utile pour l'expérimentation du mémoire).

---

## 5. Moteur de circuits

### 5.1 Représentation
Deux représentations :

1. **Arbre série-parallèle** pour les circuits classiques :
   ```ts
   type Node =
     | { kind: 'R'; id: string; value: number | 'unknown' }
     | { kind: 'S'; children: Node[] }   // série
     | { kind: 'P'; children: Node[] };  // parallèle
   ```
2. **Netlist** (nœuds + résistances + fils) pour les cas particuliers qui ne sont pas des arbres (pont de Wheatstone, court-circuit). Ces cas ont une étape spéciale de simplification qui les transforme en arbre.

### 5.2 Rendu SVG
- Rendu automatique récursif d'un arbre : série = chaîne horizontale, parallèle = branches empilées verticalement, bornes A et B visibles.
- Chaque résistance = rectangle normalisé avec son nom et sa valeur (ex. `R3 = 6 Ω`).
- Variantes de présentation pour éviter la reconnaissance « par la forme » : orientation horizontale/verticale, miroir, ordre des branches mélangé, schéma « redessiné » (même circuit, positions différentes — c'est un point demandé par le professeur).
- Les cas spéciaux (Wheatstone, court-circuit, Req entre deux autres points) ont un **layout prédéfini** avec coordonnées.
- Option d'affichage des **nœuds en couleur** (utilisée dans les indices E5).

### 5.3 Calculs
- `reqOf(tree)` exact. Utiliser des **fractions exactes** (numérateur/dénominateur) en interne, pas des flottants, pour éviter les erreurs d'arrondi.
- Tolérance de saisie : accepter `2`, `2.0`, `2,0`, et une tolérance relative de 1 % pour les décimales.
- Unités : Ω et kΩ.

### 5.4 Réduction interactive (cœur de l'interactivité)
L'élève simplifie le circuit étape par étape :
1. Il **clique sur 2 résistances ou plus** pour les sélectionner.
2. Il choisit **« Série »** ou **« Parallèle »**.
3. Il **saisit la valeur** équivalente du groupe.
4. Si c'est correct, le schéma est **redessiné** avec une seule résistance (ex. `R12 = 4 Ω`) à la place du groupe, avec une petite animation.
5. Il recommence jusqu'à ce qu'il ne reste qu'une résistance → Req.

Validation topologique :
- Un groupe « série » est valide si les résistances sont enfants consécutifs d'un même nœud `S`.
- Un groupe « parallèle » est valide si les résistances sont enfants d'un même nœud `P` (sous-ensemble autorisé).
- Cas spéciaux : actions dédiées « Supprimer la résistance court-circuitée » et « Pont équilibré : retirer la résistance centrale » (valides seulement si la condition physique est vraie).

Chaque action (sélection, type choisi, valeur saisie, temps) est **enregistrée** pour le diagnostic.

Mode « réponse directe » optionnel au niveau facile : l'élève peut taper Req directement ; si faux, l'app lui demande de passer en mode étape par étape.

---

## 6. Banque d'exercices (gabarits)

Chaque exercice est un **gabarit** : structure fixe + générateur de valeurs qui garantit un résultat propre + liste des erreurs qu'il teste.

```ts
interface ExerciseTemplate {
  id: string;
  level: 'facile' | 'moyen' | 'difficile';
  competences: ('C1'|'C2'|'C3'|'C4'|'C5'|'C6')[];
  testsErrors: ErrorCode[];
  generate(rng): ExerciseInstance;   // valeurs aléatoires, Req propre
}
```

### Niveau facile (C1, C2, C3)
| ID | Description | Exemple de référence |
|---|---|---|
| F1 | 3–4 résistances en série | 10 + 22 + 47 + 21 = **100 Ω** |
| F2 | 3 résistances en parallèle | 12 // 6 // 4 → 1/12 + 2/12 + 3/12 = 6/12 → **2 Ω** |
| F3 | n résistances identiques en parallèle (R/n) | 4 × 20 Ω → **5 Ω** |
| F4 | Série ou parallèle dessiné de façon inhabituelle (vertical, redessiné) | — |
| F5 | Même circuit avec valeurs en kΩ | — |

### Niveau moyen (C4)
| ID | Description | Exemple de référence |
|---|---|---|
| M1 | (R1 + R2) // R3, puis série R4 | (4 + 8) // 6 = 4 ; 4 + 5 = **9 Ω** |
| M2 | Deux blocs parallèles en série, le tout en parallèle avec R5 | (6//3) + (12//4) = 5 ; 5 // 20 = **4 Ω** |
| M3 | R1 en série avec (R2 // (R3 + R4)) | — |
| M4 | Mixte à deux niveaux dessiné « en désordre » | — |

### Niveau difficile (C5, C6)
| ID | Description | Exemple de référence |
|---|---|---|
| D1 | **Court-circuit caché** : un fil met une résistance hors circuit | 6 // 3 avec 100 Ω court-circuitée → **2 Ω** |
| D2 | **Réseau en échelle** (2–3 échelons), se calcule depuis l'extrémité | 2 + (4 // (2 + (4 // 4))) → **4 Ω** |
| D3 | **Pont de Wheatstone équilibré** (R1/R2 = R3/R4) | (2 + 4) // (3 + 6) = **3,6 Ω**, la 10 Ω centrale est retirée |
| D4 | **Problème inverse** : Req donnée, trouver R | (R // 12) + 4 = 7 → **R = 4 Ω** |
| D5 | Req entre deux autres points (C et D) d'un même circuit | — |
| D6 | Circuit mixte complexe (5–6 résistances) à redessiner | — |

**Tests unitaires obligatoires** : chaque exemple de référence ci-dessus doit donner exactement le résultat indiqué, et chaque générateur doit produire 1000 instances valides avec un Req propre.

---

## 7. Diagnostic des erreurs (le « cerveau »)

### 7.1 Deux sources de diagnostic
1. **Au niveau des étapes** (réduction interactive) : groupe invalide, mauvais type choisi, mauvaise valeur pour un groupe correct.
2. **Au niveau de la réponse finale** : comparer la réponse aux **distracteurs** calculés automatiquement pour l'instance (réponses fausses typiques).

Exemple pour M1 (bonne réponse 9 Ω) :
| Réponse | Diagnostic |
|---|---|
| 23 Ω | E2 – tout additionné |
| 5,25 Ω | E3 – oubli d'inverser 1/Req |
| 12,43 Ω | E5 – mauvais regroupement |
| autre | E0 si trop rapide, sinon demander la résolution par étapes |

### 7.2 Base des erreurs
Stocker dans `src/content/errors.ts`. Chaque erreur a : code, nom, règle de détection, indice (texte), vidéo (id + segment), gabarit de remédiation, compétence liée.

| Code | Erreur | Détection | Indice (1re fois) | Contenu de la micro-vidéo (30–45 s) | Compétence |
|---|---|---|---|---|---|
| E0 | Réponse au hasard | < 10 s ou ne correspond à aucun distracteur | « Résous-le étape par étape pour qu'on voie ton raisonnement. » | — (passage forcé en mode étapes) | — |
| E1 | Confusion série / parallèle | Mauvais type choisi pour un groupe | « Suis le courant : se divise-t-il ou passe-t-il par un seul chemin ? » | Courant animé : un seul chemin = série ; il se divise = parallèle | C1 |
| E2 | Parallèle additionné comme série | Réponse = somme | « Req doit-elle être plus grande ou plus petite que la plus petite résistance ? » | Deux chemins = passage plus facile → Req < plus petite R | C3 |
| E3 | Oubli d'inverser 1/Req | Réponse = 1/Req | « As-tu calculé Req ou 1/Req ? » | Calcul pas à pas, cadre rouge sur l'inversion finale | C3 |
| E4 | Produit/somme appliqué à 3 résistances | Réponse = (R1·R2·R3)/(R1+R2+R3) | « Cette formule ne marche que pour 2 résistances. » | Pourquoi seulement 2 ; méthode pour 3 | C3 |
| E5 | Mauvais regroupement | Groupe topologiquement invalide | « Ces résistances sont-elles entre les mêmes deux nœuds ? » | Nœuds colorés : même paire de couleurs = parallèle | C4 |
| E6 | Court-circuit non vu | Résistance court-circuitée incluse dans le calcul | « Regarde le fil : que fait le courant face à un chemin sans résistance ? » | Le courant prend le fil, la résistance « s'éteint » et disparaît | C5 |
| E7 | Pont équilibré non reconnu | Résistance centrale incluse | « Compare R1/R2 et R3/R4. » | Rapports égaux → même potentiel en C et D → pas de courant → on la retire | C5 |
| E8 | Échelle prise par le mauvais bout | Réduction commencée côté A | « Commence par l'extrémité la plus éloignée de A. » | L'échelle se simplifie de droite à gauche, échelon par échelon | C5 |
| E9 | Erreur de calcul (fractions) | Bonne méthode, mauvaise valeur | « Ta méthode est juste, revérifie le calcul des fractions. » | Rappel du dénominateur commun | C2/C3 |
| E10 | Erreur d'unité | Réponse ×1000 ou ÷1000 | « Vérifie l'unité : Ω ou kΩ ? » | 1 kΩ = 1000 Ω, exemple | C2 |
| E11 | Équation mal posée (problème inverse) | R trouvée correspond à une équation fausse typique | « Que reste-t-il pour la partie parallèle après avoir retiré la résistance en série ? » | Poser et résoudre l'équation pas à pas | C6 |

Les vidéos n'existent pas encore : utiliser des **placeholders** (carte « Vidéo E3 – à venir » + le texte du script), avec un champ `videoUrl` facile à remplir plus tard.

---

## 8. Modèle de l'apprenant

Pour chaque élève, stocker :
- **Maîtrise par compétence** C1 à C6 (score 0–100, mis à jour à chaque tentative ; ex. +15 si réussi, −10 si erreur liée, borné 0–100) :
  - C1 : identifier le type de montage
  - C2 : calculer en série
  - C3 : calculer en parallèle
  - C4 : décomposer un circuit mixte
  - C5 : cas particuliers (court-circuit, pont, échelle)
  - C6 : problème inverse
- **Historique des tentatives** : exercice, valeurs, étapes, réponse, erreur(s) détectée(s), temps, indices et vidéos utilisés.
- **Compteur d'erreurs par code**.
- Niveau courant, alertes actives.

---

## 9. Règles d'adaptation

| Situation | Action |
|---|---|
| 3 exercices réussis d'affilée dans le niveau (dont au moins 2 sans indice) | Passage au niveau suivant |
| 1re erreur | Indice lié au code d'erreur, puis nouvelle tentative sur le même exercice |
| 2e fois la même erreur | Micro-vidéo de l'erreur → exercice de remédiation (même gabarit, nouvelles valeurs) |
| 3e fois la même erreur | Alerte professeur + retour au niveau précédent sur la compétence concernée |
| Réussite mais temps très long | Un exercice de plus dans le même niveau avant de passer |
| Erreur corrigée | Réinsérer un exercice de ce type 2–3 exercices plus tard (**révision espacée**) |
| Le choix de l'exercice suivant | Privilégier le gabarit qui travaille la compétence la plus faible du niveau |

Toutes les constantes (seuils, nombre d'essais) dans un fichier `src/config/adaptive.ts` pour pouvoir les ajuster.

---

## 10. Design

- Style propre et sérieux (lycée technique), pas enfantin. Couleur principale : bleu électrique ; accent jaune pour le courant.
- Code couleur constant : courant = jaune, nœuds = couleurs distinctes, erreur = orange (pas rouge agressif), réussite = vert.
- Schémas lisibles sur téléphone (zoom possible).
- Petite mascotte / logo « Ω » souriant pour Ohmigo (simple, original, en SVG).

---

## 11. Ce qu'il ne faut PAS faire
- Pas de réponse donnée à l'élève.
- Pas d'exercice répété avec les mêmes valeurs.
- Pas de vidéo complète imposée quand un segment suffit.
- Pas de jugement uniquement sur la réponse finale.
- Pas de texte pédagogique généré par une IA sans validation.
- Pas de classement entre élèves, pas de note négative.
- Pas de données personnelles inutiles (les élèves sont mineurs) : prénom, nom, classe, c'est tout.
- Ne pas ajouter d'autres leçons tant que celle-ci n'est pas complète.

---

## 12. Plan de construction (phases)

1. **Phase 1 – Socle** : projet Vite + React + TS + Tailwind, routing, repository localStorage, données de démo, connexion élève/prof.
2. **Phase 2 – Moteur de circuits** : arbre, fractions exactes, `reqOf`, rendu SVG, gabarits F1–F5 et M1–M4, tests Vitest.
3. **Phase 3 – Parcours élève** : vidéo (placeholder avec segments), question de compréhension, exercices, réduction interactive.
4. **Phase 4 – Diagnostic & adaptation** : distracteurs, base des erreurs E0–E11, indices, micro-vidéos (placeholders), règles de la section 9, modèle de l'apprenant.
5. **Phase 5 – Niveau difficile** : D1–D6 (netlist + layouts spéciaux + actions spéciales).
6. **Phase 6 – Tableau de bord professeur** : vue classe, fiche élève, erreurs fréquentes, alertes, export CSV.
7. **Phase 7 – Finitions** : design, responsive, accessibilité, README d'installation en français.

À chaque phase : `npm run dev` fonctionne et `npm test` passe, puis tu continues sans attendre. Un seul résumé à la fin de la phase 7.
