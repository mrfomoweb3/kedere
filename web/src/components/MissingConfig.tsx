export function MissingConfig({
  what,
  detail,
}: {
  what: string;
  detail: string;
}) {
  return (
    <div className="center-note">
      <div className="card center-note-card">
        <div className="brand" style={{ justifyContent: "center" }}>
          <span className="brand-mark">K</span>
          <span className="brand-name">KEDERE</span>
        </div>
        <p>
          Missing <code>{what}</code>.
        </p>
        <p className="muted" style={{ fontSize: 14 }}>
          {detail}
        </p>
      </div>
    </div>
  );
}
