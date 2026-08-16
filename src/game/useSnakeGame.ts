import { useCallback, useEffect, useRef, useState } from "react";

export type DifficultyKey = "chill" | "classic" | "blitz";
export type Status = "idle" | "running" | "paused" | "over";

export interface Cell {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
}

interface Game {
  snake: Cell[];
  prev: Cell[];
  dir: Cell;
  queue: Cell[];
  food: Cell;
  score: number;
  apples: number;
  interval: number;
  acc: number;
  status: Status;
  particles: Particle[];
  floats: FloatText[];
  shake: number;
  flash: number;
  newBest: boolean;
}

export interface DiffSpec {
  label: string;
  ms: number;
  mult: number;
  minMs: number;
  color: string;
  tag: string;
  desc: string;
}

export const COLS = 21;
export const ROWS = 21;
export const CELL = 24;
const W = COLS * CELL;
const H = ROWS * CELL;

export const DIFFS: Record<DifficultyKey, DiffSpec> = {
  chill: {
    label: "CHILL",
    ms: 160,
    mult: 1,
    minMs: 120,
    color: "#5fe0a8",
    tag: "x1 pts",
    desc: "Warm-up pace — 10 pts per apple.",
  },
  classic: {
    label: "CLASSIC",
    ms: 110,
    mult: 2,
    minMs: 70,
    color: "#ffb454",
    tag: "x2 pts",
    desc: "The real deal — 20 pts, ramps up as you eat.",
  },
  blitz: {
    label: "BLITZ",
    ms: 74,
    mult: 3,
    minMs: 52,
    color: "#ff5d73",
    tag: "x3 pts",
    desc: "Near-zero mercy — 30 pts, blistering speed.",
  },
};

export const DIFF_ORDER: DifficultyKey[] = ["chill", "classic", "blitz"];

export const DIRS: Record<"up" | "down" | "left" | "right", Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

function readBest(d: DifficultyKey): number {
  return parseInt(store.get("snake.best." + d) || "0", 10) || 0;
}

function readDifficulty(): DifficultyKey {
  const d = store.get("snake.diff");
  return d === "chill" || d === "blitz" || d === "classic" ? d : "classic";
}

function placeFood(snake: Cell[]): Cell {
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  return free.length ? free[(Math.random() * free.length) | 0] : { x: 0, y: 0 };
}

