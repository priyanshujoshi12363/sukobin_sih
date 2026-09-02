# Sukobin 🚚

> A hyperlocal logistics + commerce platform for the hills of Uttarakhand (Haldwani, Almora, Nainital belt) that turns **existing journeys into delivery routes**.

Sukobin's core idea is **ride-sharing for parcels**. Instead of running a dedicated delivery fleet, Sukobin matches a customer's order with a driver (taxi, truck, bike) who is *already* travelling along the same route.

```
A taxi driver is already going Haldwani → Almora with passengers.
        │
        ▼
Sukobin detects the route.
        │
        ▼
The pending parcel for Almora is shown to that driver.
        │
        ▼
Driver accepts the parcel (within vehicle capacity).
        │
        ▼
Parcel rides along the existing journey → Customer receives the product.
```

This makes last-mile delivery in remote hill regions cheaper, faster, and lower-emission than a traditional courier model.

---

## 📦 Monorepo Structure

This repository contains **three apps + one backend**, each currently in its own git repo:

| Folder | What it is | Who uses it | Status |
|---|---|---|---|
| `backend/` | Node.js + Express + MongoDB REST API | All apps | 🟡 Core built, parcel engine missing |
| `sukobin/` | Customer app (Expo / React Native) | End customers | 🟢 Most built |
| `sukobin_mart/` | Mart / merchant admin app (Expo / React Native) | Shop owners | 🟢 Most built |
| `sukobin_partner/` | Driver / delivery partner app (Expo / React Native) | Drivers | 🔴 Template only |

> **Note:** `node_modules/`, lockfiles, `.env`, and credential JSON files are ignored in this overview. Only `.js / .ts / .tsx / .jsx` source was analysed.

---

## 🧭 The Full Product Flow (Vision)

1. **Customer (`sukobin`)** browses shops/products by category, adds to cart, and places an order to a nearby **Mart**.
2. **Mart (`sukobin_mart`)** receives the order, packs it, and lists the packed parcel into a **special "ready for pickup" pool that is visible for ~1 hour**.
3. **Driver (`sukobin_partner`)** registers with their **vehicle number plate**, opens the app, and enters their route (e.g. *Haldwani → Almora*).
4. Only parcels **matching that route's destination** are shown to the driver.
5. The driver picks up to their **vehicle capacity** (bike = 1, car/taxi = ~5, truck = ~10).
6. Parcel travels along the driver's existing journey and is handed to the customer.

---

## 🛠️ Tech Stack

**Backend** (`backend/`)
- Node.js + **Express 5** (ES Modules, `"type": "module"`)
- **MongoDB** via **Mongoose** (geospatial `2dsphere` indexes for location matching)
- **JWT** auth (`jsonwebtoken`), `bcrypt` available
- **Cloudinary** for product/shop image uploads (`multer` for multipart)
- **Firebase Admin** + **expo-server-sdk** for push notifications
- **Razorpay** SDK present (payments not yet wired)
- `helmet`, `cors`, `morgan` middleware

**All three mobile apps** (Expo SDK 54)
- **React Native 0.81** + **Expo Router** (file-based routing)
- **NativeWind / TailwindCSS** for styling
- **Firebase Auth** (phone OTP on the client side)
- `expo-notifications` for push
- `AsyncStorage` for token persistence

---

## 📂 Backend Layout (`backend/src/`)

```
backend/
├── server.js                  # App entry: middleware, route mounting, error handlers
├── src/
│   ├── config/firebaseAdmin.js
│   ├── db/index.js            # Mongoose connection
│   ├── middleware/
│   │   ├── protect.js         # protect (User JWT) + merchantProtect (Merchant JWT)
│   │   └── multer.js          # File upload handling
│   ├── models/
│   │   ├── user.model.js      # Customer (phone, address, geo location)
│   │   ├── merchant.model.js  # Mart owner (KYC: aadhaar/pan/gst, wallet)
│   │   ├── shop.model.js      # Shop (geo location, products[], ratings)
│   │   ├── product.model.js   # Product (price, stock, images)
│   │   ├── cart.models.js     # One cart per user, single-shop enforced
│   │   └── order.model.js     # Order (status machine, geo, delivery address)
│   ├── controller/            # authController, cartController, merchantController,
│   │                          # productController, shopController, orderController,
│   │                          # notificationController
│   ├── routes/                # authRoutes, merchantRoutes, shopRoutes, productRoutes,
│   │                          # userProductRoutes, cartRoutes, orderRoutes
│   └── utils/
│       ├── calculation.js     # Haversine distance + delivery-fee tiers
│       ├── cloudinary.js
│       └── notification.js    # Expo push helper
```

### API Surface (current)

| Base | Routes | Auth |
|---|---|---|
| `/api/user` | `POST /registration`, `POST /login`, `POST /complete-registration`, `POST /verify`, `POST /notify`, `POST /hello` | mixed |
| `/api/user/product` | `GET /search`, `/categories`, `/all`, `/category/:category`, `/:id`, `/shop/:shopId` | open |
| `/api/cart` | `GET /`, `POST /add`, `PUT /update/:productId`, `DELETE /remove/:productId`, `DELETE /clear`, `GET /summary` | user |
| `/api/merchant` | `POST /register`, `POST /login`, `GET /getme`, `POST /notify`, `GET /verify` | mixed |
| `/api/shop` | `POST /create`, `PUT /edit/:id`, `DELETE /delete/:id`, `GET /get` | merchant |
| `/api/product` | `GET /my-products`, `GET /search`, `GET /:id`, `POST /`, `PUT /edit/:id`, `DELETE /delete/:id`, `PATCH /toggle/:id`, `PATCH /toggle-bulk` | merchant |
| `/api/order` | `POST /check-out`, `POST /edit-address` | user |

---

## 📱 App Layouts

### Customer app — `sukobin/`
```
app/
├── (auth)/    welcome, login, register, otp-login, otp-register, complete-profile
├── (tabs)/    home, orders, history, parcel, profile
├── cart/[id]      product/[id]      shop/[id]
_components/   ProductCard, Categories, Cart-Index, addToCart, cartContext,
               FloatingCart, Header, NotificationListener
utils/         api.ts (fetch wrapper), authState.ts, firebase.js, notificationService.tsx
```
> `parcel.tsx` is a UI mockup of "Send Parcel" (pickup, destination, type, weight, ₹ estimate) — **not yet wired to the backend.**

