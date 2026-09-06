# Sukobin

**An AI-enabled logistics accessibility intelligence platform for the North Eastern Region.**

Built for Smart India Hackathon 2026 · MDoNER problem statement — *AI-Enabled Logistics
Accessibility Intelligence Platform for the North Eastern Region*.

---

## The one idea everything else hangs off

The NER has no road-condition sensor network. A district usually learns a road is shut when a
truck is already stuck on it, and instrumenting 3,500 km of hill highway with roadside sensors
is not affordable.

So Sukobin doesn't try to.

```
Anyone already driving Dimapur → Imphal declares that route.
        │
        ▼
They are offered only the consignments whose pickup and drop
lie along that road, up to what their vehicle holds.
        │
        ▼
They drive. Their phone streams GPS every 20 seconds.
        │
        ▼
The rolling median of those speeds, against the road's own baseline,
IS the live accessibility reading for that stretch.
        │
        ▼
Officers, forecasts, alerts and re-routes all run off that reading.
```

**The carrier network and the sensor network are the same network.** One GPS stream delivers the
goods *and* measures the road. That is why there is no dedicated fleet and no roadside hardware
anywhere in this design — the marginal cost of one more road-condition reading is zero, because
the driver was making the trip anyway.

---

## Repository layout

| Folder | What it is |
|---|---|
| `backend/` | Node.js + Express 5 + MongoDB. 118 endpoints, the ML model, the sensing and alert engines. |
| `android/` | Gradle multi-module project — four Kotlin/XML apps sharing a `core` module. |
| `dashboard/` | React + Vite + MapLibre GL control room for officers and administrators. |
| `ppt/` | Builder for the SIH idea deck; fills the official template in place. |
| `_legacy_expo/` | The first-generation Expo apps, kept for reference only. Not built, not shipped. |
| `SUKOBIN_ALGORITHM.md` | Long-form write-up of the matching and scoring maths. |

---

# The four apps

All four are Kotlin + XML, `minSdk 24`, sharing `android/core` for networking, session, the
language picker and upload helpers.

## 1. Customer app — `android/customer`

| Feature | Why it exists |
|---|---|
| Browse shops and products, cart, checkout | Someone has to be sending something. The commerce side generates the parcels the carriers move. |
| Address with a map pin | A drop point 300 m off is a driver phoning from the wrong turning. The pin is the delivery contract. |
| Live order tracking | The parcel is on a stranger's bike. Seeing it move is the difference between trust and a support call. |
| "Driver is near" push at 10 km | In hill villages the last call is what gets someone to the gate. Fired once, automatically, when the carrier crosses 10 km from the drop. |
| Delivery OTP | Four digits held by the receiver. The only thing stopping a parcel being marked delivered from the road outside. |
| 10 languages | The person receiving medicines in a Garo Hills block does not read English. |

## 2. Merchant app — `android/mart`

| Feature | Why it exists |
|---|---|
| Shop profile, product catalogue, stock | Local shops are the supply side. Without them the platform has nothing to move. |
| Incoming orders, accept and mark ready | A shop marking an order `READY_FOR_PICKUP` is what puts it into the carrier pool. |
| Earnings and order history | A merchant who cannot see their money does not come back. |
| 10 languages | Same reason as everywhere else. |

## 3. Driver / carrier app — `android/partner`

This is the sensor network, wearing the clothes of a delivery app.

| Feature | Why it exists |
|---|---|
| Vehicle verified against VAHAN at sign-up | Vehicle class decides capacity. Checking it *before* the OTP means a driver is never asked to verify a phone for a vehicle that will be rejected. |
| Online / offline switch | Going online starts GPS streaming; going offline stops it and clears the job list. **A driver who is not working is not tracked** — a deliberate privacy line, not an oversight. |
| Declare a route (from → to) | The whole premise. The driver is not asking for work, they are stating a journey they were already making. |
| Corridor-matched job list | Only consignments lying along the declared road, in the direction of travel, within capacity. See *the matching engine* below. |
| Trip screen — pick up, deliver against OTP | A trip is a sequence of stops in route order, so the driver never backtracks. |
| **GPS streaming every 20 s / 40 m** | The reason the platform can see the road at all. Fixes worse than 120 m accuracy are dropped on the phone — they would drag the road's median around for nothing and waste a round trip. |
| Speak-a-hazard reporting | A driver standing at a landslide is not going to fill in a form. They talk, in their own language, and a model classifies it. |
| Photo attached to a report | A photograph turns one person's word into something an officer can act on. |
| Tap-a-category report form | For a driver who would rather not talk, or where speech recognition will not work. |

