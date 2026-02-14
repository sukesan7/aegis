# Aegis: Next-Gen Paramedic Dashboard

Aegis is a real-time, vehicle-friendly dashboard prototype for paramedic / fire response units.

## Run locally

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Default routing (NetworkX/Dijkstra)
uvicorn app.main:app --reload
```

#### Optional: enable Duan–Mao (BM-SSSP) routing

This repo includes a Node runner that wraps the open-source TypeScript implementation of
"Breaking the Sorting Barrier for Directed SSSP".

```bash
cd backend/bmsssp-runner
npm i

cd ..
AEGIS_ROUTE_ALGO=bmsssp uvicorn app.main:app --reload
```

### Frontend (Vite + React)

```bash
cd frontend
npm i
npm run dev
```

Open the Vite URL (default: http://localhost:5173). The dev server proxies `/api/*` to the backend.
