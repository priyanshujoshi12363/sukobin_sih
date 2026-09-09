# Sukobin — How to Explain It to Anyone

This file is for you, not for judges. It explains the whole project in simple words so you
can write your own script from it.

Everything here is true and checked. Do not add anything to it. If a judge catches you
claiming one thing you cannot show, they stop believing the rest.

**Problem Statement 26002 · MDoNER · Smart India Hackathon 2026**

---

## Part 0 — The 30-second version

Learn this by heart. Say it exactly like this if someone asks "what is your project?"

> In the North East, roads get blocked by landslides and floods all the time. Nobody knows
> until a truck is already stuck. Putting sensors on 3,500 km of hill road is too expensive.
>
> So we don't. We built a delivery app. A driver who is already going from Dimapur to Imphal
> tells us that route, and we show him only the parcels that lie on that road. He earns money
> from a trip he was making anyway.
>
> And while he drives, his phone sends us GPS every 20 seconds. If ten vehicles on one stretch
> all slow from 45 km/h to 5 km/h, that road is blocked — and we know it without any sensor.
>
> **The delivery network and the sensor network are the same network.** That is our whole idea.

---

## Part 1 — The problem, in simple words

Say these four things. That is enough.

1. **The North East has hard roads.** Hills, heavy rain, landslides, floods. Roads close often.

2. **Nobody finds out quickly.** There is no system watching the roads. A district usually
   learns a road is shut when a truck is already stuck on it, or somebody phones.

3. **Because of that, things arrive late.** Medicines, food, farm produce, building material.
   Late supplies mean shortages and higher cost. In some places a road closing means the whole
   district is cut off.

4. **Putting sensors everywhere is not possible.** Cameras and road sensors cost too much,
   need power and need maintenance. On 3,500 km of hill highway it will never happen.

> **One line to say it:** *"The problem is not that roads close. The problem is that nobody
> knows they closed."*

---

## Part 2 — Our idea, in simple words

### The normal way (what everyone else does)

Hire delivery vehicles. Buy road sensors. Both cost a lot of money.

### Our way

**Use the vehicles that are already on the road.**

Think of it like a shared taxi. A taxi is going Dimapur to Imphal anyway. There is empty space
in it. Why should a separate delivery van make the same trip?

So in our app:

- A driver opens the app and says **"I am going Dimapur to Imphal today."**
- We show him **only the parcels that lie on that road**, as many as his vehicle can hold.
- He picks them up on the way and drops them on the way. **No extra trip. No detour.**
- He earns money from a journey he was already making.

### And now the clever part

That driver's phone is sending us GPS every 20 seconds.

We know which road he is on. We know how fast he is going. We know how fast that road is
*normally*.

- Normal speed on this road: **45 km/h**
- What vehicles are doing right now: **5 km/h**
- So: **that road is blocked.**

We did not install one sensor. **The driver is the sensor.**

> **One line to say it:** *"Every vehicle already on the road is a sensor. We just had to ask it."*

---

## Part 3 — How it works, step by step

Walk through this slowly. Six steps.

| Step | What happens |
|---|---|
| **1. Driver declares the route** | He types "Dimapur" and "Imphal" in the app. |
| **2. We find the real road** | Not a straight line — the actual road, which goes through Kohima and Senapati. A straight line would cross mountains. |
| **3. We match parcels** | Only parcels whose pickup AND drop are on that road, in the same direction he is travelling, within his vehicle's capacity. |
| **4. He drives** | His phone sends location and speed every 20 seconds, or every 40 metres. |
| **5. We work out the road's condition** | We take all vehicles on that stretch in the last 45 minutes, take the middle speed, and compare it to the road's normal speed. |
| **6. Everyone gets told** | Officers see it on the dashboard. Other drivers get an alert. The forecast updates. If a road is blocked, the route planner finds another way. |

---

## Part 4 — The four apps (who uses what)

We built **four Android apps and one website**. Explain them as four different people.

### 1. Customer app — the person sending something

