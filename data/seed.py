import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pandas as pd
from datetime import datetime, timedelta
import random
import json
from backend.supabase_client import get_client
from loguru import logger

# ── Sample Patients ────────────────────────────────────────
SAMPLE_PATIENTS = [
    {"name": "Ramesh Kumar", "phone": "+919876543210", "age": 58, "gender": "male", "language": "hi-IN",
     "condition": ["diabetes", "hypertension"], "risk_score": 0.87, "risk_tier": "CRITICAL",
     "hba1c": 9.2, "systolic_bp": 165, "diastolic_bp": 98, "fasting_glucose": 210.0, "bmi": 28.4,
     "district": "Patna", "camp_id": "CAMP001"},

    {"name": "Sunita Devi", "phone": "+919876543211", "age": 52, "gender": "female", "language": "hi-IN",
     "condition": ["diabetes"], "risk_score": 0.74, "risk_tier": "HIGH",
     "hba1c": 8.1, "systolic_bp": 142, "diastolic_bp": 88, "fasting_glucose": 185.0, "bmi": 31.2,
     "district": "Nalanda", "camp_id": "CAMP001"},

    {"name": "Mohan Prasad", "phone": "+919876543212", "age": 65, "gender": "male", "language": "hi-IN",
     "condition": ["hypertension"], "risk_score": 0.68, "risk_tier": "HIGH",
     "hba1c": None, "systolic_bp": 158, "diastolic_bp": 95, "fasting_glucose": None, "bmi": 25.8,
     "district": "Gaya", "camp_id": "CAMP002"},

    {"name": "Priya Sharma", "phone": "+919876543213", "age": 45, "gender": "female", "language": "hi-IN",
     "condition": ["diabetes", "hypertension"], "risk_score": 0.55, "risk_tier": "MODERATE",
     "hba1c": 7.4, "systolic_bp": 135, "diastolic_bp": 82, "fasting_glucose": 155.0, "bmi": 27.1,
     "district": "Muzaffarpur", "camp_id": "CAMP002"},

    {"name": "Arun Singh", "phone": "+919876543214", "age": 48, "gender": "male", "language": "hi-IN",
     "condition": ["diabetes"], "risk_score": 0.42, "risk_tier": "MODERATE",
     "hba1c": 7.0, "systolic_bp": 128, "diastolic_bp": 79, "fasting_glucose": 142.0, "bmi": 24.5,
     "district": "Bhagalpur", "camp_id": "CAMP003"},

    {"name": "Geeta Kumari", "phone": "+919876543215", "age": 38, "gender": "female", "language": "hi-IN",
     "condition": ["hypertension"], "risk_score": 0.31, "risk_tier": "LOW",
     "hba1c": None, "systolic_bp": 125, "diastolic_bp": 76, "fasting_glucose": None, "bmi": 22.8,
     "district": "Darbhanga", "camp_id": "CAMP003"},

    {"name": "Vijay Yadav", "phone": "+919876543216", "age": 61, "gender": "male", "language": "hi-IN",
     "condition": ["diabetes", "hypertension"], "risk_score": 0.91, "risk_tier": "CRITICAL",
     "hba1c": 10.5, "systolic_bp": 178, "diastolic_bp": 105, "fasting_glucose": 245.0, "bmi": 29.7,
     "district": "Patna", "camp_id": "CAMP001"},

    {"name": "Meena Gupta", "phone": "+919876543217", "age": 55, "gender": "female", "language": "hi-IN",
     "condition": ["diabetes"], "risk_score": 0.63, "risk_tier": "HIGH",
     "hba1c": 7.9, "systolic_bp": 138, "diastolic_bp": 85, "fasting_glucose": 172.0, "bmi": 30.1,
     "district": "Sitamarhi", "camp_id": "CAMP004"},

    {"name": "Rakesh Paswan", "phone": "+919876543218", "age": 43, "gender": "male", "language": "hi-IN",
     "condition": ["hypertension"], "risk_score": 0.48, "risk_tier": "MODERATE",
     "hba1c": None, "systolic_bp": 145, "diastolic_bp": 90, "fasting_glucose": None, "bmi": 26.3,
     "district": "Vaishali", "camp_id": "CAMP004"},

    {"name": "Savita Mahto", "phone": "+919876543219", "age": 67, "gender": "female", "language": "hi-IN",
     "condition": ["diabetes", "hypertension"], "risk_score": 0.85, "risk_tier": "CRITICAL",
     "hba1c": 9.8, "systolic_bp": 170, "diastolic_bp": 100, "fasting_glucose": 225.0, "bmi": 27.6,
     "district": "Begusarai", "camp_id": "CAMP005"},
]


def calculate_next_call(risk_tier: str) -> str:
    days_map = {"CRITICAL": 1, "HIGH": 3, "MODERATE": 7, "LOW": 14}
    days = days_map.get(risk_tier, 7)
    next_call = datetime.utcnow() + timedelta(days=days)
    return next_call.isoformat()


