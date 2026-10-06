# Trimble Trip Dispatch — Requirements and Strategy

**Status:** Phase 1–3 done (live-proven on tablet `999`; Phase 3 fuel stop confirmed October 5, 2026). Phase 4 remaining.  
**Last updated:** October 5, 2026  
**Sources:** Finn Martel (Trimble Maps), September 9, 2026 and October 1, 2026 (account settings + delete leftover trips before retest); Mantas / David thread, September 9–10, 2026; Mantas on testing tablet `999`, September–October 2026; Account Manager session for XXII Century (company id `BXTQPL`), September 23, 2026; read-only Trip Management search the same day; [Plan Trip](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/plan-trip/), [Modify Trip](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/modify-trip/), [Get Trip](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/get-trip/), [Get Route Path](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/get-route-path/), [Trip Search](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/trip-query/), [Delete Trip](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/delete-trip/)

---

## 1. Task

Fuel Optimizer must create the driver’s CoPilot trip itself, through Trimble Trip Management, and put the recommended fuel station on that trip.

Today those are two different trips:

- Fuel Optimizer builds a route with **PC\*Miler Web Services** (`pcmiler.alk.com`, `GET /route/routePath`) so it can score stations along a corridor. That call does not create a trip, does not return a trip id, and does not reach a tablet.
- The driver’s CoPilot route is created in **OpenRoad**. The dispatcher enters pickup and delivery, OpenRoad calls Trip Management, the driver accepts the load in the OpenRoad app, and taps **Open in Copilot**.

Because those trips are not the same object, Fuel Optimizer cannot tell CoPilot which tablet to update or which stop to insert. Trimble’s required link is the Trip Management trip id (`alkTripId`). OpenRoad owns that id today. Going through OpenRoad to attach fuel stops was rejected: OpenRoad said it would be substantial extra work and cost, and the goal is a direct CoPilot integration.

**Done when:** a dispatcher working their own drivers can send a load from Fuel Optimizer to the correct CoPilot tablet, the driver accepts it there, and the fuel station chosen by the optimizer appears as a stop on that same trip without the dispatcher picking the station.

---

## 1.1 Confirmed September 23, 2026

