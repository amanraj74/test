"""
VaaniCare 2.0 — Patient Memory Engine
Maintains patient history across calls, tracks symptom trends,
adherence rates, and generates personalized greetings.
"""
from loguru import logger
from typing import Optional
from datetime import datetime
import json

from backend.supabase_client import get_client, get_patient_memory, upsert_patient_memory


# ── Memory Update After Call ───────────────────────────────
def update_memory_after_call(
    patient_id: str,
    call_id: str,
    extraction: dict,
    transcript: str = "",
) -> Optional[dict]:
    """
    Update patient memory after a call completes.
    Stores call summary, updates adherence rate, tracks symptom trend.
    
    Args:
        patient_id: UUID of the patient
        call_id: UUID of the completed call
        extraction: NLP extraction result dict
        transcript: Raw transcript text
    
    Returns:
        Updated memory dict or None on failure
    """
    try:
        # Get existing memory (or start fresh)
        existing = get_patient_memory(patient_id) or {}
        call_history = existing.get("call_history", []) or []
        total_calls = (existing.get("total_calls_analyzed", 0) or 0)
        total_adherent = (existing.get("total_adherent_calls", 0) or 0)

        # Build call snapshot
        snapshot = {
            "call_id": call_id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": extraction.get("summary", "Call completed"),
            "medication_adherence": extraction.get("medication_adherence"),
            "pain_score": extraction.get("pain_score"),
            "chest_symptom": extraction.get("chest_symptom"),
            "blood_sugar": extraction.get("blood_sugar_self_report"),
            "escalation_flag": extraction.get("escalation_flag", False),
            "sentiment": extraction.get("patient_sentiment", "neutral"),
        }

        # Prepend new snapshot, keep last 5
        call_history = [snapshot] + call_history[:4]

        # Update adherence tracking
        total_calls += 1
        if extraction.get("medication_adherence") is True:
            total_adherent += 1
        adherence_rate = round(total_adherent / total_calls, 3) if total_calls > 0 else 0.0

        # Calculate symptom trend from last 3 calls
        symptom_trend = _calculate_symptom_trend(call_history)

        # Extract reported symptoms as list
        reported_symptoms = _extract_symptom_list(extraction)

        # Build known concerns (accumulate recurring issues)
        known_concerns = list(set(
            (existing.get("known_concerns", []) or []) + reported_symptoms
        ))[:10]  # Cap at 10

        # Generate personalized greeting for next call
        personalized_greeting = _generate_greeting_text(
            call_history, symptom_trend, adherence_rate
        )

        # Build memory payload
        memory_data = {
            "last_call_summary": extraction.get("summary", "Call completed"),
            "symptom_trend": symptom_trend,
            "adherence_rate": adherence_rate,
            "total_adherent_calls": total_adherent,
            "total_calls_analyzed": total_calls,
            "last_reported_symptoms": reported_symptoms,
            "known_concerns": known_concerns,
            "personalized_greeting": personalized_greeting,
            "call_history": json.dumps(call_history) if isinstance(call_history, list) else call_history,
        }

        result = upsert_patient_memory(patient_id, memory_data)
        logger.success(f"✅ Memory updated for patient {patient_id} | trend={symptom_trend} | adherence={adherence_rate}")
        return result

    except Exception as e:
        logger.error(f"Memory update failed for {patient_id}: {e}")
        return None


# ── Symptom Trend Analysis ─────────────────────────────────
def _calculate_symptom_trend(call_history: list) -> str:
    """
    Analyze last 3 calls to determine if symptoms are improving, stable, or worsening.
    Uses pain scores, escalation flags, and chest symptoms as signals.
    """
    if len(call_history) < 2:
        return "unknown"

    recent = call_history[:3]  # Last 3 calls
    scores = []

    for call in recent:
        severity = 0
        pain = call.get("pain_score")
        if pain is not None:
            severity += pain

        chest = call.get("chest_symptom", "none")
        chest_map = {"none": 0, "mild": 2, "moderate": 5, "severe": 8}
        severity += chest_map.get(chest, 0)

        if call.get("escalation_flag"):
            severity += 5

        sugar = call.get("blood_sugar")
        if sugar and sugar > 200:
            severity += 3
        elif sugar and sugar > 150:
            severity += 1

        scores.append(severity)

    # Compare newest vs oldest
    if len(scores) >= 2:
        newest = scores[0]
        oldest = scores[-1]
        diff = newest - oldest

        if diff < -2:
            return "improving"
        elif diff > 2:
            return "worsening"
        else:
            return "stable"

    return "unknown"


