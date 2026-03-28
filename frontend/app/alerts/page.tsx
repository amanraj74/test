"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Bell, Loader2, MessageSquare } from "lucide-react";
import { fetchPendingAlerts, acknowledgeAlert } from "@/lib/api";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingAlerts()
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    setAckingId(alertId);
    try {
      await acknowledgeAlert(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) { console.error(e); }
    setAckingId(null);
  };

  const urgencyStyles: Record<string, { bg: string; border: string; text: string; badge: string; accent: string }> = {
    CRITICAL: { bg: "bg-rose-50/50", border: "border-l-rose-500", text: "text-rose-700", badge: "bg-rose-100 text-rose-600", accent: "bg-rose-500" },
    MODERATE: { bg: "bg-amber-50/50", border: "border-l-amber-500", text: "text-amber-700", badge: "bg-amber-100 text-amber-600", accent: "bg-amber-500" },
    ROUTINE: { bg: "bg-emerald-50/50", border: "border-l-emerald-500", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-600", accent: "bg-emerald-500" },
  };

  return (
    <div className="p-8 w-full max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl flex items-center justify-center text-white">
          <Bell size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Doctor Alerts</h3>
          <p className="text-xs text-slate-500">Unacknowledged alerts from VaaniCare AI calls</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-12 text-center animate-fade-in-up">
          <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3" />
          <p className="text-emerald-700 font-bold text-lg mb-1">All Clear!</p>
          <p className="text-emerald-600 text-sm">No pending alerts. All patients are stable.</p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium flex items-center gap-2 mb-6 animate-fade-in-up">
            <AlertTriangle size={16} /> {alerts.length} unacknowledged alert{alerts.length > 1 ? "s" : ""}
          </div>

          <div className="flex flex-col gap-4 stagger-children">
            {alerts.map((alert: any) => {
              const urgency = alert.urgency_tier || "ROUTINE";
              const style = urgencyStyles[urgency] || urgencyStyles.ROUTINE;
              const patient = alert.patients || {};

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl border border-slate-200 border-l-4 ${style.border} overflow-hidden transition-all hover:shadow-md`}
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${style.badge}`}>
                          {urgency}
                        </span>
                        <span className="font-semibold text-slate-800 text-sm">{patient.name || "Unknown Patient"}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{alert.created_at?.slice(0, 16) || "—"}</span>
                    </div>

                    {/* Alert Message */}
                    <div className={`${style.bg} rounded-xl p-4 mb-3`}>
                      <div className="flex items-start gap-2">
                        <MessageSquare size={14} className={`mt-0.5 shrink-0 ${style.text}`} />
                        <p className="text-sm text-slate-700 leading-relaxed">{alert.alert_message || "No message"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Action: {alert.action_required || "—"}</span>
                        <span>WhatsApp: {alert.whatsapp_sent ? "✅ Sent" : "❌ Not sent"}</span>
                      </div>

                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={ackingId === alert.id}
                        className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                      >
                        {ackingId === alert.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Acknowledge
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