Like any delivery app. Browse shops, add to cart, pay, track your parcel on a map.
When the driver comes within 10 km, the customer gets a message: *"Driver is near."*
The driver cannot mark it delivered without a 4-digit OTP from the receiver.

**Why the OTP:** so nobody can say "delivered" while standing on the road outside.

### 2. Merchant app — the shop owner

Adds products, sees orders, marks them ready. When a shop marks an order ready, it goes
into the pool that drivers can see.

### 3. Driver app — the most important one

This is a delivery app on the outside and a sensor on the inside.

- Register: we check the vehicle number against the **government VAHAN database**. That tells
  us what kind of vehicle it is and how many parcels it can carry.
- Go online → the app starts sending GPS. Go offline → **it stops completely.**
- Declare route → get a list of parcels on that road.
- Do the trip → pick up, drop, take the OTP.
- See a landslide? **Speak into the phone in your own language** and add a photo.

> **Say this about privacy:** *"We only track a driver while he is online and working. The
> moment he goes offline, tracking stops. We are not following people around."*
> Judges will ask this. Answer it before they do.

### 4. Officer app — the government officer

- Sees the roads in his own area only. A block officer does not see the whole North East.
- Sees each road's status now, and the chance it closes in the next 3 days.
- Sees a list of reports from drivers waiting to be checked, with photos.
- Can confirm a report, reject it, or set a road's status himself.
- Can also report by speaking, in 10 languages.
- **Works offline.** In hill areas there is no network. The report is saved in the phone and
  sent automatically when signal comes back.

---

## Part 5 — The dashboard (the big screen)

This is the website for the control room. Open it during the demo.

**Left side** — the numbers: 42 roads, 3,567 km, 82 districts, how many are blocked right now,
how many vehicles are online.

**Middle** — the map of the whole North East. You can colour it three ways:

- **Status** — what the roads are doing right now (from driver speed)
- **Risk now** — how dangerous each road is today
- **3-day forecast** — the chance each road closes in the next three days

**Right side** — six tabs: Alerts, Weak points, Forecast, Route planner, Supplies, Emergency.

### The one panel to point at

There is a panel called **"What we can see"**. It shows what percentage of roads we actually
have data for.

> **Say this:** *"Most dashboards pretend they know everything. Ours shows what it does not
> know. If a road is grey, we say why it is grey — no vehicle has passed it yet."*

Judges remember honesty. This panel is worth pointing at.

---

## Part 6 — The AI, explained simply

There are **two different AI systems**. Do not mix them up — a judge may test you on this.

### System 1 — What is happening NOW (from driver speed)

No machine learning here. Just maths, and it is very reliable.

Take every vehicle that passed this road in the last 45 minutes. Take the middle speed
(the median). Divide by the road's normal speed.

| Result | Meaning |
|---|---|
| Below 15% of normal | **BLOCKED** |
| Below 35% | **RESTRICTED** — heavy jam |
| Below 60% | **SLOW** |
| Above 60% | **OPEN** |

**Why the middle speed and not the average?** Because if one driver stops for tea, the average
falls and it looks like a jam. The middle value ignores him.

**The safety rule:** we need **at least 4 readings from at least 2 different vehicles** before
we change a road's status.

> **Say this:** *"One driver parked for lunch must never close a national highway. So we need
> two different vehicles to agree before we believe anything."*

This is a strong line. Use it.

### System 2 — What will happen in the NEXT 3 DAYS (machine learning)

This one is a real trained model.

- **What it learns from:** real weather that actually happened — rain, snow, temperature —
  from Open-Meteo, for 42 roads over 877 days. That is **109,116 road-days** of data.
- **What it looks at:** 18 things. How much rain fell in the last 24 hours and 72 hours,
  how hard the rain is coming, slope of the hill, height, whether that road has a landslide
  history, whether it is monsoon season, and so on.
- **What it gives you:** the chance this road closes in 24 hours, 48 hours and 72 hours.

**The most important thing it learned:** *how hard* the rain falls matters more than *how much*.
80 mm in one hour brings a hillside down. 80 mm over three days just soaks in. The model
worked this out by itself — it is the biggest weight in the model.

