"""
Agent 1 – IoT Simulator
Simulates smart bin sensor readings and writes them to bin_history.
Runs every 5 minutes via APScheduler.
"""
import random
from datetime import datetime, timezone
from app.database import db, supabase


FILL_RATE_BY_TYPE = {
    "general": (1, 4),
    "recyclable": (0.5, 2),
    "organic": (1, 5),
    "hazardous": (0.1, 0.5),
    "electronic": (0.05, 0.2),
}


def simulate_bin_update(bin_: dict) -> dict:
    waste_type = bin_.get("waste_type", "general")
    low, high = FILL_RATE_BY_TYPE.get(waste_type, (1, 3))
    delta = random.uniform(low, high)

    current_fill = bin_.get("fill_level", 0)
    new_fill = min(100, round(current_fill + delta, 1))

    capacity = bin_.get("capacity_kg", 100)
    new_weight = round(capacity * new_fill / 100, 2)

    battery = max(0, bin_.get("battery_level", 100) - random.uniform(0.01, 0.05))

    return {
        "fill_level": int(new_fill),
        "weight_kg": new_weight,
        "battery_level": int(battery),
    }


def run_iot_simulation():
    """Called by scheduler every 5 minutes."""
    try:
        bins = db.get_all_bins()
        for bin_ in bins:
            if bin_.get("sensor_status") != "active":
                continue

            updates = simulate_bin_update(bin_)
            db.update_bin(bin_["bin_id"], updates)

            # Write history record
            supabase.table("bin_history").insert({
                "bin_id": bin_["bin_id"],
                "fill_level": updates["fill_level"],
                "weight_kg": updates["weight_kg"],
                "battery_level": updates["battery_level"],
                "waste_type": bin_.get("waste_type"),
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

            # Raise alert if critical
            if updates["fill_level"] >= 90:
                db.create_alert({
                    "alert_type": "bin_critical",
                    "severity": "critical",
                    "title": f"Bin {bin_['bin_id']} critically full",
                    "message": f"Fill level reached {updates['fill_level']}%",
                    "bin_id": bin_["bin_id"],
                })
    except Exception as e:
        print(f"[IoT Agent] Error: {e}")
