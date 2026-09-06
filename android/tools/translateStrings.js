/**
 * Translates every app's strings.xml into the languages spoken along the NER
 * corridors, using the same Ollama model the backend already uses.
 *
 *   node tools/translateStrings.js                  all apps, all languages
 *   node tools/translateStrings.js --app officer    one app
 *   node tools/translateStrings.js --lang hi,ne     some languages
 *   node tools/translateStrings.js --force          ignore the cache
 *
 * Why a pipeline rather than hand-written files: 635 English strings across
 * four apps times nine languages is 5,715 translations. Hand-writing that is
 * not honest work, and a half-finished folder is worse than none because
 * Android falls back per-string and the screen ends up half in each language.
 *
 * Everything here is machine translation and is marked as such in each file.
 * It needs a native speaker before a real deployment. What the pipeline
 * guarantees is that it is *safe*: format specifiers survive, XML stays valid,
 * and anything the model gets wrong falls back to English rather than crashing.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANDROID = path.resolve(HERE, "..");
const CACHE_FILE = path.join(HERE, ".translation-cache.json");

// Read the backend's .env directly. Sourcing it through the shell breaks on
// unquoted values like EMAIL_FROM=Sukobin <a@b.com>.
const SPLIT_LINES = new RegExp("\r?\n");

function fromBackendEnv(key) {
  try {
    const file = path.resolve(HERE, "../../backend/.env");
    const line = fs
      .readFileSync(file, "utf8")
      .split(SPLIT_LINES)
      .find((l) => l.trimStart().startsWith(key + "="));
    if (!line) return "";
    return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

const OLLAMA_URL = process.env.OLLAMA_URL || fromBackendEnv("OLLAMA_URL") || "https://ollama.com";
const API_KEY = process.env.OLLAMA_API_KEY || fromBackendEnv("OLLAMA_API_KEY");
const MODEL =
  process.env.OLLAMA_TRANSLATE_MODEL || fromBackendEnv("OLLAMA_MODEL") || "gpt-oss:120b";
const BATCH = Number(process.env.TRANSLATE_BATCH) || 25;

const APPS = ["customer", "mart", "partner", "officer"];

/**
 * Android resource qualifier per language.
 *
 * The four with a two-letter ISO 639-1 code use it directly. The rest need the
 * BCP-47 `b+` form. Note kok: the platform uses "kok" throughout for Kokborok,
 * but ISO 639-3 "kok" is actually Konkani (Kokborok is "trp"). Keeping the
 * codebase's own name here rather than silently diverging from the API.
 */
const LANGS = {
  hi: { dir: "values-hi", name: "Hindi", script: "Devanagari" },
  bn: { dir: "values-bn", name: "Bengali", script: "Bengali" },
  as: { dir: "values-as", name: "Assamese", script: "Assamese" },
  ne: { dir: "values-ne", name: "Nepali", script: "Devanagari" },
  mni: { dir: "values-b+mni", name: "Manipuri (Meiteilon)", script: "Bengali script as commonly written" },
  kha: { dir: "values-b+kha", name: "Khasi", script: "Latin" },
  lus: { dir: "values-b+lus", name: "Mizo (Lushai)", script: "Latin" },
  nag: { dir: "values-b+nag", name: "Nagamese", script: "Latin" },
  kok: { dir: "values-b+kok", name: "Kokborok", script: "Latin" },
};

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

const targetApps = value("--app") ? value("--app").split(",") : APPS;
const targetLangs = value("--lang") ? value("--lang").split(",") : Object.keys(LANGS);
const force = flag("--force");

// ── the source file ─────────────────────────────────────────────────────────

