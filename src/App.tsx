import { useEffect, useState } from "react";
import SourcePanel from "./components/SourcePanel";
import { DIFFS, DIFF_ORDER, DIRS, useSnakeGame, type Cell, type DifficultyKey } from "./game/useSnakeGame";

/* ---------------- small pieces ---------------- */

function KeyCap({ label, display, lit }: { label: string; display?: string; lit: boolean }) {
  return (
    <kbd className={`keycap ${lit ? "lit" : ""}`} data-key={label}>
      {display ?? label.toUpperCase()}
    </kbd>
  );
}

function Chevron({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
      <path d="M5 15.5 12 8.5l7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <>
          <path d="M16 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function SnakeLogo() {
  const segs = [0, 1, 2, 3, 4];
  return (
    <svg width="64" height="18" viewBox="0 0 76 20" aria-hidden="true" className="mb-1">
      {segs.map((i) => (
        <rect
          key={i}
          className="snk-seg"
          style={{ animationDelay: `${i * 0.16}s` }}
          x={i * 13 + 2}
          y={i % 2 === 0 ? 9 : 3}
          width={10}
          height={10}
          rx={3}
          fill={i === 4 ? "#c8f551" : `hsl(${86 + i * 20},80%,${58 - i * 3}%)`}
        />
      ))}
      <circle cx="69" cy="6" r="1.5" fill="#081511" style={{ opacity: 0.9 }} />
    </svg>
  );
}

/* ---------------- app ---------------- */

export default function App() {
  const game = useSnakeGame();
  const { ui, difficulty, muted, canvasRef, actions, onTouchStart, onTouchEnd } = game;
  const spec = DIFFS[difficulty];

  const [pressed, setPressed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const norm = (k: string): string | null => {
      const low = k.toLowerCase();
      if (low.startsWith("arrow")) return low;
      if (["w", "a", "s", "d", "r", "p", "m"].includes(low)) return low;
      if (k === " ") return "space";
      return null;
    };
    const down = (e: KeyboardEvent) => {
      const n = norm(e.key);
      if (!n) return;
      setPressed((prev) => {
        if (prev.has(n)) return prev;
        const next = new Set(prev);
        next.add(n);
        return next;
      });
    };
    const up = (e: KeyboardEvent) => {
      const n = norm(e.key);
      if (!n) return;
      setPressed((prev) => {
        if (!prev.has(n)) return prev;
        const next = new Set(prev);
        next.delete(n);
        return next;
      });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const lit = (...keys: string[]) => keys.some((k) => pressed.has(k));

  const dpad = (dir: "up" | "down" | "left" | "right") => (
    <button
      type="button"
      aria-label={`move ${dir}`}
      className="btn-arcade rounded-lg flex items-center justify-center !p-0"
      onPointerDown={(e) => {
        e.preventDefault();
        actions.queueDir(DIRS[dir] as Cell);
      }}
    >
      <Chevron dir={dir} />
    </button>
  );

  return (
    <div className="min-h-screen relative overflow-x-clip">
      {/* ambient layers */}
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div
        className="fixed -top-44 -left-44 w-[36rem] h-[36rem] rounded-full pointer-events-none glow-a"
        style={{ background: "radial-gradient(circle, rgba(255,180,84,0.13), transparent 62%)" }}
        aria-hidden="true"
      />
      <div
        className="fixed -bottom-52 -right-44 w-[40rem] h-[40rem] rounded-full pointer-events-none glow-b"
        style={{ background: "radial-gradient(circle, rgba(95,224,168,0.12), transparent 62%)" }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 scanlines pointer-events-none z-40 opacity-40" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pb-12">
        {/* marquee */}
        <header className="flex items-end justify-between gap-4 flex-wrap pt-7 pb-5 border-b-2 border-[#1d4736]">
          <div className="rise-in">
            <SnakeLogo />
            <h1
              className="font-arcade text-[26px] sm:text-[34px] leading-none text-fog"
              style={{ textShadow: "3px 3px 0 rgba(255,180,84,0.55), -2px -2px 0 rgba(95,224,168,0.4)" }}
            >
              SNAKE
            </h1>
            <p className="mt-2.5 text-sm text-dim">
              The single-file <span className="text-mint font-semibold">raw PHP</span> edition — one file, zero dependencies, server-side leaderboard.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap rise-in" style={{ animationDelay: "0.08s" }}>
            {["1 FILE", "0 DEPS", "PHP 7.4+"].map((c) => (
              <span key={c} className="font-arcade text-[8px] text-mint border-[1.5px] border-line rounded px-2.5 py-2 bg-pine/70">
                {c}
              </span>
            ))}
          </div>
        </header>

        <main className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 pt-6 items-start">
          {/* cabinet */}
          <section className="rise-in" style={{ animationDelay: "0.05s" }}>
            <div
              className={`rounded-2xl border-2 border-[#275c44] p-3.5 sm:p-4 ${ui.status === "over" ? "cab-shake" : ""}`}
              style={{
                background: "linear-gradient(180deg,#123125,#0c2019)",
                boxShadow: "0 24px 60px -24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* HUD */}
              <div className="flex items-center gap-x-6 gap-y-2 flex-wrap px-1 pb-3">
                <div>
                  <div className="font-arcade text-[8px] text-dim tracking-wider">SCORE</div>
                  <div key={ui.score} className={`font-arcade text-lg sm:text-xl mt-1.5 text-amber scorepop`}>
                    {ui.score}
                  </div>
                </div>
                <div className="relative">
                  <div className="font-arcade text-[8px] text-dim tracking-wider">BEST</div>
                  <div className="font-arcade text-lg sm:text-xl mt-1.5 text-mint">{ui.best}</div>
                  {ui.newBest && ui.status === "over" && (
                    <span className="absolute -top-2 -right-9 font-arcade text-[7px] bg-amber text-ink px-1.5 py-1 rounded rotate-6">
                      NEW!
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-arcade text-[8px] text-dim tracking-wider">LENGTH</div>
                  <div className="font-arcade text-lg sm:text-xl mt-1.5 text-fog">{ui.len}</div>
                </div>
                <div>
                  <div className="font-arcade text-[8px] text-dim tracking-wider">SPEED</div>
                  <div className="flex gap-1 mt-2.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="w-2.5 h-2.5 block border transition-all duration-300"
                        style={
                          i < ui.pips
                            ? { background: spec.color, borderColor: spec.color, boxShadow: `0 0 8px ${spec.color}` }
                            : { background: "#123024", borderColor: "#24523d" }
                        }
                      />
                    ))}
                  </div>
                </div>
                <span className="flex-1" />
                <button
                  onClick={actions.toggleMute}
                  className="btn-arcade rounded-md text-[8px] px-3 py-2.5 flex items-center gap-2"
                  aria-label="toggle sound"
                >
                  <SpeakerIcon muted={muted} />
                  {muted ? "OFF" : "ON"}
                </button>
              </div>

              {/* board */}
              <div
                className={`relative rounded-lg overflow-hidden border-2 border-[#1d4736] touch-none-important select-none ${
                  ui.status === "running" ? "" : "cursor-pointer"
                }`}
                onClick={actions.primary}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <canvas ref={canvasRef} className="block w-full h-auto" style={{ aspectRatio: "1 / 1" }} />
                <div className="absolute inset-0 pointer-events-none crt-vignette" />

                {ui.status === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 text-center bg-[rgba(4,12,9,0.78)] overlay-pop px-4">
                    <div className="font-arcade text-xl text-mint">READY?</div>
                    <div className="font-arcade text-[9px] leading-5 text-fog">EAT · GROW · DON'T CRASH</div>
                    <div className="font-arcade text-[10px] text-amber blink">▶ PRESS SPACE / TAP</div>
                    <p className="text-[13px] text-dim max-w-[340px] leading-relaxed">
                      Apples are worth <span style={{ color: spec.color }}>{10 * spec.mult} pts</span> and the pace ramps up
                      with every bite. Swipe or use the pad on touch screens.
                    </p>
                  </div>
                )}

                {ui.status === "paused" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 text-center bg-[rgba(4,12,9,0.78)] overlay-pop">
                    <div className="font-arcade text-xl text-amber">PAUSED</div>
                    <div className="font-arcade text-[9px] text-fog blink">SPACE TO RESUME</div>
                  </div>
                )}

                {ui.status === "over" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center bg-[rgba(4,12,9,0.8)] overlay-pop px-4">
                    <div className="font-arcade text-xl text-coral">GAME OVER</div>
                    <div className="font-arcade text-[10px] text-fog">
                      SCORE <span className="text-amber">{ui.score}</span>
                    </div>
                    {ui.newBest && <span className="font-arcade text-[9px] bg-amber text-ink px-2.5 py-2 rounded -rotate-2">NEW BEST!</span>}
                    <div className="font-arcade text-[9px] text-fog blink">R / SPACE TO RESTART</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.restart();
                      }}
                      className="btn-arcade btn-amber rounded-md text-[9px] px-5 py-3 mt-1"
                    >
                      ↻ RESTART
                    </button>
                  </div>
                )}
              </div>

              {/* deck */}
              <div className="flex gap-2.5 items-stretch flex-wrap pt-3.5">
                <div className="flex border-2 border-line rounded-lg overflow-hidden flex-1 min-w-[240px]">
                  {DIFF_ORDER.map((k) => {
                    const d = DIFFS[k];
                    const active = k === difficulty;
                    return (
                      <button
                        key={k}
                        onClick={() => actions.changeDifficulty(k as DifficultyKey)}
                        className="flex-1 text-center py-2.5 px-1 font-arcade text-[9px] transition-colors border-r-2 border-line last:border-r-0"
                        style={
                          active
                            ? { background: d.color, color: "#06120d" }
                            : { background: "#0f2820", color: d.color }
                        }
                        aria-pressed={active}
                      >
                        {d.label}
                        <span className="block font-body text-[10px] mt-1 opacity-80">{d.tag}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={actions.togglePause} className="btn-arcade btn-amber rounded-lg text-[9px] px-4 sm:px-5">
                  {ui.status === "paused" ? "▶ RESUME" : "❚❚ PAUSE"}
                </button>
                <button onClick={actions.restart} className="btn-arcade rounded-lg text-[9px] px-4 sm:px-5">
                  ↻ RESTART
                </button>
              </div>
              <p className="text-[12px] text-dim px-1 pt-2.5">{spec.desc}</p>

              {/* touch pad */}
              <div className="grid grid-cols-3 gap-1.5 w-48 mx-auto pt-4 lg:hidden" aria-label="touch controls">
                <span />
                {dpad("up")}
                <span />
                {dpad("left")}
                <button
                  type="button"
                  aria-label="pause or resume"
                  className="btn-arcade btn-amber rounded-lg flex items-center justify-center !p-0 font-arcade text-[10px]"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (ui.status === "idle" || ui.status === "over") actions.primary();
                    else actions.togglePause();
                  }}
                >
                  {ui.status === "paused" ? "▶" : "❚❚"}
                </button>
                {dpad("right")}
                <span />
                {dpad("down")}
                <span />
              </div>
            </div>

            {/* key hints */}
            <div className="hidden md:flex items-center gap-x-3 gap-y-2 flex-wrap pt-4 px-1 text-[12px] text-dim">
              <KeyCap label="w" lit={lit("w")} />
              <KeyCap label="a" lit={lit("a")} />
              <KeyCap label="s" lit={lit("s")} />
              <KeyCap label="d" lit={lit("d")} />
              <span className="opacity-60">/</span>
              <KeyCap label="arrowup" display="↑" lit={lit("arrowup")} />
              <KeyCap label="arrowleft" display="←" lit={lit("arrowleft")} />
              <KeyCap label="arrowdown" display="↓" lit={lit("arrowdown")} />
              <KeyCap label="arrowright" display="→" lit={lit("arrowright")} />
              <span>steer</span>
              <span className="opacity-40">·</span>
              <KeyCap label="space" display="SPACE" lit={lit("space")} />
              <span>pause</span>
              <span className="opacity-40">·</span>
              <KeyCap label="r" lit={lit("r")} />
              <span>restart</span>
              <span className="opacity-40">·</span>
              <KeyCap label="m" lit={lit("m")} />
              <span>sound</span>
            </div>
          </section>

          {/* the raw PHP deliverable */}
          <aside className="space-y-4">
            <div className="rise-in" style={{ animationDelay: "0.1s" }}>
              <p className="font-arcade text-[9px] text-amber tracking-wider pb-1">THE DELIVERABLE — RAW PHP, NO FRAMEWORK</p>
              <p className="text-[13px] text-dim leading-relaxed">
                Everything lives in <span className="font-mono text-mint">snake.php</span>: the difficulty switcher, the
                leaderboard API and the top-5 board are plain server-rendered PHP. The cabinet on the left runs the exact
                same client engine, so you can play it before you host it.
              </p>
            </div>
            <SourcePanel />
          </aside>
        </main>

        <footer className="mt-10 pt-5 border-t-2 border-[#1d4736] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12.5px] text-dim leading-relaxed max-w-xl">
            <span className="font-arcade text-[8px] text-mint">SNAKE · RAW PHP EDITION</span>
            <br />
            This page is a static preview — best scores here are kept in your browser. Upload{" "}
            <span className="font-mono text-fog">snake.php</span> to any PHP host for the shared server-side leaderboard.
          </p>
          <span className="font-arcade text-[8px] text-dim/70">© ARCADE CABINET №7</span>
        </footer>
      </div>
    </div>
  );
}
