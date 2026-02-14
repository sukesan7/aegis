from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.algorithm import router as algo_router

app = FastAPI(title="Aegis API", version="0.1.0")

# CORS is vital for Hackathons (allows frontend on port 5173 to talk to backend on 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the domain. For hackathon, allow all.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect the Algorithm Router
app.include_router(algo_router.router, prefix="/api/algo", tags=["algorithm"])

@app.get("/")
def read_root():
    return {"status": "Aegis System Online", "version": "Alpha 1.0"}