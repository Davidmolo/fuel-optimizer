# Dispatcher permissions (beta)

Beta access matrix for the Fuel Optimizer **dispatcher** role.  
**Frozen until David gives written approval to change these permissions.**

## Roles

| Role | Fleet visibility | Settings / system config |
|------|------------------|--------------------------|
| `admin` | All trucks, drivers, loads | Full access |
| `user` | Scoped if `dispatcherName` is set; otherwise empty | No settings access (admin-only APIs) |
| `dispatcher` | Prefer OpenRoad `manager_id` drivers (matched by FO email → OpenRoad user, or stored `openroadUserId`) and their current truck assignments. Fallback: Trimble CoPilot `FirstName` / `FleetVehicle.dispatcherName` | **Blocked** (API 403 + Settings hidden in UI) |

## Dispatcher can

- Sign in and use the dashboard (Overview, Active loads, Compliance)
- View **only** their assigned trucks / drivers / loads
- View **Driver compliance** for their fleet only (scoped by `truckUnit`)
- Send to CoPilot for loads in their fleet (existing ownership checks)

## Dispatcher cannot

- Open Settings (accounts, contracts, recommendation config, mail, Twilio, data sync, jobs)
- Invite users, assign fleets, or change system-wide data
- Sync fleet / station / CoPilot assets
- See another dispatcher’s trucks, loads, or compliance rows

## How fleet scope is assigned

1. Admin invites the person as role **dispatcher**.
2. **Preferred:** FO account email matches an OpenRoad `/users` email (e.g. `alex.m@goxxii.com`). After driver sync, scope = active drivers with `manager_id` = that OpenRoad user, via their current truck assignments.
3. **Fallback:** Admin assigns a Trimble dispatcher name on Accounts (`PATCH /api/v1/accounts/:accountId/dispatcher`) matching `FleetVehicle.dispatcherName` (CoPilot export `FirstName`).
4. With neither OpenRoad link nor Trimble name, the dispatcher sees an empty fleet / empty compliance and a hint to ask an admin.

OpenRoad `manager_id` is the source of truth for “Alex M has 10 drivers.” Trimble FirstName alone can be incomplete/stale (e.g. only 4 tablets labeled `Alex M`).

## David lock

Do **not** expand dispatcher permissions (settings read, cross-fleet visibility, invites, etc.) for beta without David’s written approval. Update this doc when that approval is recorded.
