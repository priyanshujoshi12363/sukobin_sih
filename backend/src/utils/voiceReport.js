import { chatJson, llmAvailable } from "./llm.js";
import { classifyByKeywords, applyGuardrails } from "./incidentAI.js";
import { INCIDENT_TYPES, INCIDENT_SEVERITY } from "../models/incident.model.js";
import { LANGUAGE_NAMES } from "./i18n.js";

/**
 * A driver who has just pulled over on a hill road should not have to pick a
 * category, judge a severity and type a description in English. They should be
 * able to say what they see, in their own language, and have the platform work
 * the rest out.
 *
 * This takes that raw speech and returns a structured report plus an English
 * translation, so the district officer and the dashboard read one language
 * while the driver spoke another. The original words are always kept: the
 * translation is a convenience, not the record.
 */

const SYSTEM = `You read road hazard reports spoken by drivers and field officers in North East India.

They speak Hindi, Assamese, Bengali, Nepali, Manipuri, Khasi, Mizo, Nagamese, Kokborok, English, or a mix of two. Transcription is often rough. Read for meaning, not spelling.

Return ONLY a JSON object:

{
  "detectedLanguage": "ISO code: en, hi, as, bn, mni, kha, lus, nag, ne, kok",
  "english": "faithful English translation of what they said",
  "summary": "one short English sentence an officer can act on",
  "type": "one of: ${INCIDENT_TYPES.join(", ")}",
  "severity": "one of: ${INCIDENT_SEVERITY.join(", ")}",
  "blocksTraffic": true or false,
  "passableBy": ["bike","auto","car","pickup","truck"] - which can still get through, [] if none,
  "estimatedClearanceHours": number or null,
  "roadClear": true only if they are saying the road is FINE or has REOPENED,
  "confidence": 0 to 1,
  "needsReview": true if the speech was too unclear to be sure
}

Rules:
- Never invent detail that was not said. If they did not say how long, use null.
- "ek lane khula hai" / "one side open" means blocksTraffic false, not true.
- "kuch nahi ja sakta" / "nothing can pass" means blocksTraffic true, passableBy [].
- A landslide or flood that blocks everything is CRITICAL. One lane open is MEDIUM.
- If they are reporting the road is now fine, set roadClear true and severity LOW.
- If you cannot tell what happened, use type OTHER and set needsReview true.`;

const ALL_VEHICLES = ["bike", "auto", "car", "pickup", "truck"];

const oneOf = (value, allowed, fallback) =>
  allowed.includes(String(value || "").toUpperCase())
    ? String(value).toUpperCase()
    : fallback;

function coerce(raw, fallback, spoken) {
  const type = oneOf(raw?.type, INCIDENT_TYPES, fallback.type);
  const severity = oneOf(raw?.severity, INCIDENT_SEVERITY, fallback.severity);

  const passableBy = Array.isArray(raw?.passableBy)
    ? raw.passableBy.map((v) => String(v).toLowerCase()).filter((v) => ALL_VEHICLES.includes(v))
    : fallback.passableBy;

  // The model tends to answer 0 rather than null when nobody said how long.
  // "0 hours to clear" on a blocked road reads as "already clear", so treat it
  // as unknown unless the road really is open.
  const rawHours = Number(raw?.estimatedClearanceHours);
  const hours = rawHours === 0 && !raw?.roadClear ? NaN : rawHours;

  return {
    detectedLanguage: String(raw?.detectedLanguage || "").slice(0, 3).toLowerCase() || null,
    english: String(raw?.english || "").trim() || spoken,
    summary: String(raw?.summary || "").trim().slice(0, 300),
    type,
    severity,
    blocksTraffic: Boolean(raw?.blocksTraffic),
    passableBy,
    estimatedClearanceHours: Number.isFinite(hours) && hours >= 0 ? hours : null,
    roadClear: Boolean(raw?.roadClear),
    confidence: Number.isFinite(Number(raw?.confidence)) ? Number(raw.confidence) : 0.5,
    needsReview: Boolean(raw?.needsReview),
  };
}

/**
 * @param spokenText what the driver actually said, transcribed on the device
 * @param spokenLang the language the device was listening in, as a hint only
 */
export async function understandSpokenReport({
  spokenText,
  spokenLang = null,
  segmentName = null,
  district = null,
  photoCount = 0,
} = {}) {
  const text = String(spokenText || "").trim();

  // The keyword classifier is the floor. It handles Hinglish well and needs no
  // network, so a report is never lost because the model was unreachable.
  const fallback = classifyByKeywords(text);

  const base = {
    detectedLanguage: spokenLang,
    english: text,
    summary: "",
    ...fallback,
    confidence: 0.35,
    needsReview: true,
    source: "keywords",
  };

  if (!llmAvailable()) {
    return { ...base, note: "AI unavailable - read by keywords only" };
  }
  if (text.length < 4) {
    return { ...base, note: "Too short to read" };
  }

  const context = [
    spokenLang ? `The phone was listening in ${LANGUAGE_NAMES[spokenLang] || spokenLang}.` : null,
    segmentName ? `Road: ${segmentName}` : null,
    district ? `District: ${district}` : null,
    photoCount ? `${photoCount} photo(s) attached.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await chatJson(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${context}\n\nWhat they said:\n"""${text}"""` },
    ],
    { fast: true, temperature: 0.1 }
  );

  if (!res.ok) {
    return { ...base, note: "AI did not answer - read by keywords only" };
  }

  const understood = coerce(res.data, fallback, text);

  // The same lane-open / nothing-passes guardrails the typed path uses, applied
  // to the English translation so they work whatever language was spoken.
  const guarded = applyGuardrails(
    {
      type: understood.type,
      severity: understood.severity,
      blocksTraffic: understood.blocksTraffic,
      passableBy: understood.passableBy,
      estimatedClearanceHours: understood.estimatedClearanceHours,
      roadClear: understood.roadClear,
    },
    `${text} ${understood.english}`
  );

  return {
    ...understood,
    ...guarded,
    source: "llm",
    note: null,
  };
}

/**
 * The description stored on the incident. Officers and the dashboard read
 * English, but the driver's own words are the record, so both are kept.
 */
export function buildDescription({ spokenText, english, summary, detectedLanguage }) {
  const original = String(spokenText || "").trim();
  const translated = String(english || "").trim();

  if (!original) return summary || "";
  if (!translated || translated === original) return original;

  const label = LANGUAGE_NAMES[detectedLanguage] || detectedLanguage || "original";
  return `${translated}\n\n[${label}] ${original}`;
}
