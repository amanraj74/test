"""
VaaniCare 2.0 — Conversation Manager
Orchestrates the full call pipeline:
Greeting → Questions → STT → NLP → Memory → Risk → Action → FHIR → Dashboard
"""
from loguru import logger
from datetime import datetime
from typing import Optional

from backend.supabase_client import (
    get_patient_by_id, create_call, update_call,
    create_observation, get_patient_memory
)
from backend.nlp_extractor import extract_clinical_entities
from backend.memory_engine import (
    update_memory_after_call, get_personalized_greeting, get_memory_context
)
from backend.action_engine import determine_urgency, send_whatsapp_alert, calculate_cost
from backend.risk_engine import update_patient_risk
from backend.scheduler import reschedule_after_call
from backend.fhir_mapper import generate_fhir_bundle


# ── Demo Transcripts (Hindi) ──────────────────────────────
DEMO_TRANSCRIPTS = {
    "hi-IN": {
        "normal": "Haan ji, main theek hoon. Dawai le raha hoon niyamit. Sugar aaj 140 aaya. Koi khaas taklif nahi hai.",
        "moderate": "Ji main {name} bol raha hoon. Maine 2 din se dawai nahi li. Thoda seena bhari sa lag raha hai aur sugar 220 hai. Thoda chakkar bhi aata hai.",
        "critical": "Haan ji, mujhe bahut takleef hai. Seene mein bahut tez dard ho raha hai. Sugar 350 aa raha hai. Dawai bhi 3 din se nahi li. Saas lene mein bhi dikkat ho rahi hai.",
    },
    "bn-IN": {
        "normal": "Haan, ami bhalo achi. Dawai khacchi niyomito.",
        "moderate": "Haan, ami {name} bolchi. Ami 2 din dawai khayni. Buk ektu bhari lagche.",
        "critical": "Amar buk e khub byatha hocche. Sugar 350 hoyeche. Dawai 3 din khayni.",
    },
}


def _get_demo_transcript(patient: dict, language: str = "hi-IN") -> str:
    """Select demo transcript based on patient risk tier."""
    name = patient.get("name", "Patient")
    risk = patient.get("risk_tier", "LOW")

    lang_transcripts = DEMO_TRANSCRIPTS.get(language, DEMO_TRANSCRIPTS["hi-IN"])

    if risk in ["CRITICAL", "HIGH"]:
        template = lang_transcripts["critical"]
    elif risk == "MODERATE":
        template = lang_transcripts["moderate"]
    else:
        template = lang_transcripts["normal"]

    return template.format(name=name)


# ── Build Full Conversation Flow ───────────────────────────
def build_conversation_flow(patient: dict, language: str = "hi-IN") -> dict:
    """
    Build the full conversation flow for a call.
    Returns structured flow with greeting, questions, and memory context.
    """
    from backend.voice_engine import build_question_scripts, build_closing_script

    patient_id = patient["id"]
    patient_name = patient.get("name", "Patient")
    conditions = patient.get("condition", [])

    # Get personalized greeting (memory-aware)
    greeting = get_personalized_greeting(patient_id, patient_name, language)

    # Get condition-specific questions
    questions = build_question_scripts(conditions, language)

    # Get closing script
    closing = build_closing_script(patient_name, language)

    # Get memory context for AI
    memory = get_memory_context(patient_id)

    return {
        "patient_id": patient_id,
        "patient_name": patient_name,
        "language": language,
        "greeting": greeting,
        "questions": questions,
        "closing": closing,
        "memory_context": memory,
        "conditions": conditions,
    }


# ── Process Patient Response ──────────────────────────────
async def process_patient_response(
    transcript: str,
    patient: dict,
    call_id: str,
    language: str = "hi-IN",
) -> dict:
    """
    Process a patient's spoken response through the full NLP pipeline.
    
    Steps:
    1. Get memory context
    2. Extract clinical entities (memory-aware)
    3. Create observation
    4. Update memory
    5. Calculate urgency
    6. Generate FHIR bundle
    7. Update risk score
    
    Returns:
        Complete processing result dict
    """
    patient_id = patient["id"]
    patient_name = patient.get("name", "Patient")
    conditions = patient.get("condition", [])

    # 1. Memory context for better extraction
    memory = get_memory_context(patient_id)

    # 2. NLP extraction (async, memory-aware)
    extraction = await extract_clinical_entities(
        transcript=transcript,
        conditions=conditions,
        language=language,
        memory=memory if memory else None,
    )

    # 3. Create observation in DB
    obs = create_observation(call_id, patient_id, {
        "medication_adherence": extraction.get("medication_adherence"),
        "missed_doses_count": int(extraction.get("missed_doses_count") or 0),
        "pain_score": extraction.get("pain_score"),
        "chest_symptom": extraction.get("chest_symptom"),
        "dizziness": extraction.get("dizziness"),
        "blurred_vision": extraction.get("blurred_vision"),
        "swelling": extraction.get("swelling"),
        "fatigue_level": extraction.get("fatigue_level"),
        "dietary_compliance": extraction.get("dietary_compliance"),
        "exercise_done": extraction.get("exercise_done"),
        "blood_sugar_self_report": extraction.get("blood_sugar_self_report"),
        "bp_self_report": extraction.get("bp_self_report"),
        "patient_sentiment": extraction.get("patient_sentiment"),
        "summary": extraction.get("summary"),
        "escalation_flag": extraction.get("escalation_flag", False),
        "escalation_reason": extraction.get("escalation_reason"),
        "raw_extraction": extraction,
    })

    # 4. Generate FHIR bundle
    fhir_bundle = None
    try:
        fhir_bundle = generate_fhir_bundle(patient, extraction, call_id)
        if obs and fhir_bundle:
            # Update observation with FHIR bundle
            from backend.supabase_client import get_client
            get_client().table("observations").update(
                {"fhir_bundle": fhir_bundle}
            ).eq("id", obs["id"]).execute()
    except Exception as e:
        logger.error(f"FHIR generation failed: {e}")

    # 5. Update patient memory
    update_memory_after_call(patient_id, call_id, extraction, transcript)

    # 6. Determine urgency & create alert
    urgency, message, action = determine_urgency(extraction, patient=patient)
    alert = None
    whatsapp_sid = None

    if obs:
        from backend.supabase_client import create_alert, mark_alert_whatsapp_sent
        alert = create_alert(
            patient_id, call_id, obs["id"],
            urgency, message, action
        )

        # Send WhatsApp for CRITICAL and MODERATE
        if urgency in ["CRITICAL", "MODERATE"] and alert:
            whatsapp_sid = await send_whatsapp_alert(
                patient_name=patient_name,
                urgency=urgency,
                message=message,
                action=action,
            )
            if whatsapp_sid:
                mark_alert_whatsapp_sent(alert["id"], whatsapp_sid)

    # 7. Update risk score based on new observation
    memory_record = get_patient_memory(patient_id)
    update_patient_risk(patient_id, extraction, memory_record)

    return {
        "extraction": extraction,
        "observation_id": obs["id"] if obs else None,
        "urgency": urgency,
        "alert_message": message,
        "action": action,
        "alert_id": alert["id"] if alert else None,
        "whatsapp_sent": whatsapp_sid is not None,
        "fhir_bundle": fhir_bundle,
    }