## 4. Officer app — `android/officer`

| Feature | Why it exists |
|---|---|
| Jurisdiction-scoped view (block / district / state / region) | A block officer should not be paging through Mizoram. Scope is enforced server-side, not just hidden in the UI. |
| Road list with live status and 3-day forecast | The working screen. Status now, risk next. |
| Weak-point ranking with reasons | Not just *which* road, but *why it scored* — so an officer can disagree with the model rather than obey it. |
| Verify queue | Driver and junior-officer reports land here. Confirming one turns a report into a road status the routing engine will act on. |
| Set road status manually | The model is not always right, and an officer standing on the road is. Manual status wins. |
| Photo capture, and viewing driver photos | Evidence, in both directions. |
| Speak-a-report in 10 languages | Same reason as the driver app. |
| Offline report queue | Hill districts drop off the network. Reports queue under a client ID and sync later; the server rejects duplicates so nothing is filed twice. |
| In-app notification inbox | Officers get alerts without needing a push token or a working connection at the moment of firing. |

---

# The control dashboard — `dashboard/`

React + Vite + MapLibre GL. Read-only by design: officers act from the app, where they have GPS
and a camera.

| Panel | Why it exists |
|---|---|
| **Network status tiles** | Segments, km, districts, chokepoints, blocked now, open incidents, vehicles online, consignments moving. The one-glance state of the region. |
| **Accessibility + risk distributions** | How much of the network is open, and how much is predicted to be in trouble. |
| **"What we can see" coverage bar** | % of roads with known status, with live vehicle data, with a forecast. **A map that is mostly grey should say why rather than look broken.** This panel is the platform admitting what it does not know. |
| **Map — three colouring modes** | *Status* is what the roads are doing now (from driver speed). *Risk now* is the current hazard score. *3-day forecast* is the model's outlook. Same geometry, three questions. |
| **Chokepoint overlay** | Dashed white on stretches with few alternatives — the ones where a closure isolates people. |
| **Alerts** | Live, in whichever of the 10 languages is selected. The server renders the text, so it is never English inside an Assamese screen. |
| **Weak points** | Bottlenecks ranked by exposure, with the reasons each scored. Problem statement clause (g). |
| **Forecast** | 24 / 48 / 72 h closure probability per road, plus the model card — training size, AUC, Brier, held-out date, and what the model weighs. **The numbers are shown so they can be judged, not just believed.** |
| **Route planner** | A→B with distance, normal time, condition-adjusted ETA and the delay. If nothing is passable it says which segment blocked it. |
| **Supplies** | Consignments in transit, with essential goods flagged. |
| **Emergency** | Regions at risk of isolation, and lifeline corridor status. |
| **Language picker** | The dashboard speaks the same 10 languages as the apps, remembered per browser. |

---

# The backend engines — `backend/`

## Probe sensing — *how a road knows it is blocked*

`src/utils/probes.js` · `src/utils/probeIngest.js`

Every `PATCH /api/partner/location` does four things in one call:

1. Updates the driver's live position (for customer tracking and the dashboard map).
2. Fires a "driver is near" push if within 10 km of an undelivered drop.
3. Map-matches the fix to a road within 600 m and stores a `LocationPing`.
4. Answers with that road's name and status **on the same response**.

> **Why one call?** A connection in the hills may not give you a second round trip. The call that
> senses the road also tells the driver what it just learned about it.

Every five minutes per road, the pings are rolled up:

| Speed ÷ baseline | Status | Confidence |
|---|---|---|
| ≤ 0.15 | `BLOCKED` | 0.80 |
| ≤ 0.35 | `RESTRICTED` | 0.70 |
| ≤ 0.60 | `SLOW` | 0.60 |
| > 0.60 | `OPEN` | 0.50 |

> **Why a median and not a mean?** One vehicle stopped for chai would drag a mean down. A median
> ignores it.

> **Why the trust rule?** A reading needs **≥ 4 samples from ≥ 2 distinct vehicles**, or it is
> discarded and the road keeps its previous status. Without it, one driver parked for lunch closes
> a national highway. Readings older than three hours are treated as no reading at all.

## The matching engine — *what "on my way" actually means*

`src/utils/matching.js` — five gates, in order:

1. **Coarse fetch** — bounding box around the route polyline, padded by the larger city radius.
2. **Corridor or city membership** — pickup and drop within 10 km of the road line, *or* inside the origin/destination city, which is treated as an area (15 km for a big city, 8 km for a town).
3. **Detour cap** — only mid-route deviation counts; a city pickup is free. Over 24 km total, rejected.
4. **Direction** — projected onto the line: driver before pickup, pickup before drop.
5. **Score and order.**

