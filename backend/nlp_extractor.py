"""
VaaniCare 2.0 — NLP Clinical Entity Extractor
Uses Groq LLaMA to extract structured clinical data from Hindi/English transcripts.
"""
from groq import AsyncGroq
from backend.config import settings
from loguru import logger
import json
import re
from typing import Optional


_client: Optional[AsyncGroq] = None


def get_groq_client() -> AsyncGroq:
    """Get singleton async Groq client."""
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


# ── Extraction Prompt ──────────────────────────────────────
EXTRACTION_PROMPT = """You are a clinical AI assistant for VaaniCare, analyzing a patient call transcript from rural India.

Extract the following clinical entities from this Hindi/English transcript and return ONLY valid JSON:

{{
  "medication_adherence": true/false/null,
  "missed_doses_count": number or null,
  "pain_score": 0-10 or null,
  "chest_symptom": "none"/"mild"/"moderate"/"severe" or null,
  "dizziness": true/false/null,
  "blurred_vision": true/false/null,
  "swelling": true/false/null,
  "fatigue_level": "none"/"mild"/"moderate"/"severe" or null,
  "dietary_compliance": true/false/null,
  "exercise_done": true/false/null,
  "blood_sugar_self_report": number or null,
  "bp_self_report": "systolic/diastolic" string or null,
  "escalation_flag": true/false,
  "escalation_reason": "reason string if escalation_flag is true, else null",
  "summary": "2-3 sentence clinical summary in English",
  "patient_sentiment": "positive"/"neutral"/"negative"
}}

Rules:
- medication_adherence=false if patient says they missed doses or forgot
- escalation_flag=true if: pain_score>=7, chest symptoms severe, BP>180/110, blood sugar>300, any emergency symptoms
- Extract numbers from Hindi words (e.g., "do tablet" = 2 tablets, "teen din" = 3 days missed)
- If information not mentioned, use null
- Return ONLY the JSON object, no explanation

{memory_context}
Patient condition: {condition}
Transcript: {transcript}"""


# ── Memory-aware prompt suffix ─────────────────────────────
MEMORY_CONTEXT_TEMPLATE = """Patient History Context (use this knowledge to better interpret the transcript):
- Previous symptom trend: {symptom_trend}
- Medication adherence rate: {adherence_rate}%
- Last reported symptoms: {last_symptoms}
- Known concerns: {known_concerns}
"""


def build_memory_context(memory: dict) -> str:
    """Build memory context string for the extraction prompt."""
    if not memory:
        return ""
    return MEMORY_CONTEXT_TEMPLATE.format(
        symptom_trend=memory.get("symptom_trend", "unknown"),
        adherence_rate=round((memory.get("adherence_rate", 0) or 0) * 100, 1),
        last_symptoms=", ".join(memory.get("last_reported_symptoms", []) or []) or "None recorded",
        known_concerns=", ".join(memory.get("known_concerns", []) or []) or "None recorded",
    )


# ── Main Extraction Function ──────────────────────────────
async def extract_clinical_entities(
    transcript: str,
    conditions: list = None,
    language: str = "hi-IN",
    memory: dict = None,
) -> dict:
    """
    Extract structured clinical entities from patient transcript using Groq LLaMA.
    
    Args:
        transcript: Patient's spoken response (Hindi/English)
        conditions: List of known conditions (e.g., ['diabetes', 'hypertension'])
        language: Language code
        memory: Patient memory dict for context-aware extraction
    
    Returns:
        dict with all clinical entity fields
    """
    if not transcript or len(transcript.strip()) < 10:
        logger.warning("Transcript too short for extraction")
        return _default_extraction()

    condition_str = ", ".join(conditions) if conditions else "general"
    memory_context = build_memory_context(memory) if memory else ""

    try:
        client = get_groq_client()
        prompt = EXTRACTION_PROMPT.format(
            condition=condition_str,
            transcript=transcript,
            memory_context=memory_context,
        )

        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=800,
        )

        raw = response.choices[0].message.content.strip()
        logger.debug(f"Groq raw response: {raw[:200]}")

        # Clean and parse JSON
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            result = _validate_and_clean(result)
            logger.success(f"✅ Clinical extraction complete — escalation={result.get('escalation_flag')}")
            return result
        else:
            logger.error("No JSON found in Groq response")
            return _default_extraction()

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return _default_extraction()
    except Exception as e:
        logger.error(f"Groq extraction error: {e}")
        return _default_extraction()