### Mart admin app — `sukobin_mart/`
```
app/
├── (auth)/    welcome, login, login-otp, register, register-otp
├── (tabs)/    home, products, orders, analytics, profile
├── add-product, edit-product, product-detail, create-shop, manage-shop
service/       api.ts
```

### Partner / driver app — `sukobin_partner/`
```
app/   index.tsx (boilerplate "Welcome to Expo + NativeWind"), _layout.tsx
```
> 🔴 **Effectively empty** — the entire driver experience (registration with number plate, route entry, route-matched parcel feed, capacity-limited acceptance) still needs to be built. This is the heart of Sukobin and is the biggest gap.

---

## 🏛️ Full Architecture (Deep Dive)

This section documents **how the whole system is wired together today** — every layer, from a tap in the mobile app down to a MongoDB write and back, plus the security model.

### 1. System Topology

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  sukobin        │   │  sukobin_mart   │   │ sukobin_partner │
│  (Customer app) │   │  (Mart admin)   │   │  (Driver app)   │
│  Expo / RN      │   │  Expo / RN      │   │  Expo / RN      │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │ HTTPS + Bearer JWT   │                     │ (not built)
         │                      │                     │
         └──────────────┬───────┴─────────────────────┘
                        ▼
         ┌──────────────────────────────────┐
         │   Express 5 API (backend/)        │
         │   helmet → cors → morgan → json   │   ← global middleware chain
         │   ┌──────────────────────────┐    │
         │   │ Route → protect/merchant  │    │   ← auth middleware
         │   │      → controller         │    │   ← business logic
         │   │      → Mongoose model     │    │   ← data access
         │   └──────────────────────────┘    │
         └───────┬───────────────┬───────────┘
                 │               │
                 ▼               ▼
        ┌────────────────┐  ┌──────────────────────────┐
        │  MongoDB Atlas │  │  External services        │
        │  (Mongoose)    │  │  • Cloudinary (images)    │
        │  2dsphere geo  │  │  • Firebase (OTP/admin)   │
        └────────────────┘  │  • Expo Push (notifs)     │
                            │  • Razorpay (planned)     │
                            └──────────────────────────┘
```

The three apps are **thin clients**: all business logic, validation, and persistence live in the backend. Each app talks to the same REST API over HTTPS, authenticating with a Bearer JWT stored in `AsyncStorage`.

---

### 2. Backend Request Lifecycle (the pipeline)

Every request flows through the same ordered pipeline, defined in `server.js`:

```
Incoming HTTP request
   │
   ├─ 1. helmet()                 → sets secure HTTP headers
   ├─ 2. cors()                   → (currently open to all origins)
   ├─ 3. morgan('dev')            → request logging
   ├─ 4. express.json({10mb})     → parse JSON body
   ├─ 5. express.urlencoded       → parse form bodies
   │
   ├─ 6. Route match  e.g.  app.use('/api/cart', cartRoutes)
   │        │
   │        ├─ 6a. AUTH middleware   protect  /  merchantProtect
   │        │        → verify JWT, load User/Merchant, attach to req
   │        │
   │        ├─ 6b. (optional) multer  → parse multipart file uploads
   │        │
   │        └─ 6c. CONTROLLER          → business logic + Mongoose calls
   │                    │
   │                    └─ returns { success, message, data }
   │
   ├─ 7. 404 handler  → if no route matched
   └─ 8. error handler (err, req, res, next) → 500 + console.error(stack)
```

**Response envelope** is consistent across the API:
```json
{ "success": true,  "message": "…", "data": { … } }
{ "success": false, "message": "…", "error": "(dev only)" }
```

Startup order (`startServer()` in `server.js`): `connectDB()` (Mongoose connect) **must succeed first**, then `app.listen(PORT)`. A DB failure calls `process.exit(1)` — the server never serves traffic without a database.

---

### 3. Authentication & Authorization

There are **two independent identities**, each with its own JWT issuance and guard middleware, but both signed with the **same `JWT_SECRET`**.

#### 3a. Customer auth (`protect`)
```
Client (sukobin)                Backend
──────────────                  ───────
Firebase phone OTP  ──────────► (verified ONLY on client today)
  │
  │ POST /api/user/registration { phone }
  ▼
                                authController.registerWithPhone
                                  → User.create({ phone, isVerified:false })
                                  → jwt.sign({ id }, SECRET, 1300d)
  ◄──────────────────────────── { token, user }
  │
  │ store token in AsyncStorage ('userToken')
  │
  │ POST /api/user/complete-registration  (Bearer token)
  ▼
                                protect middleware:
                                  Bearer → jwt.verify → User.findById(decoded.id)
                                  → req.user = user
                                authController.completeRegistration
                                  → fills name/address/location, isVerified:true
```

- **`login`** looks up the user by phone; if the profile is incomplete it **deletes the user** and tells the client to re-register; otherwise it issues a fresh 1300-day token.
- **`protect`** (`middleware/protect.js`): reads `Authorization: Bearer <token>`, `jwt.verify(token, JWT_SECRET)`, loads `User.findById(decoded.id)`, attaches `req.user`. Any failure → `401`.

#### 3b. Merchant auth (`merchantProtect`)
```
POST /api/merchant/register { name, phone, email, businessName, aadhaar, pan, gst }
  → Merchant.create(...)               → jwt.sign({ id }, SECRET, 7d)
POST /api/merchant/login    { phone }  → Merchant.findOne → token (7d)

merchantProtect middleware:
  Bearer → jwt.verify → Merchant.findById(decoded.id) → req.merchant
