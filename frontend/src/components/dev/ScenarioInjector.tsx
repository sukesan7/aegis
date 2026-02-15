import React from 'react';

// REAL-WORLD YORK REGION SCENARIO DATA
const SCENARIOS = {
  "CARDIAC_ARREST": {
    title: "CARDIAC ARREST // UNIT 992",
    isRedAlert: true,
    // Start: Highway 7 & Warden
    start: { lat: 43.8580, lng: -79.3100 },
    // End: Markham Stouffville Hospital
    end: { lat: 43.88490014913164, lng: -79.23290206069066 },
    aiPrompt: "URGENT: 65yo Male, Cardiac Arrest. Route to Markham Stouffville Hospital immediately.",
    vitals: { hr: 0, bp: "0/0", o2: 45 },
  },
  "MVA_TRAUMA": {
    title: "MVA TRAUMA // HWY 404",
    isRedAlert: true,
    // Start: 16th Ave & Leslie
    start: { lat: 43.8600, lng: -79.3700 },
    // End: Sunnybrook Trauma Centre
    end: { lat: 43.7220, lng: -79.3760 },
    aiPrompt: "CRITICAL: Multi-vehicle accident on Hwy 404. Multiple trauma patients. Route to Sunnybrook Trauma Centre. Avoid 404 congestion using side-street pivots.",
    vitals: { hr: 115, bp: "90/60", o2: 92 },
  },
};

export default function ScenarioInjector({ onInject }: { onInject: (s: any) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 p-2 bg-black/90 border border-white/20 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="px-3 py-1 text-[9px] text-cyan-500/50 font-mono font-bold tracking-widest border-r border-white/10 uppercase">
        Tactical Injections
      </div>

      <div className="flex gap-2 px-2">
        {Object.entries(SCENARIOS).map(([key, data]) => (
          <button
            key={key}
            onClick={() => onInject(data)}
            className={`px-4 py-1.5 text-[10px] font-mono font-bold rounded-lg border transition-all duration-300 transform hover:scale-105 active:scale-95 ${data.isRedAlert
              ? 'border-red-500/40 text-red-500 bg-red-500/5 hover:bg-red-500 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500 hover:text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]'
              }`}
          >
            {key.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="px-3 py-1 text-[8px] text-gray-500 font-mono italic animate-pulse">
        Ready for Uplink...
      </div>
    </div>
  );
}