"""
VaaniCare 2.0 — FastAPI Backend
AI-powered multilingual voice follow-up for rural health camps.
All API routes for the VaaniCare platform.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from loguru import logger
from datetime import datetime

from backend.config import settings
from backend.supabase_client import (
    get_all_patients, get_patient_by_id, get_high_risk_patients,
    get_dashboard_stats, get_recent_calls, get_unacknowledged_alerts,
    create_call, update_call, create_observation, create_alert,
    acknowledge_alert, upsert_patient_memory, get_patient_memory,
    update_patient, get_patient_observations, get_call_with_observation,
    get_cost_stats, get_calls_for_patient,
)
from backend.nlp_extractor import extract_clinical_entities
from backend.action_engine import determine_urgency, send_whatsapp_alert, calculate_cost, calculate_call_cost
from backend.voice_engine import text_to_speech, speech_to_text, build_intro_script
from backend.memory_engine import (
    update_memory_after_call, get_personalized_greeting,
    get_memory_context, get_memory_timeline,
)
from backend.risk_engine import calculate_dynamic_risk, update_patient_risk
from backend.scheduler import schedule_next_call, get_due_calls, get_schedule_summary
from backend.conversation import run_full_call_pipeline, build_conversation_flow
from backend.fhir_mapper import generate_fhir_bundle, get_fhir_summary

# ── App Setup ──────────────────────────────────────────────
app = FastAPI(
    title="VaaniCare API",
    description="AI-powered multilingual voice follow-up for rural health camps",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════
# ROOT & HEALTH
# ══════════════════════════════════════════════════════════
@app.get("/")
def root():
    return {
        "service": "VaaniCare 2.0",
        "status": "running",
        "version": "2.0.0",
        "hackathon": "Hackmatrix 2.0 @ IIT Patna",
    }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# ══════════════════════════════════════════════════════════
# PATIENTS
# ══════════════════════════════════════════════════════════
@app.get("/patients")
def list_patients(limit: int = 100):
    return get_all_patients(limit)

@app.get("/patients/high-risk")
def high_risk_patients():
    return get_high_risk_patients()

@app.get("/patients/{patient_id}")
def get_patient(patient_id: str):
    patient = get_patient_by_id(patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    return patient

@app.get("/patients/{patient_id}/calls")
def patient_calls(patient_id: str, limit: int = 10):
    """Get call history for a patient."""
    return get_calls_for_patient(patient_id, limit)

@app.get("/patients/{patient_id}/observations")
def patient_observations(patient_id: str, limit: int = 10):
    """Get observation history for a patient."""
    return get_patient_observations(patient_id, limit)


# ══════════════════════════════════════════════════════════
# PATIENT MEMORY
# ══════════════════════════════════════════════════════════
@app.get("/patients/{patient_id}/memory")
def patient_memory(patient_id: str):
    """Get patient memory (summary, trends, adherence)."""
    memory = get_patient_memory(patient_id)
    if not memory:
        return {"message": "No memory yet", "total_calls": 0}
    return memory

@app.get("/patients/{patient_id}/memory/timeline")
def patient_memory_timeline(patient_id: str):
    """Get patient call history timeline from memory."""
    timeline = get_memory_timeline(patient_id)
    return {"patient_id": patient_id, "timeline": timeline, "total_calls": len(timeline)}

@app.get("/patients/{patient_id}/memory/context")
def patient_memory_context(patient_id: str):
    """Get memory context (used by NLP for context-aware extraction)."""
    return get_memory_context(patient_id) or {"message": "No context available"}


# ══════════════════════════════════════════════════════════
# RISK ENGINE
# ══════════════════════════════════════════════════════════
@app.post("/patients/{patient_id}/risk/recalculate")
def recalculate_risk(patient_id: str):
    """Recalculate patient risk score based on latest data."""
    patient = get_patient_by_id(patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")

    memory = get_patient_memory(patient_id)
    new_score, new_tier = calculate_dynamic_risk(patient, memory=memory)
    result = update_patient_risk(patient_id, memory=memory)

    return {
        "patient_id": patient_id,
        "new_risk_score": new_score,
        "new_risk_tier": new_tier,
        "updated": result is not None,
    }


# ══════════════════════════════════════════════════════════
# CALLS
# ══════════════════════════════════════════════════════════
class TriggerCallRequest(BaseModel):
    patient_id: str
    demo_mode: bool = True
    language: Optional[str] = None

@app.post("/calls/trigger")
async def trigger_call(req: TriggerCallRequest, background_tasks: BackgroundTasks):
    """Trigger a call to a patient. Uses full pipeline with memory integration."""
    patient = get_patient_by_id(req.patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")

    language = req.language or patient.get("language", "hi-IN")

    # Build conversation flow preview
    flow = build_conversation_flow(patient, language)

    # Run full pipeline in background
    background_tasks.add_task(
        _run_call_background, req.patient_id, req.demo_mode, language
    )

    return {
        "status": "call_started",
        "patient": patient["name"],
        "language": language,
        "greeting_preview": flow["greeting"][:200],
        "message": "Full call pipeline started in background",
    }


async def _run_call_background(patient_id: str, demo_mode: bool, language: str):
    """Background task wrapper for the full call pipeline."""
    try:
        result = await run_full_call_pipeline(
            patient_id=patient_id,
            demo_mode=demo_mode,
            language=language,
        )
        if result.get("status") == "completed":
            logger.success(f"✅ Background call complete: {result.get('patient_name')} | {result.get('urgency')}")
        else:
            logger.error(f"Background call error: {result.get('message')}")
    except Exception as e:
        logger.error(f"Background call exception: {e}")


@app.get("/calls/{call_id}")
def get_call(call_id: str):
    """Get call details with observation data."""
    result = get_call_with_observation(call_id)
    if not result:
        raise HTTPException(404, "Call not found")
    return result


# ══════════════════════════════════════════════════════════
# FHIR
# ══════════════════════════════════════════════════════════
@app.get("/calls/{call_id}/fhir")
def get_call_fhir(call_id: str):
    """Get FHIR R4 bundle for a specific call."""
    call_data = get_call_with_observation(call_id)
    if not call_data:
        raise HTTPException(404, "Call not found")

    # Check if FHIR bundle exists in observation
    obs_list = call_data.get("observations", [])
    if obs_list and isinstance(obs_list, list):
        for obs in obs_list:
            if obs.get("fhir_bundle"):
                return {
                    "fhir_bundle": obs["fhir_bundle"],
                    "summary": get_fhir_summary(obs["fhir_bundle"]),
                }

    # Generate on the fly if not stored
    patient = call_data.get("patients")
    if patient and obs_list:
        obs = obs_list[0] if isinstance(obs_list, list) else obs_list
        bundle = generate_fhir_bundle(patient, obs, call_id)
        return {
            "fhir_bundle": bundle,
            "summary": get_fhir_summary(bundle),
        }

    raise HTTPException(404, "No observation data for FHIR generation")


@app.get("/patients/{patient_id}/fhir")
def get_patient_fhir(patient_id: str):
    """Get FHIR bundle for patient's most recent call."""
    patient = get_patient_by_id(patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")

    observations = get_patient_observations(patient_id, limit=1)
    if not observations:
        raise HTTPException(404, "No observations found for patient")

    obs = observations[0]

    # Return stored FHIR bundle or generate fresh
    if obs.get("fhir_bundle"):
        return {
            "fhir_bundle": obs["fhir_bundle"],
            "summary": get_fhir_summary(obs["fhir_bundle"]),
        }

    bundle = generate_fhir_bundle(patient, obs, obs.get("call_id", "unknown"))
    return {
        "fhir_bundle": bundle,
        "summary": get_fhir_summary(bundle),
    }


# ══════════════════════════════════════════════════════════
# VOICE (STT / TTS)
# ══════════════════════════════════════════════════════════
@app.post("/voice/stt")
async def stt(file: UploadFile = File(...), language: str = "hi-IN"):
    """Speech to text using Sarvam STT."""
    audio_bytes = await file.read()
    transcript = await speech_to_text(audio_bytes, language, file.filename)
    if not transcript:
        raise HTTPException(500, "STT failed")
    return {"transcript": transcript, "language": language}


class TTSRequest(BaseModel):
    text: str
    language: str = "hi-IN"
    speaker: str = "meera"

@app.post("/voice/tts")
async def tts(req: TTSRequest):
    """Text to speech using Sarvam TTS."""
    audio = await text_to_speech(req.text, req.language, req.speaker)
    if not audio:
        raise HTTPException(500, "TTS failed")
    return Response(content=audio, media_type="audio/wav")


# ══════════════════════════════════════════════════════════
# VOICE INTAKE (Patient Registration via Voice)
# ══════════════════════════════════════════════════════════
@app.post("/voice/intake")
async def voice_intake(file: UploadFile = File(...), language: str = "hi-IN"):
    """Register a new patient via voice input."""
    from backend.voice_intake import extract_intake_entities, build_patient_record
    from backend.supabase_client import upsert_patient

    audio_bytes = await file.read()
    transcript = await speech_to_text(audio_bytes, language, file.filename)
    if not transcript:
        raise HTTPException(500, "STT failed for intake")

    # Extract patient data from transcript
    extracted = extract_intake_entities(transcript, language)
    patient_record = build_patient_record(extracted, language)

    # Save to DB
    result = upsert_patient(patient_record)

    return {
        "status": "registered",
        "transcript": transcript,
        "extracted": extracted,
        "patient": result[0] if result else patient_record,
    }


# ══════════════════════════════════════════════════════════
# NLP
# ══════════════════════════════════════════════════════════
class ExtractRequest(BaseModel):
    transcript: str
    conditions: List[str] = ["diabetes"]
    language: str = "hi-IN"
    patient_id: Optional[str] = None  # For memory-aware extraction

@app.post("/nlp/extract")
async def extract(req: ExtractRequest):
    """Extract clinical entities from transcript (optionally memory-aware)."""
    memory = None
    if req.patient_id:
        memory = get_memory_context(req.patient_id) or None

    result = await extract_clinical_entities(
        req.transcript, req.conditions, req.language, memory
    )
    if not result:
        raise HTTPException(500, "Extraction failed")
    return result


# ══════════════════════════════════════════════════════════
# ALERTS
# ══════════════════════════════════════════════════════════
@app.get("/alerts")
def list_alerts():
    """Get all unacknowledged doctor alerts."""
    return get_unacknowledged_alerts()

@app.post("/alerts/{alert_id}/acknowledge")
def ack_alert(alert_id: str):
    """Acknowledge a doctor alert."""
    result = acknowledge_alert(alert_id)
    return {"status": "acknowledged", "alert_id": alert_id}


# ══════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════
@app.get("/dashboard/stats")
def dashboard_stats():
    """Get dashboard statistics."""
    return get_dashboard_stats()

@app.get("/dashboard/calls")
def recent_calls(limit: int = 20):
    """Get recent calls with patient info."""
    return get_recent_calls(limit)

@app.get("/dashboard/cost-analysis")
def cost_analysis():
    """Get cost comparison: AI vs manual calls."""
    stats = get_cost_stats()
    return {
        **stats,
        "cost_per_ai_call_avg": stats.get("avg_ai_cost_inr", 0.09),
        "cost_per_manual_call": 50.0,
        "currency": "INR",
    }

@app.get("/dashboard/schedule")
def schedule_overview():
    """Get upcoming call schedule summary."""
    return get_schedule_summary()

@app.get("/dashboard/due-calls")
def due_calls():
    """Get patients currently due for follow-up calls."""
    return get_due_calls()