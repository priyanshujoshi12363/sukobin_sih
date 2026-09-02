export const NER_STATES = [
  { code: "AS", name: "Assam",             capital: "Dispur",   centre: [92.9376, 26.2006] },
  { code: "AR", name: "Arunachal Pradesh", capital: "Itanagar", centre: [94.7278, 28.2180] },
  { code: "MN", name: "Manipur",           capital: "Imphal",   centre: [93.9063, 24.6637] },
  { code: "ML", name: "Meghalaya",         capital: "Shillong", centre: [91.3662, 25.4670] },
  { code: "MZ", name: "Mizoram",           capital: "Aizawl",   centre: [92.9376, 23.1645] },
  { code: "NL", name: "Nagaland",          capital: "Kohima",   centre: [94.5624, 26.1584] },
  { code: "SK", name: "Sikkim",            capital: "Gangtok",  centre: [88.5122, 27.5330] },
  { code: "TR", name: "Tripura",           capital: "Agartala", centre: [91.9882, 23.9408] },
];

export const NER_TOWNS = [
  { name: "Guwahati",           district: "Kamrup Metropolitan", state: "AS", coordinates: [91.7362, 26.1445], hub: true },
  { name: "Dispur",             district: "Kamrup Metropolitan", state: "AS", coordinates: [91.7898, 26.1409] },
  { name: "Nagaon",             district: "Nagaon",              state: "AS", coordinates: [92.6840, 26.3467], hub: true },
  { name: "Jorhat",             district: "Jorhat",              state: "AS", coordinates: [94.2037, 26.7509], hub: true },
  { name: "Dibrugarh",          district: "Dibrugarh",           state: "AS", coordinates: [94.9120, 27.4728], hub: true },
  { name: "Tinsukia",           district: "Tinsukia",            state: "AS", coordinates: [95.3600, 27.4922] },
  { name: "Silchar",            district: "Cachar",              state: "AS", coordinates: [92.7789, 24.8333], hub: true },
  { name: "Karimganj",          district: "Karimganj",           state: "AS", coordinates: [92.3594, 24.8697] },
  { name: "Hailakandi",         district: "Hailakandi",          state: "AS", coordinates: [92.5619, 24.6840] },
  { name: "Tezpur",             district: "Sonitpur",            state: "AS", coordinates: [92.7926, 26.6528], hub: true },
  { name: "Biswanath Chariali", district: "Biswanath",           state: "AS", coordinates: [93.1500, 26.7200] },
  { name: "North Lakhimpur",    district: "Lakhimpur",           state: "AS", coordinates: [94.1000, 27.2350] },
  { name: "Dhemaji",            district: "Dhemaji",             state: "AS", coordinates: [94.5800, 27.4830] },
  { name: "Bongaigaon",         district: "Bongaigaon",          state: "AS", coordinates: [90.5583, 26.4769] },
  { name: "Dhubri",             district: "Dhubri",              state: "AS", coordinates: [89.9840, 26.0207] },
  { name: "Kokrajhar",          district: "Kokrajhar",           state: "AS", coordinates: [90.2711, 26.4015] },
  { name: "Goalpara",           district: "Goalpara",            state: "AS", coordinates: [90.6260, 26.1700] },
  { name: "Barpeta",            district: "Barpeta",             state: "AS", coordinates: [91.0050, 26.3220] },
  { name: "Nalbari",            district: "Nalbari",             state: "AS", coordinates: [91.4400, 26.4450] },
  { name: "Mangaldoi",          district: "Darrang",             state: "AS", coordinates: [92.0300, 26.4400] },
  { name: "Morigaon",           district: "Morigaon",            state: "AS", coordinates: [92.3400, 26.2500] },
  { name: "Diphu",              district: "Karbi Anglong",       state: "AS", coordinates: [93.4300, 25.8400] },
  { name: "Haflong",            district: "Dima Hasao",          state: "AS", coordinates: [93.0170, 25.1670] },
  { name: "Golaghat",           district: "Golaghat",            state: "AS", coordinates: [93.9660, 26.5100] },
  { name: "Sivasagar",          district: "Sivasagar",           state: "AS", coordinates: [94.6380, 26.9850] },
  { name: "Udalguri",           district: "Udalguri",            state: "AS", coordinates: [92.1000, 26.7530] },
  { name: "Lumding",            district: "Hojai",               state: "AS", coordinates: [93.1670, 25.7500] },
  { name: "Badarpur",           district: "Karimganj",           state: "AS", coordinates: [92.5900, 24.8700] },

  { name: "Itanagar",           district: "Papum Pare",          state: "AR", coordinates: [93.6053, 27.0844], hub: true },
  { name: "Naharlagun",         district: "Papum Pare",          state: "AR", coordinates: [93.6960, 27.1040] },
  { name: "Tawang",             district: "Tawang",              state: "AR", coordinates: [91.8687, 27.5860] },
  { name: "Bomdila",            district: "West Kameng",         state: "AR", coordinates: [92.4000, 27.2650] },
  { name: "Dirang",             district: "West Kameng",         state: "AR", coordinates: [92.2410, 27.3580] },
  { name: "Seppa",              district: "East Kameng",         state: "AR", coordinates: [92.9160, 27.2900] },
  { name: "Ziro",               district: "Lower Subansiri",     state: "AR", coordinates: [93.8300, 27.5900] },
  { name: "Daporijo",           district: "Upper Subansiri",     state: "AR", coordinates: [94.2200, 27.9800] },
  { name: "Along",              district: "West Siang",          state: "AR", coordinates: [94.8000, 28.1670] },
  { name: "Pasighat",           district: "East Siang",          state: "AR", coordinates: [95.3260, 28.0660], hub: true },
  { name: "Roing",              district: "Lower Dibang Valley", state: "AR", coordinates: [95.8500, 28.1400] },
  { name: "Tezu",               district: "Lohit",               state: "AR", coordinates: [96.1600, 27.9200] },
  { name: "Changlang",          district: "Changlang",           state: "AR", coordinates: [95.7300, 27.1300] },
  { name: "Khonsa",             district: "Tirap",               state: "AR", coordinates: [95.5670, 27.0000] },

  { name: "Imphal",             district: "Imphal West",         state: "MN", coordinates: [93.9368, 24.8170], hub: true },
  { name: "Thoubal",            district: "Thoubal",             state: "MN", coordinates: [94.0100, 24.6400] },
  { name: "Churachandpur",      district: "Churachandpur",       state: "MN", coordinates: [93.6800, 24.3300] },
  { name: "Bishnupur",          district: "Bishnupur",           state: "MN", coordinates: [93.7700, 24.6300] },
  { name: "Senapati",           district: "Senapati",            state: "MN", coordinates: [94.0300, 25.2700] },
  { name: "Ukhrul",             district: "Ukhrul",              state: "MN", coordinates: [94.3600, 25.0500] },
  { name: "Tamenglong",         district: "Tamenglong",          state: "MN", coordinates: [93.5000, 24.9800] },
  { name: "Moreh",              district: "Tengnoupal",          state: "MN", coordinates: [94.3100, 24.2500] },
  { name: "Kangpokpi",          district: "Kangpokpi",           state: "MN", coordinates: [93.9600, 25.1500] },

  { name: "Shillong",           district: "East Khasi Hills",    state: "ML", coordinates: [91.8933, 25.5788], hub: true },
  { name: "Tura",               district: "West Garo Hills",     state: "ML", coordinates: [90.2026, 25.5140], hub: true },
  { name: "Jowai",              district: "West Jaintia Hills",  state: "ML", coordinates: [92.1970, 25.4500] },
  { name: "Nongstoin",          district: "West Khasi Hills",    state: "ML", coordinates: [91.2670, 25.5170] },
  { name: "Williamnagar",       district: "East Garo Hills",     state: "ML", coordinates: [90.6200, 25.4900] },
  { name: "Baghmara",           district: "South Garo Hills",    state: "ML", coordinates: [90.6330, 25.1930] },
  { name: "Nongpoh",            district: "Ri Bhoi",             state: "ML", coordinates: [91.8770, 25.9040] },
  { name: "Cherrapunji",        district: "East Khasi Hills",    state: "ML", coordinates: [91.7000, 25.3000] },

  { name: "Aizawl",             district: "Aizawl",              state: "MZ", coordinates: [92.7176, 23.7271], hub: true },
  { name: "Lunglei",            district: "Lunglei",             state: "MZ", coordinates: [92.7340, 22.8800] },
  { name: "Champhai",           district: "Champhai",            state: "MZ", coordinates: [93.3300, 23.4560] },
  { name: "Serchhip",           district: "Serchhip",            state: "MZ", coordinates: [92.8500, 23.3000] },
  { name: "Kolasib",            district: "Kolasib",             state: "MZ", coordinates: [92.6800, 24.2200] },
  { name: "Saiha",              district: "Saiha",               state: "MZ", coordinates: [92.9800, 22.4900] },
  { name: "Lawngtlai",          district: "Lawngtlai",           state: "MZ", coordinates: [92.9000, 22.5300] },
  { name: "Mamit",              district: "Mamit",               state: "MZ", coordinates: [92.4900, 23.9300] },
  { name: "Vairengte",          district: "Kolasib",             state: "MZ", coordinates: [92.6600, 24.4900] },

  { name: "Kohima",             district: "Kohima",              state: "NL", coordinates: [94.1100, 25.6751], hub: true },
  { name: "Dimapur",            district: "Dimapur",             state: "NL", coordinates: [93.7267, 25.9063], hub: true },
  { name: "Mokokchung",         district: "Mokokchung",          state: "NL", coordinates: [94.5200, 26.3200] },
  { name: "Tuensang",           district: "Tuensang",            state: "NL", coordinates: [94.8300, 26.2700] },
  { name: "Wokha",              district: "Wokha",               state: "NL", coordinates: [94.2600, 26.0900] },
  { name: "Zunheboto",          district: "Zunheboto",           state: "NL", coordinates: [94.5200, 25.9700] },
  { name: "Phek",               district: "Phek",                state: "NL", coordinates: [94.4700, 25.6700] },
  { name: "Mon",                district: "Mon",                 state: "NL", coordinates: [95.0000, 26.7500] },

  { name: "Gangtok",            district: "Gangtok",             state: "SK", coordinates: [88.6138, 27.3389], hub: true },
  { name: "Namchi",             district: "Namchi",              state: "SK", coordinates: [88.3639, 27.1667] },
  { name: "Gyalshing",          district: "Gyalshing",           state: "SK", coordinates: [88.2600, 27.2900] },
  { name: "Mangan",             district: "Mangan",              state: "SK", coordinates: [88.5300, 27.5100] },
  { name: "Rangpo",             district: "Pakyong",             state: "SK", coordinates: [88.5300, 27.1770] },
  { name: "Singtam",            district: "Gangtok",             state: "SK", coordinates: [88.5000, 27.2350] },
  { name: "Ravangla",           district: "Namchi",              state: "SK", coordinates: [88.3600, 27.3070] },

  { name: "Agartala",           district: "West Tripura",        state: "TR", coordinates: [91.2868, 23.8315], hub: true },
  { name: "Udaipur",            district: "Gomati",              state: "TR", coordinates: [91.4900, 23.5300] },
  { name: "Dharmanagar",        district: "North Tripura",       state: "TR", coordinates: [92.1667, 24.3667] },
  { name: "Kailashahar",        district: "Unakoti",             state: "TR", coordinates: [92.0100, 24.3300] },
  { name: "Belonia",            district: "South Tripura",       state: "TR", coordinates: [91.4500, 23.2500] },
  { name: "Ambassa",            district: "Dhalai",              state: "TR", coordinates: [91.8500, 23.9400] },
  { name: "Khowai",             district: "Khowai",              state: "TR", coordinates: [91.6000, 24.0700] },
  { name: "Sabroom",            district: "South Tripura",       state: "TR", coordinates: [91.7300, 23.0000] },

  { name: "Siliguri",           district: "Darjeeling",          state: "WB", coordinates: [88.4279, 26.7271], hub: true },
];

