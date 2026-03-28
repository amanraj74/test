"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Bell, Users, PhoneCall, LayoutDashboard,
  Mic, FileText, DollarSign, Syringe, AlertTriangle,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Patients", href: "/patients", icon: Users },
  { name: "Demo Call", href: "/demo-call", icon: PhoneCall },
  { name: "Voice Intake", href: "/voice-registration", icon: Mic },
  { name: "Admissions", href: "/admission-follow-up", icon: FileText },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Cost Analysis", href: "/cost-analysis", icon: DollarSign },
  { name: "Vaccination", href: "/vaccination", icon: Syringe },
];

const titleMap: Record<string, string> = {
  "/": "Dashboard Overview",
  "/patients": "Patient Management",
  "/demo-call": "Live Demo Call",
  "/voice-registration": "Voice Intake Registration",
  "/admission-follow-up": "Admission Follow-up Manager",
  "/alerts": "Doctor Alerts",
  "/cost-analysis": "Cost Analysis",
  "/vaccination": "Vaccination Tracker",
};

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex z-10 shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20 shrink-0">
            <Activity size={22} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 leading-tight">VaaniCare</h1>
            <p className="text-[10px] uppercase font-bold text-teal-500 tracking-wider">Enterprise 2.0</p>
          </div>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 shadow-sm border border-teal-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                <Icon size={18} className={isActive ? "text-teal-600" : ""} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 shrink-0">
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-100">
            <p className="text-[10px] uppercase font-bold text-teal-600 tracking-wider mb-1">Hackmatrix 2.0</p>
            <p className="text-xs text-slate-500">IIT Patna • PS-3 Indic Voice AI</p>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white/70 backdrop-blur-md border-b border-slate-200/60 px-8 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {titleMap[pathname] || "VaaniCare"}
          </h2>
          <div className="flex items-center gap-4">
            <Link href="/alerts" className="bg-white p-2 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-teal-600 transition-colors cursor-pointer relative">
              <Bell size={18} />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            </Link>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-xs font-bold">DS</div>
              <div className="text-sm font-medium text-slate-700">Dr. Sharma</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
