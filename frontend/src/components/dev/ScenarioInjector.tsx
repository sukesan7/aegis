import React from 'react';
import { SCENARIOS } from '../../constants/scenarios';

export default function ScenarioInjector({ onInject }: { onInject: (s: any) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex gap-2 p-2 bg-black/80 border border-white/20 rounded-full shadow-2xl backdrop-blur-xl">
      <div className="px-3 py-1 text-[10px] text-gray-500 font-mono self-center">SCENARIO INJECTOR:</div>
      {Object.entries(SCENARIOS).map(([key, data]) => (
        <button
          key={key}
          onClick={() => onInject(data)}
          className={`px-4 py-1 text-[10px] font-mono rounded-full border transition-all ${
            data.isRedAlert 
            ? 'border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white' 
            : 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-white'
          }`}
        >
          {key.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}