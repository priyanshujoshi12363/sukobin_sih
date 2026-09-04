# Sukobin — Platform Spec

> **Sections 0-10** are the original route-matching engine (written against the
> Uttarakhand pilot; the same maths now runs on the NER network).
> **Sections 11-16** are the platform plan: what each app does, how the four
> apps and the dashboard fit together, and the process flows to review.

---

# Part A — The Core Algorithm (road-route matching + live tracking)

The definitive spec for the engine. Builds on `ROUTE_MATCHING.md` / `ROUTE_MATCHING_FLOW.md`
but upgrades it to **real road polylines**, a **2 km corridor**, **vehicle-capacity locking**,
**ETA + direction**, and **live driver tracking with proximity notifications**.

---

## 0. One-paragraph summary

Every delivery (a **parcel** P2P, or an **order** shop→customer) has a real **road
polyline** from its initial point to its final point, fetched and stored when it enters
the pool. A driver declares a journey (e.g. Haldwani → Almora); we fetch the **road
polyline of that journey** (which naturally passes Bhowali/Bhimtal/etc.). We then show the
driver only the deliveries whose **pickup and drop both lie within 2 km of the driver's
road polyline, in the forward direction**, each with **address, coordinates, the delivery
fee, and ETA**. The driver accepts up to their **vehicle capacity** (bike 2, auto 3, car 5,
…); once full the list **locks** to just the accepted jobs. The driver's phone streams its
**live location**; we use it to tell the customer *"your parcel is with the driver"* on
pickup, and *"driver is near — wait for the call"* when the driver comes within **10 km** of
the customer.

---

## 1. Coordinates & polylines

- All coordinates are GeoJSON **`[lng, lat]`**.
- **Polyline** = ordered `[[lng,lat], …]` along the actual road.
- Source = **OSRM** (`/route/v1/driving/{c1};{c2};…?overview=full&geometries=geojson`),
  configurable via `OSRM_URL`. If OSRM is unreachable we **fall back to straight segments**
  so nothing ever blocks. Util: `backend/src/utils/routing.js → fetchRoutePolyline(coords)`
  returns `{ polyline, distanceKm, durationMin, source }`.
- Why road, not straight line: in the hills a straight Haldwani→Almora line cuts through a
  ridge; the road wraps via Bhowali. Matching on the **road** polyline is what makes "on my
  way" correct, and it auto-includes the intermediate towns without the driver typing them.

---

## 2. Data model additions

```jsonc
// Parcel  (set at creation)
routePolyline: [[lng,lat], …]
routeDurationMin: Number          // distanceKm already exists
driverNearNotified: Boolean       // dedupe the "driver near" push

// Order   (set when it becomes READY_FOR_PICKUP = enters the pool)
routePolyline: [[lng,lat], …]
routeDistanceKm: Number
routeDurationMin: Number
driverNearNotified: Boolean
assignedPartner, assignedAt, deliveryOtp   // (already added)

// Partner
currentLocation: { type:Point, coordinates:[lng,lat] }   // streamed live
activeRoute: { polyline:[[lng,lat]], stations:[String], distanceKm, durationMin, updatedAt }
```

---

## 3. Lifecycle — when polylines are fetched & stored

```
PARCEL  create  ──▶ geocode pickup+drop ──▶ fetchRoutePolyline([pickup, drop])
                    store routePolyline/distanceKm/routeDurationMin ──▶ status POOLED (COD)

ORDER   READY_FOR_PICKUP ──▶ fetchRoutePolyline([shop.location, order.location])
                    store routePolyline/routeDistanceKm/routeDurationMin ──▶ joins pool

DRIVER  POST /route/match ──▶ fetchRoutePolyline([origin, …stops, destination])
                    store partner.activeRoute (polyline + distance + duration + updatedAt)
```

---

## 4. The match (per driver request)