def seed_patients():
    """Seed sample patients into Supabase."""
    client = get_client()
    logger.info(f"Seeding {len(SAMPLE_PATIENTS)} patients...")

    for patient in SAMPLE_PATIENTS:
        patient["next_call_at"] = calculate_next_call(patient["risk_tier"])
        patient["call_frequency_days"] = {"CRITICAL": 1, "HIGH": 3, "MODERATE": 7, "LOW": 14}[patient["risk_tier"]]
        patient["state"] = "Bihar"
        patient["total_calls"] = 0

    result = client.table("patients").insert(SAMPLE_PATIENTS).execute()

    if result.data:
        logger.success(f"✅ Seeded {len(result.data)} patients successfully!")
        for p in result.data:
            logger.info(f"  → {p['name']} | {p['risk_tier']} | Risk: {p['risk_score']}")
    else:
        logger.error("❌ Patient seeding failed")

    return result.data


def seed_patient_memory():
    """Seed sample patient memory data for demo purposes."""
    client = get_client()
    patients = client.table("patients").select("id, name, risk_tier, condition").execute().data
    if not patients:
        logger.warning("No patients found — seed patients first")
        return

    logger.info("Seeding patient memory...")
    count = 0
    for patient in patients[:5]:  # Memory for first 5 patients
        call_history = [
            {
                "call_id": "seed-call-1",
                "timestamp": (datetime.utcnow() - timedelta(days=7)).isoformat(),
                "summary": "Patient reported mild chest discomfort and missed 1 dose of medication.",
                "medication_adherence": False,
                "pain_score": 4,
                "chest_symptom": "mild",
                "blood_sugar": 180.0 if "diabetes" in patient.get("condition", []) else None,
                "escalation_flag": False,
                "sentiment": "neutral",
            },
            {
                "call_id": "seed-call-2",
                "timestamp": (datetime.utcnow() - timedelta(days=14)).isoformat(),
                "summary": "Patient was compliant with medication. No major symptoms reported.",
                "medication_adherence": True,
                "pain_score": 2,
                "chest_symptom": "none",
                "blood_sugar": 150.0 if "diabetes" in patient.get("condition", []) else None,
                "escalation_flag": False,
                "sentiment": "positive",
            },
        ]

        memory_data = {
            "patient_id": patient["id"],
            "last_call_summary": call_history[0]["summary"],
            "symptom_trend": "stable",
            "adherence_rate": 0.5,
            "total_adherent_calls": 1,
            "total_calls_analyzed": 2,
            "last_reported_symptoms": ["chest_mild", "missed_medication"],
            "known_concerns": ["chest_mild", "missed_medication"],
            "personalized_greeting": "Pichhli baar aapne seene mein halki taklif batai thi — ab kaisa hai?",
            "call_history": json.dumps(call_history),
        }

        try:
            client.table("patient_memory").upsert(memory_data, on_conflict="patient_id").execute()
            count += 1
            logger.info(f"  → Memory seeded for {patient['name']}")
        except Exception as e:
            logger.error(f"  ✗ Memory seed failed for {patient['name']}: {e}")

    logger.success(f"✅ Seeded memory for {count} patients")


def seed_default_workflow():
    """Seed default call workflows."""
    client = get_client()
    workflows = [
        {
            "name": "Diabetes Follow-up Hindi",
            "condition": "diabetes",
            "language": "hi-IN",
            "call_frequency": 7,
            "questions": [
                {"id": 1, "text": "Kya aap apni dawai niyamit le rahe hain?", "type": "boolean"},
                {"id": 2, "text": "Aaj aapka blood sugar kitna hai?", "type": "number"},
                {"id": 3, "text": "Kya aapko koi takleef ho rahi hai?", "type": "text"},
            ]
        },
        {
            "name": "Hypertension Follow-up Hindi",
            "condition": "hypertension",
            "language": "hi-IN",
            "call_frequency": 7,
            "questions": [
                {"id": 1, "text": "Kya aap BP ki dawai le rahe hain?", "type": "boolean"},
                {"id": 2, "text": "Aaj aapka blood pressure kitna hai?", "type": "text"},
                {"id": 3, "text": "Kya aapko sir dard ya chakkar aa raha hai?", "type": "boolean"},
            ]
        },
        {
            "name": "Post-Discharge Follow-up Hindi",
            "condition": "post_discharge",
            "language": "hi-IN",
            "call_frequency": 3,
            "questions": [
                {"id": 1, "text": "Aap hospital se aane ke baad kaisa mehsoos kar rahe hain?", "type": "text"},
                {"id": 2, "text": "Kya aap doctor ki di gayi sab dawai le rahe hain?", "type": "boolean"},
                {"id": 3, "text": "Kya aapko bukhar, dard ya koi nayi taklif ho rahi hai?", "type": "text"},
            ]
        }
    ]
    result = client.table("workflows").insert(workflows).execute()
    if result.data:
        logger.success(f"✅ Seeded {len(result.data)} workflows!")


if __name__ == "__main__":
    logger.info("🌱 Starting VaaniCare 2.0 full data seed...")
    seed_patients()
    seed_patient_memory()
    seed_default_workflow()
    logger.success("🎉 Seed complete! All sample data loaded.")