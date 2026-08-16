import { useMemo, useState } from "react";
import phpSource from "../../snake.php?raw";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MASTER =
  /(\/\*[\s\S]*?\*\/)|((?:^|[\s(;{}[\],])\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(<\?php|<\?=|\?>)|(\$[A-Za-z_]\w*)|\b(function|fn|const|echo|print|if|else|elseif|endif|foreach|endforeach|for|while|switch|case|break|continue|return|exit|die|array|isset|empty|unset|new|true|false|null|header|declare|strict_types|static|public|private|protected|class|namespace|use|require|include|as|int|string|bool|void|float|json_encode|json_decode|htmlspecialchars|file_get_contents|fopen|fclose|fwrite|flock|ftruncate|rewind|fflush|is_array|is_file|is_writable|date|trim|substr|preg_replace|usort|array_slice|array_key_exists|http_response_code|count|strlen|var|let|this|typeof|instanceof)\b|(\b\d+(?:\.\d+)?\b)/gm;

function highlight(src: string): string {
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  MASTER.lastIndex = 0;
  while ((m = MASTER.exec(src)) !== null) {
    out += escapeHtml(src.slice(last, m.index));
    const [full, block, line, str, tag, vari, kw, num] = m;
    if (block !== undefined) {
      out += `<span class="tk-c">${escapeHtml(full)}</span>`;
    } else if (line !== undefined) {
      const at = full.indexOf("//");
      out += escapeHtml(full.slice(0, at)) + `<span class="tk-c">${escapeHtml(full.slice(at))}</span>`;
    } else if (str !== undefined) {
      out += `<span class="tk-s">${escapeHtml(full)}</span>`;
    } else if (tag !== undefined) {
      out += `<span class="tk-t">${escapeHtml(full)}</span>`;
    } else if (vari !== undefined) {
      out += `<span class="tk-v">${escapeHtml(full)}</span>`;
    } else if (kw !== undefined) {
      out += `<span class="tk-k">${escapeHtml(full)}</span>`;
    } else if (num !== undefined) {
      out += `<span class="tk-n">${escapeHtml(full)}</span>`;
    }
    last = MASTER.lastIndex;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

export default function SourcePanel() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const html = useMemo(() => highlight(phpSource), []);
  const lines = useMemo(() => phpSource.split("\n").length, []);
  const kb = (phpSource.length / 1024).toFixed(1);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phpSource);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = phpSource;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([phpSource], { type: "application/x-php;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "snake.php";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 800);
  };

  return (
    <div className="border-2 border-line rounded-xl bg-ink2/90 overflow-hidden rise-in" style={{ animationDelay: "0.15s" }}>
      {/* file bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-[#1d4736] flex-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="#5fe0a8" strokeWidth="1.8" />
          <path d="M14 2v5h5" stroke="#5fe0a8" strokeWidth="1.8" />
          <path d="M8.5 13.5 7 15l1.5 1.5M15.5 13.5 17 15l-1.5 1.5M12.8 12.5l-1.6 5" stroke="#ffb454" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="font-mono text-sm text-mint font-semibold">snake.php</span>
        <span className="text-[11px] text-dim">
          {kb} KB · {lines} lines · PHP 7.4+
        </span>
        <span className="flex-1" />
        <button
          onClick={copy}
          className={`btn-arcade rounded-md text-[9px] px-3 py-2 ${copied ? "!text-lime !border-lime" : ""}`}
        >
          {copied ? "COPIED!" : "COPY"}
        </button>
        <button onClick={download} className="btn-arcade btn-amber rounded-md text-[9px] px-3 py-2">
          DOWNLOAD
        </button>
      </div>

      {/* code */}
      <div className={`codebox overflow-auto bg-[#08130e] ${expanded ? "max-h-[680px]" : "max-h-[380px]"}`}>
        <pre className="px-4 py-3 whitespace-pre text-[#9fc4b2]" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-center font-arcade text-[8px] tracking-wider py-2.5 text-dim hover:text-mint border-t-2 border-[#1d4736] transition-colors"
      >
        {expanded ? "▲ COLLAPSE SOURCE" : "▼ EXPAND FULL SOURCE"}
      </button>

      {/* deploy notes */}
      <div className="px-4 py-4 border-t-2 border-dashed border-[#1d4736] space-y-2.5">
        <p className="font-arcade text-[8px] text-amber tracking-wider">DEPLOY IN 3 STEPS</p>
        <ol className="text-[13px] text-dim leading-relaxed list-none space-y-1.5">
          <li>
            <span className="text-mint font-semibold">1.</span> Download <span className="text-fog font-mono">snake.php</span> above.
          </li>
          <li>
            <span className="text-mint font-semibold">2.</span> Upload it to any PHP 7.4+ host — nothing else to install.
          </li>
          <li>
            <span className="text-mint font-semibold">3.</span> Open it. Top-5 scores persist server-side in{" "}
            <span className="text-fog font-mono">snake_scores.json</span>.
          </li>
        </ol>
        <p className="text-[11.5px] text-dim/80 leading-relaxed pt-1">
          The same file is the API: <span className="font-mono text-mint/90">?api=scores</span> (GET) and{" "}
          <span className="font-mono text-mint/90">?api=submit</span> (POST). Difficulty is plain GET state —{" "}
          <span className="font-mono text-amber/90">?d=chill | classic | blitz</span>.
        </p>
      </div>
    </div>
  );
}
