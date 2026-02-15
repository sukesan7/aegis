import React, { useState, useEffect } from 'react';

interface VitalsData {
  hr: number;
  spO2: number;
  bp: { sys: number; dia: number };
}

export default function PatientVitals({ className, scenarioData, scenarioTitle, patientOnBoard }: { className?: string; scenarioData?: VitalsData; scenarioTitle?: string; patientOnBoard?: boolean }) {
  const [hr, setHr] = useState(75);
  const [spO2, setSpO2] = useState(98);
  const [bp, setBp] = useState({ sys: 120, dia: 80 });
  const [ecgData, setEcgData] = useState<number[]>(new Array(50).fill(50));

  const isCardiacArrest = scenarioTitle?.toUpperCase().includes('ARREST') || scenarioTitle?.toUpperCase().includes('CARDIAC');
  const isMVATrauma = scenarioTitle?.toUpperCase().includes('TRAUMA') || scenarioTitle?.toUpperCase().includes('MVA');

  // Determine if we should show vitals or standby
  const showVitals = isCardiacArrest || (isMVATrauma && patientOnBoard);

  useEffect(() => {
    if (scenarioData) {
      setHr(scenarioData.hr);
      setSpO2(scenarioData.spO2);
      setBp(scenarioData.bp);
    }
  }, [scenarioData]);

  // Simulation Loop
  useEffect(() => {
    if (!showVitals) return;

    const interval = setInterval(() => {
      setHr(prev => prev === 0 ? 0 : prev + (Math.floor(Math.random() * 3) - 1));
      setSpO2(prev => Math.min(100, prev + (Math.floor(Math.random() * 2) - 0.5)));
      setBp(prev => ({
        sys: prev.sys === 0 ? 0 : prev.sys + (Math.floor(Math.random() * 3) - 1),
        dia: prev.dia === 0 ? 0 : prev.dia + (Math.floor(Math.random() * 3) - 1),
      }));

      setEcgData(prev => {
        const newData = [...prev.slice(1)];
        const time = Date.now();
        if (hr === 0) {
          newData.push(50 + (Math.random() * 2 - 1));
        } else {
          const beatInterval = 60000 / hr;
          if (time % beatInterval < 100) {
            newData.push(10);
          } else if (time % beatInterval < 200) {
            newData.push(90);
          } else {
            newData.push(50 + (Math.random() * 10 - 5));
          }
        }
        return newData;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [hr, showVitals]);

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
        <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase">
          PATIENT VITALS
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">{showVitals ? 'CONNECTION: STABLE' : 'STANDBY'}</span>
          <div className={`w-2 h-2 rounded-full animate-pulse ${!showVitals ? 'bg-gray-500 shadow-[0_0_10px_#6b7280]' : hr === 0 ? 'bg-red-500 shadow-[0_0_10px_#ff0000]' : 'bg-green-500 shadow-[0_0_10px_#00ff00]'}`} />
        </div>
      </div>

      {/* Standby mode - no scenario */}
      {!scenarioTitle && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="text-gray-600 text-3xl mb-3">🚑</div>
          <div className="text-gray-400 font-mono text-sm tracking-wider uppercase mb-1">NO PATIENT ONBOARD</div>
          <div className="text-gray-600 font-mono text-[10px] tracking-wide">AWAITING DISPATCH</div>
        </div>
      )}

      {/* En Route Mode - Scenario active but patient not onboard (MVA only) */}
      {scenarioTitle && isMVATrauma && !patientOnBoard && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="text-yellow-600 text-3xl mb-3 animate-pulse">⚡</div>
          <div className="text-yellow-500 font-mono text-sm tracking-wider uppercase mb-1">EN ROUTE TO SCENE</div>
          <div className="text-yellow-600/70 font-mono text-[10px] tracking-wide">VITALS PENDING CONTACT</div>
        </div>
      )}

      {showVitals && (<>

        {/* Critical notes banner for cardiac arrest */}
        {isCardiacArrest && (
          <div className="mb-3 px-3 py-1.5 bg-red-950/40 border border-red-500/50 rounded-lg animate-pulse">
            <div className="text-red-400 text-[10px] font-mono font-bold tracking-wider text-center">
              ⚠ CPR ACTIVE • AIRWAY SUPPORT • DEFIB READY ⚠
            </div>
          </div>
        )}

        {/* Critical notes banner for trauma */}
        {isMVATrauma && (
          <div className="mb-3 px-3 py-1.5 bg-orange-950/40 border border-orange-500/50 rounded-lg animate-pulse">
            <div className="text-orange-400 text-[10px] font-mono font-bold tracking-wider text-center">
              Suspected hemorrhage • Immobilization • Monitor shock
            </div>
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className={`border p-2 rounded relative overflow-hidden transition-colors ${hr === 0 ? 'bg-red-950/40 border-red-500' : 'bg-red-950/20 border-red-900/30'}`}>
            <div className="text-red-500 text-[10px] font-mono">HEART RATE (BPM)</div>
            {isCardiacArrest ? (
              <div>
                <div className="text-2xl text-red-500 font-bold font-mono">NO PULSE</div>
                <div className="text-[9px] text-red-400/70 font-mono mt-0.5">PEA / CPR IN PROGRESS</div>
              </div>
            ) : (
              <div>
                <div className="text-4xl text-red-500 font-bold font-mono">{Math.round(hr)}</div>
                {hr > 0 && <div className="absolute top-2 right-2 text-red-500/50 text-xs animate-ping">♥</div>}
              </div>
            )}
          </div>

          <div className={`border p-2 rounded ${isCardiacArrest ? 'bg-blue-950/30 border-blue-900/40' : 'bg-blue-950/20 border-blue-900/30'}`}>
            <div className="text-blue-400 text-[10px] font-mono">SpO2 (%)</div>
            {isCardiacArrest ? (
              <div>
                <div className="text-2xl text-yellow-500 font-bold font-mono">— %</div>
                <div className="text-[9px] text-yellow-500/70 font-mono mt-0.5">POOR SIGNAL / LOW</div>
              </div>
            ) : (
              <div className="text-4xl text-blue-400 font-bold font-mono">{Math.round(spO2)}%</div>
            )}
          </div>
        </div>

        {/* BP & Info */}
        <div className="flex justify-between items-end mb-4 bg-white/5 p-2 rounded">
          <div>
            <div className="text-gray-400 text-[10px] font-mono">BLOOD PRESSURE</div>
            {isCardiacArrest ? (
              <div className="text-xl text-red-400 font-mono font-bold">N/A <span className="text-xs text-red-400/50 font-normal">NOT OBTAINABLE</span></div>
            ) : (
              <div className="text-2xl text-white font-mono">{Math.round(bp.sys)}/{Math.round(bp.dia)} <span className="text-xs text-gray-500">mmHg</span></div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500">PATIENT ID</div>
            <div className="text-xs text-cyan-400 font-mono">{isMVATrauma ? '#TRAUMA-99' : '#992-AX-YORK'}</div>
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
      </>)}
    </div>
  );
}
