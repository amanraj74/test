"use client";

import React, { useState, useEffect } from "react";
import VoiceWave, { AssistantState } from "@/components/VoiceWave";
import { PhoneCall, PlayCircle, AlertTriangle, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { fetchAllPatients, extractEntities } from "@/lib/api";

export default function DemoCallPage() {
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientText, setPatientText] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState(false);

  useEffect(() => {
    fetchAllPatients(200).then((data) => {
      setPatients(data);
      if (data.length > 0) {
        setSelectedPatientId(data[0].id);
        setPatientText(buildDefaultTranscript(data[0]));
      }
    }).catch(console.error);
  }, []);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handlePatientChange = (id: string) => {
    setSelectedPatientId(id);
    const patient = patients.find(p => p.id === id);
    if (patient) setPatientText(buildDefaultTranscript(patient));
    setPipelineResult(null);
  };

  function buildDefaultTranscript(p: any) {
    return `Haan ji, main ${p.name} bol raha hoon. Maine 2 din se dawai nahi li. Thoda seena bhari sa lag raha hai aur blood sugar 220 hai.`;
  }

  const runPipeline = async () => {
    if (!selectedPatient || pipelineRunning) return;
    setPipelineResult(null);
    setPipelineRunning(true);
    setAssistantState("listening");

    setTimeout(() => setAssistantState("processing"), 1500);

    try {
      const conditions = selectedPatient.condition || ["general"];
      const result = await extractEntities(patientText, conditions, "hi-IN", selectedPatientId);

      setAssistantState("speaking");

      let urgency = "ROUTINE";
      let message = "Patient is stable. Continue current medication.";
      let action = "Continue monitoring";

      if (result.escalation_flag || result.chest_discomfort === "yes") {
        urgency = "CRITICAL";
        message = `🚨 CRITICAL: ${selectedPatient.name} reports chest discomfort and missed medication. Blood sugar: ${result.blood_sugar_self_report || "unknown"}. Immediate callback required.`;
        action = "Immediate doctor callback within 30 minutes";
      } else if (!result.medication_adherence) {
        urgency = "MODERATE";
        message = `⚠️ MODERATE: ${selectedPatient.name} has missed medication. Blood sugar: ${result.blood_sugar_self_report || "N/A"}. Schedule follow-up within 24h.`;
        action = "Schedule callback within 24 hours";
      }

      // Cost calculation (AI call ~45 sec)
      const aiCost = 1.2;
      const manualCost = 50.0;
      const savingsPct = ((manualCost - aiCost) / manualCost * 100).toFixed(1);

      setPipelineResult({
        urgency,
        message,
        action,
        medicationAdherence: result.medication_adherence,
        painScore: result.pain_score,
        bloodSugar: result.blood_sugar_self_report,
        escalationFlag: result.escalation_flag,
        chestDiscomfort: result.chest_discomfort,
        aiCost,
        manualCost,
        savingsPct,
        savingsInr: (manualCost - aiCost).toFixed(2),
      });
    } catch (e) {
      console.error(e);
      setPipelineResult({ error: "Pipeline failed. Check backend connection." });
    }

    setTimeout(() => {
      setAssistantState("idle");
      setPipelineRunning(false);
    }, 3000);
  };

  return (
    <div className="p-8 w-full max-w-6xl mx-auto pb-20">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-fade-in-up">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white">
            <PhoneCall size={18} />
          </div>
          Live Demo Call
        </h3>
        <p className="text-slate-500 text-sm mb-6">Simulate a VaaniCare AI call — Hindi STT → Groq NLP → Doctor Alert pipeline</p>

        <div className="flex flex-col gap-5 max-w-3xl">
          {/* Patient Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Patient Profile</label>
            <select
              value={selectedPatientId}
              onChange={e => handlePatientChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 outline-none focus:border-teal-500 transition-colors text-sm"
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.risk_tier || "LOW"}) — {p.district || "Bihar"}
                </option>
              ))}
            </select>
          </div>

          {/* Patient Metrics */}
          {selectedPatient && (
            <div className="flex gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Tier</span>
                <span className={`text-sm font-bold ${selectedPatient.risk_tier === "CRITICAL" ? "text-rose-600" : selectedPatient.risk_tier === "HIGH" ? "text-orange-600" : "text-teal-600"}`}>
                  {selectedPatient.risk_tier || "LOW"}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Risk Score</span>
                <span className="text-sm font-bold text-slate-700">{(selectedPatient.risk_score * 100).toFixed(0)}</span>
              </div>
            </div>
          )}

          {/* Transcript */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Simulated Voice Response (Hindi)</label>
            <textarea
              value={patientText}
              onChange={e => setPatientText(e.target.value)}
              className="w-full h-28 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 outline-none focus:border-teal-500 transition-colors resize-none text-sm"
            />
          </div>

          {/* Run Button */}
          <button
            onClick={runPipeline}
            disabled={pipelineRunning || !selectedPatient}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-teal-600/20 w-fit"
          >
            {pipelineRunning ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
            {pipelineRunning ? "Pipeline Running..." : "Run Demo Call Pipeline"}
          </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice Animation */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center min-h-[300px] animate-fade-in-up">
          <h4 className="w-full text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">AI Audio Decoder</h4>
          <div className="w-full flex-1">
            <VoiceWave state={assistantState} />
          </div>
        </div>

        {/* Pipeline Output */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-[300px] animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-5">Pipeline Output</h4>

          {!pipelineResult && !pipelineRunning && (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Waiting for pipeline execution...</div>
          )}

          {pipelineRunning && !pipelineResult && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-teal-600">
              <div className="w-8 h-8 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin"></div>
              <span className="text-xs font-bold uppercase tracking-widest">{assistantState}...</span>
            </div>
          )}

          {pipelineResult && !pipelineResult.error && (
            <div className="animate-fade-in">
              {/* Clinical Extraction */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <MetricBox label="Medication" value={pipelineResult.medicationAdherence ? "✅ Taking" : "❌ Missed"} color={pipelineResult.medicationAdherence ? "emerald" : "rose"} />
                <MetricBox label="Pain Score" value={`${pipelineResult.painScore || "—"}/10`} color="slate" />
                <MetricBox label="Blood Sugar" value={`${pipelineResult.bloodSugar || "—"} mg/dL`} color="amber" />
                <MetricBox label="Escalation" value={pipelineResult.escalationFlag ? "🚨 YES" : "✅ NO"} color={pipelineResult.escalationFlag ? "rose" : "emerald"} />
              </div>

              {/* Urgency Alert */}
              <div className={`rounded-xl p-4 flex items-start gap-3 mb-5 ${
                pipelineResult.urgency === "CRITICAL" ? "bg-rose-500 text-white" :
                pipelineResult.urgency === "MODERATE" ? "bg-amber-100 text-amber-800" :
                "bg-emerald-100 text-emerald-800"
              }`}>
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block mb-1">
                    {pipelineResult.urgency} — Doctor Alert
                  </span>
                  <p className="text-sm leading-relaxed">{pipelineResult.message}</p>
                  <p className="text-xs mt-1 opacity-80">Action: {pipelineResult.action}</p>
                </div>
              </div>

              {/* Cost Comparison */}
              <div className="border-t border-slate-100 pt-4">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <DollarSign size={12} /> Cost Comparison
                </h5>
                <div className="grid grid-cols-3 gap-3">
                  <MetricBox label="AI Call Cost" value={`₹${pipelineResult.aiCost}`} color="teal" />
                  <MetricBox label="Manual Cost" value={`₹${pipelineResult.manualCost}`} color="slate" />
                  <MetricBox label="Savings" value={`${pipelineResult.savingsPct}%`} color="emerald" />
                </div>
              </div>
            </div>
          )}

          {pipelineResult?.error && (
            <div className="flex-1 flex items-center justify-center text-rose-500 text-sm bg-rose-50 rounded-xl p-4">
              {pipelineResult.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    rose: "bg-rose-50 border-rose-100 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    teal: "bg-teal-50 border-teal-100 text-teal-700",
    slate: "bg-slate-50 border-slate-100 text-slate-700",
  };
  return (
    <div className={`border rounded-xl p-3 ${colorMap[color] || colorMap.slate}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}
