import asyncio
from typing import Optional
from loguru import logger
from backend.config import settings
from backend.supabase_client import (
    create_alert, mark_alert_whatsapp_sent, get_client
)


# ── Urgency Tier Decision ──────────────────────────────────
def determine_urgency(nlp_result, patient=None):
    name = patient.get("name", "Patient") if patient else "Patient"
    conditions = patient.get("condition", []) if patient else []
    escalation = nlp_result.get("escalation_flag", False)
    blood_sugar = nlp_result.get("blood_sugar_self_report")
    chest = nlp_result.get("chest_symptom")
    meds = nlp_result.get("medication_adherence", True)
    summary = nlp_result.get("summary", "No summary available.")
    missed = nlp_result.get("missed_doses_count", 0) or 0
    
    if escalation or (blood_sugar and blood_sugar > 250) or chest in ["severe", "frequent"]:
        urgency = "CRITICAL"
        action = "Immediate callback + home visit within 2 hours"
    elif (blood_sugar and blood_sugar > 180) or not meds or chest == "mild" or missed >= 2:
        urgency = "MODERATE"
        action = "Schedule follow-up call within 24 hours"
    else:
        urgency = "ROUTINE"
        action = "Continue regular monitoring schedule"
        
    cond_str = ', '.join(conditions) if conditions else 'general'
    med_str = '✅ Taking medication' if meds else f'❌ Missed {int(missed)} doses'
    
    message = f"""🚨 *VaaniCare Alert — {urgency}*
👤 Patient: {name}
🏥 Conditions: {cond_str}
💊 Medication: {med_str}
🩸 Blood Sugar: {blood_sugar or 'Not reported'} mg/dL
💗 Chest: {chest or 'None reported'}
📋 Summary: {summary}

⚡ Action Required: {action}"""

    # Generate patient instruction in Hindi
    patient_instruction = generate_patient_instruction(urgency, nlp_result)

    return urgency, message, action


# ── Patient Instruction Generator ──────────────────────────
def generate_patient_instruction(urgency: str, nlp_result: dict) -> str:
    """Generate Hindi patient instructions based on urgency and symptoms."""
    instructions = []

    if urgency == "CRITICAL":
        instructions.append("⚠️ Turant doctor se mile ya hospital jayein.")
        instructions.append("Koi bhi dawai band na karein.")
    elif urgency == "MODERATE":
        instructions.append("24 ghante mein doctor se baat karein.")
    else:
        instructions.append("Apni dawai niyamit lete rahein.")

    if nlp_result.get("medication_adherence") is False:
        instructions.append("Dawai chhodna khatarnak ho sakta hai — aaj se niyamit lein.")

    sugar = nlp_result.get("blood_sugar_self_report")
    if sugar and sugar > 200:
        instructions.append(f"Sugar {int(sugar)} hai — meetha aur chawal kam karein.")

    if nlp_result.get("chest_symptom") in ["moderate", "severe"]:
        instructions.append("Seene mein dard ho to lete rahein aur turant madad bulayein.")

    if nlp_result.get("exercise_done") is False:
        instructions.append("Roz 15-20 minute walk karein.")

    return " ".join(instructions)


# ── WhatsApp Alert via Twilio ──────────────────────────────
async def send_whatsapp_alert(
    patient_name: str,
    urgency: str,
    message: str,
    action: str,
) -> Optional[str]:
    """Send WhatsApp message to doctor. Returns message SID or None."""
    if settings.is_demo_mode:
        logger.info(f"[DEMO MODE] WhatsApp alert simulated for {patient_name}")
        logger.info(f"  Urgency: {urgency}")
        logger.info(f"  Message: {message}")
        logger.info(f"  Action: {action}")
        return "DEMO_SID_" + patient_name.replace(" ", "_")

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        body = (
            f"*VaaniCare Patient Alert*\n\n"
            f"Patient: {patient_name}\n"
            f"Urgency: {urgency}\n\n"
            f"{message}\n\n"
            f"*Action Required:* {action}\n\n"
            f"_VaaniCare AI — Automated Health Alert_"
        )

        msg = client.messages.create(
            body=body,
            from_=settings.WHATSAPP_FROM,
            to=settings.WHATSAPP_TO,
        )
        logger.success(f"✅ WhatsApp sent to doctor | SID: {msg.sid} | Patient: {patient_name}")
        return msg.sid

    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        return None


