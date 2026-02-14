import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';

interface AlgoRaceData {
    dijkstraCoords: [number, number][];
    dijkstraExecMs: number;
    bmssspCoords: [number, number][];
    bmssspExecMs: number;
    closurePoints: [number, number][];  // [lng, lat] markers for road closures
}

interface AlgoRaceMiniMapProps {
    data: AlgoRaceData | null;
    visible: boolean;
}

export default function AlgoRaceMiniMap({ data, visible }: AlgoRaceMiniMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const animRef = useRef<number | null>(null);
    const [dijkDone, setDijkDone] = useState(false);
    const [bmssspDone, setBmssspDone] = useState(false);
    const [dijkMs, setDijkMs] = useState(0);
    const [bmssspMs, setBmssspMs] = useState(0);

    // Initialize the mini-map
    useEffect(() => {
        if (!visible || !containerRef.current || mapRef.current) return;

        mapRef.current = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
            center: [-79.4, 43.85],
            zoom: 11,
            pitch: 0,
            interactive: false,
            attributionControl: false,
        });

        mapRef.current.on('load', () => {
            // Dijkstra route source (cyan)
            mapRef.current?.addSource('race-dijkstra', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
            });
            mapRef.current?.addLayer({
                id: 'race-dijkstra-line',
                type: 'line',
                source: 'race-dijkstra',
                paint: {
                    'line-color': '#00f0ff',
                    'line-width': 3.5,
                    'line-opacity': 0.95,
                },
            });

            // Duan-Mao route source (magenta/hot pink)
            mapRef.current?.addSource('race-bmsssp', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
            });
            mapRef.current?.addLayer({
                id: 'race-bmsssp-line',
                type: 'line',
                source: 'race-bmsssp',
                paint: {
                    'line-color': '#ff00ff',
                    'line-width': 3.5,
                    'line-opacity': 0.95,
                },
            });

            // Road closure markers source
            mapRef.current?.addSource('race-closures', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
            mapRef.current?.addLayer({
                id: 'race-closures-circle',
                type: 'circle',
                source: 'race-closures',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#ff4444',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.9,
                },
            });
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [visible]);

    // Run the race animation when data changes
    useEffect(() => {
        if (!data || !mapRef.current || !mapRef.current.loaded()) return;

        // Reset
        setDijkDone(false);
        setBmssspDone(false);
        setDijkMs(data.dijkstraExecMs);
        setBmssspMs(data.bmssspExecMs);

        // Fit bounds to encompass both routes
        const allCoords = [...data.dijkstraCoords, ...data.bmssspCoords];
        if (allCoords.length > 0) {
            const lngs = allCoords.map(c => c[0]);
            const lats = allCoords.map(c => c[1]);
            const bounds = new maplibregl.LngLatBounds(
                [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005],
                [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005],
            );
            mapRef.current.fitBounds(bounds, { padding: 20, duration: 0 });
        }

        // Place road closure markers
        const closureFeatures = data.closurePoints.map(([lng, lat]) => ({
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        }));
        const closureSrc = mapRef.current?.getSource('race-closures') as any;
        if (closureSrc) {
            closureSrc.setData({ type: 'FeatureCollection', features: closureFeatures });
        }

        // Animation: draw both lines progressively
        // The animation duration is scaled so the faster algorithm finishes first
        const RACE_DURATION_MS = 3000; // total animation time for the slower algorithm
        const maxExec = Math.max(data.dijkstraExecMs, data.bmssspExecMs, 1);
        const dijkAnimDuration = (data.dijkstraExecMs / maxExec) * RACE_DURATION_MS;
        const bmssspAnimDuration = (data.bmssspExecMs / maxExec) * RACE_DURATION_MS;

        const startTime = performance.now();
        let dijkFinished = false;
        let bmssspFinished = false;

        const tick = () => {
            const elapsed = performance.now() - startTime;

            // Dijkstra progress
            if (!dijkFinished) {
                const dijkProgress = Math.min(1, elapsed / dijkAnimDuration);
                const dijkIdx = Math.floor(dijkProgress * data.dijkstraCoords.length);
                const dijkSlice = data.dijkstraCoords.slice(0, Math.max(2, dijkIdx));
                const dijkSrc = mapRef.current?.getSource('race-dijkstra') as any;
                if (dijkSrc && dijkSlice.length >= 2) {
                    dijkSrc.setData({
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: dijkSlice },
                    });
                }
                if (dijkProgress >= 1) {
                    dijkFinished = true;
                    setDijkDone(true);
                }
            }

            // Duan-Mao progress
            if (!bmssspFinished) {
                const bmssspProgress = Math.min(1, elapsed / bmssspAnimDuration);
                const bmssspIdx = Math.floor(bmssspProgress * data.bmssspCoords.length);
                const bmssspSlice = data.bmssspCoords.slice(0, Math.max(2, bmssspIdx));
                const bmssspSrc = mapRef.current?.getSource('race-bmsssp') as any;
                if (bmssspSrc && bmssspSlice.length >= 2) {
                    bmssspSrc.setData({
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: bmssspSlice },
                    });
                }
                if (bmssspProgress >= 1) {
                    bmssspFinished = true;
                    setBmssspDone(true);
                }
            }

            if (!dijkFinished || !bmssspFinished) {
                animRef.current = requestAnimationFrame(tick);
            }
        };

        animRef.current = requestAnimationFrame(tick);

        return () => {
            if (animRef.current != null) {
                cancelAnimationFrame(animRef.current);
                animRef.current = null;
            }
        };
    }, [data]);

    if (!visible) return null;

    return (
        <div className="absolute bottom-20 right-4 z-[60] w-[300px] h-[220px] rounded-xl overflow-hidden border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.6)] bg-black/40 backdrop-blur-xl">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 px-3 py-1.5 bg-gradient-to-b from-black/90 to-transparent">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-white/80 tracking-widest uppercase">
                        ⚡ Algorithm Race
                    </span>
                    <span className="text-[8px] font-mono text-gray-400">LIVE</span>
                </div>
            </div>

            {/* Map container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Stats overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
                <div className="flex justify-between items-end gap-2">
                    {/* Dijkstra stats */}
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${dijkDone ? 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]' : 'bg-[#00f0ff]/40 animate-pulse'}`} />
                        <div>
                            <div className="text-[8px] font-mono font-bold text-[#00f0ff] tracking-wider">DIJKSTRA</div>
                            <div className="text-[9px] font-mono text-white/70">
                                {dijkDone ? `${dijkMs.toFixed(0)}ms ✓` : 'Computing...'}
                            </div>
                        </div>
                    </div>

                    {/* Road closure indicator */}
                    <div className="flex flex-col items-center">
                        <div className="text-[8px] font-mono text-red-400 animate-pulse">🚧 CLOSURE</div>
                    </div>

                    {/* Duan-Mao stats */}
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${bmssspDone ? 'bg-[#ff00ff] shadow-[0_0_8px_#ff00ff]' : 'bg-[#ff00ff]/40 animate-pulse'}`} />
                        <div>
                            <div className="text-[8px] font-mono font-bold text-[#ff00ff] tracking-wider">DUAN-MAO</div>
                            <div className="text-[9px] font-mono text-white/70">
                                {bmssspDone ? `${bmssspMs.toFixed(0)}ms ✓` : 'Computing...'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