# ── Full Call Pipeline (Orchestrator) ──────────────────────
async def run_full_call_pipeline(
    patient_id: str,
    demo_mode: bool = True,
    language: str = None,
    audio_bytes: bytes = None,
) -> dict:
    """
    Run the complete call pipeline end-to-end.
    
    Demo mode: Uses simulated transcript
    Live mode: Uses audio_bytes for STT (future)
    
    Steps:
    1. Load patient
    2. Create call record
    3. Build conversation flow (memory-aware greeting)
    4. Get/simulate transcript
    5. Process through NLP pipeline
    6. Calculate cost
    7. Update call record
    8. Schedule next call
    
    Returns:
        Complete pipeline result
    """
    # 1. Load patient
    patient = get_patient_by_id(patient_id)
    if not patient:
        return {"status": "error", "message": "Patient not found"}

    language = language or patient.get("language", "hi-IN")

    # 2. Create call record
    call = create_call(patient_id, language=language, demo_mode=demo_mode)
    if not call:
        return {"status": "error", "message": "Failed to create call record"}

    call_id = call["id"]

    try:
        # 3. Build conversation flow
        flow = build_conversation_flow(patient, language)

        # 4. Get transcript
        if demo_mode:
            transcript = _get_demo_transcript(patient, language)
        elif audio_bytes:
            from backend.voice_engine import speech_to_text
            transcript = await speech_to_text(audio_bytes, language)
            if not transcript:
                update_call(call_id, {"status": "FAILED"})
                return {"status": "error", "message": "STT failed"}
        else:
            update_call(call_id, {"status": "FAILED"})
            return {"status": "error", "message": "No audio provided for live call"}

        # Update call with transcript
        update_call(call_id, {
            "status": "IN_PROGRESS",
            "transcript": transcript,
            "started_at": datetime.utcnow().isoformat(),
        })

        # 5. Process through full pipeline
        result = await process_patient_response(
            transcript=transcript,
            patient=patient,
            call_id=call_id,
            language=language,
        )

        # 6. Calculate cost
        duration_sec = 45 if demo_mode else 60
        cost = calculate_cost(duration_sec=duration_sec, demo_mode=demo_mode)

        # 7. Update call as completed
        update_call(call_id, {
            "status": "COMPLETED",
            "ended_at": datetime.utcnow().isoformat(),
            "duration_sec": duration_sec,
            "cost_inr": cost["ai_cost"],
            "cost_manual_inr": cost["manual_cost"],
        })

        # 8. Update patient stats
        from backend.supabase_client import update_patient
        update_patient(patient_id, {
            "last_call_at": datetime.utcnow().isoformat(),
            "total_calls": (patient.get("total_calls") or 0) + 1,
        })

        # 9. Schedule next call
        reschedule_after_call(patient_id)

        logger.success(f"✅ Full pipeline complete for {patient.get('name')} | urgency={result['urgency']}")

        return {
            "status": "completed",
            "call_id": call_id,
            "patient_name": patient.get("name"),
            "language": language,
            "transcript": transcript,
            "greeting_used": flow["greeting"],
            "extraction": result["extraction"],
            "urgency": result["urgency"],
            "alert_message": result["alert_message"],
            "action": result["action"],
            "whatsapp_sent": result["whatsapp_sent"],
            "fhir_bundle": result["fhir_bundle"],
            "cost": cost,
            "observation_id": result["observation_id"],
            "alert_id": result["alert_id"],
        }

    except Exception as e:
        logger.error(f"Pipeline failed for {patient.get('name', patient_id)}: {e}")
        update_call(call_id, {"status": "FAILED"})
        return {"status": "error", "message": str(e), "call_id": call_id}