```
score = 1.0 × fee − 8.0 × offRouteKm − 0.15 × ageMinutes
```

> **Why weight detour at 8?** A kilometre sideways costs the same as ₹8 of fee, so the ranking
> will not send a driver 5 km off-route for ₹30.

> **Why an age term?** Without it an awkward parcel sits in the pool forever. Every hour it waits,
> it climbs 9 points.

> **Why does direction matter so much?** A parcel behind the driver is not on their way. Offering
> it would be the entire idea failing. The suggested pickup order comes from position along the
> line, so a route never doubles back.

> **Why is a stale GPS fix distrusted?** A last-known position left in another state still projects
> *somewhere* onto the polyline — usually just past the origin — and the direction rule would then
> silently empty the list. A fix is only trusted if it is under two hours old and within 25 km of
> the declared route; otherwise the route's start is the honest assumption.

## The forecast model

`src/ml/` — pure JavaScript, no Python runtime in production.

| | |
|---|---|
| Model | Logistic regression (mini-batch GD, L2, early stopping), benchmarked against gradient-boosted decision stumps |
| Features | 18 — antecedent rain 24 h / 72 h, rain in the horizon, burst intensity, snow, freeze hours, slope, elevation, landslide / flood / snow proneness, historic failure rate, terrain, monsoon weight, and three interaction terms |
| Training data | 109,116 road-days — 42 stretches × 877 days of **observed** Open-Meteo weather |
| Split | Date-based; everything after 2026-03-01 held out |
| Scores | **AUC 0.883 · Brier 0.092 · log-loss 0.308** |
| Output | Closure probability at 24 / 48 / 72 h, with signed per-feature contributions |

> **Why logistic regression and not something bigger?** It is calibrated, it is auditable, and
> every prediction decomposes into which feature pushed it. On a screen where an officer has to
> decide whether to trust the number, "69% because of three-day rainfall on a landslide-prone
> slope" beats a better AUC with no explanation. The gradient-boosted model is trained alongside
> and only chosen if it wins on held-out data.

> **Why is the heaviest feature *burst* rainfall rather than total?** 80 mm in one hour brings a
> slope down; 80 mm over three days soaks in. In the hills intensity matters more than total, and
> the model learned that — it is the single largest weight.

> ### The honest part
> There is no public register of past NER road closures. Historical labels are **Bernoulli draws
> from a rainfall-threshold hazard function** (antecedent wetness × triggering intensity ×
> susceptibility), not observed closures. Two things stop this being circular: the label uses a
> seven-day antecedent window and multiplicative terms the feature vector never sees, and the
> label is a draw, not the probability itself. **Verified field reports override the drawn label.**
> The dashboard states this on screen; so does the deck.

## Risk scoring vs forecasting

`src/utils/risk.js` scores a road's hazard **right now** from current weather, recent incidents
and probe speed. The ML model predicts **what will happen**. They are separate systems and meet
only in the status resolver.

> **Why two?** "It is raining hard on a landslide-prone slope right now" and "this road has a 41%
> chance of closing within three days" are different questions, asked at different moments.

## Status resolution

`src/utils/accessibility.js` — one road can carry a probe reading, an officer's manual status, a
verified incident and a weather advisory all at once.

> **Why a resolver?** Sources disagree. The rule: an officer's manual status wins, then a verified
> incident, then a probe reading, then weather. An **unverified driver report is capped at
> `RESTRICTED`** — it can slow a road but never close one. That cap is the whole trust model in one
> line.

## Alert engine

`src/utils/alertEngine.js` — seven kinds: `ROAD_BLOCKED`, `ROAD_RESTRICTED`, `ROAD_REOPENED`,
`FORECAST_RISK`, `LIFELINE_CUT`, `INCIDENT_VERIFIED`, `VERIFY_REQUEST`.

| Mechanism | Why |
|---|---|
| `dedupeKey` + `supersedeIf` | The same road blocking twice in an hour is one alert, not two. A reopening supersedes the closure. |
| TTL expiry | An alert nobody retired should not still be shouting next week. |
| Per-audience delivery | Officers get an inbox row; drivers get a push. Different people, different urgency. |
| Rendered per language | Text is generated server-side in the recipient's language, so an Assamese officer never gets an English alert. |
| `LIFELINE_CUT` | Fires when a *state* loses its last open road. The alert that actually matters. |

## Voice reporting

