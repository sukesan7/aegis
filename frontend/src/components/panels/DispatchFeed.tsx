import React, { useState, useEffect, useRef } from 'react';

const CARDIAC_ARREST_LOGS = [
  { time: "00:00", sender: "DISPATCH", msg: "Cardiac arrest, CPR in progress. Priority transport." },
  { time: "00:01", sender: "SYSTEM", msg: "ROUTE CALCULATED: DUAN-MAO OPTIMIZED" },
  { time: "00:03", sender: "RECEIVING", msg: "ER notified, resuscitation bay prepping." },
  { time: "00:05", sender: "DISPATCH", msg: "Traffic advisory: heavy congestion near Major Mackenzie; reroute active." },
  { time: "00:08", sender: "SYSTEM", msg: "V2X SIGNAL: GREEN WAVE REQUESTED [APPROVED]" },
  { time: "00:10", sender: "POLICE", msg: "ON SCENE. SCENE SECURE. BYSTANDER CPR ONGOING." },
  { time: "00:14", sender: "DISPATCH", msg: "UPDATE: PATIENT IS 60M. NO PULSE. AED APPLIED." },
  { time: "00:18", sender: "RECEIVING", msg: "Arrival instructions: use Ambulance Bay Entrance, Code Blue alert on arrival." },
];

const MVA_TRAUMA_LOGS = [
  { time: "00:00", sender: "DISPATCH", msg: "UNIT 992: MVA ON HWY 404. MULTI-VICTIM. CODE 3." },
  { time: "00:01", sender: "SYSTEM", msg: "ROUTE CALCULATED: DUAN-MAO OPTIMIZED" },
  { time: "00:03", sender: "DISPATCH", msg: "FIRE SERVICES EN ROUTE. ETA 3 MINS." },
  { time: "00:05", sender: "992", msg: "COPY. EN ROUTE. REQUESTING TRAUMA TEAM STANDBY." },
  { time: "00:07", sender: "SYSTEM", msg: "V2X SIGNAL: GREEN WAVE REQUESTED [APPROVED]" },
  { time: "00:10", sender: "POLICE", msg: "ON SCENE. 2 VEHICLES. 1 PATIENT TRAPPED." },
  { time: "00:14", sender: "DISPATCH", msg: "UPDATE: HEMORRHAGIC SHOCK SUSPECTED. EXPEDITE." },
  { time: "00:18", sender: "RECEIVING", msg: "Trauma bay ready. Level 1 activation. Blood products standing by." },
];

const DEFAULT_LOGS = [
  { time: "00:00", sender: "SYSTEM", msg: "System online: Standby." },
  { time: "00:03", sender: "SYSTEM", msg: "Road advisory: construction reported on Major Mackenzie Dr." },
  { time: "00:06", sender: "SYSTEM", msg: "Traffic: moderate congestion near Hwy 7 / Warden Ave." },
];

function getLogsForScenario(scenarioTitle?: string) {
  if (!scenarioTitle) return DEFAULT_LOGS;
  const t = scenarioTitle.toUpperCase();
  if (t.includes('ARREST') || t.includes('CARDIAC')) return CARDIAC_ARREST_LOGS;
  if (t.includes('TRAUMA') || t.includes('MVA')) return MVA_TRAUMA_LOGS;
  return DEFAULT_LOGS;
}

export default function DispatchFeed({ className, scenarioTitle }: { className?: string; scenarioTitle?: string }) {
  const [logs, setLogs] = useState<typeof CARDIAC_ARREST_LOGS>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scenarioKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Reset logs when scenario changes
    if (scenarioTitle !== scenarioKeyRef.current) {
      scenarioKeyRef.current = scenarioTitle;
      setLogs([]);
    }

    const scenarioLogs = getLogsForScenario(scenarioTitle);
    let index = 0;
    const interval = setInterval(() => {
      if (index < scenarioLogs.length) {
        setLogs(prev => [...prev, {
          ...scenarioLogs[index],
          time: new Date().toLocaleTimeString([], { hour12: false })
        }]);
        index++;
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [scenarioTitle]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <h2 className="p-3 text-cyan-400 font-mono text-sm tracking-widest uppercase border-b border-white/5 bg-white/5 flex justify-between">
        <span>LIVE UPDATES // DISPATCH</span>
        <span className="text-[10px] text-green-500 animate-pulse">● LIVE RF-900</span>
      </h2>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {logs.length === 0 && (
          <div className="text-gray-600 italic">CONNECTING TO CAD NETWORK...</div>
        )}

        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 border-b border-white/5 pb-1">
            <span className="text-gray-500 shrink-0">[{log.time}]</span>
            <span className={`font-bold shrink-0 w-20 ${log.sender === "DISPATCH" ? "text-yellow-400" :
              log.sender === "SYSTEM" ? "text-cyan-400" :
                log.sender === "RECEIVING" ? "text-green-400" :
                  log.sender === "POLICE" ? "text-blue-400" :
                    "text-orange-400"
              }`}>
              {log.sender}:
            </span>
            <span className="text-gray-300">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}