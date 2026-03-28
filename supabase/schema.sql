-- ============================================================
-- VaaniCare 2.0 — Supabase Schema (Clean)
-- Run this entire file in Supabase → SQL Editor → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: patients
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    phone               TEXT NOT NULL,
    age                 INTEGER,
    gender              TEXT CHECK (gender IN ('male', 'female', 'other')),
    language            TEXT NOT NULL DEFAULT 'hi-IN',
    condition           TEXT[],                          -- ['diabetes', 'hypertension']
    risk_score          FLOAT NOT NULL DEFAULT 0.0,      -- 0.0 to 1.0
    risk_tier           TEXT NOT NULL DEFAULT 'LOW'
                        CHECK (risk_tier IN ('CRITICAL', 'HIGH', 'MODERATE', 'LOW')),
    blood_glucose       FLOAT,
    hba1c               FLOAT,
    systolic_bp         INTEGER,
    diastolic_bp        INTEGER,
    fasting_glucose     FLOAT,
    bmi                 FLOAT,
    chest_discomfort    TEXT DEFAULT 'none',
    heart_risk_level    TEXT DEFAULT 'Low',
    diabetic_risk_level TEXT DEFAULT 'Low',
    hypertension_risk_level TEXT DEFAULT 'Low',
    health_camp         TEXT,
    last_call_at        TIMESTAMPTZ,
    next_call_at        TIMESTAMPTZ,
    total_calls         INTEGER DEFAULT 0,
    call_frequency_days INTEGER NOT NULL DEFAULT 7,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    camp_id             TEXT,
    district            TEXT,
    state               TEXT DEFAULT 'Bihar',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: calls
