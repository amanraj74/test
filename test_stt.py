import asyncio
import httpx
import wave
import struct
import os
from backend.config import settings

def create_dummy_wav(filename="dummy.wav"):
    """Creates a 1-second silent WAV file for testing."""
    num_samples = 8000
    sample_rate = 8000
    comptype = "NONE"
    compname = "not compressed"
    num_channels = 1
    sampwidth = 2
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setparams((num_channels, sampwidth, sample_rate, num_samples, comptype, compname))
        for _ in range(num_samples):
            wav_file.writeframes(struct.pack('h', 0))

async def test_stt():
    print(f"Testing Sarvam STT with key: {settings.SARVAM_API_KEY[:5]}...***")
    
    # 1. Create a dummy wav file
    create_dummy_wav("dummy.wav")
    
    # 2. Read it
    with open("dummy.wav", "rb") as f:
        audio_bytes = f.read()
        
    # 3. Call Sarvam API exactly like our backend does
    headers = {"api-subscription-key": settings.SARVAM_API_KEY}
    files = {"file": ("dummy.wav", audio_bytes, "audio/wav")}
    data = {
        "model": "saaras:v3",
        "language_code": "hi-IN",
        "with_timestamps": "false",
        "with_disfluencies": "false"
    }
    
    print("\nSending request to Sarvam API...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.SARVAM_STT_URL,
            headers=headers,
            files=files,
            data=data,
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            print("\n✅ SUCCESS! STT is working.")
        else:
            print("\n❌ FAILED! Check the response body above for the reason.")
            
    # Cleanup
    if os.path.exists("dummy.wav"):
        os.remove("dummy.wav")

if __name__ == "__main__":
    asyncio.run(test_stt())