export const NER_CORRIDORS = [
  {
    code: "NH10-SILIGURI-GANGTOK",
    name: "NH-10 Siliguri to Gangtok",
    highway: "NH-10",
    states: ["WB", "SK"],
    lifelineFor: ["Sikkim"],
    terrain: "mountain",
    via: ["Siliguri", "Rangpo", "Singtam", "Gangtok"],
    chokepoint: "Teesta river stretch (Rangpo-Singtam) - chronic landslide and river erosion",
    baselineSpeedKmph: 26,
  },
  {
    code: "NH2-DIMAPUR-IMPHAL",
    name: "NH-2 Dimapur to Kohima to Imphal",
    highway: "NH-2",
    states: ["NL", "MN"],
    lifelineFor: ["Manipur", "Nagaland"],
    terrain: "mountain",
    via: ["Dimapur", "Kohima", "Senapati", "Kangpokpi", "Imphal"],
    chokepoint: "Maram-Kangpokpi ghat - monsoon landslides on Manipur's main supply line",
    baselineSpeedKmph: 24,
  },
  {
    code: "NH6-SHILLONG-SILCHAR",
    name: "NH-6 Shillong to Jowai to Silchar",
    highway: "NH-6",
    states: ["ML", "AS"],
    lifelineFor: ["Barak Valley", "Mizoram", "Tripura"],
    terrain: "mountain",
    via: ["Shillong", "Jowai", "Badarpur", "Silchar"],
    chokepoint: "Sonapur-Lumshnong stretch - recurring landslides cut Barak Valley off",
    baselineSpeedKmph: 25,
  },
  {
    code: "NH27-SILIGURI-GUWAHATI",
    name: "NH-27 Siliguri to Bongaigaon to Guwahati",
    highway: "NH-27",
    states: ["WB", "AS"],
    lifelineFor: ["Entire NER"],
    terrain: "plain",
    via: ["Siliguri", "Kokrajhar", "Bongaigaon", "Barpeta", "Guwahati"],
    chokepoint: "Siliguri Corridor (Chicken Neck) - single point of failure for all NER supply",
    baselineSpeedKmph: 45,
  },
  {
    code: "NH27-GUWAHATI-SILCHAR",
    name: "NH-27 Guwahati to Nagaon to Silchar",
    highway: "NH-27",
    states: ["AS"],
    lifelineFor: ["Barak Valley"],
    terrain: "hill",
    via: ["Guwahati", "Nagaon", "Lumding", "Haflong", "Silchar"],
    chokepoint: "Dima Hasao hill section - landslide and flood prone",
    baselineSpeedKmph: 30,
  },
  {
    code: "NH715-GUWAHATI-LAKHIMPUR",
    name: "NH-715 Guwahati to Tezpur to North Lakhimpur",
    highway: "NH-715",
    states: ["AS"],
    lifelineFor: ["North Bank Assam", "Arunachal Pradesh"],
    terrain: "plain",
    via: ["Guwahati", "Mangaldoi", "Tezpur", "Biswanath Chariali", "North Lakhimpur"],
    chokepoint: "Brahmaputra north-bank flood plain - annual inundation",
    baselineSpeedKmph: 42,
  },
  {
    code: "NH37-GUWAHATI-DIBRUGARH",
    name: "NH-37 Guwahati to Jorhat to Dibrugarh (south bank)",
    highway: "NH-37",
    states: ["AS"],
    lifelineFor: ["Upper Assam"],
    terrain: "plain",
    via: ["Guwahati", "Nagaon", "Golaghat", "Jorhat", "Sivasagar", "Dibrugarh"],
    chokepoint: "Kaziranga stretch - flooding and wildlife crossing closures",
    baselineSpeedKmph: 46,
  },
  {
    code: "NH13-TEZPUR-TAWANG",
    name: "Tezpur to Bomdila to Sela to Tawang",
    highway: "NH-13",
    states: ["AS", "AR"],
    lifelineFor: ["Tawang", "West Kameng"],
    terrain: "high-mountain",
    via: ["Tezpur", "Bomdila", "Dirang", "Tawang"],
    chokepoint: "Sela Pass (4170 m) - snow closure Dec-Mar, landslides in monsoon",
    baselineSpeedKmph: 18,
  },
  {
    code: "NH306-SILCHAR-AIZAWL",
    name: "NH-306 Silchar to Vairengte to Aizawl",
    highway: "NH-306",
    states: ["AS", "MZ"],
    lifelineFor: ["Mizoram"],
    terrain: "mountain",
    via: ["Silchar", "Vairengte", "Kolasib", "Aizawl"],
    chokepoint: "Vairengte-Kolasib hill section - Mizoram's only all-weather supply road",
    baselineSpeedKmph: 22,
  },
  {
    code: "NH8-DHARMANAGAR-SABROOM",
    name: "NH-8 Dharmanagar to Agartala to Sabroom",
    highway: "NH-8",
    states: ["TR"],
    lifelineFor: ["Tripura"],
    terrain: "hill",
    via: ["Dharmanagar", "Ambassa", "Agartala", "Udaipur", "Belonia", "Sabroom"],
    chokepoint: "Atharamura and Baramura ridge crossings - landslide prone",
    baselineSpeedKmph: 32,
  },
  {
    code: "NH127B-GUWAHATI-TURA",
    name: "Guwahati to Tura (Garo Hills)",
    highway: "NH-127B",
    states: ["AS", "ML"],
    lifelineFor: ["Garo Hills"],
    terrain: "hill",
    via: ["Guwahati", "Goalpara", "Tura"],
    chokepoint: "Jogighopa-Tura stretch - Brahmaputra crossing dependency",
    baselineSpeedKmph: 34,
  },
  {
    code: "NH29-DIMAPUR-MOKOKCHUNG",
    name: "NH-29 Dimapur to Mokokchung",
    highway: "NH-29",
    states: ["NL"],
    lifelineFor: ["Upper Nagaland"],
    terrain: "mountain",
    via: ["Dimapur", "Wokha", "Mokokchung"],
    chokepoint: "Wokha ridge - monsoon landslides",
    baselineSpeedKmph: 23,
  },
];

