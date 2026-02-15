import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TelemetryPoint = {
  t: number; // seconds since start of the current race
  dExplored: number;
  bExplored: number;
  dRoutePct: number; // 0..1
  bRoutePct: number; // 0..1
};

export type AlgoRaceChartsProps = {
  telemetry: TelemetryPoint[];
  dijkstraRoute: [number, number][];
  bmssspRoute: [number, number][];
};

function haversineMeters(a: [number, number], b: [number, number]): number {
  // coords are [lng, lat]
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLon = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function segmentLengthsMeters(route: [number, number][]): number[] {
  if (!route || route.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < route.length; i++) out.push(haversineMeters(route[i - 1], route[i]));
  return out;
}

function buildHistogram(
  dSeg: number[],
  bSeg: number[],
  bins: number
): { bin: string; d: number; b: number }[] {
  const all = [...dSeg, ...bSeg];
  if (all.length === 0) return [];
  const max = Math.max(...all);
  const min = 0;
  const width = Math.max(1e-6, (max - min) / bins);

  const countsD = new Array(bins).fill(0);
  const countsB = new Array(bins).fill(0);

  const add = (arr: number[], bucket: number[]) => {
    for (const v of arr) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
      bucket[idx] += 1;
    }
  };

  add(dSeg, countsD);
  add(bSeg, countsB);

  const fmt = (x: number) => (x < 1000 ? `${x.toFixed(0)}m` : `${(x / 1000).toFixed(2)}km`);

  return countsD.map((_, i) => {
    const lo = min + i * width;
    const hi = lo + width;
    return {
      bin: `${fmt(lo)}–${fmt(hi)}`,
      d: countsD[i],
      b: countsB[i],
    };
  });
}

export default function AlgoRaceCharts({ telemetry, dijkstraRoute, bmssspRoute }: AlgoRaceChartsProps) {
  const hist = useMemo(() => {
    const dSeg = segmentLengthsMeters(dijkstraRoute);
    const bSeg = segmentLengthsMeters(bmssspRoute);
    return buildHistogram(dSeg, bSeg, 10);
  }, [dijkstraRoute, bmssspRoute]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[10px] font-mono text-gray-300 mb-2">Live telemetry (explored edges + route completion)</div>
        <div className="h-[170px] w-full">
          <ResponsiveContainer>
            <LineChart data={telemetry} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                domain={['dataMin', 'dataMax']}
                type="number"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                width={34}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                width={34}
                domain={[0, 1]}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11,
                }}
                labelFormatter={(v) => `${Number(v).toFixed(1)}s`}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                }}
              />

              {/* explored edges */}
              <Line yAxisId="left" type="monotone" dataKey="dExplored" name="Dijk explored" stroke="#22d3ee" dot={false} strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="bExplored" name="Duan explored" stroke="#a78bfa" dot={false} strokeWidth={2} />

              {/* route completion (0..1) */}
              <Line yAxisId="right" type="monotone" dataKey="dRoutePct" name="Dijk route%" stroke="#22d3ee" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
              <Line yAxisId="right" type="monotone" dataKey="bRoutePct" name="Duan route%" stroke="#a78bfa" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[9px] font-mono text-gray-400 mt-1">
          Left axis = explored edges (search footprint). Right axis = route completion (0→100%).
        </div>
      </div>

      <div>
        <div className="text-[10px] font-mono text-gray-300 mb-2">Route micro-structure (segment-length histogram)</div>
        <div className="h-[170px] w-full">
          <ResponsiveContainer>
            <BarChart data={hist} margin={{ top: 8, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="bin"
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                interval={1}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
                width={34}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11,
                }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                }}
              />
              <Bar dataKey="d" name="Dijkstra" fill="#22d3ee" opacity={0.7} />
              <Bar dataKey="b" name="Duan–Mao" fill="#a78bfa" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[9px] font-mono text-gray-400 mt-1">
          
        </div>
      </div>
    </div>
  );
}
