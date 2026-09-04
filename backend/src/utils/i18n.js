// Alert copy in the languages actually spoken along these corridors.
// Templates take {road}, {reason}, {pct}, {hours}, {district}, {status}.
//
// English and Hindi are authoritative. The others were written to be
// understood rather than to be literary, and are meant to be corrected by a
// native speaker before any real deployment.

export const LANGUAGES = ["en", "hi", "as", "bn", "mni", "kha", "lus", "nag", "ne", "kok"];

export const LANGUAGE_NAMES = {
  en: "English",
  hi: "हिन्दी",
  as: "অসমীয়া",
  bn: "বাংলা",
  mni: "Meiteilon",
  kha: "Khasi",
  lus: "Mizo",
  nag: "Nagamese",
  ne: "नेपाली",
  kok: "Kokborok",
};

const STRINGS = {
  ROAD_BLOCKED: {
    en: { title: "Road blocked", body: "{road} is blocked. {reason}" },
    hi: { title: "सड़क बंद", body: "{road} बंद है। {reason}" },
    as: { title: "পথ বন্ধ", body: "{road} বন্ধ হৈ আছে। {reason}" },
    bn: { title: "রাস্তা বন্ধ", body: "{road} বন্ধ রয়েছে। {reason}" },
    mni: { title: "Lambi thingjinkhre", body: "{road} thingjinkhre. {reason}" },
    kha: { title: "Ka surok ka la khang", body: "Ka {road} ka la khang. {reason}" },
    lus: { title: "Kawng khar a ni", body: "{road} a khar a ni. {reason}" },
    nag: { title: "Rasta bondh ase", body: "{road} bondh ase. {reason}" },
    ne: { title: "बाटो बन्द", body: "{road} बन्द छ। {reason}" },
    kok: { title: "Lamma bondo", body: "{road} bondo tong. {reason}" },
  },

  ROAD_RESTRICTED: {
    en: { title: "Road partly open", body: "{road} is passable with difficulty. {reason}" },
    hi: { title: "सड़क आंशिक रूप से खुली", body: "{road} पर आवागमन कठिन है। {reason}" },
    as: { title: "পথ আংশিকভাৱে মুকলি", body: "{road}ত যাতায়াত কঠিন। {reason}" },
    bn: { title: "রাস্তা আংশিক খোলা", body: "{road} দিয়ে চলাচল কঠিন। {reason}" },
    mni: { title: "Lambi khara hangbani", body: "{road} chatpa waare. {reason}" },
    kha: { title: "Ka surok ka jia bad ka jingeh", body: "Ka {road} ka jia bad ka jingeh. {reason}" },
    lus: { title: "Kawng a har", body: "{road} kal a har. {reason}" },
    nag: { title: "Rasta tanik khula ase", body: "{road} te jabole tan ase. {reason}" },
    ne: { title: "बाटो आंशिक खुला", body: "{road} मा हिँड्न कठिन छ। {reason}" },
    kok: { title: "Lamma sikan khulti", body: "{road} thangnai kastho. {reason}" },
  },

  ROAD_REOPENED: {
    en: { title: "Road open again", body: "{road} is open again." },
    hi: { title: "सड़क फिर खुली", body: "{road} फिर से खुल गई है।" },
    as: { title: "পথ পুনৰ মুকলি", body: "{road} পুনৰ মুকলি হৈছে।" },
    bn: { title: "রাস্তা আবার খোলা", body: "{road} আবার খুলে গেছে।" },
    mni: { title: "Lambi amuk hanna hangle", body: "{road} amuk hanna hangle." },
    kha: { title: "Ka surok ka la plie biang", body: "Ka {road} ka la plie biang." },
    lus: { title: "Kawng a inhawng leh", body: "{road} a inhawng leh ta." },
    nag: { title: "Rasta aru khula hoise", body: "{road} aru khula hoise." },
    ne: { title: "बाटो फेरि खुल्यो", body: "{road} फेरि खुलेको छ।" },
    kok: { title: "Lamma bohor khulti", body: "{road} bohor khulti tong." },
  },

  FORECAST_RISK: {
    en: { title: "Road may close", body: "{pct}% chance {road} closes within {hours} hours. {reason}" },
    hi: { title: "सड़क बंद हो सकती है", body: "{hours} घंटे में {road} के बंद होने की {pct}% संभावना। {reason}" },
    as: { title: "পথ বন্ধ হ'ব পাৰে", body: "{hours} ঘণ্টাত {road} বন্ধ হোৱাৰ {pct}% সম্ভাৱনা। {reason}" },
    bn: { title: "রাস্তা বন্ধ হতে পারে", body: "{hours} ঘণ্টায় {road} বন্ধ হওয়ার {pct}% সম্ভাবনা। {reason}" },
    mni: { title: "Lambi thingjinba yai", body: "Pung {hours} manungda {road} thingjinba {pct}% yai. {reason}" },
    kha: { title: "Ka surok kan khang", body: "{pct}% ban khang ka {road} hapoh {hours} por. {reason}" },
    lus: { title: "Kawng a khar thei", body: "Darkar {hours} chhungin {road} a khar thei {pct}%. {reason}" },
    nag: { title: "Rasta bondh hobo pare", body: "{hours} ghanta bhitor te {road} bondh hobole {pct}% chance ase. {reason}" },
    ne: { title: "बाटो बन्द हुन सक्छ", body: "{hours} घण्टामा {road} बन्द हुने {pct}% सम्भावना। {reason}" },
    kok: { title: "Lamma bondo jakhi", body: "{hours} ghanta bisi {road} bondo jaknai {pct}%. {reason}" },
  },

  LIFELINE_CUT: {
    en: { title: "District cut off", body: "{district} has no open road right now. {road} is blocked." },
    hi: { title: "जिला कट गया", body: "{district} तक कोई खुली सड़क नहीं है। {road} बंद है।" },
    as: { title: "জিলা বিচ্ছিন্ন", body: "{district} লৈ কোনো মুকলি পথ নাই। {road} বন্ধ।" },
    bn: { title: "জেলা বিচ্ছিন্ন", body: "{district} এ কোনো খোলা রাস্তা নেই। {road} বন্ধ।" },
    mni: { title: "District tanthokle", body: "{district} da lambi hangba leite. {road} thingjinkhre." },
    kha: { title: "Ka distrik ka la duh surok", body: "{district} kam don surok plie. Ka {road} ka la khang." },
    lus: { title: "District a inpeh lo", body: "{district}-ah kawng inhawng a awm lo. {road} a khar." },
    nag: { title: "District alag hoi jaise", body: "{district} loi kunu khula rasta nai. {road} bondh ase." },
    ne: { title: "जिल्ला सम्पर्कविहीन", body: "{district} मा कुनै खुला बाटो छैन। {road} बन्द छ।" },
    kok: { title: "District thangkhaa", body: "{district} no lamma khulti thangya. {road} bondo." },
  },

  INCIDENT_VERIFIED: {
    en: { title: "Report confirmed", body: "Your report on {road} was confirmed. Road set to {status}." },
    hi: { title: "रिपोर्ट की पुष्टि", body: "{road} पर आपकी रिपोर्ट की पुष्टि हुई। सड़क {status} है।" },
    as: { title: "প্ৰতিবেদন নিশ্চিত", body: "{road}ৰ আপোনাৰ প্ৰতিবেদন নিশ্চিত হ'ল। পথ {status}।" },
    bn: { title: "রিপোর্ট নিশ্চিত", body: "{road} এ আপনার রিপোর্ট নিশ্চিত হয়েছে। রাস্তা {status}।" },
    mni: { title: "Report soidokle", body: "{road} gi nahakki report soidokle. Lambi {status}." },
    kha: { title: "La pynshisha ia ka report", body: "Ka report jong phi halor ka {road} ka la pynshisha. Surok {status}." },
    lus: { title: "Report a dik", body: "{road} chungchang i report a dik. Kawng {status}." },
    nag: { title: "Report thik ase", body: "{road} laga apuni laga report thik ase. Rasta {status}." },
    ne: { title: "रिपोर्ट पुष्टि भयो", body: "{road} को तपाईंको रिपोर्ट पुष्टि भयो। बाटो {status}।" },
    kok: { title: "Report thikhi", body: "{road} no nini report thikhi. Lamma {status}." },
  },

  VERIFY_REQUEST: {
    en: { title: "Report needs checking", body: "A new report on {road} is waiting for your confirmation." },
    hi: { title: "रिपोर्ट जाँच चाहिए", body: "{road} पर एक नई रिपोर्ट आपकी पुष्टि का इंतज़ार कर रही है।" },
    as: { title: "প্ৰতিবেদন পৰীক্ষা কৰক", body: "{road}ৰ এক নতুন প্ৰতিবেদন আপোনাৰ নিশ্চিতিৰ বাবে অপেক্ষা কৰিছে।" },
    bn: { title: "রিপোর্ট যাচাই করুন", body: "{road} এ একটি নতুন রিপোর্ট আপনার নিশ্চিতকরণের অপেক্ষায়।" },
    mni: { title: "Report yengbiyu", body: "{road} da anouba report ama nahakki soidokpa ngairi." },
    kha: { title: "Ka report ka donkam jingpeit", body: "Ka report thymmai halor ka {road} ka ap ia ka jingpynshisha jong phi." },
    lus: { title: "Report en tur a awm", body: "{road} chungchang report thar in i pawmpuih a nghak." },
    nag: { title: "Report sabi lage", body: "{road} te notun report apuni pora sabole rukhi ase." },
    ne: { title: "रिपोर्ट जाँच्नुहोस्", body: "{road} को नयाँ रिपोर्ट तपाईंको पुष्टिको प्रतीक्षामा छ।" },
    kok: { title: "Report nokhorong", body: "{road} no thangbo report nini thikhnai nokhorong." },
  },
};

