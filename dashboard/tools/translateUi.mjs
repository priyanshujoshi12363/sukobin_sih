import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Fills dashboard/src/strings.json from strings.en.js, one language at a time,
 * through the same Ollama model the Android strings go through.
 *
 * Only missing keys are sent, so re-running after adding a line to the English
 * file costs one small request rather than a full retranslation.
 *
 *   node tools/translateUi.mjs              fill what is missing
 *   node tools/translateUi.mjs --force      redo everything
 *   node tools/translateUi.mjs --lang as    one language
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src");
const OUT = path.join(SRC, "strings.json");

// backend/.env holds the key. Reading it directly beats sourcing it, because a
// value like EMAIL_FROM=Sukobin <a@b.com> breaks a naive shell source.
function fromBackendEnv(key) {
  const p = path.join(HERE, "..", "..", "backend", ".env");
  if (!fs.existsSync(p)) return null;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    if (line.slice(0, i).trim() !== key) continue;
    return line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const OLLAMA_URL = process.env.OLLAMA_URL || fromBackendEnv("OLLAMA_URL") || "https://ollama.com";
const API_KEY = process.env.OLLAMA_API_KEY || fromBackendEnv("OLLAMA_API_KEY");
const MODEL =
  process.env.OLLAMA_TRANSLATE_MODEL || fromBackendEnv("OLLAMA_MODEL") || "gpt-oss:120b";

const LANGS = {
  hi: "Hindi",
  as: "Assamese",
  bn: "Bengali",
  ne: "Nepali",
  mni: "Manipuri (Meiteilon)",
  kha: "Khasi",
  lus: "Mizo (Lushai)",
  nag: "Nagamese",
  kok: "Kokborok",
};

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
const BATCH = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function systemPrompt(language) {
  return `You translate the interface of a road-conditions control dashboard used by government transport officers in North East India, from English into ${language}.

Rules:
- Return ONLY a JSON object with exactly the same keys you were given.
- Translate the value, never the key.
- Keep every {placeholder} exactly as it appears, spelled the same. You may move it within the sentence.
- Keep Latin-script proper nouns and highway codes as they are: Sukobin, NH-2, AUC, Brier, GPS.
- These are labels on a dense screen. Keep them short - a label that wraps to three lines is worse than a slightly stiff one.
- Where ${language} has no settled technical word, use the word an officer would actually say, including a borrowed English one. Do not invent vocabulary.
- Match the register: plain, factual, no exclamation marks.`;
}

async function translateBatch(language, payload, attempt = 1) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: systemPrompt(language) },
        { role: "user", content: JSON.stringify(payload, null, 1) },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    if (attempt < 3) {
      await sleep(2000 * attempt);
      return translateBatch(language, payload, attempt + 1);
    }
    throw new Error(`ollama ${res.status}`);
  }

  const text = (await res.json())?.message?.content || "";
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    if (attempt < 3) {
      await sleep(1500 * attempt);
      return translateBatch(language, payload, attempt + 1);
    }
    throw new Error("model did not return JSON");
  }
}

// A translation that dropped or renamed a {placeholder} would render a hole in
// the sentence, so it is rejected and the English kept.
function placeholdersOf(s) {
  return (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
}

async function main() {
  if (!API_KEY) {
    console.error("\nOLLAMA_API_KEY is not set, and backend/.env has none.\n");
    process.exit(1);
  }

  const { EN } = await import("file://" + path.join(SRC, "strings.en.js").replace(/\\/g, "/"));
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const out = FORCE ? {} : existing;

  console.log(`\nTRANSLATING DASHBOARD  model ${MODEL}`);
  console.log(`${Object.keys(EN).length} strings\n`);

  for (const [code, language] of Object.entries(LANGS)) {
    if (ONLY && ONLY !== code) continue;

    out[code] = out[code] || {};
    const missing = Object.keys(EN).filter((k) => !out[code][k]);

    if (missing.length === 0) {
      console.log(`  ${language.padEnd(22)} already complete`);
      continue;
    }

    let done = 0;
    let rejected = 0;

    for (let i = 0; i < missing.length; i += BATCH) {
      const keys = missing.slice(i, i + BATCH);
      const payload = Object.fromEntries(keys.map((k) => [k, EN[k]]));
      const got = await translateBatch(language, payload);

      for (const k of keys) {
        const v = got[k];
        if (typeof v !== "string" || !v.trim()) continue;
        if (placeholdersOf(v) !== placeholdersOf(EN[k])) {
          rejected++;
          continue;
        }
        out[code][k] = v.trim();
        done++;
      }

      process.stdout.write(`\r  ${language.padEnd(22)} ${done}/${missing.length}   `);
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    }

    const note = rejected ? `  (${rejected} kept in English - placeholder changed)` : "";
    console.log(`\r  ${language.padEnd(22)} ${done}/${missing.length} done${note}        `);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

  console.log("\nCOVERAGE");
  const total = Object.keys(EN).length;
  for (const [code, language] of Object.entries(LANGS)) {
    const have = Object.keys(out[code] || {}).filter((k) => k in EN).length;
    const pct = Math.round((have / total) * 100);
    console.log(`  ${language.padEnd(22)} ${String(have).padStart(3)}/${total}  ${pct}%`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("\ntranslation failed:", e.message);
  process.exit(1);
});