function readStrings(app) {
  const file = path.join(ANDROID, app, "src/main/res/values/strings.xml");
  const xml = fs.readFileSync(file, "utf8");

  const strings = [];
  const plurals = [];

  const stringRe = /<string\s+name="([^"]+)"([^>]*)>([\s\S]*?)<\/string>/g;
  let m;
  while ((m = stringRe.exec(xml))) {
    const [, name, attrs, body] = m;
    if (/translatable\s*=\s*"false"/.test(attrs)) continue;
    strings.push({ name, text: unescapeXml(body) });
  }

  const pluralRe = /<plurals\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/plurals>/g;
  while ((m = pluralRe.exec(xml))) {
    const [, name, body] = m;
    const items = [];
    const itemRe = /<item\s+quantity="([^"]+)"\s*>([\s\S]*?)<\/item>/g;
    let im;
    while ((im = itemRe.exec(body))) {
      items.push({ quantity: im[1], text: unescapeXml(im[2]) });
    }
    if (items.length) plurals.push({ name, items });
  }

  return { strings, plurals };
}

const unescapeXml = (s) =>
  String(s)
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

// Apostrophes and ampersands are the two that actually break aapt.
const escapeXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');

// ── the part that keeps this safe ───────────────────────────────────────────

const SPEC_RE = /%(\d+\$)?[sdfx]|%%/g;

const specsOf = (s) => (String(s).match(SPEC_RE) || []).slice().sort();

/**
 * A translation that drops or renames a format specifier crashes the app at
 * runtime with an IllegalFormatException, and only on the screen that uses it.
 * Anything that fails this check is discarded and the English is kept.
 */
function specsMatch(source, translated) {
  const a = specsOf(source);
  const b = specsOf(translated);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function validate(source, translated) {
  const t = String(translated || "").trim();
  if (!t) return { ok: false, why: "empty" };
  if (!specsMatch(source, t)) return { ok: false, why: "format specifiers changed" };
  if (t.length > source.length * 6 + 40) return { ok: false, why: "implausibly long" };
  if (/<\/?[a-z]/i.test(t) && !/<\/?[a-z]/i.test(source)) return { ok: false, why: "markup invented" };
  return { ok: true, text: t };
}

// ── the model ───────────────────────────────────────────────────────────────

const cache = fs.existsSync(CACHE_FILE) && !force
  ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
  : {};

const saveCache = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function systemPrompt(lang) {
  const l = LANGS[lang];
  return `You translate Android app strings into ${l.name}, written in ${l.script}.

The app is used in North East India by lorry drivers, shopkeepers and district road officers. It reports blocked roads, landslides, floods and deliveries. Translate for someone reading a phone at the roadside: short, plain, no officialese.

Rules you must not break:
- Keep every format placeholder EXACTLY as written: %1$s, %2$d, %s, %d. Same count, same numbers, same letters. Never translate or reorder the number part.
- Do not translate: brand names (Sukobin), road codes (NH-2, NH-10), units (km, kg, mm, h), the currency symbol.
- Keep it about as short as the English. These are buttons and labels on a small screen.
- If a term has no natural equivalent, keep the English word rather than inventing one.
- Return ONLY a JSON object mapping each key to its translation. No commentary.`;
}

async function translateBatch(lang, entries, attempt = 1) {
  const payload = Object.fromEntries(entries.map((e) => [e.key, e.text]));

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
        { role: "system", content: systemPrompt(lang) },
        { role: "user", content: JSON.stringify(payload, null, 1) },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    if (attempt < 3) {
      await sleep(2000 * attempt);
      return translateBatch(lang, entries, attempt + 1);
    }
    throw new Error(`ollama ${res.status}`);
  }

  const data = await res.json();
  const text = data?.message?.content || "";

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
      return translateBatch(lang, entries, attempt + 1);
    }
    return {};
  }
}

// ── writing the file ────────────────────────────────────────────────────────

function writeXml(app, lang, strings, plurals, stats) {
  const dir = path.join(ANDROID, app, "src/main/res", LANGS[lang].dir);
  fs.mkdirSync(dir, { recursive: true });

  const header =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<!--\n` +
    `  ${LANGS[lang].name}. Machine translated, then checked for safe format\n` +
    `  specifiers and valid XML. Needs a native speaker's review before this\n` +
    `  ships to real officers and drivers.\n\n` +
    `  ${stats.translated} of ${stats.total} strings translated; the rest fall\n` +
    `  back to English rather than showing a bad guess.\n\n` +
    // aapt rejects "--" inside an XML comment, so no flags in this note.
    `  Regenerate with tools/translateStrings.js, app ${app}, language ${lang}.\n` +
    `-->\n<resources>\n`;

  const body = [
    ...strings.map((s) => `    <string name="${s.name}">${escapeXml(s.text)}</string>`),
    ...plurals.map(
      (p) =>
        `    <plurals name="${p.name}">\n` +
        p.items.map((i) => `        <item quantity="${i.quantity}">${escapeXml(i.text)}</item>`).join("\n") +
        `\n    </plurals>`
    ),
  ].join("\n");

  fs.writeFileSync(path.join(dir, "strings.xml"), header + body + "\n</resources>\n");
}

