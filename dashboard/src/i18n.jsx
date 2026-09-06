import { createContext, useContext, useMemo } from "react";
import { EN } from "./strings.en";
import TRANSLATIONS from "./strings.json";

/**
 * The same ten languages the apps speak. Each is written in its own script,
 * because a person looking for their language in a list they cannot read is
 * looking for the shape of their own name, not its English spelling.
 */
export const LANGS = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "as", name: "অসমীয়া" },
  { code: "bn", name: "বাংলা" },
  { code: "ne", name: "नेपाली" },
  { code: "mni", name: "Meiteilon" },
  { code: "kha", name: "Khasi" },
  { code: "lus", name: "Mizo" },
  { code: "nag", name: "Nagamese" },
  { code: "kok", name: "Kokborok" },
];

const STORAGE_KEY = "sukobin.dashboard.lang";

export function storedLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && LANGS.some((l) => l.code === v)) return v;
  } catch {
    // A private window or blocked site data is not a reason to fail to render.
  }
  return "en";
}

export function rememberLang(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* nothing worth doing about it */
  }
}

/**
 * Missing translations fall back to English rather than showing a key. A blank
 * or a raw key on a control room screen is worse than a word in the wrong
 * language.
 */
export function makeT(lang) {
  const table = lang === "en" ? null : TRANSLATIONS[lang];

  return function t(key, vars) {
    let s = (table && table[key]) || EN[key] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{${k}}`).join(String(v));
      }
    }
    return s;
  };
}

export const LangContext = createContext("en");

export function useT() {
  const lang = useContext(LangContext);
  return useMemo(() => makeT(lang), [lang]);
}

export function useLang() {
  return useContext(LangContext);
}
