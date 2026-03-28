from supabase import create_client, Client
from backend.config import settings
from loguru import logger
from typing import Optional
import uuid
from datetime import datetime

# ── Singleton client ──────────────────────────────────────
_client: Optional[Client] = None

def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase client initialized")
    return _client

# ── PATIENTS ──────────────────────────────────────────────
def get_all_patients(limit: int = 100):
    try:
        res = get_client().table("patients").select("*").order("risk_score", desc=True).limit(limit).execute()
        return res.data
    except Exception as e:
        logger.error(f"get_all_patients error: {e}")
        return []

def get_patient_by_id(patient_id: str):
    try:
        res = get_client().table("patients").select("*").eq("id", patient_id).single().execute()
        return res.data
    except Exception as e:
        logger.error(f"get_patient_by_id error: {e}")
        return None

def get_high_risk_patients(limit: int = 50):
    try:
        res = (get_client().table("patients").select("*")
               .in_("risk_tier", ["CRITICAL", "HIGH"])
               .order("risk_score", desc=True)
               .limit(limit).execute())
        return res.data
    except Exception as e:
        logger.error(f"get_high_risk_patients error: {e}")
        return []

def get_patients_due_for_call():
    try:
        res = (get_client().table("patients").select("*")
               .lte("next_call_at", "now()")
               .order("risk_score", desc=True)
               .execute())
        return res.data
    except Exception as e:
        logger.error(f"get_patients_due_for_call error: {e}")
        return []

def upsert_patient(data: dict):
    try:
        res = get_client().table("patients").upsert(data).execute()
        return res.data
    except Exception as e:
        logger.error(f"upsert_patient error: {e}")
        return None

def update_patient(patient_id: str, data: dict):
    try:
        res = get_client().table("patients").update(data).eq("id", patient_id).execute()
        return res.data
    except Exception as e:
        logger.error(f"update_patient error: {e}")
        return None

# ── CALLS ──────────────────────────────────────────────────
def create_call(patient_id: str, language: str = "hi-IN", demo_mode: bool = False):
    try:
        data = {
            "patient_id": patient_id,
            "language_used": language,
            "status": "DEMO" if demo_mode else "PENDING",
            "demo_mode": demo_mode,
        }
        res = get_client().table("calls").insert(data).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"create_call error: {e}")
        return None

def update_call(call_id: str, data: dict):
    try:
        res = get_client().table("calls").update(data).eq("id", call_id).execute()
        return res.data
    except Exception as e:
        logger.error(f"update_call error: {e}")
        return None

def get_calls_for_patient(patient_id: str, limit: int = 10):
    try:
        res = (get_client().table("calls").select("*")
               .eq("patient_id", patient_id)
               .order("created_at", desc=True)
               .limit(limit).execute())
        return res.data
    except Exception as e:
        logger.error(f"get_calls_for_patient error: {e}")
        return []

def get_recent_calls(limit: int = 20):
    try:
        res = (get_client().table("calls")
               .select("*, patients(name, phone, risk_tier)")
               .order("created_at", desc=True)
               .limit(limit).execute())
        return res.data
    except Exception as e:
        logger.error(f"get_recent_calls error: {e}")
        return []

# ── OBSERVATIONS ───────────────────────────────────────────
def create_observation(call_id: str, patient_id: str, data: dict):
    try:
        payload = {"call_id": call_id, "patient_id": patient_id, **data}
        res = get_client().table("observations").insert(payload).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"create_observation error: {e}")
        return None

def get_observation_by_call(call_id: str):
    try:
        res = get_client().table("observations").select("*").eq("call_id", call_id).single().execute()
        return res.data
    except Exception as e:
        return None

# ── DOCTOR ALERTS ──────────────────────────────────────────
def create_alert(patient_id: str, call_id: str, observation_id: str,
                 urgency: str, message: str, action: str = ""):
    try:
        data = {
            "patient_id": patient_id,
            "call_id": call_id,
            "observation_id": observation_id,
            "urgency_tier": urgency,
            "alert_message": message,
            "action_required": action,
        }
        res = get_client().table("doctor_alerts").insert(data).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"create_alert error: {e}")
        return None

def get_unacknowledged_alerts(limit: int = 20):
    try:
        res = (get_client().table("doctor_alerts")
               .select("*, patients(name, phone, risk_tier)")
               .eq("acknowledged", False)
               .order("created_at", desc=True)
               .limit(limit).execute())
        return res.data
    except Exception as e:
        logger.error(f"get_unacknowledged_alerts error: {e}")
        return []