export const ALERT_KINDS = Object.keys(STRINGS);

const REASON = {
  LANDSLIDE: { en: "Landslide.", hi: "भूस्खलन।", as: "ভূমিস্খলন।", bn: "ভূমিধস।", mni: "Lam ningthou.", kha: "Ka jingpluh ka bri.", lus: "Ram a chim.", nag: "Mati khisi jaise.", ne: "पहिरो।", kok: "Ha kwlwi." },
  FLOOD: { en: "Flooding.", hi: "बाढ़।", as: "বান পানী।", bn: "বন্যা।", mni: "Ising ichao.", kha: "Ka um-tuid.", lus: "Tuilet.", nag: "Pani uthise.", ne: "बाढी।", kok: "Twi chagra." },
  SNOW_ICE: { en: "Snow and ice.", hi: "बर्फ।", as: "বৰফ।", bn: "বরফ।", mni: "Ipun amasung ice.", kha: "Ka snow.", lus: "Vur leh dai.", nag: "Borop ase.", ne: "हिउँ।", kok: "Buphang." },
  BRIDGE_DAMAGE: { en: "Bridge damaged.", hi: "पुल क्षतिग्रस्त।", as: "দলং ক্ষতিগ্ৰস্ত।", bn: "সেতু ক্ষতিগ্রস্ত।", mni: "Thong sokle.", kha: "Ka jingkieng ka la jot.", lus: "Lei a chhia.", nag: "Pul bhangi jaise.", ne: "पुल बिग्रियो।", kok: "Sangma bhangti." },
  HEAVY_RAIN: { en: "Heavy rain expected.", hi: "भारी बारिश की आशंका।", as: "প্ৰবল বৰষুণৰ আশংকা।", bn: "ভারী বৃষ্টির আশঙ্কা।", mni: "Nong chenba yai.", kha: "Kan slap eh.", lus: "Ruah surtak a lo thleng thei.", nag: "Bisi borkhun hobo pare.", ne: "भारी वर्षा हुने सम्भावना।", kok: "Wathop chagra jakhi." },
  DEFAULT: { en: "", hi: "", as: "", bn: "", mni: "", kha: "", lus: "", nag: "", ne: "", kok: "" },
};

