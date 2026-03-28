# 🏥 VaaniCare 2.0 — Indic Voice AI Patient Engagement Platform

> India-ready AI healthcare system for real hospitals.  
> Automatic voice follow-up calls in Hindi • AI clinical extraction • Patient memory  
> Doctor action alerts • FHIR R4 compliance • Real Bihar health camp data

---

## 🧠 What VaaniCare Does

VaaniCare automatically calls patients in Hindi, understands their health responses using AI, remembers their history across calls, and tells doctors exactly what action to take — in real time.

### Flow
```
Patient Data → Risk Engine → Voice Call (Hindi) → AI Understands →
Memory Updated → Doctor Alert → WhatsApp → Dashboard Updates
```

### Cost
- **AI call: ₹0.09** vs **Manual nurse call: ₹50** → **99.8% savings**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Streamlit Dashboard                  │
│               (app.py — your friend builds)             │
└──────────────────┬──────────────────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────────────────┐
│                  FastAPI Backend (8000)                  │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Voice Engine│ │ NLP Extractor│ │ Memory Engine   │  │
│  │ (Sarvam AI) │ │ (Groq LLaMA) │ │ (Patient AI)    │  │
│  ├─────────────┤ ├──────────────┤ ├─────────────────┤  │
│  │ Risk Engine │ │Action Engine │ │ FHIR Mapper     │  │
│  │ (Dynamic)   │ │(Doctor Alert)│ │ (R4 Compliant)  │  │
│  ├─────────────┤ ├──────────────┤ ├─────────────────┤  │
│  │ Scheduler   │ │ Conversation │ │ Admission Engine│  │
│  │ (Auto-Call) │ │(Orchestrator)│ │(Post-Discharge) │  │
│  └─────────────┘ └──────────────┘ └─────────────────┘  │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Supabase (PostgreSQL + Realtime)            │
│  patients │ calls │ observations │ doctor_alerts        │
│  patient_memory │ workflows │ admissions │ follow_ups   │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
VaaniCare/
├── backend/
│   ├── main.py              # FastAPI API routes (25+ endpoints)
│   ├── config.py            # Pydantic settings + env loading
│   ├── supabase_client.py   # Database CRUD operations
│   ├── voice_engine.py      # Sarvam STT/TTS integration
│   ├── nlp_extractor.py     # Groq LLaMA clinical extraction
│   ├── memory_engine.py     # 🧠 Patient Memory AI
│   ├── action_engine.py     # Doctor action/alert generation
│   ├── risk_engine.py       # Dynamic risk scoring
│   ├── scheduler.py         # Auto-call scheduling
│   ├── conversation.py      # Full call pipeline orchestrator
│   ├── fhir_mapper.py       # FHIR R4 bundle generation
│   ├── admission_engine.py  # Hospital admission management
│   ├── voice_intake.py      # Voice-based patient registration
│   ├── sarvam_client.py     # Standalone Sarvam API client
│   └── seed_from_csv.py     # CSV → Supabase bulk loader
├── dashboard/
│   └── app.py               # Streamlit dashboard (DO NOT TOUCH)
├── supabase/
│   └── schema.sql           # Full database schema (8 tables)
├── data/
│   ├── seed.py              # Sample data seeder
│   └── jilo_health_data.csv # Real Bihar health camp data (121 patients)
├── docs/
│   ├── architecture.md
│   ├── api_reference.md
│   └── one_pager.md
├── .env                     # API keys (gitignored)
├── .env.example             # Template
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd VaaniCare
pip install -r requirements.txt
```

### 2. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your API keys:
# - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# - SARVAM_API_KEY
# - GROQ_API_KEY
```

### 3. Set Up Database
- Go to Supabase → SQL Editor
- Run `supabase/schema.sql`
- This creates all 8 tables + indexes + triggers

### 4. Seed Data
```bash
python data/seed.py
```
This loads 10 sample patients + memory data + call workflows.

For real Bihar health camp data:
```bash
python backend/seed_from_csv.py
```

