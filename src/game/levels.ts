// Level definitions and visual themes

export type LevelDef = {
  id: number;
  name: string;
  subtitle: string;
  duration: number; // seconds to clear the level
  // Visual theme
  bg: [string, string, string]; // gradient stops (top/mid/bottom)
  accent: string;
  glow: string;
  stars: { color: string; density: number; speed: number };
  // Gameplay tuning
  obstacleInterval: number; // ms between spawns at start
  minObstacleInterval: number; // min interval
  obstacleSpeed: number; // base px/s
  maxObstacleSpeed: number;
  obstacleTypes: ("asteroid" | "drone" | "missile" | "laser")[];
  powerupChance: number; // 0..1
  bpm: number;
  description: string;
};

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Nebula Drift",
    subtitle: "L'envol cosmique",
    duration: 40,
    bg: ["#0b0420", "#2a0a4a", "#4b1d7a"],
    accent: "#c084fc",
    glow: "#a855f7",
    stars: { color: "#e9d5ff", density: 1, speed: 40 },
    obstacleInterval: 1100,
    minObstacleInterval: 550,
    obstacleSpeed: 140,
    maxObstacleSpeed: 260,
    obstacleTypes: ["asteroid"],
    powerupChance: 0.08,
    bpm: 92,
    description: "Traversez la nébuleuse violette. Les astéroïdes sont lents mais nombreux."
  },
  {
    id: 2,
    name: "Cyber Grid",
    subtitle: "La grille numérique",
    duration: 45,
    bg: ["#020617", "#0c1a3a", "#0891b2"],
    accent: "#22d3ee",
    glow: "#06b6d4",
    stars: { color: "#67e8f9", density: 1.5, speed: 80 },
    obstacleInterval: 900,
    minObstacleInterval: 420,
    obstacleSpeed: 180,
    maxObstacleSpeed: 340,
    obstacleTypes: ["asteroid", "drone"],
    powerupChance: 0.09,
    bpm: 108,
    description: "La grille cybernétique s'active. Les drones traquent votre position."
  },
  {
    id: 3,
    name: "Solar Flare",
    subtitle: "L'éruption stellaire",
    duration: 50,
    bg: ["#1a0605", "#5a1205", "#f97316"],
    accent: "#fbbf24",
    glow: "#f59e0b",
    stars: { color: "#fde68a", density: 1.8, speed: 110 },
    obstacleInterval: 780,
    minObstacleInterval: 360,
    obstacleSpeed: 220,
    maxObstacleSpeed: 400,
    obstacleTypes: ["asteroid", "drone", "missile"],
    powerupChance: 0.1,
    bpm: 128,
    description: "Les éruptions solaires projettent des missiles à tête chercheuse."
  },
  {
    id: 4,
    name: "Abyssal Void",
    subtitle: "Le cœur de l'abîme",
    duration: 55,
    bg: ["#000000", "#0a0a1f", "#1e1b4b"],
    accent: "#a78bfa",
    glow: "#7c3aed",
    stars: { color: "#ffffff", density: 2.2, speed: 140 },
    obstacleInterval: 680,
    minObstacleInterval: 300,
    obstacleSpeed: 260,
    maxObstacleSpeed: 460,
    obstacleTypes: ["asteroid", "drone", "missile", "laser"],
    powerupChance: 0.11,
    bpm: 100,
    description: "Les lasers balaient l'espace. Restez en mouvement ou disparaissez."
  },
  {
    id: 5,
    name: "Hyper Core",
    subtitle: "La singularité",
    duration: 60,
    bg: ["#1e0033", "#6d28d9", "#ec4899"],
    accent: "#f0abfc",
    glow: "#d946ef",
    stars: { color: "#fef3c7", density: 3, speed: 180 },
    obstacleInterval: 560,
    minObstacleInterval: 220,
    obstacleSpeed: 320,
    maxObstacleSpeed: 540,
    obstacleTypes: ["asteroid", "drone", "missile", "laser"],
    powerupChance: 0.13,
    bpm: 140,
    description: "Le cœur de l'hyperespace. Survivez à la singularité finale."
  }
];