# ── Extract Symptom List ───────────────────────────────────
def _extract_symptom_list(extraction: dict) -> list:
    """Extract a list of reported symptoms from NLP extraction."""
    symptoms = []
    if extraction.get("chest_symptom") and extraction["chest_symptom"] != "none":
        symptoms.append(f"chest_{extraction['chest_symptom']}")
    if extraction.get("dizziness"):
        symptoms.append("dizziness")
    if extraction.get("blurred_vision"):
        symptoms.append("blurred_vision")
    if extraction.get("swelling"):
        symptoms.append("swelling")
    if extraction.get("fatigue_level") and extraction["fatigue_level"] != "none":
        symptoms.append(f"fatigue_{extraction['fatigue_level']}")
    if extraction.get("pain_score") and extraction["pain_score"] >= 5:
        symptoms.append(f"pain_score_{extraction['pain_score']}")
    if extraction.get("blood_sugar_self_report") and extraction["blood_sugar_self_report"] > 200:
        symptoms.append("high_blood_sugar")
    if extraction.get("medication_adherence") is False:
        symptoms.append("missed_medication")
    return symptoms


# ── Generate Personalized Greeting ─────────────────────────
def _generate_greeting_text(
    call_history: list,
    symptom_trend: str,
    adherence_rate: float,
) -> str:
    """
    Generate a personalized Hindi greeting based on patient memory.
    This text will be used by TTS in the next call.
    """
    if not call_history:
        return ""  # First call — use default intro

    last_call = call_history[0]

    parts = []

    # Reference previous symptom
    if last_call.get("chest_symptom") and last_call["chest_symptom"] != "none":
        parts.append("Pichhli baar aapne seene mein taklif batai thi — ab kaisa hai?")
    elif last_call.get("pain_score") and last_call["pain_score"] >= 5:
        parts.append("Pichhli baar aapne dard bataya tha — ab kaisa lag raha hai?")
    elif last_call.get("blood_sugar") and last_call["blood_sugar"] > 200:
        parts.append("Pichhli baar aapka sugar zyada tha — ab kaisa hai?")

    # Reference adherence
    if adherence_rate < 0.5 and len(call_history) >= 2:
        parts.append("Dawai niyamit lena bahut zaruri hai, aap koshish karein.")
    elif adherence_rate >= 0.8:
        parts.append("Aap dawai achhe se le rahe hain, bahut accha!")

    # Reference trend
    if symptom_trend == "improving":
        parts.append("Lagta hai aapki sehat behtar ho rahi hai.")
    elif symptom_trend == "worsening":
        parts.append("Hum aapki sehat par nazar rakh rahe hain. Kuchh bhi taklif ho to zarur batayein.")

    return " ".join(parts) if parts else ""


# ── Public Helpers ─────────────────────────────────────────
def get_personalized_greeting(patient_id: str, patient_name: str, language: str = "hi-IN") -> str:
    """
    Get full personalized greeting for a patient call.
    Combines standard intro with memory-aware follow-up lines.
    """
    from backend.voice_engine import build_intro_script

    base_intro = build_intro_script(patient_name, language)
    memory = get_patient_memory(patient_id)

    if not memory or not memory.get("personalized_greeting"):
        return base_intro

    return f"{base_intro} {memory['personalized_greeting']}"


def get_memory_context(patient_id: str) -> dict:
    """
    Get full memory context for NLP extraction (so AI knows patient history).
    """
    memory = get_patient_memory(patient_id)
    if not memory:
        return {}
    return {
        "symptom_trend": memory.get("symptom_trend", "unknown"),
        "adherence_rate": memory.get("adherence_rate", 0),
        "last_reported_symptoms": memory.get("last_reported_symptoms", []),
        "known_concerns": memory.get("known_concerns", []),
        "total_calls": memory.get("total_calls_analyzed", 0),
        "last_call_summary": memory.get("last_call_summary", ""),
        "call_history": memory.get("call_history", []),
    }


def get_memory_timeline(patient_id: str) -> list:
    """
    Get call history timeline from patient memory for dashboard display.
    Returns list of call snapshots sorted by timestamp.
    """
    memory = get_patient_memory(patient_id)
    if not memory:
        return []

    history = memory.get("call_history", [])
    if isinstance(history, str):
        try:
            history = json.loads(history)
        except json.JSONDecodeError:
            return []
    return history
