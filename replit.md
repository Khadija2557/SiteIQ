# SiteIQ — AI-Powered Construction Site Coordination

SiteIQ is a full-stack SaaS platform that gives construction site managers and safety officers real-time command-and-control over every worker, machine, hazard, and task on a live site.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/siteiq run dev` — run the React frontend (port 22199)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Demo Login Credentials

- **Email:** `admin@tower.com`
- **Password:** the hash is `sha256("password" + "siteiq-salt")` — use any value since auth checks hash equality. To set a real password, update the `password_hash` column in the `users` table.
- **Tenant:** Tower Construction Ltd (tenant_id = 1)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **API:** Express 5 + JWT auth (jsonwebtoken)
- **Frontend:** React 18 + Vite + Tailwind CSS (dark industrial/cyber-ops theme)
- **DB:** PostgreSQL + Drizzle ORM
- **Validation:** Zod (zod/v4), drizzle-zod
- **API codegen:** Orval (from OpenAPI spec)
- **State:** TanStack Query (via Orval-generated hooks)
- **Charts:** Recharts
- **Build:** esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/db/src/schema/` — Drizzle table definitions (tenants, users, workers, machines, tasks, hazards, alerts, deliveries, cameras, robots, reports)
- `artifacts/api-server/src/routes/` — Express route handlers (one file per domain)
- `artifacts/api-server/src/middleware/auth.ts` — JWT auth middleware + signToken helper
- `artifacts/siteiq/src/pages/` — All frontend pages (dashboard, workers, tasks, machines, hazards, alerts, deliveries, cameras, robots, analytics, login)

## Architecture decisions

- **Contract-first API:** OpenAPI spec gates codegen; frontend only uses generated hooks, never raw fetch
- **Multi-tenant:** Every DB table has `tenant_id`; all routes filter by `req.auth.tenantId` from JWT
- **JWT auth:** Token stored in `localStorage` as `siteiq_token`; middleware verifies on every protected route
- **Dark-mode only:** The app forces `dark` class on `<html>` — no light mode exists
- **Route ordering matters:** Stats/summary routes (`/workers/stats/summary`) must be registered before `/:id` routes to avoid Express treating "stats" as an ID

## Product

- **Dashboard** — Live site health score, active worker/machine/hazard/alert counts, zone status grid, activity feed
- **Workers** — Full roster with PPE scores, fatigue levels, zone assignments, shift tracking
- **Tasks** — Kanban-style board filterable by status, zone, priority
- **Machines** — Fleet panel with utilization %, maintenance due dates, operator assignments
- **Hazards** — Active hazard list with severity badges and one-click resolve
- **Alerts** — Real-time alert feed with severity filtering and acknowledge actions
- **Deliveries** — Incoming materials scheduler with gate and ETA tracking
- **Cameras** — 6-camera live-feed grid (placeholder panels with status indicators)
- **Robots** — Autonomous robot fleet status
- **Analytics** — Charts for task completion, zone activity, worker productivity

## User preferences

- Dark industrial / cyber-ops aesthetic throughout
- No emojis in the UI
- Electric cyan (#06b6d4) as primary brand color

## Gotchas

- Always register stats routes (`/workers/stats/summary`) before parameterized routes (`/workers/:id`)
- `req.params["id"]` returns `string | string[]` in Express 5 types — always wrap with `String()` before `parseInt()`
- After any OpenAPI spec change: run codegen → rebuild libs → restart both workflows
- The password hashing uses a simple SHA-256 + hardcoded salt — not production-grade; replace with bcrypt for real deployments

## Seeded Data (Tenant: Tower Construction Ltd)

- 2 users (admin@tower.com, manager@tower.com)
- 12 workers across 4 zones with varying PPE/fatigue scores
- 6 machines (2 cranes, 2 forklifts, 1 excavator, 1 mixer)
- 20 tasks in various states
- 8 active hazards (2 critical, 4 high, 2 low/medium)
- 15 alerts (mix of acknowledged/unacknowledged)
- 6 deliveries, 6 camera feeds, 3 robots, 3 reports

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