`src/utils/voiceReport.js` — two steps. `POST /report/understand` sends the transcript and returns
a structured reading (type, severity, blocks traffic, clearance hours) with a plain-language
summary for the reporter to confirm. `POST /report/voice` submits it with photos as multipart.

> **Why two steps?** The model can be wrong. Showing the reporter *"I understood: landslide, road
> impassable, 6 hours to clear"* before anything is filed means a misread is caught by the one
> person who was actually there.

> **Why guardrails in the prompt?** Real corrections from real misreads: a vehicle that has
> overturned is an `ACCIDENT`, however completely it blocks the road — `BLOCKADE` means people
> deliberately blocking it. Rocks coming down is `LANDSLIDE`, not `ROAD_DAMAGE`. And "0 hours to
> clear" reads as "already clear", so an unknown clearance is stored as unknown, not zero.

## Routing

`src/utils/routePlanner.js` — fetches up to three OSRM alternatives, checks each for closures,
picks the first passable one, and reports *why* the others were rejected.

> **Why real road geometry and not a straight line?** A straight Dimapur–Imphal line crosses
> ridges. The road wraps via Kohima and Senapati. If the corridor does not follow the road, "on my
> way" means nothing.

> **Condition-adjusted ETA** re-times each leg at its observed speed rather than a nominal one, so
> a delay reflects the road as it is today.

---

# Multilingual — 10 languages, everywhere

`en · हिन्दी · অসমীয়া · বাংলা · नेपाली · Meiteilon · Khasi · Mizo · Nagamese · Kokborok`

| | Coverage |
|---|---|
| Four Android apps | **7,155 units · 0 English fallbacks** |
| Dashboard | 141 strings × 9 languages = **1,269 units · 100%** |
| Server-side alert and driver-advisory text | All 10 |
| Voice reporting | All 10, with a spoken fallback where the device has no TTS voice |

> **Why these ten?** Four of them — Khasi, Mizo, Nagamese, Kokborok — have almost no other software
> support. An officer in West Garo Hills or a driver in Kolasib is exactly the user this problem
> statement is about.

> **Why is the language picker written in each language's own script?** Someone hunting for their
> language in a list they cannot read is looking for the shape of their own name.

Tooling: `android/tools/translateStrings.js` and `dashboard/tools/translateUi.mjs` fill
translations through a model; `android/tools/checkTranslations.js` audits every unit and **fails on
a changed format specifier, a missing plural quantity or an unescaped apostrophe** — because a
translation that drops `%1$s` renders a hole in the sentence.

---

# Offline support

The officer app queues reports on the phone under a client-generated ID, retries on reconnect, and
the server rejects duplicate client IDs.

> **Why a client ID and not a timestamp?** A phone that syncs twice — app restart, flaky connection
> — must not file the same landslide twice. The ID makes the submission idempotent.

> **Honest status:** the offline queue is currently **officer-app only**. Partner, customer and
> merchant have none yet.

---

# Running it

### Backend
```bash
cd backend
npm install
cp .env.example .env        # then fill it in (see Configuration)
node server.js              # http://127.0.0.1:5055
```

### Dashboard
```bash
cd dashboard
npm install
SUKOBIN_API=http://127.0.0.1:5055 npx vite --port 5173
```

### Android
No Gradle wrapper is committed — use a local Gradle 8.5 with JDK 17:
```bash
cd android
gradle :customer:assembleDebug
gradle :mart:assembleDebug
gradle :partner:assembleDebug
gradle :officer:assembleDebug
```

### Seeding a working demo
```bash
cd backend
node scripts/seedNetwork.js       # 42 road segments with real OSRM geometry
node scripts/seedOfficers.js      # officers at block / district / state / region scope
node scripts/seedParcels.js       # 25 pooled parcels on the real corridors
node scripts/simulateTraffic.js   # simulated vehicles, so the map has something to sense
node scripts/trainRiskModel.js    # retrain the forecast model
```

`simulateTraffic.js --slow "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA"` grinds one stretch to 12% of
normal so you can watch the map turn. `--clear` removes everything it created.

> **Note on `seedParcels.js`:** parcels are pooled for `PARCEL_POOL_TTL_MIN` (2 h by default) and
> matching only returns unexpired ones, so a database seeded last week shows a driver nothing at
> all. Re-run it and the shelf is stocked.

---

# Tests

18 suites under `backend/scripts/`. They run against a live server and real data, not mocks.

