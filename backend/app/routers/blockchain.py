import logging
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import db, supabase
from app.auth.utils import get_current_user
from app.auth.models import TokenData
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sha256(data: dict) -> str:
    return "0x" + hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


# ── GET /blockchain/transactions ──────────────────────────────────────────────

@router.get("/transactions", summary="Recent blockchain transactions")
def recent_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    tx_type: Optional[str] = Query(default=None, description="Filter by transaction_type"),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        query = supabase.table("blockchain_logs").select("*")
        if tx_type:
            query = query.eq("transaction_type", tx_type)
        res = query.order("recorded_at", desc=True).limit(limit).execute()
        records = res.data or []
        logger.info("recent_transactions: %d records (type=%s)", len(records), tx_type)
        return {"count": len(records), "transactions": records}
    except Exception as e:
        logger.error("recent_transactions error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /blockchain/stats ─────────────────────────────────────────────────────

@router.get("/stats", summary="Blockchain system statistics")
def blockchain_stats(current_user: TokenData = Depends(get_current_user)):
    try:
        res = supabase.table("blockchain_logs").select("transaction_type, status, recorded_at").execute()
        records = res.data or []

        by_type: dict = {}
        by_status: dict = {}
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        today_count = 0

        for r in records:
            t = r.get("transaction_type", "unknown")
            by_type[t] = by_type.get(t, 0) + 1
            s = r.get("status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
            if r.get("recorded_at", "") >= today_start:
                today_count += 1

        logger.info("blockchain_stats: total=%d", len(records))
        return {
            "total_transactions": len(records),
            "transactions_today": today_count,
            "by_type": by_type,
            "by_status": by_status,
            "network": "Ganache (local)" if "127.0.0.1" in settings.blockchain_rpc_url else settings.blockchain_rpc_url,
            "contract_address": settings.contract_address or "Not configured",
        }
    except Exception as e:
        logger.error("blockchain_stats error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /blockchain/bin/{bin_id} ──────────────────────────────────────────────

@router.get("/bin/{bin_id}", summary="Blockchain history for a specific bin")
def bin_blockchain_history(
    bin_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        # Collection events for this bin that have blockchain logs
        events_res = (
            supabase.table("collection_events")
            .select("id, event_id, collected_at, vehicle_id, waste_collected_kg")
            .eq("bin_id", bin_id)
            .order("collected_at", desc=True)
            .limit(limit)
            .execute()
        )
        events = events_res.data or []
        event_ids = [e["id"] for e in events]

        logs = []
        for eid in event_ids:
            log_res = (
                supabase.table("blockchain_logs")
                .select("*")
                .eq("related_id", eid)
                .execute()
            )
            if log_res.data:
                logs.extend(log_res.data)

        logger.info("bin_blockchain_history: bin=%s, %d logs", bin_id, len(logs))
        return {"bin_id": bin_id, "count": len(logs), "records": logs}
    except Exception as e:
        logger.error("bin_blockchain_history error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /blockchain/citizen/{user_id} ─────────────────────────────────────────

@router.get("/citizen/{user_id}", summary="Blockchain token transaction history for a citizen")
def citizen_token_history(
    user_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
):
    # Citizens can only view their own history; municipality/recycling can view any
    if current_user.role == "citizen" and current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens can only view their own token history",
        )
    try:
        res = (
            supabase.table("token_transactions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        transactions = res.data or []

        # Enrich with blockchain hashes where available
        enriched = []
        for tx in transactions:
            bh = tx.get("blockchain_hash")
            chain_record = None
            if bh:
                log_res = (
                    supabase.table("blockchain_logs")
                    .select("tx_hash, status, recorded_at")
                    .eq("tx_hash", bh)
                    .execute()
                )
                chain_record = log_res.data[0] if log_res.data else None
            enriched.append({**tx, "chain_record": chain_record})

        logger.info("citizen_token_history: user=%s, %d transactions", user_id, len(enriched))
        return {"user_id": user_id, "count": len(enriched), "transactions": enriched}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("citizen_token_history error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /blockchain/verify/{event_id} ───────────────────────────────────────

@router.post("/verify/{event_id}", summary="Verify a collection event on the blockchain")
def verify_event(event_id: str, current_user: TokenData = Depends(get_current_user)):
    try:
        # Fetch the collection event
        event_res = (
            supabase.table("collection_events")
            .select("*")
            .eq("event_id", event_id)
            .single()
            .execute()
        )
        if not event_res.data:
            raise HTTPException(status_code=404, detail=f"Collection event '{event_id}' not found")
        event = event_res.data

        # Fetch the blockchain log for this event
        log_res = (
            supabase.table("blockchain_logs")
            .select("*")
            .eq("related_id", event["id"])
            .eq("transaction_type", "collection_event")
            .execute()
        )
        if not log_res.data:
            raise HTTPException(
                status_code=404,
                detail=f"No blockchain record found for event '{event_id}'",
            )
        log = log_res.data[0]

        # Recompute hash and compare
        expected_hash = _sha256({
            "event_id": event.get("event_id"),
            "bin_id": event.get("bin_id"),
            "vehicle_id": event.get("vehicle_id"),
            "collected_at": event.get("collected_at"),
        })
        stored_hash = log.get("tx_hash", "")
        is_valid = expected_hash == stored_hash

        logger.info("verify_event: %s valid=%s", event_id, is_valid)
        return {
            "event_id": event_id,
            "verified": is_valid,
            "stored_hash": stored_hash,
            "computed_hash": expected_hash,
            "blockchain_record": log,
            "event": event,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("verify_event error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /blockchain/contract ──────────────────────────────────────────────────

@router.get("/contract", summary="Smart contract configuration info")
def contract_info(current_user: TokenData = Depends(get_current_user)):
    logger.info("contract_info: fetched by %s", current_user.user_id)
    return {
        "rpc_url": settings.blockchain_rpc_url,
        "contract_address": settings.contract_address or "Not configured",
        "network": "Ganache (local)" if "127.0.0.1" in settings.blockchain_rpc_url else "External network",
        "status": "connected" if settings.contract_address else "not_configured",
        "note": "Set CONTRACT_ADDRESS in .env to enable on-chain transactions",
    }
