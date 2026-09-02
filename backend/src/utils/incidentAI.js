import { chatJson, llmAvailable } from "./llm.js";
import { INCIDENT_TYPES, INCIDENT_SEVERITY } from "../models/incident.model.js";

const KEYWORD_TYPE = [
  [/\b(landslide|land slide|mudslide|boulder|debris|slip|slide|rockfall)\b/i, "LANDSLIDE"],
  [/\b(flood|flooded|submerg|inundat|water logging|waterlogg|overflow|washed away)\b/i, "FLOOD"],
  [/\b(bridge|culvert|span)\b.*\b(collapse|damag|crack|broken|washed|down)\b/i, "BRIDGE_DAMAGE"],
  [/\b(snow|ice|icy|blizzard|avalanche|frozen)\b/i, "SNOW_ICE"],
  [/\b(tree|bamboo)\b.*\b(fall|fell|fallen|uproot|down)\b/i, "TREE_FALL"],
  [/\b(pothole|crack|subsid|cave.?in|road damage|broken road|surface damage)\b/i, "ROAD_DAMAGE"],
  [/\b(accident|collision|overturn|crash|truck.*turn)\b/i, "ACCIDENT"],
  [/\b(bandh|blockade|protest|strike|agitation|dharna|road block)\b/i, "BLOCKADE"],
  [/\b(construction|repair work|widening|maintenance|bro work)\b/i, "CONSTRUCTION"],
  [/\b(jam|congestion|heavy traffic|queue|standstill)\b/i, "CONGESTION"],
];

const KEYWORD_SEVERITY = [
  [/\b(completely|fully|totally)\b.*\b(block|cut off|closed|impassab)\b/i, "CRITICAL"],
  [/\b(cut off|stranded|impassab|no vehicle|nothing can pass|complete closure)\b/i, "CRITICAL"],
  [/\b(heavy|major|severe|serious|large)\b/i, "HIGH"],
  [/\b(partial|one lane|single lane|half|slow|restricted)\b/i, "MEDIUM"],
  [/\b(minor|small|light|slight)\b/i, "LOW"],
];

const BLOCKING_TYPES = new Set(["LANDSLIDE", "FLOOD", "BRIDGE_DAMAGE", "BLOCKADE"]);

const ALL_VEHICLES = ["bike", "auto", "car", "pickup", "truck"];

const CLEAR_PHRASE =
  /\b(road (is )?(ok|okay|fine|clear|open|normal)|thik hai|theek hai|sab thik|no problem|nothing to report|traffic normal|cleared|restored|khula hai)\b/i;

const FUTURE_PHRASE = /\b(tomorrow|kal se|from \d{1,2}\s?(am|pm)|next week|day after|expected|will start|likely)\b/i;

