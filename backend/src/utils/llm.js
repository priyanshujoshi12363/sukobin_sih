const OLLAMA_URL = process.env.OLLAMA_URL || "https://ollama.com";
const API_KEY = process.env.OLLAMA_API_KEY || "";
const MODEL = process.env.OLLAMA_MODEL || "gpt-oss:120b";
const MODEL_FAST = process.env.OLLAMA_MODEL_FAST || "gpt-oss:20b";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 45000;
const RETRIES = Number(process.env.OLLAMA_RETRIES) || 2;

export const llmAvailable = () => Boolean(API_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) return null;

  const open = body[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function chat(messages, opts = {}) {
  if (!llmAvailable()) return { ok: false, error: "no OLLAMA_API_KEY", text: null };

  const {
    model = opts.fast ? MODEL_FAST : MODEL,
    temperature = 0.2,
    json = false,
    timeoutMs = TIMEOUT_MS,
    retries = RETRIES,
  } = opts;

  const body = {
    model,
    stream: false,
    messages,
    options: { temperature },
  };
  if (json) body.format = "json";

  let lastErr = "unknown";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        lastErr = `http ${res.status}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
      } else {
        const data = await res.json();
        const text = data?.message?.content ?? "";
        return { ok: true, text, model, raw: data };
      }
    } catch (e) {
      lastErr = e.message || "request failed";
    }
    if (attempt < retries) await sleep(400 * (attempt + 1));
  }

  return { ok: false, error: lastErr, text: null };
}

export async function chatJson(messages, opts = {}) {
  const res = await chat(messages, { ...opts, json: true });
  if (!res.ok) return { ok: false, error: res.error, data: null };
  const data = extractJson(res.text);
  if (!data) return { ok: false, error: "unparseable json", data: null, text: res.text };
  return { ok: true, data, model: res.model };
}

export { extractJson };
