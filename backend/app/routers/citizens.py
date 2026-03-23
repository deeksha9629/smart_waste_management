import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import get_current_user, require_citizen_role
from app.auth.models import TokenData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/citizens", tags=["Citizens"])

TOKENS_PER_KG: dict[str, int] = {
    "recyclable": 10,
    "organic": 5,
    "general": 2,
    "hazardous": 15,
    "electronic": 20,
}

REDEMPTION_OPTIONS: dict[str, int] = {
    "utility_discount_5": 500,
    "utility_discount_10": 900,
    "transit_pass_day": 200,
    "transit_pass_week": 1200,
    "grocery_voucher_10": 800,
    "tree_planting_donation": 100,
}


# ── Models ────────────────────────────────────────────────────────────────────

class RedeemIn(BaseModel):
    redemption_type: str
    amount: int


class WasteReportIn(BaseModel):
    report_type: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    address: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    bin_id: Optional[str] = None
    priority: str = "medium"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _get_wallet(user_id: str) -> dict:
    wallet = db.get_citizen_tokens(user_id)
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token wallet not found")
    return wallet


# ── GET /citizens/tokens ──────────────────────────────────────────────────────

@router.get("/tokens", summary="My token balance and stats (citizen only)")
def get_my_tokens(current_user: TokenData = Depends(require_citizen_role)):
    wallet = _get_wallet(current_user.user_id)
    logger.info("get_my_tokens: user=%s balance=%d", current_user.user_id, wallet.get("token_balance", 0))
    return wallet


# ── GET /citizens/history ─────────────────────────────────────────────────────

