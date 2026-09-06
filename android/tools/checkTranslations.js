/**
 * Audits every generated strings.xml against the English source.
 *
 * The failure that matters is a format specifier that changed: Android throws
 * IllegalFormatException at runtime, only on the screen that uses the string,
 * and only for users on that language. It will not show up in a build. So this
 * runs before the build, not after.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANDROID = path.resolve(HERE, "..");

const APPS = ["customer", "mart", "partner", "officer"];
const DIRS = {
  hi: "values-hi", bn: "values-bn", as: "values-as", ne: "values-ne",
  mni: "values-b+mni", kha: "values-b+kha", lus: "values-b+lus",
  nag: "values-b+nag", kok: "values-b+kok",
};

const SPEC = /%(?:\d+\$)?[sdfx]|%%/g;
const specs = (s) => (String(s).match(SPEC) || []).slice().sort();

function parse(file) {
  if (!fs.existsSync(file)) return null;
  const xml = fs.readFileSync(file, "utf8");

  const strings = {};
  let m;
  const sRe = /<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g;
  while ((m = sRe.exec(xml))) strings[m[1]] = m[2];

  const plurals = {};
  const pRe = /<plurals\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/plurals>/g;
  while ((m = pRe.exec(xml))) {
    const items = {};
    const iRe = /<item\s+quantity="([^"]+)"\s*>([\s\S]*?)<\/item>/g;
    let im;
    while ((im = iRe.exec(m[2]))) items[im[1]] = im[2];
    plurals[m[1]] = items;
  }

  return { strings, plurals, raw: xml };
}

let problems = 0;
let checked = 0;

console.log("\nTRANSLATION AUDIT\n");

for (const app of APPS) {
  const base = parse(path.join(ANDROID, app, "src/main/res/values/strings.xml"));
  const rows = [];

  for (const [lang, dir] of Object.entries(DIRS)) {
    const t = parse(path.join(ANDROID, app, "src/main/res", dir, "strings.xml"));
    if (!t) {
      rows.push(`${lang}: MISSING`);
      problems++;
      continue;
    }

    const issues = [];

    // 1. format specifiers must survive exactly
    for (const [key, value] of Object.entries(t.strings)) {
      if (!(key in base.strings)) {
        issues.push(`extra key ${key}`);
        continue;
      }
      const a = specs(base.strings[key]);
      const b = specs(value);
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
        issues.push(`${key}: ${a.join(",") || "none"} -> ${b.join(",") || "none"}`);
      }
      checked++;
    }

    // 2. plurals must carry every quantity the English has
    for (const [name, items] of Object.entries(base.plurals)) {
      const got = t.plurals[name];
      if (!got) continue;
      for (const q of Object.keys(items)) {
        if (!(q in got)) issues.push(`plural ${name} missing quantity "${q}"`);
        else {
          const a = specs(items[q]);
          const b = specs(got[q]);
          if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
            issues.push(`plural ${name}/${q}: specifiers changed`);
          }
        }
        checked++;
      }
    }

    // 3. unescaped apostrophes break aapt
    const bareQuote = /(?<!\\)'/g;
    for (const [key, value] of Object.entries(t.strings)) {
      if (bareQuote.test(value)) issues.push(`${key}: unescaped apostrophe`);
      bareQuote.lastIndex = 0;
    }

    const missing = Object.keys(base.strings).filter((k) => !(k in t.strings)).length;

    if (issues.length) {
      problems += issues.length;
      rows.push(`${lang}: ${issues.length} PROBLEM(S)`);
      issues.slice(0, 4).forEach((i) => rows.push(`      ${i}`));
    } else {
      rows.push(`${lang}: ok${missing ? `  (${missing} fall back to English)` : ""}`);
    }
  }

  console.log(`${app}`);
  rows.forEach((r) => console.log(`  ${r}`));
  console.log("");
}

console.log(`${checked} translated units checked, ${problems} problem(s)\n`);
process.exit(problems ? 1 : 0);
