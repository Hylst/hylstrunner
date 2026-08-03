import { useEffect, useRef, useState, useCallback } from "react";
import { LEVELS, LevelDef } from "./levels";
import { audio } from "./audio";

type Vec = { x: number; y: number };

type Entity = {
  pos: Vec;
  vel: Vec;
  radius: number;
  kind: "asteroid" | "drone" | "missile" | "laser";
  hp: number;
  rot: number;
  rotSpeed: number;
  seed: number;
  life?: number; // for lasers
  targetX?: number;
};

type Bullet = { pos: Vec; vel: Vec; radius: number; life: number; power: number };

type PowerupKind = "shield" | "rapid" | "slow" | "life";
type Powerup = { pos: Vec; vel: Vec; kind: PowerupKind; t: number };

type Particle = {
  pos: Vec; vel: Vec; life: number; max: number;
  color: string; size: number;
};

type Star = { x: number; y: number; z: number };

type ActivePowerups = {
  shield: number;
  rapid: number;
  slow: number;
};

type GamePhase = "playing" | "paused" | "levelComplete" | "gameOver" | "victory";

type HUDData = {
  score: number;
  combo: number;
  hp: number;
  maxHp: number;
  levelIndex: number;
  progress: number; // 0..1
  active: ActivePowerups;
};

type Props = {
  onExit: () => void;
  onVictory: (score: number) => void;
  initialLevel?: number;
};

