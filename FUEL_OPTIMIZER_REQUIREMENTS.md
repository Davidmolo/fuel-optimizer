# Fuel Optimizer — Business & Functional Requirements

**Status:** Active — supersedes sections of `Fuel_Optimizer_Requirements.docx` where this document is newer.  
**Last updated:** July 2026  
**Pilot customer:** Paul's Assets (Samsara + Open Road TMS + Relay)

---

## 1. Background & Problem Statement

Trucking companies incur significant fuel cost on long-haul routes. Price differences between stations can be **$0.50–$3.00 per gallon**, translating to hundreds of dollars per fuel-up and roughly **$1,000 per week per truck** when drivers stop at convenient but expensive locations.

Today, drivers often fuel when the tank is low at the nearest station, without comparing contract pricing along the **full trip**. Even dispatchers who plan manually struggle to balance:

- current fuel level,
- remaining trip distance across multiple states,
- which contracted stations are actually on the haul path, and
- where the cheapest in-network fuel is **ahead** on the route.

The Fuel Optimizer must automate this decision: combine live truck telemetry, active load context, contracted station pricing, and trip corridor logic to recommend **what to do now** and **where to fill strategically later** — without asking the driver to compare dozens of stations.

---

## 2. Goals & Objectives

1. **Reduce fuel spend** by directing drivers to lower-cost, in-network (contracted) stations.
2. **Plan across the full active trip**, not only around the truck's current position.
3. **Support partial fills** when necessary: buy only enough fuel now to reach a cheaper station ahead.
4. **Never recommend stations off the trip path** — only stations along the route corridor.
5. **Remove manual price comparison** from drivers and dispatchers for contracted merchants.
6. **Pilot on Paul's Assets** (Samsara + Open Road TMS + Relay) before multi-customer rollout.

---

## 3. System Overview & Data Sources

The optimizer combines four data domains:

| Source | Provides | Does **not** provide |
|--------|----------|----------------------|
| **Samsara (ELD)** | Live truck GPS, fuel % | Route, destination, station prices |
| **Open Road TMS** | Active load, ordered stops, stop lat/lng, load miles (billing) | Live truck GPS, road polyline, directions, map tiles |
| **Relay / OPIS** | Station locations, retail/discounted prices | Route geometry, truck position |
| **Contract engine (this app)** | Per-customer effective price per merchant/station | External data |

### 3.1 Open Road TMS — routing expectations (resolved)

The **Open Road TMS External API** (`/api/ext/v1`) is a **transportation management data API**. It does **not** replace Google Maps, OSRM, or any routing provider.

**Confirmed available from TMS:**

- Load list and detail with nested **destinations** (stops)
- Per-stop: `lat`, `lng`, address, city, state, stop order, completion status
- Load-level **billing miles** (`miles`, `empty_miles_sum`) — grantable fields
- Truck/trailer `samsara_dev_id` — link to Samsara device, not live coordinates

**Not available from TMS:**

- Road-following route polyline / encoded geometry
- Turn-by-turn directions
- Drive time or ETA along roads
- Geocoding (address → coordinates)
- Live truck GPS (use Samsara)
- Map tiles

**Implication:** Trip path for fuel planning is built from **Samsara truck position + TMS stop waypoints**. Road-accurate geometry is optional (see §4.5).

### 3.2 New TMS API migration (in progress)

| Legacy (pilot V2) | New External API v1 |
|-------------------|---------------------|
| `Http-Access-Token` header | HTTP Basic Auth (`client_id` + `client_secret`) |
| `GET /active_loads`, `/all_loads` | `GET /api/ext/v1/loads` with `status[]` filters |
| Flat `{ loads: [...] }` response | Envelope `{ data, error, meta }` |
| `/fuel_card_transactions` | Not in external API v1 (confirm with Open Road) |

Reference: [Docs/OPEN_ROAD_TMS_API_V2.md](./Docs/OPEN_ROAD_TMS_API_V2.md) (legacy), OpenRoad `/llms-full.txt` (v1).

---

## 4. Functional Requirements

### 4.1 ELD / Telematics Integration (Samsara)

- Per-customer/fleet ELD configuration.
- **Required per truck:**
  - Current GPS location (latitude, longitude)
  - Current fuel level (`fuelPercents`)
- Map Samsara vehicle `name` ↔ Open Road truck unit number.
- Flag stale telemetry; recommendations require **live** GPS and fuel when configured strictly.

**Note:** Open Road truck records do not expose fuel level — Samsara is the source of truth.

### 4.2 TMS Integration (Open Road TMS)

