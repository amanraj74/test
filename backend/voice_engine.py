import httpx
import base64
import json
import asyncio
from typing import Optional
from loguru import logger
from backend.config import settings


# ── TTS: Text → Audio (Sarvam Bulbul) ─────────────────────
async def text_to_speech(
    text: str,
    language: str = "hi-IN",
    speaker: str = "anushka",
    speed: float = 1.0,
) -> Optional[bytes]:
    """Convert text to speech using Sarvam Bulbul TTS. Returns raw audio bytes."""
    try:
        payload = {
            "inputs": [text],
            "target_language_code": language,
            "speaker": speaker,
            "pitch": 0,
            "pace": speed,
            "loudness": 1.5,
            "speech_sample_rate": 8000,
            "enable_preprocessing": False,
            "model": "bulbul:v2",
        }
        headers = {
            "api-subscription-key": settings.SARVAM_API_KEY,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(settings.SARVAM_TTS_URL, json=payload, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"TTS status {response.status_code}: {response.text}")
                return None
            
            data = response.json()

        audio_b64 = data.get("audios", [None])[0]
        
        if not audio_b64:
            logger.error(f"TTS no audio. Response keys: {list(data.keys())}")
            return None

        audio_bytes = base64.b64decode(audio_b64)
        logger.info(f"TTS generated {len(audio_bytes)} bytes")
        return audio_bytes

    except Exception as e:
        logger.error(f"TTS error: {e}")
        return None


def text_to_speech_sync(text: str, language: str = "hi-IN", speaker: str = "anushka") -> Optional[bytes]:
    """Sync wrapper for TTS — use in non-async contexts."""
    return asyncio.run(text_to_speech(text, language, speaker))


# ── STT: Audio → Text (Sarvam Saarika v3) ─────────────────
async def speech_to_text(
    audio_bytes: bytes,
    language: str = "hi-IN",
    filename: str = "audio.wav",
) -> Optional[str]:
    """Convert audio bytes to text using Sarvam STT."""
    try:
        headers = {"api-subscription-key": settings.SARVAM_API_KEY}
        files = {"file": (filename, audio_bytes, "audio/wav")}
        data = {
            "model": "saaras:v3",
            "language_code": language,
            "with_timestamps": "false",
            "with_disfluencies": "false"
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                settings.SARVAM_STT_URL,
                headers=headers,
                files=files,
                data=data,
            )
            if response.status_code != 200:
                logger.error(f"STT API Error {response.status_code}: {response.text}")
                return None
            result = response.json()

        transcript = result.get("transcript", "").strip()
        logger.info(f"STT transcript ({language}): {transcript[:100]}...")
        return transcript

    except Exception as e:
        logger.error(f"STT exception: {e}")
        return None


async def speech_to_text_from_file(filepath: str, language: str = "hi-IN") -> Optional[str]:
    """STT from a local audio file path."""
    try:
        with open(filepath, "rb") as f:
            audio_bytes = f.read()
        import os
        filename = os.path.basename(filepath)
        return await speech_to_text(audio_bytes, language, filename)
    except Exception as e:
        logger.error(f"STT file error: {e}")
        return None


# ── Call Scripts ───────────────────────────────────────────
def build_intro_script(patient_name: str, language: str = "hi-IN") -> str:
    """Build personalized intro script for the AI call."""
    scripts = {
        "hi-IN": f"Namaste {patient_name} ji! Main VaaniCare se bol raha hoon. Aapki sehat ke baare mein kuch sawal poochna tha. Kya aap abhi baat kar sakte hain?",
        "bn-IN": f"Namaskar {patient_name}! Ami VaaniCare theke bolchi. Apnar swasthya somporkye kichhu proshn korar chilo. Apni ki ekhon kotha bolte parben?",
        "te-IN": f"Namaskaram {patient_name} garu! Nenu VaaniCare nunchi matladutunna. Meeru ippudu matladaగalara?",
        "ta-IN": f"Vanakkam {patient_name}! Naan VaaniCare-il irunthu pesugiren. Ungal udalnoiyin patri sila kelvikal ketkiren.",
        "mr-IN": f"Namaskar {patient_name}! Mi VaaniCare madhun bolat ahe. Tumhala kahi prashn vicharayache hote.",
    }
    return scripts.get(language, scripts["hi-IN"])


def build_question_scripts(conditions: list, language: str = "hi-IN") -> list:
    """Build condition-specific question scripts."""
    questions_hi = []

    if "diabetes" in conditions:
        questions_hi += [
            "Kya aap apni diabetes ki dawai niyamit le rahe hain?",
            "Kya aapne aaj apna blood sugar check kiya? Kitna tha?",
            "Kya aapko zyada pyaas lag rahi hai ya baar baar peshab aa raha hai?",
        ]

    if "hypertension" in conditions:
        questions_hi += [
            "Kya aap apni blood pressure ki dawai le rahe hain?",
            "Kya aapko sir dard ya chakkar aa raha hai?",
            "Kya aapne aaj BP check kiya?",
        ]

    questions_hi.append("Kya aapko koi aur takleef ho rahi hai jo aap doctor ko batana chahenge?")

    if language == "hi-IN":
        return questions_hi

    # For other languages, return transliterated Hindi for now
    return questions_hi


def build_closing_script(patient_name: str, language: str = "hi-IN") -> str:
    """Build closing script."""
    scripts = {
        "hi-IN": f"Dhanyawad {patient_name} ji! Aapki jaankari doctor ko bhej di gayi hai. Apna khayal rakhein. Namaskar!",
        "bn-IN": f"Dhanyabad {patient_name}! Apnar tothyo doctor ke pathano hoyeche. Bhalo thakun!",
    }
    return scripts.get(language, scripts["hi-IN"])


# ── Demo Audio Generator ───────────────────────────────────
async def generate_demo_audio(patient_name: str, language: str = "hi-IN") -> Optional[bytes]:
    """Generate demo TTS audio for hackathon demo."""
    text = build_intro_script(patient_name, language)
    return await text_to_speech(text, language)


def build_memory_aware_intro(
    patient_name: str,
    memory: dict = None,
    language: str = "hi-IN",
) -> str:
    """
    Build a personalized intro script that references patient memory.
    Falls back to standard intro if no memory available.
    """
    base = build_intro_script(patient_name, language)

    if not memory or not memory.get("personalized_greeting"):
        return base

    return f"{base} {memory['personalized_greeting']}"


# ── Test ───────────────────────────────────────────────────
async def test_tts():
    logger.info("Testing Sarvam TTS...")
    text = "Namaste! Main VaaniCare se bol raha hoon. Kya aap apni dawai niyamit le rahe hain?"
    audio = await text_to_speech(text, language="hi-IN")
    if audio:
        with open("test_output.wav", "wb") as f:
            f.write(audio)
        logger.success(f"✅ TTS working! Audio saved: {len(audio)} bytes → test_output.wav")
    else:
        logger.error("❌ TTS failed")


if __name__ == "__main__":
    asyncio.run(test_tts())