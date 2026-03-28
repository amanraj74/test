"""
VaaniCare 2.0 — Auto-Call Scheduler
Manages scheduling of patient follow-up calls based on risk tier.
Uses APScheduler for background task scheduling.
"""
from loguru import logger
from datetime import datetime, timedelta
from typing import Optional

from backend.supabase_client import (
    get_client, update_patient, get_patients_due_for_call
)
from backend.risk_engine import get_call_frequency


# ── Schedule Next Call ─────────────────────────────────────
def schedule_next_call(patient_id: str, risk_tier: str = "MODERATE") -> Optional[str]:
    """
    Set next_call_at for a patient based on risk tier.
    
    Args:
        patient_id: UUID of the patient
        risk_tier: Current risk tier (CRITICAL/HIGH/MODERATE/LOW)
    
    Returns:
        ISO timestamp of next scheduled call or None
    """
    try:
        frequency = get_call_frequency(risk_tier)
        next_call = datetime.utcnow() + timedelta(days=frequency)
        next_call_iso = next_call.isoformat()

        update_patient(patient_id, {
            "next_call_at": next_call_iso,
            "call_frequency_days": frequency,
        })

        logger.info(
            f"📅 Scheduled next call for {patient_id}: "
            f"{next_call_iso} ({frequency} days, {risk_tier})"
        )
        return next_call_iso

    except Exception as e:
        logger.error(f"Schedule failed for {patient_id}: {e}")
        return None


# ── Get Due Calls ──────────────────────────────────────────
def get_due_calls() -> list:
    """
    Find all patients whose next_call_at has passed (due for follow-up).
    Returns list of patient dicts sorted by risk_score descending.
    """
    try:
        patients = get_patients_due_for_call()
        logger.info(f"📞 Found {len(patients)} patients due for calls")
        return patients
    except Exception as e:
        logger.error(f"Get due calls error: {e}")
        return []


# ── Process Scheduled Calls ────────────────────────────────
async def process_scheduled_calls() -> dict:
    """
    Background task: process all due calls.
    Triggers demo calls for each due patient.
    
    Returns:
        Summary dict with counts
    """
    due = get_due_calls()
    if not due:
        logger.info("No calls due right now")
        return {"due": 0, "triggered": 0}

    triggered = 0
    failed = 0

    for patient in due:
        try:
            # Import here to avoid circular imports
            from backend.conversation import run_full_call_pipeline

            result = await run_full_call_pipeline(
                patient_id=patient["id"],
                demo_mode=True,
                language=patient.get("language", "hi-IN"),
            )

            if result and result.get("status") == "completed":
                triggered += 1
            else:
                failed += 1

        except Exception as e:
            logger.error(f"Scheduled call failed for {patient.get('name', 'unknown')}: {e}")
            failed += 1

    logger.success(
        f"✅ Scheduled call batch complete: {triggered} triggered, {failed} failed out of {len(due)}"
    )
    return {
        "due": len(due),
        "triggered": triggered,
        "failed": failed,
    }


# ── Reschedule After Call ──────────────────────────────────
def reschedule_after_call(patient_id: str, new_risk_tier: str = None) -> Optional[str]:
    """
    Reschedule patient's next call after a call completes.
    If new_risk_tier provided, uses it; otherwise fetches from DB.
    """
    try:
        if not new_risk_tier:
            from backend.supabase_client import get_patient_by_id
            patient = get_patient_by_id(patient_id)
            new_risk_tier = patient.get("risk_tier", "MODERATE") if patient else "MODERATE"

        return schedule_next_call(patient_id, new_risk_tier)

    except Exception as e:
        logger.error(f"Reschedule failed for {patient_id}: {e}")
        return None


# ── Get Schedule Summary ──────────────────────────────────
def get_schedule_summary() -> dict:
    """Get summary of upcoming scheduled calls (for dashboard)."""
    try:
        client = get_client()

        # Due now
        due_now = get_due_calls()

        # Due in next 24 hours
        tomorrow = (datetime.utcnow() + timedelta(days=1)).isoformat()
        upcoming = (client.table("patients")
                    .select("id, name, risk_tier, next_call_at")
                    .lte("next_call_at", tomorrow)
                    .gt("next_call_at", datetime.utcnow().isoformat())
                    .order("next_call_at")
                    .execute())

        # Due in next 7 days
        week = (datetime.utcnow() + timedelta(days=7)).isoformat()
        this_week = (client.table("patients")
                     .select("id", count="exact")
                     .lte("next_call_at", week)
                     .gt("next_call_at", datetime.utcnow().isoformat())
                     .execute())

        return {
            "overdue": len(due_now),
            "due_today": len(upcoming.data or []),
            "due_this_week": this_week.count or 0,
            "upcoming_patients": upcoming.data or [],
        }
    except Exception as e:
        logger.error(f"Schedule summary error: {e}")
        return {"overdue": 0, "due_today": 0, "due_this_week": 0, "upcoming_patients": []}
