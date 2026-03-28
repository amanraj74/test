"use client";

import React, { useState, useEffect } from "react";
import { FileText, CalendarClock, Plus, AlertTriangle, CheckCircle2, Loader2, Clock, Activity } from "lucide-react";
import { fetchAdmissions, fetchAdmissionStats, fetchDueFollowups, fetchAllPatients, createAdmission, dischargePatient, fetchAdmissionFollowups, extractEntities } from "@/lib/api";

type Tab = "active" | "due" | "new";

export default function AdmissionFollowUpPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [stats, setStats] = useState<any>({});
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [dueFollowups, setDueFollowups] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, a, d, p] = await Promise.all([
        fetchAdmissionStats(),
        fetchAdmissions(),
        fetchDueFollowups(3),
        fetchAllPatients(200),
      ]);
      setStats(s); setAdmissions(a); setDueFollowups(d); setPatients(p);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const tabs = [
    { key: "active" as Tab, label: "Active Admissions", icon: FileText },
    { key: "due" as Tab, label: "Due Follow-ups", icon: CalendarClock },
    { key: "new" as Tab, label: "New Admission", icon: Plus },
  ];

  return (
    <div className="p-8 w-full max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white">
          <FileText size={18} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Admission Follow-up Manager</h3>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 stagger-children">
        <StatCard label="Total Admissions" value={stats.total_admissions || 0} />
        <StatCard label="Currently Admitted" value={stats.currently_admitted || 0} color="teal" />
        <StatCard label="Discharged" value={stats.discharged || 0} color="emerald" />
        <StatCard label="Pending Follow-ups" value={stats.pending_followups || 0} color="amber" />
        <StatCard label="⚠️ Deteriorating" value={stats.deteriorating || 0} color="rose" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                tab === t.key ? "tab-active" : "tab-inactive"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : (
        <>
          {/* Active Admissions Tab */}
          {tab === "active" && <ActiveAdmissions admissions={admissions} onRefresh={loadData} />}

          {/* Due Follow-ups Tab */}
          {tab === "due" && <DueFollowups followups={dueFollowups} onRefresh={loadData} />}

          {/* New Admission Tab */}
          {tab === "new" && <NewAdmission patients={patients} onCreated={loadData} />}
        </>
      )}
    </div>
  );
}