```
Input: driver journey polyline  J  (road), driver currentLocation D, vehicle capacity K
Pool : POOLED parcels + READY_FOR_PICKUP orders  (normalized to DeliveryJobs)

For each job:
  dPick = distToRoute(job.pickup, J)        ◇ > 2 km ? skip
  dDrop = distToRoute(job.drop,   J)        ◇ > 2 km ? skip
  sPick = sAlong(J, job.pickup)
  sDrop = sAlong(J, job.drop)
  ◇ direction:  sAlong(J,D) ≤ sPick ≤ sDrop   else skip   (no backtracking)
  offRouteKm = dPick + dDrop
  etaMin     = etaMinutes(job.routeDistanceKm)     // pickup→drop travel time
  score      = fee − w·offRouteKm − w·age
Return jobs sorted by score, each: { kind, refId, type, fee, pickup{addr,coords},
        drop{addr,coords}, offRouteKm, etaMin, routePolyline, pickupOrder }
```

`CORRIDOR_KM = 2` (env `MATCH_CORRIDOR_KM`). Geometry primitives live in `geo.js`
(`haversineKm`, `distToRouteKm`, `sAlongKm`) — already built & unit-tested.

---

## 5. Accept + capacity lock

```
Driver taps jobs on the list / map.
  selected.length < K  → allowed
  selected.length = K  → list LOCKS, only accepted jobs remain interactive
Start Trip ──▶ POST /trip/claim {jobs:[{kind,id}]}
  per job ATOMIC compare-and-swap (status free → ASSIGNED/assignedPartner=me)
  loser of a race is skipped (another driver grabbed it)
  reject if claimed count would exceed K
```
Capacity by vehicle (`getVehicle().capacity`): bike 2, auto 3, car 5, pickup 8, truck 10.

---

## 6. The trip — per stop

```
ASSIGNED ─pickup(OTP optional)─▶ PICKED_UP/PICKED
   └─▶ push customer: "📦 Your {order/parcel} is now with the driver"
Tap a job ▶ shows: route on MAP, ETA "~22 min", turn-to-drop direction
…driving… live location streamed every move
when haversine(driver, job.drop) ≤ 10 km AND !driverNearNotified:
   └─▶ push customer: "🛵 Driver is near — please be ready / wait for the call"
       set driverNearNotified = true
arrive ▶ deliver (OTP) ─▶ DELIVERED ─▶ credit fee, push "✅ Delivered"
all jobs delivered ▶ Trip complete
```

---

## 7. Live location tracking

**App (driver):**
- `expo-location` foreground updates (`watchPositionAsync`, ~every 15 s / 50 m) while the
  driver is **online** or **on a trip**; stops when offline / trip done.
- Each fix → `PATCH /api/partner/location { coordinates:[lng,lat] }`.

**Backend `PATCH /location`:**
1. `partner.currentLocation = Point(coords)`, `lastActive = now`.
2. **Proximity scan** over the driver's *active* jobs (orders `PICKED/ON_THE_WAY`,
   parcels `PICKED_UP/IN_TRANSIT`): if `haversine(coords, job.drop) ≤ 10 km` and the job's
   `driverNearNotified` is false → push the customer the "driver near" alert and set the flag.
3. (Future) write a small `locationPings` trail for live map of the driver to the customer.

`PROXIMITY_KM = 10` (env `DRIVER_NEAR_KM`). ETA helper: `etaMinutes(km) = round(km / AVG_SPEED_KMH * 60)`, `AVG_SPEED_KMH` default 28 (hill roads).

---

## 8. Notifications (who gets what)

| Event | To | Message |
|------|----|---------|
| Job enters pool on driver's route (online) | **Driver** | "New order/parcel on your route +₹fee" |
| Driver picks up | **Customer** | "Your {order/parcel} is now with the driver" |
| Driver within 10 km of drop | **Customer** | "Driver is near — wait for the call" |
| Delivered | **Customer** | "Delivered ✅" |

All via Expo push, channel `sukobin_alerts` (+ notification.wav). Driver pushes gated on
`isOnline` + a fresh `activeRoute`.

---

## 9. Endpoints (partner)

```
POST  /api/partner/route/match     online; road-polyline match → ranked jobs (+ETA, +polyline)
POST  /api/partner/trip/claim      atomic capacity-checked claim
POST  /api/partner/trip/picked     → notify customer "with driver"
POST  /api/partner/trip/deliver    OTP → DELIVERED + credit + notify
PATCH /api/partner/location        live fix → proximity notify
GET   /api/partner/stats           dashboard (delivery fees only)
GET   /api/partner/history         past deliveries (orders+parcels, paginated)
```

