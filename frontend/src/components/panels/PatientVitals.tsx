import React, { useState, useEffect } from 'react';

// Added interface for scenario props
interface VitalsData {
  hr: number;
  spO2: number;
  bp: { sys: number; dia: number };
}

export default function PatientVitals({ className, scenarioData }: { className?: string, scenarioData?: VitalsData }) {
  // Mock Data States initialized with scenario data or defaults
  const [hr, setHr] = useState(75);
  const [spO2, setSpO2] = useState(98);
  const [bp, setBp] = useState({ sys: 120, dia: 80 });
  const [ecgData, setEcgData] = useState<number[]>(new Array(50).fill(50));

  // Update states when scenarioData changes
  useEffect(() => {
    if (scenarioData) {
      setHr(scenarioData.hr);
      setSpO2(scenarioData.spO2);
      setBp(scenarioData.bp);
    }
  }, [scenarioData]);

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Fluctuate Vitals slightly around current values
      // If HR is 0 (Cardiac Arrest), keep it at 0
      setHr(prev => prev === 0 ? 0 : prev + (Math.floor(Math.random() * 3) - 1));
      setSpO2(prev => Math.min(100, prev + (Math.floor(Math.random() * 2) - 0.5)));
      setBp(prev => ({
        sys: prev.sys === 0 ? 0 : prev.sys + (Math.floor(Math.random() * 3) - 1),
        dia: prev.dia === 0 ? 0 : prev.dia + (Math.floor(Math.random() * 3) - 1),
      }));

      // 2. Animate ECG Graph
      setEcgData(prev => {
        const newData = [...prev.slice(1)];
        const time = Date.now();

        // If HR is 0, flatline with minor noise
        if (hr === 0) {
          newData.push(50 + (Math.random() * 2 - 1));
        } else {
          // Dynamic heartbeat speed based on HR
          const beatInterval = 60000 / hr;
          if (time % beatInterval < 100) {
            newData.push(10); // Spike Up
          } else if (time % beatInterval < 200) {
            newData.push(90); // Spike Down
          } else {
            newData.push(50 + (Math.random() * 10 - 5)); // Noise
          }
        }
        return newData;
      });

    }, 100);

    return () => clearInterval(interval);
  }, [hr]); // Re-run effect if hr changes to update beat timing

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
        <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase">
          PATIENT VITALS
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">CONNECTION: STABLE</span>
          <div className={`w-2 h-2 rounded-full animate-pulse ${hr === 0 ? 'bg-red-500 shadow-[0_0_10px_#ff0000]' : 'bg-green-500 shadow-[0_0_10px_#00ff00]'}`} />
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`border p-2 rounded relative overflow-hidden transition-colors ${hr === 0 ? 'bg-red-950/40 border-red-500' : 'bg-red-950/20 border-red-900/30'}`}>
          <div className="text-red-500 text-[10px] font-mono">HEART RATE (BPM)</div>
          <div className="text-4xl text-red-500 font-bold font-mono">{Math.round(hr)}</div>
          {hr > 0 && <div className="absolute top-2 right-2 text-red-500/50 text-xs animate-ping">♥</div>}
        </div>

        <div className="bg-blue-950/20 border border-blue-900/30 p-2 rounded">
          <div className="text-blue-400 text-[10px] font-mono">SpO2 (%)</div>
          <div className="text-4xl text-blue-400 font-bold font-mono">{Math.round(spO2)}%</div>
        </div>
      </div>

      {/* BP & Info */}
      <div className="flex justify-between items-end mb-4 bg-white/5 p-2 rounded">
        <div>
          <div className="text-gray-400 text-[10px] font-mono">BLOOD PRESSURE</div>
          <div className="text-2xl text-white font-mono">{Math.round(bp.sys)}/{Math.round(bp.dia)} <span className="text-xs text-gray-500">mmHg</span></div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500">PATIENT ID</div>
          <div className="text-xs text-cyan-400 font-mono">#992-AX-YORK</div>
        </div>
      </div>

      {/* ECG Graph Visualization */}
      <div className="flex-1 min-h-[120px] bg-black/50 rounded border border-white/10 relative overflow-hidden flex items-center">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
        </div>

        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={ecgData.map((y, x) => `${(x / 50) * 100},${y}`).join(' ')}
            fill="none"
            stroke={hr === 0 ? "#ff0000" : "#00f0ff"}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]"
          />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent w-full h-full animate-scan" />
      </div>
    </div>
  );
}