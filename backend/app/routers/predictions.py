import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_municipality_role
from app.auth.models import TokenData
from app.agents.prediction_agent import run_prediction_agent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predictions", tags=["Predictions"])


# ── Models ────────────────────────────────────────────────────────────────────

class TrainResponse(BaseModel):
    message: str
    bins_processed: int
    triggered_at: str


# ── GET /predictions/ ─────────────────────────────────────────────────────────

@router.get("/", summary="Latest prediction for every bin")
def all_predictions(current_user: TokenData = Depends(get_current_user)):
    try:
        # One prediction per bin – latest only, using a window via subquery approach
        # Supabase doesn't support DISTINCT ON via the client, so we fetch recent and deduplicate in Python
        res = (
            supabase.table("predictions")
            .select("*")
            .order("predicted_at", desc=True)
            .limit(500)
            .execute()
        )
        rows = res.data or []

        # Deduplicate: keep only the most recent prediction per bin
        seen: set[str] = set()
        latest: list[dict] = []
        for row in rows:
            bid = row.get("bin_id")
            if bid not in seen:
                seen.add(bid)
                latest.append(row)

        logger.info("all_predictions: %d unique bins", len(latest))
        return {"count": len(latest), "predictions": latest}
    except Exception as e:
        logger.error("all_predictions error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /predictions/critical ─────────────────────────────────────────────────

@router.get("/critical", summary="Predictions with overflow risk only")
def critical_predictions(current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("predictions")
            .select("*")
            .eq("overflow_risk", True)
            .order("predicted_at", desc=True)
            .limit(200)
            .execute()
        )
        rows = res.data or []

        # Deduplicate per bin
        seen: set[str] = set()
        critical: list[dict] = []
        for row in rows:
            bid = row.get("bin_id")
            if bid not in seen:
                seen.add(bid)
                critical.append(row)

        logger.info("critical_predictions: %d bins at overflow risk", len(critical))
        return {"count": len(critical), "predictions": critical}
    except Exception as e:
        logger.error("critical_predictions error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /predictions/{bin_id} ─────────────────────────────────────────────────

@router.get("/{bin_id}", summary="Latest prediction for a specific bin")
def prediction_for_bin(bin_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("predictions")
            .select("*")
            .eq("bin_id", bin_id)
            .order("predicted_at", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No prediction found for bin '{bin_id}'",
            )
        logger.info("prediction_for_bin: %s", bin_id)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("prediction_for_bin error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /predictions/train ───────────────────────────────────────────────────

@router.post("/train", summary="Retrain / re-run prediction agent on all bins (municipality only)")
def retrain_model(current_user: TokenData = Depends(require_municipality_role)):
    try:
        bins_before = len(db.get_all_bins())
        run_prediction_agent()
        triggered_at = datetime.now(timezone.utc).isoformat()
        logger.info("retrain_model: triggered by %s, bins=%d", current_user.user_id, bins_before)
        return TrainResponse(
            message="Prediction agent executed successfully. New predictions saved for all bins with sufficient history.",
            bins_processed=bins_before,
            triggered_at=triggered_at,
        )
    except Exception as e:
        logger.error("retrain_model error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /predictions/accuracy ─────────────────────────────────────────────────

@router.get("/accuracy", summary="Model accuracy statistics based on verified predictions")
def model_accuracy(current_user: TokenData = Depends(get_current_user)):
    try:
        # Fetch predictions that have been verified (actual_fill_6hrs recorded)
        res = (
            supabase.table("predictions")
            .select("predicted_fill_6hrs, actual_fill_6hrs, was_accurate, priority, model_version")
            .not_.is_("actual_fill_6hrs", "null")
            .execute()
        )
        rows = res.data or []

        if not rows:
            return {
                "message": "No verified predictions available yet",
                "total_verified": 0,
                "accuracy_rate": None,
            }

        total = len(rows)
        accurate = sum(1 for r in rows if r.get("was_accurate") is True)
        errors = [
            abs((r.get("predicted_fill_6hrs") or 0) - (r.get("actual_fill_6hrs") or 0))
            for r in rows
            if r.get("predicted_fill_6hrs") is not None and r.get("actual_fill_6hrs") is not None
        ]
        mae = round(sum(errors) / len(errors), 2) if errors else None

        by_priority: dict = {}
        for r in rows:
            p = r.get("priority", "UNKNOWN")
            by_priority.setdefault(p, {"total": 0, "accurate": 0})
            by_priority[p]["total"] += 1
            if r.get("was_accurate"):
                by_priority[p]["accurate"] += 1

        logger.info("model_accuracy: total=%d accurate=%d", total, accurate)
        return {
            "total_verified": total,
            "accurate_predictions": accurate,
            "accuracy_rate": round(accurate / total * 100, 1),
            "mean_absolute_error_pct": mae,
            "by_priority": by_priority,
            "model_version": rows[0].get("model_version") if rows else None,
        }
    except Exception as e:
        logger.error("model_accuracy error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
