# Community Waste Management & Circular Economy Enabler Platform — Backend

Backend prototype for **IEMHACKS 4.0, Track 04 Greentech (IEMH4-GT-01)**.

Covers all five product pillars from the problem statement with a working
REST API and a real relational schema: **segregation logging + image
verification, IoT bin-fill tracking, route optimization, a citizen
rewards system, and a recyclable-waste marketplace**, plus a municipal
dashboard that aggregates all of it.

## What's real vs. what's a placeholder

This is a backend-first prototype (~60% of the full problem statement —
everything except the mobile/web client and physical hardware). Being
upfront about the two things that are simulated rather than production-grade,
so you know exactly what to swap out before a demo or a real deployment:

| Piece | Status |
|---|---|
| Auth, RBAC, all CRUD, points ledger, marketplace, dashboard | **Real** — full logic, persisted, transactional |
| Route optimization (nearest-neighbor + 2-opt over haversine distance) | **Real algorithm**, running on stored coordinates. Swap `haversineKm()` in `routeOptimizationService.js` for a Google Maps Distance Matrix call to bring in live traffic — nothing else in the algorithm needs to change |
| IoT bin sensors | **Real ingestion endpoint** (`POST /api/bins/:id/sensor-readings`). No physical ESP32 involved — anything that can POST JSON (a Postman call, a Python script on real hardware) can feed it |
| Waste-segregation image classifier | **Functional placeholder.** It decodes the uploaded photo for real and derives a prediction from its color/brightness profile — it is not a trained model. It's isolated behind one function (`classifyWasteImage` in `classifierService.js`) specifically so a real TensorFlow/Keras model can replace it later without touching any calling code |
| Database | SQLite (via `better-sqlite3`), not the suggested PostgreSQL. The `prisma/schema.sql` file is standard SQL and maps cleanly to Postgres — see "Moving to PostgreSQL" below. This was a pragmatic sandbox call (Prisma's engine binary couldn't be downloaded in this environment); doesn't reflect a stack recommendation |

## Quick start

```bash
npm install
cp .env.example .env       # already done in this delivered copy
npm run seed                # creates demo admin/citizen/recycler + sample bins
npm run dev                  # starts on http://localhost:4000
```

Demo accounts created by the seed script:

| Role | Email | Password |
|---|---|---|
| Municipal admin | `admin@municorp.example` | `admin1234` |
| Citizen | `citizen@example.com` | `citizen123` |
| Recycler (marketplace seller) | `recycler@example.com` | `recycler123` |

Health check: `GET /health`

## Architecture

```
src/
  config.js            all tunable variables, loaded from .env (see below)
  db.js                 SQLite connection, applies prisma/schema.sql on boot
  app.js                Express app, mounts every route module
  server.js             entry point
  routes/                one file per domain — thin, just validation + calls into services
  services/              all business logic lives here (route handlers stay dumb)
  middleware/            auth (JWT), role guard, multer upload, error handler
prisma/
  schema.sql             the full relational schema (9 tables)
  seed.js                 demo data
```

Every route follows the same shape: `express-validator` checks input →
service function does the real work inside a DB transaction where it
mutates more than one row (e.g. redeeming points, buying marketplace
stock) → route returns JSON. Business rules (points per correct log,
fill-level alert threshold, CO2 factors, vehicle capacity) are never
hardcoded — they're all env variables read once in `config.js`, so a
judge or teammate can retune the app's behavior without touching logic.

## Environment variables (`.env.example`)

```
PORT, NODE_ENV
DB_PATH
JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS
POINTS_PER_CORRECT_SEGREGATION, POINTS_PENALTY_PER_INCORRECT
SEGREGATION_CONFIDENCE_THRESHOLD
BIN_FILL_ALERT_THRESHOLD, VEHICLE_CAPACITY_STOPS
FUEL_COST_PER_KM_LITERS, CO2_KG_PER_LITER_DIESEL, CO2_KG_SAVED_PER_KG_RECYCLED
UPLOAD_DIR, MAX_UPLOAD_SIZE_MB
```

