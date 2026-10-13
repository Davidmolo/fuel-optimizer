# Dispatcher permissions (beta)

Beta access matrix for the Fuel Optimizer **dispatcher** role.  
**Frozen until David gives written approval to change these permissions.**

## Roles

| Role | Fleet visibility | Settings / system config |
|------|------------------|--------------------------|
| `admin` | All trucks, drivers, loads | Full access |
| `user` | Scoped if `dispatcherName` is set; otherwise empty | No settings access (admin-only APIs) |
| `dispatcher` | Only trucks whose Trimble CoPilot `FirstName` / `FleetVehicle.dispatcherName` matches the user’s assigned `dispatcherName` | **Blocked** (API 403 + Settings hidden in UI) |

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
2. Admin assigns a Trimble dispatcher name on Accounts (`PATCH /api/v1/accounts/:accountId/dispatcher`).
3. That name must match `FleetVehicle.dispatcherName` from the CoPilot assets sync (export `FirstName`).
4. With no assignment, the dispatcher sees an empty fleet / empty compliance and a hint to ask an admin.

## David lock

Do **not** expand dispatcher permissions (settings read, cross-fleet visibility, invites, etc.) for beta without David’s written approval. Update this doc when that approval is recorded.