### The two scores, in simple words

Judges will ask "how accurate is it?" Learn these two.

**AUC = 0.883**
> *"Take one road that really closed and one that did not. Our model gives the closed one a
> higher score 88 times out of 100. A coin toss would be 50."*

**Brier = 0.092**
> *"This measures how honest the numbers are. When we say 30%, it happens about 30% of the
> time. Lower is better and below 0.1 is good."*

**And this matters:** we trained the model only on data up to 1 March 2026, and tested it on
everything after. **It never saw the answers it was tested on.**

### Why we did NOT use a big deep-learning model

A judge may ask this. Good answer:

> *"We chose a simpler model on purpose, because it can explain itself. When our dashboard says
> 69%, it can also say why — three-day rainfall on a landslide-prone slope. An officer has to
> decide whether to trust that number. A black box that is slightly more accurate but cannot
> explain itself is useless to him. We also trained a bigger model alongside and only use it if
> it actually wins on data it has not seen."*

---

## Part 7 — The eight things that are new

If a judge asks "what is innovative here?", give these. Do not just say the first one.

| # | Innovation | Simple explanation |
|---|---|---|
| 1 | **Carriers are the sensors** | One journey delivers goods AND reads the road. Nobody else does this. |
| 2 | **No hardware at all** | Nothing to install, power or repair. The driver's own phone is the sensor. |
| 3 | **Voice reporting in 10 languages** | A driver at a landslide will not fill a form. He speaks. The AI understands, then **reads its understanding back** so he can correct it before it is filed. |
| 4 | **Works offline** | Reports save in the phone and sync later. Each has an ID, so the same landslide is never filed twice. |
| 5 | **The AI explains itself** | Every prediction shows which factor caused it. |
| 6 | **A trust ladder** | A driver's report can slow a road down, but only an officer can close one. |
| 7 | **Photo + GPS evidence** | Every incident has a photo, a location, a time and the officer who confirmed it. Not a phone call. |
| 8 | **It admits what it cannot see** | The coverage panel publishes our blind spots. |

### The 10 languages

English, Hindi, Assamese, Bengali, Nepali, Meiteilon (Manipuri), Khasi, Mizo, Nagamese, Kokborok.

> **Say this:** *"Four of these — Khasi, Mizo, Nagamese, Kokborok — have almost no software
> support anywhere. An officer in West Garo Hills or a driver in Kolasib is exactly the person
> this problem statement is about. Everything is translated — 8,424 pieces of text, with zero
> English left."*

This lands very well with MDoNER judges. Do not skip it.

---

## Part 8 — How we answer the problem statement

The PS has 8 points, (a) to (h). Point at these one by one.

| Clause | What they asked | What we built |
|---|---|---|
| **(a)** | Real-time road and bridge accessibility | 42 stretches, 3,567 km, 82 districts, live from driver GPS |
| **(b)** | Predict disruptions | 24/48/72-hour closure risk on every road |
| **(c)** | Alternate routes and delay estimate | We check 3 real road alternatives and give an ETA adjusted for conditions |
| **(d)** | GPS tracking of essential goods | Every 20 seconds; medicines, food, produce, construction material flagged |
| **(e)** | Automated alerts | Blocked road, cut-off region, high-risk corridor |
| **(f)** | Field officers upload photos and reports | Photo + GPS + voice, works offline |
| **(g)** | Central dashboard | District status, bottlenecks, emergency routes, live supplies |
| **(h)** | Multilingual and offline | 10 languages; reports sync when signal returns |

---

## Part 9 — The business model (how it makes money)

Judges always ask "how will this survive after the hackathon?"

**Money coming in — three ways:**

1. **A small fee on each delivery.** ₹5 on a parcel, ₹2 on a shop order.
   **The driver keeps the whole delivery charge.** That is what makes it worth his time.
2. **Selling the dashboard to government.** State transport departments and disaster
   management departments pay for the road intelligence, per state or per district.
3. **Shop plans.** Optional paid listing and analytics for merchants.

**Money going out:**

