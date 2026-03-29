"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, Plus, Users, Calendar, Clock, Volume2, 
  Settings, Bot, FileSpreadsheet, Activity, Syringe,
  ActivitySquare, Stethoscope, ChevronRight, Save, Play, Loader2, AlertTriangle
} from "lucide-react";

const USE_CASES = [
  { id: "screening", title: "Screening to OPD", icon: <Stethoscope size={24} />, desc: "Automate initial patient symptom screening and book OPD appointments." },
  { id: "opd-to-ipd", title: "OPD to IPD", icon: <ActivitySquare size={24} />, desc: "Track outpatient conversions to admissions and follow-up on recommendations." },
  { id: "recovery", title: "Recovery Protocol", icon: <Activity size={24} />, desc: "Post-discharge monitoring for complications and medication adherence." },
  { id: "chronic", title: "Chronic Diseases", icon: <Users size={24} />, desc: "Long-term monitoring for Diabetes, Hypertension, and critical illnesses." },
  { id: "followup", title: "General Follow-up", icon: <Calendar size={24} />, desc: "Standard post-consultation feedback and satisfaction calling." },
  { id: "vaccination", title: "Newborn Vaccination", icon: <Syringe size={24} />, desc: "Automated 0-12 month immunization reminders in regional languages." }
];

const LANGUAGES = [
  { id: "hi-IN", label: "Hindi (hi-IN)", flag: "🇮🇳" },
  { id: "en-IN", label: "English (en-IN)", flag: "🇮🇳" },
  { id: "bn-IN", label: "Bengali (bn-IN)", flag: "🇮🇳" },
  { id: "mr-IN", label: "Marathi (mr-IN)", flag: "🇮🇳" },
  { id: "te-IN", label: "Telugu (te-IN)", flag: "🇮🇳" },
  { id: "ta-IN", label: "Tamil (ta-IN)", flag: "🇮🇳" },
  { id: "gu-IN", label: "Gujarati (gu-IN)", flag: "🇮🇳" },
  { id: "ur-IN", label: "Urdu (ur-IN)", flag: "🇮🇳" },
  { id: "kn-IN", label: "Kannada (kn-IN)", flag: "🇮🇳" },
  { id: "or-IN", label: "Odia/Oriya (or-IN)", flag: "🇮🇳" },
  { id: "ml-IN", label: "Malayalam (ml-IN)", flag: "🇮🇳" },
  { id: "pa-IN", label: "Punjabi (pa-IN)", flag: "🇮🇳" },
  { id: "as-IN", label: "Assamese (as-IN)", flag: "🇮🇳" },
  { id: "mai-IN", label: "Maithili (mai-IN)", flag: "🇮🇳" },
  { id: "sat-IN", label: "Santali (sat-IN)", flag: "🇮🇳" },
  { id: "ks-IN", label: "Kashmiri (ks-IN)", flag: "🇮🇳" },
  { id: "ne-IN", label: "Nepali (ne-IN)", flag: "🇮🇳" },
  { id: "kok-IN", label: "Konkani (kok-IN)", flag: "🇮🇳" },
  { id: "sd-IN", label: "Sindhi (sd-IN)", flag: "🇮🇳" },
  { id: "doi-IN", label: "Dogri (doi-IN)", flag: "🇮🇳" },
  { id: "mni-IN", label: "Manipuri (mni-IN)", flag: "🇮🇳" },
  { id: "brx-IN", label: "Bodo (brx-IN)", flag: "🇮🇳" },
  { id: "sa-IN", label: "Sanskrit (sa-IN)", flag: "🇮🇳" }
];

