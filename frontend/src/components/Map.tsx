import React, { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import AlgoRaceMiniMap from './AlgoRaceMiniMap';

type LatLng = { lat: number; lng: number };

export type NavLive = {
  distance_to_next_m: number;
  next_instruction: string;
  current_street: string;
  eta_remaining_s: number;
  remaining_distance_m: number;
  algorithm?: string;
  total_distance_m?: number;
  total_time_s?: number;
  sim_speedup: number;
};

type NavStep = {
  id: number;
  instruction: string;
  street: string;
  start_distance_m: number;
  end_distance_m: number;
  maneuver: string;
};

type RouteResponse = {
  path_coordinates: [number, number][]; // [lng, lat]
  snapped_start?: [number, number];
  snapped_end?: [number, number];
  algorithm?: string;
  execution_time_ms?: number;

  total_distance_m?: number;
  total_time_s?: number;
  cum_distance_m?: number[];
  cum_time_s?: number[];
  steps?: NavStep[];
};

type AlgoStats = {
  exec_ms: number;
  eta_s: number;
  dist_m: number;
};

const api = axios.create({
  // If you set VITE_API_BASE=http://127.0.0.1:8000, this will use it.
  // Otherwise it stays relative and works with the Vite proxy (/api -> backend).
  baseURL: (import.meta as any).env?.VITE_API_BASE || '',
});

function bearingDeg(a: [number, number], b: [number, number]): number {
  const dLng = b[0] - a[0];
  const dLat = b[1] - a[1];
  const ang = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  return (ang + 360) % 360;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function formatEta(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function findIndexByCumTime(cumTime: number[], t: number): number {
  // linear scan is fine at hackathon scale (<10k points)
  let i = 1;
  while (i < cumTime.length && cumTime[i] < t) i++;
  return i;
}

function computeNavLive(meta: {
  totalDist: number;
  totalTime: number;
  steps: NavStep[];
  algorithm?: string;
}, traveledM: number, simTimeS: number, simSpeedup: number): NavLive {
  const remainingDist = Math.max(0, meta.totalDist - traveledM);
  const etaRemaining = Math.max(0, meta.totalTime - simTimeS);

  let currentStreet = '--';
  let nextInstruction = 'Proceed';
  let distanceToNext = 0;

  const steps = meta.steps || [];
  if (steps.length) {
    const cur = steps.find((s) => traveledM >= s.start_distance_m && traveledM < s.end_distance_m) || steps[0];
    currentStreet = cur?.street || '--';

    const next =
      steps.find((s) => s.maneuver !== 'depart' && s.start_distance_m > traveledM) ||
      (remainingDist < 15 ? undefined : cur);

    if (!next) {
      nextInstruction = 'Arrive at destination';
      distanceToNext = 0;
    } else {
      nextInstruction = next.instruction;
      distanceToNext = Math.max(0, next.start_distance_m - traveledM);
    }
  }

  return {
    distance_to_next_m: distanceToNext,
    next_instruction: nextInstruction,
    current_street: currentStreet,
    eta_remaining_s: etaRemaining,
    remaining_distance_m: remainingDist,
    algorithm: meta.algorithm,
    total_distance_m: meta.totalDist,
    total_time_s: meta.totalTime,
    sim_speedup: simSpeedup,
  };
}

// Scenario data for tactical injections (duplicated from ScenarioInjector for inline use)
const SCENARIOS: Record<string, any> = {
  CARDIAC_ARREST: {
    title: 'CARDIAC ARREST // UNIT 992',
    isRedAlert: true,
    start: { lat: 43.858, lng: -79.54 },
    end: { lat: 43.871, lng: -79.444 },
    aiPrompt: 'URGENT: 65yo Male, Cardiac Arrest at Major Mackenzie and Jane. CPR in progress. Route to Mackenzie Health immediately via optimized Duan-Mao pivots.',
    vitals: { hr: 0, bp: '0/0', o2: 45 },
    // Road closures along the direct path — forces rerouting
    roadClosures: [
      [43.862, -79.50],   // Major Mackenzie & Weston Rd
      [43.865, -79.48],   // Major Mackenzie & Pine Valley Dr
    ],
  },
  MVA_TRAUMA: {
    title: 'MVA TRAUMA // HWY 404',
    isRedAlert: true,
    start: { lat: 43.86, lng: -79.37 },
    end: { lat: 43.722, lng: -79.376 },
    aiPrompt: 'CRITICAL: Multi-vehicle accident on Hwy 404. Multiple trauma patients. Route to Sunnybrook Trauma Centre. Avoid 404 congestion using side-street pivots.',
    vitals: { hr: 115, bp: '90/60', o2: 92 },
    // Road closures along HWY 404 corridor — forces side-street routing
    roadClosures: [
      [43.82, -79.38],    // Hwy 404 near Sheppard
      [43.79, -79.38],    // Hwy 404 near Finch
    ],
  },
  ROUTINE_PATROL: {
    title: 'ROUTINE PATROL // ZONE B',
    isRedAlert: false,
    start: { lat: 43.864, lng: -79.4 },
    end: { lat: 43.88, lng: -79.4 },
    aiPrompt: 'Unit 992, proceed with routine patrol of Richmond Hill Zone B. Maintain low-latency uplink with mission control.',
    vitals: { hr: 72, bp: '120/80', o2: 98 },
  },
};

export default function LiveMap({
  activeScenario,
  onNavUpdate,
  onScenarioInject,
}: {
  activeScenario?: any;
  onNavUpdate?: (nav: NavLive) => void;
  onScenarioInject?: (s: any) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ambulanceMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);

  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);

  // Live routing inputs
  const [destQuery, setDestQuery] = useState('');
  const [endPoint, setEndPoint] = useState<LatLng | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);

  // Algorithm comparison
  const algoRef = useRef<'dijkstra' | 'bmsssp'>('dijkstra');
  const [algoStats, setAlgoStats] = useState<{ dijkstra?: AlgoStats; bmsssp?: AlgoStats }>({});
  const [showEtaPanel, setShowEtaPanel] = useState(false);
  const [isFetchingStats, setIsFetchingStats] = useState(false);

  // UI feedback
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeReady, setRouteReady] = useState(false);  // route loaded, waiting for GO
  const [simRunning, setSimRunning] = useState(false);   // animation is in progress

  // Algorithm Race Mini-Map
  const [algoRaceData, setAlgoRaceData] = useState<any>(null);
  const [showAlgoRace, setShowAlgoRace] = useState(false);

  // Autocomplete
  type Suggestion = { lat: number; lng: number; display_name: string };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Animation refs
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const followRef = useRef<boolean>(true);
  const scenarioRef = useRef<any>(null);
  const onNavUpdateRef = useRef<typeof onNavUpdate>(onNavUpdate);
  const routeAbortRef = useRef<AbortController | null>(null);

  // Route meta ref (provided by backend)
  const routeRef = useRef<{
    coords: [number, number][];
    cumDist: number[];
    cumTime: number[];
    totalDist: number;
    totalTime: number;
    steps: NavStep[];
    algorithm?: string;
  } | null>(null);

  useEffect(() => {
    followRef.current = isFollowing;
  }, [isFollowing]);
  useEffect(() => {
    scenarioRef.current = activeScenario;
  }, [activeScenario]);
  useEffect(() => {
    onNavUpdateRef.current = onNavUpdate;
  }, [onNavUpdate]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-79.2578, 43.8334],  // Markham Stouffville Hospital
      zoom: 16,
      pitch: 70,
    });

    // Vehicle marker
    const el = document.createElement('div');
    el.className = 'ambulance-marker';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.willChange = 'transform';
    el.innerHTML = `
      <svg id="veh" width="40" height="40" viewBox="0 0 64 64" style="filter: drop-shadow(0 0 10px #00f0ff);">
        <!-- body -->
        <rect x="8" y="18" width="48" height="26" rx="6" fill="#1e293b" stroke="#00f0ff" stroke-width="2"/>
        <!-- cab -->
        <path d="M44 18 L56 18 Q58 18 58 20 L58 38 L44 38 Z" fill="#0f172a" stroke="#00f0ff" stroke-width="1.5"/>
        <!-- windshield -->
        <path d="M46 22 L54 22 Q55 22 55 23 L55 32 L46 32 Z" fill="#38bdf8" opacity="0.5"/>
        <!-- red cross -->
        <rect x="20" y="29" width="12" height="3" rx="1" fill="#ef4444"/>
        <rect x="24.5" y="25" width="3" height="11" rx="1" fill="#ef4444"/>
        <!-- siren -->
        <rect x="24" y="13" width="8" height="6" rx="2" fill="#ef4444" opacity="0.9"/>
        <rect x="24" y="13" width="8" height="6" rx="2" fill="#ef4444" opacity="0.5">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite"/>
        </rect>
        <!-- wheels -->
        <circle cx="18" cy="44" r="5" fill="#334155" stroke="#00f0ff" stroke-width="1.5"/>
        <circle cx="18" cy="44" r="2" fill="#00f0ff"/>
        <circle cx="46" cy="44" r="5" fill="#334155" stroke="#00f0ff" stroke-width="1.5"/>
        <circle cx="46" cy="44" r="2" fill="#00f0ff"/>
      </svg>
    `;

    ambulanceMarker.current = new maplibregl.Marker({ element: el }).setLngLat([-79.2578, 43.8334]).addTo(map.current);  // Markham Stouffville Hospital

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

      // Road closure markers source
      map.current?.addSource('road-closures', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current?.addLayer({
        id: 'road-closures-circle',
        type: 'circle',
        source: 'road-closures',
        paint: {
          'circle-radius': 10,
          'circle-color': '#ff4444',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
          'circle-opacity': 0.9,
        },
      });
      map.current?.addLayer({
        id: 'road-closures-label',
        type: 'symbol',
        source: 'road-closures',
        layout: {
          'text-field': '✕',
          'text-size': 14,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Don't auto-route on load — wait for user to search a destination

      // Defer 3D buildings so they don't block the initial animation
      setTimeout(() => {
        const style = map.current?.getStyle();
        if (!style) return;
        const sources = style.sources || {};
        const buildingSource = sources['openmaptiles'] ? 'openmaptiles' : (sources['carto'] ? 'carto' : null);

        if (buildingSource) {
          const labelLayerId = style.layers?.find(
            (layer) => layer.type === 'symbol' && layer.layout && (layer.layout as any)['text-field']
          )?.id;

          map.current?.addLayer(
            {
              id: '3d-buildings',
              source: buildingSource,
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 15,
              paint: {
                'fill-extrusion-color': '#333',
                'fill-extrusion-height': ['get', 'render_height'],
                'fill-extrusion-base': ['get', 'render_min_height'],
                'fill-extrusion-opacity': 0.6,
              },
            },
            labelLayerId
          );
        }
      }, 1000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-route on scenario change (auto-start for dispatch scenarios)
  useEffect(() => {
    if (!map.current?.loaded()) return;

    // Draw road closure markers on main map
    const closures = activeScenario?.roadClosures || [];
    const closureSrc = map.current?.getSource('road-closures') as any;
    if (closureSrc) {
      const features = closures.map(([lat, lng]: [number, number]) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lng, lat] },
      }));
      closureSrc.setData({ type: 'FeatureCollection', features });
    }

    // Trigger algorithm race mini-map for red alert scenarios
    if (activeScenario?.isRedAlert && closures.length > 0) {
      fetchAlgoRace(activeScenario);
    } else {
      setShowAlgoRace(false);
      setAlgoRaceData(null);
    }

    if (activeScenario?.end) {
      const end = { lat: activeScenario.end.lat, lng: activeScenario.end.lng };
      setEndPoint(end);
      // Use scenario start position for ambulance
      if (activeScenario.start && ambulanceMarker.current) {
        ambulanceMarker.current.setLngLat([activeScenario.start.lng, activeScenario.start.lat]);
      }
      fetchRoute(end, true, closures);  // auto-start with road closures
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  const fetchRoute = async (endOverride?: LatLng, autoStart = false, blockedEdges?: number[][]) => {
    try {
      setIsRouting(true);
      setRouteError(null);
      setRouteReady(false);

      // Stop any running animation
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }

      const cur = ambulanceMarker.current?.getLngLat();
      const start = cur ? { lat: cur.lat, lng: cur.lng } : { lat: 43.8334, lng: -79.2578 };  // Markham Stouffville Hospital

      // Create abort controller for this route request
      if (routeAbortRef.current) routeAbortRef.current.abort();
      const controller = new AbortController();
      routeAbortRef.current = controller;

      const requestBody: any = {
        start,
        end: endOverride ?? endPoint,
        scenario_type: activeScenario?.title || 'ROUTINE',
        algorithm: algoRef.current,
      };
      if (blockedEdges && blockedEdges.length > 0) {
        requestBody.blocked_edges = blockedEdges;
      }

      const res = await api.post<RouteResponse>('/api/algo/calculate', requestBody, { signal: controller.signal });

      const coords = (res.data?.path_coordinates || []) as [number, number][];
      const cumDist = (res.data?.cum_distance_m || []) as number[];
      const cumTime = (res.data?.cum_time_s || []) as number[];
      const totalDist = Number(res.data?.total_distance_m ?? (cumDist.length ? cumDist[cumDist.length - 1] : 0));
      const totalTime = Number(res.data?.total_time_s ?? (cumTime.length ? cumTime[cumTime.length - 1] : 0));
      const steps = (res.data?.steps || []) as NavStep[];

      if (!coords.length || !cumDist.length || !cumTime.length) {
        throw new Error('Route meta missing (coords/cumDist/cumTime). Check backend /calculate response.');
      }

      // Put the marker ON the road network (snapped) so it's not inside buildings.
      const snapped = res.data.snapped_start;
      if (snapped && ambulanceMarker.current) {
        ambulanceMarker.current.setLngLat(snapped);
      } else if (ambulanceMarker.current) {
        ambulanceMarker.current.setLngLat(coords[0]);
      }

      // Store comparison stats for the current algorithm
      const statsEntry: AlgoStats = {
        exec_ms: Number(res.data.execution_time_ms ?? 0),
        eta_s: totalTime,
        dist_m: totalDist,
      };
      setAlgoStats((prev) => ({ ...prev, [algoRef.current]: statsEntry }));

      routeRef.current = {
        coords,
        cumDist,
        cumTime,
        totalDist,
        totalTime,
        steps,
        algorithm: res.data.algorithm,
      };

      // Place a red pin at the destination
      if (map.current) {
        if (destMarker.current) destMarker.current.remove();
        const destEl = document.createElement('div');
        destEl.style.width = '32px';
        destEl.style.height = '32px';
        destEl.style.display = 'flex';
        destEl.style.alignItems = 'center';
        destEl.style.justifyContent = 'center';
        destEl.innerHTML = `
          <svg width="32" height="32" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="white" stroke-width="1.2"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        `;
        const destCoord = res.data.snapped_end || coords[coords.length - 1];
        destMarker.current = new maplibregl.Marker({ element: destEl, anchor: 'bottom' })
          .setLngLat(destCoord)
          .addTo(map.current);
      }

      // Draw route line on map (but don't start animation yet)
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

      // Center camera on the route
      map.current?.jumpTo({ center: (snapped || coords[0]) as any });

      // Push an initial nav state (shows distance/ETA in HUD before animation starts)
      const simSpeedup = 8;
      const initialNav = computeNavLive(
        { totalDist, totalTime, steps, algorithm: res.data.algorithm },
        0,
        0,
        simSpeedup
      );
      onNavUpdateRef.current?.(initialNav);

      // If autoStart (e.g. dispatch scenario), begin animation immediately
      if (autoStart) {
        setRouteCoordinates(coords);
      } else {
        setRouteReady(true);  // enable GO button, wait for user click
      }
    } catch (e: any) {
      // Ignore aborted requests
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
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

  const startAnimation = () => {
    if (!routeRef.current) return;
    setRouteReady(false);
    setSimRunning(true);
    setRouteCoordinates(routeRef.current.coords);  // triggers the animation useEffect
  };

  const cancelRoute = () => {
    // Abort any in-flight route calculation
    if (routeAbortRef.current) {
      routeAbortRef.current.abort();
      routeAbortRef.current = null;
    }

    // Stop animation
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    // Clear all route state
    setRouteCoordinates([]);
    setRouteReady(false);
    setSimRunning(false);
    setIsRouting(false);
    setDestQuery('');
    setEndPoint(null);
    setRouteError(null);
    setSuggestions([]);
    setShowSuggestions(false);
    routeRef.current = null;

    // Clear destination marker
    if (destMarker.current) { destMarker.current.remove(); destMarker.current = null; }

    // Clear the route line from the map
    const src = map.current?.getSource('aegis-route') as any;
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  };

  // Fetch stats for both algorithms (for comparison panel)
  const fetchBothAlgoStats = async () => {
    setIsFetchingStats(true);
    const cur = ambulanceMarker.current?.getLngLat();
    const start = cur ? { lat: cur.lat, lng: cur.lng } : { lat: 43.8334, lng: -79.2578 };
    const body = {
      start,
      end: endPoint,
      scenario_type: activeScenario?.title || 'ROUTINE',
    };
    try {
      const [dRes, bRes] = await Promise.all([
        api.post<RouteResponse>('/api/algo/calculate', { ...body, algorithm: 'dijkstra' }),
        api.post<RouteResponse>('/api/algo/calculate', { ...body, algorithm: 'bmsssp' }),
      ]);
      setAlgoStats({
        dijkstra: {
          exec_ms: Number(dRes.data.execution_time_ms ?? 0),
          eta_s: Number(dRes.data.total_time_s ?? 0),
          dist_m: Number(dRes.data.total_distance_m ?? 0),
        },
        bmsssp: {
          exec_ms: Number(bRes.data.execution_time_ms ?? 0),
          eta_s: Number(bRes.data.total_time_s ?? 0),
          dist_m: Number(bRes.data.total_distance_m ?? 0),
        },
      });
    } catch (e) {
      console.error('Failed to fetch comparison stats', e);
    } finally {
      setIsFetchingStats(false);
    }
  };

  // Fetch both algorithms with road closures for the algorithm race mini-map
  const fetchAlgoRace = async (scenario: any) => {
    try {
      setShowAlgoRace(true);
      const start = scenario.start || { lat: 43.8334, lng: -79.2578 };
      const end = scenario.end || endPoint;
      const blocked = scenario.roadClosures || [];

      const body = {
        start,
        end,
        scenario_type: scenario.title || 'ROUTINE',
        blocked_edges: blocked,
      };

      const [dijkRes, bmssspRes] = await Promise.all([
        api.post<RouteResponse>('/api/algo/calculate', { ...body, algorithm: 'dijkstra' }),
        api.post<RouteResponse>('/api/algo/calculate', { ...body, algorithm: 'bmsssp' }),
      ]);

      // Convert closure points to [lng, lat] for the mini-map
      const closurePointsLngLat = blocked.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);

      setAlgoRaceData({
        dijkstraCoords: dijkRes.data.path_coordinates || [],
        dijkstraExecMs: Number(dijkRes.data.execution_time_ms ?? 100),
        bmssspCoords: bmssspRes.data.path_coordinates || [],
        bmssspExecMs: Number(bmssspRes.data.execution_time_ms ?? 100),
        closurePoints: closurePointsLngLat,
      });
    } catch (e) {
      console.error('Algorithm race fetch failed', e);
      setShowAlgoRace(false);
    }
  };

  const handleGeocode = async () => {
    if (!destQuery.trim()) return;
    try {
      setIsRouting(true);
      setRouteError(null);

      // Use autocomplete endpoint (York Region scoped) and take the first result
      const res = await api.get('/api/algo/autocomplete', { params: { q: destQuery.trim() } });
      const results = res.data?.results || [];
      if (!results.length) {
        setRouteError('No addresses found in York Region. Try a more specific query.');
        setIsRouting(false);
        return;
      }
      const top = results[0];
      setDestQuery(top.display_name);
      const end = { lat: top.lat, lng: top.lng };
      setEndPoint(end);
      await fetchRoute(end);  // loads route, enables GO
    } catch (e: any) {
      console.error('Geocode failed', e);
      setRouteError(
        e?.response?.data?.detail ||
        e?.message ||
        'Geocode failed. Try a more specific address in York Region.'
      );
      setIsRouting(false);
    }
  };

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Cancel any previous in-flight autocomplete request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await api.get('/api/algo/autocomplete', {
        params: { q: query.trim() },
        signal: controller.signal,
      });
      const results = res.data?.results || [];
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (err: any) {
      // Ignore aborted requests (user kept typing)
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const onInputChange = (value: string) => {
    setDestQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 1100ms debounce — Nominatim enforces max 1 request/second
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 1100);
  };

  const handleSelectSuggestion = async (s: Suggestion) => {
    setDestQuery(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    const end = { lat: s.lat, lng: s.lng };
    setEndPoint(end);
    await fetchRoute(end);  // loads route, enables GO — does NOT start animation
  };

  // Realistic GPS-like animation: drive the marker using backend's cum_time_s (and a speedup factor for demo).
  useEffect(() => {
    if (!routeCoordinates.length) return;

    // stop previous animation
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const meta = routeRef.current;
    if (!meta) return;

    startTimeRef.current = performance.now();

    // start at first point
    setCurrentPos(meta.coords[0]);
    setSimRunning(true);

    const SIM_SPEEDUP = 8; // demo speed multiplier: increases how fast the vehicle progresses along the real route timebase

    const tick = () => {
      const m = routeRef.current;
      if (!m || !ambulanceMarker.current || !map.current) return;

      const elapsedS = (performance.now() - startTimeRef.current) / 1000;
      const simTimeS = elapsedS * SIM_SPEEDUP;
      const totalTime = m.totalTime || m.cumTime[m.cumTime.length - 1];

      if (simTimeS >= totalTime) {
        const end = m.coords[m.coords.length - 1];
        ambulanceMarker.current.setLngLat(end);
        setCurrentPos(end);
        setSimRunning(false);
        // Clear the route line — trip is done
        const src = map.current?.getSource('aegis-route') as any;
        if (src) src.setData({ type: 'FeatureCollection', features: [] });
        // final nav push
        const finalNav = computeNavLive(
          { totalDist: m.totalDist, totalTime, steps: m.steps, algorithm: m.algorithm },
          m.totalDist,
          totalTime,
          SIM_SPEEDUP
        );
        onNavUpdateRef.current?.(finalNav);
        return;
      }

      const i = clamp(findIndexByCumTime(m.cumTime, simTimeS), 1, m.cumTime.length - 1);
      const t0 = m.cumTime[i - 1];
      const t1 = m.cumTime[i];
      const frac = t1 === t0 ? 0 : (simTimeS - t0) / (t1 - t0);

      const a = m.coords[i - 1];
      const b = m.coords[i];
      const pos: [number, number] = [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];

      ambulanceMarker.current.setLngLat(pos);
      setCurrentPos(pos);

      // Trim the route line: only show the path AHEAD of the vehicle
      const remainingCoords: [number, number][] = [pos, ...m.coords.slice(i)];
      const src = map.current?.getSource('aegis-route') as any;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: remainingCoords },
          }],
        });
      }

      // traveled distance for nav
      const d0 = m.cumDist[i - 1];
      const d1 = m.cumDist[i];
      const traveledM = d0 + (d1 - d0) * frac;

      // update nav panel via callback
      const nav = computeNavLive(
        { totalDist: m.totalDist, totalTime, steps: m.steps, algorithm: m.algorithm },
        traveledM,
        simTimeS,
        SIM_SPEEDUP
      );
      onNavUpdateRef.current?.(nav);

      const brg = bearingDeg(a, b);

      // Dynamic zoom/pitch for turn-awareness
      const BASE_ZOOM = 16;
      const TURN_ZOOM = 18.5;
      const TURN_DIST_THRESHOLD = 100; // start zooming in 100m before turn

      let targetZoom = BASE_ZOOM;
      const isApproachingTurn =
        nav.distance_to_next_m < TURN_DIST_THRESHOLD &&
        (nav.next_instruction.toLowerCase().includes('turn') || nav.next_instruction.toLowerCase().includes('onto'));

      if (isApproachingTurn) {
        const factor = 1 - (nav.distance_to_next_m / TURN_DIST_THRESHOLD);
        targetZoom = BASE_ZOOM + (TURN_ZOOM - BASE_ZOOM) * factor;
      }

      if (followRef.current) {
        map.current.easeTo({
          center: pos,
          bearing: brg,
          zoom: targetZoom,
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
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-cyan-500/30 flex flex-col gap-1 min-w-[220px]">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${activeScenario?.isRedAlert ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'
                }`}
            />
            <span className="text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-tighter">
              {activeScenario?.title || 'SYSTEM IDLE'}
            </span>
          </div>
          <div className="text-[9px] text-gray-500 font-mono">
            UNIT 992 // {currentPos ? `${currentPos[0].toFixed(5)}, ${currentPos[1].toFixed(5)}` : '--, --'}
          </div>
          {routeRef.current?.totalDist != null && routeRef.current?.totalTime != null && (
            <div className="text-[9px] text-gray-500 font-mono">
              ROUTE // {(routeRef.current.totalDist / 1000).toFixed(2)} km // ETA {formatEta(routeRef.current.totalTime)}
            </div>
          )}
          {routeError && <div className="text-[10px] text-red-300 font-mono mt-1 max-w-[300px]">{routeError}</div>}
        </div>

      </div>

      {/* Destination input with autocomplete */}
      <div className="absolute top-4 right-4 z-50">
        <div className="bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-white/10 flex gap-2 items-center">
          <div className="relative">
            <input
              value={destQuery}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Enter address in York Region"
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white w-64 outline-none focus:border-cyan-500/50 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowSuggestions(false);
                  // If route already loaded, Enter starts animation
                  if (routeReady) { startAnimation(); return; }
                  handleGeocode();
                }
                if (e.key === 'Escape') setShowSuggestions(false);
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
            />

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,240,255,0.15)]">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-[11px] text-gray-300 hover:bg-cyan-500/15 hover:text-cyan-200 transition-colors border-b border-white/5 last:border-b-0 flex items-start gap-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <span className="text-cyan-500 mt-px shrink-0">📍</span>
                    <span className="line-clamp-2 leading-tight">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setShowSuggestions(false);
              if (routeReady) {
                startAnimation();
              } else {
                handleGeocode();
              }
            }}
            disabled={isRouting || simRunning}
            className={`px-3 py-1 rounded border text-xs font-mono ${isRouting || simRunning
              ? 'bg-white/5 border-white/10 text-gray-400 cursor-not-allowed'
              : routeReady
                ? 'bg-green-500/20 border-green-400/40 text-green-300 hover:bg-green-500/30 animate-pulse'
                : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30'
              }`}
          >
            {isRouting ? '...' : simRunning ? 'MOVING' : routeReady ? '▶ GO' : 'GO'}
          </button>
          <button
            onClick={() => setIsFollowing((v) => !v)}
            className={`px-2 py-1 rounded border text-xs font-mono ${isFollowing ? 'border-cyan-400/50 text-cyan-300' : 'border-white/10 text-gray-400'
              }`}
          >
            {isFollowing ? 'FOLLOW' : 'FREE'}
          </button>
          {(simRunning || isRouting) && (
            <button
              onClick={cancelRoute}
              className="px-2 py-1 rounded border text-xs font-mono bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30 transition-colors"
              title="Cancel route"
            >
              ✕
            </button>
          )}

        </div>
      </div>

      {/* Bottom-left Dev panel */}
      <div className="absolute bottom-4 left-4 z-50 flex flex-col items-start gap-2">
        {showEtaPanel && (
          <div className="bg-black/90 backdrop-blur-xl p-4 rounded-lg border border-cyan-500/30 min-w-[300px] flex flex-col gap-3 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
            {/* Algorithm Comparison */}
            <div>
              <div className="text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider mb-2">Algorithm Comparison</div>
              {isFetchingStats ? (
                <div className="text-[9px] text-gray-400 font-mono animate-pulse">Fetching both routes...</div>
              ) : (
                <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                  <div className="text-gray-500"></div>
                  <div className="text-cyan-300 text-center">DIJKSTRA</div>
                  <div className="text-purple-300 text-center">DUAN-MAO</div>

                  <div className="text-gray-500">EXEC</div>
                  <div className="text-cyan-200 text-center">{algoStats.dijkstra ? `${algoStats.dijkstra.exec_ms.toFixed(0)}ms` : '—'}</div>
                  <div className="text-purple-200 text-center">{algoStats.bmsssp ? `${algoStats.bmsssp.exec_ms.toFixed(0)}ms` : '—'}</div>

                  <div className="text-gray-500">ETA</div>
                  <div className="text-cyan-200 text-center">{algoStats.dijkstra ? formatEta(algoStats.dijkstra.eta_s) : '—'}</div>
                  <div className="text-purple-200 text-center">{algoStats.bmsssp ? formatEta(algoStats.bmsssp.eta_s) : '—'}</div>

                  <div className="text-gray-500">DIST</div>
                  <div className="text-cyan-200 text-center">{algoStats.dijkstra ? `${(algoStats.dijkstra.dist_m / 1000).toFixed(2)}km` : '—'}</div>
                  <div className="text-purple-200 text-center">{algoStats.bmsssp ? `${(algoStats.bmsssp.dist_m / 1000).toFixed(2)}km` : '—'}</div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Tactical Injections */}
            <div>
              <div className="text-[10px] text-cyan-500/60 font-mono font-bold uppercase tracking-wider mb-2">Tactical Injections</div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(SCENARIOS).map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => onScenarioInject?.(data)}
                    className={`w-full text-left px-3 py-2 text-[10px] font-mono font-bold rounded-lg border transition-all duration-300 hover:scale-[1.02] active:scale-95 ${data.isRedAlert
                      ? 'border-red-500/40 text-red-500 bg-red-500/5 hover:bg-red-500 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                      : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500 hover:text-white shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                      }`}
                  >
                    {key.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            const next = !showEtaPanel;
            setShowEtaPanel(next);
            if (next) fetchBothAlgoStats();
          }}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all duration-300 ${showEtaPanel
            ? 'bg-cyan-500/30 border-cyan-400/50 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
            : 'bg-black/80 backdrop-blur-xl border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/30'
            }`}
        >
          {showEtaPanel ? '✕ DEV' : '⚙ DEV'}
        </button>
      </div>

      {/* Algorithm Race Mini-Map (bottom-right) */}
      <AlgoRaceMiniMap data={algoRaceData} visible={showAlgoRace} />
    </div>
  );
}