- Retrieve active load(s) and **ordered destinations** for the truck/driver.
- Build **trip context**: origin, destination, remaining stops, stop coordinates, completion status.
- Use load `miles` (when granted) as a **billing/dispatch mile reference**, not as drawable route geometry.

TMS answers **where the truck is going**. Samsara answers **where it is now**.

### 4.3 Fuel Pricing (Relay & OPIS)

- **Relay:** Primary pilot source for contracted merchant pricing and station locations from transaction/location data.
- **OPIS/Opus:** Optional broader station universe + rack/retail pricing (credentials TBD).
- Only **contracted** stations are eligible for recommendations (same principle as Relay app behavior).
- Contract rate application (e.g. Love's −$0.06/gal) is maintained **in this application**, not in Relay or OPIS.

### 4.4 Contract Pricing Engine

- Per-customer merchant rules (rate adjustment, covered locations, effective dates).
- Given station + customer → **effective price** or **not available**.
- Exclude non-contracted stations from the candidate set entirely.

### 4.5 Recommendation Engine

#### 4.5.1 Core principle: corridor planning, not radius search

The system must **not** use a simple radius search around the truck's current GPS position as the primary strategy.

Instead:

1. Build a **trip corridor** from truck position through all **remaining TMS stops** to final destination.
2. Consider contracted Relay/OPIS stations **along that corridor only** — not arbitrary stations in a state or near the truck.
3. Scan the **full remaining trip** for strategic fuel opportunities, not only stations within current fuel range.
4. Use current fuel range to decide **survival vs skip**, not to limit how far ahead we look for price.

**On-route definition:** A station is on-route if it lies within a configurable **corridor buffer** (default 15 miles) of the trip path polyline.

**Off-route stations must never be recommended**, even if they are the cheapest in the state.

#### 4.5.2 Fuel stop types

Every recommendation classifies stops as one of:

| Type | When | Fill guidance |
|------|------|----------------|
| **Skip** | Enough fuel to reach the next strategic stop or destination (above reserve) | 0 gallons |
| **Survival fill** | Fuel low; must stop at an expensive station to bridge range | Minimum gallons to reach next target + safety reserve |
| **Strategic fill** | Station is a optimal cheap fill location on the corridor | Fill to target (e.g. 85–95% of tank) |

**Partial fill rule:** The driver is **not** told to partial-fuel at every state along the way. Partial fuel happens only when **range forces a stop**. At each forced stop, buy the **minimum** needed to reach the next cheaper opportunity:

```
gallons_to_buy = (miles_to_next_target / mpg) + reserve_gallons − current_gallons
```

(capped by tank capacity; floored at 0)

**Example:** Six-state haul; cheapest fuel near destination. Intermediate stops occur only when the tank cannot reach the next target — typically 2–3 stops (survival bridges + one strategic fill), not six arbitrary partial fills.

#### 4.5.3 Recommendation output (target behavior)

Move from a single “cheapest nearby” stop to a **fuel plan**:

```json
{
  "plan": [
    {
      "timing": "now",
      "action": "survival_fill",
      "station": { "name": "...", "state": "TX", "effectivePricePerGallon": 3.89 },
      "gallonsRecommended": 35,
      "reason": "Need 35 gal to reach cheaper stop in Oklahoma (142 mi ahead)"
    },
    {
      "timing": "ahead",
      "action": "strategic_fill",
      "station": { "name": "...", "state": "OK", "effectivePricePerGallon": 3.42 },
      "gallonsRecommended": 120,
      "targetFillPercent": 90,
      "mileMarker": 287,
      "reason": "Cheapest contracted stop on corridor"
    }
  ],
  "estimatedSavings": "..."
}
```

**v1 (shipped):** Single primary stop + alternates ranked by lowest effective price within corridor and current range.  
**v2 (required):** Full fuel plan with now + ahead guidance and gallon amounts.

#### 4.5.4 Ranking & tie-breakers

1. Lowest **effective** (contract-adjusted) price per gallon
2. Shortest distance along corridor / driving distance to station
3. Closest to corridor centerline (penalize stations far from path even if inside buffer)
4. Merchant / station ID tie-break

#### 4.5.5 Operational constraints

| Parameter | Default | Notes |
|-----------|---------|-------|
| Corridor buffer | 15 mi | Configurable; may widen for waypoint-only mode |
| Reserve fuel | 15% of tank | Never plan below this |
| Sweet spot (expensive stops) | 25–75% fill | Do not overfill at non-optimal stations |
| Strategic fill target | 85–95% | At cheapest corridor station |
| Max fuel stops per trip | 3 | Unless survival requires more; flag infeasible trips |
| Min savings per extra stop | TBD (e.g. $25) | Avoid stops that save negligible amounts |
| Max alternates shown | 2 | Plus primary |

#### 4.5.6 Route geometry modes

Two supported modes; routing API is **optional**, not mandatory for pilot:

| Mode | Path source | Distance accuracy | Use when |
|------|-------------|-------------------|----------|
| **Waypoint corridor** (no routing API) | Straight segments: truck → TMS stops | Estimated (haversine + optional road factor / TMS mile scaling) | Client prohibits Google/OSRM |
| **Road corridor** (optional) | Google Routes API or OSRM dense polyline | Driving miles via route engine | Higher accuracy desired |

**Without routing API (TMS + Samsara + Relay only):**

- ✅ Corridor filter along TMS waypoints
- ✅ Multi-state price lookahead on corridor
- ✅ Survival / strategic fill logic
- ✅ Exclude off-corridor stations
- ⚠️ Distances are estimates — use conservative reserve and road factor (~1.2–1.3×)
- ❌ Cannot guarantee station is on the exact highway (only near chord between stops)

**With routing API:**

- ✅ Road-following corridor and driving distances
- ✅ Better reachability checks for survival fills

The product **must work** in waypoint mode. Road mode is an accuracy enhancement.

#### 4.5.7 Re-planning

Recommendations are **not static**. Recompute when:

- Truck position changes materially
- Fuel % changes
- Load stops update (completion, new stops)
- Price data refreshes

---

### 4.6 Module Configuration / Settings

Per-customer settings:

- ELD connection (Samsara for pilot)
- TMS connection (Open Road for pilot)
- Recommendation parameters (corridor buffer, reserve %, MPG default, tank capacity default, routing mode)
- Contract merchant rules

Architecture must anticipate multiple ELD/TMS providers; pilot is Samsara + Open Road only.

---

## 5. UI / UX Requirements

1. **Operations view:** Truck list, active load, fuel %, fuel plan (now + ahead).
2. **Map view:** Truck position, trip corridor, stop markers, recommended station(s), Relay stations on corridor, effective price.
3. **Clear driver messaging:** “Add 35 gal here” / “Fill at [station] in 142 mi ($3.42/gal)” — not just a map pin.
4. Directional design reference from prior walkthrough; not a pixel-perfect spec.

---

## 6. Non-Functional Requirements

- Fail closed when telemetry or load context is missing — do not guess.
- Log integration failures with provider, endpoint, and correlation IDs.
- Support grant-gated TMS fields (miles, etc.) without breaking when ungranted.
- Decimal precision for money and miles (strings/decimals, not float accumulation).

---

## 7. Resolved vs Open Items

### Resolved

| Topic | Decision |
|-------|----------|
| Build from prior codebase | Greenfield on current repo shell |
| Samsara fields | `gps`, `fuelPercents` |
| Truck fuel % source | Samsara only |
| TMS provides route polyline | **No** — waypoints only |
| Primary search strategy | **Trip corridor**, not radius around truck |
| Off-route stations | **Never recommend** |
| Routing API required? | **No** — waypoint mode viable; road mode optional |
| Partial fill philosophy | Minimum to bridge range; strategic fill at cheap station |

### Open

| Topic | Status |
|-------|--------|
| OPIS/Opus credentials and retail coverage | TBD |
| Open Road External API v1 migration timeline | In progress |
| `fuel_card_transactions` in v1 external API | Confirm with Open Road |
| Min savings threshold per extra stop | TBD with client |
| Per-truck MPG from fleet data | Not stored today; default 6.5 MPG |
| Station minimum purchase gallons | TBD per merchant |

---

## 8. Out of Scope (Pilot)

- Additional ELD providers (e.g. Project44)
- Customers beyond Paul's Assets
- Final visual design
- Recommending non-contracted stations
- Turn-by-turn navigation app replacement

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| [FUEL_OPTIMIZER_PHASES.md](./FUEL_OPTIMIZER_PHASES.md) | Implementation phases |
| [Docs/SAMSARA_API.md](./Docs/SAMSARA_API.md) | Samsara integration |
| [Docs/OPEN_ROAD_TMS_API_V2.md](./Docs/OPEN_ROAD_TMS_API_V2.md) | Legacy TMS V2 API |
| [Docs/RELAY_TMS_FUEL_API.md](./Docs/RELAY_TMS_FUEL_API.md) | Relay pricing API |
| `Fuel_Optimizer_Requirements.docx` | Original walkthrough requirements (Feb 2026) |

---

## 10. Revision History

| Date | Change |
|------|--------|
| Feb 2026 | Initial requirements from product walkthrough (`Fuel_Optimizer_Requirements.docx`) |
| Jul 2026 | Corridor-based multi-state fuel planning; TMS routing limits documented; optional routing API; survival/strategic fill model; External API v1 notes |
