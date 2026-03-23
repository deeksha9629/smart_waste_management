import logging
import asyncio
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.auth.utils import decode_token
from app.auth.models import TokenData
from app.database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["WebSocket"])

MUNICIPALITY_ROLES = {"municipality_admin", "municipality_officer", "government_agency", "private_company"}
CITIZEN_ROLES = {"citizen", "community_group"}
RECYCLING_ROLES = {"recycling_manager", "recycling_operator"}


# ── Connection Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # role → list of (websocket, user_data)
        self._connections: dict[str, list[tuple[WebSocket, TokenData]]] = {
            "municipality": [],
            "citizen": [],
            "recycling": [],
        }

    def _role_group(self, role: str) -> str:
        if role in MUNICIPALITY_ROLES:
            return "municipality"
        if role in CITIZEN_ROLES:
            return "citizen"
        if role in RECYCLING_ROLES:
            return "recycling"
        return "municipality"  # default for government_agency / private_company

    async def connect(self, ws: WebSocket, user: TokenData):
        await ws.accept()
        group = self._role_group(user.role)
        self._connections[group].append((ws, user))
        logger.info("WS connect: user=%s role=%s group=%s", user.user_id, user.role, group)

    def disconnect(self, ws: WebSocket, user: TokenData):
        group = self._role_group(user.role)
        self._connections[group] = [
            (w, u) for w, u in self._connections[group] if w is not ws
        ]
        logger.info("WS disconnect: user=%s", user.user_id)

    async def _send(self, ws: WebSocket, message: dict) -> bool:
        try:
            await ws.send_json(message)
            return True
        except Exception:
            return False

    async def broadcast_to_group(self, group: str, message: dict):
        dead: list[tuple[WebSocket, TokenData]] = []
        for ws, user in self._connections.get(group, []):
            ok = await self._send(ws, message)
            if not ok:
                dead.append((ws, user))
        for ws, user in dead:
            self.disconnect(ws, user)

    async def broadcast_all(self, message: dict):
        for group in self._connections:
            await self.broadcast_to_group(group, message)

    def total_connections(self) -> dict:
        return {g: len(conns) for g, conns in self._connections.items()}


manager = ConnectionManager()


# ── Data builders per role ────────────────────────────────────────────────────

