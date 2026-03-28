"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function PatientMap() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-full w-full bg-slate-100 rounded-xl animate-pulse" />;

  const createCustomMarker = (risk: string) => {
    let colorClass = risk === "CRITICAL" ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]" : "bg-amber-500";
    const htmlString = `
      <div class="relative flex items-center justify-center w-6 h-6">
        ${risk === "CRITICAL" ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60"></span>` : ''}
        <div class="relative inline-flex rounded-full w-3 h-3 ${colorClass}"></div>
      </div>
    `;
    return L.divIcon({ className: "custom-div-icon", html: htmlString, iconSize: [24, 24], iconAnchor: [12, 12] });
  };

  const MOCK_PATIENTS = [
    { id: "1", name: "Ramesh Kumar", lat: 25.537, lng: 84.852, risk: "CRITICAL", symptom: "Severe Chest Pain" },
    { id: "2", name: "Sunita Devi", lat: 25.539, lng: 84.850, risk: "MODERATE", symptom: "Missed Medication" },
    { id: "4", name: "Vijay Yadav", lat: 25.540, lng: 84.848, risk: "CRITICAL", symptom: "Unconscious / Fall" },
  ];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-sm relative z-0">
      <MapContainer center={[25.537, 84.852]} zoom={14} className="w-full h-full" zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        {MOCK_PATIENTS.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={createCustomMarker(p.risk)}>
            <Popup className="custom-popup-light">
              <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-xl text-slate-800 shadow-xl min-w-[180px] -m-3">
                <h3 className="font-bold text-base mb-1">{p.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block ${p.risk === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  {p.risk}
                </span>
                <p className="text-xs text-slate-500 font-medium">{p.symptom}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-popup-content-wrapper { background: transparent; box-shadow: none; padding: 0; }
        .leaflet-popup-tip { display: none; }
        .custom-popup-light .leaflet-popup-content { margin: 0; }
        .leaflet-container { font-family: inherit; }
      `}} />
    </div>
  );
}
