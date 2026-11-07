# Ohmigo

*Ton compagnon intelligent pour maîtriser les résistances.*

Ohmigo est une application web éducative et adaptative pour les élèves du lycée technique (bac STE / STM). Elle porte sur le **calcul de la résistance équivalente** : montages série, parallèle, mixtes et cas particuliers.
Projet réalisé dans le cadre du master « Système éducatif intelligent et communicant » (ENS Fès).

---

## Installation (Windows, macOS, Linux)

Prérequis : **Node.js 22.22 ou plus récent** (testé avec Node 24). Vérifier avec `node -v`.

```bash
npm install
```

```bash
npm run dev
```

Ouvrir ensuite <http://localhost:5173> dans le navigateur. Aucune configuration n'est nécessaire : les données de démonstration sont créées automatiquement dans le navigateur (localStorage).

### Autres commandes

| Commande | Rôle |
|---|---|
| `npm test` | Lance tous les tests (moteur de circuits, gabarits, diagnostic, adaptation, données). |
| `npm run build` | Vérifie les types puis construit la version de production dans `dist/`. |
| `npm run preview` | Sert la version construite (après `npm run build`). |
| `npm run typecheck` | Vérification TypeScript seule. |

---

## Comptes de démonstration

- **Élève** : prénom + nom + code de classe `1STE-A`. Par exemple *Youssef Amrani* (bloqué sur le court-circuit), *Salma Benali* (leçon validée), *Nour Fassi* (débutante). Un nom inconnu crée un nouvel élève dans la classe.
- **Professeur** : code PIN `1234` (modifiable dans *Tableau de bord → Réglages*).
- Le lien **« Réinitialiser les données de démo »**, sur la page de connexion, remet la base dans son état initial.

---

## Ce que fait l'application

### Espace élève
1. **Accueil** : niveau atteint, compétences C1–C6 en barres de couleur, messages du professeur, bouton « Continuer ».
2. **Vidéo d'introduction** en deux segments (série 0:00–0:30, parallèle 0:30–1:00), avec chapitres. Un segment peut être lu seul.
3. **Question de compréhension** : série ou parallèle ? En cas d'erreur, l'élève revoit uniquement le segment concerné.
4. **Exercices** sous forme de schémas, du niveau facile au niveau difficile. L'énoncé ne dit jamais de quel type de montage il s'agit.
   - Réduction interactive : l'élève clique sur des résistances, choisit « En série » ou « En parallèle », saisit la valeur, et le schéma se redessine (ex. `R12 = 4 Ω`).
   - Cas particuliers (niveau difficile) : « Supprimer la résistance court-circuitée » et « Pont équilibré : retirer la résistance centrale ».
   - Au niveau facile, l'élève peut répondre directement. Si sa réponse est fausse, il passe en mode étape par étape.
5. **Bilan** de session : niveaux validés, compétences travaillées, erreurs corrigées. Ni note ni classement.

### Diagnostic et aide progressive
- Chaque action est diagnostiquée : mauvais type (E1), mauvais regroupement (E5), court-circuit (E6), pont (E7), échelle (E8), erreurs de calcul (E2, E3, E4, E9, E10), problème inverse (E11), réponse au hasard (E0).
- 1re erreur → **indice**. 2e fois la même erreur → **micro-vidéo** puis exercice de **remédiation** (même gabarit, nouvelles valeurs). 3e fois → **alerte au professeur** et retour au niveau précédent.
- Une erreur corrigée fait revenir le même type d'exercice 2 à 3 exercices plus tard (révision espacée).
- La réponse finale n'est jamais donnée.

### Espace professeur
- **Vue classe** : niveau, compétences C1–C6 en couleur, dernière activité, alertes.
- **Erreurs fréquentes** : % des élèves concernés par chaque code d'erreur.
- **Fiche élève** : historique détaillé (valeurs, étapes, erreurs, temps), erreurs répétées, vidéos revues, courbe de progression.
- **Actions** : débloquer, changer de niveau, réinitialiser la progression, laisser un message.
- **Export CSV** (séparateur `;`, compatible Excel) : tentatives détaillées et synthèse par élève.
- **Banque d'exercices** : aperçu de chaque gabarit avec une instance aléatoire, la réponse et les distracteurs.

---

## Organisation du code

```
src/
  config/adaptive.ts        Constantes d'adaptation (seuils, paliers d'aide, tolérance…)
  content/                  Contenu pédagogique validé par l'équipe
    errors.ts               Base des erreurs E0–E11 (indices, scripts des micro-vidéos, compétences)
    videos.ts               Vidéo d'introduction (segments + scripts)
    feedback.ts             Messages de feedback et indices généraux
    templates/              Gabarits F1–F5, M1–M4, D1–D6 (+ question de compréhension)
  engine/                   Cœur « intelligent » (pur TypeScript, testé)
    fraction.ts             Fractions exactes
    tree.ts                 Arbre série-parallèle, validation et fusion des groupes
    netlist.ts              Netlist + analyse nodale exacte (pont de Wheatstone…)
    layout.ts               Calcul des schémas SVG (auto + layouts prédéfinis)
    diagnostic.ts           Distracteurs et diagnostic des étapes
    adaptive.ts             Modèle de l'apprenant et règles d'adaptation
    reduction.ts            Actions de la réduction interactive
  data/
    repository.ts           Interface d'accès aux données (abstraite)
    localStorageRepository.ts  Implémentation V1 (localStorage)
    demo.ts                 Données de démonstration (simulées avec le vrai moteur)
    analytics.ts            Statistiques du tableau de bord, bilan, export CSV
  components/, pages/       Interface React (Tailwind CSS)
```

### Formules mathématiques (LaTeX)
Les formules sont affichées en LaTeX grâce à KaTeX, qui fonctionne hors ligne : indices, scripts des vidéos, formule clé de chaque segment, énoncés ($R_{eq}$), et formule de chaque étape réussie (par exemple $\frac{1}{R_{23}} = \frac{1}{30} + \frac{1}{15} \Rightarrow R_{23} = 10\,\Omega$).

Dans les fichiers de `src/content/`, une formule s'écrit entre dollars : `'As-tu calculé $R_{eq}$ ou $\\dfrac{1}{R_{eq}}$ ?'`. Dans une chaîne JavaScript, l'antislash se double. Un test vérifie que toutes les formules du contenu sont valides.

## Rapport LaTeX

Le rapport technique du projet se trouve dans `docs/rapport/` : la source `ohmigo.tex` et le PDF compilé `ohmigo.pdf` (21 pages, avec figures circuitikz). Pour le recompiler (MiKTeX ou TeX Live) :

```bash
cd docs/rapport
```

```bash
latexmk -pdf ohmigo.tex
```

Les champs « Réalisé par » et « Encadré par » de la page de titre sont à compléter.

### Brancher les vraies vidéos
- Vidéo d'introduction : renseigner `INTRO_VIDEO.videoUrl` dans `src/content/videos.ts`. Les segments sont déjà définis.
- Micro-vidéos : renseigner `video.videoUrl` pour chaque erreur dans `src/content/errors.ts`.

Tant qu'une URL est vide, l'application affiche une carte « Vidéo à venir » avec le script.

### Passer à Firebase (V2)
Écrire une classe qui implémente l'interface `Repository` (`src/data/repository.ts`) avec Firebase Auth et Firestore, puis la renvoyer dans `createRepository()`. Le reste de l'application ne change pas.

---

## Choix et hypothèses

Les points ambigus du cahier des charges, et les choix faits pour chacun, sont listés dans [DECISIONS.md](DECISIONS.md).
