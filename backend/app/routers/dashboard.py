import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.database import db, supabase
from app.auth.utils import get_current_user, require_municipality_role, require_citizen_role, require_recycling_role
from app.auth.models import TokenData

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ── GET /dashboard/municipality ───────────────────────────────────────────────

@router.get("/municipality", summary="Full municipality command-center dashboard")
def municipality_dashboard(current_user: TokenData = Depends(require_municipality_role)):
    try:
        summary = db.get_dashboard_summary()
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        # Bin fill distribution
        bins = db.get_all_bins()
        fill_buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
        by_zone: dict = {}
        by_waste_type: dict = {}
        for b in bins:
            fill = b.get("fill_level", 0)
            if fill <= 25:
                fill_buckets["0-25"] += 1
            elif fill <= 50:
                fill_buckets["26-50"] += 1
            elif fill <= 75:
                fill_buckets["51-75"] += 1
            else:
                fill_buckets["76-100"] += 1
            zone = b.get("zone") or "Unassigned"
            by_zone[zone] = by_zone.get(zone, 0) + 1
            wt = b.get("waste_type") or "unknown"
            by_waste_type[wt] = by_waste_type.get(wt, 0) + 1

        # Vehicle status breakdown
        vehicles = db.get_all_vehicles()
        vehicle_status: dict = {}
        for v in vehicles:
            s = v.get("status", "unknown")
            vehicle_status[s] = vehicle_status.get(s, 0) + 1

        # Today's collections
        col_res = (
            supabase.table("collection_events")
            .select("id, compliance_score, waste_collected_kg")
            .gte("collected_at", today_start)
            .execute()
        )
        collections_today = col_res.data or []
        total_waste_today = sum(float(c.get("waste_collected_kg") or 0) for c in collections_today)
        avg_compliance = (
            sum(c.get("compliance_score", 100) for c in collections_today) / len(collections_today)
            if collections_today else 100
        )

        # Active routes
        route_res = (
            supabase.table("routes")
            .select("id, status")
            .in_("status", ["pending", "active"])
            .execute()
        )
        active_routes = len(route_res.data or [])

        logger.info("municipality_dashboard: fetched by %s", current_user.user_id)
        return {
            **summary,
            "bins_by_fill": fill_buckets,
            "bins_by_zone": by_zone,
            "bins_by_waste_type": by_waste_type,
            "vehicles_by_status": vehicle_status,
            "collections_today": len(collections_today),
            "waste_collected_today_kg": round(total_waste_today, 2),
            "avg_compliance_score": round(avg_compliance, 1),
            "active_routes": active_routes,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("municipality_dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /dashboard/citizen ────────────────────────────────────────────────────

@router.get("/citizen", summary="Personal citizen dashboard")
def citizen_dashboard(current_user: TokenData = Depends(require_citizen_role)):
    try:
        wallet = db.get_citizen_tokens(current_user.user_id) or {
            "token_balance": 0, "total_earned": 0, "total_redeemed": 0,
            "recycling_count": 0, "total_waste_kg": 0, "streak_days": 0,
        }

        # Recent transactions
        tx_res = (
            supabase.table("token_transactions")
            .select("*")
            .eq("user_id", current_user.user_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        recent_transactions = tx_res.data or []

        # My reports summary
        reports_res = (
            supabase.table("waste_reports")
            .select("status")
            .eq("reported_by", current_user.user_id)
            .execute()
        )
        reports = reports_res.data or []
        reports_by_status: dict = {}
        for r in reports:
            s = r.get("status", "unknown")
            reports_by_status[s] = reports_by_status.get(s, 0) + 1

        # Leaderboard rank
        leaderboard = db.get_leaderboard(limit=100)
        rank = next(
            (i + 1 for i, entry in enumerate(leaderboard) if entry.get("user_id") == current_user.user_id),
            None,
        )

        logger.info("citizen_dashboard: user=%s balance=%d", current_user.user_id, wallet.get("token_balance", 0))
        return {
            "user_id": current_user.user_id,
            "wallet": wallet,
            "leaderboard_rank": rank,
            "recent_transactions": recent_transactions,
            "reports_submitted": len(reports),
            "reports_by_status": reports_by_status,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("citizen_dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /dashboard/recycling ──────────────────────────────────────────────────

@router.get("/recycling", summary="Recycling plant portal dashboard")
def recycling_dashboard(current_user: TokenData = Depends(require_recycling_role)):
    try:
        plants = db.get_recycling_plants()
        since_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        intake_res = (
            supabase.table("recycling_intake")
            .select("waste_type, net_weight_kg, processing_status, quality_grade, received_at")
            .gte("received_at", since_7d)
            .execute()
        )
        intake = intake_res.data or []

        total_weight = sum(float(r.get("net_weight_kg") or 0) for r in intake)
        by_type: dict = {}
        by_status: dict = {}
        by_grade: dict = {}
        for r in intake:
            wt = r.get("waste_type", "unknown")
            by_type[wt] = round(by_type.get(wt, 0) + float(r.get("net_weight_kg") or 0), 2)
            ps = r.get("processing_status", "unknown")
            by_status[ps] = by_status.get(ps, 0) + 1
            g = r.get("quality_grade", "unknown")
            by_grade[g] = by_grade.get(g, 0) + 1

        # Capacity overview
        capacity_summary = []
        for p in plants:
            cap = float(p.get("capacity_kg_per_day") or 0)
            load = float(p.get("current_load_kg") or 0)
            capacity_summary.append({
                "plant_name": p.get("plant_name"),
                "utilisation_pct": round(load / cap * 100, 1) if cap > 0 else 0,
                "status": p.get("status"),
            })

        logger.info("recycling_dashboard: user=%s", current_user.user_id)
        return {
            "total_plants": len(plants),
            "period_days": 7,
            "total_intake_records": len(intake),
            "total_weight_processed_kg": round(total_weight, 2),
            "by_waste_type_kg": by_type,
            "by_processing_status": by_status,
            "by_quality_grade": by_grade,
            "plant_capacity_overview": capacity_summary,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("recycling_dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /dashboard/public ─────────────────────────────────────────────────────

@router.get("/public", summary="Public city waste stats — no authentication required")
def public_dashboard():
    try:
        bins = db.get_all_bins()
        total_bins = len(bins)
        critical_bins = sum(1 for b in bins if b.get("fill_level", 0) >= 80)
        avg_fill = round(sum(b.get("fill_level", 0) for b in bins) / total_bins, 1) if total_bins else 0

        # Leaderboard top 5
        top_recyclers = db.get_leaderboard(limit=5)
        enriched_leaders = []
        for entry in top_recyclers:
            user = db.get_user_by_id(entry["user_id"])
            enriched_leaders.append({
                "full_name": user["full_name"] if user else "Anonymous",
                "token_balance": entry.get("token_balance", 0),
                "recycling_count": entry.get("recycling_count", 0),
            })

        # Total waste collected (all time)
        col_res = supabase.table("collection_events").select("waste_collected_kg").execute()
        total_waste = sum(float(c.get("waste_collected_kg") or 0) for c in (col_res.data or []))

        logger.info("public_dashboard: served")
        return {
            "city_stats": {
                "total_smart_bins": total_bins,
                "bins_needing_collection": critical_bins,
                "avg_fill_level_pct": avg_fill,
                "total_waste_collected_kg": round(total_waste, 2),
            },
            "top_recyclers": enriched_leaders,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("public_dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