export default function Game({ onExit, onVictory, initialLevel = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<HUDData>({
    score: 0, combo: 0, hp: 3, maxHp: 3,
    levelIndex: initialLevel, progress: 0,
    active: { shield: 0, rapid: 0, slow: 0 }
  });
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [paused, setPaused] = useState(false);

  const stateRef = useRef({
    player: { x: 0, y: 0, vx: 0, vy: 0, radius: 18, invuln: 0, tilt: 0 },
    bullets: [] as Bullet[],
    enemies: [] as Entity[],
    powerups: [] as Powerup[],
    particles: [] as Particle[],
    stars: [] as Star[],
    keys: {} as Record<string, boolean>,
    pointer: null as Vec | null,
    shooting: false,
    lastShot: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    hp: 3,
    maxHp: 3,
    levelIndex: initialLevel,
    levelTime: 0,
    lastObstacle: 0,
    shake: 0,
    flash: 0,
    flashColor: "#ffffff",
    active: { shield: 0, rapid: 0, slow: 0 } as ActivePowerups,
    running: true,
    width: 0,
    height: 0,
    progress: 0,
    phase: "playing" as GamePhase,
  });

  const initStars = useCallback((w: number, h: number, density: number) => {
    const count = Math.floor(120 * density);
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.9 + 0.1
      });
    }
    return stars;
  }, []);

  // Initialize state on mount / level change
  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.width = w;
      stateRef.current.height = h;
      if (stateRef.current.stars.length === 0) {
        const lvl = LEVELS[stateRef.current.levelIndex];
        stateRef.current.stars = initStars(w, h, lvl.stars.density);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Set player start
    const s = stateRef.current;
    s.player.x = s.width / 2;
    s.player.y = s.height - 100;

    return () => { window.removeEventListener("resize", resize); };
  }, [initStars]);

  // Start music on first play
  useEffect(() => {
    audio.resume();
    audio.startMusic(stateRef.current.levelIndex);
    return () => { audio.stopMusic(); };
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      if (e.key === "Escape") {
        setPaused(p => !p);
      }
      if (e.key === " ") {
        stateRef.current.shooting = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
      if (e.key === " ") stateRef.current.shooting = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Pointer
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      stateRef.current.pointer = { x: e.clientX, y: e.clientY };
      stateRef.current.shooting = true;
    };
    const onMove = (e: PointerEvent) => {
      if (stateRef.current.pointer) {
        stateRef.current.pointer = { x: e.clientX, y: e.clientY };
      }
    };
    const onUp = () => {
      stateRef.current.pointer = null;
      stateRef.current.shooting = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = stateRef.current;

      if (paused || s.phase !== "playing") {
        render(ctx, s, 0);
        return;
      }

      update(dt, now);
      render(ctx, s, now);
    };

    const update = (dt: number, now: number) => {
      const s = stateRef.current;
      const level = LEVELS[s.levelIndex];
      const slowFactor = s.active.slow > 0 ? 0.5 : 1;

      s.levelTime += dt;
      s.progress = Math.min(1, s.levelTime / level.duration);

      // Level complete
      if (s.levelTime >= level.duration) {
        s.phase = "levelComplete";
        setPhase("levelComplete");
        audio.sfx("levelup");
        s.flash = 1; s.flashColor = level.accent;
        return;
      }

      // Player movement
      const p = s.player;
      let targetVx = 0, targetVy = 0;
      const speed = 520;
      if (s.keys["arrowleft"] || s.keys["a"] || s.keys["q"]) targetVx -= speed;
      if (s.keys["arrowright"] || s.keys["d"]) targetVx += speed;
      if (s.keys["arrowup"] || s.keys["w"] || s.keys["z"]) targetVy -= speed;
      if (s.keys["arrowdown"] || s.keys["s"]) targetVy += speed;

      if (s.pointer) {
        const dx = s.pointer.x - p.x;
        const dy = s.pointer.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) {
          const k = Math.min(1, d / 200);
          targetVx = (dx / d) * speed * k * 1.2;
          targetVy = (dy / d) * speed * k * 1.2;
        }
      }

      p.vx += (targetVx - p.vx) * Math.min(1, dt * 10);
      p.vy += (targetVy - p.vy) * Math.min(1, dt * 10);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.tilt += (p.vx / speed * 0.3 - p.tilt) * Math.min(1, dt * 6);
      p.x = Math.max(p.radius, Math.min(s.width - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(s.height - p.radius, p.y));
      if (p.invuln > 0) p.invuln -= dt;

      // Shooting
      const shotCooldown = s.active.rapid > 0 ? 0.08 : 0.22;
      if (s.shooting && now - s.lastShot > shotCooldown * 1000) {
        s.lastShot = now;
        if (s.active.rapid > 0) {
          s.bullets.push({ pos: { x: p.x - 8, y: p.y - 10 }, vel: { x: -40, y: -800 }, radius: 3, life: 1.5, power: 1 });
          s.bullets.push({ pos: { x: p.x + 8, y: p.y - 10 }, vel: { x: 40, y: -800 }, radius: 3, life: 1.5, power: 1 });
        } else {
          s.bullets.push({ pos: { x: p.x, y: p.y - 18 }, vel: { x: 0, y: -820 }, radius: 4, life: 1.5, power: 1 });
        }
        audio.sfx("shoot");
      }

      // Obstacle spawning
      const progress = s.levelTime / level.duration;
      const interval = level.obstacleInterval + (level.minObstacleInterval - level.obstacleInterval) * progress;
      if (now - s.lastObstacle > interval) {
        s.lastObstacle = now;
        const types = level.obstacleTypes;
        const kind = types[Math.floor(Math.random() * types.length)];
        spawnEnemy(kind, level);
        if (Math.random() < level.powerupChance) {
          const kinds: PowerupKind[] = ["shield", "rapid", "slow", "life"];
          const k = kinds[Math.floor(Math.random() * kinds.length)];
          s.powerups.push({
            pos: { x: Math.random() * (s.width - 80) + 40, y: -30 },
            vel: { x: 0, y: level.obstacleSpeed * 0.7 },
            kind: k, t: 0
          });
        }
      }

      // Update stars
      for (const star of s.stars) {
        star.y += level.stars.speed * star.z * dt * slowFactor;
        if (star.y > s.height) { star.y = -2; star.x = Math.random() * s.width; }
      }

      // Update bullets
      for (const b of s.bullets) {
        b.pos.x += b.vel.x * dt;
        b.pos.y += b.vel.y * dt;
        b.life -= dt;
      }
      s.bullets = s.bullets.filter(b => b.life > 0 && b.pos.y > -20 && b.pos.x > -20 && b.pos.x < s.width + 20);

      // Update enemies
      for (const e of s.enemies) {
        if (e.kind === "missile") {
          // homing
          const dx = p.x - e.pos.x;
          const dy = p.y - e.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = level.obstacleSpeed * (1 + progress * 0.6);
          e.vel.x += (dx / d * spd - e.vel.x) * dt * 1.5;
          e.vel.y += (dy / d * spd - e.vel.y) * dt * 1.5;
        } else if (e.kind === "drone") {
          // zig-zag toward player
          const dx = p.x - e.pos.x;
          e.vel.x = Math.sign(dx) * 120 * (1 + progress * 0.5);
          e.vel.y = level.obstacleSpeed * (0.7 + progress * 0.5);
        } else if (e.kind === "laser") {
          // moves down until reaching a target Y then stays
          if (!e.life || e.life > 0) {
            e.vel.y = level.obstacleSpeed;
            if (e.pos.y >= e.targetX!) {
              e.vel.y = 0;
              e.life = (e.life ?? 2) - dt * 3;
            }
          }
        } else {
          e.vel.y = level.obstacleSpeed * (0.8 + progress * 0.6);
          e.vel.x += (Math.sin(e.seed + s.levelTime * 2) * 30 - e.vel.x) * dt;
        }
        e.pos.x += e.vel.x * dt * slowFactor;
        e.pos.y += e.vel.y * dt * slowFactor;
        e.rot += e.rotSpeed * dt;
      }
      s.enemies = s.enemies.filter(e => e.pos.y < s.height + 60 && e.pos.x > -60 && e.pos.x < s.width + 60 && (e.kind !== "laser" || (e.life ?? 2) > -1));

      // Update powerups
      for (const pu of s.powerups) {
        pu.pos.y += pu.vel.y * dt * slowFactor;
        pu.t += dt;
      }
      s.powerups = s.powerups.filter(pu => pu.pos.y < s.height + 40);

      // Update particles
      for (const pt of s.particles) {
        pt.pos.x += pt.vel.x * dt;
        pt.pos.y += pt.vel.y * dt;
        pt.vel.x *= 0.96;
        pt.vel.y *= 0.96;
        pt.life -= dt;
      }
      s.particles = s.particles.filter(pt => pt.life > 0);

      // Collisions: bullets vs enemies
      for (const b of s.bullets) {
        for (const e of s.enemies) {
          if (e.kind === "laser" && (e.life ?? 2) <= 0) continue;
          const dx = b.pos.x - e.pos.x;
          const dy = b.pos.y - e.pos.y;
          if (dx * dx + dy * dy < (b.radius + e.radius) ** 2) {
            b.life = 0;
            e.hp -= b.power;
            spawnExplosion(e.pos.x, e.pos.y, level.accent, 6, 0.4);
            if (e.hp <= 0) {
              spawnExplosion(e.pos.x, e.pos.y, level.accent, 18, 0.8);
              audio.sfx("explode");
              s.combo += 1;
              s.comboTimer = 2;
              s.score += 10 * (1 + Math.floor(s.combo / 5)) * (e.kind === "missile" ? 3 : e.kind === "drone" ? 2 : 1);
            } else {
              audio.sfx("hit");
            }
          }
        }
      }
      s.enemies = s.enemies.filter(e => e.hp > 0);

      // Collisions: player vs enemies
      if (p.invuln <= 0) {
        for (const e of s.enemies) {
          const dx = p.x - e.pos.x;
          const dy = p.y - e.pos.y;
          const rr = (p.radius + e.radius - 4) ** 2;
          if (dx * dx + dy * dy < rr) {
            if (s.active.shield > 0) {
              s.active.shield = 0;
              spawnExplosion(p.x, p.y, "#22d3ee", 30, 0.8);
              audio.sfx("explode");
              e.hp = 0;
              s.shake = 20;
            } else {
              s.hp -= 1;
              p.invuln = 1.5;
              s.shake = 25;
              s.flash = 0.6; s.flashColor = "#ef4444";
              s.combo = 0;
              audio.sfx("hit");
              spawnExplosion(p.x, p.y, "#ef4444", 24, 0.9);
              e.hp = 0;
              if (s.hp <= 0) {
                s.phase = "gameOver";
                setPhase("gameOver");
                audio.sfx("die");
                return;
              }
            }
          }
        }
      }
      s.enemies = s.enemies.filter(e => e.hp > 0);

      // Collisions: player vs powerups
      for (const pu of s.powerups) {
        const dx = p.x - pu.pos.x;
        const dy = p.y - pu.pos.y;
        if (dx * dx + dy * dy < (p.radius + 18) ** 2) {
          pu.pos.y = 99999; // mark for removal
          audio.sfx("powerup");
          spawnExplosion(pu.pos.x, pu.pos.y, "#fbbf24", 20, 0.6);
          if (pu.kind === "shield") s.active.shield = 8;
          else if (pu.kind === "rapid") s.active.rapid = 6;
          else if (pu.kind === "slow") s.active.slow = 5;
          else if (pu.kind === "life") { s.hp = Math.min(s.maxHp, s.hp + 1); s.score += 50; }
        }
      }
      s.powerups = s.powerups.filter(pu => pu.pos.y < 1000);

      // Combo decay
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.combo = 0;

      // Active timers
      for (const k of ["shield", "rapid", "slow"] as (keyof ActivePowerups)[]) {
        if (s.active[k] > 0) s.active[k] = Math.max(0, s.active[k] - dt);
      }

      // Effects
      if (s.shake > 0) s.shake *= 0.9;
      if (s.flash > 0) s.flash -= dt * 2;

      // Sync HUD occasionally
      setHud({
        score: Math.floor(s.score),
        combo: s.combo,
        hp: s.hp,
        maxHp: s.maxHp,
        levelIndex: s.levelIndex,
        progress: s.progress,
        active: { ...s.active }
      });
    };

    const spawnEnemy = (kind: Entity["kind"], level: LevelDef) => {
      const s = stateRef.current;
      const x = Math.random() * (s.width - 100) + 50;
      const base: Entity = {
        pos: { x, y: -40 },
        vel: { x: 0, y: level.obstacleSpeed },
        radius: 22,
        kind, hp: 1, rot: 0,
        rotSpeed: (Math.random() - 0.5) * 3,
        seed: Math.random() * 100
      };
      if (kind === "asteroid") {
        base.radius = 20 + Math.random() * 20;
        base.hp = Math.ceil(base.radius / 18);
      } else if (kind === "drone") {
        base.radius = 18; base.hp = 2;
      } else if (kind === "missile") {
        base.radius = 14; base.hp = 1;
        base.vel.y = level.obstacleSpeed * 0.6;
      } else if (kind === "laser") {
        base.radius = 8;
        base.hp = 1;
        base.targetX = s.height * (0.3 + Math.random() * 0.4);
        base.life = 2.5;
      }
      s.enemies.push(base);
    };

    const spawnExplosion = (x: number, y: number, color: string, count: number, spread: number) => {
      const s = stateRef.current;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 300 * spread + 60;
        s.particles.push({
          pos: { x, y },
          vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
          life: 0.6 + Math.random() * 0.4,
          max: 1,
          color,
          size: 2 + Math.random() * 3
        });
      }
    };

    const render = (ctx: CanvasRenderingContext2D, s: typeof stateRef.current, now: number) => {
      const w = s.width, h = s.height;
      const level = LEVELS[s.levelIndex];

      // Shake
      ctx.save();
      if (s.shake > 0.5) {
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      }

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, level.bg[0]);
      grad.addColorStop(0.5, level.bg[1]);
      grad.addColorStop(1, level.bg[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const star of s.stars) {
        const alpha = 0.3 + star.z * 0.7;
        ctx.fillStyle = level.stars.color;
        ctx.globalAlpha = alpha;
        const size = star.z * 2.2;
        ctx.fillRect(star.x, star.y, size, size);
      }
      ctx.globalAlpha = 1;

      // Nebula clouds for level 1 and 5
      if (s.levelIndex === 0 || s.levelIndex === 4) {
        const t = s.levelTime * 0.1;
        for (let i = 0; i < 4; i++) {
          const cx = (Math.sin(t + i * 1.3) * 0.5 + 0.5) * w;
          const cy = (Math.cos(t * 0.7 + i * 0.9) * 0.5 + 0.5) * h;
          const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300);
          rg.addColorStop(0, level.accent + "33");
          rg.addColorStop(1, level.accent + "00");
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Grid floor (level 2)
      if (s.levelIndex === 1) {
        ctx.strokeStyle = level.accent + "66";
        ctx.lineWidth = 1;
        const horizon = h * 0.55;
        const offset = (s.levelTime * 80) % 40;
        for (let i = 0; i < 20; i++) {
          const y = horizon + Math.pow(i, 2) * 2 + offset;
          if (y > h) break;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        for (let i = -10; i <= 10; i++) {
          ctx.beginPath();
          ctx.moveTo(w / 2 + i * 20, horizon);
          ctx.lineTo(w / 2 + i * 200, h);
          ctx.stroke();
        }
      }

      // Solar flares (level 3)
      if (s.levelIndex === 2) {
        const flareX = w * 0.15, flareY = -100;
        const rg = ctx.createRadialGradient(flareX, flareY, 0, flareX, flareY, 400);
        rg.addColorStop(0, "#fbbf24aa");
        rg.addColorStop(0.3, "#f97316aa");
        rg.addColorStop(1, "#f9731600");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }

      // Powerups
      for (const pu of s.powerups) {
        drawPowerup(ctx, pu, now);
      }

      // Enemies
      for (const e of s.enemies) {
        drawEnemy(ctx, e, level);
      }

      // Bullets
      for (const b of s.bullets) {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = level.accent;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = level.accent;
        ctx.fillRect(b.pos.x - 1, b.pos.y, 2, 14);
        ctx.restore();
      }

      // Particles
      for (const pt of s.particles) {
        const alpha = pt.life / pt.max;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.pos.x, pt.pos.y, pt.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Player
      drawPlayer(ctx, s.player, s.active, level, now);

      // Flash
      if (s.flash > 0) {
        ctx.fillStyle = s.flashColor;
        ctx.globalAlpha = s.flash * 0.35;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, p: typeof stateRef.current.player, active: ActivePowerups, level: LevelDef, now: number) => {
      if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return; // blink
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);

      // Thruster flame
      const flameLen = 18 + Math.sin(now * 0.03) * 6;
      const flameGrad = ctx.createLinearGradient(0, 12, 0, 12 + flameLen);
      flameGrad.addColorStop(0, "#fef3c7");
      flameGrad.addColorStop(0.4, level.accent);
      flameGrad.addColorStop(1, level.accent + "00");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.lineTo(0, 12 + flameLen);
      ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.fill();

      // Shield
      if (active.shield > 0) {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#22d3ee";
        ctx.globalAlpha = 0.6 + Math.sin(now * 0.01) * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Ship body
      ctx.shadowBlur = 20;
      ctx.shadowColor = level.accent;
      const bodyGrad = ctx.createLinearGradient(0, -20, 0, 15);
      bodyGrad.addColorStop(0, "#ffffff");
      bodyGrad.addColorStop(0.5, level.accent);
      bodyGrad.addColorStop(1, level.glow);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(14, 12);
      ctx.lineTo(6, 8);
      ctx.lineTo(0, 14);
      ctx.lineTo(-6, 8);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.ellipse(0, -4, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = level.accent;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(-1, -6, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    const drawEnemy = (ctx: CanvasRenderingContext2D, e: Entity, level: LevelDef) => {
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      ctx.rotate(e.rot);
      ctx.shadowBlur = 12;

      if (e.kind === "asteroid") {
        ctx.shadowColor = "#ffffff33";
        ctx.fillStyle = "#64748b";
        ctx.beginPath();
        const pts = 8;
        for (let i = 0; i < pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const r = e.radius * (0.85 + Math.sin(e.seed + i * 3) * 0.15);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(e.radius * 0.3, -e.radius * 0.2, e.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "drone") {
        ctx.shadowColor = level.accent;
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = level.accent;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = level.accent;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * e.radius * 0.6, Math.sin(a) * e.radius * 0.6);
          ctx.lineTo(Math.cos(a) * e.radius * 1.3, Math.sin(a) * e.radius * 1.3);
          ctx.stroke();
        }
      } else if (e.kind === "missile") {
        ctx.shadowColor = "#f97316";
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.moveTo(0, -e.radius);
        ctx.lineTo(e.radius * 0.7, e.radius);
        ctx.lineTo(0, e.radius * 0.5);
        ctx.lineTo(-e.radius * 0.7, e.radius);
        ctx.closePath();
        ctx.fill();
        // flame
        const flame = ctx.createLinearGradient(0, e.radius, 0, e.radius + 20);
        flame.addColorStop(0, "#fef3c7");
        flame.addColorStop(1, "#f9731600");
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(-5, e.radius);
        ctx.lineTo(0, e.radius + 18 + Math.random() * 6);
        ctx.lineTo(5, e.radius);
        ctx.closePath();
        ctx.fill();
      } else if (e.kind === "laser") {
        ctx.rotate(-e.rot); // don't rotate lasers
        ctx.shadowColor = level.accent;
        // vertical beam
        const s = stateRef.current;
        const beamH = s.height - e.pos.y;
        const lg = ctx.createLinearGradient(0, 0, 0, beamH);
        lg.addColorStop(0, level.accent);
        lg.addColorStop(1, level.accent + "00");
        ctx.fillStyle = lg;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-4, 0, 8, beamH);
        ctx.globalAlpha = 1;
        // emitter
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawPowerup = (ctx: CanvasRenderingContext2D, pu: Powerup, now: number) => {
      ctx.save();
      ctx.translate(pu.pos.x, pu.pos.y);
      const pulse = 1 + Math.sin(now * 0.008 + pu.t * 4) * 0.15;
      ctx.scale(pulse, pulse);
      const colors: Record<PowerupKind, string> = {
        shield: "#22d3ee",
        rapid: "#fbbf24",
        slow: "#a78bfa",
        life: "#ef4444"
      };
      const icons: Record<PowerupKind, string> = {
        shield: "S",
        rapid: "R",
        slow: "T",
        life: "+"
      };
      const c = colors[pu.kind];
      ctx.shadowBlur = 20;
      ctx.shadowColor = c;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icons[pu.kind], 0, 1);
      ctx.restore();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  // Level transitions
  const nextLevel = () => {
    const s = stateRef.current;
    if (s.levelIndex + 1 >= LEVELS.length) {
      onVictory(s.score);
      return;
    }
    s.levelIndex += 1;
    s.levelTime = 0;
    s.lastObstacle = 0;
    s.enemies = [];
    s.bullets = [];
    s.powerups = [];
    s.particles = [];
    s.stars = initStars(s.width, s.height, LEVELS[s.levelIndex].stars.density);
    s.phase = "playing";
    setPhase("playing");
    setHud(h => ({ ...h, levelIndex: s.levelIndex, progress: 0 }));
    audio.startMusic(s.levelIndex);
  };

  const restart = () => {
    const s = stateRef.current;
    s.levelIndex = 0;
    s.levelTime = 0;
    s.score = 0;
    s.hp = 3;
    s.combo = 0;
    s.enemies = [];
    s.bullets = [];
    s.powerups = [];
    s.particles = [];
    s.active = { shield: 0, rapid: 0, slow: 0 };
    s.phase = "playing";
    s.player.x = s.width / 2;
    s.player.y = s.height - 100;
    setPhase("playing");
    setHud(h => ({ ...h, score: 0, hp: 3, combo: 0, levelIndex: 0, progress: 0, active: { shield: 0, rapid: 0, slow: 0 }}));
    audio.startMusic(0);
  };

  const togglePause = () => setPaused(p => { audio.sfx("click"); return !p; });

  const level = LEVELS[hud.levelIndex];

  return (
    <div className="relative w-full h-full overflow-hidden no-select" style={{ background: "#000" }}>
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between pointer-events-none z-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur border border-white/10 text-xs font-mono uppercase tracking-widest" style={{ color: level.accent, boxShadow: `0 0 20px ${level.accent}55` }}>
              Niv.{hud.levelIndex + 1} : {level.name}
            </div>
            <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur border border-white/10 text-xs font-mono">
              Score <span className="text-white font-bold ml-1">{hud.score.toLocaleString()}</span>
            </div>
            {hud.combo > 1 && (
              <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur border border-yellow-400/40 text-xs font-mono text-yellow-300 animate-pulse">
                x{hud.combo} COMBO
              </div>
            )}
          </div>
          {/* HP */}
          <div className="flex gap-1.5">
            {Array.from({ length: hud.maxHp }).map((_, i) => (
              <div key={i} className="w-7 h-2 rounded-sm overflow-hidden bg-white/10 border border-white/10">
                <div
                  className="h-full transition-all"
                  style={{
                    width: i < hud.hp ? "100%" : "0%",
                    background: i < hud.hp ? `linear-gradient(90deg, ${level.accent}, ${level.glow})` : "transparent",
                    boxShadow: i < hud.hp ? `0 0 8px ${level.accent}` : "none"
                  }}
                />
              </div>
            ))}
          </div>
          {/* Active powerups */}
          <div className="flex gap-1.5">
            {hud.active.shield > 0 && <Pill color="#22d3ee" label={`🛡 ${hud.active.shield.toFixed(1)}s`} />}
            {hud.active.rapid > 0 && <Pill color="#fbbf24" label={`⚡ ${hud.active.rapid.toFixed(1)}s`} />}
            {hud.active.slow > 0 && <Pill color="#a78bfa" label={`⏱ ${hud.active.slow.toFixed(1)}s`} />}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <button
            onClick={togglePause}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/20 hover:bg-white/10 transition flex items-center justify-center text-white"
          >
            {paused ? "▶" : "❚❚"}
          </button>
          <button
            onClick={onExit}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur border border-white/20 hover:bg-red-500/30 transition flex items-center justify-center text-white text-sm"
            title="Quitter"
          >✕</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 z-10">
        <div
          className="h-full transition-all"
          style={{
            width: `${hud.progress * 100}%`,
            background: `linear-gradient(90deg, ${level.accent}, ${level.glow})`,
            boxShadow: `0 0 10px ${level.accent}`
          }}
        />
      </div>

      {/* Overlays */}
      {paused && phase === "playing" && (
        <Overlay>
          <h2 className="text-5xl font-black tracking-tighter mb-2">PAUSE</h2>
          <p className="text-white/60 mb-6">Appuyez sur Échap pour reprendre</p>
          <div className="flex gap-3">
            <button onClick={togglePause} className="px-6 py-3 rounded-lg font-bold" style={{ background: level.accent, color: "#000" }}>Reprendre</button>
            <button onClick={onExit} className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition">Quitter</button>
          </div>
        </Overlay>
      )}

      {phase === "levelComplete" && (
        <Overlay>
          <div className="text-sm font-mono tracking-[0.3em] mb-2" style={{ color: level.accent }}>NIVEAU {hud.levelIndex + 1} TERMINÉ</div>
          <h2 className="text-6xl font-black tracking-tighter mb-2 title-shine">{level.name}</h2>
          <p className="text-white/60 mb-1 max-w-md">{level.subtitle}</p>
          <p className="text-white/80 text-sm mb-6 max-w-md">Score : <span className="font-bold text-white">{hud.score.toLocaleString()}</span></p>
          {hud.levelIndex + 1 < LEVELS.length ? (
            <div className="text-center">
              <div className="text-xs text-white/40 mb-2 font-mono">SUIVANT : {LEVELS[hud.levelIndex + 1].name.toUpperCase()}</div>
              <button
                onClick={() => { audio.sfx("levelup"); nextLevel(); }}
                className="px-8 py-4 rounded-xl font-black text-lg tracking-wide hover:scale-105 transition"
                style={{ background: `linear-gradient(135deg, ${level.accent}, ${level.glow})`, color: "#000" }}
              >
                PORTAIL SUIVANT →
              </button>
            </div>
          ) : (
            <button
              onClick={() => { audio.sfx("levelup"); nextLevel(); }}
              className="px-8 py-4 rounded-xl font-black text-lg tracking-wide hover:scale-105 transition"
              style={{ background: `linear-gradient(135deg, #fbbf24, #ec4899)`, color: "#000" }}
            >
              VICTOIRE FINALE ★
            </button>
          )}
        </Overlay>
      )}

      {phase === "gameOver" && (
        <Overlay>
          <div className="text-sm font-mono tracking-[0.3em] mb-2 text-red-400">VAISSEAU DÉTRUIT</div>
          <h2 className="text-6xl font-black tracking-tighter mb-2 text-red-400">GAME OVER</h2>
          <p className="text-white/60 mb-6">Score final : <span className="font-bold text-white">{hud.score.toLocaleString()}</span></p>
          <div className="flex gap-3">
            <button
              onClick={restart}
              className="px-8 py-4 rounded-xl font-black text-lg tracking-wide hover:scale-105 transition"
              style={{ background: `linear-gradient(135deg, ${level.accent}, ${level.glow})`, color: "#000" }}
            >
              RÉESSAYER
            </button>
            <button onClick={onExit} className="px-8 py-4 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition font-bold">Menu</button>
          </div>
        </Overlay>
      )}

      {/* Controls hint (fades out) */}
      <ControlsHint level={level} />
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider"
      style={{ background: color + "33", color, border: `1px solid ${color}88`, boxShadow: `0 0 12px ${color}66` }}
    >
      {label}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm anim-fade-up">
      <div className="text-center px-8">{children}</div>
    </div>
  );
}

function ControlsHint({ level }: { level: LevelDef }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [level.id]);
  if (!visible) return null;
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="px-5 py-3 rounded-full bg-black/50 backdrop-blur border border-white/10 text-xs font-mono tracking-wider text-white/70 flex items-center gap-4 anim-fade-up">
        <span>← → ↑ ↓ ou ZQSD</span>
        <span className="text-white/30">•</span>
        <span>ESPACE / CLIC pour tirer</span>
        <span className="text-white/30">•</span>
        <span>ÉCHAP pour pause</span>
      </div>
    </div>
  );
}