export const townByName = (n) =>
  NER_TOWNS.find((t) => t.name.toLowerCase() === String(n || "").trim().toLowerCase()) || null;

export const townsInState = (code) => NER_TOWNS.filter((t) => t.state === code);

export const HUBS = NER_TOWNS.filter((t) => t.hub);

export const STATE_NAME = Object.fromEntries(NER_STATES.map((s) => [s.code, s.name]));

export const DISTRICTS = [
  ...new Map(
    NER_TOWNS.filter((t) => t.state !== "WB").map((t) => [
      `${t.state}|${t.district}`,
      { district: t.district, state: t.state, stateName: STATE_NAME[t.state] },
    ])
  ).values(),
];

const norm = (s) => String(s || "").trim().toLowerCase();

const BIG_CITIES = new Set(
  ["guwahati", "dispur", "imphal", "shillong", "agartala", "aizawl", "kohima", "dimapur",
   "itanagar", "gangtok", "silchar", "dibrugarh", "jorhat", "tezpur", "siliguri", "tura",
   "nagaon", "bongaigaon", "tinsukia"].map(norm)
);

export const BIG_CITY_RADIUS_KM = Number(process.env.BIG_CITY_RADIUS_KM) || 15;
export const TOWN_RADIUS_KM = Number(process.env.TOWN_RADIUS_KM) || 8;

