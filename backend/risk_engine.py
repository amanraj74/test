"""
VaaniCare 2.0 — Dynamic Risk Scoring Engine
Calculates and updates patient risk scores based on vitals,
symptoms, and call observation history.
"""
from loguru import logger
from typing import Tuple, Optional
from datetime import datetime, timedelta

from backend.supabase_client import get_client, get_patient_by_id, update_patient


# ── Risk Tier Thresholds ───────────────────────────────────
RISK_THRESHOLDS = {
    "CRITICAL": 0.75,
    "HIGH": 0.55,
    "MODERATE": 0.35,
    # Anything below 0.35 → LOW
}

# ── Call Frequency by Risk Tier ────────────────────────────
CALL_FREQUENCY = {
    "CRITICAL": 1,    # Daily
    "HIGH": 3,        # Every 3 days
    "MODERATE": 7,    # Weekly
    "LOW": 14,        # Bi-weekly
}


def calculate_dynamic_risk(
    patient: dict,
    latest_observation: dict = None,
    memory: dict = None,
) -> Tuple[float, str]:
    """
    Calculate dynamic risk score from patient vitals + latest observation + memory.
    
    Risk factors:
    - Base vitals (BP, glucose, BMI)
    - Latest NLP extraction (symptoms, adherence)
    - Memory trends (worsening = higher risk)
    
    Args:
        patient: Patient record from DB
        latest_observation: Most recent NLP extraction result
        memory: Patient memory record
    
    Returns:
        (risk_score: float 0-1, risk_tier: str)
    """
    score = 0.0
    factors = []

    # ── 1. Base Vitals ─────────────────────────────────────
    systolic = patient.get("systolic_bp")
    diastolic = patient.get("diastolic_bp")
    glucose = patient.get("blood_glucose") or patient.get("fasting_glucose")
    bmi = patient.get("bmi")
    age = patient.get("age")

    # Blood pressure scoring
    if systolic and systolic > 180:
        score += 0.20
        factors.append("severe_hypertension")
    elif systolic and systolic > 140:
        score += 0.12
        factors.append("hypertension")
    elif systolic and systolic > 130:
        score += 0.05

    if diastolic and diastolic > 110:
        score += 0.10
        factors.append("high_diastolic")
    elif diastolic and diastolic > 90:
        score += 0.05

    # Blood glucose scoring
    if glucose and glucose > 300:
        score += 0.20
        factors.append("severe_hyperglycemia")
    elif glucose and glucose > 200:
        score += 0.12
        factors.append("high_glucose")
    elif glucose and glucose > 126:
        score += 0.06

    # BMI scoring
    if bmi and bmi > 35:
        score += 0.08
        factors.append("severe_obesity")
    elif bmi and bmi > 30:
        score += 0.04

    # Age scoring
    if age and age > 65:
        score += 0.06
    elif age and age > 50:
        score += 0.03

    # Condition multiplier
    conditions = patient.get("condition", []) or []
    if "diabetes" in conditions and "hypertension" in conditions:
        score += 0.08  # Comorbidity penalty
    if len(conditions) >= 3:
        score += 0.05

    # ── 2. Latest Observation Signals ──────────────────────
    if latest_observation:
        if latest_observation.get("escalation_flag"):
            score += 0.15
            factors.append("escalation_flagged")

        pain = latest_observation.get("pain_score")
        if pain and pain >= 7:
            score += 0.12
            factors.append("severe_pain")
        elif pain and pain >= 4:
            score += 0.05

        chest = latest_observation.get("chest_symptom")
        if chest == "severe":
            score += 0.15
            factors.append("severe_chest")
        elif chest == "moderate":
            score += 0.08

        if latest_observation.get("medication_adherence") is False:
            score += 0.08
            factors.append("non_adherent")

        sugar_report = latest_observation.get("blood_sugar_self_report")
        if sugar_report and sugar_report > 250:
            score += 0.10
            factors.append("high_sugar_reported")

    # ── 3. Memory-Based Adjustments ────────────────────────
    if memory:
        trend = memory.get("symptom_trend", "unknown")
        if trend == "worsening":
            score += 0.10
            factors.append("worsening_trend")
        elif trend == "improving":
            score -= 0.05  # Slight improvement bonus

        adherence = memory.get("adherence_rate", 0) or 0
        if adherence < 0.3:
            score += 0.08
            factors.append("poor_adherence_history")
        elif adherence > 0.8:
            score -= 0.03  # Good adherence bonus

    # ── Final Score ────────────────────────────────────────
    score = round(max(0.0, min(1.0, score)), 3)
    tier = _score_to_tier(score)

    logger.info(f"Risk calc: score={score}, tier={tier}, factors={factors}")
    return score, tier


def _score_to_tier(score: float) -> str:
    """Convert numeric risk score to tier label."""
    if score >= RISK_THRESHOLDS["CRITICAL"]:
        return "CRITICAL"
    elif score >= RISK_THRESHOLDS["HIGH"]:
        return "HIGH"
    elif score >= RISK_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    return "LOW"


# ── Get Call Frequency ─────────────────────────────────────
def get_call_frequency(risk_tier: str) -> int:
    """Get recommended call frequency in days based on risk tier."""
    return CALL_FREQUENCY.get(risk_tier, 7)


# ── Update Patient Risk After Call ─────────────────────────
def update_patient_risk(
    patient_id: str,
    latest_observation: dict = None,
    memory: dict = None,
) -> Optional[dict]:
    """
    Recalculate and update patient's risk score after a call.
    Also updates call frequency and next_call_at.
    
    Returns:
        Updated patient data or None
    """
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            logger.error(f"Patient {patient_id} not found for risk update")
            return None

        new_score, new_tier = calculate_dynamic_risk(patient, latest_observation, memory)
        frequency = get_call_frequency(new_tier)
        next_call = (datetime.utcnow() + timedelta(days=frequency)).isoformat()

        update_data = {
            "risk_score": new_score,
            "risk_tier": new_tier,
            "call_frequency_days": frequency,
            "next_call_at": next_call,
        }

        result = update_patient(patient_id, update_data)
        logger.success(
            f"✅ Risk updated for {patient.get('name', patient_id)}: "
            f"{patient.get('risk_tier')} → {new_tier} (score={new_score})"
        )
        return result

    except Exception as e:
        logger.error(f"Risk update failed for {patient_id}: {e}")
        return None


# ── Batch Risk Recalculation ──────────────────────────────
def recalculate_all_risks() -> dict:
    """Recalculate risk for all active patients. Returns summary."""
    try:
        from backend.supabase_client import get_all_patients, get_patient_memory
        patients = get_all_patients(limit=500)
        updated = 0
        for patient in patients:
            memory = get_patient_memory(patient["id"])
            result = update_patient_risk(patient["id"], memory=memory)
            if result:
                updated += 1

        logger.success(f"✅ Batch risk recalc complete: {updated}/{len(patients)} updated")
        return {"total": len(patients), "updated": updated}
    except Exception as e:
        logger.error(f"Batch risk recalc failed: {e}")
        return {"total": 0, "updated": 0, "error": str(e)}
