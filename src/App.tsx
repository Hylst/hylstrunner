import { useEffect, useRef, useState } from "react";
import Game from "./game/Game";
import { LEVELS } from "./game/levels";
import { audio } from "./game/audio";

type Screen = "title" | "levels" | "game" | "victory" | "credits";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    try { return parseInt(localStorage.getItem("hylst_best") || "0", 10); } catch { return 0; }
  });
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [started, setStarted] = useState(false);
  const bgRef = useRef<HTMLCanvasElement>(null);

  // Animated background for menus
  useEffect(() => {
    if (screen === "game") return;
    const canvas = bgRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let w = 0, h = 0;
    const stars: { x: number; y: number; z: number }[] = [];
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w; canvas.height = h;
      if (stars.length === 0) {
        for (let i = 0; i < 180; i++) {
          stars.push({ x: Math.random() * w, y: Math.random() * h, z: Math.random() });
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += 0.01;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#05060d");
      g.addColorStop(0.5, "#1a0633");
      g.addColorStop(1, "#0b0420");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Nebula
      for (let i = 0; i < 3; i++) {
        const cx = (Math.sin(t * 0.3 + i) * 0.4 + 0.5) * w;
        const cy = (Math.cos(t * 0.2 + i * 0.7) * 0.4 + 0.5) * h;
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400);
        const colors = ["#a855f7", "#ec4899", "#06b6d4"];
        rg.addColorStop(0, colors[i] + "44");
        rg.addColorStop(1, colors[i] + "00");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
      // Stars
      for (const s of stars) {
        s.y += s.z * 0.6;
        if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
        ctx.fillStyle = `rgba(255,255,255,${0.3 + s.z * 0.7})`;
        ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2);
      }
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [screen]);

  const startGame = (level: number) => {
    audio.resume();
    audio.sfx("click");
    setSelectedLevel(level);
    setScreen("game");
    setStarted(true);
  };

  const handleVictory = (score: number) => {
    setFinalScore(score);
    if (score > bestScore) {
      setBestScore(score);
      try { localStorage.setItem("hylst_best", String(score)); } catch {}
    }
    setScreen("victory");
  };

  const exitToMenu = () => {
    audio.stopMusic();
    audio.sfx("click");
    setScreen("title");
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {screen !== "game" && <canvas ref={bgRef} className="absolute inset-0" />}

      {screen === "title" && (
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 anim-fade-up">
          <div className="text-center space-y-8">
            {/* Logo */}
            <div className="relative inline-block">
              <div className="text-[10px] font-mono tracking-[0.5em] text-white/40 mb-3">GEOFFROY PRÉSENTE</div>
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter title-shine leading-none">
                HYLST
              </h1>
              <div className="text-2xl md:text-4xl font-light tracking-[0.3em] text-white/70 mt-2 anim-flicker">
                R U N N E R
              </div>
              <div className="text-sm tracking-[0.4em] text-cyan-300/80 mt-4 font-mono">· COSMIC ODYSSEY ·</div>
            </div>

            {/* Ship icon */}
            <div className="anim-float">
              <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto" style={{ filter: "drop-shadow(0 0 20px #a855f7)" }}>
                <defs>
                  <linearGradient id="shipGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <path d="M40 10 L58 55 L48 50 L40 60 L32 50 L22 55 Z" fill="url(#shipGrad)" />
                <ellipse cx="40" cy="35" rx="6" ry="10" fill="#0f172a" />
                <ellipse cx="38" cy="32" rx="2" ry="3" fill="#22d3ee" opacity="0.8" />
              </svg>
            </div>

            {/* Menu buttons */}
            <div className="space-y-3 min-w-[280px]">
              <MenuButton primary onClick={() => { audio.sfx("click"); startGame(0); }}>
                ▶ COMMENCER L'AVENTURE
              </MenuButton>
              <MenuButton onClick={() => { audio.sfx("click"); setScreen("levels"); }}>
                ◆ SÉLECTION DE NIVEAU
              </MenuButton>
              <MenuButton onClick={() => { audio.sfx("click"); setScreen("credits"); }}>
                ✦ CRÉDITS & CONTRÔLES
              </MenuButton>
              <MenuButton onClick={() => { audio.sfx("click"); setShowInfo(true); }}>
                ℹ️ COMMENT CE JEU A ÉTÉ FAIT
              </MenuButton>
            </div>

            {bestScore > 0 && (
              <div className="text-white/50 text-sm font-mono">
                MEILLEUR SCORE : <span className="text-yellow-300 font-bold">{bestScore.toLocaleString()}</span>
              </div>
            )}

            {/* Audio toggles */}
            <div className="flex gap-2 justify-center pt-4">
              <Toggle label={`🎵 Musique ${musicOn ? "ON" : "OFF"}`} active={musicOn} onClick={() => setMusicOn(audio.toggleMusic())} />
              <Toggle label={`🔊 SFX ${sfxOn ? "ON" : "OFF"}`} active={sfxOn} onClick={() => setSfxOn(audio.toggleSfx())} />
            </div>
          </div>

          <div className="absolute bottom-4 text-center text-[10px] font-mono tracking-widest text-white/30">
            UNE CRÉATION HYLST, GEOFFROY × IA · 2026
          </div>
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setShowInfo(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-3.5 text-sm leading-relaxed text-white/80">
              <h3 className="text-xl font-black title-shine">Comment ce jeu a été fait</h3>
              <p><strong className="text-white">Stack :</strong> React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7, compilé en un seul fichier HTML, aucune dépendance chargée depuis l'extérieur.</p>
              <p><strong className="text-white">Graphismes :</strong> tout est dessiné en Canvas 2D à chaque image (vaisseau, obstacles, étoiles défilantes, effets de particules), aucun sprite ni image externe.</p>
              <p><strong className="text-white">Musique &amp; sons :</strong> synthétisés en direct avec l'API Web Audio, aucun fichier audio chargé. Chaque niveau a sa propre tonalité, son propre tempo et sa propre progression d'accords.</p>
              <p><strong className="text-white">Interactions :</strong> clavier ou tactile pour se déplacer et tirer, power-ups à ramasser en vol.</p>
              <p><strong className="text-white">Architecture :</strong> logique de jeu et rendu dans un même composant dédié (<code>Game.tsx</code>), séparé de l'écran-titre et des menus.</p>
              <p><strong className="text-white">Algorithmes notables :</strong> 5 niveaux chronométrés, chacun avec sa propre vitesse et fréquence d'apparition des obstacles (astéroïdes, drones, missiles, lasers) qui s'intensifient progressivement, et sa propre chance de power-up.</p>
            </div>
            <div className="border-t border-white/10 p-4 text-center">
              <button onClick={() => setShowInfo(false)} className="px-6 py-2.5 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {screen === "levels" && (
        <div className="relative z-10 w-full h-full flex flex-col items-center p-6 overflow-y-auto">
          <div className="w-full max-w-4xl anim-fade-up">
            <div className="flex items-center justify-between mb-6 mt-8">
              <h2 className="text-4xl font-black tracking-tighter title-shine">NIVEAUX</h2>
              <button onClick={exitToMenu} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm font-mono">← RETOUR</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
              {LEVELS.map((lvl, i) => (
                <button
                  key={lvl.id}
                  onClick={() => startGame(i)}
                  className="group relative overflow-hidden rounded-2xl p-6 text-left border-2 transition-all hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${lvl.bg[1]}, ${lvl.bg[2]})`,
                    borderColor: lvl.accent + "66",
                    boxShadow: `0 0 30px ${lvl.accent}33`
                  }}
                >
                  <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition" style={{
                    background: `radial-gradient(circle at 70% 30%, ${lvl.accent}, transparent 60%)`
                  }} />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-5xl font-black" style={{ color: lvl.accent, textShadow: `0 0 20px ${lvl.accent}` }}>
                        {lvl.id}
                      </div>
                      <div>
                        <div className="text-xs font-mono tracking-widest text-white/50">NIVEAU {lvl.id}</div>
                        <div className="text-2xl font-black tracking-tight">{lvl.name}</div>
                      </div>
                    </div>
                    <div className="text-sm italic text-white/70 mb-3">« {lvl.subtitle} »</div>
                    <div className="text-xs text-white/60 leading-relaxed mb-4">{lvl.description}</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {lvl.obstacleTypes.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/20 font-mono uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-white/50">
                      <span>⏱ {lvl.duration}s</span>
                      <span>⚡ {lvl.bpm} BPM</span>
                      <span>🎯 {lvl.maxObstacleSpeed}px/s max</span>
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-black transition group-hover:translate-x-1"
                      style={{ background: lvl.accent }}>
                      JOUER →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {screen === "credits" && (
        <div className="relative z-10 w-full h-full flex items-center justify-center p-6">
          <div className="max-w-2xl w-full anim-fade-up space-y-6">
            <button onClick={exitToMenu} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm font-mono">← RETOUR</button>
            
            <div className="rounded-2xl bg-black/40 backdrop-blur border border-white/10 p-8 space-y-4">
              <h2 className="text-3xl font-black title-shine">CRÉDITS</h2>
              <div className="space-y-3 text-white/80">
                <div>
                  <div className="text-xs font-mono tracking-widest text-cyan-300/70">CONCEPTION & CRÉATION</div>
                  <div className="text-2xl font-bold mt-1">Hylst, Geoffroy</div>
                </div>
                <div>
                  <div className="text-xs font-mono tracking-widest text-pink-300/70">ASSISTANCE INTELLIGENCE ARTIFICIELLE</div>
                  <div className="text-xl font-bold mt-1">IA Générative</div>
                </div>
                <div>
                  <div className="text-xs font-mono tracking-widest text-purple-300/70">MUSIQUE & SOUND DESIGN</div>
                  <div className="text-lg mt-1">Moteur audio procédural (Web Audio API)</div>
                  <div className="text-xs text-white/50 mt-1">Toute la musique et les effets sonores sont générés en temps réel par synthèse, aucun fichier audio externe.</div>
                </div>
                <div>
                  <div className="text-xs font-mono tracking-widest text-yellow-300/70">MOTEUR DE JEU</div>
                  <div className="text-lg mt-1">React · TypeScript · Canvas 2D · Tailwind</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-black/40 backdrop-blur border border-white/10 p-8 space-y-3">
              <h3 className="text-2xl font-black text-white">CONTRÔLES</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Control keys={["←", "→", "↑", "↓"]} label="Déplacer le vaisseau" />
                <Control keys={["Z", "Q", "S", "D"]} label="Déplacer (AZERTY)" />
                <Control keys={["ESPACE"]} label="Tirer" />
                <Control keys={["CLIC"]} label="Viser + tirer (souris)" />
                <Control keys={["ÉCHAP"]} label="Pause" />
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-xs font-mono tracking-widest text-white/40 mb-2">POWER-UPS</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <PU color="#22d3ee" letter="S" label="Bouclier" />
                  <PU color="#fbbf24" letter="R" label="Tir rapide" />
                  <PU color="#a78bfa" letter="T" label="Ralenti" />
                  <PU color="#ef4444" letter="+" label="Vie +1" />
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-white/40 font-mono tracking-widest pt-4">
              HYLPST RUNNER v1.0 · COSMIC ODYSSEY · © 2026
            </div>
          </div>
        </div>
      )}

      {screen === "victory" && (
        <div className="relative z-10 w-full h-full flex items-center justify-center p-6">
          <div className="text-center max-w-2xl anim-fade-up space-y-6">
            <div className="text-sm font-mono tracking-[0.5em] text-yellow-300">★ SINGULARITÉ ATTEINTE ★</div>
            <h1 className="text-7xl md:text-8xl font-black title-shine">VICTOIRE</h1>
            <p className="text-xl text-white/70">Vous avez traversé les 5 dimensions cosmiques.</p>
            <div className="rounded-2xl bg-black/40 backdrop-blur border border-yellow-400/30 p-6 inline-block">
              <div className="text-xs font-mono tracking-widest text-white/50">SCORE FINAL</div>
              <div className="text-6xl font-black text-yellow-300 mt-2" style={{ textShadow: "0 0 30px #fbbf24" }}>
                {finalScore.toLocaleString()}
              </div>
              {finalScore >= bestScore && finalScore > 0 && (
                <div className="text-sm font-mono text-yellow-400 mt-2 anim-pulse-glow">★ NOUVEAU RECORD ★</div>
              )}
            </div>
            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => startGame(0)}
                className="px-8 py-4 rounded-xl font-black text-lg tracking-wide hover:scale-105 transition"
                style={{ background: "linear-gradient(135deg, #fbbf24, #ec4899)", color: "#000" }}
              >
                REJOUER
              </button>
              <button onClick={exitToMenu} className="px-8 py-4 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition font-bold">
                Menu principal
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "game" && started && (
        <Game
          initialLevel={selectedLevel}
          onExit={exitToMenu}
          onVictory={handleVictory}
        />
      )}
    </div>
  );
}

function MenuButton({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-8 py-4 rounded-xl font-black text-lg tracking-wide transition-all hover:scale-105 ${
        primary ? "text-black" : "text-white border border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur"
      }`}
      style={primary ? { background: "linear-gradient(135deg, #a855f7, #ec4899)", boxShadow: "0 0 30px #a855f766" } : {}}
    >
      {children}
    </button>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-mono tracking-wider transition-all border ${
        active ? "bg-white/10 border-white/30 text-white" : "bg-black/40 border-white/10 text-white/40"
      }`}
    >
      {label}
    </button>
  );
}

function Control({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {keys.map(k => (
          <kbd key={k} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-xs font-mono font-bold">{k}</kbd>
        ))}
      </div>
      <span className="text-white/70">{label}</span>
    </div>
  );
}

function PU({ color, letter, label }: { color: string; letter: string; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-2 border border-white/10">
      <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-sm" style={{ background: color + "33", color, border: `1px solid ${color}88` }}>
        {letter}
      </div>
      <span className="text-white/80">{label}</span>
    </div>
  );
}
