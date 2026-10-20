// Spike: our own metro-map engine. Stations keep stored grid positions
// (layout as data); hops are routed by A* on an octilinear grid; lines that
// share grid edges run in parallel bundles; labels avoid collisions.
// Run: node engine.ts data.json light|dark > map.svg   (Node >= 23, type stripping)
import { readFileSync } from "node:fs";

type Pt = [number, number];
type Station = {
  id: string; label: string; at: Pt;
  licence?: "paid" | "planned"; renewsInDays?: number; status?: "active" | "closed";
};
type Line = { id: string; code: string; label: string; color: string; stops: string[] };
type Zone = { id: string; label: string; color: string; stations: string[] };
type MapData = { title: string; subtitle: string; zones: Zone[]; lines: Line[]; stations: Station[] };

const data: MapData = JSON.parse(readFileSync(process.argv[2], "utf8"));
const theme = process.argv[3] === "dark" ? "dark" : "light";
const T = theme === "dark"
  ? { bg: "#16181d", fg: "#f1f1f1", muted: "#8a8f98", grid: "#2a2f3a", header: "#0b1440", ring: "#16181d", closed: "#5c616b" }
  : { bg: "#ffffff", fg: "#111111", muted: "#6b6f76", grid: "#d6e4f5", header: "#000f9f", ring: "#ffffff", closed: "#a9adb3" };

