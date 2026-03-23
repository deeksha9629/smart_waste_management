"""
Agent 2 – Prediction Agent
Uses linear regression on bin_history to predict fill levels at +6h and +12h.
Runs every 15 minutes via APScheduler.
"""
import numpy as np
from datetime import datetime, timezone
from app.database import db


def _linear_predict(times: list[float], fills: list[int], hours_ahead: float) -> int:
    if len(times) < 2:
        return fills[-1] if fills else 0
    x = np.array(times).reshape(-1, 1)
    y = np.array(fills, dtype=float)
    # Simple least-squares slope
    x_mean, y_mean = x.mean(), y.mean()
    slope = float(np.sum((x - x_mean) * (y - y_mean)) / (np.sum((x - x_mean) ** 2) + 1e-9))
    intercept = y_mean - slope * x_mean
    future_time = times[-1] + hours_ahead * 3600
    predicted = slope * future_time + intercept
    return max(0, min(100, int(predicted)))


def _priority(fill_6h: int, fill_12h: int) -> str:
    peak = max(fill_6h, fill_12h)
    if peak >= 90:
        return "CRITICAL"
    if peak >= 75:
        return "HIGH"
    if peak >= 50:
        return "MEDIUM"
    return "LOW"


def run_prediction_agent():
    """Called by scheduler every 15 minutes."""
    try:
        bins = db.get_all_bins()
        for bin_ in bins:
            current_fill = bin_.get("fill_level", 0)
            history = db.get_bin_history(bin_["bin_id"], hours=6)

            if len(history) >= 2:
                history.sort(key=lambda r: r["recorded_at"])
                base_ts = datetime.fromisoformat(history[0]["recorded_at"].replace("Z", "+00:00")).timestamp()
                times = [
                    datetime.fromisoformat(r["recorded_at"].replace("Z", "+00:00")).timestamp() - base_ts
                    for r in history
                ]
                fills = [r["fill_level"] for r in history]
                pred_6h = _linear_predict(times, fills, 6)
                pred_12h = _linear_predict(times, fills, 12)
                confidence = 0.80
            else:
                # Fallback: assume ~3% fill growth per hour
                growth_rate = 3
                pred_6h  = min(100, current_fill + growth_rate * 6)
                pred_12h = min(100, current_fill + growth_rate * 12)
                confidence = 0.50

            priority = _priority(pred_6h, pred_12h)
            overflow_risk = pred_6h >= 90

            db.save_prediction({
                "bin_id": bin_["bin_id"],
                "current_fill": current_fill,
                "predicted_fill_6hrs": pred_6h,
                "predicted_fill_12hrs": pred_12h,
                "overflow_risk": overflow_risk,
                "priority": priority,
                "confidence": confidence,
                "recommended_action": "Schedule immediate collection" if overflow_risk else "Monitor",
                "model_version": "linear_v1",
                "predicted_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        print(f"[Prediction Agent] Error: {e}")
