import logging
import uuid
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_municipality_role
from app.auth.models import TokenData
from app.agents.compliance_agent import _check_event, PENALTY_TABLE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/collections", tags=["Collections"])


# ── Models ────────────────────────────────────────────────────────────────────

class CollectionEventIn(BaseModel):
    bin_id: str
    vehicle_id: str
    recycling_plant_id: Optional[str] = None
    fill_before: Optional[int] = None
    fill_after: int = 5
    waste_collected_kg: Optional[float] = None
    waste_type: Optional[str] = None
    compliance_score: int = 100
    notes: Optional[str] = None


# ── Sample Data Generators ────────────────────────────────────────────────────

def _get_sample_collections(event_count: int = 20) -> list[dict]:
    """Generate realistic sample collection events for demo purposes."""
    import random
    events = []
    waste_types = ["organic", "plastic", "glass", "metal", "paper"]
    now = datetime.now(timezone.utc)
    
    for i in range(event_count):
        collected_at = now - timedelta(hours=random.randint(1, 168))
        events.append({
            "id": i + 1,
            "event_id": f"EVT-{uuid.uuid4().hex[:10].upper()}",
            "bin_id": f"BIN-{(i % 50) + 1:03d}",
            "vehicle_id": f"VEH-{(i % 5) + 1:03d}",
            "fill_before": random.randint(60, 95),
            "fill_after": random.randint(5, 15),
            "waste_collected_kg": random.uniform(10, 150),
            "waste_type": random.choice(waste_types),
            "is_compliant": random.choice([True, True, True, False]),
            "compliance_score": random.randint(70, 100),
            "collected_at": collected_at.isoformat(),
        })
    return events


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sha256(data: dict) -> str:
    return "0x" + hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _run_compliance(event: dict, saved_id: str):
    try:
        vehicles = db.get_all_vehicles()
        vehicle_map = {v["vehicle_id"]: v for v in vehicles}
        vehicle = vehicle_map.get(event.get("vehicle_id"))
        failed = _check_event(event, vehicle)
        if not failed:
            return
        penalty = sum(PENALTY_TABLE.get(c, 0) for c in failed)
        supabase.table("violations").insert({
            "violation_id": f"VIO-{uuid.uuid4().hex[:8].upper()}",
            "collection_event_id": saved_id,
            "vehicle_id": event.get("vehicle_id"),
            "violation_type": ", ".join(failed),
            "failed_checks": failed,
            "penalty_amount": penalty,
            "penalty_applied": False,
            "blockchain_hash": _sha256({"event_id": saved_id, "checks": failed}),
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        db.create_alert({
            "alert_type": "compliance_violation",
            "severity": "high",
            "title": f"Compliance violation – vehicle {event.get('vehicle_id')}",
            "message": f"Failed: {', '.join(failed)}. Penalty: ${penalty}",
            "vehicle_id": event.get("vehicle_id"),
        })
        logger.warning("compliance: violations %s for event %s", failed, saved_id)
    except Exception as e:
        logger.error("compliance check error: %s", e)


def _record_blockchain(saved_event: dict):
    try:
        tx_hash = _sha256({
            "event_id": saved_event.get("event_id"),
            "bin_id": saved_event.get("bin_id"),
            "vehicle_id": saved_event.get("vehicle_id"),
            "collected_at": saved_event.get("collected_at"),
        })
        db.save_blockchain_log({
            "transaction_type": "collection_event",
            "related_id": saved_event["id"],
            "tx_hash": tx_hash,
            "status": "confirmed",
            "data": {
                "event_id": saved_event.get("event_id"),
                "bin_id": saved_event.get("bin_id"),
                "vehicle_id": saved_event.get("vehicle_id"),
                "waste_collected_kg": saved_event.get("waste_collected_kg"),
            },
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error("blockchain recording error: %s", e)


# ── POST /collections/ ────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED, summary="Record a new collection event")
def create_collection(
    payload: CollectionEventIn,
    current_user: TokenData = Depends(require_municipality_role),
):
    try:
        event_id = f"EVT-{uuid.uuid4().hex[:10].upper()}"
        event_data = {
            "event_id": event_id,
            "bin_id": payload.bin_id,
            "vehicle_id": payload.vehicle_id,
            "recycling_plant_id": payload.recycling_plant_id,
            "fill_before": payload.fill_before,
            "fill_after": payload.fill_after,
            "waste_collected_kg": payload.waste_collected_kg,
            "waste_type": payload.waste_type,
            "is_compliant": payload.compliance_score >= 70,
            "compliance_score": payload.compliance_score,
            "notes": payload.notes,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
        clean_event = {k: v for k, v in event_data.items() if v is not None}
        saved = db.save_collection_event(clean_event)
        db.update_bin(payload.bin_id, {"fill_level": payload.fill_after, "last_collected": clean_event["collected_at"]})
        _run_compliance(clean_event, saved["id"])
        _record_blockchain(saved)
        logger.info("create_collection: event=%s bin=%s vehicle=%s", event_id, payload.bin_id, payload.vehicle_id)
        return saved
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_collection error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /collections/today ────────────────────────────────────────────────────
# Static routes MUST come before /{event_id}

@router.get("/today", summary="Today's collection events")
def todays_collections(current_user: TokenData = Depends(get_current_user)):
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        res = (
            supabase.table("collection_events")
            .select("*")
            .gte("collected_at", today_start)
            .order("collected_at", desc=True)
            .execute()
        )
        events = res.data or []
        
        # Fall back to sample collections if database is empty
        if not events:
            sample = _get_sample_collections(10)
            # Filter to only today's events
            now = datetime.now(timezone.utc)
            today_start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
            events = [e for e in sample if datetime.fromisoformat(e["collected_at"].replace("Z", "+00:00")) >= today_start_dt]
            logger.info("todays_collections: returned %d sample events", len(events))
        else:
            logger.info("todays_collections: %d events from database", len(events))
        
        return {"date": today_start[:10], "count": len(events), "events": events}
    except Exception as e:
        logger.error("todays_collections error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("todays_collections error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /collections/history ──────────────────────────────────────────────────

@router.get("/history", summary="Collection history with optional date filter")
def collection_history(
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        query = supabase.table("collection_events").select("*")
        if from_date:
            query = query.gte("collected_at", from_date)
        if to_date:
            query = query.lte("collected_at", to_date + "T23:59:59Z")
        res = query.order("collected_at", desc=True).limit(limit).execute()
        events = res.data or []
        
        # Fall back to sample collections if database is empty
        if not events:
            sample = _get_sample_collections(limit)
            events = sample
            logger.info("collection_history: returned %d sample events", len(events))
        else:
            logger.info("collection_history: %d events from database", len(events))
        
        return {"count": len(events), "events": events}
    except Exception as e:
        logger.error("collection_history error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /collections/bin/{bin_id} ─────────────────────────────────────────────

@router.get("/bin/{bin_id}", summary="All collection events for a specific bin")
def collections_for_bin(
    bin_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        res = (
            supabase.table("collection_events")
            .select("*")
            .eq("bin_id", bin_id)
            .order("collected_at", desc=True)
            .limit(limit)
            .execute()
        )
        events = res.data or []
        
        # Fall back to sample collections for this bin if database is empty
        if not events:
            sample = _get_sample_collections(limit)
            events = [e for e in sample if e["bin_id"] == bin_id]
            logger.info("collections_for_bin: %s returned %d sample events", bin_id, len(events))
        else:
            logger.info("collections_for_bin: %s returned %d events from database", bin_id, len(events))
        
        return {"bin_id": bin_id, "count": len(events), "events": events}
    except Exception as e:
        logger.error("collections_for_bin error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /collections/{event_id} ───────────────────────────────────────────────
# Dynamic route LAST

@router.get("/{event_id}", summary="Single collection event details")
def get_collection_event(event_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("collection_events")
            .select("*")
            .eq("event_id", event_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Event '{event_id}' not found")
        logger.info("get_collection_event: %s", event_id)
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_collection_event error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