```bash
node scripts/checkOfficerApi.js        # 38 checks — auth, scope, status, verification
node scripts/checkOfficerInbox.js      # 18 — notification inbox, no duplicates
node scripts/checkOfficerPhotos.js     # 11 — officer uploads, and sees driver photos
node scripts/checkDashboardApi.js      # 25 — every dashboard endpoint
node scripts/checkDriverSensing.js     # 17 — GPS → status, trust rule, driver advisories
node scripts/checkDriverFlows.js       # 14 — claim, pick up, deliver
node scripts/checkVoiceReport.js       # 28 — understanding across languages
node scripts/checkVoiceMultipart.js    # 12 — the multipart path the app actually uses
node scripts/checkCustomerFlow.js      # 15 — cart → checkout → payment → order
node scripts/checkRouteMatching.js     # 17 — corridor, direction, closure, offline
```

**195 / 195 passing** across those ten. The rest cover the risk engine, forecast, probe sensing,
alerts, incident AI and the parcel pipeline.

> **Why test against a live server?** Every bug worth catching here was in a seam — a `lng/lat` swap
> in multipart, a Mongoose hook that silently never ran, a distance measured to a road's first
> vertex instead of the road itself, an autocomplete that cleared the town you had just picked.
> Mocks would have passed all of them.

---

# Configuration

Required:

```
MONGODB_URI          MongoDB Atlas connection string
JWT_SECRET           token signing
CLOUDINARY_*         photo storage (cloud name, key, secret)
```

Useful:

```
ALLOW_DEV_OTP=true         returns the OTP in the response — without it nobody can sign in
                           to the officer or partner apps during a demo
DEMO_PAYMENT=true          bypasses Razorpay so checkout completes
OLLAMA_API_KEY             voice-report understanding, and the translation tooling
FIREBASE_SERVICE_ACCOUNT   push notifications
VAHAN_API_KEY              real registration lookup; falls back to a mock without it
```

Every threshold quoted in this README is an environment variable — `PROBE_MIN_VEHICLES`,
`MATCH_W_DETOUR`, `PARCEL_POOL_TTL_MIN`, `DRIVER_NEAR_KM` and about eighty more — so the platform
can be tuned per state without a code change.

> ⚠️ `ALLOW_DEV_OTP=true` means anyone who knows a registered phone number can sign in as that
> officer. Fine for a demo, **must be off before real use.**

---

# What is not built yet

Stated plainly, because a README that only lists wins is not much use.

| Gap | Where it stands |
|---|---|
| **Drivers are never warned about a road ahead** | `GET /api/partner/road-conditions` is finished and tested — it returns ranked warnings in the driver's language, with a spoken version — but **no screen calls it**. The driver only sees the road they are currently on. |
| **No mid-trip re-route** | The corridor is checked for closures when the route is declared. A road that shuts an hour into the drive does not reach the driver. |
| **Delayed-delivery alerts do not fire** | `DELAY_ALERT_MIN` and `shouldAlert` are computed in `routePlanner.js` and nothing consumes them. Problem statement clause (e) names delayed deliveries. |
| **No live ETA to the customer** | `conditionAdjustedEta` exists; only the dashboard calls it. |
| **Bridges are modelled but not seeded** | The segment schema treats `BRIDGE`, `PASS`, `CULVERT`, `TUNNEL` and `FERRY` as first-class kinds, but all 42 seeded segments are `ROAD`. Clause (a) names bridges. |
| **Offline queue is officer-only** | Partner, customer and merchant have none. |
| **No real government system integration** | VAHAN is integrated, with a mock fallback. No other government monitoring system is connected. |

---

# The numbers, as verified

| | |
|---|---|
| Road network | 42 stretches · 3,567 km · 12 corridors · 82 districts · 8 states |
| Geometry | Real OSRM, not straight lines |
| Model | 109,116 road-days · AUC 0.883 · Brier 0.092 |
| Coverage | 100% status known · 100% live vehicle data · 100% forecast |
| Endpoints | 118 |
| Apps | 4 Android + 1 web dashboard |
| Languages | 10 · 8,424 translated units · 0 English fallbacks |
| Tests | 195 / 195 across 10 suites |

---

## Conventions

- **Backend** — ES modules, controller / route / model separation, `{ success, message, data }` JSON envelope.
- **Android** — ViewBinding, Retrofit + Gson, Coil, Material 3. `android.nonTransitiveRClass=true`, so shared resources are referenced as `com.sukobin.core.R`.
- **Strings** — nothing user-facing is written in Kotlin or JSX. It goes in `strings.xml` or `strings.en.js` and through the translator.
- **Chips and filters match on id, never on label text** — a filter compared against a translated label silently stops working the moment someone switches language.

---

## Licence

Not yet licensed. All rights reserved pending a decision.
