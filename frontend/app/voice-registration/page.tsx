"use client";

import React, { useState } from "react";
import VoiceWave, { AssistantState } from "@/components/VoiceWave";
import { Mic, CheckCircle2, User, Phone, Edit3, Upload, FileText, FlaskConical, Loader2, AlertTriangle } from "lucide-react";
import { extractIntakeEntities, uploadIntakeAudio } from "@/lib/api";

const LANGUAGES = [
  { label: "Hindi", value: "hi-IN" },
  { label: "English", value: "en-IN" },
  { label: "Bengali", value: "bn-IN" },
  { label: "Marathi", value: "mr-IN" },
  { label: "Telugu", value: "te-IN" },
  { label: "Tamil", value: "ta-IN" },
  { label: "Gujarati", value: "gu-IN" },
  { label: "Urdu", value: "ur-IN" },
  { label: "Kannada", value: "kn-IN" },
  { label: "Odia/Oriya", value: "or-IN" },
  { label: "Malayalam", value: "ml-IN" },
  { label: "Punjabi", value: "pa-IN" },
  { label: "Assamese", value: "as-IN" },
  { label: "Maithili", value: "mai-IN" },
  { label: "Santali", value: "sat-IN" },
  { label: "Kashmiri", value: "ks-IN" },
  { label: "Nepali", value: "ne-IN" },
  { label: "Konkani", value: "kok-IN" },
  { label: "Sindhi", value: "sd-IN" },
  { label: "Dogri", value: "doi-IN" },
  { label: "Manipuri", value: "mni-IN" },
  { label: "Bodo", value: "brx-IN" },
  { label: "Sanskrit", value: "sa-IN" }
];

const DEMO_TRANSCRIPTS: Record<string, string> = {
  "hi-IN": "Mera naam Kamla Devi hai. Main 55 saal ki hoon. Mera phone number hai 9876543210. Mujhe diabetes hai aur BP bhi high rehta hai. Pichle 3 din se sir mein dard hai.",
  "en-IN": "My name is Rajesh Kumar. I am 42 years old. My phone is 9988776655. I have been having chest pain for 2 days and I am diabetic.",
  "bn-IN": "Amar naam Sunita Ghosh. Amar boyosh 38. Amar phone number 9123456789. Ami diabetes e bhugcchi ar matha byatha hochhe.",
};

const MODES = [
  { key: "audio", label: "Upload Audio", icon: Upload },
  { key: "transcript", label: "Paste Transcript", icon: FileText },
  { key: "demo", label: "Demo Mode", icon: FlaskConical },
];

type InputMode = "audio" | "transcript" | "demo";