export const cityRadiusKm = (name) =>
  BIG_CITIES.has(norm(String(name).split(",")[0])) ? BIG_CITY_RADIUS_KM : TOWN_RADIUS_KM;

export function searchTowns(query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const t of NER_TOWNS) {
    const n = norm(t.name);
    if (n.startsWith(q)) starts.push(t);
    else if (n.includes(q) || norm(t.district).includes(q)) contains.push(t);
  }
  return [...starts, ...contains].slice(0, limit).map((t) => ({
    label: `${t.name}, ${t.district}`,
    district: t.district,
    state: t.state,
    stateName: STATE_NAME[t.state] || t.state,
    hub: Boolean(t.hub),
    coordinates: t.coordinates,
  }));
}

export function townInAddress(address) {
  const a = " " + norm(address).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
  if (a.trim().length === 0) return null;
  let best = null;
  for (const t of NER_TOWNS) {
    const n = norm(t.name);
    if (a.includes(" " + n + " ")) {
      if (!best || n.length > norm(best.name).length) best = t;
    }
  }
  return best;
}

const kmBetween = (a, b) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export function nearestTown(coords, maxKm = Infinity) {
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  let best = null;
  let bestKm = Infinity;
  for (const t of NER_TOWNS) {
    const d = kmBetween(coords, t.coordinates);
    if (d < bestKm) {
      bestKm = d;
      best = t;
    }
  }
  return best && bestKm <= maxKm ? { ...best, distanceKm: +bestKm.toFixed(1) } : null;
}
