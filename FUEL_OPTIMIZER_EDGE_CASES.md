# Fuel Optimizer — Edge Cases & Scenarios

**Purpose:** Practical edge cases for product/engineering review.  
**Audience:** Reviewers deciding expected behavior before or during implementation.  
**Related:** [FUEL_OPTIMIZER_REQUIREMENTS.md](./FUEL_OPTIMIZER_REQUIREMENTS.md) §4.5  
**Last updated:** July 2026

---

## How to read this document

Each case has:

| Field | Meaning |
|-------|---------|
| **Scenario** | What is happening in the real world |
| **Expected behavior** | What the optimizer should do |
| **Why** | Business / safety rationale |
| **Status** | `Spec'd` = in requirements · `Gap` = not fully handled in code yet · `Open` = needs product decision |

Defaults referenced below (configurable unless noted):

- Reserve fuel: **15%**
- Corridor buffer: **15 mi**
- Strategic fill target: **85–95%**
- Sweet spot at non-optimal stops: **25–75%**
- Default MPG: **6.5**
- Max fuel stops per trip: **3** (spec'd; not fully enforced yet)

---

## 1. High fuel — do not stop just because a station is cheap/near

### 1.1 Cheap station close by, tank nearly full

| | |
|---|---|
| **Scenario** | Truck has **90–95%** fuel. Cheapest contracted station is **2–5 miles** ahead on the corridor. |
| **Expected behavior** | **Skip.** Do not recommend “fuel now.” Optionally show the station as an **ahead** opportunity only if the remaining trip still needs a strategic fill later; otherwise message: “No stop needed — enough fuel for remaining trip.” |
| **Why** | Driver already has near-full tank. Stopping wastes time and may overfill / leave little room for a better fill later. Cheap + near ≠ must fuel. |
| **Status** | Spec'd as **Skip**; code currently may still surface cheapest stop as a `now` strategic fill — **Gap**. |

### 1.2 Enough fuel to finish the trip above reserve

| | |
|---|---|
| **Scenario** | Remaining trip is 80 miles; usable range (after 15% reserve) is 200+ miles; fuel ~70%. |
| **Expected behavior** | **Skip all stops.** Plan = “Continue to destination.” Do not invent a fuel stop for savings if the truck will arrive with fuel still above reserve. |
| **Why** | Optimization must not force unnecessary stops. Savings only matter if a fill is needed (or client opts into “top-up for next empty leg” — see Open). |
| **Status** | Spec'd · **Open:** Should we ever recommend a fill when the *current* load doesn’t need fuel, to prepare for the next load? |

### 1.3 Enough fuel to reach a better station farther ahead

| | |
|---|---|
| **Scenario** | Fuel 55%. Station A is 20 mi ahead at $3.90. Station B is 180 mi ahead at $3.40. Usable range covers B with reserve intact. |
| **Expected behavior** | **Skip A.** Recommend **strategic fill at B** (ahead). Messaging: “Skip nearer stations; fill at B in ~180 mi.” |
| **Why** | Core product value: plan across the full trip, not nearest/cheapest-now. |
| **Status** | Spec'd |

### 1.4 Tank at/above strategic target already

| | |
|---|---|
| **Scenario** | Fuel 92%. Cheapest corridor station is 40 mi ahead. Trip still long. |
| **Expected behavior** | Skip until fuel drops enough that a strategic fill is useful (e.g. below sweet-spot max or until range planning requires a stop). Do not tell driver to “fill to 95%” when already at 92%. |
| **Why** | Avoid tiny top-ups that don’t move the needle. |
| **Status** | Spec'd · **Open:** Exact “don’t bother topping up if already ≥ X%” threshold |

---

## 2. Low fuel — survival vs strategic

### 2.1 Cannot reach cheapest station; must bridge

| | |
|---|---|
| **Scenario** | Fuel 22%. Cheapest station 400 mi ahead. Nearest in-range contracted station is expensive. |
| **Expected behavior** | **Survival fill now** (minimum gallons to reach next target + reserve). **Strategic fill later** at cheapest. Clear gallon amounts and reason. |
| **Why** | Never strand the truck; never overfill at expensive stations. |
| **Status** | Spec'd / partially implemented |

### 2.2 Fuel below reserve (usable range = 0)

| | |
|---|---|
| **Scenario** | Tank capacity 150 gal, reserve 15% (22.5 gal). Fuel reading **12%**. |
| **Expected behavior** | Treat as **urgent**: recommend nearest eligible in-corridor (or radial if at end) contracted station immediately. Fail closed or escalate if none in range. Do not pretend usable range is healthy. |
| **Why** | Planning below reserve is unsafe. |
| **Status** | Spec'd · code marks not_ready when usable range is 0 — confirm UX for “already below reserve” |

### 2.3 Low fuel, no contracted station in range

| | |
|---|---|
| **Scenario** | Fuel critical; no contracted station within usable range on corridor. |
| **Expected behavior** | Surface **infeasible / no recommendation** with clear reason. Do **not** silently recommend non-contracted stations (pilot out of scope). Optionally flag for dispatcher override outside the product. |
| **Why** | Fail closed; don’t invent off-contract advice. |
| **Status** | Spec'd |

### 2.4 Survival fill would exceed tank capacity

| | |
|---|---|
| **Scenario** | Math says need 80 gal to bridge; tank only has 40 gal of empty space. |
| **Expected behavior** | Cap at tank capacity; if still short of next target, plan **multiple survival bridges** or flag trip as needing more stops than ideal / infeasible under max-stops rule. |
| **Why** | Physical constraint. |
| **Status** | Spec'd |

### 2.5 “Low fuel” UI vs planning thresholds differ

| | |
|---|---|
| **Scenario** | UI badges low fuel at ≤25%; reserve for planning is 15%; sweet spot starts at 25%. |
| **Expected behavior** | Document and keep consistent messaging: badge ≠ same as “must survival fill.” Survival is driven by **range to next target**, not the badge alone. |
| **Why** | Conflicting thresholds confuse ops. |
| **Status** | **Open** — align product copy with which number drivers/dispatchers should trust |

---

## 3. Route, load, and driver behavior changes

### 3.1 Driver changes route / detours off planned path

| | |
|---|---|
| **Scenario** | TMS stops unchanged, but truck GPS leaves the corridor (construction, driver preference, wrong turn). |
| **Expected behavior** | Recompute corridor from **current GPS → remaining stops**. Stations that were “on route” may drop out; new ones may enter. Do not keep recommending a station the truck already passed or is no longer approaching. |
| **Why** | Recommendations must follow the truck, not a stale polyline. |
| **Status** | Spec'd (re-planning) |

### 3.2 Truck already passed the recommended station

| | |
|---|---|
| **Scenario** | Plan said “fill at Love’s in 40 mi.” Driver drove past it; fuel still OK. |
| **Expected behavior** | Invalidate that stop. Re-plan: next strategic or survival candidate **ahead**. Never recommend a station behind the truck (`minAheadOnRouteMiles`). |
| **Why** | Behind-the-truck pins are useless and erode trust. |
| **Status** | Spec'd |

### 3.3 Dispatcher adds / removes / reorders TMS stops

| | |
|---|---|
| **Scenario** | Mid-trip: extra pickup inserted, or a stop cancelled. |
| **Expected behavior** | Rebuild trip corridor and full fuel plan. Previous plan is obsolete. |
| **Why** | Trip path changed. |
| **Status** | Spec'd |

### 3.4 Stop marked completed while truck is still approaching

| | |
|---|---|
| **Scenario** | TMS marks a stop complete early or late vs GPS. |
| **Expected behavior** | Prefer remaining incomplete stops for corridor; if corridor collapses, use fallback rules (include recent completed / truck → next). Avoid empty route. |
| **Why** | Bad completion data shouldn’t wipe planning. |
| **Status** | Partially handled via route fallbacks |

### 3.5 Load completed / no active load

| | |
|---|---|
| **Scenario** | Truck is bobtail or between loads; no active TMS destinations. |
| **Expected behavior** | **No trip fuel plan** (fail closed). Do not fall back to “cheapest in the state” or radius search as primary strategy—unless a separate “no-load / yard” mode is explicitly productized. |
| **Why** | Corridor planning requires a destination. |
| **Status** | Spec'd · radial mode today only for **degenerate short remaining route** near destination |

### 3.6 Multiple active loads on one truck

| | |
|---|---|
| **Scenario** | TMS returns more than one active load for the unit. |
| **Expected behavior** | **Open:** pick primary load by rule (e.g. in-progress, soonest delivery) or show ambiguity to dispatcher. Do not merge unrelated stop lists into one corridor. |
| **Status** | **Open** |

### 3.7 Truck assigned to wrong load / mapping mismatch

| | |
|---|---|
| **Scenario** | Samsara unit linked incorrectly to Open Road truck; GPS is truck A, load is truck B. |
| **Expected behavior** | Linkage not ready → no recommendation. Surface mapping/linkage error, not a confident wrong plan. |
| **Why** | Fail closed. |
| **Status** | Spec'd |

---

## 4. Near destination & short remaining trip

### 4.1 Almost at final destination, fuel still high

| | |
|---|---|
| **Scenario** | 8 miles to delivery; fuel 60%. |
| **Expected behavior** | Skip fueling for this trip. Do not force a stop “because there’s a cheap station 3 miles off the delivery address” if it isn’t needed. |
| **Why** | Delivery priority; unnecessary stop. |
| **Status** | Spec'd (skip when enough fuel) |

### 4.2 Almost at destination, fuel critically low

| | |
|---|---|
| **Scenario** | 12 miles to delivery; fuel 8%; usable range shaky. |
| **Expected behavior** | Urgent nearest **on-corridor** (or radial fallback if route geometry is tiny) contracted station, or warn if none. Prefer finishing delivery only if range clearly covers it **with reserve**. |
| **Why** | Stranding at receiver is worse than a short fuel stop. |
| **Status** | Spec'd · radial fallback when remaining route &lt; ~10 mi |

### 4.3 Destination is a fuel island / receiver with fuel

| | |
|---|---|
| **Scenario** | Final stop is a yard that sells fuel, or customer allows fueling on-site. |
| **Expected behavior** | **Open:** treat as eligible strategic stop only if it appears in contracted station catalog and is on corridor; don’t assume every delivery location sells fuel. |
| **Status** | **Open** |

---

## 5. Corridor & geometry edge cases

### 5.1 Station just inside vs just outside buffer

| | |
|---|---|
| **Scenario** | Station is 14.9 mi vs 15.1 mi off polyline (buffer = 15). |
| **Expected behavior** | Inside = eligible; outside = never recommend. Prefer stations closer to centerline when ranking. |
| **Why** | Hard rule: no off-route recommendations. |
| **Status** | Spec'd |

### 5.2 Cheap station “near” truck but off the haul path

| | |
|---|---|
| **Scenario** | Cheapest state price is 8 miles *beside* the highway, not along the remaining corridor. |
| **Expected behavior** | **Never recommend**, even if within a GPS radius of the truck. |
| **Why** | Core principle: corridor planning, not radius search. |
| **Status** | Spec'd |

### 5.3 Waypoint-only mode (no road polyline)

| | |
|---|---|
| **Scenario** | Path is straight chords between TMS stops; a station looks “on corridor” but is not on the actual interstate. |
| **Expected behavior** | Allow with known accuracy limits; use conservative reserve / road factor. Prefer road mode when available. Do not claim turn-by-turn certainty. |
| **Why** | Pilot must work without Google/OSRM. |
| **Status** | Spec'd |

### 5.4 Missing or bad stop coordinates

| | |
|---|---|
| **Scenario** | A TMS stop has null/0 lat/lng or wrong city geocode. |
| **Expected behavior** | Exclude bad points from corridor; if corridor cannot be built, fail closed with reason. |
| **Why** | Garbage path → garbage stations. |
| **Status** | Spec'd (fail closed) |

### 5.5 Truck GPS far from first remaining stop (deadhead / out of route)

| | |
|---|---|
| **Scenario** | Load says next stop is Dallas; truck GPS shows Oklahoma City with no explanation. |
| **Expected behavior** | Still build truck → remaining stops; flag large deadhead. Re-plan as truck moves. **Open:** whether to warn “truck appears off planned trip.” |
| **Status** | Partially natural via corridor · warning **Open** |

---

## 6. Pricing, contracts, and stations

### 6.1 Price tie between two stations

| | |
|---|---|
| **Scenario** | Two stations both $3.449 effective. |
| **Expected behavior** | Tie-break: shorter driving/along-route distance → closer to corridor centerline → stable ID. |
| **Status** | Spec'd |

### 6.2 Contract expires mid-trip / station loses coverage

| | |
|---|---|
| **Scenario** | Morning plan used Station X; afternoon sync marks contract inactive or location not covered. |
| **Expected behavior** | Drop from candidate set on next recompute. Do not keep recommending unavailable contract price. |
| **Status** | Spec'd |

### 6.3 Station closed, out of diesel, or cash-only (no data)

| | |
|---|---|
| **Scenario** | Relay still lists station; real world: pumps down. |
| **Expected behavior** | Product cannot know unless data feed says inactive. If `isActive = false`, exclude. Otherwise accept limitation; driver/dispatcher override. |
| **Status** | **Open** for richer station status if Relay provides it |

### 6.4 Negligible savings for an extra stop

| | |
|---|---|
| **Scenario** | Extra stop saves **$8** but adds 20 minutes. |
| **Expected behavior** | Skip extra stop if below **min savings per extra stop** (TBD, e.g. $25). |
| **Why** | Driver time and HOS matter more than tiny savings. |
| **Status** | Spec'd parameter · threshold **Open** with client |

### 6.5 Merchant minimum purchase (e.g. 50 gal)

| | |
|---|---|
| **Scenario** | Survival math says buy 18 gal; merchant requires 50. |
| **Expected behavior** | Raise suggested gallons to minimum, or choose a different bridge station / flag constraint. |
| **Status** | Spec'd as TBD · **Open** |

### 6.6 Retail vs discounted base price missing

| | |
|---|---|
| **Scenario** | Station in catalog but no usable base price → contract engine returns unavailable. |
| **Expected behavior** | Exclude from recommendations. |
| **Status** | Implemented (fail closed on pricing) |

---

## 7. Telemetry & vehicle data

### 7.1 Stale GPS or stale fuel %

| | |
|---|---|
| **Scenario** | Last Samsara update &gt; freshness window (e.g. 30 min). |
| **Expected behavior** | Do not recommend (or mark not live). Show “telemetry stale.” |
| **Why** | Planning on old fuel % can strand or wrongly skip. |
| **Status** | Spec'd |

### 7.2 Fuel % missing / null

| | |
|---|---|
| **Scenario** | GPS live; fuel sensor not reporting. |
| **Expected behavior** | Fail closed — no plan. |
| **Status** | Spec'd |

### 7.3 Fuel % jumps (sensor glitch)

| | |
|---|---|
| **Scenario** | Fuel goes 40% → 95% → 42% within minutes without a fuel log. |
| **Expected behavior** | **Open:** trust latest live reading vs require fuel-log confirmation vs dampen recomputes. At minimum, re-plan on change but avoid flip-flopping UI every few seconds. |
| **Status** | **Open** |

### 7.4 Wrong / default tank capacity

| | |
|---|---|
| **Scenario** | Truck has 200 gal tanks; system uses default 150. |
| **Expected behavior** | Range and gallon suggestions wrong. Prefer per-truck capacity when known; otherwise conservative defaults and clear “using default capacity” in ops UI. |
| **Status** | Partially: truck field or config default |

### 7.5 Wrong MPG (default 6.5 vs actual 5.8 / 7.2)

| | |
|---|---|
| **Scenario** | Heavy load, headwind, mountains — actual MPG much worse than default. |
| **Expected behavior** | Prefer per-truck or per-load MPG when available; until then, lean on **reserve** and optional road factor so plans are conservative. |
| **Status** | Spec'd limitation · per-truck MPG **Open** |

### 7.6 Trailer / dual tanks / DEF confused with diesel

| | |
|---|---|
| **Scenario** | Telemetry percent doesn’t match the tank the driver fuels. |
| **Expected behavior** | Out of scope unless Samsara distinguishes; document assumption: `fuelPercents` = diesel used for planning. |
| **Status** | **Open** / assumption |

---

## 8. Multi-stop planning & trip shape

### 8.1 Long multi-state haul, many cheap stations

| | |
|---|---|
| **Scenario** | Six-state trip; several contracted cheap stations along the way. |
| **Expected behavior** | Prefer few stops (≤ max, default 3): survival bridges only when required + one (or few) strategic fills — **not** a partial fill in every state. |
| **Status** | Spec'd |

### 8.2 More than max stops required to survive

| | |
|---|---|
| **Scenario** | Range and station spacing force 5 fills; max is 3. |
| **Expected behavior** | Flag **infeasible under policy**; still show best-effort survival path or escalate to dispatcher. |
| **Status** | Spec'd · enforcement **Gap** |

### 8.3 Cheapest station is early; rest of trip is expensive

| | |
|---|---|
| **Scenario** | Best price is 30 mi ahead; after that only expensive corridor stations; trip is 800 mi. |
| **Expected behavior** | If fuel is already high, skip early cheap stop only if range can still reach a *later* adequate option or destination with reserve. If early stop is the only good strategic fill and tank has room, recommend filling toward strategic target **now/soon** so the truck isn’t forced into expensive survival fills later. |
| **Why** | “Skip because 90% full” can be wrong if this is the last cheap opportunity for hundreds of miles. |
| **Status** | Spec'd intent · needs explicit product rule for **last cheap opportunity** |

### 8.4 Two strategic candidates, similar price, different timing

| | |
|---|---|
| **Scenario** | Station at mi 100 is $3.41; at mi 350 is $3.39; current fuel can reach either with one fill strategy. |
| **Expected behavior** | Rank by effective price, then distance/corridor; apply min-savings if an extra stop is involved. Prefer plan that minimizes expensive gallons overall, not just lowest pin. |
| **Status** | Partially via ranking · full optimization **Gap** |

---

## 9. Re-planning & concurrency

### 9.1 Recommendation changes every few miles

| | |
|---|---|
| **Scenario** | As truck moves, primary station flips between A and B repeatedly (similar prices). |
| **Expected behavior** | Recompute on material change, but **Open:** hysteresis / stickiness so driver messaging doesn’t thrash (e.g. keep primary unless savings improve by $X or station becomes unreachable). |
| **Status** | **Open** |

### 9.2 Driver already fueling while plan updates

| | |
|---|---|
| **Scenario** | Driver at pump; prices refresh; plan switches to another station. |
| **Expected behavior** | Don’t yank the “now” stop if truck is at/near that station. **Open:** geofence “committed stop.” |
| **Status** | **Open** |

### 9.3 Price refresh makes previous “strategic” expensive

| | |
|---|---|
| **Scenario** | OPIS/Relay update swings price +$0.40. |
| **Expected behavior** | Next recompute picks new strategic target; historical plan archived or superseded. |
| **Status** | Spec'd |

---

## 10. Human factors & messaging

### 10.1 Ambiguous “fill here” when skip is correct

| | |
|---|---|
| **Scenario** | Ops map highlights cheapest station; driver has 90% fuel (Case 1.1). |
| **Expected behavior** | Primary message must be **action**: “No fuel stop needed” / “Skip — fill later at X,” not just a cheap pin that implies “go there now.” |
| **Why** | UI that always highlights a station trains drivers to stop unnecessarily. |
| **Status** | Spec'd UX · **Gap** if skip isn’t a first-class action |

### 10.2 Gallons vs percent guidance

| | |
|---|---|
| **Scenario** | Mix of “add 35 gal” and “fill to 90%.” |
| **Expected behavior** | Survival = gallons (minimum). Strategic = target % and/or gallons to that %. Always state reason. |
| **Status** | Spec'd |

### 10.3 Driver ignores plan and fuels elsewhere

| | |
|---|---|
| **Scenario** | Fuel log / card swipe at non-recommended station. |
| **Expected behavior** | After fuel % jumps, re-plan from new level. Optional later: variance reporting for ops. |
| **Status** | Re-plan Spec'd · variance analytics out of pilot scope |

---

## 11. Integration & readiness failures

| ID | Scenario | Expected behavior |
|----|----------|-------------------|
| 11.1 | Samsara down | No live plan; log failure with correlation ID |
| 11.2 | Open Road down / empty loads | No trip context; fail closed |
| 11.3 | Relay station sync stale | Use last known catalog with freshness warning **or** fail if older than policy — **Open** |
| 11.4 | Google/OSRM routing fails | Fall back to waypoint corridor mode |
| 11.5 | Grant-gated TMS miles missing | Plan without billing miles; don’t break |
| 11.6 | Truck not linked Samsara ↔ TMS | Linkage not ready; no recommendation |

---

## 12. Decision matrix — “Should we recommend fueling *now*?”

Use this as a quick product checklist:

| Current fuel vs need | Can reach cheapest strategic (w/ reserve)? | Recommend **now**? |
|----------------------|--------------------------------------------|--------------------|
| High (e.g. ≥ ~85–90%) and can finish trip or reach later strategic | Yes | **No — skip** (Case 1.1–1.4, 8.3 caveat) |
| Medium; can reach strategic | Yes | **No stop now** — show **ahead** strategic fill |
| Medium/low; cannot reach strategic | No | **Yes — survival** min gallons at best in-range bridge |
| Below reserve / critical | — | **Yes — urgent** nearest eligible; else infeasible |
| Any; no contracted station on corridor in range | — | **No recommendation** + reason |
| Any; station only cheap but **off corridor** | — | **Never** |

---

## 13. Priority list for review

Suggested order when deciding product rules:

1. **Skip when tank is high** even if a cheap station is 2–5 miles away (Case 1.1) — highest driver-trust issue.
2. **Last cheap opportunity** vs skip-when-full (Case 8.3) — conflict that needs an explicit rule.
3. **Min savings / max stops** (6.4, 8.2) — avoid busywork stops.
4. **Re-plan stickiness** (9.1–9.2) — avoid thrashing instructions.
5. **No active load / off-route warnings** (3.5, 5.5).
6. **Per-truck MPG & tank capacity** (7.4–7.5) — accuracy of every gallon suggestion.
7. **Merchant minimum gallons** (6.5).
8. **Top-up for next load** when current trip doesn’t need fuel (1.2 Open).

---

## 14. Revision history

| Date | Change |
|------|--------|
| Jul 2026 | Initial edge-case catalog for review (from requirements + practical corridor/survival planning) |
