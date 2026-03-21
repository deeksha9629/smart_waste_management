import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.database import db, supabase
from app.auth.utils import require_municipality_role
from app.auth.models import TokenData
from app.agents.route_agent import _nearest_neighbour, _route_distance, AVG_SPEED_KMH, FUEL_COST_PER_KM
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/municipality", tags=["Municipality"])


# ── Models ────────────────────────────────────────────────────────────────────

class AlertIn(BaseModel):
    alert_type: str
    severity: str
    title: str
    message: str
    bin_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    plant_id: Optional[str] = None


class ReportStatusUpdate(BaseModel):
    status: str
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class DispatchIn(BaseModel):
    vehicle_id: str
    bin_ids: list[str]


# ── GET /municipality/dashboard ───────────────────────────────────────────────

@router.get("/dashboard", summary="Full municipality dashboard stats")
def dashboard(current_user: TokenData = Depends(require_municipality_role)):
    try:
        summary = db.get_dashboard_summary()

        # Enrich with today's collection count
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        collections_today = (
            supabase.table("collection_events")
            .select("id", count="exact")
            .gte("collected_at", today_start)
            .execute()
        )
        violations_today = (
            supabase.table("violations")
            .select("id", count="exact")
            .gte("recorded_at", today_start)
            .execute()
        )

        summary["collections_today"] = collections_today.count or 0
        summary["violations_today"] = violations_today.count or 0
        summary["generated_at"] = datetime.now(timezone.utc).isoformat()

        logger.info("dashboard: fetched by %s", current_user.user_id)
        return summary
    except Exception as e:
        logger.error("dashboard error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /municipality/alerts ──────────────────────────────────────────────────

@router.get("/alerts", summary="All unresolved alerts")
def all_alerts(
    severity: Optional[str] = Query(default=None, description="Filter by severity: low|medium|high|critical"),
    current_user: TokenData = Depends(require_municipality_role),
):
    try:
        query = supabase.table("alerts").select("*").eq("is_resolved", False)
        if severity:
            query = query.eq("severity", severity)
        res = query.order("created_at", desc=True).execute()
        alerts = res.data or []
        logger.info("all_alerts: %d unresolved (severity=%s)", len(alerts), severity)
        return {"count": len(alerts), "alerts": alerts}
    except Exception as e:
        logger.error("all_alerts error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /municipality/alerts ─────────────────────────────────────────────────

@router.post("/alerts", status_code=status.HTTP_201_CREATED, summary="Create a manual alert")
def create_alert(
    payload: AlertIn,
    current_user: TokenData = Depends(require_municipality_role),
):
    VALID_TYPES = {"bin_critical", "bin_overflow", "vehicle_breakdown", "illegal_dumping",
                   "compliance_violation", "sensor_failure", "plant_full", "collection_delayed"}
    VALID_SEVERITIES = {"low", "medium", "high", "critical"}

    if payload.alert_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid alert_type. Options: {VALID_TYPES}")
    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=400, detail=f"Invalid severity. Options: {VALID_SEVERITIES}")

    try:
        alert = db.create_alert(payload.model_dump(exclude_none=True))
        logger.info("create_alert: type=%s severity=%s by %s", payload.alert_type, payload.severity, current_user.user_id)
        return alert
    except Exception as e:
        logger.error("create_alert error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PUT /municipality/alerts/{id}/resolve ─────────────────────────────────────

@router.put("/alerts/{alert_id}/resolve", summary="Resolve an alert")
def resolve_alert(
    alert_id: str,
    current_user: TokenData = Depends(require_municipality_role),
):
    try:
        res = (
            supabase.table("alerts")
            .update({
                "is_resolved": True,
                "resolved_by": current_user.user_id,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", alert_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
        logger.info("resolve_alert: %s by %s", alert_id, current_user.user_id)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("resolve_alert error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /municipality/reports ─────────────────────────────────────────────────

@router.get("/reports", summary="All citizen waste reports")
def all_reports(
    report_status: Optional[str] = Query(default=None, alias="status"),
    report_type: Optional[str] = Query(default=None),
    current_user: TokenData = Depends(require_municipality_role),
):
    try:
        query = supabase.table("waste_reports").select("*")
        if report_status:
            query = query.eq("status", report_status)
        if report_type:
            query = query.eq("report_type", report_type)
        res = query.order("created_at", desc=True).execute()
        reports = res.data or []
        logger.info("all_reports: %d reports (status=%s)", len(reports), report_status)
        return {"count": len(reports), "reports": reports}
    except Exception as e:
        logger.error("all_reports error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── PUT /municipality/reports/{id}/status ─────────────────────────────────────

@router.put("/reports/{report_id}/status", summary="Update a citizen report status")
def update_report_status(
    report_id: str,
    payload: ReportStatusUpdate,
    current_user: TokenData = Depends(require_municipality_role),
):
    VALID_STATUSES = {"pending", "investigating", "resolved", "rejected"}
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Options: {VALID_STATUSES}")
    try:
        update_data: dict = {"status": payload.status}
        if payload.assigned_to:
            update_data["assigned_to"] = payload.assigned_to
        if payload.status == "resolved":
            update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table("waste_reports")
            .update(update_data)
            .eq("report_id", report_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        logger.info("update_report_status: %s → %s by %s", report_id, payload.status, current_user.user_id)
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_report_status error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /municipality/vehicles/all ────────────────────────────────────────────

@router.get("/vehicles/all", summary="Full fleet overview with live stats")
def fleet_overview(current_user: TokenData = Depends(require_municipality_role)):
    try:
        vehicles = db.get_all_vehicles()
        by_status: dict = {}
        total_load = 0.0
        total_capacity = 0.0
        for v in vehicles:
            s = v.get("status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
            total_load += float(v.get("current_load_kg") or 0)
            total_capacity += float(v.get("capacity_kg") or 5000)

        logger.info("fleet_overview: %d vehicles", len(vehicles))
        return {
            "total_vehicles": len(vehicles),
            "by_status": by_status,
            "fleet_load_pct": round(total_load / total_capacity * 100, 1) if total_capacity else 0,
            "vehicles": vehicles,
        }
    except Exception as e:
        logger.error("fleet_overview error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /municipality/compliance ──────────────────────────────────────────────

@router.get("/compliance", summary="Compliance report with violations summary")
def compliance_report(
    days: int = Query(default=7, ge=1, le=90, description="Number of days to look back"),
    current_user: TokenData = Depends(require_municipality_role),
):
    try:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        vio_res = (
            supabase.table("violations")
            .select("*")
            .gte("recorded_at", since)
            .execute()
        )
        violations = vio_res.data or []

        events_res = (
            supabase.table("collection_events")
            .select("id, compliance_score, is_compliant")
            .gte("collected_at", since)
            .execute()
        )
        events = events_res.data or []

        total_events = len(events)
        compliant = sum(1 for e in events if e.get("is_compliant"))
        avg_score = (
            sum(e.get("compliance_score", 100) for e in events) / total_events
            if total_events else 100
        )

        by_type: dict = {}
        total_penalty = 0.0
        for v in violations:
            vt = v.get("violation_type", "unknown")
            by_type[vt] = by_type.get(vt, 0) + 1
            total_penalty += float(v.get("penalty_amount") or 0)

        logger.info("compliance_report: %d violations in last %d days", len(violations), days)
        return {
            "period_days": days,
            "total_collection_events": total_events,
            "compliant_events": compliant,
            "compliance_rate_pct": round(compliant / total_events * 100, 1) if total_events else 100,
            "avg_compliance_score": round(avg_score, 1),
            "total_violations": len(violations),
            "total_penalty_usd": round(total_penalty, 2),
            "violations_by_type": by_type,
        }
    except Exception as e:
        logger.error("compliance_report error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /municipality/zones ───────────────────────────────────────────────────

@router.get("/zones", summary="Zone-level performance statistics")
def zone_stats(current_user: TokenData = Depends(require_municipality_role)):
    try:
        bins = db.get_all_bins()
        zones: dict = {}
        for b in bins:
            zone = b.get("zone") or "Unassigned"
            if zone not in zones:
                zones[zone] = {"zone": zone, "total_bins": 0, "critical_bins": 0, "avg_fill": 0.0, "fill_sum": 0}
            zones[zone]["total_bins"] += 1
            fill = b.get("fill_level", 0)
            zones[zone]["fill_sum"] += fill
            if fill >= 80:
                zones[zone]["critical_bins"] += 1

        result = []
        for z in zones.values():
            total = z["total_bins"]
            z["avg_fill"] = round(z["fill_sum"] / total, 1) if total else 0
            del z["fill_sum"]
            result.append(z)

        result.sort(key=lambda z: z["avg_fill"], reverse=True)
        logger.info("zone_stats: %d zones", len(result))
        return {"total_zones": len(result), "zones": result}
    except Exception as e:
        logger.error("zone_stats error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /municipality/dispatch ───────────────────────────────────────────────

@router.post("/dispatch", status_code=status.HTTP_201_CREATED, summary="Manually dispatch a vehicle to specific bins")
def dispatch_vehicle(
    payload: DispatchIn,
    current_user: TokenData = Depends(require_municipality_role),
):
    if not payload.bin_ids:
        raise HTTPException(status_code=400, detail="bin_ids list cannot be empty")
    try:
        # Fetch and validate bins
        bins = []
        for bid in payload.bin_ids:
            b = db.get_bin_by_id(bid)
            if not b:
                raise HTTPException(status_code=404, detail=f"Bin '{bid}' not found")
            bins.append(b)

        # Validate vehicle
        vehicles = db.get_all_vehicles()
        vehicle = next((v for v in vehicles if v["vehicle_id"] == payload.vehicle_id), None)
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Vehicle '{payload.vehicle_id}' not found")

        # Build optimised route
        ordered = _nearest_neighbour(bins)
        optimised_dist = _route_distance(ordered)
        traditional_dist = round(optimised_dist * 1.2, 2)

        route = {
            "route_id": f"RTE-{uuid.uuid4().hex[:8].upper()}",
            "vehicle_id": payload.vehicle_id,
            "total_bins": len(ordered),
            "total_distance_km": optimised_dist,
            "traditional_distance_km": traditional_dist,
            "distance_saved_km": round(traditional_dist - optimised_dist, 2),
            "estimated_duration_minutes": int((optimised_dist / AVG_SPEED_KMH) * 60),
            "fuel_cost": round(optimised_dist * FUEL_COST_PER_KM, 2),
            "fuel_saved": round((traditional_dist - optimised_dist) * FUEL_COST_PER_KM, 2),
            "route_data": {"bins": [b["bin_id"] for b in ordered]},
            "status": "active",
            "generated_by": f"manual_dispatch:{current_user.user_id}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        saved_route = db.save_route(route)

        # Mark vehicle as collecting
        db.update_vehicle(payload.vehicle_id, {"status": "collecting"})

        logger.info(
            "dispatch: vehicle=%s bins=%d route=%s by %s",
            payload.vehicle_id, len(bins), route["route_id"], current_user.user_id,
        )
        return {
            "message": f"Vehicle {payload.vehicle_id} dispatched to {len(bins)} bins",
            "route": saved_route,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("dispatch error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
