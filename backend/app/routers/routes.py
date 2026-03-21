import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_municipality_role
from app.auth.models import TokenData
from app.agents.route_agent import (
    _nearest_neighbour,
    _route_distance,
    FILL_THRESHOLD,
    AVG_SPEED_KMH,
    FUEL_COST_PER_KM,
)
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/routes", tags=["Routes"])


# ── Models ────────────────────────────────────────────────────────────────────

class RouteStatusUpdate(BaseModel):
    status: str


# ── GET /routes/ ──────────────────────────────────────────────────────────────

@router.get("/", summary="Today's generated routes")
def todays_routes(current_user: TokenData = Depends(get_current_user)):
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        res = (
            supabase.table("routes")
            .select("*")
            .gte("created_at", today_start)
            .order("created_at", desc=True)
            .execute()
        )
        routes = res.data or []
        logger.info("todays_routes: returned %d routes", len(routes))
        return {"date": today_start[:10], "count": len(routes), "routes": routes}
    except Exception as e:
        logger.error("todays_routes error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /routes/optimize ─────────────────────────────────────────────────────

@router.post("/optimize", summary="Trigger AI route optimization for all available vehicles (municipality only)")
def optimize_routes(current_user: TokenData = Depends(require_municipality_role)):
    try:
        priority_bins = db.get_bins_above_threshold(FILL_THRESHOLD)
        if not priority_bins:
            return {"message": "No bins above threshold require collection", "routes_created": 0}

        vehicles = [v for v in db.get_all_vehicles() if v.get("status") == "available"]
        if not vehicles:
            return {"message": "No available vehicles", "routes_created": 0}

        created_routes = []
        chunk_size = max(1, len(priority_bins) // len(vehicles))

        for idx, vehicle in enumerate(vehicles):
            chunk = priority_bins[idx * chunk_size: (idx + 1) * chunk_size]
            if not chunk:
                continue

            ordered = _nearest_neighbour(chunk)
            optimised_dist = _route_distance(ordered)
            traditional_dist = round(optimised_dist * 1.2, 2)

            route = {
                "route_id": f"RTE-{uuid.uuid4().hex[:8].upper()}",
                "vehicle_id": vehicle["vehicle_id"],
                "total_bins": len(ordered),
                "total_distance_km": optimised_dist,
                "traditional_distance_km": traditional_dist,
                "distance_saved_km": round(traditional_dist - optimised_dist, 2),
                "estimated_duration_minutes": int((optimised_dist / AVG_SPEED_KMH) * 60),
                "fuel_cost": round(optimised_dist * FUEL_COST_PER_KM, 2),
                "fuel_saved": round((traditional_dist - optimised_dist) * FUEL_COST_PER_KM, 2),
                "route_data": {"bins": [b["bin_id"] for b in ordered]},
                "status": "pending",
                "generated_by": "route_agent_manual",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            saved = db.save_route(route)
            created_routes.append(saved)

        logger.info(
            "optimize_routes: created %d routes for %d bins by %s",
            len(created_routes), len(priority_bins), current_user.user_id,
        )
        return {
            "routes_created": len(created_routes),
            "bins_covered": len(priority_bins),
            "vehicles_assigned": len(created_routes),
            "routes": created_routes,
        }
    except Exception as e:
        logger.error("optimize_routes error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /routes/{route_id} ────────────────────────────────────────────────────

@router.get("/{route_id}", summary="Single route details")
def get_route(route_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("routes")
            .select("*")
            .eq("route_id", route_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Route '{route_id}' not found")
        logger.info("get_route: %s", route_id)
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_route error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PUT /routes/{route_id}/status ─────────────────────────────────────────────

@router.put("/{route_id}/status", summary="Update route status (municipality only)")
def update_route_status(
    route_id: str,
    payload: RouteStatusUpdate,
    current_user: TokenData = Depends(require_municipality_role),
):
    VALID_STATUSES = {"pending", "active", "completed", "cancelled"}
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )
    try:
        now = datetime.now(timezone.utc).isoformat()
        update_data: dict = {"status": payload.status}
        if payload.status == "active":
            update_data["started_at"] = now
        elif payload.status in ("completed", "cancelled"):
            update_data["completed_at"] = now

        res = (
            supabase.table("routes")
            .update(update_data)
            .eq("route_id", route_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Route '{route_id}' not found")
        logger.info("update_route_status: %s → %s by %s", route_id, payload.status, current_user.user_id)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_route_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /routes/vehicle/{vehicle_id} ─────────────────────────────────────────

@router.get("/vehicle/{vehicle_id}", summary="All routes for a specific vehicle")
def routes_for_vehicle(vehicle_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("routes")
            .select("*")
            .eq("vehicle_id", vehicle_id)
            .order("created_at", desc=True)
            .execute()
        )
        routes = res.data or []
        logger.info("routes_for_vehicle: %s returned %d routes", vehicle_id, len(routes))
        return {"vehicle_id": vehicle_id, "count": len(routes), "routes": routes}
    except Exception as e:
        logger.error("routes_for_vehicle error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
