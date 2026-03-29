-- ==========================================
-- VAANICARE: PRODUCTION DB SCHEMA (SUPABASE)
-- Stack: Supabase (PostgreSQL, Realtime, RLS)
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS (Roles: admin, doctor, coordinator)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin', 'doctor', 'coordinator')) DEFAULT 'coordinator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PATIENTS
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    language_code VARCHAR(10) NOT NULL DEFAULT 'hi-IN', -- Enforced STT/TTS
    condition VARCHAR(255),
    district VARCHAR(100),
    consent_captured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CAMPAIGNS (Tracking analytics)
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    total_patients INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 2) DEFAULT 0.00,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. WORKFLOWS (Dynamic Engine)
CREATE TABLE public.workflows (
    id VARCHAR(100) PRIMARY KEY, -- e.g., 'diabetes_followup'
    name VARCHAR(255) NOT NULL,
    flow_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CALLS
CREATE TABLE public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    workflow_id VARCHAR(100) REFERENCES public.workflows(id),
    twilio_sid VARCHAR(100) UNIQUE,
    status VARCHAR(50) CHECK (status IN ('queued', 'ringing', 'in-progress', 'completed', 'failed', 'sms-fallback')) DEFAULT 'queued',
    retry_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 6. CONVERSATION SESSIONS (Persistent State Map)
CREATE TABLE public.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID UNIQUE REFERENCES public.calls(id) ON DELETE CASCADE,
    current_step VARCHAR(50) NOT NULL, -- Ties to workflow.flow_json steps
    answers_json JSONB DEFAULT '{}'::jsonb,
    language_code VARCHAR(10) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. TRANSCRIPTS
CREATE TABLE public.transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('user', 'ai')) NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. RESPONSES (Extraction Layer)
CREATE TABLE public.responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID UNIQUE REFERENCES public.calls(id) ON DELETE CASCADE,
    extracted_data JSONB NOT NULL, -- { symptoms: [], duration: "", adherence: bool }
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. ALERTS (High-Risk Pings)
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    is_acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. AUDIT LOGS (Compliance)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL, -- e.g., 'TRIGGERED_CAMPAIGN', 'ACKNOWLEDGED_ALERT'
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticators/service-role all access for MVP
CREATE POLICY "Enable read access for authenticated users" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticators" ON public.patients FOR ALL USING (true);
CREATE POLICY "Enable all for authenticators" ON public.calls FOR ALL USING (true);
CREATE POLICY "Enable all for authenticators" ON public.alerts FOR ALL USING (true);

-- Enable Supabase Realtime mapping
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;