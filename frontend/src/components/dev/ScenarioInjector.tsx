import React from 'react';

// REAL-WORLD YORK REGION SCENARIO DATA
const SCENARIOS = {
  "CARDIAC_ARREST": {
    title: "CARDIAC ARREST // UNIT 992",
    isRedAlert: true,
    // Start: Major Mac & Jane St
    start: { lat: 43.8580, lng: -79.5400 },
    // End: Mackenzie Health Emergency Bay
    end: { lat: 43.8710, lng: -79.4440 },
    aiPrompt: "URGENT: 65yo Male, Cardiac Arrest at Major Mackenzie and Jane. CPR in progress. Route to Mackenzie Health immediately via optimized Duan-Mao pivots.",
    vitals: { hr: 0, bp: "0/0", o2: 45 },
    roadClosures: [
      [43.862, -79.50],
      [43.865, -79.48],
    ],
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
    roadClosures: [
      [43.82, -79.38],
      [43.79, -79.38],
    ],
  },
  "ROUTINE_PATROL": {
    title: "ROUTINE PATROL // ZONE B",
    isRedAlert: false,
    // Start: Richmond Hill Central
    start: { lat: 43.8640, lng: -79.4000 },
    // End: Station 92 Patrol
    end: { lat: 43.8800, lng: -79.4000 },
    aiPrompt: "Unit 992, proceed with routine patrol of Richmond Hill Zone B. Maintain low-latency uplink with mission control.",
    vitals: { hr: 72, bp: "120/80", o2: 98 }
  }
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