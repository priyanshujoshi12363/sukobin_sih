import "dotenv/config";
import { classifyReport, classifyByKeywords, statusFromClassification } from "../src/utils/incidentAI.js";
import { llmAvailable } from "../src/utils/llm.js";

const REPORTS = [
  {
    text: "Bada landslide ho gaya hai Sela pass ke pehle, pura road band hai, koi gaadi nahi ja sakti. 3-4 din lagega clear hone me.",
    segmentName: "Dirang - Tawang (NH-13)",
    district: "Tawang",
    expect: "LANDSLIDE / blocking",
  },
  {
    text: "Water crossing the road near Kaziranga stretch, about 1 foot. Small cars turning back but trucks and pickup still crossing slowly.",
    segmentName: "Golaghat - Jorhat (NH-37)",
    district: "Golaghat",
    expect: "FLOOD / partial - trucks pass",
  },
  {
    text: "Half road gone due to slip at Rangpo side. Only bike can pass one by one. Very risky.",
    segmentName: "Rangpo - Singtam (NH-10)",
    district: "Pakyong",
    expect: "LANDSLIDE / restricted - bike only",
  },
  {
    text: "Bridge railing damaged but road ok. Traffic normal.",
    segmentName: "Guwahati - Goalpara (NH-127B)",
    district: "Goalpara",
    expect: "low severity, not blocking",
  },
  {
    text: "bandh called from tomorrow 6am, all vehicle stopped at Kangpokpi",
    segmentName: "Senapati - Kangpokpi (NH-2)",
    district: "Kangpokpi",
    expect: "BLOCKADE / blocking",
  },
  {
    text: "road thik hai",
    segmentName: "Jowai - Badarpur (NH-6)",
    district: "West Jaintia Hills",
    expect: "vague - low confidence",
  },
  {
    text: "Truck overturned near Lumshnong, one lane blocked, jam about 2 km. Crane coming, maybe 4 hours.",
    segmentName: "Jowai - Badarpur (NH-6)",
    district: "West Jaintia Hills",
    expect: "ACCIDENT / one lane, ~4h",
  },
  {
    text: "Heavy snowfall at Sela, road closed by BRO since morning. Temperature minus 6.",
    segmentName: "Dirang - Tawang (NH-13)",
    district: "Tawang",
    expect: "SNOW_ICE / blocking",
  },
];

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  console.log(`LLM available: ${llmAvailable()} (model ${process.env.OLLAMA_MODEL_FAST})\n`);

  let agree = 0;

  for (const r of REPORTS) {
    const kw = classifyByKeywords(r.text);
    const t0 = Date.now();
    const ai = await classifyReport(r);
    const ms = Date.now() - t0;

    const st = statusFromClassification(ai);
    if (kw.type === ai.type) agree++;

    console.log(`"${r.text.slice(0, 78)}${r.text.length > 78 ? "..." : ""}"`);
    console.log(`  expected   ${r.expect}`);
    console.log(
      `  keywords   ${pad(kw.type, 14)} ${pad(kw.severity, 9)} blocks=${kw.blocksTraffic}`
    );
    console.log(
      `  ${pad(ai.source, 10)} ${pad(ai.type, 14)} ${pad(ai.severity, 9)} blocks=${ai.blocksTraffic}  starts=${ai.startsInHours ?? "now"}  passableBy=[${ai.passableBy.join(",")}]  clear=${ai.estimatedClearanceHours ?? "-"}h  conf=${ai.confidence}  ${ms}ms`
    );
    console.log(`  -> segment status ${st.status}${st.defer ? `  (DEFERRED until ${st.applyAt.toISOString().slice(0,16).replace("T"," ")})` : ""}${ai.roadClear ? "  [road reported clear]" : ""}`);
    console.log(`  summary: ${ai.summary}`);
    if (ai.guardrail) console.log(`  guardrail: ${ai.guardrail}`);
    console.log("");
  }

  console.log(`keyword/LLM type agreement: ${agree}/${REPORTS.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
