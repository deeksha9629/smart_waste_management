import logging
import uuid
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_municipality_role
from app.auth.models import TokenData
from app.agents.prediction_agent import (
    _linear_predict,
    _priority,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bins", tags=["Bins"])


# ── Response models ───────────────────────────────────────────────────────────

class BinStatusUpdate(BaseModel):
    sensor_status: Optional[str] = None
    waste_type: Optional[str] = None
    zone: Optional[str] = None
    ward: Optional[str] = None
    assigned_recycling_plant_id: Optional[str] = None
    is_smart: Optional[bool] = None


class CollectBinIn(BaseModel):
    vehicle_id: str
    recycling_plant_id: Optional[str] = None
    waste_collected_kg: Optional[float] = None
    notes: Optional[str] = None
    compliance_score: int = 100


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_bin(bin_id: str) -> dict:
    bin_ = db.get_bin_by_id(bin_id)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Bin '{bin_id}' not found")
    return bin_


def _sha256(data: dict) -> str:
    return "0x" + hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


# ── GET /bins/ ────────────────────────────────────────────────────────────────

@router.get("/", summary="List all bins")
def list_bins(current_user: TokenData = Depends(get_current_user)):
    try:
        bins = db.get_all_bins()
        logger.info("list_bins: returned %d bins for user %s", len(bins), current_user.user_id)
        return bins
    except Exception as e:
        logger.error("list_bins error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /bins/critical ────────────────────────────────────────────────────────

@router.get("/critical", summary="Bins at or above fill threshold")
def critical_bins(
    threshold: int = Query(default=80, ge=0, le=100, description="Fill level threshold (%)"),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        bins = db.get_bins_above_threshold(threshold)
        logger.info("critical_bins: %d bins above %d%%", len(bins), threshold)
        return {"threshold": threshold, "count": len(bins), "bins": bins}
    except Exception as e:
        logger.error("critical_bins error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /bins/zone/{zone} ─────────────────────────────────────────────────────

@router.get("/zone/{zone}", summary="Bins filtered by zone")
def bins_by_zone(zone: str, current_user: TokenData = Depends(get_current_user)):
    try:
        res = supabase.table("bins").select("*").eq("zone", zone).execute()
        bins = res.data or []
        logger.info("bins_by_zone: zone=%s returned %d bins", zone, len(bins))
        return {"zone": zone, "count": len(bins), "bins": bins}
    except Exception as e:
        logger.error("bins_by_zone error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /bins/{bin_id} ────────────────────────────────────────────────────────

@router.get("/{bin_id}", summary="Single bin details")
def get_bin(bin_id: str, current_user: TokenData = Depends(get_current_user)):
    bin_ = _require_bin(bin_id)
    logger.info("get_bin: %s fetched by %s", bin_id, current_user.user_id)
    return bin_


# ── GET /bins/{bin_id}/history ────────────────────────────────────────────────

@router.get("/{bin_id}/history", summary="Fill level history for a bin")
def bin_history(
    bin_id: str,
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history to return"),
    current_user: TokenData = Depends(get_current_user),
):
    _require_bin(bin_id)
    try:
        history = db.get_bin_history(bin_id, hours)
        logger.info("bin_history: %s, %dh, %d records", bin_id, hours, len(history))
        return {"bin_id": bin_id, "hours": hours, "count": len(history), "history": history}
    except Exception as e:
        logger.error("bin_history error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /bins/{bin_id}/prediction ─────────────────────────────────────────────

@router.get("/{bin_id}/prediction", summary="AI fill-level prediction for a bin")
def bin_prediction(bin_id: str, current_user: TokenData = Depends(get_current_user)):
    _require_bin(bin_id)
    try:
        # Return latest stored prediction first
        res = (
            supabase.table("predictions")
            .select("*")
            .eq("bin_id", bin_id)
            .order("predicted_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            logger.info("bin_prediction: returning stored prediction for %s", bin_id)
            return res.data[0]

        # Fall back to on-demand calculation
        history = db.get_bin_history(bin_id, hours=6)
        if len(history) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Insufficient history data for prediction (need ≥ 2 records in last 6h)",
            )
        history.sort(key=lambda r: r["recorded_at"])
        base_ts = datetime.fromisoformat(history[0]["recorded_at"].replace("Z", "+00:00")).timestamp()
        times = [
            datetime.fromisoformat(r["recorded_at"].replace("Z", "+00:00")).timestamp() - base_ts
            for r in history
        ]
        fills = [r["fill_level"] for r in history]
        pred_6h = _linear_predict(times, fills, 6)
        pred_12h = _linear_predict(times, fills, 12)
        priority = _priority(pred_6h, pred_12h)
        overflow_risk = pred_6h >= 90

        prediction = {
            "bin_id": bin_id,
            "current_fill": fills[-1],
            "predicted_fill_6hrs": pred_6h,
            "predicted_fill_12hrs": pred_12h,
            "overflow_risk": overflow_risk,
            "priority": priority,
            "confidence": 0.80,
            "recommended_action": "Schedule immediate collection" if overflow_risk else "Monitor",
            "model_version": "linear_v1",
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        }
        saved = db.save_prediction(prediction)
        logger.info("bin_prediction: on-demand prediction saved for %s, priority=%s", bin_id, priority)
        return saved
    except HTTPException:
        raise
    except Exception as e:
        logger.error("bin_prediction error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /bins/{bin_id}/collect ───────────────────────────────────────────────

@router.post("/{bin_id}/collect", summary="Record a bin collection (municipality only)")
def collect_bin(
    bin_id: str,
    payload: CollectBinIn,
    current_user: TokenData = Depends(require_municipality_role),
):
    bin_ = _require_bin(bin_id)
    try:
        now = datetime.now(timezone.utc).isoformat()
        event_id = f"EVT-{uuid.uuid4().hex[:10].upper()}"

        event = {
            "event_id": event_id,
            "bin_id": bin_id,
            "vehicle_id": payload.vehicle_id,
            "recycling_plant_id": payload.recycling_plant_id,
            "fill_before": bin_.get("fill_level", 0),
            "fill_after": 5,
            "waste_collected_kg": payload.waste_collected_kg,
            "waste_type": bin_.get("waste_type"),
            "is_compliant": payload.compliance_score >= 70,
            "compliance_score": payload.compliance_score,
            "notes": payload.notes,
            "collected_at": now,
        }
        saved_event = db.save_collection_event({k: v for k, v in event.items() if v is not None})

        # Reset bin fill level
        db.update_bin(bin_id, {"fill_level": 5, "last_collected": now})

        # Blockchain log
        tx_hash = _sha256({"event_id": event_id, "bin_id": bin_id, "ts": now})
        db.save_blockchain_log({
            "transaction_type": "collection_event",
            "related_id": saved_event["id"],
            "tx_hash": tx_hash,
            "status": "confirmed",
            "data": {"event_id": event_id, "bin_id": bin_id, "vehicle_id": payload.vehicle_id},
            "recorded_at": now,
        })

        # Compliance alert if needed
        if payload.compliance_score < 70:
            db.create_alert({
                "alert_type": "compliance_violation",
                "severity": "high",
                "title": f"Low compliance score on bin {bin_id}",
                "message": f"Score: {payload.compliance_score}/100 by vehicle {payload.vehicle_id}",
                "bin_id": bin_id,
                "vehicle_id": payload.vehicle_id,
            })

        logger.info("collect_bin: %s collected by vehicle %s, event=%s", bin_id, payload.vehicle_id, event_id)
        return {"event": saved_event, "blockchain_hash": tx_hash, "bin_reset_to": 5}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("collect_bin error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PUT /bins/{bin_id}/status ─────────────────────────────────────────────────

@router.put("/{bin_id}/status", summary="Update bin status/metadata (municipality only)")
def update_bin_status(
    bin_id: str,
    payload: BinStatusUpdate,
    current_user: TokenData = Depends(require_municipality_role),
):
    _require_bin(bin_id)
    try:
        updates = payload.model_dump(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update")
        updated = db.update_bin(bin_id, updates)
        logger.info("update_bin_status: %s updated fields=%s by %s", bin_id, list(updates.keys()), current_user.user_id)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_bin_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