# ── Validation & Cleaning ─────────────────────────────────
def _validate_and_clean(data: dict) -> dict:
    """Validate and normalize extracted fields."""
    cleaned = _default_extraction()

    # Boolean fields
    for field in ["medication_adherence", "dizziness", "blurred_vision",
                  "swelling", "dietary_compliance", "exercise_done", "escalation_flag"]:
        val = data.get(field)
        if isinstance(val, bool):
            cleaned[field] = val
        elif isinstance(val, str):
            cleaned[field] = val.lower() in ("true", "yes", "haan", "1")
        else:
            cleaned[field] = None if field != "escalation_flag" else False

    # Numeric fields
    for field in ["missed_doses_count", "pain_score", "blood_sugar_self_report"]:
        val = data.get(field)
        try:
            cleaned[field] = float(val) if val is not None else None
        except (TypeError, ValueError):
            cleaned[field] = None

    # Pain score range check
    if cleaned["pain_score"] is not None:
        cleaned["pain_score"] = max(0, min(10, int(cleaned["pain_score"])))

    # Enum fields
    valid_fatigue = ["none", "mild", "moderate", "severe"]
    valid_chest = ["none", "mild", "moderate", "severe"]
    valid_sentiment = ["positive", "neutral", "negative"]

    cleaned["fatigue_level"] = data.get("fatigue_level") if data.get("fatigue_level") in valid_fatigue else None
    cleaned["chest_symptom"] = data.get("chest_symptom") if data.get("chest_symptom") in valid_chest else None
    cleaned["patient_sentiment"] = data.get("patient_sentiment", "neutral") if data.get("patient_sentiment") in valid_sentiment else "neutral"

    # String fields
    cleaned["bp_self_report"] = str(data["bp_self_report"]) if data.get("bp_self_report") else None
    cleaned["escalation_reason"] = str(data["escalation_reason"]) if data.get("escalation_reason") else None
    cleaned["summary"] = str(data.get("summary", "Patient follow-up call completed."))

    # Auto-escalate on severe signals
    if (cleaned["pain_score"] and cleaned["pain_score"] >= 7) or \
       cleaned["chest_symptom"] == "severe" or \
       (cleaned["blood_sugar_self_report"] and cleaned["blood_sugar_self_report"] > 300):
        cleaned["escalation_flag"] = True
        if not cleaned["escalation_reason"]:
            cleaned["escalation_reason"] = "Auto-escalated: severe clinical signal detected"

    return cleaned


def _default_extraction() -> dict:
    """Return default extraction with all fields set to safe defaults."""
    return {
        "medication_adherence": None,
        "missed_doses_count": None,
        "pain_score": None,
        "chest_symptom": None,
        "dizziness": None,
        "blurred_vision": None,
        "swelling": None,
        "fatigue_level": None,
        "dietary_compliance": None,
        "exercise_done": None,
        "blood_sugar_self_report": None,
        "bp_self_report": None,
        "escalation_flag": False,
        "escalation_reason": None,
        "summary": "Call completed. No data extracted.",
        "patient_sentiment": "neutral",
    }


# ── Test ───────────────────────────────────────────────────
async def test_extraction():
    """Test with a real Hindi patient transcript."""
    test_transcript = """
    Haan ji, main apni dawai le raha hoon lekin kal do din se bhool gaya.
    Aaj blood sugar check kiya tha, 220 aa raha tha.
    Thoda sir dard hai, sar se 5 number ka dard hai.
    Seene mein halki si takleef lag rahi hai, zyada nahi.
    Khana theek se kha raha hoon, exercise nahi ho rahi.
    """
    logger.info("Testing clinical extraction with Hindi transcript...")
    result = await extract_clinical_entities(test_transcript, ["diabetes", "hypertension"])
    logger.info(f"Result: {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_extraction())