export function reasonText(code, lang = "en") {
  const r = REASON[code] || REASON.DEFAULT;
  return r[lang] ?? r.en ?? "";
}

export function t(kind, lang, vars = {}) {
  const entry = STRINGS[kind];
  if (!entry) return { title: kind, body: "" };

  const chosen = entry[lang] || entry.en;
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? "" : String(vars[k]))).replace(/\s+/g, " ").trim();

  return { title: fill(chosen.title), body: fill(chosen.body), lang: entry[lang] ? lang : "en" };
}

// Every language at once, for storing on the alert so a client can pick.
export function tAll(kind, vars = {}) {
  const out = {};
  for (const lang of LANGUAGES) out[lang] = t(kind, lang, vars);
  return out;
}

// ── what a driver is told on the road ───────────────────────────────────────
// Short on purpose. These are read aloud by the app while the vehicle is
// moving, so they have to survive being heard once.

const DRIVER = {
  STOP: {
    en: "{road} is blocked. Do not continue. Find another route.",
    hi: "{road} बंद है। आगे मत जाइए। दूसरा रास्ता लीजिए।",
    as: "{road} বন্ধ। আগবাঢ়িব নালাগে। আন পথ ল'ব।",
    bn: "{road} বন্ধ। এগোবেন না। অন্য রাস্তা নিন।",
    mni: "{road} thingjinkhre. Chatlu nattabani. Atoppa lambi thiyu.",
    kha: "Ka {road} ka la khang. Wat leit shaphrang. Wad kawei pat ka surok.",
    lus: "{road} a khar a ni. Kal zel suh. Kawng dang zawng rawh.",
    nag: "{road} bondh ase. Age najabi. Dusra rasta lobi.",
    ne: "{road} बन्द छ। अगाडि नजानुहोस्। अर्को बाटो लिनुहोस्।",
    kok: "{road} bondo tong. Thangya. Gwdang lamma lai.",
  },
  CAUTION: {
    en: "{road} is slow. Traffic is moving below normal speed.",
    hi: "{road} पर आवागमन धीमा है। सामान्य से कम रफ्तार।",
    as: "{road}ত যাতায়াত লেহেমীয়া। সাধাৰণতকৈ কম গতি।",
    bn: "{road} এ চলাচল ধীর। স্বাভাবিকের চেয়ে কম গতি।",
    mni: "{road} tapna chatli. Mapung phana chatpa ngamde.",
    kha: "Ka {road} ka jia sngur. Ki carr ki leit sngur.",
    lus: "{road} a khaw har. Motor te an kal thin lo.",
    nag: "{road} te gari asth-asth jai ase. Normal pora komti.",
    ne: "{road} मा हिँडाइ ढिलो छ। सामान्यभन्दा कम गति।",
    kok: "{road} no thangnai lwbwi. Sadharon nwngno kom.",
  },
  WATCH: {
    en: "{road} may close today. {reason}",
    hi: "{road} आज बंद हो सकती है। {reason}",
    as: "{road} আজি বন্ধ হ'ব পাৰে। {reason}",
    bn: "{road} আজ বন্ধ হতে পারে। {reason}",
    mni: "{road} ngasi thingjinba yai. {reason}",
    kha: "Ka {road} kan khang mynta. {reason}",
    lus: "{road} vawiin a khar thei. {reason}",
    nag: "{road} aji bondh hobo pare. {reason}",
    ne: "{road} आज बन्द हुन सक्छ। {reason}",
    kok: "{road} tini bondo jakhi. {reason}",
  },
  CLEAR: {
    en: "The road ahead is clear.",
    hi: "आगे का रास्ता साफ है।",
    as: "আগৰ পথ মুকলি।",
    bn: "সামনের রাস্তা পরিষ্কার।",
    mni: "Mamangda lambi hangbani.",
    kha: "Ka surok shaphrang ka bha.",
    lus: "Hmalam kawng a tha.",
    nag: "Age laga rasta thik ase.",
    ne: "अगाडिको बाटो सफा छ।",
    kok: "Sikhangno lamma bhalo.",
  },
};

