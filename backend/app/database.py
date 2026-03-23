from supabase import create_client, Client
from app.config import settings
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

# ---------------------------------------------------------------------------
# Supabase client (service key bypasses RLS for backend operations)
# ---------------------------------------------------------------------------

supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_key,
)


# ---------------------------------------------------------------------------
# DatabaseService
# ---------------------------------------------------------------------------

class DatabaseService:

    # ── Bins ────────────────────────────────────────────────────────────────

    @staticmethod
    def get_all_bins() -> list[dict]:
        try:
            res = supabase.table("bins").select("*").execute()
            bins = res.data or []
            # Normalize field names for frontend compatibility
            for b in bins:
                if "sensor_battery" not in b:
                    b["sensor_battery"] = b.get("battery_level", 100)
                if "status" not in b:
                    b["status"] = b.get("sensor_status", "active")
            return bins
        except Exception as e:
            raise Exception(f"get_all_bins failed: {e}")

    @staticmethod
    def get_bin_by_id(bin_id: str) -> Optional[dict]:
        try:
            res = (
                supabase.table("bins")
                .select("*")
                .eq("bin_id", bin_id)
                .single()
                .execute()
            )
            return res.data
        except Exception:
            return None

    @staticmethod
    def get_bin_history(bin_id: str, hours: int = 24) -> list[dict]:
        try:
            since = (
                datetime.now(timezone.utc) - timedelta(hours=hours)
            ).isoformat()
            res = (
                supabase.table("bin_history")
                .select("*")
                .eq("bin_id", bin_id)
                .gte("recorded_at", since)
                .order("recorded_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            raise Exception(f"get_bin_history failed: {e}")

    @staticmethod
    def update_bin(bin_id: str, data: dict) -> Optional[dict]:
        try:
            data["last_updated"] = datetime.now(timezone.utc).isoformat()
            res = (
                supabase.table("bins")
                .update(data)
                .eq("bin_id", bin_id)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as e:
            raise Exception(f"update_bin failed: {e}")

    @staticmethod
    def get_bins_above_threshold(threshold: int) -> list[dict]:
        try:
            res = (
                supabase.table("bins")
                .select("*")
                .gte("fill_level", threshold)
                .execute()
            )
            bins = res.data or []
            for b in bins:
                if "sensor_battery" not in b:
                    b["sensor_battery"] = b.get("battery_level", 100)
                if "status" not in b:
                    b["status"] = b.get("sensor_status", "active")
            return bins
        except Exception as e:
            raise Exception(f"get_bins_above_threshold failed: {e}")

    # ── Vehicles ────────────────────────────────────────────────────────────

    @staticmethod
    def get_all_vehicles() -> list[dict]:
        try:
            res = supabase.table("vehicles").select("*").execute()
            return res.data or []
        except Exception as e:
            raise Exception(f"get_all_vehicles failed: {e}")

    @staticmethod
    def update_vehicle(vehicle_id: str, data: dict) -> Optional[dict]:
        try:
            data["last_updated"] = datetime.now(timezone.utc).isoformat()
            res = (
                supabase.table("vehicles")
                .update(data)
                .eq("vehicle_id", vehicle_id)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as e:
            raise Exception(f"update_vehicle failed: {e}")

    # ── Collection Events ───────────────────────────────────────────────────

    @staticmethod
    def save_collection_event(event: dict) -> dict:
        try:
            res = supabase.table("collection_events").insert(event).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"save_collection_event failed: {e}")

    # ── Predictions ─────────────────────────────────────────────────────────

    @staticmethod
    def save_prediction(prediction: dict) -> dict:
        try:
            res = supabase.table("predictions").insert(prediction).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"save_prediction failed: {e}")

    # ── Routes ──────────────────────────────────────────────────────────────

    @staticmethod
    def save_route(route: dict) -> dict:
        try:
            res = supabase.table("routes").insert(route).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"save_route failed: {e}")

    # ── Alerts ──────────────────────────────────────────────────────────────

    @staticmethod
    def create_alert(alert_data: dict) -> dict:
        try:
            res = supabase.table("alerts").insert(alert_data).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"create_alert failed: {e}")

    @staticmethod
    def get_unresolved_alerts() -> list[dict]:
        try:
            res = (
                supabase.table("alerts")
                .select("*")
                .eq("is_resolved", False)
                .order("created_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            raise Exception(f"get_unresolved_alerts failed: {e}")

    # ── Dashboard ───────────────────────────────────────────────────────────

    @staticmethod
    def get_dashboard_summary() -> dict:
        try:
            bins = supabase.table("bins").select("fill_level, sensor_status").execute()
            vehicles = supabase.table("vehicles").select("status").execute()
            alerts = (
                supabase.table("alerts")
                .select("severity")
                .eq("is_resolved", False)
                .execute()
            )
            plants = supabase.table("recycling_plants").select("status, current_load_kg, capacity_kg_per_day").execute()

            bin_data = bins.data or []
            vehicle_data = vehicles.data or []
            alert_data = alerts.data or []
            plant_data = plants.data or []

            critical_bins = [b for b in bin_data if b.get("fill_level", 0) >= 80]
            avg_fill = (
                sum(b.get("fill_level", 0) for b in bin_data) / len(bin_data)
                if bin_data else 0
            )

            return {
                "total_bins": len(bin_data),
                "critical_bins": len(critical_bins),
                "avg_fill_level": round(avg_fill, 1),
                "active_vehicles": sum(1 for v in vehicle_data if v.get("status") == "collecting"),
                "total_vehicles": len(vehicle_data),
                "unresolved_alerts": len(alert_data),
                "critical_alerts": sum(1 for a in alert_data if a.get("severity") == "critical"),
                "operational_plants": sum(1 for p in plant_data if p.get("status") == "operational"),
                "total_plants": len(plant_data),
            }
        except Exception as e:
            raise Exception(f"get_dashboard_summary failed: {e}")

    # ── Users ───────────────────────────────────────────────────────────────

    @staticmethod
    def get_user_by_email(email: str) -> Optional[dict]:
        try:
            res = (
                supabase.table("users")
                .select("*")
                .eq("email", email)
                .single()
                .execute()
            )
            return res.data
        except Exception:
            return None

    @staticmethod
    def create_user(user_data: dict) -> dict:
        try:
            res = supabase.table("users").insert(user_data).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"create_user failed: {e}")

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[dict]:
        try:
            res = (
                supabase.table("users")
                .select("*")
                .eq("id", user_id)
                .single()
                .execute()
            )
            return res.data
        except Exception:
            return None

    @staticmethod
    def update_user(user_id: str, data: dict) -> Optional[dict]:
        try:
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            res = (
                supabase.table("users")
                .update(data)
                .eq("id", user_id)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as e:
            raise Exception(f"update_user failed: {e}")

    # ── Recycling Plants ────────────────────────────────────────────────────

    @staticmethod
    def get_recycling_plants() -> list[dict]:
        try:
            res = supabase.table("recycling_plants").select("*").execute()
            return res.data or []
        except Exception as e:
            raise Exception(f"get_recycling_plants failed: {e}")

    @staticmethod
    def get_plant_by_id(plant_id: str) -> Optional[dict]:
        try:
            res = (
                supabase.table("recycling_plants")
                .select("*")
                .eq("id", plant_id)
                .single()
                .execute()
            )
            return res.data
        except Exception:
            return None

    @staticmethod
    def save_recycling_intake(intake_data: dict) -> dict:
        try:
            res = supabase.table("recycling_intake").insert(intake_data).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"save_recycling_intake failed: {e}")

    # ── Citizen Tokens ──────────────────────────────────────────────────────

    @staticmethod
    def get_citizen_tokens(user_id: str) -> Optional[dict]:
        try:
            res = (
                supabase.table("citizen_tokens")
                .select("*")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            return res.data
        except Exception:
            return None

    @staticmethod
    def update_citizen_tokens(user_id: str, data: dict) -> Optional[dict]:
        try:
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            existing = DatabaseService.get_citizen_tokens(user_id)
            if existing:
                res = (
                    supabase.table("citizen_tokens")
                    .update(data)
                    .eq("user_id", user_id)
                    .execute()
                )
            else:
                data["user_id"] = user_id
                res = supabase.table("citizen_tokens").insert(data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            raise Exception(f"update_citizen_tokens failed: {e}")

    @staticmethod
    def save_token_transaction(tx_data: dict) -> dict:
        try:
            res = supabase.table("token_transactions").insert(tx_data).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"save_token_transaction failed: {e}")

    @staticmethod
    def get_leaderboard(limit: int = 10) -> list[dict]:
        try:
            res = (
                supabase.table("citizen_tokens")
                .select("user_id, token_balance, total_earned, recycling_count, streak_days")
                .order("token_balance", desc=True)
                .limit(limit)
                .execute()
            )
            return res.data or []
        except Exception as e:
            raise Exception(f"get_leaderboard failed: {e}")

    # ── Waste Reports ───────────────────────────────────────────────────────

    @staticmethod
    def get_waste_reports(status: Optional[str] = None) -> list[dict]:
        try:
            query = supabase.table("waste_reports").select("*")
            if status:
                query = query.eq("status", status)
            res = query.order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            raise Exception(f"get_waste_reports failed: {e}")

    @staticmethod
    def create_waste_report(report_data: dict) -> dict:
        try:
            res = supabase.table("waste_reports").insert(report_data).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"create_waste_report failed: {e}")

    # ── Blockchain Logs ─────────────────────────────────────────────────────

    @staticmethod
    def save_blockchain_log(log_data: dict) -> dict:
        try:
            res = supabase.table("blockchain_logs").insert(log_data).execute()
            return res.data[0]
        except Exception as e:
            raise Exception(f"save_blockchain_log failed: {e}")


# Singleton instance
db = DatabaseService()