const G = 64, LW = 7, SP = LW + 1.5, PAD = 90, TOP = 84, FS = 13;
const FONT = "Avenir Next, Helvetica Neue, Arial, sans-serif";
const DIRS: Pt[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const key = (p: Pt) => `${p[0]},${p[1]}`;
const st = new Map(data.stations.map((s) => [s.id, s]));
const lineIdx = new Map(data.lines.map((l, i) => [l.id, i]));

// ---------- routing ----------
const xs = data.stations.map((s) => s.at[0]), ys = data.stations.map((s) => s.at[1]);
const minC = Math.min(...xs) - 1, maxC = Math.max(...xs) + 1, minR = Math.min(...ys) - 1, maxR = Math.max(...ys) + 1;
const stationAt = new Map(data.stations.map((s) => [key(s.at), s.id]));
const edgeKey = (a: Pt, b: Pt) => (key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`);
const usedEdges = new Map<string, number>();
const usedNodes = new Map<string, number>();

function octile(a: Pt, b: Pt) {
  const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

// Direction a line should keep through a station, from hops already routed.
// Returns direction indices: at `from`, the preferred first move; at `to`, the preferred last move.
const dirIdx = (a: Pt, b: Pt) => DIRS.findIndex(([dx, dy]) => dx === Math.sign(b[0] - a[0]) && dy === Math.sign(b[1] - a[1]));
function preferred(at: string, other: string, lines: string[], end: "from" | "to"): number[] {
  const out: number[] = [];
  for (const id of lines) {
    const s = data.lines[lineIdx.get(id)!].stops;
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== at) continue;
      for (const nb of [s[i - 1], s[i + 1]]) {
        if (!nb || nb === other) continue;
        const p = hopPath.get([at, nb].sort().join("|"));
        if (!p) continue;
        const q = key(p[0]) === key(st.get(at)!.at) ? p : [...p].reverse();
        const leave = dirIdx(q[0], q[1]); // the neighbour hop leaves `at` this way
        out.push(end === "from" ? (leave + 4) % 8 : leave);
      }
    }
  }
  return out;
}
const turnOf = (a: number, b: number) => { const t = Math.abs(a - b); return Math.min(t, 8 - t); };
const STATION_TURN = [0, 0.8, 2.5, 9, 9];
const hopPath = new Map<string, Pt[]>();

function route(from: string, to: string, lines: string[]): Pt[] {
  const A = st.get(from)!.at, B = st.get(to)!.at;
  const prefFrom = preferred(from, to, lines, "from"), prefTo = preferred(to, from, lines, "to");
  type S = { p: Pt; d: number; g: number; f: number; prev?: S };
  const open: S[] = [{ p: A, d: -1, g: 0, f: octile(A, B) * 0.5 }];
  const best = new Map<string, number>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.p[0] === B[0] && cur.p[1] === B[1]) {
      const path: Pt[] = [];
      for (let s: S | undefined = cur; s; s = s.prev) path.unshift(s.p);
      return path;
    }
    const sk = `${key(cur.p)},${cur.d}`;
    if ((best.get(sk) ?? Infinity) < cur.g) continue;
    DIRS.forEach(([dx, dy], d) => {
      const n: Pt = [cur.p[0] + dx, cur.p[1] + dy];
      if (n[0] < minC || n[0] > maxC || n[1] < minR || n[1] > maxR) return;
      const occ = stationAt.get(key(n));
      if (occ && occ !== to) return; // never run through a station you do not stop at
      let turn = 0;
      if (cur.d >= 0) { const t = Math.abs(cur.d - d); turn = Math.min(t, 8 - t); }
      if (turn >= 3) return; // no hairpins
      const ek = edgeKey(cur.p, n);
      let c = (dx && dy ? Math.SQRT2 : 1) * (usedEdges.has(ek) ? 0.5 : 1);
      c += [0, 1.2, 3][turn];
      if (cur.d < 0) for (const pd of prefFrom) c += STATION_TURN[turnOf(d, pd)];
      if (n[0] === B[0] && n[1] === B[1]) for (const pd of prefTo) c += STATION_TURN[turnOf(d, pd)];
      if (!usedEdges.has(ek) && usedNodes.has(key(n)) && !occ) c += 0.8; // discourage crossings
      if (dx && dy && usedEdges.has(edgeKey([cur.p[0] + dx, cur.p[1]], [cur.p[0], cur.p[1] + dy]))) c += 6; // X-crossing
      const g = cur.g + c, nk = `${key(n)},${d}`;
      if ((best.get(nk) ?? Infinity) <= g) return;
      best.set(nk, g);
      open.push({ p: n, d, g, f: g + octile(n, B) * 0.5, prev: cur });
    });
  }
  throw new Error(`no route ${from} -> ${to}`);
}

const hops = new Map<string, { a: string; b: string; lines: string[] }>();
for (const l of data.lines) for (let i = 0; i + 1 < l.stops.length; i++) {
  const [a, b] = [l.stops[i], l.stops[i + 1]].sort();
  const k = `${a}|${b}`;
  if (!hops.has(k)) hops.set(k, { a, b, lines: [] });
  hops.get(k)!.lines.push(l.id);
}
[...hops.entries()]
  .sort((x, y) => y[1].lines.length - x[1].lines.length || octile(st.get(x[1].a)!.at, st.get(x[1].b)!.at) - octile(st.get(y[1].a)!.at, st.get(y[1].b)!.at))
  .forEach(([k, h]) => {
    const p = route(h.a, h.b, h.lines);
    hopPath.set(k, p);
    for (let i = 0; i + 1 < p.length; i++) {
      const ek = edgeKey(p[i], p[i + 1]);
      usedEdges.set(ek, (usedEdges.get(ek) ?? 0) + 1);
      usedNodes.set(key(p[i]), 1); usedNodes.set(key(p[i + 1]), 1);
    }
  });

// grid path per line
const linePath = new Map<string, Pt[]>();
for (const l of data.lines) {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < l.stops.length; i++) {
    const [a, b] = [l.stops[i], l.stops[i + 1]];
    const k = [a, b].sort().join("|");
    let p = hopPath.get(k)!;
    if (key(p[0]) !== key(st.get(a)!.at)) p = [...p].reverse();
    out.push(...(out.length ? p.slice(1) : p));
  }
  linePath.set(l.id, out);
}

// lines per grid segment, ordered by line index (consistent bundle order)
const segLines = new Map<string, string[]>();
for (const [id, p] of linePath) for (let i = 0; i + 1 < p.length; i++) {
  const ek = edgeKey(p[i], p[i + 1]);
  const arr = segLines.get(ek) ?? [];
  if (!arr.includes(id)) arr.push(id);
  segLines.set(ek, arr);
}
for (const arr of segLines.values()) arr.sort((a, b) => lineIdx.get(a)! - lineIdx.get(b)!);

// ---------- geometry ----------
const px = (p: Pt): Pt => [PAD + (p[0] - minC) * G, TOP + PAD + (p[1] - minR) * G];
function canon(a: Pt, b: Pt) { // canonical normal + sign so bundle order is the same both ways
  const [x1, y1] = px(a), [x2, y2] = px(b);
  let dx = x2 - x1, dy = y2 - y1;
  const flip = dx < 0 || (dx === 0 && dy < 0);
  if (flip) { dx = -dx; dy = -dy; }
  const n = Math.hypot(dx, dy);
  return { nx: -dy / n, ny: dx / n };
}
function slot(id: string, a: Pt, b: Pt) {
  const arr = segLines.get(edgeKey(a, b))!;
  return (arr.indexOf(id) - (arr.length - 1) / 2) * SP;
}
function offsetPoint(id: string, a: Pt, b: Pt, at: Pt): Pt {
  const { nx, ny } = canon(a, b), k = slot(id, a, b), [x, y] = px(at);
  return [x + nx * k, y + ny * k];
}
function intersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
  return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
}
const lineGeom = new Map<string, Pt[]>();
for (const [id, p] of linePath) {
  const pts: Pt[] = [offsetPoint(id, p[0], p[1], p[0])];
  for (let i = 1; i + 1 < p.length; i++) {
    const a0 = offsetPoint(id, p[i - 1], p[i], p[i - 1]), a1 = offsetPoint(id, p[i - 1], p[i], p[i]);
    const b0 = offsetPoint(id, p[i], p[i + 1], p[i]), b1 = offsetPoint(id, p[i], p[i + 1], p[i + 1]);
    const X = intersect(a0, [a1[0] - a0[0], a1[1] - a0[1]], b0, [b1[0] - b0[0], b1[1] - b0[1]]);
    if (X) pts.push(X);
    else if (Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) > 0.5) { // slot change on a straight: 45-degree jog
      const ux = (a1[0] - a0[0]) / Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), uy = (a1[1] - a0[1]) / Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
      const j = Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) / 2;
      pts.push([a1[0] - ux * j, a1[1] - uy * j], [b0[0] + ux * j, b0[1] + uy * j]);
    }
  }
  const n = p.length;
  pts.push(offsetPoint(id, p[n - 2], p[n - 1], p[n - 1]));
  lineGeom.set(id, pts);
}
const stationPx = data.stations.map((s) => px(s.at));
function rounded(pts: Pt[], r = G * 0.42) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i + 1 < pts.length; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1]), l2 = Math.hypot(n[0] - c[0], n[1] - c[1]);
    // a bend at a station keeps a tight corner, so the line really passes the station
    const atStation = stationPx.some((s) => Math.hypot(s[0] - c[0], s[1] - c[1]) < SP * 4);
    const rr = Math.min(atStation ? 3 : r, l1 / 2, l2 / 2);
    const a: Pt = [c[0] - (c[0] - p[0]) / l1 * rr, c[1] - (c[1] - p[1]) / l1 * rr];
    const b: Pt = [c[0] + (n[0] - c[0]) / l2 * rr, c[1] + (n[1] - c[1]) / l2 * rr];
    d += ` L${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  const z = pts[pts.length - 1];
  return d + ` L${z[0].toFixed(1)},${z[1].toFixed(1)}`;
}

// ---------- stations ----------
type Marker = { id: string; kind: "interchange" | "tick"; a: Pt; b: Pt; color?: string; nx: number; ny: number };
const markers: Marker[] = [];
const linesAt = new Map<string, string[]>();
for (const l of data.lines) for (const s of l.stops) linesAt.set(s, [...(linesAt.get(s) ?? []), l.id]);
for (const s of data.stations) {
  const ids = linesAt.get(s.id) ?? [];
  if (!ids.length) continue; // off-line item: listed in the catalogue, not drawn on the map
  const offs: Pt[] = []; let nrm = { nx: 0, ny: -1 };
  ids.forEach((id, i) => {
    const p = linePath.get(id)!; const j = p.findIndex((q) => key(q) === key(s.at));
    const segs: [Pt, Pt][] = [];
    if (j + 1 < p.length) segs.push([p[j], p[j + 1]]);
    if (j > 0) segs.push([p[j - 1], p[j]]);
    if (i === 0) nrm = canon(...segs[0]);
    for (const [a, b] of segs) offs.push(offsetPoint(id, a, b, s.at)); // in and out slots
  });
  if (ids.length > 1) {
    // the pill spans the two farthest line points, so every line touches it
    let a = offs[0], b = offs[0], far = -1;
    for (const p of offs) for (const q of offs) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > far) { far = d; a = p; b = q; } }
    markers.push({ id: s.id, kind: "interchange", a, b, nx: nrm.nx, ny: nrm.ny });
  } else markers.push({ id: s.id, kind: "tick", a: offs[0], b: offs[0], color: data.lines[lineIdx.get(ids[0])!].color, nx: nrm.nx, ny: nrm.ny });
}