export function driverLine(level, lang = "en", vars = {}) {
  const entry = DRIVER[level] || DRIVER.CAUTION;
  const template = entry[lang] || entry.en;
  return template
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? "" : String(vars[k])))
    .replace(/\s+/g, " ")
    .trim();
}

// Android speech recognition and text-to-speech only ship a subset of these.
// The app checks at runtime too, but knowing here lets the API say what it
// can and cannot voice rather than failing silently on the device.
export const VOICE_SUPPORT = {
  en: { code: "en-IN", stt: true, tts: true },
  hi: { code: "hi-IN", stt: true, tts: true },
  bn: { code: "bn-IN", stt: true, tts: true },
  as: { code: "as-IN", stt: true, tts: false },
  ne: { code: "ne-NP", stt: true, tts: false },
  mni: { code: "mni-IN", stt: false, tts: false },
  kha: { code: "en-IN", stt: false, tts: false },
  lus: { code: "en-IN", stt: false, tts: false },
  nag: { code: "hi-IN", stt: false, tts: false },
  kok: { code: "bn-IN", stt: false, tts: false },
};

// What to actually speak in when the chosen language has no voice.
export function voiceFallback(lang) {
  const v = VOICE_SUPPORT[lang];
  if (v?.tts) return { lang, code: v.code, exact: true };
  if (lang === "nag") return { lang: "hi", code: "hi-IN", exact: false };
  if (lang === "kok") return { lang: "bn", code: "bn-IN", exact: false };
  if (lang === "as" || lang === "ne") return { lang: "hi", code: "hi-IN", exact: false };
  return { lang: "en", code: "en-IN", exact: false };
}