Only cloud servers. **No vehicles, no drivers on salary, no hardware.**

> **The killer line:** *"Every other logistics company's biggest cost is its fleet. We have no
> fleet. Our cost for carrying one more parcel is almost zero, because the vehicle was going
> there anyway."*

---

## Part 10 — Timeline (what is done, what is next)

Be honest here. It is more convincing than pretending everything is finished.

| Phase | When | What |
|---|---|---|
| **1** | ✅ Done | Core platform — 4 apps, dashboard, 118 API endpoints |
| **2** | ✅ Done | Intelligence — road sensing, forecast model, alerts, 10 languages |
| **3** | Next 4 weeks | Warn drivers about roads ahead, re-route mid-journey, delay alerts |
| **4** | 3 months | Pilot on one real corridor with a state transport department |
| **5** | 6–12 months | More states, connect to government systems |

---

## Part 11 — Numbers to remember

Learn these five. You will be asked.

| Number | What it is |
|---|---|
| **42 roads · 3,567 km** | Our road network — real road shapes, not straight lines |
| **109,116 road-days** | How much real weather data the model learned from |
| **0.883** | Model accuracy (AUC). Coin toss = 0.5 |
| **10 languages · 8,424 texts** | Everything translated, nothing left in English |
| **195 out of 195** | Automated tests passing |

Others if needed: 82 districts · 8 states · 12 corridors · 118 API endpoints · 4 apps + 1 dashboard.

---

## Part 12 — The demo (what to click, in order)

Practise this until it takes 4 minutes.

**Before you start — check these or the demo will fail:**

- [ ] `ALLOW_DEV_OTP=true` is set on the server — **without this nobody can log in**
- [ ] `DEMO_PAYMENT=true` is set — without this payment fails
- [ ] Run `node scripts/seedParcels.js` — parcels expire after 2 hours, so re-run it that morning
- [ ] Run `node scripts/simulateTraffic.js` — so vehicles show on the map
- [ ] Dashboard and backend both running
- [ ] Phone charged, apps installed, internet working

### The order to show things

**1. Dashboard first (1 minute)**
Open the map. Say: *"This is the whole North East. 42 roads, 3,567 km, live."*
Switch between Status → Risk → 3-day forecast so they see the colours change.
Point at the "What we can see" panel and say the honesty line.

**2. Driver app (1 minute)**
Go online. Type Dimapur → Imphal. Press Find.
Say: *"He was going anyway. Now he sees 3 parcels lying on that exact road."*

**3. The sensing — this is your moment (1 minute)**
On the laptop run:
```
node scripts/simulateTraffic.js --slow "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA"
```
Refresh the dashboard. **The road turns red.**
Say: *"Nobody reported that. No sensor. Just vehicles slowing down."*

That is the moment they will remember. Practise it.

**4. Officer app (1 minute)**
Speak a report in Hindi or Assamese. Show the AI reading it back.
Take a photo. Show it appearing in the officer's verify queue.
Switch the app language and show the whole screen change.

**5. Close (15 seconds)**
> *"Roads get delivered and measured by the same journey. That is Sukobin."*

---

## Part 13 — Hard questions, and honest answers

Read these before you go in. The honest answers are stronger than clever ones.

**Q: What if there are no vehicles on a road?**
> *"Then we have no live reading for it, and the dashboard says so — that is what the coverage
> panel is for. But the weather forecast still covers every road, even one with no traffic. So
> quiet roads are still predicted, just not sensed."*

**Q: What if a driver gives a false report?**
> *"He cannot close a road. An unverified report can only mark a road as restricted. Only an
> officer, after seeing the photo and the GPS location, can close it."*

**Q: What if one driver just parks somewhere?**
> *"We need at least 4 readings from at least 2 different vehicles before anything changes. One
> parked driver is ignored."*

**Q: How accurate is your AI? Where did the training data come from?**
> *"AUC 0.883 on data the model had never seen. But I should be honest about one thing: there is
> no public record of past road closures in the North East. That data does not exist. So we
> generated our training labels from a rainfall-threshold model built on IMD rainfall data and
> GSI landslide maps. When a real officer verifies a real closure, that always overrides our
> generated label. We say this on the dashboard itself — we are not hiding it."*