export default function WorkflowBuilder() {
  const [step, setStep] = useState(1);
  const [useCase, setUseCase] = useState(USE_CASES[2].id);
  const [language, setLanguage] = useState("hi-IN");
  const [dataset, setDataset] = useState("jilo_health-data.csv");
  const [processing, setProcessing] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setDeployed(true);
    }, 2500);
  };

  const currentCase = USE_CASES.find(u => u.id === useCase);

  return (
    <div className="p-8 w-full max-w-6xl mx-auto pb-20 overflow-y-auto h-full custom-scrollbar">
      
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          Patient Engagement Workflow Builder
        </h1>
        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          Visually build, configure, and instantly deploy AI voice campaigns without writing a single line of code. Scale your hospital's outreach automatically.
        </p>
      </div>

      {deployed ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-10 shadow-xl border border-teal-100 flex flex-col items-center justify-center min-h-[500px] text-center"
        >
          <div className="w-24 h-24 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Campaign Deployed!</h2>
          <p className="text-slate-500 max-w-md mb-8">
            The <strong>{currentCase?.title}</strong> AI voice agents have been initialized. They will begin calling your target patient list in <strong>{LANGUAGES.find(l => l.id === language)?.label}</strong> shortly.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => { setDeployed(false); setStep(1); }}
              className="px-6 py-3 rounded-xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              Build Another Campaign
            </button>
            <Link href="/?monitoring=true" className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
              <Activity size={18} /> Monitor Calls
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Progress Sidebar */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 sticky top-8">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Settings size={16} className="text-teal-600" /> Configuration
              </h3>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {[
                  { stepNum: 1, title: "Objective", icon: Bot },
                  { stepNum: 2, title: "Target Audience", icon: Users },
                  { stepNum: 3, title: "Voice & AI Config", icon: Volume2 },
                  { stepNum: 4, title: "Launch Campaign", icon: Play }
                ].map((s) => (
                  <div key={s.stepNum} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${step >= s.stepNum ? 'text-teal-600' : 'text-slate-400'}`}>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-white z-10 font-bold text-[10px] ${step >= s.stepNum ? 'border-teal-500 text-teal-600' : 'border-slate-300 text-slate-400'}`}>
                      {step > s.stepNum ? <CheckCircle2 size={12} /> : s.stepNum}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] ml-3 md:ml-0 md:odd:pr-4 md:even:pl-4">
                      <h4 className="font-semibold text-sm">{s.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {/* STEP 1: OBJECTIVE */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                >
                  <h2 className="text-xl font-bold text-slate-800 mb-6">1. Campaign Objective</h2>
                  <p className="text-sm text-slate-500 mb-6">Select the primary health goal for this Voice AI outreach campaign.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {USE_CASES.map((uc) => (
                      <div 
                        key={uc.id}
                        onClick={() => setUseCase(uc.id)}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                          useCase === uc.id 
                            ? "border-teal-500 bg-teal-50/50 shadow-md shadow-teal-500/10" 
                            : "border-slate-100 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${useCase === uc.id ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {uc.icon}
                        </div>
                        <h3 className={`font-bold text-sm mb-1 ${useCase === uc.id ? "text-teal-900" : "text-slate-800"}`}>{uc.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">{uc.desc}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 flex justify-end">
                    <button onClick={() => setStep(2)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                      Next Step <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: AUDIENCE */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                >
                  <h2 className="text-xl font-bold text-slate-800 mb-6">2. Target Audience</h2>
                  <p className="text-sm text-slate-500 mb-6">Define exactly who the AI agents should call.</p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Import Dataset (CSV)</label>
                      <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                        <FileSpreadsheet className="text-teal-600 shrink-0" />
                        <select 
                          value={dataset}
                          onChange={(e) => setDataset(e.target.value)}
                          className="w-full bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 outline-none appearance-none pr-8 cursor-pointer"
                        >
                          <option value="jilo_health-data.csv">jilo_health-data.csv (120 Patients)</option>
                          <option value="newborn_vaccination_india.csv">newborn_vaccination_india.csv (500 Records)</option>
                          <option value="chronic_registry.csv">chronic_registry.csv (86 Patients)</option>
                        </select>
                        <div className="absolute right-4 pointer-events-none">
                          <ChevronRight size={16} className="text-slate-400 rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filter By Condition</label>
                        <select className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500">
                          <option>All conditions</option>
                          <option>Diabetes Only</option>
                          <option>Hypertension Only</option>
                          <option>Recent Surgeries</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Age Range</label>
                        <select className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500">
                          <option>All Ages</option>
                          <option>Pediatric (0-12)</option>
                          <option>Adults (18-60)</option>
                          <option>Seniors (60+)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 flex justify-between">
                    <button onClick={() => setStep(1)} className="text-slate-500 font-bold text-sm px-4 py-2 hover:bg-slate-50 rounded-xl transition-all">Back</button>
                    <button onClick={() => setStep(3)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                      Next Step <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: AI CONFIG */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                >
                  <h2 className="text-xl font-bold text-slate-800 mb-6">3. Voice & AI Configuration</h2>
                  <p className="text-sm text-slate-500 mb-6">Configure the language format and prompt instructions for the LLM.</p>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3">Primary Indic Language</label>
                      <div className="block max-h-64 overflow-y-auto custom-scrollbar pr-2 mb-4 bg-white border border-slate-200 rounded-2xl p-2 w-full">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {LANGUAGES.map(lang => (
                            <div
                              key={lang.id}
                              onClick={() => setLanguage(lang.id)}
                              className={`px-3 py-2 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                                language === lang.id ? "bg-teal-50 border-teal-500 text-teal-800 font-bold shadow-sm" : "bg-slate-50 border-transparent hover:border-slate-300 text-slate-600"
                              }`}
                            >
                              <span className="text-[12px]">{lang.label.split(" ")[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Custom AI Persona Instructions (Groq System Prompt)</label>
                      <textarea 
                        className="w-full h-28 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        defaultValue={`You are a professional healthcare assistant from VaaniCare calling regarding a ${currentCase?.title?.toLowerCase()} campaign. Be extremely polite, use simple terminology, and map all responses to the provided clinical JSON schema.`}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-8 flex justify-between">
                    <button onClick={() => setStep(2)} className="text-slate-500 font-bold text-sm px-4 py-2 hover:bg-slate-50 rounded-xl transition-all">Back</button>
                    <button onClick={() => setStep(4)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2">
                      Review <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: LAUNCH */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                >
                  <h2 className="text-xl font-bold text-slate-800 mb-6">4. Review & Launch</h2>
                  
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8 space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-500 text-sm">Campaign Objective</span>
                      <span className="font-bold text-slate-800 flex items-center gap-2">{currentCase?.icon} {currentCase?.title}</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-slate-500 text-sm">Target Dataset</span>
                      <span className="font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs">{dataset}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Voice AI Language</span>
                      <span className="font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-lg text-xs">
                        {LANGUAGES.find(l => l.id === language)?.label}
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 mb-8">
                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                    <p className="text-sm">Clicking Launch will instantly deploy Sarvam Voice Agents to dial patients automatically matching the dataset. Ensure backend telephony is active.</p>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <button disabled={processing} onClick={() => setStep(3)} className="text-slate-500 font-bold text-sm px-4 py-2 hover:bg-slate-50 rounded-xl transition-all disabled:opacity-50">Back</button>
                    <button 
                      onClick={handleDeploy} 
                      disabled={processing}
                      className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-10 py-3 rounded-xl text-sm font-bold shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2 disabled:opacity-75"
                    >
                      {processing ? <><Loader2 size={16} className="animate-spin" /> Deploying Agents...</> : <><Play size={16} className="fill-white" /> Launch Campaign</>}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      )}
    </div>
  );
}
