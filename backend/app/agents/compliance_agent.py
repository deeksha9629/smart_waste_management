"""
Agent 4 – Compliance Agent
Audits recent collection events for compliance violations and
writes records to the violations table.
Runs every 60 minutes via APScheduler.
"""
import uuid, hashlib, json
from datetime import datetime, timezone, timedelta
from app.database import db, supabase

PENALTY_TABLE = {
    "wrong_waste_type": 50.0,
    "incomplete_collection": 25.0,
    "low_compliance_score": 30.0,
    "overloaded_vehicle": 75.0,
}


def _hash(data: dict) -> str:
    return "0x" + hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _check_event(event: dict, vehicle: dict | None) -> list[str]:
    failed = []
    if event.get("compliance_score", 100) < 70:
        failed.append("low_compliance_score")
    if event.get("waste_type") and event.get("fill_before", 0) == 0:
        failed.append("incomplete_collection")
    if vehicle and vehicle.get("current_load_kg", 0) > vehicle.get("capacity_kg", 5000):
        failed.append("overloaded_vehicle")
    return failed


def run_compliance_agent():
    """Called by scheduler every 60 minutes."""
    try:
        since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        res = (
            supabase.table("collection_events")
            .select("*")
            .gte("collected_at", since)
            .execute()
        )
        events = res.data or []

        vehicles_list = db.get_all_vehicles()
        vehicles = {v["vehicle_id"]: v for v in vehicles_list}

        for event in events:
            vehicle = vehicles.get(event.get("vehicle_id"))
            failed_checks = _check_event(event, vehicle)

            if not failed_checks:
                continue

            penalty = sum(PENALTY_TABLE.get(c, 0) for c in failed_checks)
            violation_data = {
                "violation_id": f"VIO-{uuid.uuid4().hex[:8].upper()}",
                "collection_event_id": event["id"],
                "vehicle_id": event.get("vehicle_id"),
                "violation_type": ", ".join(failed_checks),
                "failed_checks": failed_checks,
                "penalty_amount": penalty,
                "penalty_applied": False,
                "blockchain_hash": _hash({"event_id": event["id"], "checks": failed_checks}),
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("violations").insert(violation_data).execute()

            db.create_alert({
                "alert_type": "compliance_violation",
                "severity": "high",
                "title": f"Compliance violation – vehicle {event.get('vehicle_id')}",
                "message": f"Failed checks: {', '.join(failed_checks)}. Penalty: ₹{penalty}",
                "vehicle_id": event.get("vehicle_id"),
            })
    except Exception as e:
        print(f"[Compliance Agent] Error: {e}")
