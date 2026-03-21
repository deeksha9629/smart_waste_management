import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_municipality_role
from app.auth.models import TokenData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


# ── Models ────────────────────────────────────────────────────────────────────

class VehicleCreate(BaseModel):
    vehicle_number: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_user_id: Optional[str] = None
    capacity_kg: float = 5000.0
    vehicle_type: str = "collection_truck"
    assigned_zone: Optional[str] = None


class VehicleStatusUpdate(BaseModel):
    status: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    current_load_kg: Optional[float] = None
    fuel_level: Optional[int] = None
    assigned_zone: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_vehicle(vehicle_id: str) -> dict:
    vehicles = db.get_all_vehicles()
    match = next((v for v in vehicles if v["vehicle_id"] == vehicle_id), None)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Vehicle '{vehicle_id}' not found")
    return match


# ── GET /vehicles/ ────────────────────────────────────────────────────────────

@router.get("/", summary="List all vehicles")
def list_vehicles(current_user: TokenData = Depends(get_current_user)):
    try:
        vehicles = db.get_all_vehicles()
        logger.info("list_vehicles: returned %d vehicles", len(vehicles))
        return vehicles
    except Exception as e:
        logger.error("list_vehicles error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /vehicles/{vehicle_id} ────────────────────────────────────────────────

@router.get("/{vehicle_id}", summary="Single vehicle details")
def get_vehicle(vehicle_id: str, current_user: TokenData = Depends(get_current_user)):
    vehicle = _require_vehicle(vehicle_id)
    logger.info("get_vehicle: %s fetched by %s", vehicle_id, current_user.user_id)
    return vehicle


# ── GET /vehicles/{vehicle_id}/route ─────────────────────────────────────────

@router.get("/{vehicle_id}/route", summary="Active or latest route for a vehicle")
def get_vehicle_route(vehicle_id: str, current_user: TokenData = Depends(get_current_user)):
    _require_vehicle(vehicle_id)
    try:
        # Return active route first, then most recent pending/completed
        res = (
            supabase.table("routes")
            .select("*")
            .eq("vehicle_id", vehicle_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No route found for this vehicle")
        logger.info("get_vehicle_route: %s", vehicle_id)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_vehicle_route error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PUT /vehicles/{vehicle_id}/status ────────────────────────────────────────

@router.put("/{vehicle_id}/status", summary="Update vehicle status/location (municipality only)")
def update_vehicle_status(
    vehicle_id: str,
    payload: VehicleStatusUpdate,
    current_user: TokenData = Depends(require_municipality_role),
):
    _require_vehicle(vehicle_id)
    try:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update")

        VALID_STATUSES = {"available", "collecting", "full", "maintenance", "offline"}
        if "status" in updates and updates["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
            )

        updated = db.update_vehicle(vehicle_id, updates)
        logger.info("update_vehicle_status: %s → %s by %s", vehicle_id, updates, current_user.user_id)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_vehicle_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /vehicles/ ───────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED, summary="Add a new vehicle (municipality only)")
def add_vehicle(
    payload: VehicleCreate,
    current_user: TokenData = Depends(require_municipality_role),
):
    try:
        vehicle_id = f"VEH-{uuid.uuid4().hex[:6].upper()}"
        vehicle_data = {
            "vehicle_id": vehicle_id,
            "vehicle_number": payload.vehicle_number,
            "driver_name": payload.driver_name,
            "driver_phone": payload.driver_phone,
            "driver_user_id": payload.driver_user_id,
            "capacity_kg": payload.capacity_kg,
            "current_load_kg": 0.0,
            "vehicle_type": payload.vehicle_type,
            "status": "available",
            "fuel_level": 100,
            "assigned_zone": payload.assigned_zone,
            "municipality_id": current_user.user_id,
        }
        res = supabase.table("vehicles").insert(
            {k: v for k, v in vehicle_data.items() if v is not None}
        ).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create vehicle")
        logger.info("add_vehicle: created %s by %s", vehicle_id, current_user.user_id)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("add_vehicle error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