// ---------- labels with collision avoidance ----------
type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const obstacles: Box[] = [];
for (const pts of lineGeom.values()) for (let i = 0; i + 1 < pts.length; i++) {
  const [a, b] = [pts[i], pts[i + 1]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let t = 0; t <= L; t += 5) {
    const x = a[0] + (b[0] - a[0]) * t / L, y = a[1] + (b[1] - a[1]) * t / L;
    obstacles.push({ x: x - LW / 2, y: y - LW / 2, w: LW, h: LW });
  }
}
for (const m of markers) { const [x, y] = m.a; obstacles.push({ x: x - 15, y: y - 15, w: 30, h: 30 }); obstacles.push({ x: m.b[0] - 15, y: m.b[1] - 15, w: 30, h: 30 }); }
// line badges at both termini (Sao Paulo style); they are obstacles for labels
const badges: { x: number; y: number; line: Line }[] = [];
for (const l of data.lines) {
  const g = lineGeom.get(l.id)!;
  for (const [end, prev] of [[g[0], g[1]], [g[g.length - 1], g[g.length - 2]]] as [Pt, Pt][]) {
    const L = Math.hypot(end[0] - prev[0], end[1] - prev[1]);
    const x = end[0] + (end[0] - prev[0]) / L * 24, y = end[1] + (end[1] - prev[1]) / L * 24;
    badges.push({ x, y, line: l });
    // a label over a badge hides the line number: weigh it like many line samples
    for (let i = 0; i < 8; i++) obstacles.push({ x: x - 12, y: y - 12, w: 24, h: 24 });
  }
}
function wrap(t: string) {
  if (t.length <= 12 || !t.includes(" ")) return [t];
  const mid = t.length / 2; let best = -1;
  for (let i = 0; i < t.length; i++) if (t[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [t.slice(0, best), t.slice(best + 1)];
}
const labels: { s: Station; rows: string[]; x: number; y: number; anchor: string; box: Box }[] = [];
const order = [...data.stations].filter((s) => linesAt.has(s.id)).sort((a, b) => (linesAt.get(b.id)?.length ?? 0) - (linesAt.get(a.id)?.length ?? 0));
for (const s of order) {
  const m = markers.find((q) => q.id === s.id)!;
  const rows = wrap(s.label);
  const suffix = (s.licence ? 14 : 0) + (s.renewsInDays !== undefined && s.renewsInDays <= 30 ? 24 : 0);
  const w = Math.max(...rows.map((r) => r.length)) * FS * 0.6 + suffix, h = rows.length * FS * 1.2;
  const [cx, cy] = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2];
  const ext = Math.max(Math.abs(m.a[0] - m.b[0]), Math.abs(m.a[1] - m.b[1])) / 2 + 17;
  const cands: [number, number, string][] = [
    [cx + ext, cy - h / 2, "start"], [cx - ext - w, cy - h / 2, "end"], [cx - w / 2, cy - ext - h, "middle"], [cx - w / 2, cy + ext, "middle"],
    [cx + ext * 0.8, cy - ext * 0.8 - h, "start"], [cx + ext * 0.8, cy + ext * 0.8, "start"], [cx - ext * 0.8 - w, cy - ext * 0.8 - h, "end"], [cx - ext * 0.8 - w, cy + ext * 0.8, "end"],
  ];
  // a second, farther ring for crowded interchanges (Tube labels often sit a little away)
  const far = ext * 1.9;
  cands.push([cx + far, cy - h / 2, "start"], [cx - far - w, cy - h / 2, "end"], [cx - w / 2, cy - far - h, "middle"], [cx - w / 2, cy + far, "middle"]);
  let pick = cands[0], bestScore = Infinity;
  cands.forEach((c, i) => {
    const box = { x: c[0], y: c[1], w, h };
    const coll = obstacles.filter((o) => hit(o, box)).length + labels.filter((l) => hit(l.box, box)).length * 50;
    const score = coll * 10 + i;
    if (score < bestScore) { bestScore = score; pick = c; }
  });
  const box = { x: pick[0], y: pick[1], w, h };
  const ax = pick[2] === "start" ? box.x : pick[2] === "end" ? box.x + w : box.x + w / 2;
  labels.push({ s, rows, x: ax, y: box.y + FS, anchor: pick[2], box });
}

// ---------- svg ----------
const W = PAD * 2 + (maxC - minC) * G + 300, H = TOP + PAD * 2 + (maxR - minR) * G;
const o: string[] = [];
o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`);
o.push(`<rect width="100%" height="100%" fill="${T.bg}"/>`);
// header (TfL-style band)
o.push(`<rect width="100%" height="${TOP - 14}" fill="${T.header}"/>`);
o.push(`<text x="${PAD - 40}" y="46" fill="#fff" font-size="30" font-weight="700">${data.title}</text>`);
o.push(`<text x="${PAD + 260}" y="44" fill="#c9d3ff" font-size="13">${data.subtitle}</text>`);
// grid reference frame
const fx0 = PAD - 40, fy0 = TOP + 10, fx1 = W - 300, fy1 = H - 20;
o.push(`<rect x="${fx0}" y="${fy0}" width="${fx1 - fx0}" height="${fy1 - fy0}" fill="none" stroke="${T.grid}" stroke-width="1.5"/>`);
const cols = 6, rowsN = 4;
for (let i = 0; i < cols; i++) {
  const x = fx0 + (fx1 - fx0) * i / cols;
  if (i) o.push(`<line x1="${x}" y1="${fy0}" x2="${x}" y2="${fy1}" stroke="${T.grid}" stroke-width="1"/>`);
  o.push(`<text x="${x + (fx1 - fx0) / cols / 2}" y="${fy0 + 14}" fill="${T.muted}" font-size="11" text-anchor="middle">${i + 1}</text>`);
}
for (let j = 0; j < rowsN; j++) {
  const y = fy0 + (fy1 - fy0) * j / rowsN;
  if (j) o.push(`<line x1="${fx0}" y1="${y}" x2="${fx1}" y2="${y}" stroke="${T.grid}" stroke-width="1"/>`);
  o.push(`<text x="${fx0 + 8}" y="${y + (fy1 - fy0) / rowsN / 2}" fill="${T.muted}" font-size="11">${"ABCDEFG"[j]}</text>`);
}
// zones: soft hulls (fare-zone style)
function hull(ps: Pt[]) {
  const p = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
for (const z of data.zones) {
  const pts = hull(z.stations.map((id) => px(st.get(id)!.at)));
  const d = pts.map((p) => p.join(",")).join(" ");
  o.push(`<g opacity="${theme === "dark" ? 0.18 : 0.09}"><polygon points="${d}" fill="${z.color}" stroke="${z.color}" stroke-width="90" stroke-linejoin="round"/></g>`);
  // zone name goes on the hull edge spot with the fewest collisions
  const text = z.label.toUpperCase(), tw = text.length * 8.5;
  const spots: Pt[] = pts.flatMap((p) => [[p[0] - 20, p[1] - 50], [p[0] - 20, p[1] + 62], [p[0] - tw + 20, p[1] + 62]] as Pt[]);
  let spot = spots[0], low = Infinity;
  for (const sp of spots) {
    const box = { x: sp[0], y: sp[1] - 12, w: tw, h: 16 };
    const n = obstacles.filter((q) => hit(q, box)).length + labels.filter((l) => hit(l.box, box)).length * 20;
    if (n < low) { low = n; spot = sp; }
  }
  o.push(`<text x="${spot[0]}" y="${spot[1]}" fill="${z.color}" font-size="12" font-weight="700" letter-spacing="1">${text}</text>`);
}
// lines: casing gap where lines cross (bridge look), then colour
for (const l of data.lines) o.push(`<path d="${rounded(lineGeom.get(l.id)!)}" fill="none" stroke="${T.bg}" stroke-width="${LW + 3}" stroke-linejoin="round" stroke-linecap="round"/>`);
for (const l of data.lines) o.push(`<path d="${rounded(lineGeom.get(l.id)!)}" fill="none" stroke="${l.color}" stroke-width="${LW}" stroke-linejoin="round" stroke-linecap="butt"/>`);
for (const { x: bx, y: by, line: l } of badges)
  o.push(`<rect x="${bx - 9}" y="${by - 9}" width="18" height="18" rx="3" fill="${l.color}"/><text x="${bx}" y="${by + 4.5}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${l.code}</text>`);
// station markers
for (const m of markers) {
  const s = st.get(m.id)!;
  const closed = s.status === "closed";
  if (m.kind === "interchange") {
    o.push(`<line x1="${m.a[0]}" y1="${m.a[1]}" x2="${m.b[0]}" y2="${m.b[1]}" stroke="${T.fg}" stroke-width="17" stroke-linecap="round"/>`);
    o.push(`<line x1="${m.a[0]}" y1="${m.a[1]}" x2="${m.b[0]}" y2="${m.b[1]}" stroke="${T.ring}" stroke-width="11" stroke-linecap="round"/>`);
  } else {
    const lab = labels.find((l) => l.s.id === m.id)!;
    const side = Math.sign((lab.box.x + lab.box.w / 2 - m.a[0]) * m.nx + (lab.box.y + lab.box.h / 2 - m.a[1]) * m.ny) || 1;
    const x1 = m.a[0] + m.nx * side * (LW / 2 - 1), y1 = m.a[1] + m.ny * side * (LW / 2 - 1);
    const x2 = m.a[0] + m.nx * side * (LW / 2 + 6), y2 = m.a[1] + m.ny * side * (LW / 2 + 6);
    o.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${closed ? T.closed : m.color}" stroke-width="${LW - 1}"/>`);
  }
  if (s.licence === "planned") o.push(`<circle cx="${m.a[0]}" cy="${m.a[1]}" r="13" fill="none" stroke="${T.fg}" stroke-width="1.6" stroke-dasharray="3 3"/>`);
  if (s.renewsInDays !== undefined && s.renewsInDays <= 30) o.push(`<circle cx="${m.a[0]}" cy="${m.a[1]}" r="14" fill="none" stroke="#F5A300" stroke-width="3"/>`);
}
// labels
for (const l of labels) {
  const s = l.s, closed = s.status === "closed";
  const fill = closed ? T.closed : T.fg;
  const weight = (linesAt.get(s.id)?.length ?? 0) > 1 ? 700 : 500;
  l.rows.forEach((r, i) => {
    const last = i === l.rows.length - 1;
    const lic = last && s.licence ? `<tspan fill="#C9971C" font-weight="800"> £</tspan>` : "";
    const renew = last && s.renewsInDays !== undefined && s.renewsInDays <= 30 ? `<tspan fill="#D98200" font-size="10" font-weight="700"> ${s.renewsInDays}d</tspan>` : "";
    o.push(`<text x="${l.x}" y="${l.y + i * FS * 1.2}" fill="${fill}" font-size="${FS}" font-weight="${weight}" text-anchor="${l.anchor}"${closed ? ' font-style="italic"' : ""}>${r}${lic}${renew}</text>`);
  });
}
// key to lines and symbols
const kx = W - 270; let ky = TOP + 40;
o.push(`<text x="${kx}" y="${ky}" fill="${T.header === "#000f9f" ? "#000f9f" : T.fg}" font-size="16" font-weight="700">Lines (journeys)</text>`); ky += 22;
for (const l of data.lines) {
  o.push(`<rect x="${kx}" y="${ky - 12}" width="16" height="16" rx="3" fill="${l.color}"/><text x="${kx + 8}" y="${ky + 1}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">${l.code}</text>`);
  o.push(`<line x1="${kx + 24}" y1="${ky - 4}" x2="${kx + 64}" y2="${ky - 4}" stroke="${l.color}" stroke-width="${LW}"/><text x="${kx + 74}" y="${ky + 1}" fill="${T.fg}" font-size="13">${l.label}</text>`);
  ky += 24;
}
ky += 16;
o.push(`<text x="${kx}" y="${ky}" fill="${T.header === "#000f9f" ? "#000f9f" : T.fg}" font-size="16" font-weight="700">Symbols</text>`); ky += 26;
const sym = (svg: string, text: string) => { o.push(svg, `<text x="${kx + 40}" y="${ky + 4}" fill="${T.fg}" font-size="13">${text}</text>`); ky += 28; };
sym(`<line x1="${kx + 12}" y1="${ky}" x2="${kx + 12}" y2="${ky}" stroke="${T.fg}" stroke-width="17" stroke-linecap="round"/><line x1="${kx + 12}" y1="${ky}" x2="${kx + 12}" y2="${ky}" stroke="${T.ring}" stroke-width="11" stroke-linecap="round"/>`, "Interchange (several journeys)");
sym(`<text x="${kx + 6}" y="${ky + 5}" fill="#C9971C" font-size="15" font-weight="800">£</text>`, "Paid licence");
sym(`<circle cx="${kx + 12}" cy="${ky}" r="10" fill="none" stroke="#F5A300" stroke-width="3"/>`, "Renews within 30 days");
sym(`<circle cx="${kx + 12}" cy="${ky}" r="10" fill="none" stroke="${T.fg}" stroke-width="1.6" stroke-dasharray="3 3"/>`, "Planned purchase");
sym(`<text x="${kx}" y="${ky + 5}" fill="${T.closed}" font-size="13" font-style="italic">Name</text>`, "Closed station (removed)");
o.push(`</svg>`);
process.stdout.write(o.join("\n"));
