<?php
declare(strict_types=1);
/* ================================================================
   SNAKE — single-file raw PHP edition
   ----------------------------------------------------------------
   Requirements : PHP 7.4+ (no extensions beyond core, no framework,
                  no build step, no dependencies — one file).
   Install      : upload snake.php to any PHP host and open it.
   High scores  : persist to snake_scores.json next to this file.
                  If the directory is not writable the game still
                  runs and falls back to the browser's localStorage.

   Endpoints (all served by this one file):
     GET  snake.php             the game (server-rendered leaderboard)
     GET  snake.php?d=blitz     pick difficulty: chill | classic | blitz
     GET  snake.php?api=scores  JSON leaderboard
     POST snake.php?api=submit  JSON {name, score, difficulty}
   ================================================================ */

const SNAKE_DIFFICULTIES = [
    'chill'   => ['label' => 'Chill',   'ms' => 160, 'mult' => 1, 'minMs' => 120, 'color' => '#5fe0a8', 'tag' => 'x1 pts'],
    'classic' => ['label' => 'Classic', 'ms' => 110, 'mult' => 2, 'minMs' => 70,  'color' => '#ffb454', 'tag' => 'x2 pts'],
    'blitz'   => ['label' => 'Blitz',   'ms' => 74,  'mult' => 3, 'minMs' => 52,  'color' => '#ff5d73', 'tag' => 'x3 pts'],
];

$snakeScoreFile = __DIR__ . '/snake_scores.json';

/* ---------- tiny JSON-file score store (locked writes) ---------- */

function snake_load_scores(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw  = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function snake_save_scores(string $file, array $scores): bool
{
    $fp = @fopen($file, 'c+');
    if ($fp === false) {
        return false;
    }
    $ok = false;
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        $ok = fwrite($fp, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) !== false;
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return $ok;
}

function snake_clean_name($raw): string
{
    $name = trim((string) $raw);
    $name = (string) preg_replace('/[^\p{L}\p{N}_\- ]/u', '', $name);
    $name = trim(substr($name, 0, 12));
    return $name === '' ? 'ANON' : $name;
}

/* ---------- micro API: snake.php?api=scores | ?api=submit ---------- */

if (isset($_GET['api'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $scores = snake_load_scores($snakeScoreFile);

    if ($_GET['api'] === 'scores') {
        echo json_encode(['ok' => true, 'scores' => $scores]);
        exit;
    }

    if ($_GET['api'] === 'submit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $body  = json_decode((string) file_get_contents('php://input'), true);
        $body  = is_array($body) ? $body : [];
        $score = isset($body['score']) ? (int) $body['score'] : -1;
        $diff  = isset($body['difficulty']) ? (string) $body['difficulty'] : '';
        $name  = snake_clean_name(isset($body['name']) ? $body['name'] : 'ANON');

        if ($score < 0 || $score > 999999 || !array_key_exists($diff, SNAKE_DIFFICULTIES)) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'invalid payload']);
            exit;
        }

        $list   = isset($scores[$diff]) && is_array($scores[$diff]) ? $scores[$diff] : [];
        $list[] = ['name' => $name, 'score' => $score, 'at' => date('Y-m-d H:i')];
        usort($list, static function (array $a, array $b): int {
            $sa = isset($a['score']) ? (int) $a['score'] : 0;
            $sb = isset($b['score']) ? (int) $b['score'] : 0;
            return $sb <=> $sa;
        });
        $scores[$diff] = array_slice($list, 0, 5);

        $saved = snake_save_scores($snakeScoreFile, $scores);
        echo json_encode(['ok' => $saved, 'scores' => $scores[$diff]]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'unknown api call']);
    exit;
}

/* ---------- page config ---------- */

$snakeDifficulty = isset($_GET['d']) && array_key_exists($_GET['d'], SNAKE_DIFFICULTIES)
    ? (string) $_GET['d']
    : 'classic';

$snakeCfg    = SNAKE_DIFFICULTIES[$snakeDifficulty] + ['key' => $snakeDifficulty];
$snakeAll    = snake_load_scores($snakeScoreFile);
$snakeBoard  = isset($snakeAll[$snakeDifficulty]) && is_array($snakeAll[$snakeDifficulty])
    ? array_slice($snakeAll[$snakeDifficulty], 0, 5)
    : [];
