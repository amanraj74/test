"use client";

import React, { useState } from "react";
import { DollarSign, TrendingDown, Calculator, Users, PhoneCall, Zap } from "lucide-react";

export default function CostAnalysisPage() {
  const [patientsCount, setPatientsCount] = useState(1000);
  const [callsPerMonth, setCallsPerMonth] = useState(4);

  const aiCostPerCall = 1.20;
  const manualCostPerCall = 50.0;
  const totalCalls = patientsCount * callsPerMonth;
  const aiTotal = totalCalls * aiCostPerCall;
  const manualTotal = totalCalls * manualCostPerCall;
  const savings = manualTotal - aiTotal;
  const savingsPct = manualTotal > 0 ? ((savings / manualTotal) * 100).toFixed(1) : "0";

  return (
    <div className="p-8 w-full max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white">
          <DollarSign size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Cost Analysis</h3>
          <p className="text-xs text-slate-500">AI vs Manual Follow-up — Real cost savings at scale</p>
        </div>
      </div>

      {/* Per-Call Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 stagger-children">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-teal-50 rounded-xl flex items-center justify-center">
              <Zap size={16} className="text-teal-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Call Cost (avg)</span>
          </div>
          <div className="text-3xl font-bold text-teal-700">₹{aiCostPerCall.toFixed(2)}</div>
          <p className="text-[10px] text-slate-400 mt-1">Sarvam STT + TTS + Groq NLP</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
              <PhoneCall size={16} className="text-slate-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manual Nurse Call</span>
          </div>
          <div className="text-3xl font-bold text-slate-700">₹{manualCostPerCall.toFixed(2)}</div>
          <p className="text-[10px] text-slate-400 mt-1">Nurse time + phone + overhead</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white hover:shadow-lg transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Cost Reduction</span>
          </div>
          <div className="text-3xl font-bold">97.6%</div>
          <p className="text-[10px] opacity-80 mt-1">₹48.80 saved per call</p>
        </div>
      </div>

      {/* Scale Impact Calculator */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 animate-fade-in-up">
        <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Calculator size={16} className="text-teal-600" /> Scale Impact Calculator
        </h4>
        <p className="text-xs text-slate-400 mb-6">Adjust the sliders to project savings at different scales</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Patients Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Users size={12} /> Number of Patients
              </label>
              <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-sm font-bold">{patientsCount.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={100}
              max={10000}
              step={100}
              value={patientsCount}
              onChange={e => setPatientsCount(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>100</span><span>5,000</span><span>10,000</span>
            </div>
          </div>

          {/* Calls Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <PhoneCall size={12} /> Calls per Patient / Month
              </label>
              <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-sm font-bold">{callsPerMonth}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={callsPerMonth}
              onChange={e => setCallsPerMonth(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1</span><span>4</span><span>8</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <ResultCard label="Total Calls/Month" value={totalCalls.toLocaleString()} icon={<PhoneCall size={14} />} />
          <ResultCard label="AI Cost/Month" value={`₹${aiTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Zap size={14} />} color="teal" />
          <ResultCard label="Manual Cost/Month" value={`₹${manualTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<DollarSign size={14} />} />
        </div>

        {/* Big Savings Display */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white text-center">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Monthly Savings</p>
          <div className="text-4xl font-bold mb-1">₹{savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-sm opacity-80">{savingsPct}% cost reduction with VaaniCare AI</p>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <h4 className="text-sm font-bold text-slate-800 mb-4">Cost Breakdown</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
              <th className="py-2 text-left font-semibold">Component</th>
              <th className="py-2 text-right font-semibold">AI Cost</th>
              <th className="py-2 text-right font-semibold">Manual Cost</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            <tr className="border-b border-slate-50"><td className="py-2.5">Speech-to-Text (Sarvam)</td><td className="text-right">₹0.30</td><td className="text-right">—</td></tr>
            <tr className="border-b border-slate-50"><td className="py-2.5">NLP Analysis (Groq)</td><td className="text-right">₹0.10</td><td className="text-right">—</td></tr>
            <tr className="border-b border-slate-50"><td className="py-2.5">Text-to-Speech (Sarvam)</td><td className="text-right">₹0.30</td><td className="text-right">—</td></tr>
            <tr className="border-b border-slate-50"><td className="py-2.5">Telephony (Twilio)</td><td className="text-right">₹0.50</td><td className="text-right">₹5.00</td></tr>
            <tr className="border-b border-slate-50"><td className="py-2.5">Nurse/Staff Time</td><td className="text-right">₹0.00</td><td className="text-right">₹35.00</td></tr>
            <tr className="border-b border-slate-50"><td className="py-2.5">Overhead & Documentation</td><td className="text-right">₹0.00</td><td className="text-right">₹10.00</td></tr>
            <tr className="font-bold text-slate-800"><td className="py-2.5">Total per Call</td><td className="text-right text-teal-600">₹1.20</td><td className="text-right">₹50.00</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultCard({ label, value, icon, color = "slate" }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color === "teal" ? "bg-teal-50 border-teal-100" : "bg-slate-50 border-slate-100"}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold ${color === "teal" ? "text-teal-700" : "text-slate-700"}`}>{value}</div>
    </div>
  );
}