| Item | What we verified |
|---|---|
| Portal | `maaz@azfsllc.com` is a Company Administrator for **XXII Century**, company id **BXTQPL**, at [Account Manager](https://account.trimblemaps.com/ams/assets). |
| How a tablet is identified | Account settings: **Manage Licenses By = Vehicle ID**, **Identify Assets By = Vehicle ID**. That Vehicle ID is `tspDriverId`. Finn’s example `"tspDriverId": "1000"` is asset `1000` on this account. |
| How trips get in | **Integration Type = Manual Integration.** Nothing pushes a trip in for us. Fuel Optimizer has to call Trip Management. |
| API key | The existing `TRIMBLE_API_KEY` in `backend/.env.local` is accepted. `GET https://tripmanagement.trimblemaps.com/api/trips/search?pageNumber=1&pageSize=1` with that key in the `Authorization` header returned **200** for account **XXII Century**. No second key is required. |
| Host | `https://tripmanagement.trimblemaps.com/api` works with this key. OpenRoad’s older host `tripmanagement.alk.com` does not need to be used for our calls. |
| Licenses | Two pools of **CoPilot Truck with ActiveTraffic - North America (Monthly)**. The pool **with the Trip Management add-on** has **52 of 55** seats used (purchased May 22, 2026). The pool **without** Trip Management has **1 of 55** used (purchased January 10, 2025). |
| Asset export | 56 assets. Columns that matter: `AssetId` (send this), `ExternalName` (driver and truck unit), `FirstName` (dispatcher), `Status`, `ProductAddons`. |

**Who can receive a trip today**

- **48 trucks** are Activated, have the Trip Management add-on, and are real fleet tablets.
- **`999`** is Activated with Trip Management. It is the **engineering / Phase 2–3 test tablet**. Mantas confirmed we can use Tablet `999` for testing because it is connected to OpenRoad and has a CoPilot license. Use `tspDriverId: "999"` while building and proving dispatch. **Do not use `999` for a real freight load** or production Send-to-CoPilot. Fleet sync / production dispatch matching should keep excluding `999` from the normal driver fleet list.
- **3 assets** have Trip Management but status **Assigned** (license reserved, tablet not activated): `1020` Joseph Wimmer #187, `648` Ronnie Sieg #263, `NR2128` (external name `244 (Eric)`). A dispatch to these will not reach a device until they activate.
- **Do not dispatch:** `GOXXII_066` Cheryl Day #623 (CoPilot, no Trip Management add-on), and the three unassigned assets with no product: `965`, `967`, `992`.

**Matching rule**

- `tspDriverId` = `AssetId` (`1000`, `212`, `GOXXII_066`, `NR2128`). It is not the OpenRoad id and not the Samsara id.
- Truck unit = the number after `#` in `ExternalName` (`Lyndon Smith #239` → unit `239`). Match that unit to the Fuel Optimizer / OpenRoad / Samsara truck.
- Dispatcher = `FirstName` on the asset (Dylan, Andre, Alex, Alex M, Chris, Felix, Nikola, Eric, Milan, Daisy). That is the fleet split David asked for. The app still has no dispatcher role; this export is the source list.
- Odd names to check when matching, not to guess: `Thomas Torres #210 (438335)` → unit `210`; `Abraham Lanz #271076`; unassigned labels `259 (Chris)`, `967 (Nikola)`, `193 (Andre)`.

---

## 2. What changes for people

### Dispatcher

| Today (OpenRoad) | Target (Fuel Optimizer) |
|---|---|
| Adds pickup and delivery. OpenRoad draws the route. | Load stops still come from OpenRoad. Fuel Optimizer turns those stops into the CoPilot trip. |
| Picks fastest, shortest, or practical, and compares tolls. | v1 uses Trimble’s truck default, **Practical**. A route-option picker is not required to ship. |
| Driver accepts in the OpenRoad app, then opens CoPilot. | Dispatcher sends the trip from Fuel Optimizer. The driver gets a CoPilot popup and accepts it on the tablet. |
| Sees every load. | Sees only the drivers assigned to them. |

David’s instruction stands: **the fuel location is chosen automatically, not by the dispatcher.** The dispatcher’s new action is sending the trip to a driver, not choosing a gas station.

### Driver

1. Popup on the CoPilot tablet: a trip was dispatched.
2. Driver accepts and navigation starts.
3. If the fuel stop is already on the trip, they are guided to it in order.
4. If a fuel stop is inserted while they are already driving, and it is the **next** stop, CoPilot notifies them and navigates there immediately. A later stop waits until they reach that point in the route.

### What stays

- OpenRoad remains the system of record for the freight load (pickup, delivery, intermediate stops). This work replaces the **route handoff into CoPilot**, not load entry.
- Samsara remains the source of live GPS and fuel percent.
- The recommendation engine remains the source of the station. Trip Management only receives the station coordinates.

---

## 3. API flow we will implement

Base URL: `https://tripmanagement.trimblemaps.com/api`. Confirmed with the existing key on September 23, 2026.

Auth is the same header PC\*Miler already uses: `Authorization: {TRIMBLE_API_KEY}` with no `Bearer` prefix. [Trip Management introduction](https://developer.trimblemaps.com/restful-apis/trip-management/introduction/). Dispatch only assets whose `ProductAddons` includes `TripManagement` and whose status is `Activated`.

### Step 1 — Plan the trip, do not dispatch yet

`POST /trip`

Send the load’s ordered stops as latitude/longitude. Trimble assumes we pass coordinates, not a station id.

- `storeTrip: true` so Trimble returns `alkTripId`. Every later call uses that id.
- `tmsTripId`: our load id, so the trip can be found from the TMS load.
- Leave `tspDriverId` **empty**. An empty driver id creates a **Planned** trip (`tripStatus = 0`) and does not push it to a tablet.
- Each stop has `stopType` (`Origin`, `Work` / `Pickup` / `Delivery`, `Destination`) and `location.coords` (`lat`, `lon` as strings, at least 4 decimal places, 6 preferred) plus a `label`.
- `routingProfile.name`: company Vehicle Routing Profile from Account Manager (default `"XXII Century"`, env `TRIMBLE_ROUTING_PROFILE_NAME`). Sending the name lets CoPilot auto-select the profile and skip the on-tablet **Use Profile** prompt.
- `routingProfile.routingType`: `0` (Practical). That is Trimble’s truck default: legal, avoids small roads and city centers, balances time and distance. Shortest is `1`, Fastest is `2`.

Plan returns distance, duration, tolls, and per-stop ETAs. We persist `alkTripId` on the load.

### Step 2 — Attach the fuel stop before the driver sees the trip

The optimizer already selects the station. Insert it with:

`PUT /trip/modify`

- Identify the trip with `alkTripId`.
- Send the **full** stop list, with the station inserted at the correct index. Modify replaces the stop list; it is not a one-stop patch.
- Set that stop’s `stopType` to `FuelStop`.
- Location is the station coordinate plus the station name as `label`.

Trimble recalculates ETAs after the edit. Call Get Trip afterward and store the updated stops.

Doing this **before** dispatch matches David’s request: the tablet receives a route that already contains the station. Finn’s third step (insert while the driver is navigating) stays available for later changes, when fuel level or price changes after the trip is already in progress.

### Step 3 — Dispatch to one tablet

`PUT /trip/modify` again, setting:

```json
{ "tripId": "<alkTripId>", "tspDriverId": "999", "stops": [ /* full current stop list */ ] }
```

`tspDriverId` is the Account Manager **Vehicle ID** (`AssetId`). On this account that is confirmed by the settings “Identify Assets By: Vehicle ID”. It is not the OpenRoad driver id and not the Samsara id. Sending `"1000"` targets the tablet logged in as vehicle 1000 (Deandre Meighan, unit 243). Sending it moves the trip to **Dispatched** (`tripStatus = 1`). The driver must accept it before navigation starts.

**Modify-dispatch spike (Phase 2, confirmed):** Modify body field is `tripId` (value = Plan Trip’s `alkTripId`), not `alkTripId`. `tspDriverId`-only modify returns **HTTP 400** on this account. Dispatch must send the **full current stop list unchanged** plus `tspDriverId` (public schema marks `stops` as required).

### Step 4 — Update an active trip when the recommendation changes

Same modify, new stop list, fuel stop inserted at the new index.

Rules from Trimble:

- If the trip is **InProgress**, completed stops cannot be changed, and the planned start, vehicle, and routing profile cannot be changed.
- Completed or canceled trips cannot be modified.
- Insert as the next open stop when the driver should go there now. Insert later when it belongs further down the route.

### Read calls

| Call | Use |
|---|---|
| Get Trip | Status, stop order, ETAs after every plan or modify. |
| Get Route Path | Road geometry for the map and for the fuel corridor, so the scored route and the CoPilot route are the same line. |
| Get Route Path `latest` | Only after the trip is in progress, if we need the path from the truck’s current position, including a return-to-route segment. |

Cancel and Delete exist and OpenRoad uses them. v1 does not need them beyond a way to drop a planned trip that was never accepted.

---

## 4. Data we have to store

### Vehicle → CoPilot asset

Store this on the fleet vehicle (already linked to Samsara and OpenRoad). The September 23 Account Manager export is the source. Trimble will not push it into our database.

- `tspDriverId` — `AssetId` from the export.
- Truck unit — number after `#` in `ExternalName`, used to match the existing fleet vehicle.
- `tripManagement` — true only when `ProductAddons` contains `TripManagement`.
- `copilotStatus` — `Activated`, `Assigned`, or `Unassigned`. Only `Activated` can receive a route now.
- Dispatcher name — `FirstName` from the export, until those people exist as users in this app.

### Dispatcher → drivers

David asked for this on September 10: each dispatcher, on login, sees only their own drivers.

The export already groups trucks by dispatcher in `FirstName`. The app does not. Today the only roles are `admin` and `user`.

- A dispatcher user is linked to the trucks whose export `FirstName` is that dispatcher.
- The loads and send actions on the dashboard are filtered to that set.
- An admin can see the full fleet and correct the links.

### Trip record

Per load, once planned:

- `alkTripId`
- `tmsTripId` (our load id)
- `tripStatus` (Planned, Dispatched, InProgress, Completed, Canceled)
- `tspDriverId` once dispatched
- ordered stops, including any `FuelStop` we inserted (station id, coordinates, index)
- last route path and distance/duration/tolls returned by Trimble

---

## 5. Strategy

Build the smallest path that puts one real load on one real tablet with the optimizer’s station already on it. Do not replace PC\*Miler, OpenRoad load sync, or the recommendation engine in the first slice.

### Estimate

One developer, phases in order. Loads, trucks, and the fuel recommendation already exist, so this is the CoPilot handoff on top of them. About **2 to 2.5 weeks**. Phases 1–3 are what the driver feels, about **1.5 weeks**. Phase 2 slips if no tablet is free to accept the test trip.

| Phase | Visible result | Time | Status |
|---|---|---|---|
| 1. Plan a trip | A real load gets a Trimble trip id. No tablet is notified. | 2–3 days | **Done** |
| 2. One tablet | One Activated truck receives that trip and can accept it in CoPilot. | 1–2 days | **Done** (proven on `999`, Oct 1, 2026) |
| 3. Fuel stop | The optimizer’s station is on the trip before it is sent, and can be updated while the driver is moving. | 3–4 days | **Done** (proven on `999`, Oct 5, 2026 — Circle K Amarillo TX) |
| 4. Dispatcher screen | Each dispatcher sees only their trucks and has a Send to CoPilot action. | 3–4 days | Remaining |

### Phase 1 — Prove one planned trip

**Estimate:** 2–3 days.

Done on September 23:

- Account Manager login works, and the Vehicle ID list is exported.
- The existing PC\*Miler key calls Trip Management successfully.

Still to do:

1. ~~Store the export on fleet vehicles (`AssetId` ↔ unit number, Trip Management flag, dispatcher).~~ **Done in code** (`POST /api/v1/fleet/copilot-assets/sync`).
2. ~~Plan one trip from a real load’s stop coordinates, with `tspDriverId` empty. Save `alkTripId`. Fetch the trip and the route path.~~ **Done in code** (`POST/GET /api/v1/tms/loads/:loadId/trimble-trip`). Live proof: `npm run test:plan-trip -- <openroadLoadId>` against a running backend. Creates **Planned** trips only (`tmsTripId` `fo-*`); never sets `tspDriverId`, so no tablet is notified.
3. Confirm whether modify-to-dispatch accepts `tspDriverId` alone. **Done in code** (`POST /api/v1/tms/loads/:loadId/trimble-trip/dispatch`). Tries `tspDriverId` alone first, retries with full stop list if Trimble requires stops. Live confirmation: `npm run test:dispatch-trip -- <openroadLoadId>`.

**Safety for live business:** Phase 1 never dispatches, never cancels OpenRoad/CoPilot trips, and only owns trips whose `tmsTripId` starts with `fo-`. OpenRoad load sync continues unchanged and does not clear `trimbleTrip`.

Exit: a Planned trip exists in Trimble for one of our loads, and we can read it back. The account already has other Planned trips (the search on September 23 returned one). Those are not ours until we create them.

### Phase 2 — One tablet — **Done (October 1, 2026)**

**Estimate:** 1–2 days, if someone can accept the trip on the test tablet.

**Test device:** Use tablet **`999`** (`tspDriverId: "999"`) for Phase 2 development and live proof. We are not planning real fleet trips yet; Mantas approved `999` for this testing. Keep production / dispatcher Send flows from targeting `999`.

1. ~~Modify that Planned trip to set `tspDriverId` to **`999`** (or later a known Activated Vehicle ID for a real pilot).~~ **Done in code** (`POST /api/v1/tms/loads/:loadId/trimble-trip/dispatch` with `{ "tspDriverId": "999", "allowTestTablet": true }`). Production path resolves `tspDriverId` from `FleetVehicle.trimbleAssetId` and rejects `999` unless `allowTestTablet` is set. Live proof: `npm run test:dispatch-trip -- <openroadLoadId>`.
2. ~~Confirm the popup on that CoPilot tablet and that accepting it starts navigation.~~ **Done live with Mantas on tablet `999` (October 1, 2026).** Fresh FO trip `alkTripId` `329872092` (`tmsTripId` `fo-2311438-1790869450674`, Garland TX → Loveland CO) was accepted; Get Trip returned **`InProgress`**. Earlier attempts stayed Planned until Finn applied CoPilot / Trip Management account settings; leftover Planned test trips must be deleted ([Delete Trip](https://developer.trimblemaps.com/restful-apis/trip-management/api-documentation/delete-trip/)) before retesting so the tablet queue is not clogged. Optional env identity fields (`TRIMBLE_TSP_ID`, `TRIMBLE_TMS_CUSTOMER_ID`, `TRIMBLE_TMS_ID`, `TRIMBLE_TMS_USER_ID`) are wired into Plan/Modify for when Finn provides them.
3. ~~Record status transitions: Planned → Dispatched → InProgress.~~ **Done.** Live proof: FO dispatch to `999` → CoPilot popup → accept → **`InProgress`**.

**Also learned on Phase 2 testing (not exit blockers):**

- Tablet `999` is also used for **OpenRoad ↔ CoPilot** tests. Old OpenRoad trips (e.g. Casa Grande → Wisconsin Rapids, Strasburg IL) can keep popping up on the same tablet and are not FO trips. Confirm FO trips by route / “Fuel Optimizer…” name / `fo-*` `tmsTripId`.
- Clearing a trip on CoPilot does not delete it in Trip Management; delete by `alkTripId` or the popup can return.
- ~~CoPilot may still prompt **Vehicle Routing Profiles** / **Use Profile** even when company profile **“XXII Century”** is the only default on activated accounts.~~ **Closed (October 2, 2026).** Plan/Modify send `routingProfile.name` = `"XXII Century"` (env `TRIMBLE_ROUTING_PROFILE_NAME`). Live proof on tablet `999`: FO trip `330002205` skipped Use Profile and jumped straight to the route / Start navigation.

Exit: ~~Fuel Optimizer can send a trip to a specific tablet without OpenRoad (proven on `999` first).~~ **Met October 1, 2026.**

### Phase 3 — Automatic fuel stop — **Done (October 5, 2026)**

**Estimate:** 3–4 days.

1. ~~Run the existing recommendation against the Trip Management route path (not a separately drawn PC\*Miler line).~~ **Done.** `getRecommendationForTruck` accepts `routePolylineOverride`; attach/dispatch-with-fuel score along `GET /trip/{alkTripId}/routePath`. PC\*Miler remains fallback when no trip path exists.
2. ~~Insert the chosen station as `FuelStop` **before** dispatch, at the index the corridor math already produces.~~ **Done.** `POST /api/v1/tms/loads/:loadId/trimble-trip/fuel-stop` and `POST .../dispatch-with-fuel`. Stops + `fuelStop` persisted on `load.trimbleTrip`. Live proof: load `2311438` → FO trip `alkTripId` `330217597` (`tmsTripId` `fo-2311438-1791220131340`) dispatched to tablet `999` with **Circle K #2709243, Amarillo TX** as `FuelStop`. Mantas confirmed the fuel stop on CoPilot (October 5, 2026).
3. ~~On a later recommendation change for an in-progress trip, modify only the open stops and insert at the next index or a later index using the rule in §3 step 4.~~ **Done in code.** `PUT /api/v1/tms/loads/:loadId/trimble-trip/fuel-stop` for Dispatched/InProgress trips (API ready; optional follow-up live proof when a trip is already InProgress).

The dispatcher never picks the station. If the engine has no contracted station on the corridor, send the trip without a fuel stop and show that reason (`lastRecommendationStatus` / `lastRecommendationMessage`). Do not invent a station.

Also: `GET /api/v1/tms/loads/:loadId/trimble-trip/route-path` returns the Trimble polyline. Trip context / load views expose `trimbleTrip` summary including `fuelStop`.

Exit: ~~the tablet route contains the station the optimizer selected.~~ **Met October 5, 2026** (Mantas on tablet `999`: Circle K Amarillo TX).

### Phase 4 — Dispatcher workflow

**Estimate:** 3–4 days.

1. Assign drivers to dispatcher users.
2. Filter the dashboard to that fleet.
3. Add one action: **Send to CoPilot**. It plans (if needed), inserts the current recommendation, then sets `tspDriverId`.
4. Show trip status and whether the driver has accepted.

Exit: a dispatcher can run the flow for their own drivers only.

### What we will not do in v1

- Recreate OpenRoad’s route picker (fastest / shortest / practical plus toll comparison). Default is Practical. David has not asked for the picker; Mantas left that question open.
- Push GPS into Trimble. Samsara already has position. CoPilot reports position once the driver is on the trip.
- Hours-of-service rest-stop insertion, IFTA state mileage, or cancel/delete as product features.
- Route creation inside OpenRoad, or asking OpenRoad to forward fuel stops.
- Asking the dispatcher to choose the fuel station.

### PC\*Miler after this

Keep the current PC\*Miler client until Phase 3. After that, corridor geometry for a load that has an `alkTripId` comes from Get Route Path on that trip, so the station we score is on the line the driver will actually drive. PC\*Miler remains only as a fallback for loads that have not been planned in Trip Management yet.

---

## 6. Open points

These do not block Phase 1. They should be answered before calling the workflow final.

| Point | Status |
|---|---|
| API key | **Closed.** Existing `TRIMBLE_API_KEY` works on Trip Management. |
| Host | **Closed.** Use `https://tripmanagement.trimblemaps.com/api`. |
| Vehicle ID source | **Closed.** Account Manager `AssetId`, matched to the truck unit in `ExternalName`. |
| Which tablets can be dispatched | **Closed, with test exception.** Production / real loads: Activated + Trip Management only; **exclude `999`**. Engineering / Phase 2–3 testing: **use `999`** (Mantas). See §1.1. |
| Extra Trip Management cost | **Open.** Mantas asked; Finn has not answered. The add-on is already on 52 seats, so build can proceed. Confirm billing before calling the rollout final. |
| Modify body for dispatch | **Closed.** Live account rejects `tspDriverId`-only modify (HTTP 400). Dispatch sends full stop list + `tspDriverId`. |
| CoPilot receives FO dispatch | **Closed (Phase 2).** After Finn’s October 1 account settings, FO trips to `999` show New Trip; accept → `InProgress`. Delete leftover FO Planned trips before retest. |
| OpenRoad noise on test tablet `999` | **Closed / known.** `999` also receives OpenRoad CoPilot test trips. Isolate FO tests by clearing OpenRoad leftovers first; identify FO by Garland/Loveland-style FO route or `fo-*`. |
| Auto-select company routing profile | **Closed (October 2, 2026).** Plan/Modify send `routingProfile.name` = `"XXII Century"`. Live on `999`: trip `330002205` skipped Use Profile and went straight to Start route. |
| Who presses Send | **Open, assumed.** David rejected dispatcher-chosen stations. He did not say dispatch itself is automatic. Mantas expects a person to send the route. v1: dispatcher presses Send, station selection stays automatic. |
| Route options | **Open, assumed.** v1 is Practical only, until David asks for fastest / shortest / practical plus tolls. |

---

## 7. Acceptance

1. ~~Planning a load creates a Trimble trip and stores `alkTripId`. The tablet does not notify the driver yet.~~ **Met (Phase 1).**
2. ~~The recommended station is inserted as `FuelStop` with coordinates, at a specific index, without a dispatcher choosing it.~~ **Met (Phase 3 on `999`, October 5, 2026 — Circle K Amarillo TX).**
3. ~~Setting `tspDriverId` delivers that trip to one CoPilot tablet. A different vehicle does not receive it.~~ **Met (Phase 2 on `999`, October 1, 2026).** Production Send must not dispatch real loads to `999`.
4. ~~The driver can accept the trip and be navigated to the fuel stop in order.~~ **Met (Phase 2 accept + Phase 3 FuelStop on tablet `999`, October 5, 2026).**
5. ~~Changing the recommendation on an in-progress trip updates the open stops, and a next-stop insert notifies the driver.~~ **Met in code (Phase 3 `PUT .../fuel-stop`).** Optional live proof when a trip is already InProgress.

6. A dispatcher login lists only that dispatcher’s drivers. **Phase 4.**
7. Assets without a Trip Management license are not dispatched. **Enforced in matching / dispatch code; keep for production Send.**
