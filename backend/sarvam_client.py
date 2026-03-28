import httpx
import base64
import os
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")


async def transcribe_audio(audio_bytes: bytes, language: str = "hi-IN") -> str:
    """STT via Sarvam saarika:v2"""
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://api.sarvam.ai/speech-to-text",
            headers={"api-subscription-key": SARVAM_API_KEY},
            # DO NOT set Content-Type manually — httpx sets it with boundary for multipart
            files={"file": ("audio.wav", audio_bytes, "audio/wav")},
            data={
                "language_code": language,
                "model": "saarika:v2",
            }
        )
        if response.status_code != 200:
            raise Exception(f"Sarvam STT 400: {response.text}")
        return response.json().get("transcript", "")


async def text_to_speech(text: str, language: str = "hi-IN", speaker: str = "anushka") -> bytes:
    """TTS via Sarvam Bulbul"""
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "inputs": [text[:500]],  # Sarvam has char limit
                "target_language_code": language,
                "speaker": speaker,
                "model": "bulbul:v2",
                "enable_preprocessing": True,
            }
        )
        if response.status_code != 200:
            raise Exception(f"Sarvam TTS 400: {response.text}")
        audio_b64 = response.json()["audios"][0]
        return base64.b64decode(audio_b64)