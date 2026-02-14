from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.algorithm import router as algo_router
from app.services.gemini import get_ai_response, ChatRequest
from fastapi.responses import Response
from app.services.voice import generate_voice_stream


app = FastAPI(
    title="Aegis API", 
    description="Backend for Project Aegis - Powered by Duan-Mao Algo & Gemini",
    version="0.1.0"
)

# CORS: allow common dev server ports (Vite + legacy)
# If you're using the Vite proxy (/api -> backend), CORS usually doesn't matter,
# but this keeps things working if you hit the backend directly.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",   # vite preview
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect the Duan-Mao Router
app.include_router(algo_router.router, prefix="/api/algo", tags=["algorithm"])

@app.get("/")
def read_root():
    return {"system": "Aegis", "status": "operational", "ai_link": "active"}

@app.post("/api/ai/chat")
async def chat_endpoint(req: ChatRequest):
    return await get_ai_response(req)

@app.post("/api/ai/speak")
async def speak_ai_response(req: ChatRequest):
    audio_content = generate_voice_stream(req.message)
    if audio_content:
        return Response(content=audio_content, media_type="audio/mpeg")
    return {"error": "Voice generation failed"}