```

#### 3c. How the two stay separated
The JWT payload is just `{ id }`. The **guard decides the identity type** by which collection it queries:
- `protect` → `User.findById(decoded.id)` → only resolves user tokens.
- `merchantProtect` → `Merchant.findById(decoded.id)` → only resolves merchant tokens.

A merchant token presented to a user route fails because that id isn't in the `User` collection (and vice-versa). ⚠️ This works by accident of disjoint IDs, not by an explicit `role`/`audience` claim — see the Security section for why that should be tightened.

#### 3d. Token lifetimes
| Identity | Expiry | Where set |
|---|---|---|
| Customer | `1300d` (~3.5 yrs) | `authController` |
| Merchant | `7d` | `merchantController.generateToken` |

---

### 4. Data Model & Relationships (ERD)

```
            ┌──────────┐         owner          ┌──────────┐
            │ Merchant │ 1 ────────────────── * │   Shop   │
            └────┬─────┘  shops[]                └────┬─────┘
                 │                                products[] │ 1
                 │ merchant                            │
                 │                                     * ▼
                 │                                ┌──────────┐
                 │                                │ Product  │
                 │                                └────┬─────┘
                 │                                     │ ref (in items)
   ┌──────────┐  │  user                              │
   │   User   │ 1│ ───────────────────┐               │
   └────┬─────┘  │                    │ 1             │
        │ 1      │              ┌──────▼──────┐        │
        │        │              │    Cart     │ items[]┘  (one open cart per user)
        │ 1      │              └─────────────┘
        ▼        ▼
   ┌─────────────────┐
   │      Order      │  references User + Shop + Merchant, embeds items[]
   └─────────────────┘
```

| Model | Key fields | Notes |
|---|---|---|
| **User** | `phone` (unique), `name`, `address{}`, `location{Point}`, `expoPushToken`, `isVerified` | `2dsphere` index on `location` for geo matching |
| **Merchant** | `phone` (unique), `businessName`, KYC (`aadhaarNumber/panNumber/gstNumber`), `kycVerified`, `shops[]`, `walletBalance`, `isBlocked` | wallet/KYC fields defined but not yet driven |
| **Shop** | `shopName`, `shopSlug` (unique), `owner→Merchant`, `category`, `location{Point}` (required), `products[]`, `ratings`, `isActive` | `2dsphere` index; one shop per merchant enforced in controller |
| **Product** | `productName`, `shop→Shop`, `category`, `images[]`, `price`, `stock`, `isAvailable`, `isActive` | soft-delete via `isActive=false` |
| **Cart** | `user→User` (unique), `shop→Shop`, `items[{product,name,image,price,qty,totalPrice}]`, `subtotal`, `totalItems` | **one cart per user**, **single-shop** rule |
| **Order** | `orderId` (unique), `user`, `shop`, `merchant`, `items[]`, `subtotal/deliveryFee/platformFee/totalAmount`, `paymentStatus`, `orderStatus`, `deliveryAddress{}`, `location{Point}` | full status machine (below); **currently never written** |

**Order status machine** (defined on the model, not yet driven by any controller):
```
PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → PICKED → ON_THE_WAY → DELIVERED
                                                       └──────────────► CANCELLED
paymentStatus: PENDING → PAID → FAILED / REFUNDED
```
This status machine is exactly where the **driver/parcel pipeline will plug in** (`READY_FOR_PICKUP` = the 1-hour pool; `PICKED`/`ON_THE_WAY` = driver in transit).

---

### 5. Controller Responsibilities

| Controller | Guards | Does |
|---|---|---|
| `authController` | `protect` (some open) | customer register/login/verify, profile completion, **public catalog reads** (search, categories, product details, shop detail, all-products via `$sample`) |
| `merchantController` | `merchantProtect` | merchant register/login, `getMe`, save expo token, verify |
| `shopController` | `merchantProtect` + multer | create/edit/delete shop, image upload, one-shop-per-merchant rule, `shopSlug` generation |
| `productController` | `merchantProtect` + multer | merchant CRUD on own products, availability toggles, bulk toggle, scoped search — all scoped via `findShopByOwner()` |
| `cartController` | `protect` | add/update/remove/clear, summary, **stock & price re-validation on every read**, single-shop enforcement, qty caps (10/item, 20 items) |
| `orderController` | `protect` | `checkout` (quote only) + `editCheckoutDetails` |
| `notificationController` | `protect` / open | save expo token, send test push |

**Ownership scoping pattern** (the merchant-side authorization model): every merchant product/shop action calls `findShopByOwner(merchant._id)` or filters `{ _id, shop: shop._id }`, so a merchant can **only ever touch their own shop's data** — the database query itself is the access-control boundary.

---

### 6. End-to-End Flows

#### A. Customer browse → cart → checkout
```
home.tsx ──GET /api/user/product/all───────► getAllProducts ($sample aggregate)
product/[id] ─GET /api/user/product/:id────► getProductDetails (+related/shop)
addToCart ───POST /api/cart/add────────────► validateProduct(stock/active)
                                              → single-shop check
                                              → upsert item, recalc totals
cart/[id] ───GET /api/cart─────────────────► getCart: re-validate every item
                                              (drop inactive, sync price, clamp qty)
checkout ────POST /api/order/check-out─────► Haversine(user↔shop)
                                              → tiered deliveryFee + ₹2 platform
                                              → returns a QUOTE (no Order saved)
```

#### B. Merchant onboarding → selling
```
register ──POST /api/merchant/register────► Merchant.create → 7d JWT
create-shop ─POST /api/shop/create─────────► multer(logo,banner)→Cloudinary
            (multipart)                       → Shop.create, push to merchant.shops[]
add-product ─POST /api/product─────────────► multer(productImages[10])→Cloudinary
            (multipart)                       → Product.create, push to shop.products[]
toggle ─────PATCH /api/product/toggle/:id──► flip isAvailable
```

#### C. Image upload pipeline
```
RN app (multipart/form-data)
   → multer middleware (middleware/multer.js) writes temp file
   → cloudinary.uploader.upload(file.path, { folder: 'sukobin/...' })
   → secure_url saved on the Mongo document
   → deleteImages() strips publicId from URL to destroy on edit/remove
```

#### D. Push-notification pipeline
```
App registers for push  → expo push token
   → POST /api/user/notify  (or /api/merchant/notify)
   → token stored on User.expoPushToken / Merchant.expoPushToken
