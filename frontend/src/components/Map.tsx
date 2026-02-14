import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';

type LatLng = { lat: number; lng: number };

type RouteResponse = {
  path_coordinates: [number, number][]; // [lng, lat]
  snapped_start?: [number, number];
  snapped_end?: [number, number];
  algorithm?: string;
  execution_time_ms?: number;
};

const api = axios.create({
  // If you set VITE_API_BASE=http://127.0.0.1:8000, this will use it.
  // Otherwise it stays relative and works with the Vite proxy (/api -> backend).
  baseURL: (import.meta as any).env?.VITE_API_BASE || '',
});

function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function buildCumulativeDistances(coords: [number, number][]): number[] {
  const cum: number[] = new Array(coords.length).fill(0);
  for (let i = 1; i < coords.length; i++) {
    cum[i] = cum[i - 1] + haversineMeters(coords[i - 1], coords[i]);
  }
  return cum;
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  // Simple bearing (good enough for short steps)
  const dLng = b[0] - a[0];
  const dLat = b[1] - a[1];
  return (Math.atan2(dLng, dLat) * 180) / Math.PI;
}

function speedForScenario(title?: string): number {
  const t = (title || '').toUpperCase();
  // m/s (rough hackathon simulation)
  if (t.includes('TRAUMA')) return 18;       // ~65 km/h
  if (t.includes('ARREST') || t.includes('CARDIAC')) return 16; // ~58 km/h
  return 12;                                 // ~43 km/h
}

