import React, { useState, useEffect, useRef } from 'react';
import LiveMap from './components/Map';
import WelcomeScreen from './components/WelcomeScreen';
import AIAssistant from './components/panels/AIAssistant';
import PatientVitals from './components/panels/PatientVitals';
import Navigation from './components/panels/Navigation';
import DispatchFeed from './components/panels/DispatchFeed';
import HospitalInfo from './components/panels/HospitalInfo';

// Error Boundary to catch LiveMap crashes
class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LiveMap crashed:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/50 text-white font-mono p-4">
          <div className="text-red-400 text-xl mb-2">⚠ MAP CRASH</div>
          <div className="text-sm text-gray-300 max-w-md break-all">{this.state.error?.message}</div>
          <div className="text-xs text-gray-500 mt-2 max-w-md break-all whitespace-pre-wrap">{this.state.error?.stack?.slice(0, 500)}</div>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="mt-4 px-3 py-1 bg-cyan-600 rounded text-sm">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}


// --- SUB-COMPONENT: UPGRADED EQUIPMENT PANEL ---
const EquipmentPanel = ({ forceOpen, isRedAlert }: { forceOpen?: boolean, isRedAlert?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { if (forceOpen) setIsOpen(true); }, [forceOpen]);

  return (
    <div
      onClick={() => setIsOpen(!isOpen)}
      className={`bg-black/60 backdrop-blur-xl border rounded-xl transition-all duration-500 ease-in-out cursor-pointer overflow-hidden flex flex-col 
        ${isOpen ? 'h-80' : 'h-12 hover:bg-white/5'} 
        ${isRedAlert ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-white/10'}`}
    >
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-white/5">
        <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-cyan-400 shadow-[0_0_10px_#00f0ff]' : 'bg-green-500'}`} />
          EQUIPMENT DIAGNOSTICS
        </h2>
        <span className="text-gray-500 text-[10px] font-mono">{isOpen ? '▼' : '▲'}</span>
      </div>
      <div className={`flex-1 p-3 grid grid-cols-2 gap-2 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-white/5 rounded p-2 border border-white/10">
          <div className="text-gray-400 text-[9px] font-mono uppercase">O2 Main Pressure</div>
          <div className="text-lg text-green-400 font-mono font-bold leading-tight">2200 <span className="text-[10px] font-normal">PSI</span></div>
          <div className="w-full bg-gray-800 h-1 mt-1 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full w-[95%]" />
          </div>
        </div>
        <div className="bg-white/5 rounded p-2 border border-white/10">
          <div className="text-gray-400 text-[9px] font-mono uppercase">LUCAS Battery</div>
          <div className="text-lg text-cyan-400 font-mono font-bold leading-tight">88%</div>
          <div className="w-full bg-gray-800 h-1 mt-1 rounded-full overflow-hidden">
            <div className="bg-cyan-500 h-full w-[88%]" />
          </div>
        </div>
        <div className="bg-white/5 rounded p-2 border border-white/10">
          <div className="text-gray-400 text-[9px] font-mono uppercase">Defib Status</div>
          <div className="text-base text-green-400 font-mono font-bold uppercase">{isRedAlert ? 'Charging' : 'Ready'}</div>
        </div>
        <div className="bg-white/5 rounded p-2 border border-white/10">
          <div className="text-gray-400 text-[9px] font-mono uppercase">Drug Safe</div>
          <div className="text-base text-yellow-500 font-mono font-bold uppercase text-center">Biometric Locked</div>
        </div>
        <div className="bg-white/5 rounded p-2 border border-white/10">
          <div className="text-gray-400 text-[9px] font-mono uppercase">Tire Pressure</div>
          <div className="text-lg text-white font-mono font-bold leading-tight">35 <span className="text-[10px] font-normal text-gray-400">PSI</span></div>
        </div>
        <div className="bg-white/5 rounded p-2 border border-white/10">
          <div className="text-gray-400 text-[9px] font-mono uppercase">Engine Temp</div>
          <div className="text-lg text-green-400 font-mono font-bold leading-tight">NORMAL</div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION ---
function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [isRedAlert, setIsRedAlert] = useState(false);
  const [activeScenario, setActiveScenario] = useState<any>(null);
  const [navData, setNavData] = useState<any>(null);
  const [time, setTime] = useState(new Date());
  const [audioError, setAudioError] = useState(false);
  const aiRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('red-alert', isRedAlert);
  }, [isRedAlert]);

  const handleScenarioInject = (scenario: any) => {
    setIsRedAlert(scenario.isRedAlert);
    setActiveScenario(scenario);

    // 1. DETERMINE FILE NAME
    const fileName = scenario.title.includes("ARREST") ? 'arrest.mp3' : 'trauma.mp3';

    // 2. CONSTRUCT WEB PATH
    const audioPath = `/audio/${fileName}`;

    // 3. PLAY AUDIO WITH EXPLICIT PLAYBACK
    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    audio.play()
      .then(() => {
        console.log(`AEGIS V-SYNC: Playing local file ${audioPath}`);
        setAudioError(false);
      })
      .catch(e => {
        console.error(`VOICE ERROR: Audio blocked. Click the header button to prime audio.`, e);
        setAudioError(true);
      });

    // 4. INJECT MESSAGE INTO AI BRAIN
    if (aiRef.current) {
      aiRef.current.injectSystemMessage(scenario.aiPrompt, false);
    }
  };

  const handleScenarioClear = () => {
    setIsRedAlert(false);
    setActiveScenario(null);
  };

  return (
    <div className={`w-screen h-screen overflow-hidden flex flex-col transition-all duration-700 ${isRedAlert ? 'bg-red-950/20' : 'bg-[#050505]'}`}>

      {showWelcome && <WelcomeScreen onComplete={() => setShowWelcome(false)} />}

      <header className="h-14 shrink-0 border-b border-white/10 bg-black/50 backdrop-blur-lg flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tighter text-white uppercase">
            AEGIS <span className="text-cyan-400 text-sm font-normal tracking-widest ml-2">// MISSION_CONTROL</span>
          </h1>
          {audioError && (
            <div className="px-2 py-0.5 bg-red-900/40 border border-red-500 rounded text-red-400 text-[10px] font-mono animate-pulse">
              AUDIO_BLOCKED: CLICK HEADER TO UNLOCK
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-white font-mono text-sm">{time.toLocaleTimeString([], { hour12: false })}</div>
            <div className="text-gray-500 text-[10px] font-mono uppercase">{time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>

          <button
            onClick={() => {
              // PRIME AUDIO CONTEXT
              const silence = new Audio();
              silence.play().catch(() => { });
              setIsRedAlert(!isRedAlert);
              setAudioError(false);
            }}
            className={`px-4 py-1 rounded border font-mono text-xs transition-all ${isRedAlert ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-transparent text-gray-400 border-gray-700 hover:border-white'}`}
          >
            {isRedAlert ? '⚠ CRITICAL TRAUMA' : 'STANDBY'}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-4 grid grid-cols-12 gap-4 relative z-10">
        <div className="col-span-3 flex flex-col gap-4 h-full min-h-0">
          <DispatchFeed className="h-48 shrink-0" scenarioTitle={activeScenario?.title} patientOnBoard={activeScenario?.patientOnBoard} />
          <AIAssistant
            ref={aiRef}
            className={`flex-1 min-h-0 transition-all duration-500 border-cyan-500/30 shadow-[0_0_40px_rgba(0,240,255,0.2)] ${isRedAlert ? 'shadow-[0_0_60px_rgba(239,68,68,0.3)]' : ''}`}
          />
          <EquipmentPanel forceOpen={activeScenario?.isRedAlert} isRedAlert={isRedAlert} />
        </div>

        <div className="col-span-6 h-full relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/20">
          {/* SYNC: Passing activeScenario to Map for 3D Driver View */}
          <MapErrorBoundary>
            <LiveMap
              activeScenario={activeScenario}
              onNavUpdate={setNavData}
              onScenarioInject={handleScenarioInject}
              onScenarioClear={handleScenarioClear}
            />
          </MapErrorBoundary>
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        </div>

        <div className="col-span-3 flex flex-col gap-4 h-full min-h-0">
          {/* SYNC: Passing activeScenario to Navigation for Turn-by-Turn */}
          <Navigation className="shrink-0" activeScenario={activeScenario} navData={navData} />
          <PatientVitals
            className="flex-[3] min-h-0"
            scenarioData={activeScenario?.vitals}
            scenarioTitle={activeScenario?.title}
            patientOnBoard={activeScenario?.patientOnBoard}
          />
          <HospitalInfo className="flex-[2] min-h-0" />
        </div>
      </main>

      <div className="absolute inset-0 z-0 pointer-events-none opacity-5"
        style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
  );
}

export default App;