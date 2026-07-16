// Tiny dependency-free area chart. Plots real points (cumulative levies over
// time). Degrades gracefully with 0/1 points.
export function AreaChart({
  data,
  height = 220,
}: {
  data: { t: number; v: number }[];
  height?: number;
}) {
  const W = 720;
  const H = height;
  const padX = 8;
  const padY = 18;

  if (data.length === 0) {
    return (
      <div className="chart-empty muted">
        No contributions yet — the chart starts with the first levy.
      </div>
    );
  }

  const pts = data.length === 1 ? [data[0], data[0]] : data;
  const xs = pts.map((p) => p.t);
  const vs = pts.map((p) => p.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxV = Math.max(...vs, 0.0001);
  const spanX = maxX - minX || 1;

  const X = (t: number) => padX + ((t - minX) / spanX) * (W - padX * 2);
  const Y = (v: number) => H - padY - (v / maxV) * (H - padY * 2);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(p.t)},${Y(p.v)}`).join(" ");
  const area = `${line} L${X(pts[pts.length - 1].t)},${H - padY} L${X(pts[0].t)},${H - padY} Z`;

  // horizontal gridlines
  const rows = 4;
  const grid = Array.from({ length: rows + 1 }, (_, i) => {
    const y = padY + (i / rows) * (H - padY * 2);
    const val = maxV * (1 - i / rows);
    return { y, val };
  });

  return (
    <svg
      className="areachart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Levies collected over time"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E5B3A" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1E5B3A" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {grid.map((g, i) => (
        <g key={i}>
          <line
            x1={padX}
            x2={W - padX}
            y1={g.y}
            y2={g.y}
            stroke="#e4dccb"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text x={W - padX} y={g.y - 3} className="ac-tick" textAnchor="end">
            {g.val.toFixed(2)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="#1E5B3A" strokeWidth="2.5" />
      {pts.map((p, i) => (
        <circle key={i} cx={X(p.t)} cy={Y(p.v)} r="3" fill="#1E5B3A" />
      ))}
    </svg>
  );
}
