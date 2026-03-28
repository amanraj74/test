"use client";

import React, { useState, useEffect } from "react";
import { Syringe, Search, Calendar, Shield, Info } from "lucide-react";
import { fetchVaccinationSchedule } from "@/lib/api";

const AGE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Birth": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
  "6 weeks": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  "10 weeks": { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", dot: "bg-teal-500" },
  "14 weeks": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  "9 months": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
  "12 months": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
};

export default function VaccinationPage() {
  const [schedule, setSchedule] = useState<Record<string, any[]>>({});
  const [totalVaccines, setTotalVaccines] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchVaccinationSchedule()
      .then(data => {
        setSchedule(data.schedule || {});
        setTotalVaccines(data.total_vaccines || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ageGroups = Object.keys(schedule);

  // Filter logic
  const filteredSchedule: Record<string, any[]> = {};
  ageGroups.forEach(age => {
    const filtered = schedule[age].filter(v =>
      !search ||
      v["Vaccine Name"]?.toLowerCase().includes(search.toLowerCase()) ||
      v["Remarks"]?.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length > 0) filteredSchedule[age] = filtered;
  });

  const filteredAges = Object.keys(filteredSchedule);
  const filteredTotal = Object.values(filteredSchedule).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="p-8 w-full max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Syringe size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Vaccination Tracker</h3>
            <p className="text-xs text-slate-500">India National Immunization Schedule — Newborn 0-12 Months</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vaccines..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8 stagger-children">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all">
          <div className="text-2xl font-bold text-slate-800">{totalVaccines}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Vaccines</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all">
          <div className="text-2xl font-bold text-slate-800">{ageGroups.length}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Age Groups</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all">
          <div className="text-2xl font-bold text-purple-700">{filteredTotal}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Showing</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading vaccination schedule...</div>
      ) : filteredAges.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">No vaccines match your search.</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-slate-200 z-0"></div>

          <div className="flex flex-col gap-8">
            {filteredAges.map((age, index) => {
              const colors = AGE_COLORS[age] || { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-500" };
              const vaccines = filteredSchedule[age];

              return (
                <div key={age} className="relative animate-fade-in-up" style={{ animationDelay: `${index * 80}ms` }}>
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-0 z-10">
                    <div className={`w-11 h-11 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center`}>
                      <div className={`w-3 h-3 rounded-full ${colors.dot} shadow-lg`}></div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="ml-16">
                    {/* Age header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${colors.bg} ${colors.text} ${colors.border} border`}>
                        <Calendar size={12} className="inline mr-1.5" />
                        {age}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">{vaccines.length} vaccine{vaccines.length > 1 ? "s" : ""}</span>
                    </div>

                    {/* Vaccine Cards */}
                    <div className="grid grid-cols-1 gap-3">
                      {vaccines.map((v: any, i: number) => (
                        <div
                          key={i}
                          className={`bg-white rounded-xl border ${colors.border} p-4 hover:shadow-md transition-all duration-200 group`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className={`font-bold text-sm ${colors.text} mb-1`}>
                                <Shield size={12} className="inline mr-1.5 opacity-60" />
                                {v["Vaccine Name"]}
                              </h5>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                                <span><strong>Dose:</strong> {v["Dose"]}</span>
                                <span><strong>Route:</strong> {v["Route/Site"]}</span>
                              </div>
                            </div>
                          </div>
                          {v["Remarks"] && (
                            <div className={`mt-3 flex items-start gap-1.5 text-xs ${colors.text} opacity-70`}>
                              <Info size={12} className="mt-0.5 shrink-0" />
                              {v["Remarks"]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
