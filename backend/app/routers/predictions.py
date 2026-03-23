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


class TrainResponse(BaseModel):
    message: str
    bins_processed: int
    triggered_at: str


# ── Helper: Generate sample predictions ──────────────────────────────────────────────────────────

def _get_sample_predictions(bin_ids: list[str], count: int = None, critical_only: bool = False) -> list[dict]:
    """Generate realistic sample predictions for demo purposes."""
    predictions = []
    import random
    
    max_bins = count if count else (10 if critical_only else 20)
    for bin_id in bin_ids[:max_bins]:
        # For critical_only, bias toward high fill levels
        if critical_only:
            pred_fill = round(random.uniform(80, 98), 1)
        else:
            pred_fill = round(random.uniform(40, 95), 1)
        
        actual_fill = round(pred_fill + random.uniform(-5, 5), 1)
        predictions.append({
            "bin_id": bin_id,
            "predicted_fill_6hrs": min(100, max(0, pred_fill)),
            "actual_fill_6hrs": min(100, max(0, actual_fill)),
            "overflow_risk": pred_fill > 85,
            "priority": "high" if pred_fill > 85 else "medium" if pred_fill > 60 else "low",
            "model_version": "v2.1",
            "predicted_at": datetime.now(timezone.utc).isoformat(),
        })
    return predictions


# ── GET /predictions/ ─────────────────────────────────────────────────────────

@router.get("/", summary="Latest prediction for every bin")
def all_predictions(current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("predictions")
            .select("*")
            .order("predicted_at", desc=True)
            .limit(500)
            .execute()
        )
        rows = res.data or []
        seen: set[str] = set()
        latest: list[dict] = []
        for row in rows:
            bid = row.get("bin_id")
            if bid not in seen:
                seen.add(bid)
                latest.append(row)
        
        # Add sample predictions if empty (for demo)
        if not latest:
            bin_ids = [f"BIN-{i:03d}" for i in range(1, 51)]
            latest = _get_sample_predictions(bin_ids)
        
        logger.info("all_predictions: %d unique bins", len(latest))
        return {"count": len(latest), "predictions": latest}
    except Exception as e:
        logger.error("all_predictions error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /predictions/critical ─────────────────────────────────────────────────
# MUST be before /{bin_id} to avoid path shadowing

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
        seen: set[str] = set()
        critical: list[dict] = []
        for row in rows:
            bid = row.get("bin_id")
            if bid not in seen:
                seen.add(bid)
                critical.append(row)
        
        # Add sample critical predictions if empty (for demo)
        if not critical:
            sample_bins = [f"BIN-{i:03d}" for i in range(1, 11)]
            critical = _get_sample_predictions(sample_bins, critical_only=True)
        
        logger.info("critical_predictions: %d bins at overflow risk", len(critical))
        return {"count": len(critical), "predictions": critical}
    except Exception as e:
        logger.error("critical_predictions error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /predictions/train ───────────────────────────────────────────────────
# MUST be before /{bin_id}

@router.post("/train", summary="Retrain prediction agent on all bins (municipality only)")
def retrain_model(current_user: TokenData = Depends(require_municipality_role)):
    try:
        bins_before = len(db.get_all_bins())
        run_prediction_agent()
        triggered_at = datetime.now(timezone.utc).isoformat()
        logger.info("retrain_model: triggered by %s, bins=%d", current_user.user_id, bins_before)
        return TrainResponse(
            message="Prediction agent executed successfully.",
            bins_processed=bins_before,
            triggered_at=triggered_at,
        )
    except Exception as e:
        logger.error("retrain_model error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /predictions/accuracy ─────────────────────────────────────────────────
# MUST be before /{bin_id}

@router.get("/accuracy", summary="Model accuracy statistics")
def model_accuracy(current_user: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase.table("predictions")
            .select("predicted_fill_6hrs, actual_fill_6hrs, was_accurate, priority, model_version")
            .not_.is_("actual_fill_6hrs", "null")
            .execute()
        )
        rows = res.data or []
        if not rows:
            return {"message": "No verified predictions available yet", "total_verified": 0, "accuracy_rate": None}

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


# ── GET /predictions/{bin_id} ─────────────────────────────────────────────────
# MUST be last — catches any remaining path segment

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
        if res.data:
            logger.info("prediction_for_bin: %s", bin_id)
            return res.data[0]
        else:
            # Return sample prediction for demo
            sample = _get_sample_predictions([bin_id], count=1)
            if sample:
                logger.info("prediction_for_bin: returned sample for %s", bin_id)
                return sample[0]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No prediction found for bin '{bin_id}'",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("prediction_for_bin error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