def mark_alert_whatsapp_sent(alert_id: str, message_sid: str = ""):
    try:
        res = (get_client().table("doctor_alerts")
               .update({"whatsapp_sent": True, "whatsapp_sent_at": "now()", "whatsapp_message_sid": message_sid})
               .eq("id", alert_id).execute())
        return res.data
    except Exception as e:
        logger.error(f"mark_alert_whatsapp_sent error: {e}")
        return None

def acknowledge_alert(alert_id: str, acknowledged_by: str = "doctor"):
    try:
        res = (get_client().table("doctor_alerts")
               .update({"acknowledged": True, "acknowledged_at": "now()", "acknowledged_by": acknowledged_by})
               .eq("id", alert_id).execute())
        return res.data
    except Exception as e:
        logger.error(f"acknowledge_alert error: {e}")
        return None

# ── PATIENT MEMORY ─────────────────────────────────────────
def get_patient_memory(patient_id: str):
    try:
        res = get_client().table("patient_memory").select("*").eq("patient_id", patient_id).single().execute()
        return res.data
    except Exception as e:
        return None

def upsert_patient_memory(patient_id: str, data: dict):
    try:
        payload = {"patient_id": patient_id, **data}
        res = get_client().table("patient_memory").upsert(payload, on_conflict="patient_id").execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"upsert_patient_memory error: {e}")
        return None

# ── WORKFLOWS ──────────────────────────────────────────────
def get_workflows(condition: str = None):
    try:
        query = get_client().table("workflows").select("*").eq("is_active", True)
        if condition:
            query = query.eq("condition", condition)
        res = query.execute()
        return res.data
    except Exception as e:
        logger.error(f"get_workflows error: {e}")
        return []

# ── OBSERVATIONS (extended) ────────────────────────────────
def get_patient_observations(patient_id: str, limit: int = 10):
    """Get observation history for a patient, newest first."""
    try:
        res = (get_client().table("observations")
               .select("*, calls(status, language_used, created_at, duration_sec)")
               .eq("patient_id", patient_id)
               .order("created_at", desc=True)
               .limit(limit).execute())
        return res.data
    except Exception as e:
        logger.error(f"get_patient_observations error: {e}")
        return []

def get_call_with_observation(call_id: str):
    """Get call data joined with its observation."""
    try:
        res = (get_client().table("calls")
               .select("*, observations(*), patients(name, phone, risk_tier, condition)")
               .eq("id", call_id)
               .single().execute())
        return res.data
    except Exception as e:
        logger.error(f"get_call_with_observation error: {e}")
        return None

# ── COST STATS ─────────────────────────────────────────────
def get_cost_stats():
    """Get aggregate cost comparison data."""
    try:
        res = (get_client().table("calls")
               .select("cost_inr, cost_manual_inr, duration_sec")
               .eq("status", "COMPLETED")
               .execute())
        calls = res.data or []
        total_ai = sum(c.get("cost_inr", 0) or 0 for c in calls)
        total_manual = sum(c.get("cost_manual_inr", 50) or 50 for c in calls)
        total_duration = sum(c.get("duration_sec", 0) or 0 for c in calls)
        return {
            "total_calls": len(calls),
            "total_ai_cost_inr": round(total_ai, 2),
            "total_manual_cost_inr": round(total_manual, 2),
            "total_savings_inr": round(total_manual - total_ai, 2),
            "savings_percent": round((1 - total_ai / total_manual) * 100, 1) if total_manual > 0 else 0,
            "avg_duration_sec": round(total_duration / len(calls), 1) if calls else 0,
            "avg_ai_cost_inr": round(total_ai / len(calls), 3) if calls else 0,
        }
    except Exception as e:
        logger.error(f"get_cost_stats error: {e}")
        return {}

# ── DASHBOARD STATS ────────────────────────────────────────
def get_dashboard_stats():
    try:
        client = get_client()
        
        patients = client.table("patients").select("risk_tier", count="exact").execute()
        
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        calls_today = client.table("calls").select("id", count="exact").gte("created_at", today_start).execute()
        
        alerts = client.table("doctor_alerts").select("id", count="exact").eq("acknowledged", False).execute()

        risk_counts = {"CRITICAL": 0, "HIGH": 0, "MODERATE": 0, "LOW": 0}
        for p in (patients.data or []):
            tier = p.get("risk_tier", "LOW")
            risk_counts[tier] = risk_counts.get(tier, 0) + 1

        return {
            "total_patients": patients.count or 0,
            "calls_today": calls_today.count or 0,
            "pending_alerts": alerts.count or 0,
            "risk_breakdown": risk_counts,
        }
    except Exception as e:
        logger.error(f"get_dashboard_stats error: {e}")
        return {"total_patients": 0, "calls_today": 0, "pending_alerts": 0, "risk_breakdown": {}}