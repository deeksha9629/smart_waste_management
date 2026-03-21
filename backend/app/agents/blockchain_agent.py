"""
Agent 5 – Blockchain Agent
Hashes and immutably logs critical system events (collections,
violations, recycling intake) into blockchain_logs.
Runs every 10 minutes via APScheduler.
"""
import hashlib, json, uuid
from datetime import datetime, timezone, timedelta
from app.database import db, supabase


def _sha256(data: dict) -> str:
    return "0x" + hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _already_logged(related_id: str) -> bool:
    try:
        res = (
            supabase.table("blockchain_logs")
            .select("id")
            .eq("related_id", related_id)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


def _log(tx_type: str, related_id: str, data: dict):
    if _already_logged(related_id):
        return
    db.save_blockchain_log({
        "transaction_type": tx_type,
        "related_id": related_id,
        "tx_hash": _sha256({"type": tx_type, "id": related_id, "data": data}),
        "status": "confirmed",
        "data": data,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    })


def run_blockchain_agent():
    """Called by scheduler every 10 minutes."""
    try:
        since = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()

        # Log recent collection events
        events_res = (
            supabase.table("collection_events")
            .select("id, event_id, bin_id, vehicle_id, waste_collected_kg, collected_at")
            .gte("collected_at", since)
            .execute()
        )
        for e in (events_res.data or []):
            _log("collection_event", e["id"], e)

        # Log recent recycling intake
        intake_res = (
            supabase.table("recycling_intake")
            .select("id, intake_id, plant_id, waste_type, net_weight_kg, received_at")
            .gte("received_at", since)
            .execute()
        )
        for i in (intake_res.data or []):
            _log("recycling_intake", i["id"], i)

        # Log recent violations
        vio_res = (
            supabase.table("violations")
            .select("id, violation_id, vehicle_id, violation_type, penalty_amount, recorded_at")
            .gte("recorded_at", since)
            .execute()
        )
        for v in (vio_res.data or []):
            _log("violation", v["id"], v)

    except Exception as e:
        print(f"[Blockchain Agent] Error: {e}")