---

## 10. Build phases

1. **Routing + polylines** — `routing.js`; store on parcel/order; matchRoute uses road
   polyline + 2 km corridor + ETA. ← *foundation*
2. **Live tracking + proximity** — `PATCH /location`, "with driver" + "driver near" pushes,
   driver location loop in the app. ← *the live layer*
3. **Map UI** — `react-native-maps` route preview on a job/trip detail with pickup, drop,
   the stored `routePolyline`, and the live driver dot; "ETA + direction" panel.
4. **Polish** — waypoint chips (add Bhowali/Bhimtal explicitly), customer live-map of driver,
   parcel RAZORPAY → pool-on-payment, multi-leg relay.

> Already done before this spec: normalized DeliveryJobs, corridor+direction matcher,
> atomic claim, online gate, stats, history, driver-bound "new job" push. This spec adds the
> **road polylines, ETA, live tracking, and customer proximity notifications** on top.

---

# Part B — Platform Plan

Everything below is the plan for review. Mark it up freely: strike what should not
exist, add what is missing, and move items between the "build" and "skip" columns.
Nothing here is built until it survives that pass.

---

## 11. What problem each piece answers

The problem statement (MDoNER, NER Logistics Accessibility Intelligence) asks for
eight things, a to h. Every component below exists to answer one of them. If a
component cannot be traced to a clause, it should be cut or kept out of the pitch.

| Clause | Asked for | Answered by |
|---|---|---|
| a | real-time road, bridge, transport accessibility | RoadSegment state + probe sensing + officer reports |
| b | predict disruptions (landslide, flood, rain, damage, congestion) | risk model over weather + terrain + history |
| c | AI alternate routes and travel-delay estimates | route planner (OSRM alternates, condition-adjusted ETA) |
| d | GPS tracking of essential commodities | carrier app location stream + consignment tracking |
| e | automated alerts (blocked, inaccessible, delayed, high-risk) | alert engine + FCM push |
| f | field officials upload geo-tagged updates, photos, incidents | **officer app (not built)** |
| g | centralized dashboards (4 named views) | control dashboard |
| h | multilingual notifications + offline sync for low-network areas | **partially built** |

### The one-line thesis

> There is no delivery fleet in the hills, and building one is uneconomical.
> Sukobin uses the vehicles already making the journey — and because those
> vehicles are constantly on the road, they double as the sensor network that
> measures whether the road is passable.

The carrier network and the intelligence layer are the same system. That is the
claim the whole platform has to support.

---

## 12. The four apps and the dashboard

Four Android apps plus one web dashboard, over one backend.

### 12.1 Citizen app — `com.sukobin.app`

Who: anyone sending a parcel or ordering from a local shop.

| Does | Status |
|---|---|
| Register / login by phone + OTP | built |
| Browse shops and products, cart, checkout, pay | built |
| Book a parcel: pickup and drop on a map, receiver, type, weight, live fare | built |
| Track their order or parcel | list only, no live map |
| Receive delivery notifications | built (FCM) |

PS relevance: **low**. This is the commercial layer that gives the carrier network
volume and revenue. It should be one line in the pitch, not the headline.

### 12.2 Carrier app — `com.sukobin.partner`

Who: any traveller with a vehicle — tourist, commuter, local driver — who wants
to earn on a journey they are already making.

| Does | Status |
|---|---|
| Register by number plate (registry-verified) + OTP | built |
| Declare a route (from, to) | built |
| See only deliveries that ride along that road | built |
| Accept up to vehicle capacity, capacity locks | built |
| Refuse to be routed down a blocked corridor | built |
| Stream GPS while online — this is the sensor feed | built |
| Pickup and delivery with OTP handoff | endpoints built, screen missing |
| Earnings, trip history | built |
| Report a road problem seen on the way | **not built** |

PS relevance: **high**. Clause d directly; and it is the source of the probe data
behind clause a.

### 12.3 Merchant app — `com.sukobin.merchant`

Who: shopkeepers in hill towns.