export default function LiveMap({ activeScenario }: { activeScenario?: any }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ambulanceMarker = useRef<maplibregl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);

  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);

  // Live routing inputs
  const [destQuery, setDestQuery] = useState('Mackenzie Health Hospital');
  const [endPoint, setEndPoint] = useState<LatLng>({ lat: 43.8800, lng: -79.2500 });
  const [isFollowing, setIsFollowing] = useState(true);

  // UI feedback
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Animation refs
  const animRef = useRef<number | null>(null);
  const routeRef = useRef<{ coords: [number, number][], cum: number[] } | null>(null);
  const startTimeRef = useRef<number>(0);
  const followRef = useRef<boolean>(true);
  const scenarioRef = useRef<any>(null);

  useEffect(() => { followRef.current = isFollowing; }, [isFollowing]);
  useEffect(() => { scenarioRef.current = activeScenario; }, [activeScenario]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-79.44, 43.86],
      zoom: 16,
      pitch: 70,
    });

    // Marker
    const el = document.createElement('div');
    el.className = 'ambulance-marker';
    el.style.width = '28px';
    el.style.height = '28px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.willChange = 'transform';
    el.innerHTML = `
      <div id="veh" style="
        width: 24px; height: 24px;
        background: #00f0ff;
        border: 2px solid white;
        border-radius: 6px;
        box-shadow: 0 0 20px #00f0ff;
        transform: rotate(45deg);
      "></div>
    `;
    markerElRef.current = el;

    ambulanceMarker.current = new maplibregl.Marker(el).setLngLat([-79.44, 43.86]).addTo(map.current);

    map.current.on('load', () => {
      map.current?.addSource('aegis-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current?.addLayer({
        id: 'aegis-route-line',
        type: 'line',
        source: 'aegis-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 6, 'line-color': '#00f0ff', 'line-opacity': 0.85 },
      });

      // Initial route (so the demo starts "alive")
      fetchRoute();
    });
  }, []);

  // Re-route on scenario change
  useEffect(() => {
    if (!map.current?.loaded()) return;

    if (activeScenario?.location) {
      const end = { lat: activeScenario.location.lat, lng: activeScenario.location.lng };
      setEndPoint(end);
      fetchRoute(end);
      return;
    }

    fetchRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  const fetchRoute = async (endOverride?: LatLng) => {
    try {
      setIsRouting(true);
      setRouteError(null);

      const cur = ambulanceMarker.current?.getLngLat();
      const start = cur ? { lat: cur.lat, lng: cur.lng } : { lat: 43.8561, lng: -79.5570 };

      const res = await api.post<RouteResponse>('/api/algo/calculate', {
        start,
        end: endOverride ?? endPoint,
        scenario_type: activeScenario?.title || 'ROUTINE',
      });

      const coords = (res.data?.path_coordinates || []) as [number, number][];
      if (!coords.length) {
        throw new Error('No route points returned from backend.');
      }

      // Put the marker ON the road network (snapped) so it's not inside buildings.
      const snapped = res.data.snapped_start;
      if (snapped && ambulanceMarker.current) {
        ambulanceMarker.current.setLngLat(snapped);
      } else if (ambulanceMarker.current) {
        ambulanceMarker.current.setLngLat(coords[0]);
      }

      setRouteCoordinates(coords);

      // Update route line
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          },
        ],
      };
      const src = map.current?.getSource('aegis-route') as any;
      if (src) src.setData(geojson);

      // Immediately center the camera
      map.current?.jumpTo({ center: (snapped || coords[0]) as any });
    } catch (e: any) {
      console.error('Route fetch failed', e);
      setRouteError(
        e?.response?.data?.detail ||
          e?.message ||
          'Route fetch failed. Is the backend running on http://127.0.0.1:8000 ?'
      );
    } finally {
      setIsRouting(false);
    }
  };

  const handleGeocode = async () => {
    if (!destQuery.trim()) return;
    try {
      setIsRouting(true);
      setRouteError(null);

      const res = await api.get('/api/algo/geocode', { params: { q: destQuery.trim() } });
      const end = { lat: res.data.lat, lng: res.data.lng };
      setEndPoint(end);
      await fetchRoute(end);
    } catch (e: any) {
      console.error('Geocode failed', e);
      setRouteError(
        e?.response?.data?.detail ||
          e?.message ||
          'Geocode failed. Try a simpler query like "Mackenzie Health" or "Markham Stouffville Hospital".'
      );
      setIsRouting(false);
    }
  };

  // Smooth GPS-like animation (constant speed along the polyline)
  useEffect(() => {
    if (!routeCoordinates.length) return;

    // stop previous animation
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const coords = routeCoordinates;
    const cum = buildCumulativeDistances(coords);
    routeRef.current = { coords, cum };
    startTimeRef.current = performance.now();

    // start at first point
    setCurrentPos(coords[0]);

    const tick = () => {
      const meta = routeRef.current;
      if (!meta || !ambulanceMarker.current || !map.current) return;

      const elapsedS = (performance.now() - startTimeRef.current) / 1000;
      const speed = speedForScenario(scenarioRef.current?.title);
      const dist = elapsedS * speed;
      const total = meta.cum[meta.cum.length - 1];

      if (dist >= total) {
        const end = meta.coords[meta.coords.length - 1];
        ambulanceMarker.current.setLngLat(end);
        setCurrentPos(end);
        return;
      }

      // Find the segment index (linear scan with small step is fine at hackathon scale)
      let i = 1;
      while (i < meta.cum.length && meta.cum[i] < dist) i++;

      const d0 = meta.cum[i - 1];
      const d1 = meta.cum[i];
      const t = d1 === d0 ? 0 : (dist - d0) / (d1 - d0);

      const a = meta.coords[i - 1];
      const b = meta.coords[i];
      const pos: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

      ambulanceMarker.current.setLngLat(pos);
      setCurrentPos(pos);

      const brg = bearingDeg(a, b);

      if (followRef.current) {
        map.current.easeTo({
          center: pos,
          bearing: brg,
          duration: 120,
          easing: (x) => x,
          essential: true,
        });
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
  }, [routeCoordinates]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full rounded-2xl overflow-hidden border border-white/10" />

      {/* HUD: MINIMAL CORNER OVERLAY */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-cyan-500/30 flex flex-col gap-1 min-w-[200px]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeScenario?.isRedAlert ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`} />
          <span className="text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-tighter">
            {activeScenario?.title || 'SYSTEM IDLE'}
          </span>
        </div>
        <div className="text-[9px] text-gray-500 font-mono">
          UNIT 992 // {currentPos ? `${currentPos[0].toFixed(5)}, ${currentPos[1].toFixed(5)}` : '--, --'}
        </div>
        {routeError && (
          <div className="text-[10px] text-red-300 font-mono mt-1 max-w-[260px]">
            {routeError}
          </div>
        )}
      </div>

      {/* Destination input (demo) */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-white/10 flex gap-2 items-center">
        <input
          value={destQuery}
          onChange={(e) => setDestQuery(e.target.value)}
          placeholder="Enter destination (hospital / address)"
          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white w-56 outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGeocode();
          }}
        />
        <button
          onClick={handleGeocode}
          disabled={isRouting}
          className={`px-3 py-1 rounded border text-xs font-mono ${
            isRouting
              ? 'bg-white/5 border-white/10 text-gray-400 cursor-not-allowed'
              : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30'
          }`}
        >
          {isRouting ? '...' : 'GO'}
        </button>
        <button
          onClick={() => setIsFollowing((v) => !v)}
          className={`px-2 py-1 rounded border text-xs font-mono ${
            isFollowing ? 'border-cyan-400/50 text-cyan-300' : 'border-white/10 text-gray-400'
          }`}
        >
          {isFollowing ? 'FOLLOW' : 'FREE'}
        </button>
      </div>
    </div>
  );
}
