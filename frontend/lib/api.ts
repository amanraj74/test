const API_BASE = "http://127.0.0.1:8000";

// ── Dashboard ────────────────────────────────────────────
export async function fetchDashboardStats() {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export async function fetchRecentCalls(limit = 20) {
  const res = await fetch(`${API_BASE}/dashboard/calls?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch recent calls");
  return res.json();
}

// ── Patients ─────────────────────────────────────────────
export async function fetchAllPatients(limit = 200) {
  const res = await fetch(`${API_BASE}/patients?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch patients");
  return res.json();
}

export async function fetchHighRiskPatients() {
  const res = await fetch(`${API_BASE}/patients/high-risk`);
  if (!res.ok) throw new Error("Failed to fetch high-risk patients");
  return res.json();
}

// ── Alerts ───────────────────────────────────────────────
export async function fetchPendingAlerts() {
  const res = await fetch(`${API_BASE}/alerts`);
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

export async function acknowledgeAlert(alertId: string) {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to acknowledge alert");
  return res.json();
}

// ── Calls ────────────────────────────────────────────────
export async function triggerDemoCall(patientId: string, language: string = "hi-IN") {
  const res = await fetch(`${API_BASE}/calls/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, language, demo_mode: true }),
  });
  if (!res.ok) throw new Error("Trigger call failed");
  return res.json();
}

// ── NLP ──────────────────────────────────────────────────
export async function extractEntities(
  transcript: string,
  conditions: string[] = ["general"],
  language: string = "hi-IN",
  patientId?: string
) {
  const res = await fetch(`${API_BASE}/nlp/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, conditions, language, patient_id: patientId }),
  });
  if (!res.ok) throw new Error("Extraction failed");
  return res.json();
}

export async function uploadIntakeAudio(file: File, language: string = "hi-IN") {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`${API_BASE}/voice/intake?language=${language}`, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) throw new Error("Audio upload and extraction failed");
  return res.json();
}

// ── Voice Intake ─────────────────────────────────────────
export async function uploadVoiceIntake(audioBlob: Blob, language: string = "hi-IN") {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");
  const res = await fetch(`${API_BASE}/voice/intake?language=${language}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Voice intake failed");
  return res.json();
}

// ── Admissions ───────────────────────────────────────────
export async function fetchAdmissions() {
  const res = await fetch(`${API_BASE}/admissions`);
  if (!res.ok) throw new Error("Failed to fetch admissions");
  return res.json();
}

export async function fetchAdmissionStats() {
  const res = await fetch(`${API_BASE}/admissions/stats`);
  if (!res.ok) throw new Error("Failed to fetch admission stats");
  return res.json();
}

export async function fetchDueFollowups(daysAhead = 3) {
  const res = await fetch(`${API_BASE}/admissions/due-followups?days_ahead=${daysAhead}`);
  if (!res.ok) throw new Error("Failed to fetch due followups");
  return res.json();
}

export async function fetchAdmissionFollowups(admissionId: string) {
  const res = await fetch(`${API_BASE}/admissions/${admissionId}/followups`);
  if (!res.ok) throw new Error("Failed to fetch followups");
  return res.json();
}

export async function createAdmission(data: {
  patient_id: string;
  hospital: string;
  ward: string;
  admission_date: string;
  diagnosis: string;
  doctor?: string;
  reason?: string;
}) {
  const res = await fetch(`${API_BASE}/admissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create admission");
  return res.json();
}

export async function dischargePatient(admissionId: string, dischargeDate: string, notes = "") {
  const res = await fetch(`${API_BASE}/admissions/${admissionId}/discharge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ discharge_date: dischargeDate, notes }),
  });
  if (!res.ok) throw new Error("Failed to discharge patient");
  return res.json();
}

// ── Cost Analysis ────────────────────────────────────────
export async function fetchCostAnalysis() {
  const res = await fetch(`${API_BASE}/dashboard/cost-analysis`);
  if (!res.ok) throw new Error("Failed to fetch cost analysis");
  return res.json();
}

// ── Vaccination ──────────────────────────────────────────
export async function fetchVaccinationSchedule() {
  const res = await fetch(`${API_BASE}/vaccination/schedule`);
  if (!res.ok) throw new Error("Failed to fetch vaccination schedule");
  return res.json();
}

// ── Health ───────────────────────────────────────────────
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