| Does | Status |
|---|---|
| Register a shop, login | built |
| Revenue, order and product stats | built |
| See incoming orders | built |
| List and manage products | **not built** |

PS relevance: **low**. Same status as the citizen app: supporting cast.

### 12.4 Officer app — `com.sukobin.officer` — BUILT

Who: BDO, SDM, PWD engineer, disaster-management staff, BRO/NHIDCL.

| Does | Status |
|---|---|
| Login by phone + OTP; registration asks for department and jurisdiction | done |
| File a geo-tagged report, picking the road from a nearby list | done |
| Saves to disk before any network call, syncs when signal returns | done |
| See own reports and whether they were confirmed | done |
| Verify or reject others' reports — STATE and REGION officers only | done |
| Override road status directly — senior officers only | done |
| Road list and three-day model forecast scoped to the officer's own patch | done |
| Switch alert language across 10 languages | done |
| Read alerts in an in-app inbox, filter unread, mark read | done |

Two things the app deliberately does **not** do. It has no photo capture yet:
the report carries a `photos` array the server accepts, but the camera and the
upload are not wired, so photo evidence is still API-only. And a district
officer cannot confirm anything, including their own report — `canVerifyIncidents`
is derived from jurisdiction in a pre-save hook and is never accepted from the
client, so the app cannot grant itself the power to close a highway.

**This app has no push channel, by design.** Alerts reach an officer through an
in-app inbox instead: the alert engine writes one `OfficerNotification` row per
officer whose jurisdiction the alert touches, and the Notifications screen is
where it lands. A `(officer, alertId)` unique index means a re-scan can never
fill an inbox with copies of the same news, and `backfillInboxes()` delivers
everything still live to an officer who registers later, so a new account does
not open onto an empty inbox while its district is cut off.

The reasoning: an alert an officer must act on should be a row they can keep,
re-read, filter and mark, not a banner that vanishes from a lock screen.
Partners still get push, because a driver already on the road cannot be
expected to open an app to learn the road ahead is shut.

Consequences: the app carries no Firebase dependency, no `google-services.json`
and no `POST_NOTIFICATIONS` permission. `:core` supplies Firebase to the other
three apps, so the officer manifest strips the messaging service, the Firebase
metadata and the notification permission with `tools:node="remove"` — verified
absent from the merged manifest.

### 12.5 Control dashboard — web

Who: district and state administration, MDoNER.

Clause g names four views explicitly:

| Named view | Status |
|---|---|
| District-wise connectivity status | built (table + map) |
| **Logistics bottlenecks and supply chain gaps** | **missing** |
| Emergency and disaster-time accessibility routes | thin |
| Real-time movement and delivery status of essential supplies | list only |

PS relevance: **highest scrutiny**. This is what a judge looks at longest.

---

## 13. Process flow — the sensing loop

The core claim of the platform. Two independent sources decide whether a road is
passable, and neither can act alone.

```
   CARRIER VEHICLES                        FIELD OFFICERS
   (already on the road)                   (eyes on the ground)
          |                                       |
          | GPS fix every ~15 s                   | geo-tagged report
          | PATCH /partner/location               | photo + description
          v                                       v
   +---------------+                       +----------------+
   | map-match to  |                       | AI classifies  |
   | RoadSegment   |                       | free text ->   |
   | rolling median|                       | type, severity,|
   | speed vs      |                       | blocks traffic,|
   | baseline      |                       | clearance hrs  |
   +-------+-------+                       +--------+-------+
           |                                        |
           | speed ratio                            | implied status
           | 0.95 -> OPEN                           | LANDSLIDE -> BLOCKED
           | 0.50 -> SLOW                           | ACCIDENT  -> SLOW
           | 0.25 -> RESTRICTED                     |
           | 0.08 -> BLOCKED                        |
           |                                        |
           +------------------+---------------------+
                              |
                              v
                   +----------------------+
                   |  STATUS RESOLVER     |
                   |  confidence-weighted |
                   |  vote                |
                   +----------+-----------+
                              |
        unverified report  -> capped at RESTRICTED
        verified by officer -> full implied status
        probe corroborates  -> confidence raised
        single vehicle only -> ignored (needs >= 2)
        weather forecast    -> never sets status, only risk
                              |
                              v
                   +----------------------+
                   |  RoadSegment.status  |
                   +----------+-----------+
                              |
         +--------------------+--------------------+
         |                    |                    |
         v                    v                    v
   route matching       dashboard map          alerts + push
   refuses blocked      district colours       to carriers,
   corridors            bottleneck panel       officers, customers
```

