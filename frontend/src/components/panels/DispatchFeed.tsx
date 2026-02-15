import React, { useState, useEffect, useRef } from 'react';

const CARDIAC_ARREST_LOGS = [
  { time: "00:00", sender: "DISPATCH", msg: "Cardiac arrest, CPR in progress. Priority transport." },
  { time: "00:01", sender: "SYSTEM", msg: "ROUTE CALCULATED: DUAN-MAO OPTIMIZED" },
  { time: "00:03", sender: "RECEIVING", msg: "ER notified, resuscitation bay prepping." },
  { time: "00:05", sender: "DISPATCH", msg: "Traffic advisory: heavy congestion near Highway 7; reroute active." },
  { time: "00:08", sender: "SYSTEM", msg: "V2X SIGNAL: GREEN WAVE REQUESTED [APPROVED]" },
  { time: "00:10", sender: "POLICE", msg: "ON SCENE. SCENE SECURE. BYSTANDER CPR ONGOING." },
  { time: "00:14", sender: "DISPATCH", msg: "UPDATE: PATIENT IS 60M. NO PULSE. AED APPLIED." },
  { time: "00:18", sender: "RECEIVING", msg: "Arrival instructions: use Ambulance Bay Entrance, Code Blue alert on arrival." },
];

const MVA_TRAUMA_PRE_PICKUP = [
  { time: "00:00", sender: "DISPATCH", msg: "MVA with suspected blunt trauma. Scene safety caution." },
  { time: "00:01", sender: "SYSTEM", msg: "ROUTE CALCULATED TO SCENE: MARKVILLE MALL" },
  { time: "00:03", sender: "POLICE", msg: "Road partially blocked, cones deployed." },
  { time: "00:05", sender: "FIRE", msg: "Extrication in progress; ETA 2 minutes." },
  { time: "00:07", sender: "SYSTEM", msg: "V2X SIGNAL: GREEN WAVE REQUESTED [APPROVED]" },
];

const MVA_TRAUMA_POST_PICKUP = [
  { time: "00:00", sender: "DISPATCH", msg: "Patient loaded, priority transport to Markham Stouffville." },
  { time: "00:01", sender: "SYSTEM", msg: "ROUTE RECALCULATED: TRAUMA CENTER BYPASS" },
  { time: "00:04", sender: "SYSTEM", msg: "Road closure detected: rerouting to maintain ETA." },
  { time: "00:07", sender: "RECEIVING", msg: "Trauma team activated. Blood products standing by." },
  { time: "00:10", sender: "992", msg: "Vitals trending down. Expedite transport." },
];

const STANDBY_LOGS = [
  { time: "00:00", sender: "SYSTEM", msg: "System online: Standby." },
  { time: "00:03", sender: "SYSTEM", msg: "Road advisory: construction reported on 16th Avenue." },
  { time: "00:06", sender: "SYSTEM", msg: "Traffic: moderate congestion near Hwy 7 / Warden Ave." },
];

function getLogsForScenario(scenarioTitle?: string, patientOnBoard?: boolean) {
  if (!scenarioTitle) return STANDBY_LOGS;
  const t = scenarioTitle.toUpperCase();

  if (t.includes('ARREST') || t.includes('CARDIAC')) return CARDIAC_ARREST_LOGS;

  if (t.includes('TRAUMA') || t.includes('MVA')) {
    return patientOnBoard ? MVA_TRAUMA_POST_PICKUP : MVA_TRAUMA_PRE_PICKUP;
  }

  return STANDBY_LOGS;
}

export default function DispatchFeed({ className, scenarioTitle, patientOnBoard }: { className?: string; scenarioTitle?: string; patientOnBoard?: boolean }) {
  const [logs, setLogs] = useState<typeof CARDIAC_ARREST_LOGS>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scenarioKeyRef = useRef<string | undefined>(undefined);
  const patientStatusRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    // Reset logs when scenario OR patient status changes (for MVA phase shift)
    if (scenarioTitle !== scenarioKeyRef.current || patientOnBoard !== patientStatusRef.current) {
      scenarioKeyRef.current = scenarioTitle;
      patientStatusRef.current = patientOnBoard;
      setLogs([]);
    }

    const scenarioLogs = getLogsForScenario(scenarioTitle, patientOnBoard);
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
  }, [scenarioTitle, patientOnBoard]);

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
                    log.sender === "FIRE" ? "text-red-400" :
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