export default function VoiceRegistrationPage() {
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [mode, setMode] = useState<InputMode>("demo");
  const [language, setLanguage] = useState("hi-IN");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState<any>(null);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", age: "", phone: "", gender: "male",
    district: "", complaint: "", conditions: ["general"] as string[],
    riskTier: "MODERATE", riskScore: 0.5,
  });

  const demoTranscript = DEMO_TRANSCRIPTS[language] || DEMO_TRANSCRIPTS["hi-IN"];

  const runExtraction = async () => {
    const text = mode === "demo" ? demoTranscript : transcript;
    if (!text && mode !== "audio") return;
    if (mode === "audio" && !audioFile) return;

    setProcessing(true);
    setExtracted(null);
    setRegistered(false);
    setError(null);
    setAssistantState("listening");
    setTimeout(() => setAssistantState("processing"), 1500);

    try {
      let result;
      
      if (mode === "audio" && audioFile) {
        // Upload audio and run full STT + NLP pipeline
        const uploadRes = await uploadIntakeAudio(audioFile, language);
        if (uploadRes.error || uploadRes.extracted?.error) {
          throw new Error(uploadRes.error || uploadRes.extracted?.error);
        }
        result = uploadRes.extracted;
        // Optionally update the UI to show the transcript that came back
        setTranscript(uploadRes.transcript || "");
      } else {
        // Just run straight NLP extraction on the text using the intake specific route
        result = await extractIntakeEntities(text, ["general", "diabetes", "hypertension"], language);
        if (result.error) {
          throw new Error(result.error);
        }
      }
      
      setAssistantState("speaking");
      setExtracted(result);

      // Populate form from extraction
      setForm({
        name: result.patient_name || result.name || "",
        age: result.age || "",
        phone: result.phone || "",
        gender: result.gender || "male",
        district: result.district || "",
        complaint: result.chief_complaint || result.symptoms_reported?.join(", ") || "",
        conditions: result.conditions_detected || ["general"],
        riskTier: result.escalation_flag ? "CRITICAL" : result.medication_adherence === false ? "HIGH" : "MODERATE",
        riskScore: result.escalation_flag ? 0.85 : 0.5,
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An API error occurred (possibly Rate Limit). Please try again in a few moments.");
    }

    setTimeout(() => {
      setAssistantState("idle");
      setProcessing(false);
    }, 2000);
  };

  const registerPatient = async () => {
    // In production, this would POST to the backend
    setRegistered(true);
  };

  const conditionOptions = ["diabetes", "hypertension", "heart_disease", "asthma", "obesity", "general"];

  return (
    <div className="p-8 w-full max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white">
                <Mic size={18} />
              </div>
              Voice Registration
            </h3>
            <p className="text-slate-500 text-sm">Register new patients via voice. Speak in Hindi, English, or mixed — AI extracts & auto-registers.</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap gap-2 mt-5">
          {MODES.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key as InputMode)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  mode === m.key ? "tab-active" : "tab-inactive"
                }`}
              >
                <Icon size={14} /> {m.label}
              </button>
            );
          })}
        </div>

        {/* Language Selector */}
        <div className="mt-4">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Patient Language</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-500 transition-colors w-48"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in-up">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Input</h4>

          {mode === "audio" && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <Upload size={24} className="mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-500 mb-2">Upload a WAV/MP3 recording</p>
              <input 
                type="file" 
                accept=".wav,.mp3,.ogg,.m4a" 
                className="text-sm text-slate-500" 
                onChange={e => e.target.files && setAudioFile(e.target.files[0])}
              />
              {audioFile && <p className="text-xs text-teal-600 mt-2">Selected: {audioFile.name}</p>}
            </div>
          )}

          {mode === "transcript" && (
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Mera naam Ramesh Kumar hai. Main 45 saal ka hoon..."
              className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-teal-500 transition-colors resize-none text-sm"
            />
          )}

          {mode === "demo" && (
            <div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-xs font-bold text-emerald-600 mb-3 inline-flex items-center gap-2">
                <FlaskConical size={12} /> Using demo {LANGUAGES.find(l => l.value === language)?.label} transcript
              </div>
              <textarea
                value={demoTranscript}
                disabled
                className="w-full h-28 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 resize-none"
              />
            </div>
          )}

          <button
            onClick={runExtraction}
            disabled={processing || (mode === "transcript" && !transcript) || (mode === "audio" && !audioFile)}
            className="mt-4 w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-600/20"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            {processing ? "Extracting..." : "Extract Patient Data"}
          </button>
        </div>

        {/* Voice Wave */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center min-h-[300px] animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <div className="w-full h-full min-h-[240px] flex items-center justify-center">
            <VoiceWave state={assistantState} />
          </div>
          <p className="text-center mt-3 text-slate-400 text-xs px-4">
            {processing ? "Processing voice data through Groq NLP pipeline..." : "Press extract to begin AI processing."}
          </p>

          {error && (
            <div className="mt-6 w-full max-w-sm mx-auto bg-rose-50/80 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-600 animate-fade-in-up">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <h5 className="font-bold text-sm mb-1">Extraction Failed</h5>
                <p className="text-xs font-medium opacity-90">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Extracted Form */}
      {extracted && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Extracted Patient Data — Review & Confirm</h4>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              (extracted.confidence || 0) > 0.8 ? "bg-emerald-100 text-emerald-600" :
              (extracted.confidence || 0) > 0.5 ? "bg-amber-100 text-amber-600" :
              "bg-rose-100 text-rose-600"
            }`}>
              Confidence: {((extracted.confidence || 0) * 100).toFixed(0)}%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <InputField icon={<User size={14} />} label="Full Name" value={form.name} onChange={v => setForm({...form, name: v})} />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Age" value={form.age} onChange={v => setForm({...form, age: v})} type="number" />
              <InputField icon={<Phone size={14} />} label="Phone" value={form.phone} onChange={v => setForm({...form, phone: v})} />
            </div>
            <InputField label="District" value={form.district} onChange={v => setForm({...form, district: v})} />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Gender</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-teal-500 text-sm">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <InputField icon={<Edit3 size={14} />} label="Chief Complaint" value={form.complaint} onChange={v => setForm({...form, complaint: v})} textarea />

          <div className="grid grid-cols-2 gap-5 mt-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Known Conditions</label>
              <div className="flex flex-wrap gap-2">
                {conditionOptions.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({...form, conditions: form.conditions.includes(c) ? form.conditions.filter(x => x !== c) : [...form.conditions, c]})}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      form.conditions.includes(c) ? "bg-teal-100 text-teal-700 ring-1 ring-teal-300" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Risk Tier</label>
              <select value={form.riskTier} onChange={e => setForm({...form, riskTier: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-teal-500 text-sm">
                {["CRITICAL", "HIGH", "MODERATE", "LOW"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={registerPatient}
            disabled={!form.name || registered}
            className="mt-6 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle2 size={16} />
            {registered ? "✅ Patient Registered Successfully!" : "Register Patient & Schedule Auto-Call"}
          </button>

          {registered && (
            <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-700 animate-fade-in">
              ✅ <strong>{form.name}</strong> registered! Risk: {form.riskTier} ({(form.riskScore * 100).toFixed(0)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InputField({ icon, label, value, onChange, type = "text", textarea = false }: {
  icon?: React.ReactNode; label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean;
}) {
  const cls = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-teal-500 text-sm";
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">{icon} {label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} className={cls + " h-20 resize-none"} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
