<div align="center">

<img src="app_icon.png" alt="Ananta" width="120" />

# 🏭 ANANTA MES — Production Line Digitalization

### Manufacturing Execution System for real-time production & quality monitoring

*Replacing paper forms and manual Excel sheets with a live, role-based platform across every sewing line, in every factory.*

![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-live-010101?logo=socket.io&logoColor=white)

</div>

---

## 📖 Overview

**Ananta MES** digitizes the shop floor of Ananta Garments, Sportswear, Jeanswear and ABM Fashion. A PC at the end of every line lets the QC tally checked pieces and defects in real time; big-screen TV boards show live progress; and managers get role-scoped dashboards — from a single line all the way up to a factory-wide master view.

> 💡 **The database and the application are separate services** — the DB runs on its own, the API is a standalone Node service, and the web client is an independent build that talks to the API only over HTTP + WebSocket.

---

## ✨ Features

- 🖥️ **No-login QC Station** — a line PC kiosk: pick the line, the plan auto-loads, then tally checked pieces (⬇️ `+1` / ⬆️ `−1`, keyboard-driven) and defects by code.
- ⏱️ **Time-locked hours** — each hour box is editable only during its own clock hour (Asia/Dhaka) and locks automatically when the hour ends.
- 🧵 **Inline QC & DHU** — 31 defect codes tallied straight from the floor; `DHU % = Total Defects × 100 ÷ Total Checked`.
- 📺 **Live TV boards** — *Target vs Achieved* and *Current Line Average Efficiency* per line, updating live via WebSocket.
- 📊 **Role-based dashboards** — Work Study sees one factory; Super Admin gets one master dashboard across all factories, with **defect Pareto** and **highest-DHU** analysis.
- 🗓️ **Work Study plan entry** — the daily per-line plan (buyer, style, SMV, manpower, target) that everything calculates against.
- 🔐 **Secure auth** — username + password, JWT verified against the database on every request, role-scoped access.
- ⚡ **Race-free counters** — atomic increments so concurrent taps never lose a count.

---

## 🧮 The calculations that matter

```text
Hourly Efficiency %  =  Checked (= Output) × SMV / (Manpower × 60) × 100
DHU %                =  Total Defects × 100 / Total Checked Quantity
```

End-line checks 100%, so the hour's **Checked Quantity is the output** — it drives both efficiency / Target-vs-Achieved and the DHU denominator.

---

## 🏗️ Architecture

```text
┌────────────┐   REST + WebSocket   ┌─────────────┐   Prisma   ┌──────────────┐
│   web/     │ ──────────────────▶  │   server/   │ ─────────▶ │  PostgreSQL  │
│  React SPA │ ◀──────────────────  │  Node API   │ ◀───────── │   (local)    │
└────────────┘     live updates      └─────────────┘            └──────────────┘
```

| Layer | Technology |
|-------|------------|
| 🗄️ **Database** | PostgreSQL 16 |
| 🔗 **ORM / migrations** | Prisma 5 |
| ⚙️ **API** | Node 20 · TypeScript · Express · JWT · Zod · Socket.IO |
| 🎨 **Web** | React 18 · TypeScript · Vite · React Router · TanStack Query · Chart.js |

---

## 👥 Roles & access

| Role | How they reach it | Scope |
|------|-------------------|-------|
| 🧑‍🏭 **QC (line)** | `/station` — **no login** | Enters the open hour for any line they pick |
| 📺 **TV display** | `/tv` — **no login** | Read-only live board |
| 📐 **Work Study** | sign in | **One factory** — plan entry + factory dashboard |
| 👑 **Super Admin** | sign in | **All factories** — master dashboard |

---

## 🚀 Getting started

**Prerequisites:** Node 20+, PostgreSQL 16, npm.

```bash
# 0 — create the database (once)
createdb ananta_mes

# 1 — API
cd server
cp .env.example .env            # point DATABASE_URL at your Postgres
npm install
npx prisma migrate deploy       # create the schema
npm run seed                    # factories, lines, defect codes, users, a sample day
npm run dev                     # 🟢 http://localhost:4000

# 2 — web (second terminal)
cd web
cp .env.example .env
npm install
npm run dev                     # 🟢 http://localhost:5173
```

> 🧩 This environment blocks npm post-install scripts. If Prisma or esbuild misbehave, run
> `npx prisma generate` and `node web/node_modules/esbuild/install.js`.

### 🔑 Seeded logins (password: `password`)

| Role | Username |
|------|----------|
| 👑 Super Admin | `admin` |
| 📐 Work Study — AGL | `ws.agl` |
| 📐 Work Study — ASL / AJL / ABM | `ws.asl` · `ws.ajl` · `ws.abm` |

The **QC Station** and **TV Board** need no login. 🎉

---

## 🗂️ Project structure

```text
.
├── 📁 server/                     # API (separate service)
│   ├── prisma/schema.prisma       # Factory · Line · User · DefectCode · WorkStudyPlan · HourlyEntry · HourlyDefect
│   ├── prisma/seed.ts             # factories, lines, 31 defect codes, users, sample day
│   └── src/
│       ├── lib/lock.ts            # hour-locking against the Asia/Dhaka clock
│       ├── utils/metrics.ts       # efficiency, DHU, target-vs-achieved
│       └── modules/               # auth · factories · workstudy · dashboard · public (kiosk)
├── 📁 web/                        # React SPA (separate service)
│   └── src/pages/                 # Landing · Login · Station · TVSelect · LineTV · Dashboard · WorkStudy
├── 📁 prototype/                  # static design reference
├── 📄 SRS.md                      # software requirements specification
└── 📄 README.md
```

---

## 📸 Key screens

- 🏠 **Landing** — pick QC Station, TV Board, or Admin sign-in
- 🧑‍🏭 **QC Station** — hour strip, big counter, 31-code defect pad, live DHU
- 📺 **Line TV Board** — Target vs Achieved + efficiency gauge
- 📊 **Master Dashboard** — factory cards, line-wise output, defect Pareto

---

## 🗺️ Roadmap

- [ ] 📥 Downloadable detailed line reports
- [ ] 🧑‍💼 Supervisor override for locked hours (audited)
- [ ] 📱 Per-factory station PIN (optional lock-down)
- [ ] 🚢 Production build & deployment config

---

<div align="center">

**Copyright © 2026 · Developed and Managed By ANANTA ICT TEAM**

<sub>Making a world of fashion 🧵</sub>

</div>
