"use client";
import dynamic from 'next/dynamic';

const PatientMap = dynamic(() => import('./PatientMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-900 rounded-xl animate-pulse flex items-center justify-center text-slate-500">Loading Map...</div>
});

export default PatientMap;