$snakeWritable = is_writable(__DIR__) || (is_file($snakeScoreFile) && is_writable($snakeScoreFile));

$snakeJsCfg = json_encode(
    $snakeCfg + ['tops' => $snakeBoard, 'writable' => $snakeWritable],
    JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#081511">
<title>SNAKE · <?php echo htmlspecialchars($snakeCfg['label'], ENT_QUOTES); ?> — raw PHP</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* SNAKE raw-PHP edition — all styling lives in this one file. */
:root{
  --ink:#081511; --ink2:#0b1d17; --pine:#0f2820; --pine2:#143528;
  --line:#2c6b4f; --mint:#5fe0a8; --amber:#ffb454; --coral:#ff5d73;
  --lime:#c8f551; --fog:#d7efe2; --dim:#7fa995;
  --diffc:<?php echo htmlspecialchars($snakeCfg['color'], ENT_QUOTES); ?>;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--fog);
  font-family:"Space Grotesk","Trebuchet MS",sans-serif;-webkit-tap-highlight-color:transparent}
.arcade{font-family:"Press Start 2P","Courier New",monospace}
.wrap{max-width:880px;margin:0 auto;padding:20px 16px 40px;position:relative;z-index:1}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(600px 400px at 12% 8%,rgba(255,180,84,.10),transparent 60%),
    radial-gradient(700px 500px at 88% 90%,rgba(95,224,168,.10),transparent 60%),
    linear-gradient(rgba(95,224,168,.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(95,224,168,.04) 1px,transparent 1px);
  background-size:auto,auto,34px 34px,34px 34px}
body::after{content:"";position:fixed;inset:0;z-index:40;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,transparent 1px 3px)}
/* header */
.mq{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;
  border-bottom:2px solid #1d4736;padding-bottom:14px;margin-bottom:18px;flex-wrap:wrap}
.title{font-size:26px;letter-spacing:2px;color:var(--fog);margin:0;
  text-shadow:3px 3px 0 rgba(255,180,84,.55),-2px -2px 0 rgba(95,224,168,.4)}
.sub{color:var(--dim);font-size:13px;margin:8px 0 0}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-family:"Press Start 2P",monospace;font-size:8px;color:var(--mint);
  border:1.5px solid var(--line);padding:6px 8px;border-radius:4px;background:rgba(15,40,32,.7)}
/* cabinet */
.bezel{background:linear-gradient(180deg,#123125,#0c2019);border:2px solid #275c44;
  border-radius:14px;padding:14px;box-shadow:0 24px 60px -24px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.06)}
