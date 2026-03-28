import os, json
from datetime import date, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

FOLLOW_UP_SCHEDULE = {
    "day1":  1,
    "day3":  3,
    "day7":  7,
    "day30": 30,
}

def create_admission(patient_id: str, hospital: str, ward: str,
                     admission_date: str, diagnosis: str, doctor: str = None, reason: str = None) -> dict:
    """Register a new hospital admission and auto-schedule follow-ups"""
    record = {
        "patient_id": patient_id,
        "hospital_name": hospital,
        "ward": ward,
        "admission_date": admission_date,
        "primary_diagnosis": diagnosis,
        "attending_doctor": doctor,
        "admission_reason": reason,
        "status": "admitted"
    }
    result = supabase.table("admissions").insert(record).execute()
    admission = result.data[0]
    admission_id = admission["id"]

    # Auto-schedule all 4 follow-up calls
    schedules = []
    base = date.fromisoformat(admission_date)
    for ftype, days in FOLLOW_UP_SCHEDULE.items():
        schedules.append({
            "patient_id": patient_id,
            "admission_id": admission_id,
            "scheduled_date": str(base + timedelta(days=days)),
            "follow_up_type": ftype,
            "status": "pending"
        })
    supabase.table("follow_up_schedule").insert(schedules).execute()
    return admission

def get_admissions_with_patients() -> list:
    result = supabase.table("admissions")\
        .select("*, patients(name, phone, condition, risk_tier, risk_score, district)")\
        .order("admission_date", desc=True)\
        .execute()
    return result.data or []

def get_due_followups(days_ahead: int = 3) -> list:
    """Get follow-ups due in next N days"""
    today = date.today()
    cutoff = str(today + timedelta(days=days_ahead))
    result = supabase.table("follow_up_schedule")\
        .select("*, patients(name, phone, condition, risk_tier), admissions(hospital_name, primary_diagnosis)")\
        .eq("status", "pending")\
        .lte("scheduled_date", cutoff)\
        .gte("scheduled_date", str(today))\
        .order("scheduled_date")\
        .execute()
    return result.data or []

def get_all_followups_for_admission(admission_id: str) -> list:
    result = supabase.table("follow_up_schedule")\
        .select("*")\
        .eq("admission_id", admission_id)\
        .order("scheduled_date")\
        .execute()
    return result.data or []

def update_followup_result(followup_id: str, transcript: str,
                            nlp_result: dict, recovery_status: str, urgency: str) -> dict:
    result = supabase.table("follow_up_schedule").update({
        "status": "completed",
        "call_transcript": transcript,
        "nlp_result": nlp_result,
        "recovery_status": recovery_status,
        "urgency_triggered": urgency,
        "completed_at": "now()"
    }).eq("id", followup_id).execute()
    return result.data[0] if result.data else {}

def discharge_patient(admission_id: str, discharge_date: str, notes: str = "") -> dict:
    result = supabase.table("admissions").update({
        "status": "discharged",
        "discharge_date": discharge_date,
        "notes": notes
    }).eq("id", admission_id).execute()

    # Cancel pending follow-ups before discharge date
    supabase.table("follow_up_schedule")\
        .update({"status": "rescheduled"})\
        .eq("admission_id", admission_id)\
        .eq("status", "pending")\
        .lt("scheduled_date", discharge_date)\
        .execute()

    return result.data[0] if result.data else {}

def get_admission_stats() -> dict:
    all_adm = supabase.table("admissions").select("status").execute().data or []
    all_fu = supabase.table("follow_up_schedule").select("status, recovery_status").execute().data or []

    return {
        "total_admissions": len(all_adm),
        "currently_admitted": sum(1 for a in all_adm if a["status"] == "admitted"),
        "discharged": sum(1 for a in all_adm if a["status"] == "discharged"),
        "critical": sum(1 for a in all_adm if a["status"] == "critical"),
        "pending_followups": sum(1 for f in all_fu if f["status"] == "pending"),
        "completed_followups": sum(1 for f in all_fu if f["status"] == "completed"),
        "deteriorating": sum(1 for f in all_fu if f.get("recovery_status") == "deteriorating"),
    }