Backend sends  → expo-server-sdk → Expo.isExpoPushToken() guard
   → chunkPushNotifications → sendPushNotificationsAsync → tickets
```

---

### 7. Mobile App Internal Architecture

All three apps share the same Expo Router + NativeWind shape:

```
app/_layout.tsx        → root stack, providers, auth gate
app/index.tsx          → entry redirect (checks AsyncStorage token)
app/(auth)/*           → unauthenticated stack (welcome/login/otp/register)
app/(tabs)/*           → authenticated tab navigator
utils|service/api.ts   → fetch wrapper: injects Bearer token from AsyncStorage
```

- **`api.ts`** (customer app) is a tiny `fetch` wrapper exposing `get/post/put/delete`, each pulling `userToken` from `AsyncStorage` and setting the `Authorization` header. `API_BASE_URL` points at the deployed Render backend.
- **Auth state** is "token present in AsyncStorage" — the root layout redirects between the `(auth)` and `(tabs)` groups based on it.
- **Context**: the customer app uses `cartContext.tsx` to keep a live cart/badge (`FloatingCart`, `Cart-Index`) and `NotificationListener.tsx` to react to incoming push notifications.
- **`sukobin_partner`** has none of this yet — only the boilerplate screen.

---

### 8. Security Architecture (current posture)

Defense layers that **exist today**:
```
helmet()        → secure headers
JWT bearer      → stateless identity on every protected route
ownership scope → merchant queries always filtered by owner/shop id
input guards    → required-field checks, qty caps, price≥0, stock checks
soft deletes    → isActive flags instead of hard deletes (products/shops)
secret config   → JWT_SECRET / DB / Cloudinary via .env
```

Gaps (full list with severity and fixes in the **🔐 Security** section above). The most load-bearing ones for this architecture:
- **OTP is never verified server-side** — the auth boundary is currently bypassable.
- **One shared `JWT_SECRET` with no role claim** — identity separation relies on disjoint IDs, not an explicit `aud`/`role`.
- **No transactions** — once orders are persisted, concurrent checkouts can oversell stock.

---

## ⚙️ Getting Started (Local Dev)

Each folder is an independent project. Run them separately.

### 1. Backend
```bash
cd backend
npm install
# create a .env file (see below)
npx nodemon server.js     # or: node server.js
```

`.env` (backend) — **do not commit this**:
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-long-random-secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NODE_ENV=development
```
You also need `serviceAccountKey.json` (Firebase Admin) at `backend/`.

### 2. Any mobile app
```bash
cd sukobin            # or sukobin_mart / sukobin_partner
npm install
npx expo start
```
The customer app points at the deployed API (`https://sukobin-v2.onrender.com`) in `sukobin/utils/api.ts` — change this to your local IP (e.g. `http://192.168.x.x:5000`) for local testing.

---

## ✅ What's Built Today

- ✅ Customer + Merchant phone-based auth (JWT) and profile completion
- ✅ Shops with geolocation, products with images (Cloudinary), categories & search
- ✅ Full cart lifecycle (single-shop enforcement, stock/price re-validation)
- ✅ Checkout **price calculation** (Haversine distance → tiered delivery fee + ₹2 platform fee)
- ✅ Expo push-notification plumbing (token save + send)
- ✅ Customer & Mart app UIs mostly implemented

## 🚧 What's Missing / Next (the roadmap to "best")

These are the gaps between the current code and the product vision above.

### 🔴 Core logistics engine (highest priority — this *is* Sukobin)
- [ ] **Persist orders.** `POST /check-out` only *computes* a quote; there is no endpoint that actually saves an `Order`, decrements stock, or pushes it to the Mart. The `Order` model exists but is never written.
- [ ] **Parcel / pickup pool** with the **1-hour visibility window** (TTL or `expiresAt` field + index).
- [ ] **Partner model + app**: register with **vehicle number plate**, vehicle type, and live route.
- [ ] **Route matching**: given a driver's `from → to`, surface only parcels whose destination lies along that route (use the existing `2dsphere` geo indexes + a route corridor / destination-town match).
- [ ] **Vehicle capacity rules**: bike = 1, car/taxi ≈ 5, truck ≈ 10 — enforce on accept.
- [ ] **Driver accept → pickup → delivered** state transitions wired into `orderStatus`.

### 🟡 Payments & money
- [ ] Wire up **Razorpay** (dependency already installed) for `paymentMethod: "UPI"`.
- [ ] Driver payout / merchant wallet settlement (`walletBalance` exists but is never updated).

### 🟡 Feature completeness
- [ ] Order history / live tracking screens (customer `orders.tsx` / `history.tsx`).
- [ ] Mart analytics backed by real data.
- [ ] Ratings & reviews (fields exist on models, no write path).
- [ ] KYC verification flow for merchants & drivers (fields exist, unused).

---

## 🔐 Security — Known Gaps & Hardening Plan

The current code prioritises getting the flow working; several things **must be fixed before production**. Listed roughly by severity:

### Critical
1. **No real OTP verification on the backend.** `registration` / `login` trust whatever `phone` is sent and immediately issue a JWT. Firebase OTP happens only on the client and can be bypassed by calling the API directly. → **Verify the Firebase ID token (or a server-issued OTP) on the backend before issuing a JWT.**
2. **Absurd JWT lifetime.** User tokens expire in **`1300d`** (~3.5 years). → Use short-lived access tokens (e.g. 15–60 min) + refresh tokens; allow revocation.
3. **Secrets in the repo.** `backend/serviceAccountKey.json`, `backend/.env`, and `sukobin/sukobin-37444-*.json` (a Firebase service-account key) are present. → Remove from git history, rotate the keys, and load via environment/secret manager. (`.gitignore` covers `serviceAccountKey.json` but **not** the frontend service-account JSON.)

### High
4. **Wide-open CORS** (`app.use(cors())`). → Restrict to known app origins.
5. **No rate limiting** anywhere → brute-force / spam on auth and OTP endpoints. → Add `express-rate-limit`.
6. **Unsanitised regex search.** User input is passed straight into `$regex` (`searchProducts`, etc.) → ReDoS and query-injection risk. → Escape input or use a text index.
7. **No input validation layer.** → Add `zod` / `express-validator` on every body & query.
8. **`editCheckoutDetails` lets a user overwrite their own `phone`** to an arbitrary value with no verification → account-collision / hijack risk. → Don't allow phone changes without OTP.

### Medium
9. **Destructive login side-effect:** `login` *deletes* the user document when the profile is incomplete. → Replace with a non-destructive "needs onboarding" flag.
10. **Error leakage:** many handlers return raw `error.message` to the client. → Log server-side, return generic messages in production.
11. **Shared `JWT_SECRET` for users and merchants** with role baked only into which collection is queried. → Add an explicit `role`/`aud` claim and separate concerns.
12. **No stock decrement / transaction** on order placement → oversell race conditions once orders are persisted. → Use Mongoose transactions.

---

## 🎯 Complete System Blueprint (Target Design)

> This is the **full architecture to build Sukobin end-to-end** — every screen, every function, every model, the matching engine, the APIs, the background jobs, payments, real-time tracking and security. The current code (documented above) is the foundation; this is the destination.

### 0. Design Principles

1. **Thin clients, fat backend.** Apps render and capture intent; all rules, pricing, matching and state transitions live server-side.
2. **One unified delivery pool.** Both **commerce orders** (from marts) and **P2P parcels** (customer-sent) become the same `Delivery` object that drivers pick up. One engine serves both.
3. **Existing journeys, not a fleet.** The matching engine optimizes for *minimal detour* on a driver's already-planned route.
4. **Time-boxed pickup pool.** A packed parcel is visible to drivers for ~1 hour; if unclaimed it escalates (re-broadcast → dedicated rider → reschedule).
5. **Proof at every handoff.** Pickup OTP (mart→driver) and delivery OTP (driver→customer) make custody auditable.
6. **Money is event-sourced.** Every rupee movement is a ledger entry; wallets are derived, never edited directly.
7. **Offline-tolerant.** Drivers lose signal in the hills — queue location pings and actions, sync on reconnect.

---

### 1. Actors & Roles

| Actor | App | Core job |
|---|---|---|
| **Customer** | `sukobin` | Buy products from marts; send P2P parcels; track delivery |
| **Merchant / Mart** | `sukobin_mart` | List products; receive, accept & pack orders; hand parcels to drivers |
| **Driver / Partner** | `sukobin_partner` | Register a vehicle; set a route; accept route-matched parcels; deliver |
| **Platform / Admin** | (web, future) | KYC approval, disputes, settlement, pricing config, analytics |

---

### 2. The Three Apps — Full Screen Maps

Legend: each screen lists the **functions/actions** it performs and the **API calls** behind them.

#### 2A. `sukobin` — Customer App

```
(auth)/
  splash            → check AsyncStorage token → route to (tabs) or welcome
  welcome           → onboarding carousel, "Get started"
  login             → enter phone → request OTP            [POST /auth/otp/request]
  otp-verify        → 6-digit OTP → verify                 [POST /auth/otp/verify]
  register          → new user basic info
  complete-profile  → name + address + pin location on map [POST /auth/complete-profile]

(tabs)/
  home              → location header, search, categories grid, nearby shops,
                      featured products, active-order banner
                      [GET /catalog/home?lat&lng] [GET /orders/active]
  explore           → all categories, filter, sort         [GET /catalog/search]
  orders            → tabs: Active | Past; live status      [GET /orders] [GET /orders/active]
  parcel            → P2P "Send a parcel" entry point
  profile           → user info, addresses, wallet, settings, logout

product/[id]        → gallery, price, stock, add-to-cart, related, shop link
                      [GET /catalog/product/:id] [POST /cart/add]
shop/[id]           → banner, info, ratings, product list   [GET /catalog/shop/:id]
cart                → items, qty edit, remove, subtotal, "Checkout"
                      [GET /cart] [PUT /cart/update/:id] [DELETE /cart/remove/:id]
checkout            → address picker, delivery quote, slot, payment method
                      [POST /orders/quote] [POST /orders/place]
payment             → Razorpay sheet                        [POST /payments/create] + webhook
order/[id]/track    → live map (driver pin), status timeline, ETA, delivery OTP, call driver
                      [GET /orders/:id] + socket: order:<id>
order/[id]          → receipt, items, support, reorder, rate
send-parcel/
  details           → pickup addr, drop addr, type, weight, photos
  quote             → fare estimate                          [POST /parcels/quote]
  payment           → pay                                     [POST /parcels/create]
  track             → same live-tracking screen
addresses          → CRUD address book                       [GET/POST/PUT/DELETE /addresses]
wallet             → balance, transactions, add money        [GET /wallet] [GET /wallet/txns]
notifications      → in-app inbox                             [GET /notifications]
rate/[id]          → rate shop + driver                       [POST /reviews]
support            → tickets / FAQ / chat
settings           → language, push prefs, edit profile, delete account
```

**Customer-side functions:** location detection & reverse-geocode, geofenced shop discovery, cart with single-shop rule, dynamic delivery quote, dual order types (commerce + parcel), live tracking, delivery-OTP reveal, reorder, ratings, wallet.

#### 2B. `sukobin_mart` — Merchant / Mart App

```
(auth)/
  splash / welcome
  login / login-otp                                       [POST /auth/merchant/otp/*]
  register          → owner + business name
  kyc               → Aadhaar / PAN / GST + docs upload   [POST /merchant/kyc]
  create-shop       → name, category, location, logo, banner, hours
                      [POST /shop/create]  (multipart)

(tabs)/
  dashboard (home)  → today's orders, revenue, pending count, ready-to-handoff,
                      low-stock alerts                       [GET /merchant/dashboard]
  products          → list, search, availability toggle, stock edit
                      [GET /product/my-products] [PATCH /product/toggle/:id]
  orders            → tabs: New | Preparing | Ready | Picked | Completed
                      [GET /merchant/orders?status=]
  analytics         → sales trend, top products, ratings    [GET /merchant/analytics]
  profile           → shop, wallet/payouts, KYC, settings

add-product         → name, category, price, stock, images  [POST /product] (multipart)
edit-product        → update / delete                        [PUT /product/edit/:id]
product-detail      → views, stock, sales of one product
order-detail        → accept / reject, mark PREPARING, mark READY → enters pickup pool
                      [PATCH /merchant/orders/:id/accept|reject|prepare|ready]
handoff/[id]        → driver arrives → verify pickup OTP / scan → mark PICKED_UP
                      [POST /deliveries/:id/pickup-verify]
manage-shop         → edit shop, hours, delivery radius, on/off
wallet              → earnings ledger, settlement schedule, bank account, withdraw
                      [GET /merchant/wallet] [POST /merchant/payout]
reviews             → shop & product reviews, reply
notifications       → new-order push inbox
```

**Mart-side functions:** product CRUD with images, real-time new-order alerts, accept/reject SLA, packing workflow, **"mark ready" pushes the order into the 1-hour driver pool**, pickup-OTP handoff, payouts/settlement, analytics, reviews.

#### 2C. `sukobin_partner` — Driver / Partner App  *(currently empty — full design below)*

```
(auth)/
  splash / welcome
  login / otp                                              [POST /auth/partner/otp/*]
  register-personal → name, phone, photo/selfie
  register-vehicle  → vehicle type, NUMBER PLATE, RC, model, capacity (auto-set)
  register-docs     → driving licence, insurance, RC upload [POST /partner/kyc]
  verification-pending → "Under review" until admin approves

(tabs)/
  home              → GO ONLINE/OFFLINE toggle, today's earnings, active trip card
                      [POST /partner/presence] [GET /partner/trip/active]
  trip              → set route: Origin → Destination, departure time, see match count
                      [POST /trips] → [GET /trips/:id/matches]
  deliveries        → accepted parcels in route order (pickup→drop sequence)
                      [GET /partner/deliveries/active]
  earnings          → per-trip, daily, weekly, wallet, withdraw
                      [GET /partner/earnings] [POST /partner/payout]
  profile           → vehicle, documents, ratings, settings

available-parcels   → live feed of route-matched parcels within remaining capacity,
                      sorted by detour cost + fee; pull-to-refresh + socket push
                      [GET /trips/:id/matches] + socket: partner:<id>:feed
parcel-detail/[id]  → pickup shop, drop area, fee, distance, detour, weight → ACCEPT
                      [POST /deliveries/:id/accept]   (atomic, capacity-guarded)
navigate/[id]       → turn-by-turn to next stop (pickup or drop), call contact
pickup/[id]         → at shop: enter/scan pickup OTP → confirm load [POST .../pickup-verify]
deliver/[id]        → at customer: enter delivery OTP → mark DELIVERED [POST .../deliver-verify]
trip-summary/[id]   → completed trip: stops, distance, total earnings
history             → past trips & deliveries
documents           → re-upload / expiry reminders
ratings             → customer ratings of driver
```

**Driver-side functions:** vehicle/number-plate registration + KYC, online/offline presence, **route entry → corridor matching**, capacity-limited acceptance, multi-stop sequencing, GPS navigation, dual-OTP handoff, live location broadcast, earnings & payouts, ratings.

**Vehicle → capacity table** (drives the matching filter):

| Vehicle | Capacity (parcels) |
|---|---|
| Bike / Scooter | 1 |
| Auto / E-rickshaw | 3 |
| Car / Taxi | 5 |
| Mini-truck / Pickup | 8 |
| Truck | 10 |

---

### 3. Complete Data Model (all collections)

Existing (built): `User`, `Merchant`, `Shop`, `Product`, `Cart`, `Order`.
New collections to add:

```
Partner          driver identity + vehicle
  { name, phone(unique), photo, kyc{licence,rc,insurance,status},
    vehicle{ type, numberPlate(unique), model, capacity },
    isOnline, currentLocation{Point}, currentTrip→Trip,
    rating, totalTrips, walletBalance, isBlocked }

Trip             a driver's planned journey (the supply side)
  { partner→Partner, origin{Point}, destination{Point},
    routePolyline, corridorBuffer(km), departureAt,
    capacityTotal, capacityUsed,
    status: DRAFT|ACTIVE|IN_PROGRESS|COMPLETED|CANCELLED,
    deliveries[→Delivery] }

Delivery         the UNIFIED parcel (demand side) — from an Order OR a P2P parcel
  { type: ORDER|PARCEL, refOrder→Order?, customer→User,
    pickup{ location{Point}, address, contact, shop→Shop? },
    drop{ location{Point}, address, contact },
    package{ type, weightKg, photos[] },
    assignedTrip→Trip?, assignedPartner→Partner?,
    pickupOtp, deliveryOtp,
    fee, driverPayout, platformCommission,
    status: CREATED|READY_FOR_PICKUP|POOLED|ASSIGNED|PICKED_UP|
            IN_TRANSIT|DELIVERED|EXPIRED|CANCELLED,
    poolExpiresAt(Date),   // readyAt + 1h
    timeline[ {status, at, by} ] }

Payment          { ref(Order|Delivery), amount, method, razorpayOrderId,
                   razorpayPaymentId, status, breakdown{ goods, delivery, platform } }

LedgerEntry      { account(User|Merchant|Partner|Platform), refId, type:CREDIT|DEBIT,
                   amount, reason, balanceAfter, settledAt }

Review           { from→User, targetType:SHOP|PRODUCT|PARTNER, targetId, rating, comment }

Notification     { recipient, role, type, title, body, data, read, sentAt }

OtpRequest       { phone, role, codeHash, expiresAt, attempts, verified }  // if not using Firebase

AddressBook      { user→User, label, address{}, location{Point}, isDefault }

PricingConfig    { baseFare, perKm tiers, weightSurcharge, vehicleMultiplier,
                   platformCommissionPct, surgeRules }   // admin-editable, no redeploy
```

All location fields use GeoJSON `Point` + `2dsphere` indexes (already the pattern on `User/Shop/Order`).

---

### 4. The Matching Engine (the heart of Sukobin)

```
                 SUPPLY                         DEMAND
        Driver sets a Trip            Mart marks order READY  /  Customer sends parcel
        O → D, departAt, vehicle               │
               │                               ▼
               │                        Delivery → status POOLED
               │                        poolExpiresAt = now + 1h
               ▼                               │
        ┌──────────────────── MATCH ───────────┴───────────┐
        │ 1. Build corridor: route polyline O→D, buffer Rkm │
        │    (MVP: destination-town == drop-town + origin   │
        │     proximity; v2: OSRM/Directions polyline)      │
        │ 2. Candidate deliveries where:                    │
        │      pickup ∈ corridor  AND  drop ∈ corridor      │
        │      AND drop is "ahead" of pickup along route    │
        │      AND status == POOLED AND not expired         │
        │      AND package fits remaining capacity          │
        │ 3. Score by detourCost(extra km) ↑ , fee ↓        │
        │ 4. Return ranked feed to driver (live via socket) │
        └───────────────────────────────────────────────────┘
               │
               ▼
        Driver ACCEPTs a parcel
               │
        ┌──────┴───────────────────────────────────────────┐
        │ ATOMIC claim (findOneAndUpdate guarded):          │
        │   Delivery.status POOLED → ASSIGNED               │
        │   set assignedTrip/Partner                        │
        │   Trip.capacityUsed += 1   (reject if full)       │
        │  → prevents two drivers claiming the same parcel  │
        └───────────────────────────────────────────────────┘
               │
               ▼
        Multi-stop sequencing: order this trip's deliveries
        by position along the route → pickup1,pickup2,drop1,…
```

**Escalation when the 1-hour pool expires unclaimed:**
```
POOLED ──(timeout job)──► re-broadcast to wider radius
                         └─► assign dedicated on-demand rider
                         └─► offer customer reschedule / refund → EXPIRED
```

**Key engine functions (backend `services/matching.js`):**
- `buildCorridor(trip)` → polyline + buffered geo-query shape
- `findMatches(trip)` → ranked `Delivery[]`
- `scoreDelivery(trip, delivery)` → detour km + payout
- `claimDelivery(partner, deliveryId)` → atomic assign (transaction)
- `sequenceStops(trip)` → ordered pickup/drop list
- `onPoolExpire(delivery)` → escalation pipeline

---

### 5. Unified Lifecycle State Machine

```
COMMERCE ORDER                         P2P PARCEL
  PLACED                                 CREATED
   │ mart accepts                          │ paid
   ▼                                       ▼
  ACCEPTED → PREPARING                   (skip)            ── both converge ──┐
   │ mart "mark ready"                     │                                  │
   ▼                                       ▼                                  ▼
  READY_FOR_PICKUP ───────────────────► Delivery POOLED  (visible 1h) ◄───────┘
   │ driver accepts (atomic)
   ▼
  ASSIGNED → PICKED_UP (pickup OTP) → IN_TRANSIT → DELIVERED (delivery OTP)
   │
   └─► CANCELLED / EXPIRED / RETURNED  (with refund + ledger reversal)

TRIP:    DRAFT → ACTIVE(accepting) → IN_PROGRESS(started) → COMPLETED
PAYMENT: PENDING → PAID → (SETTLED | REFUNDED | FAILED)
```

---

### 6. Complete API Specification (by domain)

```
AUTH (shared, role-aware)
  POST /auth/otp/request            { phone, role }       → send OTP (server-side)
  POST /auth/otp/verify             { phone, code, role } → access + refresh tokens
  POST /auth/refresh                { refreshToken }
  POST /auth/logout
  POST /auth/complete-profile       (customer onboarding)

CATALOG (customer, mostly public)
  GET  /catalog/home?lat&lng        nearby shops + featured
  GET  /catalog/search?q&cat&...    products
  GET  /catalog/categories
  GET  /catalog/product/:id
  GET  /catalog/shop/:id

CART (customer)
  GET /cart  · POST /cart/add · PUT /cart/update/:id · DELETE /cart/remove/:id
  DELETE /cart/clear · GET /cart/summary

ORDERS (customer)
  POST /orders/quote                delivery fee + ETA (Haversine/route)
  POST /orders/place                persist Order + Payment + decrement stock (TXN)
  GET  /orders · GET /orders/active · GET /orders/:id
  POST /orders/:id/cancel

PARCELS (customer P2P)
  POST /parcels/quote · POST /parcels/create · GET /parcels/:id · POST /parcels/:id/cancel

MERCHANT
  POST /merchant/kyc · GET /merchant/dashboard · GET /merchant/analytics
  GET  /merchant/orders?status=
  PATCH /merchant/orders/:id/accept|reject|prepare|ready
  GET  /merchant/wallet · POST /merchant/payout
  (existing) /shop/* · /product/*

PARTNER
  POST /partner/kyc · POST /partner/presence (online/offline + location)
  POST /trips                        create trip (route + departure)
  GET  /trips/:id/matches            ranked parcel feed
  POST /deliveries/:id/accept        atomic claim
  GET  /partner/deliveries/active    sequenced stops
  POST /deliveries/:id/pickup-verify { otp }
  POST /deliveries/:id/deliver-verify{ otp }
  GET  /partner/earnings · POST /partner/payout

PAYMENTS
  POST /payments/create              → razorpay order
  POST /payments/webhook             ← razorpay (signature-verified)
  POST /payments/:id/refund

SHARED
  CRUD /addresses · GET /wallet · GET /wallet/txns
  POST /reviews · GET /reviews/:targetId
  GET  /notifications · POST /notifications/register-token · PATCH /notifications/:id/read
```

---

### 7. Services & Background Jobs (backend `services/` + `jobs/`)

```
services/
  auth.js          OTP gen/verify (Firebase Admin or SMS), JWT access+refresh
  matching.js      corridor build, find/score/claim, sequencing  (Section 4)
  pricing.js       delivery fee, parcel fare, surge, commission split
  payments.js      razorpay create/verify/refund, payout
  ledger.js        double-entry wallet postings, balance derivation
  notifications.js expo push + in-app inbox fan-out
  geo.js           reverse-geocode, distance, route polyline (OSRM/Directions)

jobs/  (cron / queue workers — e.g. BullMQ + Redis)
  expirePool          every 1 min: POOLED past poolExpiresAt → escalate/EXPIRED
  rebroadcast         widen radius / ping more drivers for stale parcels
  settlement          batch payouts to merchants & drivers
  presenceReaper      mark drivers offline after missed heartbeats
  kycReminder         document-expiry reminders
  cleanupOnboarding   delete stale incomplete registrations (non-destructively flagged)
```

---

### 8. Real-time Layer (Socket.IO)

```
Namespace / rooms
  order:<orderId>      customer + driver        → live driver location, status changes
  partner:<id>:feed    driver                   → new route-matched parcels pushed live
  merchant:<shopId>    mart                     → new order alerts, handoff updates

Events
  driver →  location:update {lat,lng}           (throttled, queued offline)
  server →  delivery:matched / delivery:claimed  (feed updates, prevent stale accepts)
  server →  order:status {status, eta}
  server →  handoff:otp-verified
```
Auth on socket handshake reuses the JWT. Location pings are buffered client-side when offline and flushed on reconnect.

---

### 9. Payments & Settlement

```
Customer pays totalAmount  ──Razorpay──►  webhook (verify signature) → Payment PAID
   │
   └─ split via ledger.js (double-entry):
        goods price        → Merchant wallet (CREDIT)
        delivery fee        → Partner wallet (CREDIT)  minus platform commission
        platform fee + cut  → Platform account (CREDIT)
   │
   settlement job → payouts (RazorpayX / manual) → LedgerEntry DEBIT + SETTLED
   refunds → reverse all related ledger entries, Payment REFUNDED
```
Wallet balances are **derived from the ledger**, never written directly — guarantees auditability.

---

### 10. Notifications Matrix

| Event | Customer | Mart | Driver |
|---|---|---|---|
| Order placed | ✓ confirm | ✓ NEW ORDER | – |
| Mart accepted / ready | ✓ status | ✓ | – (enters pool) |
| Parcel matched | – | – | ✓ feed + push |
| Driver accepted | ✓ "driver assigned" | ✓ "driver incoming" | ✓ |
| Picked up | ✓ OTP-verified | ✓ | ✓ |
| Out for delivery / ETA | ✓ live | – | ✓ |
| Delivered | ✓ rate now | ✓ payout | ✓ earnings |
| Pool expiring | ✓ delay notice | ✓ | broadcast |

Channels: **Expo push** (built) + **in-app inbox** (`Notification` collection) + SMS for OTP/critical.

---

### 11. Security & Auth (target hardening)

```
Identity        server-side OTP verification (Firebase verifyIdToken or own SMS OTP)
Tokens          short-lived ACCESS (15m) + ROTATING REFRESH; role + aud claims;
                separate guards: requireCustomer / requireMerchant / requirePartner / requireAdmin
Transport       enforce HTTPS, HSTS via helmet; restrict CORS to known app origins
Abuse           express-rate-limit on OTP/auth; per-IP + per-phone throttles; captcha on repeat
Validation      zod schema on every body/query/param; sanitize → no $regex injection / ReDoS
Files           signed/direct Cloudinary uploads, type+size limits, AV scan; KYC docs encrypted at rest
Money           Razorpay webhook signature verification; idempotency keys; ledger as source of truth
Data            stock decrement & order placement in Mongo TRANSACTIONS (no oversell/double-claim)
Secrets         all keys in env/secret manager; rotate leaked service-account JSONs; never in git
Privacy         mask phone numbers between parties (proxy calling); KYC access role-gated + audited
Logging         structured logs, no raw error.message to clients in prod; audit trail on money & status
```

---

### 12. Tech & Infrastructure (recommended)

```
Mobile     Expo SDK 54 · expo-router · NativeWind · expo-notifications · react-native-maps
Backend    Express 5 (ESM) · Mongoose · Socket.IO · BullMQ + Redis (jobs/queues)
Data       MongoDB Atlas (2dsphere geo) · Redis (presence, queues, rate-limit)
Maps/Geo   OSRM (self-host) or Google Directions/Geocoding for routes & ETAs
Media      Cloudinary (signed uploads)
Auth/OTP   Firebase Auth (phone) verified server-side, or MSG91/Twilio SMS
Payments   Razorpay (orders + webhooks) · RazorpayX (payouts)
Infra      API on Render/Railway/Fly · Redis managed · CI build via EAS for apps
Observability  structured logging, Sentry (crash), uptime + queue dashboards
```

---

### 13. Build Roadmap (phased)

```
Phase 1 — Commerce MVP (closest to done)
  □ Server-side OTP + refresh tokens + role guards
  □ POST /orders/place: persist Order, decrement stock (TXN), Razorpay
  □ Mart order screens: accept → prepare → ready
  □ Customer order tracking (status timeline)

Phase 2 — The Parcel Engine (the differentiator)
  □ Partner app: registration + vehicle/number-plate + KYC
  □ Trip creation (route + departure)
  □ Delivery pool + 1-hour window + expire job
  □ Matching engine (MVP: town-match → v2: route corridor)
  □ Atomic claim + capacity rules + stop sequencing
  □ Dual-OTP handoff

Phase 3 — Real-time & Trust
  □ Socket.IO live tracking (driver pin, ETA)
  □ Ratings & reviews (all directions)
  □ In-app notification inbox
  □ P2P "send parcel" end-to-end

Phase 4 — Money & Scale
  □ Ledger + wallets + settlement + payouts
  □ Surge/dynamic pricing config (admin)
  □ Admin web: KYC approval, disputes, analytics
  □ Offline queueing, observability, hardening pass
```

---

## 🤝 Conventions

- Backend: ES modules, controller/route/model separation, `{ success, message, data }` JSON envelope.
- Mobile: Expo Router file-based routing, NativeWind classes, `AsyncStorage` token under `userToken`.
- Brand colors: deep green `#1A3B32` / `#0C831F`, mint `#DDFBE6`, off-white `#F9F8F4`.

---

*Generated as a structural overview of the Sukobin codebase. Update this README as the parcel-matching engine and partner app come online.*
