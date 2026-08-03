# Structure du projet

```
src/
├── main.tsx           # Point d'entrée
├── App.tsx            # Composant racine
├── index.css          # Styles globaux + Tailwind
├── components/        # Composants React
├── game/              # Logique de jeu
├── hooks/             # Hooks personnalisés
├── types/             # Types TypeScript
├── utils/             # Utilitaires
└── assets/            # Ressources statiques
```

Build livré dans `dist/` (fichier unique via vite-plugin-singlefile).
