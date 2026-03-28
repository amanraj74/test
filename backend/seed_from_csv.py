import sys, os
# ── Standalone: load .env directly, bypass Pydantic settings ──
from dotenv import load_dotenv

# Load .env from project root (works from any directory)
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

import pandas as pd
import numpy as np

# ── Load CSV (try multiple paths) ──────────────────────────────
csv_paths = [
    os.path.join(os.path.dirname(__file__), '..', 'jilo_health_data.csv'),
    os.path.join(os.path.dirname(__file__), 'jilo_health_data.csv'),
    'jilo_health_data.csv',
]
df = None
for p in csv_paths:
    if os.path.exists(p):
        df = pd.read_csv(p)
        print(f"✅ Loaded CSV from: {p}")
        break

if df is None:
    print("❌ jilo_health_data.csv not found. Place it in VaaniCare/ root.")
    sys.exit(1)

df = df.replace({np.nan: None})
df = df[df["overall_risk_score"].notna()]

# ── Helpers ────────────────────────────────────────────────────
def map_risk_tier(level):
    return {"High": "CRITICAL", "Moderate": "HIGH", "Low": "MODERATE"}.get(str(level).strip(), "LOW")

def detect_conditions(row):
    conds = []
    try:
        if float(row.get("blood_glucose") or 0) > 126: conds.append("diabetes")
    except: pass
    try:
        if float(row.get("systolic_bp") or 0) > 140: conds.append("hypertension")
    except: pass
    bmi = str(row.get("bmi_category") or "")
    if "Obese" in bmi or "Overweight" in bmi: conds.append("obesity")
    return conds if conds else ["general"]

def extract_district(camp_name):
    name = str(camp_name or "")
    districts = {"Gandhi": "Patna", "Digha": "Patna", "Aashrya": "Patna", "Disha": "Patna"}
    for k, v in districts.items():
        if k in name: return v
    return "Bihar"

bihar_names = [
    "Ramesh Kumar","Sunita Devi","Mohan Prasad","Kavita Singh","Vijay Yadav",
    "Geeta Kumari","Arun Sharma","Pooja Devi","Suresh Paswan","Anita Verma",
    "Rakesh Gupta","Meena Devi","Dinesh Tiwari","Usha Kumari","Santosh Yadav",
    "Pushpa Devi","Arvind Kumar","Lalita Devi","Bharat Singh","Mamta Kumari",
    "Rajendra Prasad","Shobha Devi","Manoj Kumar","Kamla Devi","Deepak Raj",
    "Saroj Kumari","Naresh Yadav","Reena Devi","Umesh Kumar","Sarita Devi",
]

# ── Build patient records ──────────────────────────────────────
patients = []
for i, (_, row) in enumerate(df.iterrows()):
    def safe_float(val):
        try: return float(val) if val is not None else None
        except: return None
    def safe_int(val):
        try: return int(float(val)) if val is not None else None
        except: return None

    risk_score = safe_float(row.get("overall_risk_score")) or 0
    sbp = safe_int(row.get("systolic_bp"))
    dbp = safe_int(row.get("diastolic_bp"))
    bg  = safe_float(row.get("blood_glucose"))
    bmi = safe_float(row.get("bmi"))

    patients.append({
        "name": bihar_names[i % len(bihar_names)],
        "age": 35 + (i % 40),
        "phone": f"+91 9{8 + i%2}{str(i+10).zfill(2)}{str(i*7+1000)[:5]}",
        "condition": detect_conditions(row),
        "risk_tier": map_risk_tier(row.get("overall_risk_category", "Low")),
        "risk_score": round(risk_score / 100.0, 3),
        "systolic_bp": sbp if sbp and 60 < sbp < 300 else None,
        "diastolic_bp": dbp if dbp and 40 < dbp < 200 else None,
        "blood_glucose": bg if bg and bg > 0 else None,
        "bmi": bmi if bmi and bmi > 0 else None,
        "district": extract_district(row.get("health_camp_name", "")),
        "health_camp": str(row.get("health_camp_name", ""))[:80],
        "chest_discomfort": str(row.get("chest_discomfort") or "none"),
        "heart_risk_level": str(row.get("heart_risk_level") or "Low"),
        "diabetic_risk_level": str(row.get("diabetic_risk_level") or "Low"),
        "hypertension_risk_level": str(row.get("hypertension_risk_level") or "Low"),
    })

# ── Wipe old data & insert ─────────────────────────────────────
print("🗑️  Clearing old patients...")
supabase.table("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

print(f"📥 Inserting {len(patients)} patients...")
batch = 20
for i in range(0, len(patients), batch):
    supabase.table("patients").insert(patients[i:i+batch]).execute()
    print(f"   ✅ {min(i+batch, len(patients))}/{len(patients)}")

print(f"\n🎉 Done! {len(patients)} real Bihar health camp patients loaded.")