# ── Full Action Pipeline ───────────────────────────────────
async def process_call_actions(
    patient_id: str,
    call_id: str,
    observation_id: str,
    patient_name: str,
    observation: dict,
) -> dict:
    """
    Complete action pipeline after a call:
    1. Determine urgency from observation
    2. Create alert in Supabase
    3. Send WhatsApp to doctor
    4. Return action summary
    """
    # Step 1: Determine urgency
    urgency, message, action = determine_urgency(observation)
    logger.info(f"Action engine: {patient_name} → urgency={urgency}")

    # Step 2: Create alert in DB
    alert = create_alert(
        patient_id=patient_id,
        call_id=call_id,
        observation_id=observation_id,
        urgency=urgency,
        message=message,
        action=action,
    )
    alert_id = alert.get("id") if alert else None

    # Step 3: Send WhatsApp (only CRITICAL and MODERATE)
    whatsapp_sid = None
    if urgency in ["CRITICAL", "MODERATE"]:
        whatsapp_sid = await send_whatsapp_alert(
            patient_name=patient_name,
            urgency=urgency,
            message=message,
            action=action,
        )
        if alert_id and whatsapp_sid:
            mark_alert_whatsapp_sent(alert_id, whatsapp_sid)

    # Step 4: Update patient last_call_at
    try:
        get_client().table("patients").update(
            {"last_call_at": "now()"}
        ).eq("id", patient_id).execute()
    except Exception as e:
        logger.error(f"Failed to update last_call_at: {e}")

    result = {
        "urgency": urgency,
        "message": message,
        "action": action,
        "alert_id": alert_id,
        "whatsapp_sent": whatsapp_sid is not None,
        "whatsapp_sid": whatsapp_sid,
    }

    logger.success(f"✅ Action pipeline complete: {patient_name} | {urgency} | WhatsApp: {bool(whatsapp_sid)}")
    return result


# ── Cost Calculator ────────────────────────────────────────
def calculate_call_cost(duration_sec: int, language: str = "hi-IN") -> dict:
    """Calculate cost comparison: VaaniCare AI vs manual nurse call."""
    sarvam_cost_per_min = 0.02  # ~₹0.02/min for Sarvam API
    groq_cost_per_call = 0.001  # ~₹0.001 per Groq extraction
    infra_cost = 0.005          # Fixed infra per call

    duration_min = max(duration_sec / 60, 1)
    ai_cost = (sarvam_cost_per_min * duration_min * 2) + groq_cost_per_call + infra_cost

    manual_cost = 50.0  # ₹50 per manual nurse call (industry benchmark)
    savings = manual_cost - ai_cost
    savings_pct = (savings / manual_cost) * 100

    return {
        "ai_cost_inr": round(ai_cost, 2),
        "manual_cost_inr": manual_cost,
        "savings_inr": round(savings, 2),
        "savings_percent": round(savings_pct, 1),
        "duration_min": round(duration_min, 1),
    }


def calculate_cost(duration_sec: int = 45, demo_mode: bool = True) -> dict:
    """Calculate cost comparison: AI call vs manual nurse call."""
    # Sarvam TTS/STT approximate cost
    ai_cost = round(duration_sec * 0.002, 2)  # ~₹0.002/sec
    manual_cost = 50.0  # ₹50 per manual nurse call
    savings_pct = round((1 - ai_cost / manual_cost) * 100, 1)
    
    return {
        "ai_cost": ai_cost,
        "manual_cost": manual_cost,
        "savings_inr": round(manual_cost - ai_cost, 2),
        "savings_pct": savings_pct,
        "duration_sec": duration_sec,
    }


# ── Test ───────────────────────────────────────────────────
async def test_action_engine():
    logger.info("Testing Action Engine...")

    sample_observation = {
        "medication_adherence": False,
        "missed_doses_count": 3,
        "pain_score": 6,
        "chest_symptom": "mild",
        "blood_sugar_self_report": 210.0,
        "escalation_flag": True,
        "escalation_reason": "missed 3 doses, mild chest symptoms",
        "fatigue_level": "moderate",
    }

    # Added a dummy patient dictionary to test the new signature properly
    dummy_patient = {
        "name": "Ramesh Kumar",
        "condition": ["diabetes", "hypertension"]
    }

    urgency, msg, action = determine_urgency(sample_observation, patient=dummy_patient)
    logger.info(f"Urgency: {urgency}")
    logger.info(f"Message: {msg}")
    logger.info(f"Action: {action}")

    # Test WhatsApp (demo mode)
    sid = await send_whatsapp_alert("Ramesh Kumar", urgency, msg, action)
    logger.success(f"✅ WhatsApp SID: {sid}")

    # Test cost calculator
    cost = calculate_call_cost(duration_sec=120)
    logger.info(f"Cost comparison: AI=₹{cost['ai_cost_inr']} vs Manual=₹{cost['manual_cost_inr']} | Savings={cost['savings_percent']}%")

    logger.success("✅ Action Engine test complete!")


if __name__ == "__main__":
    asyncio.run(test_action_engine())