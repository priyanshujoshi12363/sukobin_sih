# Sukobin — The Core Algorithm (road-route matching + live tracking)

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
