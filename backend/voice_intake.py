import os, json, re, httpx
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

INTAKE_PROMPT = """You are a clinical intake assistant for rural Bihar health camps.
Extract patient registration information from the spoken Hindi/English transcript.

Return ONLY valid JSON:
{
  "name": "patient full name or null",
  "age": number or null,
  "gender": "male/female/other or null",
  "phone": "10-digit number or null",
  "village": "village/locality name or null",
  "district": "district name or null",
  "chief_complaint": "main reason for visit in English",
  "symptom_duration": "how long symptoms (e.g. '3 days', '2 weeks') or null",
  "known_conditions": ["diabetes","hypertension","heart_disease","asthma","obesity","other"],
  "current_medications": ["medication names"] or [],
  "allergies": "any mentioned allergies or null",
  "emergency_contact": "name and number if mentioned or null",
  "blood_group": "blood group if mentioned or null",
  "confidence": 0.0-1.0,
  "missing_critical": ["list of fields not mentioned that are critical"]
}"""

def transcribe_audio_sarvam(audio_bytes: bytes, language: str = "hi-IN") -> dict:
    """Send audio to Sarvam STT API"""
    try:
        files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
        data = {
            "model": "saaras:v3",
            "language_code": language,
            "with_timestamps": "false",
            "with_disfluencies": "false"
        }
        headers = {"api-subscription-key": SARVAM_API_KEY}
        response = httpx.post(
            "https://api.sarvam.ai/speech-to-text",
            files=files, data=data, headers=headers, timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            return {"success": True, "transcript": result.get("transcript", ""), "language": language}
        return {"success": False, "error": f"Sarvam API error: {response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def extract_intake_entities(transcript: str, language: str = "hi-IN") -> dict:
    """Extract patient data from intake transcript using Groq"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": INTAKE_PROMPT},
                {"role": "user", "content": f"Language: {language}\nTranscript: {transcript}"}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        raw = response.choices[0].message.content
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e), "confidence": 0.0}

def calculate_intake_risk(extracted: dict) -> tuple[str, float]:
    """Calculate initial risk tier from intake data"""
    score = 0.3  # baseline
    conditions = extracted.get("known_conditions", [])
    complaint = (extracted.get("chief_complaint") or "").lower()

    if "diabetes" in conditions: score += 0.2
    if "hypertension" in conditions: score += 0.2
    if "heart_disease" in conditions: score += 0.25

    critical_keywords = ["chest pain", "breathlessness", "unconscious", "stroke", "seizure"]
    if any(k in complaint for k in critical_keywords): score += 0.3

    moderate_keywords = ["fever", "vomiting", "pain", "weakness", "dizzy"]
    if any(k in complaint for k in moderate_keywords): score += 0.1

    score = min(score, 1.0)

    if score >= 0.75: tier = "CRITICAL"
    elif score >= 0.55: tier = "HIGH"
    elif score >= 0.35: tier = "MODERATE"
    else: tier = "LOW"

    return tier, round(score, 3)

def build_patient_record(extracted: dict, language: str) -> dict:
    """Convert extracted intake data to patients table format"""
    tier, score = calculate_intake_risk(extracted)
    conditions = extracted.get("known_conditions", []) or ["general"]

    district = extracted.get("district") or extracted.get("village") or "Bihar"

    return {
        "name": extracted.get("name") or "Unknown Patient",
        "age": extracted.get("age"),
        "phone": extracted.get("phone"),
        "condition": conditions,
        "risk_tier": tier,
        "risk_score": score,
        "district": district,
        "health_camp": "Voice Intake",
        "chest_discomfort": "none",
        "heart_risk_level": "High" if "heart_disease" in conditions else "Low",
        "diabetic_risk_level": "High" if "diabetes" in conditions else "Low",
        "hypertension_risk_level": "High" if "hypertension" in conditions else "Low",
    }

DEMO_TRANSCRIPTS = {
    "hi-IN": "Namaste, mera naam Suresh Paswan hai. Meri umar 52 saal hai. Main Patna ke Phulwari sharif se hoon. Mujhe kaafi dino se seene mein dard ho raha hai aur saas lene mein taklif hoti hai. Mujhe sugar bhi hai aur BP bhi high rehta hai. Mera phone number hai 9876543210.",
    "en-IN": "Hello, my name is Ramesh Kumar. I am 45 years old. I live in Digha, Patna. I have been having chest pain and dizziness for the past 3 days. I am diabetic and take metformin daily. My phone is 9812345678.",
    "bn-IN": "Amar naam Meena Devi. Amar boyos 38 bochor. Ami Patna-te thaki. Amar diabetes ache ebong pressure beshi thake. Ki kore bhalo hobo?",
}