// ── run ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error("\nOLLAMA_API_KEY is not set. Export it, or run from backend/.env:\n");
    console.error("  set -a; source ../backend/.env; set +a; node tools/translateStrings.js\n");
    process.exit(1);
  }

  console.log(`\nTRANSLATING  model ${MODEL}\n`);

  for (const app of targetApps) {
    const { strings, plurals } = readStrings(app);
    console.log(`${app}: ${strings.length} strings, ${plurals.length} plurals`);

    for (const lang of targetLangs) {
      if (!LANGS[lang]) {
        console.log(`  skipping unknown language ${lang}`);
        continue;
      }

      // Every translatable unit, flattened so plural items batch alongside.
      const units = [
        ...strings.map((s) => ({ key: s.name, text: s.text, kind: "string" })),
        ...plurals.flatMap((p) =>
          p.items.map((i) => ({
            key: `${p.name}#${i.quantity}`,
            text: i.text,
            kind: "plural",
            plural: p.name,
            quantity: i.quantity,
          }))
        ),
      ];

      const out = {};
      const todo = [];

      for (const u of units) {
        const ck = `${lang}::${u.text}`;
        if (cache[ck]) out[u.key] = cache[ck];
        else todo.push(u);
      }

      let rejected = 0;

      for (let i = 0; i < todo.length; i += BATCH) {
        const slice = todo.slice(i, i + BATCH);
        process.stdout.write(
          `\r  ${LANGS[lang].name.padEnd(22)} ${Math.min(i + BATCH, todo.length)}/${todo.length} new` +
          `${rejected ? `  (${rejected} rejected)` : ""}   `
        );

        let answer = {};
        try {
          answer = await translateBatch(lang, slice);
        } catch (e) {
          process.stdout.write(`\n    batch failed: ${e.message}\n`);
          continue;
        }

        for (const u of slice) {
          const check = validate(u.text, answer[u.key]);
          if (check.ok) {
            out[u.key] = check.text;
            cache[`${lang}::${u.text}`] = check.text;
          } else {
            rejected++;
          }
        }
        saveCache();
      }

      // Anything the model got wrong is simply left out. Android falls back to
      // the English string, which is always better than a broken one.
      const outStrings = strings
        .filter((s) => out[s.name])
        .map((s) => ({ name: s.name, text: out[s.name] }));

      const outPlurals = plurals
        .map((p) => ({
          name: p.name,
          items: p.items
            .filter((i) => out[`${p.name}#${i.quantity}`])
            .map((i) => ({ quantity: i.quantity, text: out[`${p.name}#${i.quantity}`] })),
        }))
        // A partial plural is worse than none: Android needs the quantity the
        // device asks for, so only keep a set that survived intact.
        .filter((p) => p.items.length === plurals.find((x) => x.name === p.name).items.length);

      writeXml(app, lang, outStrings, outPlurals, {
        translated: outStrings.length + outPlurals.length,
        total: strings.length + plurals.length,
      });

      const pct = Math.round(((outStrings.length + outPlurals.length) / (strings.length + plurals.length)) * 100);
      process.stdout.write(
        `\r  ${LANGS[lang].name.padEnd(22)} ${outStrings.length} strings + ${outPlurals.length} plurals` +
        `  ${pct}%${rejected ? `  (${rejected} kept as English)` : ""}          \n`
      );
    }
    console.log("");
  }

  console.log("done. Build to confirm the resources compile.\n");
}

main().catch((e) => {
  console.error("\ntranslation failed:", e.message);
  process.exit(1);
});
