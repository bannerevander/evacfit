<p align="center">
  <img src="web/public/brand/evacfit-logo.png" alt="EvacFit" width="260">
</p>

<p align="center">
  <b>Evacuation coordination that places every affected family in a shelter that fits their needs.</b><br>
  Live prototype: <a href="https://evacfit.vercel.app">https://evacfit.vercel.app</a>
</p>

---

## Overview

When a disaster strikes, families are often sent to the nearest shelter even when it cannot care for them: no wheelchair access, no power for medical equipment, no room for a companion. Families then move again, shelters overflow, and the most vulnerable people wait the longest.

**EvacFit** matches each affected family with a shelter that meets their needs, keeps shelter capacity in sync in real time, and assigns volunteers with the right vehicle to pick them up. The rule is **safety first, needs next**: a family in a hazard zone is never left waiting for a "perfect" shelter. They go to the nearest safe shelter now and are referred to a better one as soon as it has room.

### Roles

| Role | What they do |
| --- | --- |
| **Coordinator** (Koordinator) | Activates an emergency, runs the matching, verifies shelters, assigns volunteers, approves BMKG earthquake alerts |
| **Shelter staff** (Posko) | Confirms or rejects incoming families, checks families in, updates facilities and capacity, refers families onward |
| **Volunteer** (Relawan) | Registers and triages families in the field, picks them up, works offline |
| **Resident** (Warga) | Registers their family's needs with a step-by-step wizard and follows their evacuation status |

### Key features

- **Needs-based matching** that compares each family's functional needs (power for medical equipment, routine medication or health checks, step-free access, wheelchair vehicle, accessible toilet, caregiver space, pregnancy, infants) with shelter facilities (including an on-site health post), capacity and power, and puts the most vulnerable families first.
- **Optimisation solver** (Google OR-Tools CP-SAT) that places as many vulnerable families as possible and then minimises travel distance. If the solver is unavailable, the app falls back to a built-in greedy matcher.
- **Safe capacity handling**: every placement is re-checked in Postgres under a row lock, so a shelter is never overbooked.
- **Maps and routes**: shelter and family locations, plus walking, wheelchair and vehicle routes (OpenRouteService).
- **BMKG earthquake alerts**: Indonesia's official open earthquake data is polled every minute and turned into draft events for the coordinator to approve.
- **Works offline**: field actions are queued on the device and synced without duplicates when the signal returns.
- **Accessible and bilingual**: large touch targets and text, read-aloud, Bahasa Indonesia and English.
- **Multi-region**: sample data covers 7 disaster-prone areas (Medan, Karo, Samosir, Tapanuli Tengah, Cianjur, Lumajang, Palu).

### SDG alignment

EvacFit supports **SDG 11 (Sustainable Cities and Communities)**, in particular target 11.5: reducing the number of deaths and people affected by disasters, with a focus on people in vulnerable situations. People with disabilities face 2–4× higher disaster mortality (UNDRR), and the problem is rarely a lack of beds. It is beds that do not fit their needs.

## Tech Stack & Architecture

| Folder | Component | Technology |
| --- | --- | --- |
| `web/` | Frontend web app | React 19, TypeScript, Vite, Tailwind CSS, Leaflet |
| `supabase/` | Backend | Supabase (Postgres + PostGIS, Row Level Security, RPC functions, pg_cron), Deno Edge Functions |
| `solver/` | Placement optimisation service | Python, FastAPI, Google OR-Tools CP-SAT |

```
Browser (web/)
  ├── reads data & calls RPCs ─────────► Supabase Postgres (RLS per role, matching, capacity locks, audit log)
  ├── sends matching problem ──────────► Solver service (solver/) ── returns suggested placements
  └── requests routes ─────────────────► Edge Function "route" ──► OpenRouteService

pg_cron (every minute) ────────────────► Edge Function "bmkg-poll" ──► BMKG open data ──► draft disaster events
```

