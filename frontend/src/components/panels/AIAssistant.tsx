import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';

interface Message {
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

// 1. Wrap in forwardRef to allow App.tsx to 'hold' this component
const AIAssistant = forwardRef(({ className }: { className?: string }, ref) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'AEGIS SYSTEM ONLINE. READY FOR TRIAGE SUPPORT.', timestamp: 'NOW' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 2. EXPOSE THE INJECTION COMMAND
  useImperativeHandle(ref, () => ({
    // Added 'shouldSpeak' parameter with a default of true
    injectSystemMessage: async (text: string, shouldSpeak = true) => {
      const aiMsg: Message = {
        role: 'ai',
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour12: false })
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Only call ElevenLabs if we aren't using a local pre-recorded file
      if (isVoiceEnabled && shouldSpeak) {
        await handleVoicePlay(text);
      } else {
        console.log("AEGIS LOG: Scenario local audio active. ElevenLabs API bypassed.");
      }
    }
  }));

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Clean up audio URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  const handleVoicePlay = async (text: string) => {
    if (!isVoiceEnabled) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const res = await axios.post('/api/ai/speak', 
        { message: text }, 
        { responseType: 'blob' }
      );
      
      const audioUrl = URL.createObjectURL(res.data);
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
    } catch (err) {
      console.error("ElevenLabs Integration Error:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { 
      role: 'user', 
      text: input.toUpperCase(), 
      timestamp: new Date().toLocaleTimeString([], { hour12: false }) 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post('/api/ai/chat', { message: userMsg.text });
      const aiText = res.data.response;

      const aiMsg: Message = {
        role: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour12: false })
      };
      
      setMessages(prev => [...prev, aiMsg]);

      if (isVoiceEnabled) {
        await handleVoicePlay(aiText);
      }

    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: 'ERROR: NEURAL UPLINK FAILED.', 
        timestamp: 'ERR' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl flex flex-col overflow-hidden ${className}`}>
      <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase">
            AEGIS AI // TRIAGE
          </h2>
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-ping' : 'bg-green-500'}`} />
        </div>
        
        <button 
          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
          className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
            isVoiceEnabled ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-gray-800 border-gray-600 text-gray-500'
          }`}
        >
          VOICE: {isVoiceEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs scrollbar-thin scrollbar-thumb-cyan-900">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] p-2 rounded border ${
              m.role === 'user' 
                ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-100' 
                : 'bg-black/50 border-white/20 text-gray-300'
            }`}>
              {m.text.split('\n').map((line, idx) => (
                <p key={idx} className="mb-1 leading-relaxed">{line}</p>
              ))}
            </div>
            <span className="text-[9px] text-gray-600 mt-1">{m.timestamp}</span>
          </div>
        ))}
        {isLoading && <div className="text-cyan-400 animate-pulse font-mono text-[10px] uppercase">Analyzing medical parameters...</div>}
      </div>

      <div className="p-2 border-t border-white/10 bg-black/50 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="ENTER PROTOCOL QUERY..."
          className="flex-1 bg-transparent border-none outline-none text-cyan-400 font-mono text-xs placeholder-gray-700"
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage}
          disabled={isLoading}
          className={`px-3 py-1 font-mono text-xs transition-all ${
            isLoading 
              ? 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed' 
              : 'bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-800/50 hover:border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.1)]'
          }`}
        >
          {isLoading ? '...' : 'SEND'}
        </button>
      </div>
    </div>
  );
});

export default AIAssistant;