.hud{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:2px 4px 12px}
.stat .lbl{font-family:"Press Start 2P",monospace;font-size:8px;color:var(--dim);letter-spacing:1px}
.stat .val{font-family:"Press Start 2P",monospace;font-size:18px;margin-top:6px}
.val.score{color:var(--amber)} .val.best{color:var(--mint)} .val.len{color:var(--fog)}
.val.pop{animation:pop .28s cubic-bezier(.2,1.6,.4,1)}
@keyframes pop{0%{transform:scale(1.45);color:#fff}100%{transform:scale(1)}}
.pips{display:flex;gap:4px;margin-top:8px}
.pips i{width:9px;height:9px;background:#123024;border:1px solid #24523d;display:block}
.pips i.on{background:var(--diffc);border-color:var(--diffc);box-shadow:0 0 8px var(--diffc)}
.hud .grow{flex:1}
.iconbtn{font-family:"Press Start 2P",monospace;font-size:9px;color:var(--mint);cursor:pointer;
  background:var(--pine2);border:2px solid var(--line);border-radius:6px;padding:9px 12px;
  box-shadow:0 3px 0 #06120d}
.iconbtn:active{transform:translateY(2px);box-shadow:0 1px 0 #06120d}
.board{position:relative;border:2px solid #1d4736;border-radius:8px;overflow:hidden;background:#0e241c}
.board canvas{display:block;width:100%;height:auto;touch-action:none}
.vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 56px rgba(0,0,0,.5)}
.ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:14px;text-align:center;background:rgba(4,12,9,.78);cursor:pointer;padding:16px;
  animation:ovin .18s ease-out both}
@keyframes ovin{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.ov .big{font-family:"Press Start 2P",monospace;font-size:20px;letter-spacing:1px}
.ov .mid{font-family:"Press Start 2P",monospace;font-size:10px;line-height:1.9;color:var(--fog)}
.ov .sml{font-size:13px;color:var(--dim);max-width:340px;line-height:1.5}
.ov .big.mint{color:var(--mint)} .ov .big.amber{color:var(--amber)} .ov .big.coral{color:var(--coral)}
.blink{animation:blink 1.1s steps(1) infinite}
@keyframes blink{0%,55%{opacity:1}56%,100%{opacity:.12}}
.hidden{display:none !important}
.newbest{font-family:"Press Start 2P",monospace;font-size:9px;color:#06120d;background:var(--amber);
  padding:6px 9px;border-radius:4px;transform:rotate(-2deg)}
/* deck */
.deck{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap;padding-top:14px}
.diffs{display:flex;border:2px solid var(--line);border-radius:8px;overflow:hidden;flex:1;min-width:230px}
.diffs a{flex:1;text-align:center;text-decoration:none;padding:12px 6px 10px;
  font-family:"Press Start 2P",monospace;font-size:9px;color:var(--dim);background:var(--pine);
  border-right:2px solid var(--line);transition:background .15s,color .15s}
.diffs a:last-child{border-right:0}
.diffs a small{display:block;font-family:"Space Grotesk",sans-serif;font-size:10px;margin-top:5px;opacity:.75}
.diffs a:hover{color:var(--fog)}
.diffs a.on{background:var(--diffc);color:#06120d}
.btn{font-family:"Press Start 2P",monospace;font-size:9px;cursor:pointer;border-radius:8px;
  border:2px solid var(--line);background:var(--pine2);color:var(--mint);padding:0 16px;
  box-shadow:0 4px 0 #06120d;transition:transform .06s,box-shadow .06s,background .15s}
.btn:hover{background:#1a4534}
.btn:active{transform:translateY(3px);box-shadow:0 1px 0 #06120d}
.btn.amber{color:var(--amber);border-color:#8a6428}
.hint{color:var(--dim);font-size:12.5px;padding:12px 4px 0;line-height:1.6}
.hint b{color:var(--mint);font-weight:600}
kbd{font-family:"Press Start 2P",monospace;font-size:8px;color:var(--dim);background:var(--pine);
  border:1.5px solid var(--line);border-bottom-width:3px;border-radius:4px;padding:3px 5px 2px}
/* dpad */
.dpad{display:none;grid-template-columns:repeat(3,56px);grid-auto-rows:56px;gap:6px;
  justify-content:center;padding-top:14px}
.dpad button{border:2px solid var(--line);border-radius:10px;background:var(--pine2);color:var(--mint);
  font-size:20px;cursor:pointer;box-shadow:0 3px 0 #06120d;display:flex;align-items:center;justify-content:center}
.dpad button:active{transform:translateY(2px);box-shadow:0 1px 0 #06120d;background:#1a4534}
@media (max-width:820px),(pointer:coarse){.dpad{display:grid}}
@media (max-width:520px){.title{font-size:20px}.stat .val{font-size:15px}.ov .big{font-size:15px}}
/* leaderboard */
.panel{margin-top:22px;border:2px solid #1d4736;border-radius:12px;background:rgba(11,29,23,.92);overflow:hidden}
.panel header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:2px solid #1d4736;flex-wrap:wrap}
.panel header .t{font-family:"Press Start 2P",monospace;font-size:10px;color:var(--amber)}
.panel header .grow{flex:1}
.handle{font-family:"Press Start 2P",monospace;font-size:9px;color:var(--fog);background:var(--pine);
  border:2px solid var(--line);border-radius:6px;padding:8px 10px;width:130px;text-transform:uppercase}
.handle:focus{outline:2px solid var(--mint)}
.lb{list-style:none;margin:0;padding:6px 0}
.lb li{display:flex;align-items:center;gap:12px;padding:9px 16px;font-size:14px}
.lb li:nth-child(odd){background:rgba(255,255,255,.025)}
.lb .rank{font-family:"Press Start 2P",monospace;font-size:9px;color:var(--dim);width:26px}
.lb li:first-child .rank{color:var(--amber)}
.lb .nm{flex:1;font-weight:600;letter-spacing:.4px;text-transform:uppercase}
.lb .sc{font-family:"Press Start 2P",monospace;font-size:11px;color:var(--mint)}
.lb .empty{color:var(--dim);font-size:13px;padding:14px 16px}
.note{color:var(--dim);font-size:12px;padding:10px 16px 14px;border-top:1.5px dashed #1d4736;line-height:1.6}
.note b{color:var(--amber);font-weight:600}
#lbStatus{font-family:"Press Start 2P",monospace;font-size:8px;color:var(--mint)}
footer{margin-top:26px;color:var(--dim);font-size:12.5px;line-height:1.7}
footer .arcade{font-size:8px;color:var(--mint)}
</style>
</head>
<body>
<div class="wrap">

  <header class="mq">
    <div>
      <h1 class="title arcade">SNAKE</h1>
      <p class="sub">Single-file <strong style="color:var(--mint)">raw PHP</strong> edition · <?php echo htmlspecialchars($snakeCfg['label'], ENT_QUOTES); ?> mode · <?php echo htmlspecialchars($snakeCfg['tag'], ENT_QUOTES); ?></p>
    </div>
    <div class="chips">
      <span class="chip">1 FILE</span>
      <span class="chip">0 DEPS</span>
      <span class="chip">PHP 7.4+</span>
    </div>
  </header>

  <section class="bezel" id="cab">
    <div class="hud">
      <div class="stat"><div class="lbl">SCORE</div><div class="val score" id="score">0</div></div>
      <div class="stat"><div class="lbl">BEST</div><div class="val best" id="best">0</div></div>
      <div class="stat"><div class="lbl">LENGTH</div><div class="val len" id="len">3</div></div>
      <div class="stat"><div class="lbl">SPEED</div><div class="pips" id="pips"><i class="on"></i><i></i><i></i><i></i><i></i></div></div>
      <div class="grow"></div>
      <button class="iconbtn" id="muteBtn" type="button" aria-label="toggle sound">SND ON</button>
      <button class="iconbtn" id="pauseBtn" type="button">PAUSE</button>
    </div>

    <div class="board" id="board">
      <canvas id="cv" width="504" height="504"></canvas>
      <div class="vig"></div>

      <div class="ov" id="ovIdle">
        <div class="big mint">READY?</div>
        <div class="mid">EAT &middot; GROW &middot; DON'T CRASH</div>
        <div class="mid blink" style="color:var(--amber)">&#9654; PRESS SPACE / TAP</div>
        <div class="sml">Arrow keys or WASD to steer &mdash; swipe or use the pad on touch screens. Apples are worth <?php echo (int) $snakeCfg['mult'] * 10; ?> points and the pace ramps up as you eat.</div>
      </div>

      <div class="ov hidden" id="ovPause">
        <div class="big amber">PAUSED</div>
        <div class="mid blink">SPACE TO RESUME</div>
      </div>

      <div class="ov hidden" id="ovOver">
        <div class="big coral">GAME OVER</div>
        <div class="mid">SCORE <span id="finalScore" style="color:var(--amber)">0</span></div>
        <div class="newbest hidden" id="newBest">NEW BEST!</div>
        <div class="mid blink">R / SPACE TO RESTART</div>
      </div>
    </div>

    <div class="deck">
      <nav class="diffs" aria-label="difficulty">
        <?php foreach (SNAKE_DIFFICULTIES as $key => $d) : ?>
        <a href="?d=<?php echo htmlspecialchars($key, ENT_QUOTES); ?>"
           class="<?php echo $key === $snakeDifficulty ? 'on' : ''; ?>"
           style="<?php echo $key === $snakeDifficulty ? '' : 'color:' . htmlspecialchars($d['color'], ENT_QUOTES); ?>;">
          <?php echo htmlspecialchars($d['label'], ENT_QUOTES); ?>
          <small><?php echo htmlspecialchars($d['tag'], ENT_QUOTES); ?></small>
        </a>
        <?php endforeach; ?>
      </nav>
      <button class="btn amber" id="restartBtn" type="button">RESTART</button>
    </div>

    <div class="dpad" id="dpad" aria-label="touch controls">
      <button type="button" data-dir="up" style="grid-column:2">&#9650;</button>
      <button type="button" data-dir="left">&#9664;</button>
      <button type="button" data-dir="pause" id="dpadPause" style="font-size:11px">&#10074;&#10074;</button>
      <button type="button" data-dir="right">&#9654;</button>
      <button type="button" data-dir="down" style="grid-column:2">&#9660;</button>
    </div>

    <p class="hint">
      <kbd>&larr;&uarr;&darr;&rarr;</kbd> / <kbd>WASD</kbd> steer &nbsp;&middot;&nbsp;
      <kbd>SPACE</kbd> pause &nbsp;&middot;&nbsp; <kbd>R</kbd> restart &nbsp;&middot;&nbsp;
      <kbd>M</kbd> sound &nbsp;&middot;&nbsp; on touch: <b>swipe</b> the board or use the pad.
    </p>
  </section>

  <aside class="panel">
    <header>
      <span class="t">TOP 5 — <?php echo htmlspecialchars(strtoupper($snakeCfg['label']), ENT_QUOTES); ?></span>
      <span id="lbStatus"></span>
      <span class="grow"></span>
      <input class="handle" id="handle" maxlength="12" placeholder="HANDLE" aria-label="your handle" value="ANON">
    </header>
    <ol class="lb" id="lb">
      <?php if (count($snakeBoard) === 0) : ?>
        <li class="empty">No runs on record yet — set the first score.</li>
      <?php else : ?>
        <?php foreach ($snakeBoard as $i => $run) : ?>
        <li>
          <span class="rank"><?php echo $i + 1; ?></span>
          <span class="nm"><?php echo htmlspecialchars((string) (isset($run['name']) ? $run['name'] : 'ANON'), ENT_QUOTES); ?></span>
          <span class="sc"><?php echo (int) (isset($run['score']) ? $run['score'] : 0); ?></span>
        </li>
        <?php endforeach; ?>
      <?php endif; ?>
    </ol>
    <?php if (!$snakeWritable) : ?>
      <p class="note"><b>Heads-up:</b> this directory is not writable, so scores cannot be saved server-side. The game still runs and keeps your best locally. <code>chmod</code> the folder (or the <code>snake_scores.json</code> file) to enable the shared board.</p>
    <?php else : ?>
      <p class="note">Scores are saved by PHP to <b>snake_scores.json</b> next to <b>snake.php</b> — the board above is server-rendered on every visit and updated live after each run.</p>
    <?php endif; ?>
  </aside>

  <footer>
    <span class="arcade">SNAKE &middot; RAW PHP EDITION</span><br>
    One file, zero dependencies: game loop, rendering, input, difficulty and the leaderboard API all live in <strong style="color:var(--fog)">snake.php</strong>.
  </footer>

</div>

<script>
/* Client engine for the raw-PHP edition — vanilla JS, no libraries.
   Config is injected by PHP above (difficulty, server tops, writable flag). */
(function () {
  'use strict';

  var CFG  = window.SNAKE_CFG || { key: 'classic', ms: 110, mult: 2, minMs: 70 };
  var COLS = 21, ROWS = 21, CELL = 24, W = COLS * CELL, H = ROWS * CELL;
  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  function $(id) { return document.getElementById(id); }
  var cv = $('cv'), ctx = cv.getContext('2d');
  var el = {
    score: $('score'), best: $('best'), len: $('len'), pips: $('pips'),
    ovIdle: $('ovIdle'), ovPause: $('ovPause'), ovOver: $('ovOver'),
    finalScore: $('finalScore'), newBest: $('newBest'),
    pauseBtn: $('pauseBtn'), lb: $('lb'), lbStatus: $('lbStatus'), handle: $('handle')
  };

  var DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  cv.width = W * DPR; cv.height = H * DPR;

  /* ---------- state ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  var serverBest = (CFG.tops && CFG.tops[0] && CFG.tops[0].score) ? CFG.tops[0].score | 0 : 0;
  var localBest  = parseInt(store.get('snake.best.' + CFG.key) || '0', 10) || 0;

  var G = null;
  var best = Math.max(serverBest, localBest);
  var muted = store.get('snake.muted') === '1';

  function fresh(status) {
    var snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    return {
      snake: snake, prev: snake.map(function (c) { return { x: c.x, y: c.y }; }),
      dir: { x: 1, y: 0 }, queue: [], food: placeFood(snake),
      score: 0, apples: 0, interval: CFG.ms, acc: 0,
      status: status, particles: [], floats: [], shake: 0, flash: 0, newBest: false
    };
  }

  function placeFood(snake) {
    var free = [], x, y, i, taken;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        taken = false;
        for (i = 0; i < snake.length; i++) { if (snake[i].x === x && snake[i].y === y) { taken = true; break; } }
        if (!taken) free.push({ x: x, y: y });
      }
    }
    return free.length ? free[(Math.random() * free.length) | 0] : { x: 0, y: 0 };
  }

  /* ---------- tiny synth ---------- */
  var actx = null;
  function beep(freq, dur, type, gain, slide) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(gain || 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------- HUD ---------- */
  function pop(elm) { elm.classList.remove('pop'); void elm.offsetWidth; elm.classList.add('pop'); }
  function hud() {
    el.score.textContent = G.score;
    el.best.textContent  = best;
    el.len.textContent   = G.snake.length;
    var on = Math.min(5, 1 + ((G.apples / 4) | 0)), cells = el.pips.children, i;
    for (i = 0; i < cells.length; i++) cells[i].className = i < on ? 'on' : '';
    el.ovIdle.classList.toggle('hidden', G.status !== 'idle');
    el.ovPause.classList.toggle('hidden', G.status !== 'paused');
    el.ovOver.classList.toggle('hidden', G.status !== 'over');
    el.pauseBtn.textContent = G.status === 'paused' ? 'RESUME' : 'PAUSE';
    el.newBest.classList.toggle('hidden', !(G.newBest && G.status === 'over'));
    el.finalScore.textContent = G.score;
  }

  /* ---------- core loop ---------- */
  function step() {
    if (G.queue.length) G.dir = G.queue.shift();
    var head = G.snake[0];
    var nh = { x: head.x + G.dir.x, y: head.y + G.dir.y };
    var ate = nh.x === G.food.x && nh.y === G.food.y;
    var hitWall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS;
    var hitSelf = false, body = ate ? G.snake : G.snake.slice(0, -1), i;
    for (i = 0; i < body.length; i++) { if (body[i].x === nh.x && body[i].y === nh.y) { hitSelf = true; break; } }
    if (hitWall || hitSelf) { die(); return; }

    G.prev = G.snake.map(function (c) { return { x: c.x, y: c.y }; });
    G.snake.unshift(nh);

    if (ate) {
      G.apples++;
      G.score += 10 * CFG.mult;
      G.interval = Math.max(CFG.minMs, CFG.ms - G.apples * 3);
      burst((nh.x + 0.5) * CELL, (nh.y + 0.5) * CELL, ['#ffb454', '#ff5d73', '#c8f551'], 12);
      G.floats.push({ x: (nh.x + 0.5) * CELL, y: nh.y * CELL, text: '+' + (10 * CFG.mult), life: 1 });
      G.food = placeFood(G.snake);
      beep(720, 0.07, 'square', 0.04); beep(980, 0.09, 'square', 0.03);
      if (G.score > best) {
        best = G.score; G.newBest = true;
        store.set('snake.best.' + CFG.key, String(best));
      }
      pop(el.score);
    } else {
      G.snake.pop();
    }
    hud();
  }

  function die() {
    G.status = 'over'; G.shake = 1; G.flash = 1;
    var head = G.snake[0];
    burst((head.x + 0.5) * CELL, (head.y + 0.5) * CELL, ['#ff5d73', '#5fe0a8', '#d7efe2'], 22);
    beep(180, 0.4, 'sawtooth', 0.05, 55);
    hud();
    if (G.score > 0) submitScore(G.score);
  }

  function burst(cx, cy, colors, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6;
      G.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, size: 2 + Math.random() * 3, color: colors[i % colors.length]
      });
    }
  }

  /* ---------- server leaderboard ---------- */
  function renderBoard(list) {
    if (!list || !list.length) {
      el.lb.innerHTML = '<li class="empty">No runs on record yet — set the first score.</li>';
      return;
    }
    var html = '', i, r;
    for (i = 0; i < list.length; i++) {
      r = list[i];
      html += '<li><span class="rank">' + (i + 1) + '</span><span class="nm">' +
        escapeHtml(String(r.name || 'ANON')) + '</span><span class="sc">' + ((r.score | 0)) + '</span></li>';
    }
    el.lb.innerHTML = html;
  }
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function submitScore(score) {
    var name = (el.handle.value || 'ANON').trim().slice(0, 12) || 'ANON';
    store.set('snake.handle', name);
    el.lbStatus.textContent = 'SAVING...';
    var done = function (ok) {
      el.lbStatus.textContent = ok ? 'SAVED TO SERVER' : 'LOCAL ONLY';
      el.lbStatus.style.color = ok ? 'var(--mint)' : 'var(--amber)';
    };
    try {
      fetch('?api=submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, score: score, difficulty: CFG.key })
      })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { renderBoard(j.scores); done(true); } else { done(false); } })
      .catch(function () { done(false); });
    } catch (e) { done(false); }
  }
  var savedHandle = store.get('snake.handle');
  if (savedHandle) el.handle.value = savedHandle;

  /* ---------- input ---------- */
  function queueDir(d) {
    if (G.status === 'over') return;
    if (G.status === 'idle') start();
    if (G.status !== 'running') return;
    var last = G.queue.length ? G.queue[G.queue.length - 1] : G.dir;
    if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return;
    if (G.queue.length < 3) G.queue.push(d);
  }
  function start() {
    if (G.status !== 'idle') return;
    G.status = 'running'; G.acc = 0;
    beep(440, 0.09, 'square', 0.04); beep(660, 0.1, 'square', 0.035);
    hud();
  }
  function restart() {
    G = fresh('running');
    beep(440, 0.09, 'square', 0.04);
    hud();
  }
  function togglePause() {
    if (G.status === 'running') { G.status = 'paused'; beep(300, 0.07, 'square', 0.03); }
    else if (G.status === 'paused') { G.status = 'running'; G.acc = 0; beep(520, 0.07, 'square', 0.03); }
    hud();
  }
  function primary() {
    if (G.status === 'idle') start();
    else if (G.status === 'paused') togglePause();
    else if (G.status === 'over') restart();
  }

  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
  };
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (KEYMAP[k]) { e.preventDefault(); queueDir(DIRS[KEYMAP[k]]); return; }
    if (k === ' ' || k === 'Spacebar') { e.preventDefault(); primary(); return; }
    if (k === 'r' || k === 'R' || k === 'Enter') { if (G.status !== 'running') restart(); return; }
    if (k === 'p' || k === 'P') { togglePause(); return; }
    if (k === 'm' || k === 'M') { toggleMute(); }
  });

  var ts = null;
  cv.addEventListener('touchstart', function (e) { ts = e.touches[0]; }, { passive: true });
  cv.addEventListener('touchend', function (e) {
    if (!ts) return;
    var t = e.changedTouches[0], dx = t.clientX - ts.clientX, dy = t.clientY - ts.clientY;
    ts = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { primary(); return; }
    queueDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up));
  }, { passive: true });
  $('board').addEventListener('click', function (e) { if (e.target === cv || e.target.classList.contains('vig')) primary(); });
  el.ovIdle.addEventListener('click', primary);
  el.ovPause.addEventListener('click', primary);
  el.ovOver.addEventListener('click', primary);
  el.pauseBtn.addEventListener('click', function () { if (G.status === 'idle') start(); else togglePause(); });
  $('restartBtn').addEventListener('click', restart);

  var padBtns = document.querySelectorAll('#dpad button');
  Array.prototype.forEach.call(padBtns, function (b) {
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var d = b.getAttribute('data-dir');
      if (d === 'pause') { if (G.status === 'idle') start(); else togglePause(); return; }
      queueDir(DIRS[d]);
    });
  });

  function toggleMute() {
    muted = !muted;
    store.set('snake.muted', muted ? '1' : '0');
    $('muteBtn').textContent = muted ? 'SND OFF' : 'SND ON';
  }
  $('muteBtn').addEventListener('click', toggleMute);
  if (muted) $('muteBtn').textContent = 'SND OFF';

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.status === 'running') togglePause();
  });

  /* ---------- rendering ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rr(x, y, s, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + s, y, x + s, y + s, r);
    ctx.arcTo(x + s, y + s, x, y + s, r);
    ctx.arcTo(x, y + s, x, y, r);
    ctx.arcTo(x, y, x + s, y, r);
    ctx.closePath();
  }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (G.shake > 0.02) ctx.translate((Math.random() - 0.5) * 10 * G.shake, (Math.random() - 0.5) * 10 * G.shake);

    var x, y, i;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#112a21' : '#0e241c';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = 'rgba(95,224,168,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    /* apple */
    var pulse = 1 + Math.sin(now / 260) * 0.08;
    var ax = (G.food.x + 0.5) * CELL, ay = (G.food.y + 0.5) * CELL, ar = 7.6 * pulse;
    ctx.save();
    ctx.shadowColor = 'rgba(255,93,93,0.85)'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath(); ctx.arc(ax, ay + 1, ar, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(ax - 2.4, ay - 1.6, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ae08a';
    ctx.beginPath(); ctx.ellipse(ax + 2.4, ay - ar - 1.5, 3.4, 1.8, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ax, ay - ar + 1); ctx.lineTo(ax + 0.6, ay - ar - 3); ctx.stroke();

    /* snake (interpolated between grid steps) */
    var t = G.status === 'running' ? Math.min(1, G.acc / G.interval) : 1;
    var n = G.snake.length, c, a, px, py, k, h, s, l, pad, head = null;
    for (i = n - 1; i >= 0; i--) {
      c = G.snake[i];
      a = G.prev[Math.max(0, i - 1)] || c;
      px = lerp(a.x, c.x, t) * CELL; py = lerp(a.y, c.y, t) * CELL;
      k = n === 1 ? 0 : i / (n - 1);
      h = 86 + (165 - 86) * k; s = 84 - 16 * k; l = 62 - 17 * k;
      pad = i === 0 ? 2.2 : 3.1;
      if (i === 0) { head = { x: px, y: py }; }
      ctx.fillStyle = 'hsl(' + h + ',' + s + '%,' + l + '%)';
      rr(px + pad, py + pad, CELL - pad * 2, i === 0 ? 8 : 6.5);
      ctx.fill();
    }
    if (head) {
      ctx.save();
      ctx.shadowColor = 'rgba(200,245,81,0.55)'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'hsl(86,88%,66%)';
      rr(head.x + 2.2, head.y + 2.2, CELL - 4.4, 8);
      ctx.fill();
      ctx.restore();
      var d = G.dir, ox = d.y !== 0 ? 4.2 : 0, oy = d.x !== 0 ? 4.2 : 0;
      var fx = d.x * 4, fy = d.y * 4, cx0 = head.x + CELL / 2, cy0 = head.y + CELL / 2;
      ctx.fillStyle = '#0b1d17';
      ctx.beginPath(); ctx.arc(cx0 + fx + ox, cy0 + fy + oy, 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx0 + fx - ox, cy0 + fy - oy, 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx0 + fx + ox + d.x, cy0 + fy + oy + d.y, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx0 + fx - ox + d.x, cy0 + fy - oy + d.y, 1.1, 0, Math.PI * 2); ctx.fill();
    }

    /* particles */
    for (i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    /* floating score text */
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (i = G.floats.length - 1; i >= 0; i--) {
      var f = G.floats[i];
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#ffb454';
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 20);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (G.flash > 0.02) {
      ctx.fillStyle = 'rgba(255,80,90,' + (0.26 * G.flash).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(50, now - last); last = now;
    if (G.status === 'running') {
      G.acc += dt;
      var guard = 0;
      while (G.acc >= G.interval && guard++ < 8) {
        G.acc -= G.interval;
        step();
        if (G.status !== 'running') { G.acc = 0; break; }
      }
    }
    G.shake = Math.max(0, G.shake - dt / 420);
    G.flash = Math.max(0, G.flash - dt / 480);
    var i, p;
    for (i = G.particles.length - 1; i >= 0; i--) {
      p = G.particles[i];
      p.life -= dt / 620; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += 0.06 * dt / 16;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    for (i = G.floats.length - 1; i >= 0; i--) {
      G.floats[i].life -= dt / 850;
      if (G.floats[i].life <= 0) G.floats.splice(i, 1);
    }
    draw(now);
    requestAnimationFrame(frame);
  }

  G = fresh('idle');
  hud();
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>
