import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_recycling_role
from app.auth.models import TokenData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recycling", tags=["Recycling"])


# ── Models ────────────────────────────────────────────────────────────────────

class IntakeIn(BaseModel):
    plant_id: str
    vehicle_id: Optional[str] = None
    collection_event_id: Optional[str] = None
    waste_type: str
    gross_weight_kg: float
    net_weight_kg: Optional[float] = None
    quality_grade: Optional[str] = None
    notes: Optional[str] = None


class IntakeStatusUpdate(BaseModel):
    processing_status: str
    processed_at: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user_plant(user_id: str) -> Optional[dict]:
    """Return the plant managed by this user, if any."""
    plants = db.get_recycling_plants()
    return next((p for p in plants if p.get("manager_user_id") == user_id), None)


# ── GET /recycling/dashboard ──────────────────────────────────────────────────

@router.get("/dashboard", summary="Recycling plant dashboard (recycling role only)")
def plant_dashboard(current_user: TokenData = Depends(require_recycling_role)):
    try:
        plant = _get_user_plant(current_user.user_id)
        plant_id_filter = plant["id"] if plant else None

        # Intake stats for last 7 days
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query = supabase.table("recycling_intake").select("*").gte("received_at", since)
        if plant_id_filter:
            query = query.eq("plant_id", plant_id_filter)
        intake_res = query.execute()
        intake = intake_res.data or []

        by_status: dict = {}
        by_type: dict = {}
        total_weight = 0.0
        for record in intake:
            s = record.get("processing_status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
            wt = record.get("waste_type", "unknown")
            by_type[wt] = by_type.get(wt, 0) + 1
            total_weight += float(record.get("net_weight_kg") or 0)

        # Pending vehicles (vehicles with status=collecting)
        vehicles = [v for v in db.get_all_vehicles() if v.get("status") == "collecting"]

        logger.info("plant_dashboard: user=%s plant=%s", current_user.user_id, plant_id_filter)
        return {
            "plant": plant,
            "period_days": 7,
            "total_intake_records": len(intake),
            "total_weight_kg": round(total_weight, 2),
            "by_processing_status": by_status,
            "by_waste_type": by_type,
            "incoming_vehicles": len(vehicles),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("plant_dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /recycling/intake ─────────────────────────────────────────────────────

@router.get("/intake", summary="Incoming waste records (recycling role only)")
def list_intake(
    plant_id: Optional[str] = Query(default=None),
    processing_status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: TokenData = Depends(require_recycling_role),
):
    try:
        query = supabase.table("recycling_intake").select("*")
        if plant_id:
            query = query.eq("plant_id", plant_id)
        if processing_status:
            query = query.eq("processing_status", processing_status)
        res = query.order("received_at", desc=True).limit(limit).execute()
        records = res.data or []
        logger.info("list_intake: %d records", len(records))
        return {"count": len(records), "intake": records}
    except Exception as e:
        logger.error("list_intake error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /recycling/intake ────────────────────────────────────────────────────

@router.post("/intake", status_code=status.HTTP_201_CREATED, summary="Record new waste intake (recycling role only)")
def record_intake(
    payload: IntakeIn,
    current_user: TokenData = Depends(require_recycling_role),
):
    VALID_GRADES = {"A", "B", "C", "rejected"}
    if payload.quality_grade and payload.quality_grade not in VALID_GRADES:
        raise HTTPException(status_code=400, detail=f"Invalid quality_grade. Options: {VALID_GRADES}")

    plant = db.get_plant_by_id(payload.plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail=f"Plant '{payload.plant_id}' not found")

    try:
        intake_data = payload.model_dump(exclude_none=True)
        intake_data["intake_id"] = f"INT-{uuid.uuid4().hex[:8].upper()}"
        intake_data["processing_status"] = "received"
        intake_data["received_at"] = datetime.now(timezone.utc).isoformat()

        saved = db.save_recycling_intake(intake_data)

        # Update plant current load
        new_load = float(plant.get("current_load_kg") or 0) + float(payload.net_weight_kg or payload.gross_weight_kg)
        supabase.table("recycling_plants").update({"current_load_kg": new_load}).eq("id", payload.plant_id).execute()

        # Check if plant is near capacity and raise alert
        capacity = float(plant.get("capacity_kg_per_day") or 0)
        if capacity > 0 and new_load / capacity >= 0.90:
            db.create_alert({
                "alert_type": "plant_full",
                "severity": "high",
                "title": f"Plant {plant.get('plant_name')} near capacity",
                "message": f"Current load: {new_load:.1f}kg / {capacity:.1f}kg/day ({new_load/capacity*100:.0f}%)",
                "plant_id": payload.plant_id,
            })

        logger.info("record_intake: %s plant=%s weight=%.1fkg", intake_data["intake_id"], payload.plant_id, payload.gross_weight_kg)
        return saved
    except HTTPException:
        raise
    except Exception as e:
        logger.error("record_intake error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PUT /recycling/intake/{id}/status ─────────────────────────────────────────

@router.put("/intake/{intake_id}/status", summary="Update intake processing status (recycling role only)")
def update_intake_status(
    intake_id: str,
    payload: IntakeStatusUpdate,
    current_user: TokenData = Depends(require_recycling_role),
):
    VALID_STATUSES = {"received", "sorting", "processing", "completed", "rejected"}
    if payload.processing_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Options: {VALID_STATUSES}")
    try:
        update_data: dict = {"processing_status": payload.processing_status}
        if payload.notes:
            update_data["notes"] = payload.notes
        if payload.processing_status == "completed":
            update_data["processed_at"] = payload.processed_at or datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table("recycling_intake")
            .update(update_data)
            .eq("intake_id", intake_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Intake record '{intake_id}' not found")
        logger.info("update_intake_status: %s → %s", intake_id, payload.processing_status)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_intake_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /recycling/capacity ───────────────────────────────────────────────────

@router.get("/capacity", summary="Current capacity status for all plants")
def capacity_status(current_user: TokenData = Depends(require_recycling_role)):
    try:
        plants = db.get_recycling_plants()
        result = []
        for p in plants:
            capacity = float(p.get("capacity_kg_per_day") or 0)
            load = float(p.get("current_load_kg") or 0)
            pct = round(load / capacity * 100, 1) if capacity > 0 else 0
            result.append({
                "plant_id": p.get("plant_id"),
                "plant_name": p.get("plant_name"),
                "status": p.get("status"),
                "current_load_kg": load,
                "capacity_kg_per_day": capacity,
                "utilisation_pct": pct,
                "is_near_capacity": pct >= 90,
            })
        logger.info("capacity_status: %d plants", len(result))
        return {"count": len(result), "plants": result}
    except Exception as e:
        logger.error("capacity_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /recycling/blockchain ─────────────────────────────────────────────────

@router.get("/blockchain", summary="Blockchain records for recycling intake events")
def recycling_blockchain_records(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: TokenData = Depends(require_recycling_role),
):
    try:
        res = (
            supabase.table("blockchain_logs")
            .select("*")
            .eq("transaction_type", "recycling_intake")
            .order("recorded_at", desc=True)
            .limit(limit)
            .execute()
        )
        records = res.data or []
        logger.info("recycling_blockchain_records: %d records", len(records))
        return {"count": len(records), "records": records}
    except Exception as e:
        logger.error("recycling_blockchain_records error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /recycling/reports ────────────────────────────────────────────────────

@router.get("/reports", summary="Processing performance reports")
def processing_reports(
    days: int = Query(default=30, ge=1, le=365),
    plant_id: Optional[str] = Query(default=None),
    current_user: TokenData = Depends(require_recycling_role),
):
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query = supabase.table("recycling_intake").select("*").gte("received_at", since)
        if plant_id:
            query = query.eq("plant_id", plant_id)
        res = query.execute()
        records = res.data or []

        by_type: dict = {}
        by_grade: dict = {}
        by_status: dict = {}
        total_gross = 0.0
        total_net = 0.0

        for r in records:
            wt = r.get("waste_type", "unknown")
            by_type[wt] = by_type.get(wt, 0) + float(r.get("net_weight_kg") or 0)

            grade = r.get("quality_grade", "unknown")
            by_grade[grade] = by_grade.get(grade, 0) + 1

            ps = r.get("processing_status", "unknown")
            by_status[ps] = by_status.get(ps, 0) + 1

            total_gross += float(r.get("gross_weight_kg") or 0)
            total_net += float(r.get("net_weight_kg") or 0)

        efficiency = round(total_net / total_gross * 100, 1) if total_gross > 0 else 0

        logger.info("processing_reports: %d records over %d days", len(records), days)
        return {
            "period_days": days,
            "total_records": len(records),
            "total_gross_weight_kg": round(total_gross, 2),
            "total_net_weight_kg": round(total_net, 2),
            "processing_efficiency_pct": efficiency,
            "by_waste_type_kg": {k: round(v, 2) for k, v in by_type.items()},
            "by_quality_grade": by_grade,
            "by_processing_status": by_status,
        }
    except Exception as e:
        logger.error("processing_reports error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
