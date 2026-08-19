# Fleet console IA

BanditArenaWeb consolidates device ops under **Fleet** and rollups under **Analytics**.

## Menu

- **Fleet** — Neon Circuit (downtown entertainment) and Horizon Parks (theme park) demo fleets, map, device workbench
- **Analytics** — session KPIs + fleet financial comparison
- **Maintenance** is no longer a top-level item (workbench tab on Fleet)

## Device workbench tabs

Overview · Lifecycle · Updates · Maintenance · Diagnostics · Tickets · Financial

## Geolocation feasibility

**Feasible now** with venue lat/lng pins (no map SDK). IoT heartbeats may later attach `lastKnownLocation` (venue_pin / wifi / gnss). Requirements: FR-SW-SVC-005.

## Financial measurements

Per-device and fleet rollups: session revenue, utilization, royalty, license, maintenance accrual, parts, contribution margin. Requirements: FR-SW-SVC-005, FR-SW-SVC-011, FR-SW-SVC-002 joinability.

## Sample data

- Web: `src/data/fleetDemoCatalog.js`
- Cloud seed: `amplify/function/BanditApiFunction/fleetDemoSeed.js` (appended from `demoSeedItems`)
