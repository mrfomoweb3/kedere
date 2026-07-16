// Semicircle gauge (like the reference's "Customers Volume"), in our palette.
// `value`/`max` drive the fill; `big` + `label` are the centre readout.
export function Gauge({
  value,
  max,
  big,
  label,
  caption,
}: {
  value: number;
  max: number;
  big: string;
  label: string;
  caption?: string;
}) {
  const segments = 34;
  const filled = max > 0 ? Math.round((Math.min(value, max) / max) * segments) : 0;
  const cx = 130;
  const cy = 130;
  const rOuter = 118;
  const rInner = 92;

  const ticks = Array.from({ length: segments }, (_, i) => {
    // spread across the top semicircle: 180° (left) → 360° (right)
    const a = Math.PI + (i / (segments - 1)) * Math.PI;
    const x1 = cx + rInner * Math.cos(a);
    const y1 = cy + rInner * Math.sin(a);
    const x2 = cx + rOuter * Math.cos(a);
    const y2 = cy + rOuter * Math.sin(a);
    return { x1, y1, x2, y2, on: i < filled };
  });

  return (
    <div className="gauge">
      <svg viewBox="0 0 260 150" className="gauge-svg" role="img" aria-label={label}>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.on ? "#1E5B3A" : "#e4dccb"}
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
        <text x="130" y="112" textAnchor="middle" className="gauge-big num">
          {big}
        </text>
        <text x="130" y="134" textAnchor="middle" className="gauge-label">
          {label}
        </text>
      </svg>
      {caption && <div className="gauge-caption">{caption}</div>}
    </div>
  );
}