**Guards that must not be removed**

- One vehicle cannot close a road. Two distinct vehicles and four samples minimum.
- A GPS fix worse than 120 m accuracy is discarded.
- A weather forecast predicts; it never asserts current status.
- An unverified field report is capped at RESTRICTED until a human verifies it
  or probe data corroborates it.

---

## 14. Process flow — a parcel, end to end

```
CITIZEN                    BACKEND                       CARRIER
   |                          |                             |
   | pick pickup + drop       |                             |
   | on the map               |                             |
   |------------------------->|                             |
   |                     quote fare                          |
   |<-------------------------|                             |
   |                          |                             |
   | confirm booking          |                             |
   |------------------------->|                             |
   |                    road polyline fetched                |
   |                    parcel -> POOLED (1 h)               |
   |                          |                             |
   |                          |   declares route A -> B      |
   |                          |<----------------------------|
   |                          |                             |
   |                    road polyline for the journey        |
   |                    accessibility check:                 |
   |                      any BLOCKED segment -> refuse      |
   |                    corridor match:                      |
   |                      pickup and drop within 10 km       |
   |                      forward direction only             |
   |                      rank by fee, detour, age           |
   |                          |---- matching parcels ------->|
   |                          |                             |
   |                          |<--- accepts (<= capacity) ---|
   |                    atomic claim, capacity lock          |
   |                          |                             |
   |<-- "your parcel is with the driver" ---|<-- picked up --|
   |                          |                             |
   |                          |<--- GPS stream (sensing) ----|
   |                          |                             |
   |<-- "driver is near" (10 km) -----------|                |
   |                          |                             |
   |                          |<--- delivered + OTP ---------|
   |<-- "delivered" ----------|      fee credited           |
```

---

## 15. Process flow — a road closes

The demo sequence. Every step already works except the officer's screen.

```
1. HEAVY RAIN            risk model raises Dimapur-Kohima to SEVERE (0.76)
                         from 161 mm real rainfall over 72 h
                         -> dashboard shows the corridor amber
                         -> NOT marked blocked: a forecast is not an observation

2. OFFICER REPORTS       BDO Senapati, no signal, photographs a landslide
   [OFFICER APP]         "Bada landslide ho gaya hai Maram ke paas, pura road
                         band hai, koi gaadi nahi ja sakti"
                         queued on device with a clientId

3. SYNC                  officer reaches signal; report uploads
                         replayed uploads are idempotent on clientId

4. AI CLASSIFIES         LANDSLIDE / CRITICAL / blocks traffic / ~72 h clearance
                         from Hinglish free text

5. STATUS                unverified -> segment RESTRICTED (cautious)

6. VERIFIED              SDM confirms -> segment BLOCKED

7. CONSEQUENCE           carrier app refuses Dimapur -> Imphal
                         dashboard: Manipur shown as isolated
                         alerts: CRITICAL to officers and affected carriers
                         consignments already on that road are flagged
```

---

## 16. Build order — for review

Ranked by problem-statement value, not by ease.

### Tier 1 — closes named PS gaps

| # | Item | Clause | Est |
|---|---|---|---|
| 1 | **Bottleneck panel** on the dashboard | g | 2 h |
| 2 | Fix the map reading as UNKNOWN everywhere | g | 30 m |
| 3 | Strengthen the emergency view | g | 1 h |
| 4 | **Officer app** — report, my reports, verify queue, district status | f | 1-2 d |
| 5 | Offline queue with photos in the officer app | h | half d |
| 6 | Multilingual notifications (5 languages, machine-assisted, labelled) | h | half d |

### Tier 2 — high value, not explicitly named

| # | Item | Why |
|---|---|---|
| 7 | Essential-commodity priority lane + trusted-carrier tier | answers "would you trust a tourist with medicines" |
| 8 | Carrier trip screen (pickup/deliver with OTP) | the delivery loop cannot be completed in the app today |
| 9 | Multi-leg relay via hubs | what actually reaches Tawang |
| 10 | Live consignment trace on the dashboard map | clause g bullet 4, properly |

