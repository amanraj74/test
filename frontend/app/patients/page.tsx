"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, Phone, MapPin, Heart, Droplets, ChevronDown, ChevronUp } from "lucide-react";
import { fetchAllPatients } from "@/lib/api";

const RISK_TIERS = ["CRITICAL", "HIGH", "MODERATE", "LOW"];

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<string[]>(["CRITICAL", "HIGH"]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAllPatients(200)
      .then(setPatients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleTier = (tier: string) => {
    setSelectedTiers(prev =>
      prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
    );
  };

  const filtered = patients.filter(p => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchesTier = selectedTiers.length === 0 || selectedTiers.includes(p.risk_tier);
    return matchesSearch && matchesTier;
  });

  const riskColor: Record<string, string> = {
    CRITICAL: "border-l-rose-500 bg-rose-50/30",
    HIGH: "border-l-orange-500 bg-orange-50/30",
    MODERATE: "border-l-amber-500 bg-amber-50/20",
    LOW: "border-l-emerald-500 bg-emerald-50/20",
  };
  const riskBadge: Record<string, string> = {
    CRITICAL: "bg-rose-100 text-rose-600",
    HIGH: "bg-orange-100 text-orange-600",
    MODERATE: "bg-amber-100 text-amber-600",
    LOW: "bg-emerald-100 text-emerald-600",
  };

  return (
    <div className="p-8 w-full max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white">
              <Users size={18} />
            </div>
            Patient Management
          </h3>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} of {patients.length} patients shown</p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patients by name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
          />
        </div>
      </div>

      {/* Risk Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {RISK_TIERS.map(tier => (
          <button
            key={tier}
            onClick={() => toggleTier(tier)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
              selectedTiers.includes(tier)
                ? riskBadge[tier] + " ring-2 ring-offset-1 ring-current shadow-sm"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            {tier}
          </button>
        ))}
        <button
          onClick={() => setSelectedTiers(selectedTiers.length === RISK_TIERS.length ? [] : [...RISK_TIERS])}
          className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
        >
          {selectedTiers.length === RISK_TIERS.length ? "Clear All" : "Select All"}
        </button>
      </div>

      {/* Patient List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading patients...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No patients match your filters.</div>
      ) : (
        <div className="flex flex-col gap-3 stagger-children">
          {filtered.map((p: any) => {
            const isExpanded = expandedId === p.id;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border-l-4 border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md ${riskColor[p.risk_tier] || ""}`}
              >
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${riskBadge[p.risk_tier] || riskBadge.LOW}`}>
                      {p.risk_tier || "LOW"}
                    </span>
                    <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                    <span className="text-xs text-slate-400">Score: {(p.risk_score * 100).toFixed(0)}</span>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="flex flex-col gap-2.5">
                        <DetailRow icon={<Phone size={14} />} label="Phone" value={p.phone || "—"} />
                        <DetailRow icon={<Users size={14} />} label="Age" value={p.age ? `${p.age} years` : "—"} />
                        <DetailRow icon={<MapPin size={14} />} label="District" value={p.district || "—"} />
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <DetailRow icon={<Heart size={14} />} label="Condition" value={p.condition?.join(", ") || "General"} />
                        <DetailRow icon={<Droplets size={14} />} label="HbA1c" value={p.hba1c || "—"} />
                        <DetailRow icon={<Heart size={14} />} label="Health Camp" value={p.health_camp || "—"} />
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <DetailRow label="Systolic BP" value={p.systolic_bp ? `${p.systolic_bp} mmHg` : "—"} />
                        <DetailRow label="Diastolic BP" value={p.diastolic_bp ? `${p.diastolic_bp} mmHg` : "—"} />
                        <DetailRow label="Heart Risk" value={p.heart_risk_level || "—"} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide w-20">{label}</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}
