# Changelog

## 1.1.0 (2026-08-03)

### Ajoute
- Bouton « ℹ️ Comment ce jeu a été fait » sur l'écran titre, ouvrant une modale avec la
  stack, les graphismes, la musique (chaque niveau a sa propre tonalité et sa propre
  progression d'accords), les interactions, l'architecture et les algorithmes notables (5
  niveaux chronométrés avec obstacles et power-ups qui s'intensifient progressivement).
  Étape 15 du chantier de retrofit décrit dans `todo.md` racine du monorepo.

### Corrige
- 9 tirets longs (écran titre, écran crédits, libellé de niveau en jeu, commentaires de
  code) remplacés par des deux-points, virgules ou points médians, en conformité avec la
  règle du dépôt.
- **Ce dossier source n'avait pas non plus son propre dépôt Git**, malgré un jeu de docs
  complet déjà en place. Corrigé en créant
  [github.com/Hylst/hylstrunner](https://github.com/Hylst/hylstrunner).

### Verifie
- Build propre, modale testée à l'ouverture/fermeture, aucune erreur console, aucun 404
  (favicon hashé recopié avec le nouveau `index.html`), aucun débordement horizontal en
  390×844.

## 1.0.0 (2026-07-25)

- Intégration initiale dans Hylst.Games
- Build singlefile
- SEO complet (og/twitter/canonical)
- Favicon et OG image
