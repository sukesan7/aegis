import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';

type LatLng = { lat: number; lng: number };

export default function LiveMap({ activeScenario }: { activeScenario?: any }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ambulanceMarker = useRef<maplibregl.Marker | null>(null);
  
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Live routing inputs
  const [destQuery, setDestQuery] = useState('Mackenzie Health Hospital');
  const [endPoint, setEndPoint] = useState<LatLng>({ lat: 43.8800, lng: -79.2500 });
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-79.44, 43.86],
      zoom: 16, 
      pitch: 70, // Driver perspective
      // 'antialias' removed to fix the TS error
    });

    const el = document.createElement('div');
    el.className = 'ambulance-marker';
    el.style.transition = 'all 0.2s linear';
    el.innerHTML = `<div style="width: 24px; height: 24px; background: #00f0ff; border: 2px solid white; border-radius: 4px; box-shadow: 0 0 20px #00f0ff; transform: rotate(45deg);"></div>`;

    ambulanceMarker.current = new maplibregl.Marker(el).setLngLat([-79.44, 43.86]).addTo(map.current);

    map.current.on('load', () => {
      // Route line source/layer (updated when we fetch a route)
      map.current?.addSource('aegis-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.current?.addLayer({
        id: 'aegis-route-line',
        type: 'line',
        source: 'aegis-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 6, 'line-color': '#00f0ff', 'line-opacity': 0.8 }
      });

      fetchDuanMaoPath();
    });
  }, []);

  // Sync path with scenario changes
  useEffect(() => {
    if (activeScenario?.location) {
      const end = { lat: activeScenario.location.lat, lng: activeScenario.location.lng };
      setEndPoint(end);
      if (map.current?.loaded()) fetchDuanMaoPath(end);
      return;
    }
    if (map.current?.loaded()) fetchDuanMaoPath();
  }, [activeScenario]);

  const fetchDuanMaoPath = async (endOverride?: LatLng) => {
    try {
      const cur = ambulanceMarker.current?.getLngLat();
      const start = cur ? { lat: cur.lat, lng: cur.lng } : { lat: 43.8561, lng: -79.5570 };

      const res = await axios.post('/api/algo/calculate', {
        start,
        end: endOverride ?? endPoint,
        scenario_type: activeScenario?.title || "ROUTINE"
      });
      const coords: [number, number][] = res.data.path_coordinates;
      setRouteCoordinates(coords);
      setCurrentStep(0);

      // Update route line
      const geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords }
        }]
      };
      const src = map.current?.getSource('aegis-route') as any;
      if (src) src.setData(geojson);
    } catch (e) { console.error("Duan-Mao Link Failed", e); }
  };

  const handleGeocode = async () => {
    if (!destQuery.trim()) return;
    try {
      const res = await axios.get('/api/algo/geocode', { params: { q: destQuery.trim() } });
      const end = { lat: res.data.lat, lng: res.data.lng };
      setEndPoint(end);
      fetchDuanMaoPath(end);
    } catch (e) {
      console.error('Geocode failed', e);
    }
  };

  useEffect(() => {
    if (routeCoordinates.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= routeCoordinates.length - 1) { clearInterval(interval); return prev; }
        
        const next = prev + 1;
        const pos = routeCoordinates[next];
        const prevPos = routeCoordinates[prev];

        // Dynamic Bearing for 3D Camera Rotation
        const bearing = Math.atan2(pos[0] - prevPos[0], pos[1] - prevPos[1]) * (180 / Math.PI);

        if (ambulanceMarker.current && map.current) {
          ambulanceMarker.current.setLngLat(pos);
          if (isFollowing) {
            map.current.easeTo({ 
              center: pos, 
              bearing: bearing, 
              duration: 200, 
              easing: (t) => t,
              essential: true
            });
          }
        }
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [routeCoordinates]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full rounded-2xl overflow-hidden border border-white/10" />
      
      {/* HUD: MINIMAL CORNER OVERLAY */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-cyan-500/30 flex flex-col gap-1 min-w-[180px]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeScenario?.isRedAlert ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`} />
          <span className="text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-tighter">
            {activeScenario?.title || "SYSTEM IDLE"}
          </span>
        </div>
        <div className="text-[9px] text-gray-500 font-mono">
          UNIT 992 // {routeCoordinates[currentStep]?.[0] != null ? routeCoordinates[currentStep][0].toFixed(4) : '--'}, {routeCoordinates[currentStep]?.[1] != null ? routeCoordinates[currentStep][1].toFixed(4) : '--'}
        </div>
      </div>

      {/* Destination input (demo) */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-white/10 flex gap-2 items-center">
        <input
          value={destQuery}
          onChange={(e) => setDestQuery(e.target.value)}
          placeholder="Enter destination (hospital / address)"
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white w-56 outline-none"
          onKeyDown={(e) => { if (e.key === 'Enter') handleGeocode(); }}
        />
        <button
          onClick={handleGeocode}
          className="px-3 py-1 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-mono hover:bg-cyan-500/30"
        >
          GO
        </button>
        <button
          onClick={() => setIsFollowing(v => !v)}
          className={`px-2 py-1 rounded border text-xs font-mono ${isFollowing ? 'border-cyan-400/50 text-cyan-300' : 'border-white/10 text-gray-400'}`}
        >
          {isFollowing ? 'FOLLOW' : 'FREE'}
        </button>
      </div>
    </div>
  );
}