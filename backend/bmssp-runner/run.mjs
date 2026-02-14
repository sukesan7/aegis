import { buildGraph, sssp } from "bm-sssp";

// Read stdin
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks).toString("utf8").trim();

try {
  const payload = JSON.parse(input || "{}");
  const n = payload.n;
  const edgesIn = payload.edges || [];
  const source = payload.source;
  const target = payload.target;
  const returnPredecessors = !!payload.returnPredecessors;

  if (typeof n !== "number" || n <= 0) throw new Error("missing n");
  if (typeof source !== "number") throw new Error("missing source");
  if (typeof target !== "number") throw new Error("missing target");

  // Convert [u,v,w] -> {u,v,w}
  const edges = edgesIn.map(([u, v, w]) => ({ u, v, w }));

  const G = buildGraph({ n, edges, directed: true });
  const { dist, pred } = sssp(G, { source, returnPredecessors });

  const out = {
    distTarget: Number(dist[target]),
    predecessors: pred ? Array.from(pred) : null,
  };

  process.stdout.write(JSON.stringify(out));
} catch (err) {
  process.stderr.write(String(err?.stack || err));
  process.exit(1);
}
