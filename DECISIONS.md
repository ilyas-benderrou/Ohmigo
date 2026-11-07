# Décisions prises pendant la construction

Pour chaque point ambigu du cahier des charges, voici le choix retenu et sa raison. Tout est modifiable.

## Technique

1. **Versions** : React 19, React Router 8 (déjà présent dans `package.json`), Vite 8, Tailwind 4, Vitest 5, TypeScript 7. Le script `build` est devenu `tsc && vite build` (au lieu de `tsc -b`) car le projet n'a qu'un seul `tsconfig`.
2. **Routage par hash** (`HashRouter`, URLs en `#/…`) : l'app fonctionne sans configuration serveur, même ouverte depuis un hébergement statique.
3. **Arbre série-parallèle étendu** : le type `Node` du cahier des charges est conservé, avec trois ajouts :
   - un `id` sur chaque nœud ;
   - une `label` sur chaque résistance ;
   - une valeur en **fraction exacte** (`{n, d}`, en Ω) plutôt qu'un `number`.

   Une feuille `W` (fil, résistance nulle) a aussi été ajoutée pour représenter les courts-circuits.
4. **Netlist** : elle sert au pont de Wheatstone, qui garde un état « netlist » jusqu'à l'action spéciale. Elle sert aussi aux tests de cohérence : une analyse nodale exacte doit donner le même Req que l'arbre. Le court-circuit (D1) et « Req entre C et D » (D5) se ramènent directement à un arbre. Ils ont un *layout prédéfini* mais pas d'état netlist, ce qui évite une étape artificielle.
5. **Valeurs en kΩ** : toutes les valeurs sont stockées en Ω. L'unité de l'exercice ne sert qu'à l'affichage. L'élève choisit l'unité de sa réponse (Ω/kΩ), ce qui permet de détecter E10.
6. **Résultat « propre »** : au plus une décimale dans l'unité affichée (dénominateur qui divise 10 : 2 Ω, 2,5 Ω, 3,6 Ω). Pour les circuits mixtes, *chaque sous-bloc* doit aussi être propre, donc chaque étape de calcul tombe juste.
7. **Données de démo** : elles sont générées en simulant le vrai moteur adaptatif (graine fixe, déterministe). Les historiques respectent donc les règles de l'application. Youssef et Omar finissent avec une alerte active.

## Pédagogie et règles