**This answer wins respect.** A judge who catches you hiding it would not have.

**Q: Is this just another delivery app?**
> *"A delivery app moves parcels. Ours moves parcels and produces a live map of road
> accessibility for eight states at the same time, from the same GPS. Take away the delivery
> and the sensing stops. That is why they are one product."*

**Q: What about driver privacy?**
> *"We only track while he is online and working. He switches off, tracking stops immediately.
> That is built in, not a setting we added later."*

**Q: Does it work without internet?**
> *"The officer app does — reports save on the phone and sync later, and duplicates are
> rejected so nothing is filed twice. I should be honest: the other three apps do not have that
> yet. It is in our next phase."*

**Q: Have you integrated with government systems?**
> *"We use VAHAN for vehicle registration. Beyond that, no — and I would not claim otherwise.
> The platform is built so those integrations plug in, and that is phase 5."*

**Q: What is not finished?**
> *"Four things. Drivers are not yet warned about roads ahead of them — the backend for it is
> built and tested, but no screen calls it yet. There is no re-routing mid-journey. Delay alerts
> are calculated but not sent. And bridges are in our data model but we have only seeded roads
> so far. All four are in phase 3."*

Saying this yourself makes everything else you said believable.

---

## Part 14 — How to speak

**Use simple words.**

| Do not say | Say |
|---|---|
| "We leverage probe vehicle telemetry" | "The driver's phone tells us how fast he is going" |
| "Multimodal corridor optimisation" | "We find parcels on the road he is already taking" |
| "Explainable AI framework" | "The AI tells you why it gave that number" |
| "Crowdsourced sensing paradigm" | "Every vehicle is a sensor" |

**Three rules:**

1. **Short sentences.** One idea per sentence. Stop. Next sentence.
2. **Say the number, then what it means.** "88 out of 100 times" is better than "0.883".
3. **If you do not know, say so.** *"I do not have that number with me, but I can find it."*
   Never guess. One guess that turns out wrong destroys everything else you said.

**Practise out loud.** Reading this silently is not practice. Say it to a friend who knows
nothing about the project and see where they look confused. That is the part to fix.

---

## Part 15 — Five-minute pitch structure

| Time | What | What to say |
|---|---|---|
| 0:00–0:30 | The problem | Roads close. Nobody knows. Supplies stop. |
| 0:30–1:00 | The idea | Every vehicle already on the road is a sensor. |
| 1:00–2:00 | Live demo | Dashboard, then the road turning red. |
| 2:00–3:00 | The AI | Speed for now, weather model for the next 3 days. Give AUC. |
| 3:00–4:00 | The reach | 10 languages, offline, voice, photo evidence. |
| 4:00–4:30 | Money and plan | ₹5 a parcel, dashboard to government, no fleet. |
| 4:30–5:00 | Honesty and close | What is not done yet, then the closing line. |

**Closing line:**

> *"In the North East, a road closing is not an inconvenience. It is a district losing its
> medicines. We built a way to know it the moment it happens — without a single sensor —
> because the vehicles were already there."*

---

## Part 16 — Before you present

- [ ] `TEAM_ID` filled in `ppt/build.py`, PPT rebuilt, PDF exported
- [ ] PS ID checked on the portal (we have 26002)
- [ ] Server env vars set: `ALLOW_DEV_OTP`, `DEMO_PAYMENT`
- [ ] Parcels seeded **that morning** — they expire in 2 hours
- [ ] Traffic simulated so vehicles show
- [ ] APKs installed and logged in
- [ ] The `--slow` command copied somewhere you can paste it fast
- [ ] Everyone on the team has read Part 13
- [ ] Somebody other than you can also explain Part 0

**Last thing.** Do not memorise every word here. Learn Part 0, the five numbers in Part 11, and
the honest answers in Part 13. Everything else you can say in your own words — and your own
words will sound better than mine.
