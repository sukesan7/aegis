import React from 'react';

export default function HospitalInfo({ className }: { className?: string }) {
    return (
        <div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                <h2 className="text-cyan-400 font-mono text-sm tracking-widest uppercase">
                    Hospital Information
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono">UPLINK: ACTIVE</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono content-start">
                {/* Bed Capacity */}
                <div className="text-gray-500 uppercase">Beds</div>
                <div className="text-right">
                    <span className="text-yellow-400 font-bold">231</span>
                    <span className="text-gray-600"> / 280</span>
                </div>

                {/* ER Wait */}
                <div className="text-gray-500 uppercase">ER Wait</div>
                <div className="text-right">
                    <span className="text-orange-400 font-bold">47 min</span>
                </div>

                {/* Trauma Bays */}
                <div className="text-gray-500 uppercase">Trauma Bays</div>
                <div className="text-right">
                    <span className="text-emerald-400 font-bold">2</span>
                    <span className="text-gray-600"> / 4 open</span>
                </div>

                {/* ICU Beds */}
                <div className="text-gray-500 uppercase">ICU Beds</div>
                <div className="text-right">
                    <span className="text-red-400 font-bold">18</span>
                    <span className="text-gray-600"> / 20</span>
                </div>

                {/* OR Status */}
                <div className="text-gray-500 uppercase">OR Active</div>
                <div className="text-right">
                    <span className="text-cyan-400 font-bold">3</span>
                    <span className="text-gray-600"> / 6</span>
                </div>

                {/* Staff on Duty */}
                <div className="text-gray-500 uppercase">Staff</div>
                <div className="text-right">
                    <span className="text-purple-400 font-bold">84</span>
                    <span className="text-gray-600"> on duty</span>
                </div>

                {/* Ambulance ETA Queue */}
                <div className="text-gray-500 uppercase">EMS Queue</div>
                <div className="text-right">
                    <span className="text-yellow-300 font-bold">2</span>
                    <span className="text-gray-600"> inbound</span>
                </div>

                {/* Diversion Status */}
                <div className="text-gray-500 uppercase">Diversion</div>
                <div className="text-right">
                    <span className="text-emerald-400 font-bold">OPEN</span>
                </div>
            </div>
        </div>
    );
}
