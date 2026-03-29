"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Users, Calendar, AlertTriangle, X, PhoneCall, TrendingUp, Activity } from "lucide-react";
import VoiceWave, { AssistantState } from "@/components/VoiceWave";
import MapWrapper from "@/components/MapWrapper";
import RiskSparkline from "@/components/RiskSparkline";
import { fetchDashboardStats, fetchAllPatients } from "@/lib/api";

export default function DashboardOverview() {
  const [alerts, setAlerts] = useState<{id: string, message: string}[]>([]);
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [stats, setStats] = useState<any>({});
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mockCalls, setMockCalls] = useState(0);
  const isMonitoring = typeof window !== 'undefined' && window.location.search.includes('monitoring=true');

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        setMockCalls(prev => {
          if (prev > 120) {
            clearInterval(interval);
            return 120;
          }
          return prev + Math.floor(Math.random() * 3) + 1;
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isMonitoring]);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashStats, allPatients] = await Promise.all([
          fetchDashboardStats(),
          fetchAllPatients(50),
        ]);
        setStats(dashStats);
        setPatients(allPatients);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    const timer1 = setTimeout(() => setAssistantState("listening"), 2000);
    const timer2 = setTimeout(() => setAssistantState("processing"), 4000);
    const timer3 = setTimeout(() => {
      setAssistantState("speaking");
      setAlerts([{ id: "alert-1", message: "VaaniCare AI is analyzing daily call responses..." }]);
    }, 6000);
    const timer4 = setTimeout(() => setAssistantState("idle"), 9000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
  }, []);

  const dismissAlert = (id: string) => setAlerts(alerts.filter(a => a.id !== id));
  const risk = stats.risk_breakdown || {};
  const criticalCount = (risk.CRITICAL || 0) + (risk.HIGH || 0);

  return (
    <div className="p-8 w-full max-w-7xl mx-auto pb-20">
      
      {isMonitoring && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-teal-900 border border-teal-700 rounded-2xl p-4 mb-6 text-white flex items-center justify-between shadow-lg shadow-teal-900/20"
        >
          <div className="flex items-center gap-4">
            <div className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500"></span>
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-teal-50 uppercase shadow-none ring-0">Live Campaign Monitoring Active</h3>
              <p className="text-teal-200/80 text-xs mt-0.5">Automated AI Agents are currently dialing the patient dataset in the background.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-teal-800 px-4 py-2 rounded-xl text-teal-100 font-bold text-sm flex items-center gap-2">
                 <Activity size={16} className="text-teal-400 animate-pulse" /> {Math.min(mockCalls, 120)} / 120 Patients Dialed
             </div>
             <a href="/" className="text-teal-400 hover:text-white transition-colors"><X size={20} /></a>
          </div>
        </motion.div>
      )}
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 mb-8 stagger-children">
        <KPICard title="Total Patients" value={String(stats.total_patients || 0)} icon={<Users />} color="blue" />
        <KPICard title="Calls Today" value={String(isMonitoring ? mockCalls : (stats.calls_today || 0))} icon={<PhoneCall />} color="teal" />
        <KPICard title="Pending Alerts" value={String(isMonitoring ? Math.floor(mockCalls / 5) : (stats.pending_alerts || 0))} icon={<Bell />} color="orange" />
        <KPICard title="High Risk" value={String(criticalCount)} icon={<AlertTriangle />} color="rose" delta={`${criticalCount} need calls`} />
        <KPICard title="Avg Risk Score" value={patients.length ? (patients.reduce((s: number, p: any) => s + (p.risk_score || 0), 0) / patients.length * 100).toFixed(0) : "0"} icon={<TrendingUp />} color="emerald" />
      </div>

      {/* Main Grid */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[520px] w-full items-stretch">
        {/* Patient Table */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col overflow-hidden animate-fade-in-up">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity size={18} className="text-teal-600" />
            Patient Risk Distribution
          </h3>
          <div className="flex-1 overflow-auto custom-scrollbar -mx-2">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Patient Name</th>
                  <th className="px-4 py-3 font-semibold">Tier</th>
                  <th className="px-4 py-3 font-semibold">Risk Score</th>
                  <th className="px-4 py-3 font-semibold">Condition</th>
                  <th className="px-4 py-3 font-semibold">District</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading patients...</td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No patients found. Run seed script first.</td></tr>
                ) : patients.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3.5 font-medium text-slate-700 text-sm">{p.name}</td>
                    <td className="px-4 py-3.5">
                      <RiskBadge tier={p.risk_tier} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-700 text-sm w-8">{(p.risk_score * 100).toFixed(0)}</span>
                        <div className="w-16 h-5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <RiskSparkline
                            data={[30, 45, 55, (p.risk_score * 100)]}
                            color={p.risk_tier === "CRITICAL" ? "#e11d48" : p.risk_tier === "HIGH" ? "#f97316" : p.risk_tier === "MODERATE" ? "#d97706" : "#059669"}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{p.condition?.join(", ") || "General"}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{p.district || "Bihar"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="w-full lg:w-[340px] flex flex-col gap-5">
          {/* Risk Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Risk Breakdown</h4>
            <div className="flex flex-col gap-3">
              {[
                { label: "CRITICAL", count: risk.CRITICAL || 0, color: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700" },
                { label: "HIGH", count: risk.HIGH || 0, color: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
                { label: "MODERATE", count: risk.MODERATE || 0, color: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
                { label: "LOW", count: risk.LOW || 0, color: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
              ].map((tier) => (
                <div key={tier.label} className={`flex items-center justify-between p-3 rounded-xl ${tier.bg}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${tier.color}`}></div>
                    <span className={`text-xs font-bold uppercase tracking-wide ${tier.text}`}>{tier.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${tier.text}`}>{tier.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          <div className="h-[200px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative shrink-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <MapWrapper />
          </div>

          {/* Voice Wave */}
          <div className="flex-1 min-h-[200px] bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center relative overflow-hidden shrink-0 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <VoiceWave state={assistantState} />
          </div>
        </div>
      </div>

      {/* Floating Alerts */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 w-[320px]">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="glass-card rounded-xl p-4 relative overflow-hidden border-rose-200"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-orange-500"></div>
              <div className="flex justify-between items-start mb-1 pl-2">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                  <AlertTriangle size={14} /> Alert
                </div>
                <button onClick={() => dismissAlert(alert.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <p className="text-slate-600 text-xs pl-2 mt-1 leading-relaxed">{alert.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RiskBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    CRITICAL: "bg-rose-100 text-rose-600",
    HIGH: "bg-orange-100 text-orange-600",
    MODERATE: "bg-amber-100 text-amber-600",
    LOW: "bg-emerald-100 text-emerald-600",
  };
  return (
    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${styles[tier] || styles.LOW}`}>
      {tier || "LOW"}
    </span>
  );
}

function KPICard({ title, value, icon, color, delta }: { title: string; value: string; icon: React.ReactNode; color: string; delta?: string }) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-100" },
    teal: { bg: "bg-teal-50", icon: "text-teal-600", border: "border-teal-100" },
    orange: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-100" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600", border: "border-rose-100" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-100" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.bg} ${c.border} border`}>
        {React.cloneElement(icon as React.ReactElement, { size: 18, className: c.icon })}
      </div>
      <div>
        <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-0.5">{title}</h4>
        <div className="text-2xl font-bold text-slate-800 tracking-tight">{value}</div>
        {delta && <p className="text-[10px] text-rose-500 font-medium mt-0.5">{delta}</p>}
      </div>
    </div>
  );
}