### 5. Start Backend
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Test
Open [http://localhost:8000/docs](http://localhost:8000/docs) for Swagger UI.

### 7. React Frontend (replaces Streamlit)
```bash
cd frontend
cp .env.example .env   # set VITE_API_BASE_URL (default http://localhost:8000)
npm install
npm run dev            # start Vite dev server
# npm run build        # production bundle
```
The React UI calls the same FastAPI endpoints used by the Streamlit dashboard (patients, alerts, dashboard stats, calls).

---

## 🔌 API Endpoints

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients` | List all patients |
| GET | `/patients/high-risk` | High risk patients |
| GET | `/patients/{id}` | Get patient details |
| GET | `/patients/{id}/calls` | Call history |
| GET | `/patients/{id}/observations` | Observation history |

### Patient Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients/{id}/memory` | Memory summary + trends |
| GET | `/patients/{id}/memory/timeline` | Call history timeline |
| GET | `/patients/{id}/memory/context` | NLP context data |

### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calls/trigger` | Trigger a call (full pipeline) |
| GET | `/calls/{id}` | Call details with observation |

### FHIR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calls/{id}/fhir` | FHIR R4 bundle for call |
| GET | `/patients/{id}/fhir` | Latest FHIR for patient |

### Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/voice/stt` | Speech to text |
| POST | `/voice/tts` | Text to speech |
| POST | `/voice/intake` | Voice patient registration |

### NLP
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/nlp/extract` | Extract clinical entities |

### Alerts & Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts` | Unacknowledged alerts |
| POST | `/alerts/{id}/acknowledge` | Acknowledge alert |
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/dashboard/calls` | Recent calls |
| GET | `/dashboard/cost-analysis` | AI vs manual cost |
| GET | `/dashboard/schedule` | Upcoming call schedule |
| GET | `/dashboard/due-calls` | Patients due for calls |

### Risk
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/patients/{id}/risk/recalculate` | Recalculate risk |

---

## 🧩 Core Modules

### 🧠 Patient Memory AI (`memory_engine.py`)
- Stores last 5 call summaries per patient
- Tracks symptom trend (improving / stable / worsening)
- Calculates medication adherence rate
- Generates personalized Hindi greetings:
  > *"Pichhli baar aapne seene mein dard bataya tha — ab kaisa hai?"*

### 🎯 Risk Engine (`risk_engine.py`)
Multi-factor dynamic scoring using:
- Base vitals (BP, glucose, BMI, age)
- Latest observation (pain, chest, adherence)
- Memory trends (worsening = higher risk)
- Auto-adjusts call frequency (CRITICAL → daily, LOW → biweekly)

### 🩺 Action Engine (`action_engine.py`)
- **CRITICAL** → Immediate alert + WhatsApp + home visit
- **MODERATE** → Follow-up in 24 hours
- **ROUTINE** → Continue monitoring
- Generates Hindi patient instructions

### 🔄 Conversation Manager (`conversation.py`)
Full pipeline orchestrator:
```
Greeting → STT → NLP → Observation → FHIR → Memory → Risk → Alert → Schedule
```

### 📋 FHIR Mapper (`fhir_mapper.py`)
- ABDM/NDHM compliant FHIR R4 bundles
- Patient, Encounter, Observation, Condition resources
- LOINC + SNOMED coded observations

---

## 🗃️ Database Schema

8 tables in Supabase PostgreSQL:

| Table | Purpose |
|-------|---------|
| `patients` | Patient demographics + vitals + risk |
| `calls` | Call records with transcripts |
| `observations` | NLP extracted clinical data |
| `doctor_alerts` | Urgency alerts for doctors |
| `patient_memory` | AI memory across calls |
| `workflows` | Call question templates |
| `admissions` | Hospital admission tracking |
| `follow_up_schedule` | Post-discharge follow-ups |

---

## 🎤 Demo Flow

1. Select a high-risk patient from `/patients/high-risk`
2. Trigger call: `POST /calls/trigger` with `{"patient_id": "...", "demo_mode": true}`
3. System generates memory-aware greeting
4. Simulates patient response in Hindi
5. Groq LLaMA extracts: symptoms, severity, adherence
6. Memory updated with new call data
7. Risk recalculated dynamically
8. Doctor alert created (CRITICAL/MODERATE/ROUTINE)
9. WhatsApp notification sent (or simulated in demo)
10. FHIR R4 bundle generated
11. Dashboard updates in realtime

---

## 📝 What Changed (v2.0 Upgrade)

### New Modules (were empty)
- ✅ `memory_engine.py` — Full patient memory AI with trend analysis
- ✅ `risk_engine.py` — Multi-factor dynamic risk scoring
- ✅ `scheduler.py` — Auto-call scheduling with batch processing
- ✅ `conversation.py` — Full call pipeline orchestrator

### Fixed
- ✅ `schema.sql` — Rewrote clean SQL (was corrupted with repeated text)
- ✅ `nlp_extractor.py` — Fixed async/sync mismatch (was sync, called as async)
- ✅ `supabase_client.py` — Removed bare module-level API call

### Upgraded
- ✅ `main.py` — 25+ endpoints (was 12), full module integration
- ✅ `action_engine.py` — Hindi patient instructions
- ✅ `voice_engine.py` — Memory-aware intro scripts
- ✅ `supabase_client.py` — New CRUD helpers (observations, cost stats, call joins)
- ✅ `data/seed.py` — Memory data + post-discharge workflow seeding

### Added
- ✅ `admissions` + `follow_up_schedule` tables in schema
- ✅ 19 indexes for query performance
- ✅ Auto-update triggers for `updated_at`
- ✅ Voice intake endpoint for patient registration

---

## 🔑 API Keys Required

| Service | Key | Purpose |
|---------|-----|---------|
| Supabase | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Database |
| Sarvam AI | `SARVAM_API_KEY` | Hindi STT/TTS |
| Groq | `GROQ_API_KEY` | LLaMA NLP extraction |
| Twilio | `TWILIO_*` (optional) | WhatsApp alerts |

---

## 🏆 What Makes This Different

| Feature | Others | VaaniCare |
|---------|--------|-----------|
| Voice AI in Hindi | Basic chatbot | Real Sarvam STT/TTS |
| Patient Memory | ❌ | ✅ Trend tracking across calls |
| Doctor Actions | ❌ | ✅ CRITICAL/MODERATE/ROUTINE |
| Real Data | ❌ | ✅ Bihar health camp CSV |
| Live Alerts | ❌ | ✅ WhatsApp + Dashboard |
| FHIR Compliance | ❌ | ✅ ABDM/NDHM R4 bundles |
| Dynamic Risk | ❌ | ✅ Multi-factor scoring |
| Cost Module | ❌ | ✅ ₹0.09 vs ₹50 comparison |

---

*Built for Hackmatrix 2.0 @ IIT Patna*
