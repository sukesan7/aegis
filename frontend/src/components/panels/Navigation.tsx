import React from 'react';
import type { NavLive } from '../Map';

function formatEta(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function formatDistance(meters: number): { value: string; unit: string } {
  if (meters >= 1000) {
    return { value: (meters / 1000).toFixed(1), unit: 'km' };
  }
  return { value: Math.round(meters).toString(), unit: 'm' };
}

export default function Navigation({
  className,
  activeScenario,
  navData,
}: {
  className?: string;
  activeScenario?: any;
  navData?: NavLive | null;
}) {
  const rawDistance = navData ? navData.distance_to_next_m : 0;
  const dist = formatDistance(rawDistance);
  const nextTurn = navData?.next_instruction || 'AWAITING ROUTE';
  const street = navData?.current_street || '--';
  const eta = navData ? formatEta(navData.eta_remaining_s) : '--:--';
  const remainingKm = navData ? (navData.remaining_distance_m / 1000).toFixed(2) : '--';
  const algo = navData?.algorithm || 'Duan-Mao (2025) // Edge Relaxation Active';
  const sim = navData ? `SIM x${navData.sim_speedup}` : '';

  const arrow =
    nextTurn.toUpperCase().includes('U-TURN') || nextTurn.toUpperCase().includes('U TURN')
      ? '⤴'
      : nextTurn.toUpperCase().includes('RIGHT')
        ? '↱'
        : nextTurn.toUpperCase().includes('LEFT')
          ? '↰'
          : '↑';

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col justify-between ${className}`}>
      <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase border-b border-white/5 pb-1">
        NAV-COM // MISSION_STATE
      </h2>

      <div className="flex flex-col items-center justify-center my-4">
        <div className="text-6xl text-white font-bold tracking-tighter drop-shadow-[0_0_15px_rgba(0,240,255,0.3)]">
          {dist.value}
          <span className="text-2xl text-gray-500 ml-1">{dist.unit}</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="text-4xl text-cyan-400 font-bold">{arrow}</div>
          <div className="text-base text-cyan-300 font-mono font-bold text-center max-w-[220px] leading-tight">
            {nextTurn}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="bg-white/5 rounded p-2 border border-white/10 flex justify-between items-center">
          <div>
            <div className="text-[10px] text-gray-500 font-mono uppercase">Current Road</div>
            <div className="text-sm text-white font-mono font-bold">{street}</div>
            <div className="text-[9px] text-gray-500 font-mono mt-1">Remaining: {remainingKm} km</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 font-mono">ETA</div>
            <div className={`text-xl font-mono font-bold ${activeScenario?.isRedAlert ? 'text-red-400' : 'text-green-400'} animate-pulse`}>
              {eta}
            </div>
            <div className="text-[9px] text-gray-500 font-mono mt-1">{sim}</div>
          </div>
        </div>

        <div className="text-[9px] text-cyan-900 bg-cyan-400/10 border border-cyan-400/20 rounded px-2 py-1 text-center font-mono uppercase">
          Algo: {algo}
        </div>
      </div>
    </div>
  );
}