-- ============================================================
CREATE TABLE IF NOT EXISTS calls (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    call_type       TEXT NOT NULL DEFAULT 'FOLLOW_UP'
                    CHECK (call_type IN ('FOLLOW_UP', 'INTAKE', 'EMERGENCY', 'SCHEDULED')),
    status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DEMO')),
    language_used   TEXT NOT NULL DEFAULT 'hi-IN',
    duration_sec    INTEGER,
    transcript      TEXT,
    audio_url       TEXT,
    demo_mode       BOOLEAN NOT NULL DEFAULT FALSE,
    cost_inr        FLOAT DEFAULT 0.0,
    cost_manual_inr FLOAT DEFAULT 50.0,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 3: observations
-- ============================================================
CREATE TABLE IF NOT EXISTS observations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id                 UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- NLP Extracted clinical entities
    medication_adherence    BOOLEAN,
    missed_doses_count      INTEGER,
    pain_score              INTEGER CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10)),
    chest_symptom           TEXT CHECK (chest_symptom IS NULL OR chest_symptom IN ('none', 'mild', 'moderate', 'severe')),
    dizziness               BOOLEAN,
    blurred_vision          BOOLEAN,
    swelling                BOOLEAN,
    fatigue_level           TEXT CHECK (fatigue_level IS NULL OR fatigue_level IN ('none', 'mild', 'moderate', 'severe')),
    dietary_compliance      BOOLEAN,
    exercise_done           BOOLEAN,
    blood_sugar_self_report FLOAT,
    bp_self_report          TEXT,
    patient_sentiment       TEXT CHECK (patient_sentiment IS NULL OR patient_sentiment IN ('positive', 'neutral', 'negative')),
    summary                 TEXT,

    -- Escalation
    escalation_flag         BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_reason       TEXT,

    -- FHIR
    fhir_bundle             JSONB,
    fhir_version            TEXT DEFAULT 'R4',

    -- Raw Groq extraction
    raw_extraction          JSONB,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 4: doctor_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    call_id         UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    observation_id  UUID REFERENCES observations(id),

    urgency_tier    TEXT NOT NULL DEFAULT 'ROUTINE'
                    CHECK (urgency_tier IN ('CRITICAL', 'MODERATE', 'ROUTINE')),
    alert_message   TEXT NOT NULL,
    action_required TEXT,
    patient_instruction TEXT,

    -- WhatsApp
    whatsapp_sent       BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_sent_at    TIMESTAMPTZ,
    whatsapp_message_sid TEXT,

    -- Acknowledgement
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 5: patient_memory
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_memory (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id              UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

    -- AI Memory
    last_call_summary       TEXT,
    symptom_trend           TEXT CHECK (symptom_trend IS NULL OR symptom_trend IN ('improving', 'stable', 'worsening', 'unknown'))
                            DEFAULT 'unknown',
    adherence_rate          FLOAT DEFAULT 0.0,             -- 0.0 to 1.0
    total_adherent_calls    INTEGER DEFAULT 0,
    total_calls_analyzed    INTEGER DEFAULT 0,

    -- Personalization
    preferred_call_time     TEXT,                           -- 'morning' | 'evening'
    known_concerns          TEXT[],                         -- recurring issues mentioned
    last_reported_symptoms  TEXT[],                         -- symptoms from latest call
    personalized_greeting   TEXT,                           -- AI-generated opening line

    -- History snapshots (last 5 calls)
    call_history            JSONB DEFAULT '[]'::jsonb,

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 6: workflows
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    condition       TEXT NOT NULL,                       -- 'diabetes' | 'hypertension' | 'post_discharge'
    language        TEXT NOT NULL DEFAULT 'hi-IN',
    questions       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ordered question list
    call_frequency  INTEGER NOT NULL DEFAULT 7,          -- days between calls
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 7: admissions
-- ============================================================
CREATE TABLE IF NOT EXISTS admissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    hospital_name       TEXT NOT NULL,
    ward                TEXT,
    admission_date      DATE NOT NULL,
    discharge_date      DATE,
    primary_diagnosis   TEXT,
    attending_doctor    TEXT,
    admission_reason    TEXT,
    notes               TEXT,
    status              TEXT NOT NULL DEFAULT 'admitted'
                        CHECK (status IN ('admitted', 'discharged', 'critical', 'transferred')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE 8: follow_up_schedule
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_up_schedule (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    admission_id        UUID REFERENCES admissions(id) ON DELETE CASCADE,
    scheduled_date      DATE NOT NULL,
    follow_up_type      TEXT NOT NULL DEFAULT 'day1'
                        CHECK (follow_up_type IN ('day1', 'day3', 'day7', 'day30', 'custom')),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'rescheduled', 'cancelled')),
    call_transcript     TEXT,
    nlp_result          JSONB,
    recovery_status     TEXT CHECK (recovery_status IS NULL OR recovery_status IN ('improving', 'stable', 'deteriorating')),
    urgency_triggered   TEXT,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_risk_tier      ON patients(risk_tier);
CREATE INDEX IF NOT EXISTS idx_patients_risk_score     ON patients(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_patients_next_call      ON patients(next_call_at);
CREATE INDEX IF NOT EXISTS idx_patients_district       ON patients(district);
CREATE INDEX IF NOT EXISTS idx_calls_patient_id        ON calls(patient_id);
CREATE INDEX IF NOT EXISTS idx_calls_status            ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at        ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_call_id    ON observations(call_id);
CREATE INDEX IF NOT EXISTS idx_observations_patient_id ON observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_observations_escalation ON observations(escalation_flag);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_id       ON doctor_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_urgency          ON doctor_alerts(urgency_tier);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged     ON doctor_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_memory_patient_id       ON patient_memory(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_patient_id   ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status       ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_followup_patient_id     ON follow_up_schedule(patient_id);
CREATE INDEX IF NOT EXISTS idx_followup_scheduled_date ON follow_up_schedule(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_followup_status         ON follow_up_schedule(status);

-- ============================================================
-- AUTO-UPDATE updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'patients_updated_at') THEN
        CREATE TRIGGER patients_updated_at
            BEFORE UPDATE ON patients
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'memory_updated_at') THEN
        CREATE TRIGGER memory_updated_at
            BEFORE UPDATE ON patient_memory
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'admissions_updated_at') THEN
        CREATE TRIGGER admissions_updated_at
            BEFORE UPDATE ON admissions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_memory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_schedule ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (your backend uses service role key)
CREATE POLICY IF NOT EXISTS "service_role_all" ON patients          FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON calls             FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON observations      FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON doctor_alerts     FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON patient_memory    FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON workflows         FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON admissions        FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON follow_up_schedule FOR ALL USING (true);

-- ============================================================
-- Done! VaaniCare 2.0 schema ready.
-- ============================================================