In **demo mode** the frontend needs none of the services above: all data is fictional and lives in the browser's `localStorage`.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) and npm | 20 or newer | Frontend (required) |
| [Python](https://www.python.org/) | 3.10 or newer | Solver service (optional) |
| [Supabase CLI](https://supabase.com/docs/guides/cli) and a Supabase account | latest | Your own backend (optional) |
| [Deno](https://deno.com/) | 2.x | Edge Function tests (optional) |

An internet connection is needed for the map tiles, even in demo mode.

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/bannerevander/evacfit.git
cd evacfit
```

### 2. Frontend

```bash
cd web
npm install
cp .env.example .env    # Windows cmd: copy .env.example .env
```

Edit `web/.env`:

| Variable | Description |
| --- | --- |
| `VITE_DATA_MODE` | `demo` = fictional data in the browser, no server needed. `supabase` = real backend |
| `VITE_SUPABASE_URL` | Your Supabase project URL (Supabase dashboard > Settings > API). Only used in `supabase` mode |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable (anon) key. Never put the `service_role` key here |
| `VITE_SOLVER_URL` | URL of the solver service, e.g. `https://evacfit-solver.vercel.app` or `http://localhost:8000`. Leave empty to use only the built-in greedy matcher |

> To try the app quickly, you can skip the `.env` file and run `npm run dev:demo`, which uses the bundled `.env.demo` (demo mode).

### 3. Solver service (optional)

```bash
cd solver
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install "uvicorn[standard]"
```

### 4. Your own Supabase backend (optional)

Only needed if you want to run `supabase` mode against your own project instead of demo mode.

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                          # applies supabase/migrations (schema, RLS, RPC, seed data, demo accounts)
supabase functions deploy route
supabase functions deploy bmkg-poll
```

Then:

- Add an [OpenRouteService](https://openrouteservice.org/) API key for routing. In the SQL Editor run:
  `select vault.create_secret('<ORS key>', 'ors_api_key', 'OpenRouteService key for the route Edge Function');`
- The BMKG cron job in `supabase/migrations/20261019000008_bmkg_poll.sql` calls the team's project URL. Point it at your own project's `/functions/v1/bmkg-poll` URL.
- Optionally narrow the BMKG alert area with the Edge Function secrets `WORK_AREA_LAT`, `WORK_AREA_LNG` and `WORK_AREA_KM` (default: all of Indonesia).

## Running the Program

### Option A: Demo mode (recommended for a quick try, no backend)

```bash
cd web
npm run dev:demo
```

Open http://localhost:5173. All data is fictional and stored in your browser. Use **Reset demo data** on the home page to start over.

### Option B: Full mode with Supabase

Set `VITE_DATA_MODE=supabase` and your Supabase keys in `web/.env`, then:

```bash
cd web
npm run dev
```

### Running the solver locally

```bash
cd solver
uvicorn app:app --reload --port 8000
```

Check it with http://localhost:8000/health, then set `VITE_SOLVER_URL=http://localhost:8000` in `web/.env` and restart the frontend. The solver allows requests from `http://localhost:5173` and `http://localhost:4173`.

### Production build

```bash
cd web
npm run build      # type-check + production build into web/dist
npm run preview    # serve the build at http://localhost:4173
```

The offline service worker is only active in the production build.

### Roles and demo accounts

In demo mode, open each role's page directly (or pick a role on the home page); no sign-in is needed. In Supabase mode and on the live prototype, each page asks you to sign in with that role's demo account (all data is fictional):

| Role | Demo account | Page |
| --- | --- | --- |
| Coordinator | `koordinator@evacfit.demo` | `/koordinator` |
| Shelter staff | `posko@evacfit.demo` (Posko Gedung Serbaguna Titi Kuning) | `/posko` |
| Volunteer | `relawan@evacfit.demo` (Andi Pratama, wheelchair van) | `/relawan` |
| Resident | `warga@evacfit.demo` (Keluarga Siregar) | `/warga` |

### Suggested walkthrough (about 3 minutes)

1. **Coordinator**: activate an emergency (the Sungai Deli flood scenario is pre-filled) and click **Activate & place families**. Families are recommended to shelters at the edge of the flood zone.
2. **Shelter staff**: confirm one family and reject another. The rejected family is automatically redirected to the next nearest safe shelter.
3. **Coordinator > Dispatch**: assign the wheelchair van to a family that needs it. A regular car is rejected automatically.
4. **Volunteer** (demo mode): click **Simulate signal loss**, start the trip (it goes into the *Pending Sync* queue), then restore the signal.
5. **Shelter staff > Check-in**: complete the check-in. **Resident** (best viewed at phone size) now shows *Arrived safely*.

In Supabase mode (including the live prototype), you can try another region by picking a different **Work area** in the top bar (for example Kab. Karo for the Sinabung eruption) and activate its pre-filled scenario.

## Testing

```bash
# Frontend (from web/)
npm run typecheck              # TypeScript check
npm run check                  # self-check of matching and the assignment state machine

# Solver (from solver/)
python tests/test_solver.py    # feasibility and optimality checks, including a case where greedy fails

# Edge Functions (from the repository root)
deno test supabase/functions
```

## Project Structure

```
evacfit/
├── web/                     # Frontend (React + Vite)
│   ├── public/              # Static assets, PWA manifest, offline service worker
│   └── src/
│       ├── pages/           # Screens per role (Koordinator, Posko, Relawan, Warga)
│       ├── components/      # Shared UI (maps, location picker, needs checklist, ...)
│       ├── lib/             # Matching, distance and vulnerability logic
│       ├── state/           # Data layer (demo store, Supabase client, offline outbox)
│       ├── data/            # Demo data and scenarios
│       └── i18n/            # Bahasa Indonesia and English dictionaries
├── solver/                  # OR-Tools placement service
│   ├── app.py               # FastAPI app: GET /health, POST /solve
│   ├── solver.py            # CP-SAT model
│   └── tests/
└── supabase/
    ├── migrations/          # Postgres schema, RLS, RPC, cron jobs, seed data
    └── functions/
        ├── bmkg-poll/       # BMKG earthquake feed to draft disaster events
        └── route/           # OpenRouteService proxy (keeps the API key server-side)
```

## Deployment

- **Frontend**: hosted on Vercel at https://evacfit.vercel.app. The Vercel project uses `web` as its root directory and deploys automatically on every push to `main`.
- **Solver**: hosted at https://evacfit-solver.vercel.app.
- **Backend**: Supabase (migrations and Edge Functions as described in [Installation](#4-your-own-supabase-backend-optional)).
