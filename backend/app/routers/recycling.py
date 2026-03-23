import logging
import uuid
import hashlib
import json
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
    vehicle_id: Optional[str] = None
    collection_event_id: Optional[str] = None
    waste_type: str
    gross_weight_kg: float
    net_weight_kg: Optional[float] = None
    quality_grade: Optional[str] = None
    notes: Optional[str] = None


class IntakeStatusUpdate(BaseModel):
    processing_status: str
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sha256(data: dict) -> str:
    return "0x" + hashlib.sha256(
        json.dumps(data, sort_keys=True, default=str).encode()
    ).hexdigest()


def _get_default_plant() -> Optional[dict]:
    """Always returns the first operational plant, or any plant if none operational."""
    try:
        plants = db.get_recycling_plants()
        if not plants:
            return None
        operational = [p for p in plants if p.get("status") == "operational"]
        return operational[0] if operational else plants[0]
    except Exception as e:
        logger.error("_get_default_plant error: %s", e)
        return None


def _write_blockchain_log(intake_id: str, intake_data: dict, event: str):
    """Write an immutable blockchain log entry for an intake event."""
    payload = {
        "intake_id": intake_id,
        "waste_type": intake_data.get("waste_type"),
        "gross_weight_kg": intake_data.get("gross_weight_kg"),
        "net_weight_kg": intake_data.get("net_weight_kg"),
        "quality_grade": intake_data.get("quality_grade"),
        "vehicle_id": intake_data.get("vehicle_id"),
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    tx_hash = _sha256(payload)
    db.save_blockchain_log({
        "transaction_type": "recycling_intake",
        "related_id": intake_id,
        "tx_hash": tx_hash,
        "status": "confirmed",
        "data": payload,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    })
    return tx_hash


# ── GET /recycling/dashboard ──────────────────────────────────────────────────

@router.get("/dashboard", summary="Recycling plant dashboard")
def plant_dashboard(current_user: TokenData = Depends(require_recycling_role)):
    try:
        plant = _get_default_plant()
        plant_id_filter = plant["id"] if plant else None

        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query = supabase.table("recycling_intake").select("*").gte("received_at", since)
        if plant_id_filter:
            query = query.eq("plant_id", plant_id_filter)
        intake = query.execute().data or []

        by_status: dict = {}
        by_type: dict = {}
        by_type_kg: dict = {}
        total_weight = 0.0
        for r in intake:
            s = r.get("processing_status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
            wt = r.get("waste_type", "unknown")
            by_type[wt] = by_type.get(wt, 0) + 1
            weight = float(r.get("net_weight_kg") or r.get("gross_weight_kg") or 0)
            by_type_kg[wt] = by_type_kg.get(wt, 0) + weight
            total_weight += weight

        vehicles = [v for v in db.get_all_vehicles() if v.get("status") == "collecting"]

        capacity_pct = 0
        if plant:
            cap = float(plant.get("capacity_kg_per_day") or 1)
            load = float(plant.get("current_load_kg") or 0)
            capacity_pct = min(100, load / cap * 100) if cap > 0 else 0

        return {
            "plant": plant,
            "plant_name": plant.get("plant_name") if plant else "Recycling Plant",
            "capacity_pct": round(capacity_pct, 1),
            "period_days": 7,
            "total_intake_records": len(intake),
            "total_weight_kg": round(total_weight, 2),
            "by_processing_status": by_status,
            "by_waste_type": by_type,
            "by_waste_type_kg": by_type_kg,
            "incoming_vehicles": len(vehicles),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("plant_dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Static routes MUST come before dynamic /{intake_id} ──────────────────────

@router.get("/plants", summary="List all recycling plants")
def list_plants(current_user: TokenData = Depends(require_recycling_role)):
    try:
        plants = db.get_recycling_plants()
        return [
            {
                "id": p.get("id"),
                "plant_id": p.get("plant_id") or p.get("id"),
                "plant_name": p.get("plant_name"),
                "status": p.get("status"),
                "current_load_kg": p.get("current_load_kg"),
                "capacity_kg_per_day": p.get("capacity_kg_per_day"),
            }
            for p in (plants or [])
        ]
    except Exception as e:
        logger.error("list_plants error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intake", summary="Incoming waste records")
def list_intake(
    processing_status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: TokenData = Depends(require_recycling_role),
):
    try:
        plant = _get_default_plant()
        query = supabase.table("recycling_intake").select("*")
        if plant:
            query = query.eq("plant_id", plant["id"])
        if processing_status:
            query = query.eq("processing_status", processing_status)
        records = query.order("received_at", desc=True).limit(limit).execute().data or []
        return {"count": len(records), "intake": records}
    except Exception as e:
        logger.error("list_intake error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/intake", status_code=status.HTTP_201_CREATED, summary="Record new waste intake")
def record_intake(
    payload: IntakeIn,
    current_user: TokenData = Depends(require_recycling_role),
):
    VALID_GRADES = {"A", "B", "C", "rejected"}
    if payload.quality_grade and payload.quality_grade not in VALID_GRADES:
        raise HTTPException(status_code=400, detail=f"Invalid quality_grade. Options: {VALID_GRADES}")

    plant = _get_default_plant()

    try:
        intake_id = f"INT-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        plant_id_val = plant["id"] if plant else None

        intake_data = {
            k: v for k, v in {
                "intake_id": intake_id,
                "plant_id": plant_id_val,
                "vehicle_id": payload.vehicle_id,
                "collection_event_id": payload.collection_event_id,
                "waste_type": payload.waste_type,
                "gross_weight_kg": payload.gross_weight_kg,
                "net_weight_kg": payload.net_weight_kg,
                "quality_grade": payload.quality_grade,
                "notes": payload.notes,
                "processing_status": "received",
                "received_at": now,
            }.items() if v is not None
        }

        saved = db.save_recycling_intake(intake_data)

        # Update plant load
        if plant:
            new_load = float(plant.get("current_load_kg") or 0) + float(
                payload.net_weight_kg or payload.gross_weight_kg
            )
            supabase.table("recycling_plants").update(
                {"current_load_kg": new_load}
            ).eq("id", plant["id"]).execute()

            cap = float(plant.get("capacity_kg_per_day") or 0)
            if cap > 0 and new_load / cap >= 0.90:
                db.create_alert({
                    "alert_type": "plant_full",
                    "severity": "high",
                    "title": f"Plant {plant.get('plant_name')} near capacity",
                    "message": f"Load: {new_load:.0f} / {cap:.0f} kg/day ({new_load/cap*100:.0f}%)",
                    "plant_id": plant["id"],
                })

        # Blockchain log — intake received
        tx_hash = None
        try:
            tx_hash = _write_blockchain_log(intake_id, intake_data, "intake_received")
        except Exception as be:
            logger.warning("blockchain log failed (non-fatal): %s", be)

        logger.info("record_intake: %s weight=%.1fkg plant=%s", intake_id, payload.gross_weight_kg, plant_id_val)
        return {**saved, "blockchain_hash": tx_hash}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("record_intake error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/capacity", summary="Current capacity status for all plants")
def capacity_status(current_user: TokenData = Depends(require_recycling_role)):
    try:
        plants = db.get_recycling_plants()
        result = []
        for p in plants:
            cap = float(p.get("capacity_kg_per_day") or 0)
            load = float(p.get("current_load_kg") or 0)
            pct = round(load / cap * 100, 1) if cap > 0 else 0
            result.append({
                "plant_id": p.get("plant_id"),
                "plant_name": p.get("plant_name"),
                "status": p.get("status"),
                "current_load_kg": load,
                "capacity_kg_per_day": cap,
                "utilisation_pct": pct,
                "is_near_capacity": pct >= 90,
            })
        return {"count": len(result), "plants": result}
    except Exception as e:
        logger.error("capacity_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/blockchain", summary="Blockchain audit trail for recycling intake")
def recycling_blockchain_records(
    limit: int = Query(default=100, ge=1, le=500),
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
        return {"count": len(records), "records": records}
    except Exception as e:
        logger.error("recycling_blockchain_records error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports", summary="Processing performance reports")
def processing_reports(
    days: int = Query(default=30, ge=1, le=365),
    current_user: TokenData = Depends(require_recycling_role),
):
    try:
        plant = _get_default_plant()
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query = supabase.table("recycling_intake").select("*").gte("received_at", since)
        if plant:
            query = query.eq("plant_id", plant["id"])
        records = query.execute().data or []

        by_type: dict = {}
        by_grade: dict = {}
        by_status: dict = {}
        total_gross = total_net = 0.0

        for r in records:
            wt = r.get("waste_type", "unknown")
            by_type[wt] = by_type.get(wt, 0) + float(r.get("net_weight_kg") or 0)
            by_grade[r.get("quality_grade", "unknown")] = by_grade.get(r.get("quality_grade", "unknown"), 0) + 1
            by_status[r.get("processing_status", "unknown")] = by_status.get(r.get("processing_status", "unknown"), 0) + 1
            total_gross += float(r.get("gross_weight_kg") or 0)
            total_net += float(r.get("net_weight_kg") or 0)

        return {
            "period_days": days,
            "total_records": len(records),
            "total_gross_weight_kg": round(total_gross, 2),
            "total_net_weight_kg": round(total_net, 2),
            "processing_efficiency_pct": round(total_net / total_gross * 100, 1) if total_gross > 0 else 0,
            "by_waste_type_kg": {k: round(v, 2) for k, v in by_type.items()},
            "by_quality_grade": by_grade,
            "by_processing_status": by_status,
        }
    except Exception as e:
        logger.error("processing_reports error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Dynamic routes LAST ───────────────────────────────────────────────────────

@router.put("/intake/{intake_id}/status", summary="Update intake processing status")
def update_intake_status(
    intake_id: str,
    payload: IntakeStatusUpdate,
    current_user: TokenData = Depends(require_recycling_role),
):
    VALID_STATUSES = {"received", "sorting", "processing", "completed", "rejected"}
    if payload.processing_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Options: {VALID_STATUSES}")
    try:
        # Fetch current record
        existing = (
            supabase.table("recycling_intake")
            .select("*")
            .eq("intake_id", intake_id)
            .single()
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail=f"Intake record '{intake_id}' not found")

        record = existing.data
        update_data: dict = {"processing_status": payload.processing_status}
        if payload.notes:
            update_data["notes"] = payload.notes
        if payload.processing_status == "completed":
            update_data["processed_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table("recycling_intake")
            .update(update_data)
            .eq("intake_id", intake_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Intake record '{intake_id}' not found")

        updated = res.data[0]

        # Write blockchain log for completed and rejected transitions
        if payload.processing_status in ("completed", "rejected"):
            event = "intake_completed" if payload.processing_status == "completed" else "intake_rejected"
            _write_blockchain_log(intake_id, record, event)

        logger.info("update_intake_status: %s → %s", intake_id, payload.processing_status)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_intake_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
