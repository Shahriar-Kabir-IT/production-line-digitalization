# Ananta MES — Line Digitalization

Production & quality (DHU) line-monitoring platform for Ananta Garments / Sportswear.

- **QC Station** — a no-login kiosk on the line PC. The QC picks the line, the plan loads
  automatically, and she tallies **checked pieces** (big +1 / −1 counter) and **defects by
  code** for the **current hour only**. Each hour box **locks when its clock hour ends**.
- **TV Board** — a no-login display link: pick a line to show *Target Against Achieved* and
  *Current Line Average Efficiency* with live graphs.
- **Work Study** (username login) — sets each line's daily plan and sees its factory's
  dashboard + defect analysis.
- **Super Admin** (username login) — one master dashboard across **all factories**.

> Requirements: [`SRS.md`](SRS.md). Static design reference: [`prototype/dashboard.html`](prototype/dashboard.html).

## Architecture — database and app are separate services

```
┌────────────┐   REST + WebSocket   ┌─────────────┐   Prisma   ┌──────────────┐
│   web/     │ ──────────────────▶  │   server/   │ ─────────▶ │  PostgreSQL  │
│  React SPA │ ◀──────────────────  │  Node API   │ ◀───────── │  (local 16)  │
└────────────┘     live updates      └─────────────┘            └──────────────┘
```

| Layer | Stack |
|---|---|
| Database | PostgreSQL 16 (local) |
| ORM / migrations | Prisma 5 |
| API | Node 20 · TypeScript · Express · JWT (DB-backed) · Zod · Socket.IO |
| Web | React 18 · TypeScript · Vite · React Router · TanStack Query · Chart.js |

## The calculations that matter

```
Hourly Efficiency %  =  Checked (= Output) × SMV / (Manpower × 60) × 100
DHU %                =  Total Defects × 100 / Total Checked Quantity
```
End-line checks 100%, so the hour's **Checked Quantity is the output** — it drives both
efficiency / Target-vs-Achieved and the DHU denominator.

## Access & roles

| Who | How they reach it | Scope |
|---|---|---|
| **QC (line)** | `/station` — **no login**, pick the line | Enters the open hour for any line they pick |
| **TV display** | `/tv` — **no login**, pick the line | Read-only board |
| **Work Study** | sign in (username) | **One factory** — plan entry + that factory's dashboard |
| **Super Admin** | sign in (username) | **All factories** — master dashboard |

Hours are locked against the **Asia/Dhaka** clock: a box is editable only during its own
hour and locks when the hour ends (configurable in `server/src/lib/constants.ts`).

## Quick start

Prerequisites: **Node 20+** and a running **PostgreSQL 16** (the `ananta_mes` database
already exists on this machine).

```bash
# 1 — API
cd server
cp .env.example .env            # DATABASE_URL already points at local Postgres
npm install
npm run prisma:migrate          # or: npx prisma migrate deploy
npm run seed                    # factories, lines, defect codes, users, a sample day
npm run dev                     # http://localhost:4000

# 2 — web (second terminal)
cd web
cp .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

> Note on install scripts: this environment blocks npm post-install scripts. If Prisma or
> esbuild misbehave, run `npx prisma generate` and `node web/node_modules/esbuild/install.js`.

## Logins (username · password `password`)

| Role | Username |
|------|----------|
| Super Admin | `admin` |
| Work Study — AGL | `ws.agl` |
| Work Study — ASL / AJL / ABM | `ws.asl` · `ws.ajl` · `ws.abm` |

The QC Station and TV Board need **no login**.

## Project layout

```
server/
  prisma/schema.prisma         # Factory, Line, User, DefectCode, WorkStudyPlan, HourlyEntry, HourlyDefect
  prisma/seed.ts               # factories, lines, 31 defect codes, users, sample day
  src/lib/lock.ts              # hour-locking against the Asia/Dhaka clock
  src/utils/metrics.ts         # efficiency, DHU, target-vs-achieved
  src/modules/
    public/                    # no-login kiosk: station counters + defect tally, TV board
    workstudy/ dashboard/ auth/ factories/
web/
  src/pages/                   # Landing · Station · TVSelect · LineTV · Dashboard · WorkStudy · Login
```

## Notes

- Defect codes (31) are seeded from form Q-SEW006-01; a few faint codes on the scan are
  best-effort — edit `DEFECT_CODES` in `server/src/lib/constants.ts` and re-seed to correct.
- The station is an open kiosk by design (workers don't log in). For a locked-down floor,
  add a per-factory station PIN — the scoping hooks are already in place.