### Tier 3 — only with time to spare

| # | Item | Note |
|---|---|---|
| 11 | Learned ETA from delivery timestamps | real ML; labels already exist in `timeline[]` |
| 12 | Demand forecasting per corridor | tells carriers where the work is |
| 13 | Government data integration stubs (Bhuvan, IMD, PMGSY) | integration story for clause "integration capability" |

### Explicitly not doing

| Item | Why |
|---|---|
| Merchant product management screens | scores zero against the PS |
| More commerce polish | same |
| Real payment gateway integration | demo mode is sufficient for judging |

---

## 17. Honest status

### Verified on live data

- 42 road segments, 3,567 km, real OSRM geometry, elevation-derived gradients
- Probe sensing end to end: vehicles slowing on NH-10 drove OPEN -> SLOW ->
  BLOCKED with no human involved, and the "Sikkim has no open road" alert
  followed automatically
- AI classification: 8/8 messy Hinglish reports classified correctly
- Route planner refuses a blocked corridor and reports per-segment delay
- Officer API: 38/38 checks, including that a district officer is refused the
  verify queue and the status override
- Dashboard API: 25/25 checks
- Dashboard renders with zero console errors: 42 segments, 40 district rows,
  weak points, forecast, emergency view

### The forecast model

`backend/src/ml/` trains two learners and keeps whichever wins on a held-out
split. Both are plain JavaScript with no native dependency, so training and
inference run anywhere the API runs.

| | |
|---|---|
| Training rows | 1,09,116 road-days (42 stretches x 877 days x 3 horizons) |
| Features | 18, including two rain-terrain interactions |
| Weather | Open-Meteo archive, real observed hourly precipitation, snow, temperature |
| Split | by date — everything after 2026-03-01 held out, so no road's future leaks |
| Logistic regression | AUC 0.883, Brier 0.092 |
| Boosted stumps | AUC 0.872, Brier 0.099 |
| Chosen | logistic regression; ties go to the model that explains itself |
| Calibration | all ten reliability bins track the diagonal |
| By horizon | 24h AUC 0.859, 48h 0.877, 72h 0.893 |

**The one caveat, stated plainly.** Nobody has a machine-readable two-year
closure log for these 42 stretches, so the historical labels are Bernoulli
draws from a rainfall-threshold hazard function of the shape used in landslide
early-warning work. The label uses a 7-day antecedent window and multiplicative
terms the feature vector never sees, and it is a draw rather than the
probability itself, so the model is genuinely learning a signal out of noise —
which is why held-out AUC is 0.88 and not 1.0. Verified field reports override
the drawn label, so the training set gets more real every time the officer app
is used. This is written into the artifact as `dataset.labelNote` and shown on
the dashboard's model card. Do not claim it is trained on observed closures.

### Now true that was thin before

- **Multilingual**: 7 alert templates x 10 languages, stored on every alert and
  picked by the recipient's `preferredLanguage`. English and Hindi are
  authoritative; the other eight were written to be understood and need a
  native speaker before real deployment.
- **Offline**: the client queue exists. Reports are written to disk before any
  network call and keyed by a device-generated `clientId`, so a retry can never
  create a second copy. Verified: replaying a report returns `duplicate: true`,
  and a 3-report batch containing one already-sent report accepts 2.
- **"AI"**: now defensible as machine learning, with the caveat above. The
  calibrated risk model still runs alongside it and describes conditions *now*;
  the trained model describes the next three days.

### Still missing

- Photo capture in the officer app (server accepts photos, camera is not wired)
- Carrier trip completion screen (pickup and delivery OTP)
- Merchant product management screens — deliberately deprioritised, scores
  nothing against this problem statement

### Demo note

`node backend/scripts/simulateTraffic.js` drives vehicles along the real
geometry so the sensing layer has something to sense; `--slow <segmentId>`
stages a closure and `--clear` removes everything it made. Every vehicle it
creates is named `SIM-*`. This is a demo and load-testing tool and nothing on
the server calls it.
