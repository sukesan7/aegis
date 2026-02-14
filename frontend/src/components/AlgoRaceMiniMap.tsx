import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';

export interface AlgoRaceData {
    dijkstraCoords: [number, number][];
    dijkstraExecMs: number;
    dijkstraExplored: [number, number][][];  // explored edge segments [[lng,lat],[lng,lat]]
    bmssspCoords: [number, number][];
    bmssspExecMs: number;
    bmssspExplored: [number, number][][];
    closurePoints: [number, number][];
}

interface AlgoRaceMiniMapProps {
    data: AlgoRaceData | null;
    visible: boolean;
}

export default function AlgoRaceMiniMap({ data, visible }: AlgoRaceMiniMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const animRef = useRef<number | null>(null);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [dijkDone, setDijkDone] = useState(false);
    const [bmssspDone, setBmssspDone] = useState(false);
    const [dijkMs, setDijkMs] = useState(0);
    const [bmssspMs, setBmssspMs] = useState(0);
    const [phase, setPhase] = useState<'exploring' | 'routing' | 'done'>('exploring');

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
            const m = mapRef.current;
            if (!m) return;

            // Dijkstra exploration ghost lines (faint cyan)
            m.addSource('explore-dijkstra', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
            m.addLayer({
                id: 'explore-dijkstra-lines',
                type: 'line',
                source: 'explore-dijkstra',
                paint: {
                    'line-color': '#00f0ff',
                    'line-width': 1,
                    'line-opacity': 0.2,
                },
            });

            // BM-SSSP exploration ghost lines (faint magenta)
            m.addSource('explore-bmsssp', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
            m.addLayer({
                id: 'explore-bmsssp-lines',
                type: 'line',
                source: 'explore-bmsssp',
                paint: {
                    'line-color': '#ff00ff',
                    'line-width': 1,
                    'line-opacity': 0.2,
                },
            });

            // Dijkstra final route (bold cyan)
            m.addSource('race-dijkstra', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
            });
            m.addLayer({
                id: 'race-dijkstra-line',
                type: 'line',
                source: 'race-dijkstra',
                paint: { 'line-color': '#00f0ff', 'line-width': 3.5, 'line-opacity': 0.95 },
            });

            // Duan-Mao final route (bold magenta)
            m.addSource('race-bmsssp', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
            });
            m.addLayer({
                id: 'race-bmsssp-line',
                type: 'line',
                source: 'race-bmsssp',
                paint: { 'line-color': '#ff00ff', 'line-width': 3.5, 'line-opacity': 0.95 },
            });

            // Road closure markers
            m.addSource('race-closures', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
            m.addLayer({
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
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [visible]);

    // Run the exploration + race animation when data changes
    useEffect(() => {
        if (!data || !mapRef.current || !mapRef.current.loaded()) return;

        // Reset state
        setDijkDone(false);
        setBmssspDone(false);
        setDijkMs(data.dijkstraExecMs);
        setBmssspMs(data.bmssspExecMs);
        setPhase('exploring');
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }

        // Fit bounds to encompass both routes + explored edges
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
        if (closureSrc) closureSrc.setData({ type: 'FeatureCollection', features: closureFeatures });

        // Clear previous route lines
        const dijkSrc = mapRef.current?.getSource('race-dijkstra') as any;
        const bmssspSrc = mapRef.current?.getSource('race-bmsssp') as any;
        if (dijkSrc) dijkSrc.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
        if (bmssspSrc) bmssspSrc.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });

        // Animation timing — SINGLE UNIFIED RACE
        // Both algorithms start at the same time.
        // Total animation time for each is proportional to its execution_time_ms.
        // The faster algorithm visibly finishes first.
        const RACE_TOTAL_MS = 5000; // slowest algorithm takes this long total
        const maxExec = Math.max(data.dijkstraExecMs, data.bmssspExecMs, 1);
        const dijkTotalAnim = (data.dijkstraExecMs / maxExec) * RACE_TOTAL_MS;
        const bmssspTotalAnim = (data.bmssspExecMs / maxExec) * RACE_TOTAL_MS;

        // Split each algorithm's time: 60% exploration, 40% route solidifying
        const dijkExploreTime = dijkTotalAnim * 0.6;
        const dijkRouteTime = dijkTotalAnim * 0.4;
        const bmssspExploreTime = bmssspTotalAnim * 0.6;
        const bmssspRouteTime = bmssspTotalAnim * 0.4;

        const dijkExplored = data.dijkstraExplored || [];
        const bmssspExplored = data.bmssspExplored || [];

        const startTime = performance.now();
        let dijkFinished = false;
        let bmssspFinished = false;

        const tick = () => {
            const elapsed = performance.now() - startTime;

            // --- DIJKSTRA ---
            if (!dijkFinished) {
                if (elapsed < dijkExploreTime) {
                    // Dijkstra exploration phase
                    const progress = elapsed / dijkExploreTime;
                    if (dijkExplored.length > 0) {
                        const idx = Math.floor(progress * dijkExplored.length);
                        const slice = dijkExplored.slice(0, idx);
                        const features = slice.map(seg => ({
                            type: 'Feature' as const, properties: {},
                            geometry: { type: 'LineString' as const, coordinates: seg },
                        }));
                        const src = mapRef.current?.getSource('explore-dijkstra') as any;
                        if (src) src.setData({ type: 'FeatureCollection', features });
                    }
                } else {
                    // Dijkstra route solidifying phase
                    // Show all exploration edges (done exploring)
                    if (dijkExplored.length > 0) {
                        const allFeatures = dijkExplored.map(seg => ({
                            type: 'Feature' as const, properties: {},
                            geometry: { type: 'LineString' as const, coordinates: seg },
                        }));
                        const expSrc = mapRef.current?.getSource('explore-dijkstra') as any;
                        if (expSrc) expSrc.setData({ type: 'FeatureCollection', features: allFeatures });
                    }

                    const routeElapsed = elapsed - dijkExploreTime;
                    const routeProgress = Math.min(1, routeElapsed / dijkRouteTime);
                    const dijkIdx = Math.floor(routeProgress * data.dijkstraCoords.length);
                    const dijkSlice = data.dijkstraCoords.slice(0, Math.max(2, dijkIdx));
                    if (dijkSrc && dijkSlice.length >= 2) {
                        dijkSrc.setData({
                            type: 'Feature', properties: {},
                            geometry: { type: 'LineString', coordinates: dijkSlice },
                        });
                    }
                    if (routeProgress >= 1) {
                        dijkFinished = true;
                        setDijkDone(true);
                    }
                }
            }

            // --- DUAN-MAO (BM-SSSP) ---
            if (!bmssspFinished) {
                if (elapsed < bmssspExploreTime) {
                    // BM-SSSP exploration phase
                    const progress = elapsed / bmssspExploreTime;
                    if (bmssspExplored.length > 0) {
                        const idx = Math.floor(progress * bmssspExplored.length);
                        const slice = bmssspExplored.slice(0, idx);
                        const features = slice.map(seg => ({
                            type: 'Feature' as const, properties: {},
                            geometry: { type: 'LineString' as const, coordinates: seg },
                        }));
                        const src = mapRef.current?.getSource('explore-bmsssp') as any;
                        if (src) src.setData({ type: 'FeatureCollection', features });
                    }
                } else {
                    // BM-SSSP route solidifying phase
                    if (bmssspExplored.length > 0) {
                        const allFeatures = bmssspExplored.map(seg => ({
                            type: 'Feature' as const, properties: {},
                            geometry: { type: 'LineString' as const, coordinates: seg },
                        }));
                        const expSrc = mapRef.current?.getSource('explore-bmsssp') as any;
                        if (expSrc) expSrc.setData({ type: 'FeatureCollection', features: allFeatures });
                    }

                    const routeElapsed = elapsed - bmssspExploreTime;
                    const routeProgress = Math.min(1, routeElapsed / bmssspRouteTime);
                    const bmssspIdx = Math.floor(routeProgress * data.bmssspCoords.length);
                    const bmssspSlice = data.bmssspCoords.slice(0, Math.max(2, bmssspIdx));
                    if (bmssspSrc && bmssspSlice.length >= 2) {
                        bmssspSrc.setData({
                            type: 'Feature', properties: {},
                            geometry: { type: 'LineString', coordinates: bmssspSlice },
                        });
                    }
                    if (routeProgress >= 1) {
                        bmssspFinished = true;
                        setBmssspDone(true);
                    }
                }
            }

            // Update phase label
            if (!dijkFinished || !bmssspFinished) {
                if (elapsed < Math.min(dijkExploreTime, bmssspExploreTime)) {
                    setPhase('exploring');
                } else {
                    setPhase('routing');
                }
                animRef.current = requestAnimationFrame(tick);
            } else {
                // Both done — hold for 4 seconds
                setPhase('done');
                holdTimerRef.current = setTimeout(() => {
                    // Mini-map stays visible but animation is done
                }, 4000);
            }
        };

        animRef.current = requestAnimationFrame(tick);

        return () => {
            if (animRef.current != null) {
                cancelAnimationFrame(animRef.current);
                animRef.current = null;
            }
            if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        };
    }, [data]);

    if (!visible) return null;

    const phaseLabel = phase === 'exploring' ? 'SCANNING NETWORK...' : phase === 'routing' ? 'COMPUTING PATHS...' : 'COMPLETE';

    return (
        <div className="absolute bottom-20 right-4 z-[60] w-[340px] h-[260px] rounded-xl overflow-hidden border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.6)] bg-black/40 backdrop-blur-xl">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 px-3 py-1.5 bg-gradient-to-b from-black/90 to-transparent">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-white/80 tracking-widest uppercase">
                        ⚡ Algorithm Race
                    </span>
                    <span className={`text-[8px] font-mono ${phase === 'done' ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
                        {phaseLabel}
                    </span>
                </div>
            </div>

            {/* Map container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Stats overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
                <div className="flex justify-between items-end gap-2">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${dijkDone ? 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]' : 'bg-[#00f0ff]/40 animate-pulse'}`} />
                        <div>
                            <div className="text-[8px] font-mono font-bold text-[#00f0ff] tracking-wider">DIJKSTRA</div>
                            <div className="text-[9px] font-mono text-white/70">
                                {dijkDone ? `${dijkMs.toFixed(0)}ms ✓` : 'Computing...'}
                            </div>
                        </div>
                    </div>

                    {data?.closurePoints && data.closurePoints.length > 0 && (
                        <div className="flex flex-col items-center">
                            <div className="text-[8px] font-mono text-red-400 animate-pulse">🚧 CLOSURE</div>
                        </div>
                    )}

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