@router.get("/history", summary="My recycling transaction history (citizen only)")
def recycling_history(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: TokenData = Depends(require_citizen_role),
):
    try:
        res = (
            supabase.table("token_transactions")
            .select("*")
            .eq("user_id", current_user.user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        transactions = res.data or []
        logger.info("recycling_history: user=%s, %d records", current_user.user_id, len(transactions))
        return {"user_id": current_user.user_id, "count": len(transactions), "transactions": transactions}
    except Exception as e:
        logger.error("recycling_history error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /citizens/redeem ─────────────────────────────────────────────────────

@router.post("/redeem", summary="Redeem tokens for a reward (citizen only)")
def redeem_tokens(
    payload: RedeemIn,
    current_user: TokenData = Depends(require_citizen_role),
):
    if payload.redemption_type not in REDEMPTION_OPTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid redemption type. Options: {list(REDEMPTION_OPTIONS.keys())}",
        )

    required = REDEMPTION_OPTIONS[payload.redemption_type]
    if payload.amount != required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{payload.redemption_type}' costs {required} tokens",
        )

    wallet = _get_wallet(current_user.user_id)
    if wallet["token_balance"] < required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient tokens. Balance: {wallet['token_balance']}, required: {required}",
        )

    try:
        new_balance = wallet["token_balance"] - required
        db.update_citizen_tokens(current_user.user_id, {
            "token_balance": new_balance,
            "total_redeemed": wallet.get("total_redeemed", 0) + required,
        })
        tx = db.save_token_transaction({
            "user_id": current_user.user_id,
            "action": "redeemed",
            "amount": required,
            "balance_after": new_balance,
            "description": f"Redeemed: {payload.redemption_type}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("redeem_tokens: user=%s redeemed=%s tokens=%d", current_user.user_id, payload.redemption_type, required)
        return {
            "redemption_type": payload.redemption_type,
            "tokens_spent": required,
            "new_balance": new_balance,
            "transaction": tx,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("redeem_tokens error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /citizens/leaderboard ─────────────────────────────────────────────────

@router.get("/leaderboard", summary="Top recyclers leaderboard (public)")
def leaderboard(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        board = db.get_leaderboard(limit=limit)
        # Enrich with user names
        enriched = []
        for entry in board:
            user = db.get_user_by_id(entry["user_id"])
            enriched.append({
                **entry,
                "full_name": user["full_name"] if user else "Anonymous",
            })
        logger.info("leaderboard: returned %d entries", len(enriched))
        return {"count": len(enriched), "leaderboard": enriched}
    except Exception as e:
        logger.error("leaderboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /citizens/nearby-bins ─────────────────────────────────────────────────

@router.get("/nearby-bins", summary="Bins near a given location")
def nearby_bins(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_km: float = Query(default=2.0, ge=0.1, le=50.0, description="Search radius in km"),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        all_bins = db.get_all_bins()
        nearby = []
        for bin_ in all_bins:
            blat = bin_.get("location_lat")
            blng = bin_.get("location_lng")
            if blat is None or blng is None:
                continue
            dist = _haversine(lat, lng, float(blat), float(blng))
            if dist <= radius_km:
                nearby.append({**bin_, "distance_km": round(dist, 3)})

        nearby.sort(key=lambda b: b["distance_km"])
        logger.info("nearby_bins: lat=%s lng=%s radius=%skm found=%d", lat, lng, radius_km, len(nearby))
        return {
            "center": {"lat": lat, "lng": lng},
            "radius_km": radius_km,
            "count": len(nearby),
            "bins": nearby,
        }
    except Exception as e:
        logger.error("nearby_bins error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /citizens/report ─────────────────────────────────────────────────────

@router.post("/report", status_code=status.HTTP_201_CREATED, summary="Submit a waste issue report (citizen only)")
def submit_report(
    payload: WasteReportIn,
    current_user: TokenData = Depends(require_citizen_role),
):
    VALID_TYPES = {"illegal_dumping", "bin_overflow", "damaged_bin", "missed_collection", "general_complaint"}
    if payload.report_type not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report_type. Must be one of: {', '.join(VALID_TYPES)}",
        )
    try:
        report_data = payload.model_dump(exclude_none=True)
        report_data["report_id"] = f"RPT-{uuid.uuid4().hex[:8].upper()}"
        report_data["reported_by"] = current_user.user_id
        report_data["status"] = "pending"
        report_data["created_at"] = datetime.now(timezone.utc).isoformat()
        saved = db.create_waste_report(report_data)

        # Create alert for municipality
        try:
            db.create_alert({
                "alert_type": "citizen_report",
                "severity": "medium" if payload.priority == "medium" else ("high" if payload.priority == "high" else "low"),
                "title": f"Citizen Report: {payload.report_type.replace('_', ' ').title()}",
                "message": payload.description or f"{payload.report_type} reported by citizen",
                "bin_id": payload.bin_id,
            })
        except Exception:
            pass  # Alert creation failure should not block report submission

        # Award bonus tokens for reporting
        try:
            wallet = db.get_citizen_tokens(current_user.user_id) or {"token_balance": 0, "total_earned": 0}
            bonus = 5
            new_balance = wallet["token_balance"] + bonus
            db.update_citizen_tokens(current_user.user_id, {
                "token_balance": new_balance,
                "total_earned": wallet["total_earned"] + bonus,
            })
            db.save_token_transaction({
                "user_id": current_user.user_id,
                "action": "bonus",
                "amount": bonus,
                "balance_after": new_balance,
                "description": f"Bonus for submitting report {report_data['report_id']}",
            })
        except Exception:
            pass  # Token bonus failure should not block report submission

        logger.info("submit_report: %s by user=%s", report_data["report_id"], current_user.user_id)
        return saved
    except HTTPException:
        raise
    except Exception as e:
        logger.error("submit_report error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /citizens/my-reports ──────────────────────────────────────────────────

@router.get("/my-reports", summary="My submitted waste reports (citizen only)")
def my_reports(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: TokenData = Depends(require_citizen_role),
):
    try:
        query = (
            supabase.table("waste_reports")
            .select("*")
            .eq("reported_by", current_user.user_id)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        res = query.order("created_at", desc=True).execute()
        reports = res.data or []
        logger.info("my_reports: user=%s returned %d reports", current_user.user_id, len(reports))
        return {"user_id": current_user.user_id, "count": len(reports), "reports": reports}
    except Exception as e:
        logger.error("my_reports error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