def _build_municipality_payload() -> dict:
    try:
        bins = db.get_all_bins()
        critical = [b for b in bins if b.get("fill_level", 0) >= 80]
        alerts = db.get_unresolved_alerts()
        vehicles = db.get_all_vehicles()
        return {
            "type": "municipality_update",
            "data": {
                "total_bins": len(bins),
                "critical_bins": len(critical),
                "unresolved_alerts": len(alerts),
                "active_vehicles": sum(1 for v in vehicles if v.get("status") == "collecting"),
                "critical_bin_ids": [b["bin_id"] for b in critical[:10]],
                "latest_alerts": alerts[:5],
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {"type": "error", "message": str(e)}


def _build_citizen_payload(user: TokenData) -> dict:
    try:
        wallet = db.get_citizen_tokens(user.user_id) or {"token_balance": 0}
        # Nearby bins (all bins — client filters by location)
        bins = db.get_all_bins()
        available = [
            {"bin_id": b["bin_id"], "fill_level": b.get("fill_level"), "waste_type": b.get("waste_type"),
             "location_lat": b.get("location_lat"), "location_lng": b.get("location_lng")}
            for b in bins if b.get("fill_level", 100) < 90
        ]
        return {
            "type": "citizen_update",
            "data": {
                "token_balance": wallet.get("token_balance", 0),
                "available_bins_count": len(available),
                "available_bins": available[:20],
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {"type": "error", "message": str(e)}


def _build_recycling_payload() -> dict:
    try:
        vehicles = db.get_all_vehicles()
        incoming = [v for v in vehicles if v.get("status") == "collecting"]
        plants = db.get_recycling_plants()
        capacity_alerts = [
            p for p in plants
            if p.get("capacity_kg_per_day") and p.get("current_load_kg") and
            float(p["current_load_kg"]) / float(p["capacity_kg_per_day"]) >= 0.85
        ]
        return {
            "type": "recycling_update",
            "data": {
                "incoming_vehicles": len(incoming),
                "vehicles": [
                    {"vehicle_id": v["vehicle_id"], "current_load_kg": v.get("current_load_kg"),
                     "current_lat": v.get("current_lat"), "current_lng": v.get("current_lng")}
                    for v in incoming
                ],
                "plants_near_capacity": len(capacity_alerts),
                "capacity_alerts": [p.get("plant_name") for p in capacity_alerts],
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {"type": "error", "message": str(e)}


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/live")
async def websocket_live(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None, description="JWT access token"),
):
    # Authenticate via query param token
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        user = decode_token(token)
    except Exception:
        await websocket.close(code=4003, reason="Invalid or expired token")
        return

    await manager.connect(websocket, user)

    # Send initial connection confirmation
    await websocket.send_json({
        "type": "connected",
        "user_id": user.user_id,
        "role": user.role,
        "message": "WebSocket connection established",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    try:
        while True:
            # Send role-specific live data every 10 seconds
            # Also listen for client messages (ping/location updates)
            try:
                # Non-blocking receive with timeout
                data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)

                # Handle client messages
                msg_type = data.get("type")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})

                elif msg_type == "request_update":
                    # Client explicitly requests a data push
                    if user.role in MUNICIPALITY_ROLES:
                        await websocket.send_json(_build_municipality_payload())
                    elif user.role in CITIZEN_ROLES:
                        await websocket.send_json(_build_citizen_payload(user))
                    elif user.role in RECYCLING_ROLES:
                        await websocket.send_json(_build_recycling_payload())

                elif msg_type == "location_update" and user.role in CITIZEN_ROLES:
                    # Citizen sends their location; respond with nearby bins
                    lat = data.get("lat")
                    lng = data.get("lng")
                    radius = data.get("radius_km", 2.0)
                    if lat and lng:
                        all_bins = db.get_all_bins()
                        nearby = []
                        for b in all_bins:
                            blat, blng = b.get("location_lat"), b.get("location_lng")
                            if blat and blng:
                                dist = _haversine(lat, lng, float(blat), float(blng))
                                if dist <= radius:
                                    nearby.append({**b, "distance_km": round(dist, 3)})
                        nearby.sort(key=lambda x: x["distance_km"])
                        await websocket.send_json({
                            "type": "nearby_bins",
                            "data": nearby[:15],
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })

            except asyncio.TimeoutError:
                # No message received in 10s — push live data
                if user.role in MUNICIPALITY_ROLES:
                    payload = _build_municipality_payload()
                elif user.role in CITIZEN_ROLES:
                    payload = _build_citizen_payload(user)
                elif user.role in RECYCLING_ROLES:
                    payload = _build_recycling_payload()
                else:
                    payload = {"type": "heartbeat", "timestamp": datetime.now(timezone.utc).isoformat()}

                await websocket.send_json(payload)

    except WebSocketDisconnect:
        manager.disconnect(websocket, user)
    except Exception as e:
        logger.error("WS error user=%s: %s", user.user_id, e)
        manager.disconnect(websocket, user)


# ── Broadcast helpers (called from agents/routers) ────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def broadcast_bin_update(bin_data: dict):
    """Push a bin update to municipality and citizen groups."""
    message = {
        "type": "bin_update",
        "data": bin_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast_to_group("municipality", message)
    await manager.broadcast_to_group("citizen", message)


async def broadcast_alert(alert_data: dict):
    """Push a new alert to municipality group."""
    message = {
        "type": "new_alert",
        "data": alert_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast_to_group("municipality", message)


async def broadcast_vehicle_update(vehicle_data: dict):
    """Push vehicle location/status to municipality and recycling groups."""
    message = {
        "type": "vehicle_update",
        "data": vehicle_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast_to_group("municipality", message)
    await manager.broadcast_to_group("recycling", message)


async def broadcast_intake(intake_data: dict):
    """Push new intake record to recycling group."""
    message = {
        "type": "new_intake",
        "data": intake_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast_to_group("recycling", message)