/* ── Active Admissions ────────────────────────────────── */
function ActiveAdmissions({ admissions, onRefresh }: { admissions: any[]; onRefresh: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [followups, setFollowups] = useState<Record<string, any[]>>({});
  const [dischargingId, setDischargingId] = useState<string | null>(null);

  const loadFollowups = async (admId: string) => {
    if (followups[admId]) return;
    try {
      const data = await fetchAdmissionFollowups(admId);
      setFollowups(prev => ({ ...prev, [admId]: data }));
    } catch (e) { console.error(e); }
  };

  const handleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next) loadFollowups(next);
  };

  const handleDischarge = async (admId: string) => {
    setDischargingId(admId);
    try {
      await dischargePatient(admId, new Date().toISOString().split("T")[0], "Discharged from dashboard");
      onRefresh();
    } catch (e) { console.error(e); }
    setDischargingId(null);
  };

  if (!admissions.length) return <EmptyState message="No admissions found. Use 'New Admission' tab to add one." />;

  const statusEmoji: Record<string, string> = { admitted: "🏥", discharged: "✅", critical: "🚨", transferred: "🔄" };

  return (
    <div className="flex flex-col gap-3">
      {admissions.map((adm: any) => {
        const pat = adm.patients || {};
        const riskBadgeMap: Record<string, string> = { CRITICAL: "bg-rose-100 text-rose-600", HIGH: "bg-orange-100 text-orange-600", MODERATE: "bg-amber-100 text-amber-600", LOW: "bg-emerald-100 text-emerald-600" };
        const riskBadgeClass = riskBadgeMap[pat.risk_tier || "LOW"] || "bg-slate-100 text-slate-600";
        const isExpanded = expandedId === adm.id;

        return (
          <div key={adm.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:shadow-md">
            <button onClick={() => handleExpand(adm.id)} className="w-full flex items-center justify-between px-5 py-4 text-left">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg">{statusEmoji[adm.status] || "🏥"}</span>
                <span className="font-semibold text-slate-800 text-sm">{pat.name || "Unknown"}</span>
                <span className="text-xs text-slate-400">{adm.hospital_name}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${riskBadgeClass}`}>{pat.risk_tier || "LOW"}</span>
                <span className="text-xs text-slate-400">Admitted: {adm.admission_date}</span>
              </div>
              <span className="text-xs text-slate-400">{isExpanded ? "▲" : "▼"}</span>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div><span className="text-xs text-slate-400 font-bold block">Ward</span>{adm.ward || "—"}</div>
                  <div><span className="text-xs text-slate-400 font-bold block">Diagnosis</span>{adm.primary_diagnosis || "—"}</div>
                  <div><span className="text-xs text-slate-400 font-bold block">Doctor</span>{adm.attending_doctor || "—"}</div>
                </div>

                {/* Follow-up Timeline */}
                {followups[adm.id] && followups[adm.id].length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Follow-up Timeline</h5>
                    <div className="flex gap-3 overflow-x-auto">
                      {followups[adm.id].map((fu: any) => {
                        const statusMap: Record<string, string> = { pending: "⏳", completed: "✅", missed: "❌", rescheduled: "🔄" };
                        const statusIcon = statusMap[fu.status] || "⏳";
                        return (
                          <div key={fu.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 min-w-[140px] shrink-0">
                            <div className="text-xs font-bold text-slate-700 mb-1">{fu.follow_up_type?.toUpperCase()}</div>
                            <div className="text-[10px] text-slate-400 mb-1">{fu.scheduled_date}</div>
                            <div className="text-xs">{statusIcon} {fu.status}</div>
                            {fu.recovery_status && <div className="text-[10px] text-slate-500 mt-1">Recovery: {fu.recovery_status}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {adm.status === "admitted" && (
                  <button
                    onClick={() => handleDischarge(adm.id)}
                    disabled={dischargingId === adm.id}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-sm flex items-center gap-2 transition-all"
                  >
                    {dischargingId === adm.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Mark as Discharged
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Due Follow-ups ───────────────────────────────────── */
function DueFollowups({ followups, onRefresh }: { followups: any[]; onRefresh: () => void }) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const runFollowupPipeline = async (fu: any) => {
    setRunningId(fu.id);
    const pat = fu.patients || {};
    const transcript = `Haan ji, main ${pat.name || "patient"} bol raha hoon. Hospital se discharge hue 3 din ho gaye. Abhi thoda theek hun lekin dawai le raha hoon.`;

    try {
      const nlpResult = await extractEntities(transcript, pat.condition || ["general"], "hi-IN");
      const urgency = nlpResult.escalation_flag ? "CRITICAL" : !nlpResult.medication_adherence ? "MODERATE" : "ROUTINE";
      const recoveryMap: Record<string, string> = { CRITICAL: "deteriorating", MODERATE: "stable", ROUTINE: "improving" };
      const recovery = recoveryMap[urgency] || "unknown";
      setResults(prev => ({ ...prev, [fu.id]: { urgency, recovery, nlpResult } }));
    } catch (e) { console.error(e); }
    setRunningId(null);
  };

  if (!followups.length) return <EmptyState message="✅ No follow-ups due in the next 3 days." positive />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium flex items-center gap-2">
        <CalendarClock size={16} /> {followups.length} follow-ups require attention
      </div>
      {followups.map((fu: any) => {
        const pat = fu.patients || {};
        const adm = fu.admissions || {};
        const result = results[fu.id];
        const daysUntil = Math.ceil((new Date(fu.scheduled_date).getTime() - Date.now()) / 86400000);
        const urgencyLabel = daysUntil <= 0 ? "TODAY" : `in ${daysUntil} day(s)`;

        return (
          <div key={fu.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800 text-sm">{pat.name || "Unknown"}</span>
                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                  {fu.follow_up_type?.toUpperCase()} — {urgencyLabel}
                </span>
              </div>
              <span className="text-xs text-slate-400">{adm.hospital_name || "—"}</span>
            </div>
            <div className="text-xs text-slate-500 mb-3">Diagnosis: {adm.primary_diagnosis || "—"}</div>

            {!result ? (
              <button
                onClick={() => runFollowupPipeline(fu)}
                disabled={runningId === fu.id}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-teal-600/20"
              >
                {runningId === fu.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                {runningId === fu.id ? "Running Pipeline..." : "Run AI Follow-up Call"}
              </button>
            ) : (
              <div className="animate-fade-in">
                <div className={`rounded-xl p-3 text-sm font-bold flex items-center gap-2 ${
                  result.urgency === "CRITICAL" ? "bg-rose-100 text-rose-700" :
                  result.urgency === "MODERATE" ? "bg-amber-100 text-amber-700" :
                  "bg-emerald-100 text-emerald-700"
                }`}>
                  <CheckCircle2 size={14} /> {result.urgency} — Recovery: {result.recovery}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── New Admission ────────────────────────────────────── */
function NewAdmission({ patients, onCreated }: { patients: any[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    patient_id: "", hospital: "", ward: "General Ward",
    admission_date: new Date().toISOString().split("T")[0],
    diagnosis: "", doctor: "", reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const wards = ["General Ward", "ICU", "Emergency", "Cardiac", "Medical", "Surgical", "Pediatric", "Maternity", "Orthopedic", "Neurology"];

  const handleSubmit = async () => {
    if (!form.patient_id || !form.hospital || !form.diagnosis) return;
    setSubmitting(true);
    try {
      await createAdmission(form);
      setSuccess(true);
      onCreated();
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-3xl animate-fade-in-up">
      <h4 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2"><Plus size={16} /> Register New Admission</h4>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Select Patient *</label>
          <select value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500">
            <option value="">— Select —</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.risk_tier || "LOW"}) — {p.district || "Bihar"}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Hospital Name *</label>
            <input value={form.hospital} onChange={e => setForm({...form, hospital: e.target.value})} placeholder="PMCH Patna" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ward</label>
            <select value={form.ward} onChange={e => setForm({...form, ward: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500">
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Admission Date *</label>
            <input type="date" value={form.admission_date} onChange={e => setForm({...form, admission_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Attending Doctor</label>
            <input value={form.doctor} onChange={e => setForm({...form, doctor: e.target.value})} placeholder="Dr. Sharma" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Primary Diagnosis *</label>
          <input value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} placeholder="Hypertensive Crisis / Diabetic Ketoacidosis" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Admission Reason</label>
          <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Sudden chest pain with BP 180/110..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500 h-20 resize-none" />
        </div>

        <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-xs text-teal-700 flex items-center gap-2">
          <Clock size={14} /> Auto-scheduling follow-up calls: Day 1, Day 3, Day 7, Day 30 post-admission
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !form.patient_id || !form.hospital || !form.diagnosis || success}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {success ? "✅ Admission Registered!" : "Register Admission + Schedule Follow-ups"}
        </button>

        {success && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-700 animate-fade-in">
            ✅ Patient admitted to <strong>{form.hospital}</strong>. 4 follow-up calls auto-scheduled (Day 1, 3, 7, 30).
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Shared Components ────────────────────────────────── */
function StatCard({ label, value, color = "slate" }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: "border-slate-200", teal: "border-teal-200 bg-teal-50/30",
    emerald: "border-emerald-200 bg-emerald-50/30", amber: "border-amber-200 bg-amber-50/30",
    rose: "border-rose-200 bg-rose-50/30",
  };
  return (
    <div className={`bg-white rounded-xl border p-4 ${colorMap[color] || ""}`}>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function EmptyState({ message, positive = false }: { message: string; positive?: boolean }) {
  return (
    <div className={`text-center py-16 rounded-2xl border ${positive ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
      {message}
    </div>
  );
}