function freshGame(diff: DifficultyKey, status: Status): Game {
  const snake: Cell[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  return {
    snake,
    prev: snake.map((c) => ({ ...c })),
    dir: { ...DIRS.right },
    queue: [],
    food: placeFood(snake),
    score: 0,
    apples: 0,
    interval: DIFFS[diff].ms,
    acc: 0,
    status,
    particles: [],
    floats: [],
    shake: 0,
    flash: 0,
    newBest: false,
  };
}

export interface UiState {
  score: number;
  best: number;
  len: number;
  status: Status;
  apples: number;
  newBest: boolean;
  pips: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function useSnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [difficulty, setDifficultyState] = useState<DifficultyKey>(readDifficulty);
  const [muted, setMuted] = useState(() => store.get("snake.muted") === "1");

  const diffRef = useRef<DifficultyKey>(difficulty);
  const mutedRef = useRef(muted);
  const bestRef = useRef<number>(readBest(difficulty));
  const g = useRef<Game>(freshGame(difficulty, "idle"));
  const audioRef = useRef<AudioContext | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const [ui, setUi] = useState<UiState>({
    score: 0,
    best: bestRef.current,
    len: 3,
    status: "idle",
    apples: 0,
    newBest: false,
    pips: 1,
  });

  const syncUi = useCallback(() => {
    const G = g.current;
    setUi({
      score: G.score,
      best: bestRef.current,
      len: G.snake.length,
      status: G.status,
      apples: G.apples,
      newBest: G.newBest,
      pips: Math.min(5, 1 + ((G.apples / 4) | 0)),
    });
  }, []);

  const beep = useCallback(
    (freq: number, dur = 0.08, type: OscillatorType = "square", gain = 0.04, slideTo?: number) => {
      if (mutedRef.current) return;
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = audioRef.current || new Ctx();
        const ctx = audioRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        const o = ctx.createOscillator();
        const gn = ctx.createGain();
        const t = ctx.currentTime;
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        gn.gain.setValueAtTime(gain, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gn);
        gn.connect(ctx.destination);
        o.start(t);
        o.stop(t + dur);
      } catch {
        /* audio unavailable */
      }
    },
    []
  );

  const burst = useCallback((cx: number, cy: number, colors: string[], n: number) => {
    const G = g.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.6;
      G.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.6,
        life: 1,
        size: 2 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }, []);

  const die = useCallback(() => {
    const G = g.current;
    G.status = "over";
    G.shake = 1;
    G.flash = 1;
    const head = G.snake[0];
    burst((head.x + 0.5) * CELL, (head.y + 0.5) * CELL, ["#ff5d73", "#5fe0a8", "#d7efe2"], 22);
    beep(180, 0.4, "sawtooth", 0.05, 55);
    syncUi();
  }, [beep, burst, syncUi]);

  const step = useCallback(() => {
    const G = g.current;
    const spec = DIFFS[diffRef.current];
    if (G.queue.length) G.dir = G.queue.shift() as Cell;
    const head = G.snake[0];
    const nh = { x: head.x + G.dir.x, y: head.y + G.dir.y };
    const ate = nh.x === G.food.x && nh.y === G.food.y;
    const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS;
    const body = ate ? G.snake : G.snake.slice(0, -1);
    if (hitWall || body.some((s) => s.x === nh.x && s.y === nh.y)) {
      die();
      return;
    }
    G.prev = G.snake.map((c) => ({ ...c }));
    G.snake.unshift(nh);

    if (ate) {
      G.apples++;
      G.score += 10 * spec.mult;
      G.interval = Math.max(spec.minMs, spec.ms - G.apples * 3);
      burst((nh.x + 0.5) * CELL, (nh.y + 0.5) * CELL, ["#ffb454", "#ff5d73", "#c8f551"], 12);
      G.floats.push({ x: (nh.x + 0.5) * CELL, y: nh.y * CELL, text: "+" + 10 * spec.mult, life: 1 });
      G.food = placeFood(G.snake);
      beep(720, 0.07, "square", 0.04);
      beep(980, 0.09, "square", 0.03);
      if (G.score > bestRef.current) {
        bestRef.current = G.score;
        G.newBest = true;
        store.set("snake.best." + diffRef.current, String(bestRef.current));
      }
      syncUi();
    } else {
      G.snake.pop();
    }
  }, [beep, burst, die, syncUi]);

  /* ---------- draw ---------- */
  const draw = useCallback(
    (now: number) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const G = g.current;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (G.shake > 0.02) {
        ctx.translate((Math.random() - 0.5) * 10 * G.shake, (Math.random() - 0.5) * 10 * G.shake);
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          ctx.fillStyle = (x + y) % 2 ? "#112a21" : "#0e241c";
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      ctx.strokeStyle = "rgba(95,224,168,0.14)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      /* apple */
      const pulse = 1 + Math.sin(now / 260) * 0.08;
      const ax = (G.food.x + 0.5) * CELL;
      const ay = (G.food.y + 0.5) * CELL;
      const ar = 7.6 * pulse;
      ctx.save();
      ctx.shadowColor = "rgba(255,93,93,0.85)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ff5d5d";
      ctx.beginPath();
      ctx.arc(ax, ay + 1, ar, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(ax - 2.4, ay - 1.6, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7ae08a";
      ctx.beginPath();
      ctx.ellipse(ax + 2.4, ay - ar - 1.5, 3.4, 1.8, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8a5a34";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ax, ay - ar + 1);
      ctx.lineTo(ax + 0.6, ay - ar - 3);
      ctx.stroke();

      /* snake — interpolated between grid steps */
      const t = G.status === "running" ? Math.min(1, G.acc / G.interval) : 1;
      const n = G.snake.length;
      let head: { x: number; y: number } | null = null;
      for (let i = n - 1; i >= 0; i--) {
        const c = G.snake[i];
        const a = G.prev[Math.max(0, i - 1)] || c;
        const px = lerp(a.x, c.x, t) * CELL;
        const py = lerp(a.y, c.y, t) * CELL;
        const k = n === 1 ? 0 : i / (n - 1);
        const hue = 86 + (165 - 86) * k;
        const sat = 84 - 16 * k;
        const lig = 62 - 17 * k;
        const pad = i === 0 ? 2.2 : 3.1;
        if (i === 0) head = { x: px, y: py };
        ctx.fillStyle = `hsl(${hue},${sat}%,${lig}%)`;
        ctx.beginPath();
        const s = CELL - pad * 2;
        const r = i === 0 ? 8 : 6.5;
        const X = px + pad;
        const Y = py + pad;
        ctx.moveTo(X + r, Y);
        ctx.arcTo(X + s, Y, X + s, Y + s, r);
        ctx.arcTo(X + s, Y + s, X, Y + s, r);
        ctx.arcTo(X, Y + s, X, Y, r);
        ctx.arcTo(X, Y, X + s, Y, r);
        ctx.closePath();
        ctx.fill();
      }
      if (head) {
        const hp = head as { x: number; y: number };
        ctx.save();
        ctx.shadowColor = "rgba(200,245,81,0.55)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "hsl(86,88%,66%)";
        const s = CELL - 4.4;
        const r = 8;
        const X = hp.x + 2.2;
        const Y = hp.y + 2.2;
        ctx.beginPath();
        ctx.moveTo(X + r, Y);
        ctx.arcTo(X + s, Y, X + s, Y + s, r);
        ctx.arcTo(X + s, Y + s, X, Y + s, r);
        ctx.arcTo(X, Y + s, X, Y, r);
        ctx.arcTo(X, Y, X + s, Y, r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const d = G.dir;
        const ox = d.y !== 0 ? 4.2 : 0;
        const oy = d.x !== 0 ? 4.2 : 0;
        const fx = d.x * 4;
        const fy = d.y * 4;
        const cx0 = hp.x + CELL / 2;
        const cy0 = hp.y + CELL / 2;
        ctx.fillStyle = "#0b1d17";
        ctx.beginPath();
        ctx.arc(cx0 + fx + ox, cy0 + fy + oy, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx0 + fx - ox, cy0 + fy - oy, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx0 + fx + ox + d.x, cy0 + fy + oy + d.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx0 + fx - ox + d.x, cy0 + fy - oy + d.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      /* particles */
      for (let i = G.particles.length - 1; i >= 0; i--) {
        const p = G.particles[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* floating score text */
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      for (let i = G.floats.length - 1; i >= 0; i--) {
        const f = G.floats[i];
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = "#ffb454";
        ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 20);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (G.flash > 0.02) {
        ctx.fillStyle = `rgba(255,80,90,${(0.26 * G.flash).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
    []
  );

  /* ---------- main loop ---------- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const G = g.current;
      if (G.status === "running") {
        G.acc += dt;
        let guard = 0;
        while (G.acc >= G.interval && guard++ < 8) {
          G.acc -= G.interval;
          step();
          if (G.status !== "running") {
            G.acc = 0;
            break;
          }
        }
      }
      G.shake = Math.max(0, G.shake - dt / 420);
      G.flash = Math.max(0, G.flash - dt / 480);
      for (let i = G.particles.length - 1; i >= 0; i--) {
        const p = G.particles[i];
        p.life -= dt / 620;
        p.x += (p.vx * dt) / 16;
        p.y += (p.vy * dt) / 16;
        p.vy += (0.06 * dt) / 16;
        if (p.life <= 0) G.particles.splice(i, 1);
      }
      for (let i = G.floats.length - 1; i >= 0; i--) {
        G.floats[i].life -= dt / 850;
        if (G.floats[i].life <= 0) G.floats.splice(i, 1);
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, step]);

  /* ---------- actions ---------- */
  const start = useCallback(() => {
    const G = g.current;
    if (G.status !== "idle") return;
    G.status = "running";
    G.acc = 0;
    beep(440, 0.09, "square", 0.04);
    beep(660, 0.1, "square", 0.035);
    syncUi();
  }, [beep, syncUi]);

  const restart = useCallback(() => {
    g.current = freshGame(diffRef.current, "running");
    beep(440, 0.09, "square", 0.04);
    syncUi();
  }, [beep, syncUi]);

  const togglePause = useCallback(() => {
    const G = g.current;
    if (G.status === "running") {
      G.status = "paused";
      beep(300, 0.07, "square", 0.03);
    } else if (G.status === "paused") {
      G.status = "running";
      G.acc = 0;
      beep(520, 0.07, "square", 0.03);
    }
    syncUi();
  }, [beep, syncUi]);

  const primary = useCallback(() => {
    const s = g.current.status;
    if (s === "idle") start();
    else if (s === "paused") togglePause();
    else if (s === "over") restart();
  }, [restart, start, togglePause]);

  const queueDir = useCallback(
    (d: Cell) => {
      const G = g.current;
      if (G.status === "over") return;
      if (G.status === "idle") start();
      if (G.status !== "running") return;
      const lastDir = G.queue.length ? G.queue[G.queue.length - 1] : G.dir;
      if ((d.x === -lastDir.x && d.y === -lastDir.y) || (d.x === lastDir.x && d.y === lastDir.y)) return;
      if (G.queue.length < 3) G.queue.push(d);
    },
    [start]
  );

  const changeDifficulty = useCallback(
    (k: DifficultyKey) => {
      diffRef.current = k;
      setDifficultyState(k);
      store.set("snake.diff", k);
      bestRef.current = readBest(k);
      g.current = freshGame(k, "idle");
      syncUi();
    },
    [syncUi]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      store.set("snake.muted", next ? "1" : "0");
      return next;
    });
  }, []);

  /* ---------- keyboard + visibility ---------- */
  useEffect(() => {
    const KEYMAP: Record<string, Cell> = {
      ArrowUp: DIRS.up,
      ArrowDown: DIRS.down,
      ArrowLeft: DIRS.left,
      ArrowRight: DIRS.right,
      w: DIRS.up,
      s: DIRS.down,
      a: DIRS.left,
      d: DIRS.right,
      W: DIRS.up,
      S: DIRS.down,
      A: DIRS.left,
      D: DIRS.right,
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (KEYMAP[k]) {
        e.preventDefault();
        queueDir(KEYMAP[k]);
        return;
      }
      if (k === " " || k === "Spacebar") {
        e.preventDefault();
        primary();
        return;
      }
      if (k === "r" || k === "R") {
        restart();
        return;
      }
      if (k === "Enter") {
        const s = g.current.status;
        if (s === "idle") start();
        else if (s === "over") restart();
        return;
      }
      if (k === "p" || k === "P") {
        togglePause();
        return;
      }
      if (k === "m" || k === "M") toggleMute();
    };
    const onVis = () => {
      if (document.hidden && g.current.status === "running") togglePause();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [primary, queueDir, restart, start, toggleMute, togglePause]);

  /* ---------- touch (swipe on the board) ---------- */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const ts = touchRef.current;
      touchRef.current = null;
      if (!ts) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - ts.x;
      const dy = t.clientY - ts.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
        primary();
        return;
      }
      queueDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : dy > 0 ? DIRS.down : DIRS.up);
    },
    [primary, queueDir]
  );

  return {
    canvasRef,
    ui,
    difficulty,
    muted,
    onTouchStart,
    onTouchEnd,
    actions: { restart, togglePause, primary, queueDir, changeDifficulty, toggleMute },
  };
}