export function classifyByKeywords(text = "") {
  const t = String(text);

  let type = "OTHER";
  for (const [re, val] of KEYWORD_TYPE) {
    if (re.test(t)) {
      type = val;
      break;
    }
  }

  let severity = "MEDIUM";
  for (const [re, val] of KEYWORD_SEVERITY) {
    if (re.test(t)) {
      severity = val;
      break;
    }
  }

  const roadClear = type === "OTHER" && CLEAR_PHRASE.test(t);

  const blocksTraffic =
    !roadClear &&
    (/\b(block|cut off|closed|impassab|stranded|cannot pass|can't pass|no movement|band hai)\b/i.test(t) ||
      (BLOCKING_TYPES.has(type) && (severity === "CRITICAL" || severity === "HIGH")));

  return {
    roadClear,
    type,
    severity: roadClear ? "LOW" : severity,
    blocksTraffic,
    passableBy: blocksTraffic ? [] : ALL_VEHICLES,
    startsInHours: FUTURE_PHRASE.test(t) ? 12 : null,
    estimatedClearanceHours: null,
    summary: t.slice(0, 160),
    confidence: type === "OTHER" && !roadClear ? 0.3 : 0.65,
    source: "keywords",
  };
}

const SYSTEM = `You classify road incident reports filed by government field officers in North East India.
Officers write in English, Hinglish, or mixed local language, often in a hurry on a phone with poor signal.
Return ONLY a JSON object with these keys:
  roadClear: boolean, true if the report says the road is FINE / open / cleared and reports no problem
  type: one of ${INCIDENT_TYPES.join(", ")}
  severity: one of ${INCIDENT_SEVERITY.join(", ")}
  blocksTraffic: boolean, true only if NO vehicle can pass ONCE THE EVENT IS ACTIVE
  passableBy: array from ["bike","auto","car","pickup","truck"] that can still pass
  startsInHours: number or null. null means happening NOW. Use a positive number if the report
    describes something that starts later (e.g. "bandh from tomorrow 6am" -> roughly 12 to 24)
  estimatedClearanceHours: number or null, only if the report states or clearly implies it
  summary: one factual sentence, max 20 words, no speculation
  confidence: number 0 to 1
Rules:
- Do not invent detail that is not in the report.
- If the road is fine and nothing is wrong, set roadClear true, type OTHER, severity LOW, blocksTraffic false.
- A landslide or flood that only narrows the road is RESTRICTED-level, not blocking: blocksTraffic false, passableBy typically ["bike"] or ["bike","auto"].
- A strike, bandh, protest or road blockade is type BLOCKADE, never OTHER.
- "one lane blocked", "single lane open", "traffic moving slowly" all mean vehicles STILL PASS:
  blocksTraffic false. Only set blocksTraffic true when nothing at all gets through.
- If the report is too vague to classify, use type OTHER and confidence below 0.4.`;

function coerce(data, fallback) {
  if (!data || typeof data !== "object") return fallback;

  const roadClear = data.roadClear === true;

  let type = INCIDENT_TYPES.includes(data.type) ? data.type : fallback.type;
  if (type === "OTHER" && fallback.type !== "OTHER") type = fallback.type;

  const severity = INCIDENT_SEVERITY.includes(data.severity) ? data.severity : fallback.severity;

  const allowed = ["bike", "auto", "car", "pickup", "truck"];
  const passableBy = Array.isArray(data.passableBy)
    ? data.passableBy.filter((v) => allowed.includes(v))
    : fallback.passableBy;

  const blocksTraffic =
    typeof data.blocksTraffic === "boolean" ? data.blocksTraffic : fallback.blocksTraffic;

  const hours = Number(data.estimatedClearanceHours);
  const starts = Number(data.startsInHours);
  const startsInHours = Number.isFinite(starts) && starts > 0 ? starts : null;

  if (roadClear) {
    return {
      roadClear: true,
      type: "OTHER",
      severity: "LOW",
      blocksTraffic: false,
      passableBy: allowed,
      startsInHours: null,
      estimatedClearanceHours: null,
      summary: typeof data.summary === "string" ? data.summary.slice(0, 200) : fallback.summary,
      confidence: Number.isFinite(Number(data.confidence))
        ? Math.max(0, Math.min(1, Number(data.confidence)))
        : 0.5,
      source: "llm",
    };
  }

  return {
    roadClear: false,
    type,
    severity,
    blocksTraffic: blocksTraffic || passableBy.length === 0,
    passableBy: blocksTraffic ? [] : passableBy,
    startsInHours,
    estimatedClearanceHours: Number.isFinite(hours) && hours > 0 ? hours : null,
    summary: typeof data.summary === "string" ? data.summary.slice(0, 200) : fallback.summary,
    confidence: Number.isFinite(Number(data.confidence))
      ? Math.max(0, Math.min(1, Number(data.confidence)))
      : 0.5,
    source: "llm",
  };
}

export async function classifyReport({ text, segmentName, district, photoCount = 0 } = {}) {
  const fallback = classifyByKeywords(text);
  if (!llmAvailable() || !text || text.trim().length < 4) return fallback;

  const context = [
    segmentName ? `Road segment: ${segmentName}` : null,
    district ? `District: ${district}` : null,
    photoCount ? `${photoCount} photo(s) attached` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await chatJson(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${context}\n\nReport:\n${text}` },
    ],
    { fast: true, temperature: 0.1 }
  );

  if (!res.ok) return fallback;
  return applyGuardrails(coerce(res.data, fallback), text);
}

const PARTIAL_LANE =
  /\b(one lane|single lane|1 lane|ek lane|half road|one side|alternate traffic|one.?way)\b/i;
const TOTAL_BLOCK =
  /\b(both lane|all lane|fully block|completely block|totally block|no vehicle|koi gaadi nahi|cut off|road closed|band hai)\b/i;

export function applyGuardrails(c, text = "") {
  const t = String(text);

  if (c.blocksTraffic && PARTIAL_LANE.test(t) && !TOTAL_BLOCK.test(t)) {
    return {
      ...c,
      blocksTraffic: false,
      passableBy: c.passableBy.length ? c.passableBy : ALL_VEHICLES,
      guardrail: "partial-lane: report describes a lane still open",
    };
  }

  if (!c.blocksTraffic && c.passableBy.length === 0 && !c.roadClear) {
    return { ...c, blocksTraffic: true, guardrail: "no passable vehicle class" };
  }

  return c;
}

export function statusFromClassification(c) {
  if (c.roadClear) return { status: "OPEN", applyAt: null, defer: false };

  if (c.startsInHours) {
    return {
      status: c.blocksTraffic ? "BLOCKED" : "RESTRICTED",
      applyAt: new Date(Date.now() + c.startsInHours * 3600000),
      defer: true,
    };
  }

  let status = "SLOW";
  if (c.blocksTraffic) status = "BLOCKED";
  else if (c.passableBy.length && c.passableBy.length <= 2) status = "RESTRICTED";
  else if (c.severity === "HIGH" || c.severity === "CRITICAL") status = "RESTRICTED";

  return { status, applyAt: null, defer: false };
}
