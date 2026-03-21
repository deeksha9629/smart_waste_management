from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.agents.scheduler import start_scheduler, stop_scheduler

# ── Routers ──────────────────────────────────────────────────────────────────
from app.auth.router import router as auth_router
from app.routers.bins import router as bins_router
from app.routers.vehicles import router as vehicles_router
from app.routers.collections import router as collections_router
from app.routers.routes import router as routes_router
from app.routers.predictions import router as predictions_router
from app.routers.blockchain import router as blockchain_router
from app.routers.citizens import router as citizens_router
from app.routers.municipality import router as municipality_router
from app.routers.recycling import router as recycling_router
from app.routers.dashboard import router as dashboard_router
from app.routers.websocket import router as ws_router


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[SMART-WASTE] Starting up...")
    start_scheduler()
    yield
    print("[SMART-WASTE] Shutting down...")
    stop_scheduler()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SMART-WASTE API",
    description=(
        "Smart City Municipal Waste Management System — "
        "Municipality · Citizens · Recycling Plants"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ──────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(bins_router)
app.include_router(vehicles_router)
app.include_router(collections_router)
app.include_router(routes_router)
app.include_router(predictions_router)
app.include_router(blockchain_router)
app.include_router(citizens_router)
app.include_router(municipality_router)
app.include_router(recycling_router)
app.include_router(dashboard_router)
app.include_router(ws_router)


# ── Utility Endpoints ─────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "SMART-WASTE API",
        "version": "1.0.0",
    }


@app.get("/", tags=["System"])
def root():
    return {
        "system": "SMART-WASTE",
        "description": "Smart City Municipal Waste Management System",
        "version": "1.0.0",
        "portals": {
            "municipality": "Admin & command center",
            "citizens": "Public users & token rewards",
            "recycling_plants": "Processing centers",
        },
        "agents": [
            "IoT Simulator      – every 5 min",
            "Prediction Agent   – every 15 min",
            "Route Agent        – every 30 min",
            "Compliance Agent   – every 60 min",
            "Blockchain Agent   – every 10 min",
        ],
        "docs": "/docs",
        "redoc": "/redoc",
    }
