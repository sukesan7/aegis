# Aegis — Real-Time EMS Navigation, Triage & Algorithmic Routing Telemetry

![status](https://img.shields.io/badge/status-hackathon%20prototype-orange)
![domain](https://img.shields.io/badge/domain-healthcare%20%26%20re--engineering-blue)
![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)
![backend](https://img.shields.io/badge/backend-FastAPI-009688)
![maps](https://img.shields.io/badge/maps-MapLibre%20%2B%20OpenStreetMap-2e7d32)
![telemetry](https://img.shields.io/badge/telemetry-Recharts-ff4081)
![python](https://img.shields.io/badge/python-3.10%2B-3776ab)
![node](https://img.shields.io/badge/node-18%2B-339933)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

> **Not a medical device. Not for real patient care or live dispatch.**  
> Aegis is a hackathon prototype built to demonstrate how modern routing + UI telemetry + AI can reduce cognitive load and improve arrival times in emergency response.

### 🏅**Winner:** [York Region's Best Community Impact Hack Winner](https://ctrl-hack-del-2.devpost.com)

### Links:
**[Youtube Demonstration & Showcase Video](https://www.youtube.com/watch?v=_uR9GesJHUE)**

**[Devpost Project Link](https://devpost.com/software/aegis-c5rwk3)**

---

## Executive summary

**Aegis** is a paramedic/first-responder “mission control” dashboard that combines:

- **Road-law–aware routing** on real OpenStreetMap drive networks (directed roads, one-ways)
- **GPS-style simulation** + turn-by-turn navigation telemetry (ETA, next maneuver, distance to next)
- **AI triage assistant** (Gemini) with optional **text-to-speech** (ElevenLabs)
- A demo-ready **Algorithmic Race** mini-map (Dijkstra vs **Duan–Mao BM-SSSP**) with **Bloomberg-style telemetry**, KPI strip, trend lines, histograms, and a built-in benchmark runner

**Goal:** reduce navigation errors and re-route latency so response teams can push toward **York Region’s ~6-minute response-time objective** (our demo target KPI). 

We focus on two practical levers:
1) reduce wrong turns + missed maneuvers under stress, and  
2) re-route faster and more reliably under disruptions (closures/incidents).

---

## Demo highlights

### 1) End-to-end EMS dashboard loop
- Dispatch + vitals + navigation panels around a live map
- Real route computation and a moving vehicle marker (follow camera)
- AI assistant produces concise, EMS-style bullet guidance

### 2) Dev Mode + Algorithmic Race
- Bottom-left **DEV button** opens:
  - Tactical injection scenarios (two demo scenarios)
  - “Algorithm Comparison” quick stats
  - Road disruption injection (re-route while moving)
- Bottom-right **Algorithmic Race mini-map**
  - Dijkstra vs Duan–Mao BM-SSSP exploration replay
  - Expand into an overlay panel with:
    - KPI header row (winner, speedup, explored Δ, ETA Δ)
    - live trend lines (exploration vs time, completion %)
    - histogram (route segment length distribution)
    - **Benchmark Mode** (RUN 20×) + exec-time histograms + P50/P90

---

## Features

### Routing & Navigation
- **OSM drive network routing** via OSMnx + NetworkX (directed graph)
- **Geocode + Autocomplete**:
  - `/api/algo/geocode?q=...`
  - `/api/algo/autocomplete?q=...` (bounded to York Region viewbox)
- **Polyline generation** uses edge geometry for accurate map rendering (no straight-line node hopping)
- **Snapped start/end** to nearest drivable nodes (prevents “inside buildings” drift)
- **Live navigation telemetry** derived from route geometry:
  - total distance / total time
  - cumulative distance/time arrays aligned to polyline points
  - maneuver steps (“turn left/right/slight/continue”) from bearings + street changes
- **Scenario speed profiles** (Routine / Trauma / Cardiac Arrest) influence travel-time model

### Re-route under disruption
- **Roadblock injection** while sim is running
- Background re-route swaps routes seamlessly:
  - avoids “teleporting through buildings”
  - will backtrack along the existing route if snap points differ

### Algorithmic Race mini-map
- **Dijkstra vs Duan–Mao BM-SSSP** replay loop (exploration + final path)
- Faint street-network layer so it reads as “streets” (not just nodes)
- Expand overlay panel includes:
  - **KPI header row** (winner, speedup, explored Δ, ETA Δ)
  - **Trend lines** (explored edges over time, completion %)
  - **Histogram** (route segment-length distribution)
  - **Benchmark Mode** (RUN 20×) exec-time histograms + summary stats

### UI/UX (glanceable EMS dashboard)
- High-contrast “mission control” layout
- Live map in the center with camera-follow mode
- Panels:
  - Dispatch feed
  - Navigation (turn-by-turn)
  - Patient vitals
  - Hospital info
  - Equipment diagnostics

### AI (Geminai) + Voice (ElevenLabs)
- Gemini triage assistant: `/api/ai/chat`
  - EMS-style: concise bullet points only
- ElevenLabs TTS: `/api/ai/speak` (optional)
- Local audio fallbacks in `frontend/public/audio/` for demos
- Browser autoplay protection handling (header click primes audio)

---

## Duan–Mao BM-SSSP vs Dijkstra

### Baseline: Dijkstra (NetworkX)
Dijkstra is the standard single-source shortest path approach with non-negative weights. In this repo it is used via NetworkX on the directed OSM graph, weighted by edge length.

### Experimental accelerator: Duan–Mao BM-SSSP (“Breaking the Sorting Barrier”)
Recent research (Duan et al.) describes a deterministic directed SSSP algorithm with improved asymptotic runtime in certain models, often described as “breaking the sorting barrier.”

In Aegis, BM-SSSP is integrated as:
- A **TypeScript Node runner** (`backend/bmssp-runner/`) invoked by the Python backend
- Backend converts the OSMnx graph into an edge list and requests a predecessor tree
- Path is reconstructed from predecessors; exploration lines are derived from predecessor edges
- A **persistent Node server runner** (`server.mjs`) is used by default to avoid per-request Node startup overhead
- If BM-SSSP fails, Aegis **falls back to Dijkstra** automatically (demo reliability)

**References**
- Paper: https://arxiv.org/abs/2504.17033  
- Runner inspiration: https://github.com/Braeniac/bm-sssp

> Reality check: BM-SSSP may not beat Dijkstra on small graphs due to constants and overhead.  
> That’s exactly why Aegis ships both — and visualizes the tradeoffs clearly via telemetry + benchmarks.

---
## Benchmarks & Figures

The figures below are generated by the repo’s benchmark pipeline:
- `backend/bench/run_bench.py` (collects JSONL latency measurements), and
- `docs/bench/make_figures.py` (renders charts into `docs/figures/`)

### Algorithm latency (lower is better)
![Algorithm latency boxplot](docs/figures/latency_boxplot_algo_time.png)
![Algorithm latency CDF](docs/figures/latency_cdf_algo_time.png)

### End-to-end request latency
![Total latency boxplot](docs/figures/latency_boxplot_total_time.png)

### Speedup distribution (Dijkstra / BM-SSSP)
![Speedup histogram](docs/figures/speedup_hist.png)

### Exploration footprint (optional run)
![Explored vs algorithm time](docs/figures/explored_vs_algo_time.png)

#### Generate / refresh the figures
```bash
# 0) Start backend on :8000 (see Setup & Run below)
# 1) Run benchmarks (writes JSONL to docs/bench/)
python backend/bench/run_bench.py --trials 20 --warmups 3 --tag bench --out-dir docs/bench

# Optional: include exploration counts for explored-vs-time figure
python backend/bench/run_bench.py --include-exploration --trials 5 --warmups 1 --tag exploration --out-dir docs/bench

# 2) Render PNGs into docs/figures/
python docs/bench/make_figures.py --bench-dir docs/bench --out docs/figures --theme dark
```

---

## Architecture

**Frontend (React/Vite)**
- MapLibre GL renders:
  - route polyline
  - vehicle marker + follow camera
  - AlgoRace minimap overlays + telemetry panel
- Panels provide EMS-centric information density

**Backend (FastAPI)**
- OSMnx downloads/cache road graph corridor
- Computes shortest path (Dijkstra or BM-SSSP)
- Builds polyline, steps, cumulative distance/time arrays
- Provides optional exploration + faint network segments for visualization
- Exposes AI endpoints (Gemini + optional ElevenLabs)

---

## Repository layout

```text
.
├─ .gitignore
├─ README.md
├─ package-lock.json
├─ docs/
│  └─ algorithm_for_map.pdf
├─ backend/
│  ├─ .env.example
│  ├─ diagnostics.py
│  ├─ requirements.txt
│  ├─ bmssp-runner/
│  │  ├─ package.json
│  │  ├─ run.mjs
│  │  └─ server.mjs
│  └─ app/
│     ├─ __init__.py
│     ├─ main.py
│     ├─ services/
│     │  ├─ __init__.py
│     │  ├─ gemini.py
│     │  └─ voice.py
│     └─ algorithm/
│        ├─ __init__.py
│        ├─ router.py
│        └─ __pycache__/
│           └─ router.cpython-311.pyc
└─ frontend/
   ├─ index.html
   ├─ package.json
   ├─ package-lock.json
   ├─ postcss.config.js
   ├─ tailwind.config.js
   ├─ vite.config.ts
   ├─ public/
   │  └─ audio/
   │     ├─ arrest.mp3
   │     ├─ routine.mp3
   │     └─ trauma.mp3
   ├─ dist/
   │  ├─ index.html
   │  ├─ audio/
   │  │  ├─ arrest.mp3
   │  │  ├─ routine.mp3
   │  │  └─ trauma.mp3
   │  └─ assets/
   │     ├─ index-COSicwxP.js
   │     └─ index-dBP8aut8.css
   └─ src/
      ├─ main.tsx
      ├─ App.tsx
      ├─ index.css
      ├─ hooks/
      │  └─ useTextToSpeech.ts
      ├─ constants/
      │  ├─ routeData.ts
      │  └─ scenarios.ts
      └─ components/
         ├─ WelcomeScreen.tsx
         ├─ Map.tsx
         ├─ AlgoRaceMiniMap.tsx
         ├─ AlgoRaceCharts.tsx
         ├─ AlgoBenchmarkCharts.tsx
         ├─ dev/
         │  └─ ScenarioInjector.tsx
         └─ panels/
            ├─ AIAssistant.tsx
            ├─ DispatchFeed.tsx
            ├─ Navigation.tsx
            ├─ PatientVitals.tsx
            └─ HospitalInfo.tsx
```

---

## Setup & Run

### Prerequisites
- **Python 3.10+** (3.11 recommended)
- **Node.js 18+**
- A C/C++ build toolchain may be required on Windows for some Python wheels

### 1) Backend (FastAPI)
```bash
cd backend

python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend (Vite)
```bash
cd frontend
npm install
npm run dev
```

Open:
- http://localhost:5173

> Vite proxies `/api/*` → `http://127.0.0.1:8000` (see `frontend/vite.config.ts`)

---

## Configuration

### Environment file
```bash
cd backend
cp .env.example .env
```

Optional keys:
```env
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
```

### BM-SSSP runner (Duan–Mao mode)
Install Node runner deps:
```bash
cd backend/bmssp-runner
npm install
```

Enable BM-SSSP as the default backend algorithm:
```bash
cd backend
AEGIS_ROUTE_ALGO=bmsssp uvicorn app.main:app --reload --port 8000
```

Notes:
- Frontend can also request the algorithm per-route via `algorithm: "dijkstra" | "bmsssp"`
- BM-SSSP defaults to using the persistent runner (`server.mjs`). You can disable it:
  ```bash
  BMSSSP_USE_SERVER=0 AEGIS_ROUTE_ALGO=bmsssp uvicorn app.main:app --reload --port 8000
  ```

### AlgoRace payload caps
```bash
AEGIS_MAX_EXPLORATION_SEGS=2500
AEGIS_MAX_NETWORK_SEGS=2200
AEGIS_COORD_ROUND_DIGITS=6
```

---

## Commands

Frontend:
```bash
cd frontend
npm run build
npm run preview
```

Backend (production-ish):
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## API overview

### Routing
- `GET /api/algo/geocode?q=...` → `{ lat, lng, display_name }`
- `GET /api/algo/autocomplete?q=...` → `{ results: [{ lat, lng, display_name }, ...] }`
- `POST /api/algo/calculate` payload:
  ```json
  {
    "start": {"lat": 43.86, "lng": -79.44},
    "end":   {"lat": 43.88, "lng": -79.25},
    "scenario_type": "ROUTINE",
    "algorithm": "dijkstra",
    "include_exploration": false,
    "blocked_edges": null
  }
  ```
  response includes:
  - `path_coordinates` (polyline)
  - `snapped_start`, `snapped_end`
  - `total_distance_m`, `total_time_s`
  - `cum_distance_m[]`, `cum_time_s[]`
  - `steps[]` (maneuvers)
  - optional AlgoRace fields:
    - `explored_coords`, `explored_count`
    - `network_edges_coords`

### AI
- `POST /api/ai/chat` `{ "message": "...", "context": "general" }` → `{ "response": "..." }`
- `POST /api/ai/speak` `{ "message": "...", "context": "general" }` → `audio/mpeg` (if configured)

---

## AlgoRace + Benchmark

1. Click **DEV** (bottom-left)
2. Select a scenario (Cardiac Arrest / MVA Trauma)
3. AlgoRace appears bottom-right
4. Click **Expand** to open the overlapping telemetry panel
5. Click **RUN 20×** to generate benchmark histograms

Bench details:
- Bench uses `include_exploration=false` to keep payloads tiny and trials fast
- Collects `execution_time_ms` from the backend response

---

## Troubleshooting

### First scenario route feels slow
OSMnx may be cold-starting (graph download/build cache).
- Run each scenario once beforehand (warm cache), then it’s much faster.

### “Navigation Fault: scikit-learn must be installed…”
OSMnx nearest-node on lat/lon graphs uses BallTree:
```bash
pip install scikit-learn
```

### Nominatim returns no results / rate limiting
Nominatim is rate-limited; Aegis enforces a minimum interval and caches results.
If you’re offline, use the dev scenarios.

### AlgoRace not visible
AlgoRace is shown when:
- Dev mode is enabled and a scenario is injected
- Both algorithms failing hides the widget automatically

---

## Future Roadmap
- Offline prebuilt York Region road graph (no Overpass dependency)
- Real incident/closure feeds (auto re-route)
- Multi-destination recommendation (nearest appropriate facility)
- Better maneuver modeling (roundabouts, turn restrictions, lane guidance)
- Audit logging + replay (privacy-safe)

---

## Data attribution & licensing
Aegis uses **OpenStreetMap** data via OSMnx / Overpass and geocoding via Nominatim.  
OpenStreetMap data is licensed under **ODbL** — see https://www.openstreetmap.org/copyright.

---

## License

Refer to the MIT License

## Team Information

> This project was created by Team **Instigate Cafe** @ the CTRL+HACK+DEL 2.0 Hackathon

Team Members:
[Sukesan Selvaraveendran](https://www.linkedin.com/in/sukesan/)
[Sanchit Das](https://www.linkedin.com/in/sanchitdas/)
[Nithursan Jeyabalasingam](https://www.linkedin.com/in/nithursanj/)
[Yazanth Vickneswaran](https://www.linkedin.com/in/yazanth-vickneswaran/)