8. **« Valeurs aléatoires à chaque tentative » et « nouvelle tentative sur le même exercice » (1re erreur)** : après un indice, l'élève corrige *son étape* sur le même exercice. Chaque *nouvel exercice* (y compris la remédiation) a de nouvelles valeurs. L'app vérifie aussi que l'élève n'a jamais eu les mêmes valeurs sur ce gabarit.
9. **Groupe série** : il faut des enfants *consécutifs* d'un même nœud S, comme indiqué au §5.4. Deux résistances en série mais non adjacentes sur le schéma donnent E5 (« Ces résistances sont-elles entre les mêmes deux nœuds ? »).
10. **E0** : appliqué à la réponse directe trop rapide (< 10 s) qui ne correspond à aucun distracteur (§7.1). Une réponse inconnue mais réfléchie ne reçoit pas de code : l'élève est simplement invité à résoudre étape par étape. E0 n'a pas de vidéo : à la 2e occurrence on redonne l'indice, à la 3e on alerte.
11. **Comptage « même erreur »** : un compteur par code pilote indice → vidéo → alerte. Il est remis à zéro quand l'élève réussit un exercice qui teste cette erreur *sans la commettre* (erreur corrigée), ou après l'alerte.
12. **Une réussite avec indice compte** dans la série de 3 réussites, mais il en faut au moins 2 sans indice. Un exercice abandonné pour une remédiation ou après une alerte casse la série.
13. **« Réussite très longue »** : au-delà de 4 min (facile), 7 min (moyen) ou 10 min (difficile), un exercice de plus est exigé avant de passer. Réglable dans `src/config/adaptive.ts`.
14. **Retour au niveau précédent après une alerte** : la compétence liée à l'erreur devient prioritaire si elle existe dans ce niveau. Sinon, on applique la règle de la compétence la plus faible.
15. **Choix de l'exercice suivant** : la compétence la plus faible du niveau est privilégiée dans 75 % des cas (réglable). Sinon, l'exercice est tiré au hasard dans le niveau, pour garder de la variété. Le même gabarit ne revient jamais deux fois de suite, sauf en remédiation.
16. **Révision espacée** : une erreur commise puis corrigée replanifie le même gabarit 2 ou 3 exercices plus tard. Il apparaît avec l'étiquette « Révision ». Une révision d'un niveau inférieur ne compte pas dans la série du niveau courant.
17. **Niveau difficile validé** : la leçon est marquée « validée ». L'élève reste au niveau difficile et peut continuer à s'entraîner.
18. **Actions spéciales** : les deux boutons « cas particuliers » sont visibles pour *tous* les exercices du niveau difficile. Les afficher seulement pour D1/D3 révélerait le piège. Une action invalide reçoit un message neutre (« cette résistance n'est pas court-circuitée ») sans code d'erreur.
19. **E8 (échelle)** : dans un réseau en échelle, un groupe invalide qui contient une résistance proche de A (profondeur ≤ 2 dans l'arbre) est classé E8 plutôt que E5.
20. **D4 (problème inverse)** : il se résout en deux étapes guidées (valeur de la partie qui contient R, puis R). L'étape 1 ne dit pas qu'il s'agit d'un parallèle.
21. **D5** : boucle de 4 résistances (A, C, B, D aux coins), mesure entre C et D. Le distracteur « Req entre A et B » est classé E5.
22. **Nœuds en couleur** : ils s'activent automatiquement avec l'indice E5. L'élève peut ensuite les afficher ou les masquer.
23. **Indice volontaire** (« Besoin d'un indice ? ») : un indice général du niveau, compté comme aide utilisée.

## Contenu

24. **Indices et scripts des micro-vidéos** : repris tels quels du cahier des charges (§7.2). Les **scripts de la vidéo d'introduction** et les **messages de feedback** sont des propositions *à valider par l'équipe* (`src/content/videos.ts`, `src/content/feedback.ts`). Aucun texte n'est généré par une IA à l'exécution.
25. **Vidéos** : ce sont des placeholders (« Vidéo à venir » + script). Le lecteur d'introduction simule la lecture pour que le parcours chapitres / segment seul soit testable.

## Données et vie privée

26. Seuls le prénom, le nom et la classe sont stockés. Pas de mot de passe élève en V1.
27. **« Réinitialiser la progression »** remet à zéro le modèle de l'apprenant et clôt ses alertes. L'**historique des tentatives est conservé**, car il sert à l'expérimentation du mémoire.
28. **Classes** : la classe de démo est `1STE-A`. Le professeur peut en ajouter d'autres (Réglages). Un élève ne peut se connecter qu'avec un code de classe existant.
29. **Ajout non demandé** : une page « Banque d'exercices » pour le professeur. Elle montre un aperçu de chaque gabarit avec la réponse et les distracteurs, ce qui aide à valider le contenu. Elle n'est pas accessible aux élèves.

## Formules et rapport

30. **Formules LaTeX (ajout demandé après coup)** : KaTeX plutôt que MathJax, parce qu'il est plus léger, rendu de façon synchrone et sans réseau. Les textes du contenu gardent leur formulation : seules les formules sont passées en LaTeX (`$R_{eq}$`, fractions). Les noms d'erreurs restent en texte brut, car ils servent aussi au CSV et aux infobulles.
31. **Formule d'une étape** : elle n'est affichée qu'*après* que l'élève a trouvé la bonne valeur. Elle ne donne donc jamais la réponse à l'avance.
32. **Rapport LaTeX** : `docs/rapport/ohmigo.tex` décrit la version actuelle du code (constantes, règles, tests). Les noms de l'auteur et de l'encadrant sont laissés « à compléter ».