## API reference

All routes except `/health`, `/api/auth/register`, `/api/auth/login`, and
the sensor-ingestion endpoint require `Authorization: Bearer <token>`.

### Auth
- `POST /api/auth/register` — `{ name, email, password, role? }` (role defaults to `CITIZEN`)
- `POST /api/auth/login` — `{ email, password }`
- `GET /api/auth/me`

### Bins & IoT
- `POST /api/bins` *(admin)* — `{ label, latitude, longitude, wasteType?, capacityLiters? }`
- `GET /api/bins?minFillLevel=&wasteType=`
- `GET /api/bins/:id`
- `POST /api/bins/:id/sensor-readings` *(no auth — device endpoint)* — `{ fillLevel, batteryPct? }`
- `POST /api/bins/:id/empty` *(admin)*

### Waste logs (segregation verification)
- `POST /api/waste-logs` — multipart form: `image` file + `claimedWasteType`. Runs the classifier, awards points if it matches, returns the classification detail
- `GET /api/waste-logs` — the caller's own history

### Rewards
- `POST /api/rewards/partners` *(admin)* — `{ name, description?, pointsCost }`
- `GET /api/rewards/partners`
- `POST /api/rewards/redeem` — `{ partnerId }`
- `GET /api/rewards/redemptions`

### Marketplace
- `POST /api/marketplace/listings` — `{ wasteType, quantityKg, pricePerKg }`
- `GET /api/marketplace/listings?wasteType=&status=`
- `GET /api/marketplace/listings/mine`
- `POST /api/marketplace/listings/:id/buy` — `{ quantityKg }` (supports partial-quantity purchase)

### Routes (collection optimization)
- `POST /api/routes/optimize` *(admin)* — `{ vehicleId, depot: {latitude, longitude}, binIds? }`. Omit `binIds` to auto-select every bin at/above the fill-alert threshold
- `GET /api/routes`
- `PATCH /api/routes/:id/status` *(admin)* — `{ status: PLANNED | IN_PROGRESS | COMPLETED }`

### Dashboard
- `GET /api/dashboard/summary` *(admin)* — citizen count & points outstanding, bin fill stats, segregation accuracy, collection-route distance/fuel/CO2 savings, marketplace volume, and a combined CO2-saved total

All of the above were exercised end-to-end against a running instance
during development (register/login, sensor ingestion, image upload +
points award on both a matching and a mismatching submission, reward
redemption, a partial marketplace purchase, a 5-bin optimized route, and
the dashboard rollup) — not just written and assumed to work.

## Moving to PostgreSQL

`prisma/schema.sql` is plain SQL with only a few SQLite-specific bits:
`TEXT PRIMARY KEY` (UUIDs stored as text — fine as-is on Postgres),
`datetime('now')` defaults (→ `now()` on Postgres), and the inline
`CHECK (... IN (...))` enums (→ could become native Postgres `ENUM`
types, or stay as `CHECK` constraints, either works). Swap `db.js`'s
`better-sqlite3` connection for `pg` (or reintroduce Prisma, which is
what the original suggested stack specifies, if your environment can
reach `binaries.prisma.sh` — this sandbox couldn't), and the rest of the
codebase — every service, every route — is unaffected, since they only
ever talk to `db.prepare(...)` in the services layer.

## What's not built (the other 30-40%)

- Frontend (React/Flutter, per the suggested stack) — this is backend-only, by design, per your ask
- Real trained CV model for segregation verification (see table above)
- Physical ESP32 + ultrasonic sensor firmware — the ingestion endpoint is ready for it
- Live traffic data in route optimization (Google Maps Distance Matrix) — the algorithm is ready for it, see above
- Push/SMS notifications to citizens or collection crews
- Payment processing for marketplace transactions (currently just records the transaction and price)
